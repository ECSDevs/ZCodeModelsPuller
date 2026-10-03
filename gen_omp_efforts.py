#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# MIT License
# Copyright (c) 2026 zcode-model-puller contributors
# 上游：github.com/HHQ-666/zcode-model-puller —— Copyright (c) 2025 HHQ
# 本文件为 Windows 移植，详见仓库 LICENSE。
"""gen_omp_efforts.py — 从 oh-my-pi 内置模型目录生成精简档位表 omp_efforts.json。

包含有效期与自动更新机制：
- 默认有效期 7 天（可配置）；
- 本地文件未过期时复用缓存；过期或不存在时自动从上游拉取更新；
- 网络异常时自动降级使用现有缓存，不阻塞流程。
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/catalog/src/models.json"
DEFAULT_TTL_DAYS = 7


def fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/ModelPuller"}
    )
    return urllib.request.urlopen(req, timeout=timeout).read()


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
            if not r and not eff:
                continue
            item: dict = {}
            if r:
                item["r"] = 1
            if eff:
                item["e"] = eff
            out[short] = item
            hits += 1
    return out


def is_expired(path: Path, ttl_days: int = DEFAULT_TTL_DAYS) -> bool:
    if not path.exists():
        return True
    try:
        raw = path.read_text(encoding="utf-8")
        obj = json.loads(raw)
        meta = obj.get("_metadata") if isinstance(obj, dict) else None
        now_ts = int(time.time() * 1000)
        if meta and isinstance(meta.get("expires_at"), (int, float)):
            return now_ts >= meta["expires_at"]
        # 旧版没有 _metadata，按文件 mtime 计算
        mtime = path.stat().st_mtime
        return (time.time() - mtime) >= (ttl_days * 86400)
    except Exception:
        return True


def ensure_omp_efforts(
    out_path: Path | None = None,
    url: str = DEFAULT_URL,
    ttl_days: int = DEFAULT_TTL_DAYS,
    force: bool = False,
    quiet: bool = False
) -> bool:
    target = out_path or (Path(__file__).resolve().parent / "omp_efforts.json")
    if not force and not is_expired(target, ttl_days):
        if not quiet:
            print(f"[OMP Efforts] 本地缓存有效 (有效期 {ttl_days} 天)，跳过下载：{target.name}")
        return True

    reason = "强制更新" if force else ("文件不存在" if not target.exists() else f"已超过 {ttl_days} 天有效期")
    if not quiet:
        print(f"[OMP Efforts] 正在自动更新模型档位数据（{reason}）…")

    try:
        raw = fetch(url)
        data = json.loads(raw)
        models_data = build(data)
        now_ts = int(time.time() * 1000)
        payload = {
            "_metadata": {
                "source": url,
                "updated_at": now_ts,
                "expires_at": now_ts + (ttl_days * 86400 * 1000),
                "ttl_days": ttl_days,
                "total_models": len(models_data)
            },
            "data": models_data
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if not quiet:
            print(f"[OMP Efforts] 成功更新并收录 {len(models_data)} 个模型档位至 {target.name}")
        return True
    except Exception as e:
        if target.exists():
            if not quiet:
                print(f"[OMP Efforts] ⚠️ 自动拉取最新目录失败（{e}），回退继续使用本地旧版数据。")
            return True
        else:
            if not quiet:
                print(f"[OMP Efforts] ❌ 自动拉取失败且本地无备份缓存：{e}")
            return False


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL, help="OMP models.json 地址")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "omp_efforts.json")
    ap.add_argument("--ttl", type=int, default=DEFAULT_TTL_DAYS, help="有效期天数（默认 7 天）")
    ap.add_argument("--force", action="store_true", help="强制忽略有效期立即重新拉取")
    args = ap.parse_args(argv)

    ok = ensure_omp_efforts(out_path=args.out, url=args.url, ttl_days=args.ttl, force=args.force)
    if not ok:
        exit(1)


if __name__ == "__main__":
    main()
