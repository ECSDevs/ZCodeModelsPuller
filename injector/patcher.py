# -*- coding: utf-8 -*-
"""injector.patcher — HTML / preload / main 三层补丁代码生成与注入。"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from .config import (
    CH_ADD,
    CH_ENRICH,
    CH_FETCH,
    CH_META,
    CH_READ,
    CH_WRITE,
    MARKER_HTML,
    MARKER_IPC,
    OMP_EFFORTS_FILE,
    PULLER_JS,
    SCRIPT_TAG,
)
from .utils import warn

RE_IPC_HOLDER = re.compile(r"(?P<H>[\w$]+)\.ipcRenderer")
RE_PRELOAD_ANCHOR = re.compile(r"[\w$]+\.exposeInMainWorld\s*\(\s*[\"']zcode[\"']\s*,\s*\{")
RE_MAIN_ANCHOR = re.compile(r"(?P<HE>[\w$]+)\s*\.\s*handle\s*\(\s*[\w$]+\.SaveMcpToUserDirectory")

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

_MAIN_HANDLERS = r'''__HE__.handle("zcode:read-model-config",async()=>{try{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os");let pcfg=p.join(o.homedir(),".zcode","v2","provider_config.json");let cfg=p.join(o.homedir(),".zcode","v2","config.json");let target=f.existsSync(pcfg)?pcfg:cfg;let c=f.readFileSync(target,"utf-8");return{success:!0,data:JSON.parse(c)}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:write-model-config",async(e,d)=>{try{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os");let pcfg=p.join(o.homedir(),".zcode","v2","provider_config.json");let cfg=p.join(o.homedir(),".zcode","v2","config.json");let target=f.existsSync(pcfg)?pcfg:cfg;f.writeFileSync(target,JSON.stringify(d,null,2),"utf-8");return{success:!0}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:fetch-models-from-url",async(e,{baseUrl:u,apiKey:k})=>{try{let{default:ht}=await import("node:https"),{default:h}=await import("node:http");let clean=(u||"").trim().replace(/\/+$/,"");let candidates=[];if(clean.endsWith("/v1")){candidates.push(clean+"/models");candidates.push(clean.replace(/\/v1$/,"")+"/models")}else{candidates.push(clean+"/v1/models");candidates.push(clean+"/models")}if(clean.endsWith("/api")){candidates.unshift(clean+"/v1/models")}for(let cur of candidates){try{let res=await new Promise((resolve,reject)=>{let mod=cur.startsWith("https:")?ht:h;let req=mod.request(cur,{method:"GET",headers:{"User-Agent":"ZCode/3.11.2","Accept":"application/json",...k?{Authorization:"Bearer "+k.trim(),"x-api-key":k.trim()}:{}},timeout:8000},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>{if(r.statusCode>=200&&r.statusCode<300){try{let j=JSON.parse(b);let l=Array.isArray(j)?j:Array.isArray(j.data)?j.data:Array.isArray(j.models)?j.models:[];let ids=[];for(let it of l){let id=typeof it=="string"?it.trim():(it.id||it.name||"").trim();if(id&&!ids.includes(id))ids.push(id)}if(ids.length>0)return resolve({success:!0,models:ids})}catch(e){}}resolve(null)})});req.on("error",()=>resolve(null));req.on("timeout",()=>{req.destroy();resolve(null)});req.end()});if(res&&res.success)return res}catch(e){}}return{success:!1,error:"未能获取到模型列表，请检查 Base URL 和 API Key"}}catch(e){return{success:!1,error:String(e)}}});
__HE__.handle("zcode:add-models-with-metadata",async(e,{baseUrl:u,modelIds:ids,reasoningRange:g,providerName:n,apiKey:k})=>{let OMP=__OMP_TABLE__||{};let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cfgPath=p.join(o.homedir(),".zcode","v2","config.json"),cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm=s.split("/").pop()||s,omp=OMP[nm];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let build=(mid,m,rd)=>{let e={},nm=mid.split("/").pop()||mid,pr=presetFor(nm),isGpt=/^gpt-/.test(nm);if(m&&m.name)e.name=m.name;let lim={};if(m&&m.limit&&m.limit.context){lim.context=m.limit.context;if(m.limit.output)lim.output=m.limit.output}else if(isGpt){lim.context=272000;lim.output=128000}if(isGpt){if(lim.context)lim.context=Math.min(lim.context,272000);if(!lim.output)lim.output=128000}if(Object.keys(lim).length)e.limit=lim;if(m&&m.modalities){e.modalities={input:m.modalities.input||["text"],output:m.modalities.output||["text"]}}if(m&&typeof m.tool_call=="boolean")e.supportsTools=m.tool_call;if(m&&typeof m.structured_output=="boolean")e.supportsStructuredOutput=m.structured_output;let cr=m?!!m.reasoning:null,en=cr!=null?cr:!!pr;if(en){let base=pr&&pr.variants?pr.variants:EFFORTS,tiers=null;if(rd){let a=rd.min?EFFORTS.indexOf(rd.min):-1,b=rd.max?EFFORTS.indexOf(rd.max):-1;if(a<0)a=0;if(b<0)b=EFFORTS.length-1;if(b<a){let t=a;a=b;b=t}tiers=EFFORTS.slice(a,b+1)}let vars=tiers?tiers.filter(v=>base.indexOf(v)>=0):base;if(tiers&&vars.length===0)vars=tiers;let dv2=tiers?(rd&&rd.max&&vars.indexOf(rd.max)>=0?rd.max:(pr&&pr.default&&vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1])):(pr&&pr.default?(vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1]):vars[vars.length-1]);let lv={};for(let vv of vars)lv[vv]={value:vv};e.reasoning={enabled:!0,variants:vars,levels:lv};if(dv2){e.reasoning.defaultLevel=dv2;e.reasoning.defaultVariant=dv2}}e.zcode={modified:!1};return e};try{let cfg=JSON.parse(f.readFileSync(cfgPath,"utf-8")),clean=(u||"").trim().replace(/\/+$/,""),prov=null,newPid=null;for(let[pid,pd]of Object.entries(cfg.provider||{})){let b=((pd.options||{}).baseURL||"").replace(/\/+$/,"");if(b&&b===clean){prov=pd;break}}if(!prov){let nm=(n||"").trim();for(let[pid,pd]of Object.entries(cfg.provider||{})){if(nm&&(pd.name||"")===nm){prov=pd;break}}}if(!prov){let host="custom";try{let uo=new URL(/^https?:/.test(clean)?clean:"https://"+clean),hn=(uo.hostname||"").replace(/[^\w.-]/g,"");if(hn)host=hn}catch(ue){}let cand="custom-"+host,c2=2;while(cfg.provider[cand]){cand="custom-"+host+"-"+c2;c2++}newPid=cand;prov={name:(n||"").trim()||host,kind:"openai-compatible",options:{baseURL:clean},enabled:!0,source:"custom",models:{}};if(k&&String(k).trim())prov.options.apiKey=String(k).trim();else prov.options.apiKeyRequired=!1;cfg.provider[newPid]=prov}let added=[],entries={};for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;if((prov.models||{})[nm])continue;prov.models=prov.models||{};let en=build(nm,match(nm),g);prov.models[nm]=en;added.push(nm);entries[nm]=en}f.writeFileSync(cfgPath,JSON.stringify(cfg,null,2),"utf-8");return{success:!0,added,entries}}catch(x){return{success:!1,error:String(x)}}});
__HE__.handle("zcode:enrich-model-metadata",async(e,{baseUrl:u,modelIds:ids,reasoningRange:g})=>{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cfgPath=p.join(o.homedir(),".zcode","v2","config.json"),cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let OMP=__OMP_TABLE__||{},soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm=s.split("/").pop()||s,omp=OMP[nm];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let calc=(mid)=>{let m=match(mid),nm=mid.split("/").pop()||mid,pr=presetFor(nm),e={},lim={};if(m&&m.name)e.name=m.name;if(m&&m.limit&&m.limit.context){lim.context=m.limit.context;if(m.limit.output)lim.output=m.limit.output}else if(/^gpt-/.test(nm)){lim.context=272000;lim.output=128000}if(/^gpt-/.test(nm)){if(lim.context)lim.context=Math.min(lim.context,272000);if(!lim.output)lim.output=128000}if(Object.keys(lim).length)e.limit=lim;if(m&&m.modalities)e.modalities={input:m.modalities.input||["text"],output:m.modalities.output||["text"]};if(m&&typeof m.tool_call=="boolean")e.supportsTools=m.tool_call;if(m&&typeof m.structured_output=="boolean")e.supportsStructuredOutput=m.structured_output;let cr=m?!!m.reasoning:null,en=cr!=null?cr:!!pr;if(en){let base=pr&&pr.variants?pr.variants:EFFORTS,tiers=null;if(g){let a=g.min?EFFORTS.indexOf(g.min):-1,b=g.max?EFFORTS.indexOf(g.max):-1;if(a<0)a=0;if(b<0)b=EFFORTS.length-1;if(b<a){let t=a;a=b;b=t}tiers=EFFORTS.slice(a,b+1)}let vars=tiers?tiers.filter(v=>base.indexOf(v)>=0):base;if(tiers&&vars.length===0)vars=tiers;let dv2=tiers?(g&&g.max&&vars.indexOf(g.max)>=0?g.max:(pr&&pr.default&&vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1])):(pr&&pr.default?(vars.indexOf(pr.default)>=0?pr.default:vars[vars.length-1]):vars[vars.length-1]);let lv={};for(let vv of vars)lv[vv]={value:vv};e.reasoning={enabled:!0,variants:vars,levels:lv};if(dv2){e.reasoning.defaultLevel=dv2;e.reasoning.defaultVariant=dv2}}return e};try{let cfg=JSON.parse(f.readFileSync(cfgPath,"utf-8")),clean=(u||"").trim().replace(/\/+$/,""),prov=null;for(let[pid,pd]of Object.entries(cfg.provider||{})){let b=((pd.options||{}).baseURL||"").replace(/\/+$/,"");if(b&&b===clean){prov=pd;break}}if(!prov)return{success:!1,error:"未找到匹配的供应商，请先完成官方保存后再同步"};let touched=0;for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;let m=(prov.models||{})[nm];if(!m)continue;let en=calc(nm),upd=0;if(en.limit){m.limit=en.limit;upd++}if(en.modalities){m.modalities=en.modalities;upd++}if(en.supportsTools)m.supportsTools=en.supportsTools;if(en.supportsStructuredOutput)m.supportsStructuredOutput=en.supportsStructuredOutput;if(en.name&&en.name!==nm)m.name=en.name;if(en.reasoning){m.reasoning=en.reasoning;upd++}if(upd)touched++}if(touched)f.writeFileSync(cfgPath,JSON.stringify(cfg,null,2),"utf-8");return{success:!0,touched}}catch(x){return{success:!1,error:String(x)}}});
__HE__.handle("zcode:model-metadata",async(e,{modelIds:ids})=>{let{default:f}=await import("node:fs"),{default:p}=await import("node:path"),{default:o}=await import("node:os"),{default:ht}=await import("node:https");let cachePath=p.join(o.homedir(),".zcode","v2",".models-dev-cache.json"),cat=null,cur=null;try{if(f.existsSync(cachePath)){cur=JSON.parse(f.readFileSync(cachePath,"utf-8"));if(cur&&typeof cur.fetched_at=="number"&&Date.now()-cur.fetched_at<259200000)cat=cur.data}}catch(w){if(!cat&&cur&&cur.data)cat=cur.data}if(!cat){try{let txt=await new Promise(res=>{let req=ht.get("https://models.dev/models.json",{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2","Accept":"application/json"}},r=>{let b="";r.on("data",c=>b+=c);r.on("end",()=>res(b))});req.on("error",()=>res(null));req.on("timeout",()=>{req.destroy();res(null)});req.setTimeout(12000)});if(txt){try{let j=JSON.parse(txt);try{f.mkdirSync(p.dirname(cachePath),{recursive:!0});f.writeFileSync(cachePath,JSON.stringify({fetched_at:Date.now(),data:j}))}catch(w2){}cat=j}catch(w2){}}else if(cur&&cur.data)cat=cur.data}catch(w){}}let match=id=>{id=(id||"").trim();let q=id.toLowerCase();if(!cat)return null;for(let k in cat){if(k.toLowerCase()===q)return cat[k]}let suf=[];for(let k in cat){let s=(k.split("/").pop()||"").toLowerCase();if(s===q)suf.push(cat[k])}if(suf.length===1)return suf[0];let hits=[];for(let k in cat){if(k.toLowerCase().indexOf(q)>=0)hits.push(cat[k])}if(hits.length===1)return hits[0];return null};let OMP=__OMP_TABLE__||{},soft=["low","medium","high"],EFFORTS=["low","medium","high","xhigh","max","ultra"];let presetFor=id=>{let s=id.toLowerCase(),nm2=s.split("/").pop()||s,omp=OMP[nm2];if(omp){if(omp.e){let ev=omp.e.slice();if(/^gpt-5\.6/.test(nm2)&&ev.indexOf("ultra")<0)ev=ev.concat("ultra");return{variants:ev,default:ev[ev.length-1]}}if(omp.r)return{}}if(/^gpt-5\.6/.test(s))return{variants:["low","medium","high","xhigh","max","ultra"],default:"medium"};if(/^gpt-5\./.test(s))return{variants:["low","medium","high","xhigh"],default:"medium"};if(/^gpt-/.test(s))return{variants:soft,default:"medium"};if(/^o[134]/.test(s))return{variants:soft,default:"medium"};if(/^glm/.test(s))return{variants:["low","max","high"],default:"max"};if(/^kimi|^moonshot/.test(s))return{variants:["low","high","max"],default:"max"};if(/^gemini-3/.test(s))return{variants:["low","high"],default:"high"};if(/^deepseek-(r1|reasoner)/.test(s))return{};if(/^deepseek/.test(s))return{variants:["low","high","max"],default:"high"};if(/^gemini|^qwen|^grok|^claude/.test(s))return{};return null};let meta={};for(let it of ids||[]){let nm=(it||"").trim();if(!nm)continue;let m=match(nm),isGpt=/^gpt-/.test(nm.split("/").pop()||nm);let en={};if(m&&m.limit&&m.limit.context)en.ctx=m.limit.context;else if(isGpt)en.ctx=272000;if(m&&m.limit&&m.limit.output)en.out=m.limit.output;else if(isGpt)en.out=128000;if(m&&m.modalities){en.in=m.modalities.input||["text"];en.outM=m.modalities.output||["text"]}else{en.in=["text"];en.outM=["text"]}if(isGpt&&en.ctx)en.ctx=Math.min(en.ctx,272000);let pr=presetFor(nm);if(pr&&pr.variants)en.r=pr.variants.slice();meta[nm]=en}return{success:!0,meta}});
__HE__.handle("zcode:simulate-mouse-click",async(ev,{x,y})=>{try{ev.sender.sendInputEvent({type:"mouseDown",x:x,y:y,button:"left",clickCount:1});ev.sender.sendInputEvent({type:"mouseUp",x:x,y:y,button:"left",clickCount:1});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});
__HE__.handle("zcode:simulate-mouse-move",async(ev,{x,g})=>{try{ev.sender.sendInputEvent({type:"mouseMove",x:x,y:g});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});
'''


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


def find_ipc_holder(src: str) -> str | None:
    """在 exposeInMainWorld 对象字面量附近找 ipcRenderer 持有者，找不到回退全文/require。"""
    m = RE_PRELOAD_ANCHOR.search(src)
    window = src[m.end() : m.end() + 4000] if m else ""
    h = RE_IPC_HOLDER.search(window) or RE_IPC_HOLDER.search(src)
    if h and h.group("H"):
        return h.group("H") + ".ipcRenderer"
    if 'require("electron")' in src:
        return 'require("electron").ipcRenderer'
    return None


def patch_preload(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "preload", "ok": False, "note": "out/preload/index.cjs 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_IPC in src:
        if "simulateMouseClick" in src:
            return {"layer": "preload", "ok": True, "applied": False, "note": "已含完整 IPC 通道，跳过"}
        holder = find_ipc_holder(src)
        if not holder:
            return {"layer": "preload", "ok": False, "note": "已注入但找不到 ipcRenderer 持有者"}
        extra = (
            '  simulateMouseClick:(x,y)=>(%s).invoke("zcode:simulate-mouse-click",{x:x,y:y}),\n'
            '  simulateMouseMove:(x,y)=>(%s).invoke("zcode:simulate-mouse-move",{x:x,y:y}),\n'
        ) % (holder, holder)
        anchor = "getModelMetadata:"
        i = src.find(anchor)
        if i < 0:
            return {"layer": "preload", "ok": False, "note": "未找到 getModelMetadata 键锚点"}
        j = src.find("\n", i)
        if dry_run:
            return {"layer": "preload", "ok": True, "applied": False, "note": f"待追加 simulate 通道（持有者：{holder}）"}
        path.write_text(src[: j + 1] + extra + src[j + 1 :], encoding="utf-8")
        return {"layer": "preload", "ok": True, "applied": True, "note": f"已补注入 simulate 通道（持有者：{holder}）"}
    m = RE_PRELOAD_ANCHOR.search(src)
    if not m:
        return {"layer": "preload", "ok": False, "note": "未找到 window.zcode exposeInMainWorld 锚点"}
    holder = find_ipc_holder(src)
    if not holder:
        return {"layer": "preload", "ok": False, "note": "未找到 ipcRenderer 持有者"}
    keys = _PRELOAD_KEYS.replace("__H__", holder)
    if dry_run:
        return {"layer": "preload", "ok": True, "applied": False, "note": f"待注入（ipcRenderer 持有者：{holder}）"}
    path.write_text(src[: m.end()] + "\n" + keys + src[m.end() :], encoding="utf-8")
    return {"layer": "preload", "ok": True, "applied": True, "note": f"已扩展 window.zcode（ipcRenderer 持有者：{holder}）"}


def patch_main(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "main", "ok": False, "note": "out/main/index.js 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_IPC in src:
        if "simulate-mouse-click" in src and "x:x,y:y" in src:
            return {"layer": "main", "ok": True, "applied": False, "note": "已含完整 IPC 通道，跳过"}
        m = RE_MAIN_ANCHOR.search(src)
        if not m:
            return {"layer": "main", "ok": False, "note": "已注入但找不到 SaveMcpToUserDirectory 锚点"}
        he = m.group("HE")
        extra = (
            "\n"
            '__HE__.handle("zcode:simulate-mouse-click",async(ev,{x,y})=>{try{ev.sender.sendInputEvent({type:"mouseDown",x:x,y:y,button:"left",clickCount:1});ev.sender.sendInputEvent({type:"mouseUp",x:x,y:y,button:"left",clickCount:1});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});\n'
            '__HE__.handle("zcode:simulate-mouse-move",async(ev,{x,g})=>{try{ev.sender.sendInputEvent({type:"mouseMove",x:x,y:g});return{success:!0}}catch(err){return{success:!1,error:String(err)}}});\n'
        ).replace("__HE__", he)
        if dry_run:
            return {"layer": "main", "ok": True, "applied": False, "note": f"待追加 simulate 通道（handle 载体：{he}）"}
        path.write_text(src[: m.start()] + extra + "\n" + src[m.start() :], encoding="utf-8")
        return {"layer": "main", "ok": True, "applied": True, "note": f"已补注入 simulate 通道（handle 载体：{he}）"}
    m = RE_MAIN_ANCHOR.search(src)
    if not m:
        return {"layer": "main", "ok": False, "note": "未找到 SaveMcpToUserDirectory 锚点"}
    he = m.group("HE")
    omp_data = OMP_EFFORTS_FILE.read_text(encoding="utf-8").strip() if OMP_EFFORTS_FILE.exists() else "null"
    handlers = "\n" + _MAIN_HANDLERS.replace("__HE__", he).replace("__OMP_TABLE__", omp_data)
    if dry_run:
        return {"layer": "main", "ok": True, "applied": False, "note": f"待注入（handle 载体：{he}）"}
    path.write_text(src[: m.start()] + handlers + "\n" + src[m.start() :], encoding="utf-8")
    return {"layer": "main", "ok": True, "applied": True, "note": f"已注册 6 个 IPC handler（handle 载体：{he}）"}


def copy_puller(path: Path, dry_run: bool) -> dict:
    if dry_run:
        return {"layer": "puller", "ok": True, "applied": False, "note": "待复制前端脚本"}
    shutil.copy2(PULLER_JS, path)
    return {"layer": "puller", "ok": True, "applied": True, "note": "已复制（覆盖）前端脚本"}


def node_check_patched(patched: list[tuple[str, Path]]) -> bool:
    """用 node --check 校验注入后文件的语法，防止产出坏包。"""
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
