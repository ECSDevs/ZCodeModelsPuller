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
    MAIN_HANDLERS_JS,
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


def patch_html(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "html", "ok": False, "note": "out/renderer/index.html 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_HTML in src:
        return {"layer": "html", "ok": True, "applied": False, "note": "已挂载前端脚本，跳过"}
    i = src.find("</body>")
    if i < 0:
        return {"layer": "html", "ok": False, "note": "未找到 </body> 闭合标签"}
    if dry_run:
        return {"layer": "html", "ok": True, "applied": False, "note": "待在 </body> 前挂载启动入口"}
    path.write_text(src[:i] + SCRIPT_TAG + src[i:], encoding="utf-8")
    return {"layer": "html", "ok": True, "applied": True, "note": "已在 </body> 前挂载启动入口"}


def find_ipc_holder(src: str) -> str | None:
    """从 exposeInMainWorld("zcode", ...) 附近或整个文件寻找 ipcRenderer 持有者。"""
    m = RE_PRELOAD_ANCHOR.search(src)
    window = src[m.end() : m.end() + 4000] if m else ""
    h = RE_IPC_HOLDER.search(window) or RE_IPC_HOLDER.search(src)
    if h and h.group("H"):
        return f"{h.group('H')}.ipcRenderer"
    if re.search(r"\bipcRenderer\.invoke\b", src):
        return "ipcRenderer"
    if 'require("electron")' in src:
        return 'require("electron").ipcRenderer'
    return None


def patch_preload(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "preload", "ok": False, "note": "out/preload/index.cjs 不存在"}
    src = path.read_text(encoding="utf-8", errors="replace")
    holder = find_ipc_holder(src)
    if not holder:
        return {"layer": "preload", "ok": False, "note": "未找到 ipcRenderer 持有者"}

    if MARKER_IPC in src:
        modified = False
        broken_pattern = re.compile(r"\((?:_|[a-zA-Z0-9$]+)\)\.invoke\(\s*\"zcode:")
        if broken_pattern.search(src):
            src = broken_pattern.sub(f"({holder}).invoke(\"zcode:", src)
            modified = True

        if "simulateMouseClick" not in src:
            extra = (
                '  simulateMouseClick:(x,y)=>(%s).invoke("zcode:simulate-mouse-click",{x:x,y:y}),\n'
                '  simulateMouseMove:(x,y)=>(%s).invoke("zcode:simulate-mouse-move",{x:x,y:y}),\n'
            ) % (holder, holder)
            anchor = "getModelMetadata:"
            i = src.find(anchor)
            if i >= 0:
                j = src.find("\n", i)
                src = src[: j + 1] + extra + src[j + 1 :]
                modified = True

        if modified:
            if dry_run:
                return {"layer": "preload", "ok": True, "applied": False, "note": f"待修复/补齐 preload IPC 通道（持有者：{holder}）"}
            path.write_text(src, encoding="utf-8")
            return {"layer": "preload", "ok": True, "applied": True, "note": f"已修复/补齐 preload IPC 通道（持有者：{holder}）"}

        return {"layer": "preload", "ok": True, "applied": False, "note": "已含完整 IPC 通道，跳过"}

    m = RE_PRELOAD_ANCHOR.search(src)
    if not m:
        return {"layer": "preload", "ok": False, "note": "未找到 window.zcode exposeInMainWorld 锚点"}
    keys = _PRELOAD_KEYS.replace("__H__", holder)
    if dry_run:
        return {"layer": "preload", "ok": True, "applied": False, "note": f"待注入（ipcRenderer 持有者：{holder}）"}
    path.write_text(src[: m.end()] + "\n" + keys + src[m.end() :], encoding="utf-8")
    return {"layer": "preload", "ok": True, "applied": True, "note": f"已扩展 window.zcode（ipcRenderer 持有者：{holder}）"}


def patch_main(path: Path, dry_run: bool) -> dict:
    if not path.exists():
        return {"layer": "main", "ok": False, "note": "out/main/index.js 不存在"}
    if not OMP_EFFORTS_FILE.exists():
        return {"layer": "main", "ok": False, "note": f"omp efforts 档位表不存在：{OMP_EFFORTS_FILE.name} 未找到，请先运行 gen_omp_efforts.py 生成"}
    omp_data = OMP_EFFORTS_FILE.read_text(encoding="utf-8").strip()
    if not omp_data or omp_data == "{}" or omp_data == "null":
        return {"layer": "main", "ok": False, "note": f"omp efforts 档位表为空：{OMP_EFFORTS_FILE.name}"}

    if not MAIN_HANDLERS_JS.exists():
        return {"layer": "main", "ok": False, "note": f"主进程 handlers 文件不存在：{MAIN_HANDLERS_JS.name}"}
    main_handlers_src = MAIN_HANDLERS_JS.read_text(encoding="utf-8").strip()

    src = path.read_text(encoding="utf-8", errors="replace")
    if MARKER_IPC in src:
        if "simulate-mouse-click" in src and ("x:x,y:y" in src or "x: x, y: y" in src or "sendInputEvent" in src):
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
    handlers = "\n(() => {\n" + main_handlers_src.replace("__HE__", he).replace("__OMP_TABLE__", omp_data) + "\n})(),\n"
    if dry_run:
        return {"layer": "main", "ok": True, "applied": False, "note": f"待注入（handle 载体：{he}）"}
    path.write_text(src[: m.start()] + handlers + src[m.start() :], encoding="utf-8")
    return {"layer": "main", "ok": True, "applied": True, "note": f"已注册 8 个 IPC handler（handle 载体：{he}）"}


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
