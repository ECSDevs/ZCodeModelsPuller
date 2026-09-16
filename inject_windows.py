#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# MIT License
# Copyright (c) 2026 zcode-model-puller contributors
# 上游：github.com/HHQ-666/zcode-model-puller —— Copyright (c) 2025 HHQ
# 本文件为 Windows 移植，详见仓库 LICENSE。
"""inject_windows.py — 把「⚡️ 自动拉取模型」能力注入 ZCode 客户端（Windows 版）。

移植自 https://github.com/HHQ-666/zcode-model-puller（MIT）的 macOS 注入逻辑：
  1. 备份 app.asar（仅首次，ZCode 升级后自动刷新到新原版）
  2. npx @electron/asar extract 解包到临时目录
  3. 三层补丁：
     - out/renderer/index.html 挂载 zcode-model-puller.js（入口脚本）
     - out/preload/index.cjs  向 window.zcode 扩展 readConfigFile / writeConfigFile / fetchModelsFromUrl
     - out/main/index.js      注册对应 IPC handler（node:fs 读写配置、node:http(s) 探测 /models）
  4. 重新打包并在“标记自检”通过后原子替换 app.asar

minifier 变量名随版本漂移，注入代码里引用的变量一律运行时从现场正则捕获，绝不硬编码。

用法：
  python inject_windows.py            # 注入（安装）
  python inject_windows.py --restore  # 从备份还原官方原版
  python inject_windows.py --check    # 只读检查注入状态（不碰文件）
  python inject_windows.py --dry-run  # 解包演练：验证各锚点可命中，不写回不替换

注入后请完全退出并重新打开 ZCode；ZCode 升级后需重跑安装。
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:  # Windows 控制台默认 GBK，强制 UTF-8 输出
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PULLER_JS = SCRIPT_DIR / "zcode-model-puller.js"
OMP_EFFORTS_FILE = SCRIPT_DIR / "omp_efforts.json"  # oh-my-pi 模型级档位表（gen_omp_efforts.py 生成）

MARKER_HTML = "./zcode-model-puller.js"      # index.html 里的挂载标记
MARKER_IPC = "zcode:read-model-config"       # preload / main 里的通道标记
CH_READ = "zcode:read-model-config"
CH_WRITE = "zcode:write-model-config"
CH_FETCH = "zcode:fetch-models-from-url"
CH_ADD = "zcode:add-models-with-metadata"  # 拉取保存：models.dev 元数据 + 272K 封顶 + 内置 reasoning 表
CH_ENRICH = "zcode:enrich-model-metadata"  # 官方保存后：给已有模型补缺失元数据（不覆盖已有值）
CH_META = "zcode:model-metadata"           # 填表单前：按 models.dev 计算各模型 ctx/output/modalities
SCRIPT_TAG = '  <script type="module" src="./zcode-model-puller.js"></script>\n'


def default_asar() -> Path:
    local_appdata = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local_appdata) / "Programs" / "ZCode" / "resources" / "app.asar"


# ---------------------------------------------------------------- 基础工具

def info(msg: str) -> None:
    print(msg)


def warn(msg: str) -> None:
    print(f"⚠  {msg}", file=sys.stderr)


def die(msg: str, code: int = 1):
    print(f"✗  {msg}", file=sys.stderr)
    sys.exit(code)


def scan_bytes(path: Path, needles: list[str]) -> dict[str, int]:
    """对文件做二进制安全子串扫描，返回每个 needles 的命中次数。"""
    data = path.read_bytes()
    return {n: data.count(n.encode("utf-8")) for n in needles}


def hash_file(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_zcode_not_running() -> bool:
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq ZCode.exe", "/NH"],
            capture_output=True, text=True, timeout=30,
        ).stdout
        if "ZCode.exe" in out:
            warn("检测到 ZCode 正在运行。请完全退出 ZCode（含系统托盘）后再操作。")
            return False
    except Exception as e:
        warn(f"无法检查 ZCode 进程（{e}），将继续执行。")
    return True


def _asar_runner() -> str | None:
    """返回可用的 `@electron/asar` 调用前缀：npx 优先，缺 npx 时回退 pnpm dlx。"""
    if shutil.which("npx") or shutil.which("npx.cmd"):
        return "npx --yes @electron/asar"
    if shutil.which("pnpm") or shutil.which("pnpm.cmd"):
        return "pnpm dlx @electron/asar"
    return None


def run_npx(sub: str, *args: str) -> tuple[int, str, str]:
    """调用 @electron/asar <sub> <args…>（npx / pnpm dlx 级联）。运行时可执行器缺失时给出提示但不代为安装。"""
    runner = _asar_runner()
    if not runner:
        die("未检测到 npx 或 pnpm，无法调用 @electron/asar。请自行安装 Node.js（含 npm），脚本不会代为安装。")
    quoted = " ".join(f'"{a}"' for a in args)
    cmd = f"{runner} {sub} {quoted}".strip()
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        die("执行超时（>15 分钟），请重试或检查 Node/pnpm 是否正常。")
    return res.returncode, res.stdout, res.stderr


# ---------------------------------------------------------------- 备份

def backup_asar(asar: Path, bak: Path, dry_run: bool) -> None:
    if not bak.exists():
        if dry_run:
            info(f"(dry-run) 将创建原版备份 → {bak}")
            return
        shutil.copy2(asar, bak)
        info(f"已创建原版备份（仅首次执行）→ {bak}")
        return
    if hash_file(asar) == hash_file(bak):
        info(f"备份与当前 app.asar 一致，复用已有备份 → {bak}")
        return
    # 备份与当前 asar 不同：判断是不是 ZCode 升级后的新原版
    cur = scan_bytes(asar, [MARKER_IPC, MARKER_HTML])
    if cur[MARKER_IPC] == 0 and cur[MARKER_HTML] == 0:
        if dry_run:
            info("(dry-run) 当前 asar 为新的官方原版（无注入标记），将刷新备份。")
            return
        shutil.copy2(asar, bak)
        info("检测到 ZCode 已升级（当前 asar 为新的官方原版），备份已刷新 → 还原将回到这一版。")
    else:
        warn("当前 asar 已含注入标记且与备份内容不同：保留旧版原包备份（还原将回到旧版）。")


# ---------------------------------------------------------------- 三层补丁

def patch_html(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "html", "ok": False, "note": "out/renderer/index.html 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_HTML in src:
        return {"layer": "html", "ok": True, "applied": False, "note": "已存在挂载标记，跳过"}
    if "</body>" not in src:
        return {"layer": "html", "ok": False, "note": "未找到 </body> 锚点"}
    if dry_run:
        return {"layer": "html", "ok": True, "applied": False, "note": f"待注入 {MARKER_HTML}"}
    path.write_text(src.replace("</body>", SCRIPT_TAG + "</body>", 1), encoding="utf-8")
    return {"layer": "html", "ok": True, "applied": True, "note": "已在 </body> 前挂载启动入口"}


RE_IPC_HOLDER = re.compile(r"(?P<H>[\w$]+)\.ipcRenderer")
# 锚点必须吃掉开括号之后的 `{`：真实代码里 `exposeInMainWorld("zcode",` 与对象左花括号可能不在同一行，
# 只在逗号后插入会把键插到对象字面量外部造成语法错误（曾导致 preload 崩溃、ZCode 黑屏）。
RE_PRELOAD_ANCHOR = re.compile(r"[\w$]+\.exposeInMainWorld\s*\(\s*[\"']zcode[\"']\s*,\s*\{")
_PRELOAD_KEYS = (
    '  readConfigFile:()=>(__H__).invoke("' + CH_READ + '"),\n'
    '  writeConfigFile:d=>(__H__).invoke("' + CH_WRITE + '",d),\n'
    '  fetchModelsFromUrl:(t,n)=>(__H__).invoke("' + CH_FETCH + '",{baseUrl:t,apiKey:n}),\n'
    '  addModelsWithMetadata:x=>(__H__).invoke("' + CH_ADD + '",x),\n'
    '  enrichModelsWithMetadata:x=>(__H__).invoke("' + CH_ENRICH + '",x),\n'
    '  getModelMetadata:x=>(__H__).invoke("' + CH_META + '",x),\n'
    '  simulateMouseClick:(x,y)=>(__H__).invoke("zcode:simulate-mouse-click",{x:x,y:y}),\n'
    '  simulateMouseMove:(x,y)=>(__H__).invoke("zcode:simulate-mouse-move",{x:x,y:y}),\n'
)


def patch_preload(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "preload", "ok": False, "note": "out/preload/index.cjs 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_IPC in src:
        # 旧注入则幂等补上新增通道（simulateMouseClick/Move）
        if "simulateMouseClick" in src:
            return {"layer": "preload", "ok": True, "applied": False, "note": "已含完整 IPC 通道，跳过"}
        holder = _find_ipc_holder(src)
        if not holder:
            return {"layer": "preload", "ok": False, "note": "已注入但找不到 ipcRenderer 持有者"}
        extra = (
            '  simulateMouseClick:(x,y)=>(%s).invoke("zcode:simulate-mouse-click",{x:x,y:y}),\n'
            '  simulateMouseMove:(x,y)=>(%s).invoke("zcode:simulate-mouse-move",{x:x,y:y}),\n'
        ) % (holder, holder)
        # 插到 getModelMetadata 键之后（保证仍在对象字面量内）
        anchor = "getModelMetadata:"
        i = src.find(anchor)
        if i < 0:
            return {"layer": "preload", "ok": False, "note": "未找到 getModelMetadata 键锚点"}
        j = src.find("\n", i)
        if dry_run:
            return {"layer": "preload", "ok": True, "applied": False, "note": f"待追加 simulate 通道（ipcRenderer 持有者：{holder}）"}
        path.write_text(src[: j + 1] + extra + src[j + 1:], encoding="utf-8")
        return {"layer": "preload", "ok": True, "applied": True, "note": f"已补注入 simulate 通道（ipcRenderer 持有者：{holder}）"}
    m = RE_PRELOAD_ANCHOR.search(src)
    if not m:
        return {"layer": "preload", "ok": False, "note": "未找到 window.zcode exposeInMainWorld 锚点"}
    holder = _find_ipc_holder(src)
    if not holder:
        return {"layer": "preload", "ok": False, "note": "未找到 ipcRenderer 持有者"}
    keys = _PRELOAD_KEYS.replace("__H__", holder)
    if dry_run:
        return {"layer": "preload", "ok": True, "applied": False, "note": f"待注入（ipcRenderer 持有者：{holder}）"}
    # m.end() 位于对象左花括号之后，键直接插入对象字面量内部
    path.write_text(src[: m.end()] + "\n" + keys + src[m.end():], encoding="utf-8")
    return {"layer": "preload", "ok": True, "applied": True, "note": f"已扩展 window.zcode（ipcRenderer 持有者：{holder}）"}


def _find_ipc_holder(src: str) -> str | None:
    """在 exposeInMainWorld 对象字面量附近找 ipcRenderer 持有者，找不到回退全文/require。"""
    m = RE_PRELOAD_ANCHOR.search(src)
    window = src[m.end(): m.end() + 4000] if m else ""
    h = RE_IPC_HOLDER.search(window) or RE_IPC_HOLDER.search(src)
    if h and h.group("H"):
        return h.group("H") + ".ipcRenderer"
    if 'require("electron")' in src:
        return 'require("electron").ipcRenderer'
    return None


# 主进程 IPC handler（逻辑照搬参考仓库 + zprovider 元数据补全，仅把载体变量名改为运行时捕获的 __HE__）
_MAIN_HANDLERS = r'''__HE__.handle("zcode:read-model-config",async()=>{try{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os");let c=f.readFileSync(p.join(o.homedir(),".zcode","v2","config.json"),"utf-8");return{success:!0,data:JSON.parse(c)}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:write-model-config",async(e,d)=>{try{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os");f.writeFileSync(p.join(o.homedir(),".zcode","v2","config.json"),JSON.stringify(d,null,2),"utf-8");return{success:!0}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:fetch-models-from-url",async(e,{baseUrl:u,apiKey:k})=>{try{let{default:ht}=await import("node:https"),{default:h}=await import("node:http");let clean=(u||"").trim().replace(/\/+$/,"");let candidates=[];if(clean.endsWith("/v1")){candidates.push(clean+"/models");candidates.push(clean.replace(/\/v1$/,"")+"/models")}else{candidates.push(clean+"/v1/models");candidates.push(clean+"/models")}if(clean.endsWith("/api")){candidates.unshift(clean+"/v1/models")}for(let cur of candidates){try{let res=await new Promise((resolve,reject)=>{let mod=cur.startsWith("https:")?ht:h;let req=mod.request(cur,{method:"GET",headers:{"User-Agent":"ZCode/3.11.2","Accept":"application/json",...k?{Authorization:"Bearer "+k.trim(),"x-api-key":k.trim()}:{}},timeout:8000},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>{if(r.statusCode>=200&&r.statusCode<300){try{let j=JSON.parse(b);let l=Array.isArray(j)?j:Array.isArray(j.data)?j.data:Array.isArray(j.models)?j.models:[];let ids=[];for(let it of l){let id=typeof it=="string"?it.trim():(it.id||it.name||"").trim();if(id&&!ids.includes(id))ids.push(id)}if(ids.length>0)return resolve({success:!0,models:ids})}catch(e){}}resolve(null)})});req.on("error",()=>resolve(null));req.on("timeout",()=>{req.destroy();resolve(null)});req.end()});if(res&&res.success)return res}catch(e){}}return{success:!1,error:"未能获取到模型列表，请检查 Base URL 和 API Key"}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:add-models-with-metadata",async(e,{baseUrl:u,modelIds:ids,reasoningRange:g,providerName:n,apiKey:k})=>{let OMP=__OMP_TABLE__||{};let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cfgPath=p.join(o.homedir(),".zcode","v2","config.json"),cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm=s.split("/").pop()||s,omp=OMP[nm];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let build=(mid,m,rd)=>{let e={},nm=mid.split("/").pop()||mid,pr=presetFor(nm),isGpt=/^gpt-/.test(nm);if(m&&m.name)e.name=m.name;let lim={};if(m&&m.limit&&m.limit.context){lim.context=m.limit.context;if(m.limit.output)lim.output=m.limit.output}else if(isGpt){lim.context=272000;lim.output=128000}if(isGpt){if(lim.context)lim.context=Math.min(lim.context,272000);if(!lim.output)lim.output=128000}if(Object.keys(lim).length)e.limit=lim;if(m&&m.modalities){e.modalities={input:m.modalities.input||["text"],output:m.modalities.output||["text"]}}if(m&&typeof m.tool_call=="boolean")e.supportsTools=m.tool_call;if(m&&typeof m.structured_output=="boolean")e.supportsStructuredOutput=m.structured_output;let cr=m?!!m.reasoning:null,en=cr!=null?cr:!!pr;if(en){let base=pr&&pr.variants?pr.variants:EFFORTS,tiers=null;if(rd){let a=rd.min?EFFORTS.indexOf(rd.min):-1,b=rd.max?EFFORTS.indexOf(rd.max):-1;if(a<0)a=0;if(b<0)b=EFFORTS.length-1;if(b<a){let t=a;a=b;b=t}tiers=EFFORTS.slice(a,b+1)}let vars=tiers?tiers.filter(v=>base.indexOf(v)>=0):base;if(tiers&&vars.length===0)vars=tiers;let dv2=tiers?(rd&&rd.max&&vars.indexOf(rd.max)>=0?rd.max:(pr&&pr.default&&vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1])):(pr&&pr.default?(vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1]):vars[vars.length-1]);let lv={};for(let vv of vars)lv[vv]={value:vv};e.reasoning={enabled:!0,variants:vars,levels:lv};if(dv2){e.reasoning.defaultLevel=dv2;e.reasoning.defaultVariant=dv2}}e.zcode={modified:!1};return e};try{let cfg=JSON.parse(f.readFileSync(cfgPath,"utf-8")),clean=(u||"").trim().replace(/\/+$/,""),prov=null,newPid=null;for(let[pid,pd]of Object.entries(cfg.provider||{})){let b=((pd.options||{}).baseURL||"").replace(/\/+$/,"");if(b&&b===clean){prov=pd;break}}if(!prov){let nm=(n||"").trim();for(let[pid,pd]of Object.entries(cfg.provider||{})){if(nm&&(pd.name||"")===nm){prov=pd;break}}}if(!prov){let host="custom";try{let uo=new URL(/^https?:/.test(clean)?clean:"https://"+clean),hn=(uo.hostname||"").replace(/[^\w.-]/g,"");if(hn)host=hn}catch(ue){}let cand="custom-"+host,c2=2;while(cfg.provider[cand]){cand="custom-"+host+"-"+c2;c2++}newPid=cand;prov={name:(n||"").trim()||host,kind:"openai-compatible",options:{baseURL:clean},enabled:!0,source:"custom",models:{}};if(k&&String(k).trim())prov.options.apiKey=String(k).trim();else prov.options.apiKeyRequired=!1;cfg.provider[newPid]=prov}let added=[],entries={};for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;if((prov.models||{})[nm])continue;prov.models=prov.models||{};let en=build(nm,match(nm),g);prov.models[nm]=en;added.push(nm);entries[nm]=en}f.writeFileSync(cfgPath,JSON.stringify(cfg,null,2),"utf-8");return{success:!0,added,entries}}catch(x){return{success:!1,error:String(x)}}});
__HE__.handle("zcode:enrich-model-metadata",async(e,{baseUrl:u,modelIds:ids,reasoningRange:g})=>{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cfgPath=p.join(o.homedir(),".zcode","v2","config.json"),cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let OMP=__OMP_TABLE__||{},soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm=s.split("/").pop()||s,omp=OMP[nm];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let calc=(mid)=>{let m=match(mid),nm=mid.split("/").pop()||mid,pr=presetFor(nm),e={},lim={};if(m&&m.name)e.name=m.name;if(m&&m.limit&&m.limit.context){lim.context=m.limit.context;if(m.limit.output)lim.output=m.limit.output}else if(/^gpt-/.test(nm)){lim.context=272000;lim.output=128000}if(/^gpt-/.test(nm)){if(lim.context)lim.context=Math.min(lim.context,272000);if(!lim.output)lim.output=128000}if(Object.keys(lim).length)e.limit=lim;if(m&&m.modalities)e.modalities={input:m.modalities.input||["text"],output:m.modalities.output||["text"]};if(m&&typeof m.tool_call=="boolean")e.supportsTools=m.tool_call;if(m&&typeof m.structured_output=="boolean")e.supportsStructuredOutput=m.structured_output;let cr=m?!!m.reasoning:null,en=cr!=null?cr:!!pr;if(en){let base=pr&&pr.variants?pr.variants:EFFORTS,tiers=null;if(g){let a=g.min?EFFORTS.indexOf(g.min):-1,b=g.max?EFFORTS.indexOf(g.max):-1;if(a<0)a=0;if(b<0)b=EFFORTS.length-1;if(b<a){let t=a;a=b;b=t}tiers=EFFORTS.slice(a,b+1)}let vars=tiers?tiers.filter(v=>base.indexOf(v)>=0):base;if(tiers&&vars.length===0)vars=tiers;let dv2=tiers?(g&&g.max&&vars.indexOf(g.max)>=0?g.max:(pr&&pr.default&&vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1])):(pr&&pr.default?(vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1]):vars[vars.length-1]);let lv={};for(let vv of vars)lv[vv]={value:vv};e.reasoning={enabled:!0,variants:vars,levels:lv};if(dv2){e.reasoning.defaultLevel=dv2;e.reasoning.defaultVariant=dv2}}return e};try{let cfg=JSON.parse(f.readFileSync(cfgPath,"utf-8")),clean=(u||"").trim().replace(/\/+$/,""),prov=null;for(let[pid,pd]of Object.entries(cfg.provider||{})){let b=((pd.options||{}).baseURL||"").replace(/\/+$/,"");if(b&&b===clean){prov=pd;break}}if(!prov)return{success:!1,error:"未找到匹配的供应商，请先完成官方保存后再同步"};let touched=0;for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;let m=(prov.models||{})[nm];if(!m)continue;let en=calc(nm),upd=0;if(en.limit){m.limit=en.limit;upd++}if(en.modalities){m.modalities=en.modalities;upd++}if(en.supportsTools)m.supportsTools=en.supportsTools;if(en.supportsStructuredOutput)m.supportsStructuredOutput=en.supportsStructuredOutput;if(en.name&&en.name!==nm)m.name=en.name;if(en.reasoning){m.reasoning=en.reasoning;upd++}if(upd)touched++}if(touched)f.writeFileSync(cfgPath,JSON.stringify(cfg,null,2),"utf-8");return{success:!0,touched}}catch(x){return{success:!1,error:String(x)}}});
__HE__.handle("zcode:model-metadata",async(e,{modelIds:ids})=>{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let OMP=__OMP_TABLE__||{},soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm2=s.split("/").pop()||s,omp=OMP[nm2];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm2)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let meta={};for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;let m=match(nm),isGpt=/^gpt-/.test(nm.split("/").pop()||nm);let en={};if(m&&m.limit&&m.limit.context)en.ctx=m.limit.context;else if(isGpt)en.ctx=272000;if(m&&m.limit&&m.limit.output)en.out=m.limit.output;else if(isGpt)en.out=128000;if(m&&m.modalities){en.in=m.modalities.input||["text"];en.outM=m.modalities.output||["text"]}else{en.in=["text"];en.outM=["text"]}if(isGpt&&en.ctx)en.ctx=Math.min(en.ctx,272000);let pr=presetFor(nm);if(pr&&pr.variants)en.r=pr.variants.slice();meta[nm]=en}return{success:!0,meta}});
__HE__.handle("zcode:simulate-mouse-click",async(ev,{x,y})=>{try{ev.sender.sendInputEvent({type:"mouseDown",x:x,y:y,button:"left",clickCount:1});ev.sender.sendInputEvent({type:"mouseUp",x:x,y:y,button:"left",clickCount:1});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});
__HE__.handle("zcode:simulate-mouse-move",async(ev,{x,g})=>{try{ev.sender.sendInputEvent({type:"mouseMove",x:x,y:g});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});
'''

RE_MAIN_ANCHOR = re.compile(r"(?P<HE>[\w$]+)\s*\.\s*handle\s*\(\s*[\w$]+\.SaveMcpToUserDirectory")


def patch_main(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "main", "ok": False, "note": "out/main/index.js 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_IPC in src:
        # 旧注入则幂等补上新增通道（simulate-mouse-click / simulate-mouse-move）
        if "simulate-mouse-click" in src and "x:x,y:y" in src:
            return {"layer": "main", "ok": True, "applied": False, "note": "已含完整 IPC 通道，跳过"}
        m = RE_MAIN_ANCHOR.search(src)
        if not m:
            return {"layer": "main", "ok": False, "note": "已注入但找不到 SaveMcpToUserDirectory 锚点"}
        he = m.group("HE")
        extra = (
            '\n'
            '__HE__.handle("zcode:simulate-mouse-click",async(ev,{x,y})=>{try{ev.sender.sendInputEvent({type:"mouseDown",x:x,y:y,button:"left",clickCount:1});ev.sender.sendInputEvent({type:"mouseUp",x:x,y:y,button:"left",clickCount:1});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});\n'
            '__HE__.handle("zcode:simulate-mouse-move",async(ev,{x,g})=>{try{ev.sender.sendInputEvent({type:"mouseMove",x:x,y:g});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});\n'
        ).replace("__HE__", he)
        if dry_run:
            return {"layer": "main", "ok": True, "applied": False, "note": f"待追加 simulate 通道（handle 载体：{he}）"}
        # 插到锚点前（SaveMcpToUserDirectory handler 之前）
        path.write_text(src[: m.start()] + extra + "\n" + src[m.start():], encoding="utf-8")
        return {"layer": "main", "ok": True, "applied": True, "note": f"已补注入 simulate 通道（handle 载体：{he}）"}
    m = RE_MAIN_ANCHOR.search(src)
    if not m:
        return {"layer": "main", "ok": False, "note": "未找到 SaveMcpToUserDirectory 锚点"}
    he = m.group("HE")
    omp_data = OMP_EFFORTS_FILE.read_text(encoding="utf-8").strip() if OMP_EFFORTS_FILE.exists() else "null"
    handlers = "\n" + _MAIN_HANDLERS.replace("__HE__", he).replace("__OMP_TABLE__", omp_data)
    if dry_run:
        return {"layer": "main", "ok": True, "applied": False, "note": f"待注入（handle 载体：{he}）"}
    path.write_text(src[: m.start()] + handlers + "\n" + src[m.start():], encoding="utf-8")
    return {"layer": "main", "ok": True, "applied": True, "note": f"已注册 6 个 IPC handler（handle 载体：{he}）"}


def copy_puller(path: Path, dry_run: bool) -> dict:
    # 始终用最新 zcode-model-puller.js 覆盖解包目录里的脚本：
    # 官方/旧注入可能会留下上一个版本，path.exists() 跳过会导致修复合入无人验收。
    if dry_run:
        return {"layer": "puller", "ok": True, "applied": False, "note": "待复制前端脚本"}
    shutil.copy2(PULLER_JS, path)
    return {"layer": "puller", "ok": True, "applied": True, "note": "已复制（覆盖）前端脚本"}


def _overwrite_file(src: Path, dst: Path) -> bool:
    """原地流式覆盖 dst 的内容（非原子）。外部实时防护（如火绒）以“拒绝删除”方式占用文件、
    使 os.replace 无法重命名时的兜底；写入后调用方需做读回校验。"""
    try:
        with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
            shutil.copyfileobj(fsrc, fdst, 1 << 20)
            fdst.flush()
            os.fsync(fdst.fileno())
        return True
    except OSError:
        return False


def node_check_patched(patched: list[tuple[str, Path]]) -> bool:
    """用 node --check 校验注入后文件的语法（main 用 .cjs/.mjs 分别处理），防止产出坏包。
    patched: [(模块类型, 文件路径)]，类型 'cjs' | 'esm'。node 缺失时告警并跳过（返回 True）。"""
    node = shutil.which("node") or shutil.which("node.exe")
    if not node:
        warn("未检测到 node，跳过注入后语法自检（建议人工验证）。")
        return True
    ok = True
    for kind, p in patched:
        check = p
        tmp = None
        if kind == "esm":
            tmp = p.with_name(p.name + ".probe.mjs")
            shutil.copy2(p, tmp)
            check = tmp
        try:
            res = subprocess.run([node, "--check", str(check)], capture_output=True, text=True, timeout=120)
            if res.returncode != 0:
                warn(f"[语法自检失败] {p.name}: {res.stderr.strip()[:240]}")
                ok = False
        finally:
            if tmp:
                tmp.unlink(missing_ok=True)
    return ok


# ---------------------------------------------------------------- 安装 / 还原 / 检查

def cmd_install(asar: Path, bak: Path, dry_run: bool) -> None:
    if not asar.exists():
        die(f"找不到 app.asar：{asar}\n可用 --asar 指定路径。")
    if not PULLER_JS.exists():
        die(f"找不到前端脚本：{PULLER_JS}")
    if not dry_run and not ensure_zcode_not_running():
        die("ZCode 正在运行，已中止（未改动任何文件）。请完全退出 ZCode 后重试。")

    if not dry_run:
        backup_asar(asar, bak, dry_run=False)

    work = Path(tempfile.gettempdir()) / f"zcode_inject_build_{os.getpid()}"
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    try:
        info("解包 app.asar …（约百 MB，可能需要一两分钟）")
        rc, out, err = run_npx("extract", str(asar), str(work))
        if rc != 0:
            die(f"解包失败：{err.strip() or out.strip()}")

        results = [
            patch_html(work / "out" / "renderer" / "index.html", dry_run),
            copy_puller(work / "out" / "renderer" / "zcode-model-puller.js", dry_run),
            patch_preload(work / "out" / "preload" / "index.cjs", dry_run),
            patch_main(work / "out" / "main" / "index.js", dry_run),
        ]
        for r in results:
            mark = "✔" if r["ok"] else "✘"
            info(f"  [{mark}] {r['layer']:<8} {r['note']}")
        if any(not r["ok"] for r in results):
            die("存在未命中的补丁锚点（ZCode 版本可能不兼容），已中止，app.asar 未被改动。")
        if dry_run:
            info("\n(dry-run) 三层锚点全部可命中，演练结束：未写回文件、未重新打包。")
            return

        if not node_check_patched([
            ("cjs", work / "out" / "preload" / "index.cjs"),
            ("esm", work / "out" / "main" / "index.js"),
        ]):
            die("注入后语法自检未通过，已中止（app.asar 未被改动）。请报告此错误。")

        new_asar = asar.with_name(f"app.asar.new-{os.getpid()}")
        if new_asar.exists():
            new_asar.unlink()
        info("打包 app.asar …")
        rc, out, err = run_npx("pack", str(work), str(new_asar))
        if rc != 0:
            new_asar.unlink(missing_ok=True)
            die(f"打包失败：{err.strip() or out.strip()}")

        counts = scan_bytes(new_asar, [MARKER_IPC, MARKER_HTML])
        if counts[MARKER_IPC] < 2 or counts[MARKER_HTML] < 1:
            new_asar.unlink()
            die(f"打包自检未通过（IPC 标记 {counts[MARKER_IPC]} 处、HTML 标记 {counts[MARKER_HTML]} 处），拒绝替换。")
        info(f"打包自检通过（IPC 标记 {counts[MARKER_IPC]} 处、HTML 标记 {counts[MARKER_HTML]} 处）。")

        try:
            os.replace(new_asar, asar)
        except PermissionError:
            warn("无法重命名替换：app.asar 被外部实时防护（如火绒）以“拒绝删除”方式占用。")
            info("改用原地覆盖写入（非原子，但已有原版备份可随时 --restore 恢复）…")
            if not _overwrite_file(new_asar, asar):
                new_asar.unlink(missing_ok=True)
                die("原地覆盖也失败。请暂停安全软件对 ZCode 目录的实时防护后重试。")
            post = scan_bytes(asar, [MARKER_IPC, MARKER_HTML])
            if post[MARKER_IPC] < 2 or post[MARKER_HTML] < 1:
                new_asar.unlink(missing_ok=True)
                die("原地覆盖后读回校验未通过！请立即运行 --restore 从备份还原 app.asar。")
            info(f"原地覆盖成功（读回校验通过：IPC 标记 {post[MARKER_IPC]} 处、HTML 标记 {post[MARKER_HTML]} 处）。")
        except OSError as e:
            new_asar.unlink(missing_ok=True)
            die(f"替换 app.asar 失败：{e}")
        new_asar.unlink(missing_ok=True)  # 原地覆盖路径下清理临时打包文件
    finally:
        shutil.rmtree(work, ignore_errors=True)

    info("\n注入成功！请完全退出并重新打开 ZCode，进入「设置 → 模型设置 → 自定义供应商」，"
         "即可看到「⚡️ 自动拉取模型」按钮。")


def cmd_restore(asar: Path, bak: Path) -> None:
    if not asar.exists():
        die(f"找不到 app.asar：{asar}")
    if not bak.exists():
        die(f"找不到原版备份：{bak}，拒绝还原。")
    if not ensure_zcode_not_running():
        die("ZCode 正在运行，已中止。请完全退出 ZCode 后重试。")
    try:
        shutil.copy2(bak, asar)
    except PermissionError:
        die("还原失败：app.asar 被占用。请完全退出 ZCode 后重试。")
    info("已从备份还原 app.asar（备份保留，可随时再次注入）。请完全退出并重新打开 ZCode 生效。")


def cmd_check(asar: Path, bak: Path) -> None:
    if not asar.exists():
        die(f"找不到 app.asar：{asar}\n可用 --asar 指定路径。")
    info(f"检查对象：{asar}")
    counts = scan_bytes(asar, ["exposeInMainWorld", "SaveMcpToUserDirectory", MARKER_IPC, MARKER_HTML])
    for needle in ("exposeInMainWorld", "SaveMcpToUserDirectory", MARKER_IPC, MARKER_HTML):
        info(f"  命中 {needle:<38} ×{counts[needle]}")
    anchor_ok = counts["SaveMcpToUserDirectory"] > 0 and counts["exposeInMainWorld"] > 0
    info("锚点可用性：" + ("✔ 本版本可注入" if anchor_ok else "✘ 锚点缺失，版本可能不兼容"))
    if counts[MARKER_IPC] >= 2 and counts[MARKER_HTML] >= 1:
        info("状态：已完整注入 ✔")
    elif counts[MARKER_IPC] or counts[MARKER_HTML]:
        warn("状态：疑似部分注入/异常。建议 --restore 还原后重新安装。")
    else:
        info("状态：未注入（可安全安装）。")
    info("备份：" + ("存在 → " + str(bak) if bak.exists() else "不存在（首次安装时会创建）"))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(
        prog="inject_windows",
        description="把「⚡️ 自动拉取模型」能力注入 ZCode 客户端（Windows，参考 HHQ-666/zcode-model-puller 移植）",
        epilog=__doc__.split("用法示例：")[-1],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--asar", type=Path, default=default_asar(), help="app.asar 路径（默认自动探测）")
    ap.add_argument("--restore", action="store_true", help="从备份还原官方原版")
    ap.add_argument("--check", action="store_true", help="只读检查注入状态")
    ap.add_argument("--dry-run", action="store_true", help="解包演练锚点兼容性，不写回不替换")
    args = ap.parse_args(argv)

    bak = args.asar.with_name(args.asar.name + ".original.bak")
    if args.restore:
        cmd_restore(args.asar, bak)
    elif args.check:
        cmd_check(args.asar, bak)
    else:
        cmd_install(args.asar, bak, dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已中断。")
        sys.exit(130)