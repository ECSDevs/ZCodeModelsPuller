# -*- coding: utf-8 -*-
"""injector.cli — 命令行参数解析与安装/还原/检查流程调度。"""

from __future__ import annotations

import argparse
import os
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

from gen_omp_efforts import ensure_omp_efforts
from .asar import backup_asar, run_npx
from .config import MARKER_HTML, MARKER_IPC, OMP_EFFORTS_FILE, PULLER_JS, ROOT_DIR, default_asar
from .patcher import copy_puller, node_check_patched, patch_html, patch_main, patch_preload
from .process import ensure_zcode_not_running
from .utils import die, info, overwrite_file, scan_bytes, warn


def ensure_puller_built() -> bool:
    """如果前端脚本未构建，自动检测可用工具执行构建。"""
    info("未检测到前端构建产物，正在自动执行构建 (pnpm / npm / npx esbuild) …")
    pnpm = shutil.which("pnpm") or shutil.which("pnpm.cmd")
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    tool = pnpm or npm
    if tool:
        cmd = [tool, "run", "build"]
        res = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
        if res.returncode == 0 and PULLER_JS.exists():
            info("前端脚本自动构建成功 ✔")
            return True
        warn(f"执行 {tool} run build 未产出成功，尝试 npx 兜底: {res.stderr.strip()[:180]}")

    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if npx:
        cmd = [
            npx, "esbuild", "src/renderer/index.js",
            "--bundle", "--format=iife",
            "--loader:.cel=text", "--loader:.css=text", "--loader:.html=text",
            f"--outfile={PULLER_JS}"
        ]
        res = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
        if res.returncode == 0 and PULLER_JS.exists():
            info("通过 npx esbuild 自动构建前端脚本成功 ✔")
            return True
    return False


def cmd_install(asar: Path, bak: Path, dry_run: bool) -> None:
    if not asar.exists():
        die(f"找不到 app.asar：{asar}\n可用 --asar 指定路径。")

    # 自动生成或更新 OMP efforts 档位表（支持有效期与自动更新）
    ensure_omp_efforts(OMP_EFFORTS_FILE)
    if not OMP_EFFORTS_FILE.exists():
        die(f"未能自动生成或找到 OMP efforts 档位表：{OMP_EFFORTS_FILE}")

    # 自动检测并构建前端注入脚本
    if not PULLER_JS.exists():
        ensure_puller_built()
    if not PULLER_JS.exists():
        die(f"未能自动构建前端脚本：{PULLER_JS}\n请尝试手动运行 pnpm install && pnpm run build")

    if not dry_run and not ensure_zcode_not_running():
        die("ZCode 正在运行，已中止（未改动任何文件）。请完全退出 ZCode 后重试。")

    if not dry_run:
        backup_asar(asar, bak, dry_run=False)
        # 若当前 asar 已含历史注入且存在干净的原版备份，先恢复为原版再解包注入，确保每次均为纯净基准
        if bak.exists() and scan_bytes(bak, [MARKER_IPC, MARKER_HTML])[MARKER_IPC] == 0:
            cur_counts = scan_bytes(asar, [MARKER_IPC, MARKER_HTML])
            if cur_counts[MARKER_IPC] > 0 or cur_counts[MARKER_HTML] > 0:
                shutil.copy2(bak, asar)
                info(f"检测到当前 asar 已含历史注入，已自动基于官方原版备份重置基准 → {asar}")

    work = Path(tempfile.gettempdir()) / f"zcode_inject_build_{os.getpid()}"
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    try:
        info(f"解包 {asar.name} …（约百 MB，可能需要一两分钟）")
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
            warn("无法重命名替换：app.asar 被外部实时防护以“拒绝删除”方式占用。")
            info("改用原地覆盖写入（非原子，但已有原版备份可随时 --restore 恢复）…")
            if not overwrite_file(new_asar, asar):
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
        new_asar.unlink(missing_ok=True)
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
    info("OMP 档位表：" + ("存在 ✔" if OMP_EFFORTS_FILE.exists() else f"缺失 ✘（{OMP_EFFORTS_FILE} 不存在）"))
    info("备份：" + ("存在 → " + str(bak) if bak.exists() else "不存在（首次安装时会创建）"))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(
        prog="inject_windows",
        description="把「⚡️ 自动拉取模型」能力注入 ZCode 客户端（Windows 版）",
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
