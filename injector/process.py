# -*- coding: utf-8 -*-
"""injector.process — ZCode 进程检测与管理。"""

from __future__ import annotations

import subprocess
from .utils import warn


def ensure_zcode_not_running() -> bool:
    """检查 ZCode.exe 是否在运行，提示用户完全退出。"""
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq ZCode.exe", "/NH"],
            capture_output=True,
            text=True,
            timeout=30,
        ).stdout
        if "ZCode.exe" in out:
            warn("检测到 ZCode 正在运行。请完全退出 ZCode（含系统托盘）后再操作。")
            return False
    except Exception as e:
        warn(f"无法检查 ZCode 进程（{e}），将继续执行。")
    return True
