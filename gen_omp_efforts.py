#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# MIT License
# Copyright (c) 2026 zcode-model-puller contributors
# 上游：github.com/HHQ-666/zcode-model-puller —— Copyright (c) 2025 HHQ
# 本文件为 Windows 移植，详见仓库 LICENSE。
"""gen_omp_efforts.py — 从 oh-my-pi 内置模型目录生成精简档位表 omp_efforts.json。

输入：https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/catalog/src/models.json
输出：项目内 omp_efforts.json，形如 {"<短模型id>": {"r": 1, "e": ["low","medium","high"]}}，
      r=支持 reasoning，e=该模型实际 effort 档位列表（无档位则只有 r）。
      models.dev 已提供的 contextWindow/maxTokens/modalities 等不重复收录。
用法：python gen_omp_efforts.py [--url URL] [--out PATH]
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/catalog/src/models.json"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    return urllib.request.urlopen(req, timeout=60).read()


def build(data: dict) -> dict:
    out: dict[str, dict] = {}
    total = hits = 0
    for prov, mods in data.items():
        if not isinstance(mods, dict):
            continue
        for mid, e in mods.items():
            if not isinstance(e, dict) or not isinstance(mid, str) or not mid:
                continue
            total += 1
            short = mid.split("/")[-1].strip().lower()
            if not short:
                continue
            r = bool(e.get("reasoning"))
            th = e.get("thinking")
            eff = th.get("efforts") if isinstance(th, dict) else None
            if not r and not eff:  # 既不支持思考也没有档位，无需收录
                continue
            item: dict = {}
            if r:
                item["r"] = 1
            if eff:
                item["e"] = eff
            out[short] = item
            hits += 1
    print(f"总模型条目：{total}，收录（reasoning/efforts 相关）：{hits}，精简表大小：{len(json.dumps(out, ensure_ascii=False)) // 1024} KB")
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL, help="OMP models.json 地址")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "omp_efforts.json")
    args = ap.parse_args(argv)

    raw = fetch(args.url)
    data = json.loads(raw)
    out = build(data)
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"已写出：{args.out}")


if __name__ == "__main__":
    main()