# 还原 ZCode 官方原版（卸载注入）
# 用法：右键“使用 PowerShell 运行”，或在终端执行  .\uninstall.ps1
# MIT License — Copyright (c) 2026 zcode-model-puller contributors；上游 HHQ-666 见仓库 LICENSE。
$ErrorActionPreference = "Stop"
Write-Host "请确保已完全退出 ZCode（含系统托盘）..."
python "$PSScriptRoot\inject_windows.py" --restore