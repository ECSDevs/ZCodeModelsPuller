# -*- coding: utf-8 -*-
"""injector.asar — Electron ASAR 包解包、打包与备份管理。"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from .config import MARKER_HTML, MARKER_IPC
from .utils import die, hash_file, info, scan_bytes, warn


def asar_runner() -> str | None:
    """返回可用的 `@electron/asar` 调用前缀：npx 优先，缺 npx 时回退 pnpm dlx。"""
    if shutil.which("npx") or shutil.which("npx.cmd"):
        return "npx --yes @electron/asar"
    if shutil.which("pnpm") or shutil.which("pnpm.cmd"):
        return "pnpm dlx @electron/asar"
    return None


def run_npx(sub: str, *args: str) -> tuple[int, str, str]:
    """调用 @electron/asar <sub> <args…>。"""
    runner = asar_runner()
    if not runner:
        die("未检测到 npx 或 pnpm，无法调用 @electron/asar。请自行安装 Node.js（含 npm）。")
    quoted = " ".join(f'"{a}"' for a in args)
    cmd = f"{runner} {sub} {quoted}".strip()
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        die("执行超时（>15 分钟），请重试或检查 Node/pnpm 是否正常。")
    return res.returncode, res.stdout, res.stderr


def backup_asar(asar: Path, bak: Path, dry_run: bool) -> None:
    """备份官方原版 app.asar，检测到升级后自动刷新原版备份。"""
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
