# -*- coding: utf-8 -*-
"""injector.utils — 基础工具：日志打印、二进制扫描、文件哈希与文件流式写入。"""

from __future__ import annotations

import hashlib
import os
import shutil
import sys
from pathlib import Path


def info(msg: str) -> None:
    print(msg)


def warn(msg: str) -> None:
    print(f"⚠  {msg}", file=sys.stderr)


def die(msg: str, code: int = 1) -> None:
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


def overwrite_file(src: Path, dst: Path) -> bool:
    """原地流式覆盖 dst 的内容（非原子）。外部实时防护以“拒绝删除”占用文件时的兜底。"""
    try:
        with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
            shutil.copyfileobj(fsrc, fdst, 1 << 20)
            fdst.flush()
            os.fsync(fdst.fileno())
        return True
    except OSError:
        return False
