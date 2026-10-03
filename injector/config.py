# -*- coding: utf-8 -*-
"""injector.config — 路径、通道名及注入常量配置。"""

from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PULLER_JS = ROOT_DIR / "zcode-model-puller.js"
OMP_EFFORTS_FILE = ROOT_DIR / "omp_efforts.json"
MAIN_HANDLERS_JS = ROOT_DIR / "injector" / "main_handlers.js"

MARKER_HTML = "./zcode-model-puller.js"
MARKER_IPC = "zcode:read-model-config"

CH_READ = "zcode:read-model-config"
CH_WRITE = "zcode:write-model-config"
CH_FETCH = "zcode:fetch-models-from-url"
CH_ADD = "zcode:add-models-with-metadata"
CH_ENRICH = "zcode:enrich-model-metadata"
CH_META = "zcode:model-metadata"
CH_CLICK = "zcode:simulate-mouse-click"
CH_MOVE = "zcode:simulate-mouse-move"

SCRIPT_TAG = '  <script type="module" src="./zcode-model-puller.js"></script>\n'


def default_asar() -> Path:
    local_appdata = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local_appdata) / "Programs" / "ZCode" / "resources" / "app.asar"
