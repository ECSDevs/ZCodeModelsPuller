/**
 * ZCode 主进程注入 IPC Handlers
 * 包含：配置读写、从 URL 拉取模型列表、通过 models.dev 和 OMP 获取模型元数据与思考档位、模拟鼠标输入
 */

let __zcode_OMP = (__OMP_TABLE__ && __OMP_TABLE__.data) ? __OMP_TABLE__.data : (__OMP_TABLE__ || {});
let __zcode_stripAffixes = s => {
  let t = (s || "").toLowerCase().trim();
  if (t.includes("/")) t = t.split("/").pop();
  if (t.includes(":")) {
    let pts = t.split(":");
    if (/^(?:batch|latest|free|thinking|reasoning|low|medium|high|xhigh|max|ultra|minimal|none|default|\d+)$/i.test(pts[pts.length - 1])) {
      pts.pop();
      t = pts.join(":");
    } else if (/^(?:ollama|bedrock|azure|custom|local)$/i.test(pts[0])) {
      pts.shift();
      t = pts.join(":");
    } else {
      t = pts[pts.length - 1];
    }
  }
  t = t.replace(/^(?:openai|anthropic|google|deepseek-ai|meta-llama|meta|mistralai|mistral|qwen|alibaba|baichuan|zhipu|moonshot|minimax|bytedance|doubao|azure|aws|groq|openrouter)[-_]/i, "");
  t = t.replace(/[-_](?:20\d{2}[-_]?\d{2}[-_]?\d{2}|\d{8}|\d{4}|\d{2}[-_]\d{4})$/i, "");
  t = t.replace(/[-_](?:low|medium|high|xhigh|max|ultra|minimal|none|thinking|reasoning|nothink|notext|latest|preview(?:[-_]\d+)?|chat(?:[-_]latest)?|instruct|it|turbo|online|search|web|browsing|free|paid|exp|experimental|default|cyber|v\d+(?:\.\d+)?)$/i, "");
  t = t.replace(/[-_](?:20\d{2}[-_]?\d{2}[-_]?\d{2}|\d{8}|\d{4}|\d{2}[-_]\d{4})$/i, "");
  t = t.replace(/[-_](?:low|medium|high|xhigh|max|ultra|minimal|none|thinking|reasoning)$/i, "");
  return t.trim();
};

let __zcode_findOmp = (id, OMP) => {
  if (!OMP || typeof OMP !== "object" || Object.keys(OMP).length === 0) {
    return { error: "OMP efforts 档位表不存在或未加载" };
  }
  let raw = (id || "").trim();
  if (!raw) return null;
  let q = raw.toLowerCase();

  // 1. 完全精确匹配
  if (OMP[q]) return { key: q, data: OMP[q] };

  // 2. 去 / 路径前缀（如 openai/o1 -> o1）
  let short = q.includes("/") ? q.split("/").pop() : q;
  if (OMP[short]) return { key: short, data: OMP[short] };

  // 3. 去 : 冒号（如 ollama:o1 或 o1:batch -> o1）
  if (short.includes(":")) {
    let parts = short.split(":");
    let withoutTag = parts[0];
    if (OMP[withoutTag]) return { key: withoutTag, data: OMP[withoutTag] };
    let withoutPrefix = parts[parts.length - 1];
    if (OMP[withoutPrefix]) return { key: withoutPrefix, data: OMP[withoutPrefix] };
  }

  // 4. 忽略前后缀核心匹配：对比两者的 stripAffixes
  let targetCore = __zcode_stripAffixes(short);
  if (targetCore && OMP[targetCore]) {
    return { key: targetCore, data: OMP[targetCore] };
  }

  let exactCoreMatches = [];
  for (let k in OMP) {
    if (__zcode_stripAffixes(k) === targetCore) {
      exactCoreMatches.push(k);
    }
  }
  if (exactCoreMatches.length > 0) {
    exactCoreMatches.sort((a, b) => Math.abs(a.length - short.length) - Math.abs(b.length - short.length));
    return { key: exactCoreMatches[0], data: OMP[exactCoreMatches[0]] };
  }

  return null;
};

let __zcode_getPresetEfforts = (id, OMP) => {
  let hit = __zcode_findOmp(id, OMP);
  if (!hit) {
    return { error: "未找到模型 " + id + " 的 OMP efforts 思考档位配置（omp efforts 不存在）" };
  }
  if (hit.error) {
    return { error: hit.error };
  }
  let d = hit.data || {};
  if (d.e && Array.isArray(d.e) && d.e.length > 0) {
    let ev = d.e.slice();
    let nm = hit.key || id;
    if (/^gpt-5\.6/i.test(nm) && ev.indexOf("ultra") < 0) {
      ev = ev.concat("ultra");
    }
    return { variants: ev, default: ev[ev.length - 1], reasoning: true };
  }
  if (d.r) {
    return { variants: [], default: null, reasoning: true };
  }
  return { error: "未找到模型 " + id + " 的 OMP efforts 思考档位配置（omp efforts 不存在）" };
};

let __zcode_matchCatalog = (id, cat) => {
  if (!cat) return null;
  id = (id || "").trim();
  let q = id.toLowerCase();
  for (let k in cat) {
    if (k.toLowerCase() === q) return cat[k];
  }
  let suf = [];
  for (let k in cat) {
    let s = (k.split("/").pop() || "").toLowerCase();
    if (s === q) suf.push(cat[k]);
  }
  if (suf.length === 1) return suf[0];
  let core = __zcode_stripAffixes(id);
  if (core) {
    for (let k in cat) {
      let kShort = (k.split("/").pop() || "").toLowerCase();
      if (kShort === core) return cat[k];
    }
    for (let k in cat) {
      let kCore = __zcode_stripAffixes(k);
      if (kCore === core) return cat[k];
    }
    let hits = [];
    for (let k in cat) {
      let kCore = __zcode_stripAffixes(k);
      if (kCore && (kCore.includes(core) || core.includes(kCore))) hits.push(cat[k]);
    }
    if (hits.length > 0) {
      hits.sort((a, b) => Math.abs(__zcode_stripAffixes(a.id || "").length - core.length) - Math.abs(__zcode_stripAffixes(b.id || "").length - core.length));
      return hits[0];
    }
  }
  return null;
};

__HE__.handle("zcode:read-model-config", async () => {
  try {
    let { default: f } = await import("node:fs"), { default: p } = await import("node:path"), { default: o } = await import("node:os");
    let pcfg = p.join(o.homedir(), ".zcode", "v2", "provider_config.json");
    let cfg = p.join(o.homedir(), ".zcode", "v2", "config.json");
    let target = f.existsSync(pcfg) ? pcfg : cfg;
    let c = f.readFileSync(target, "utf-8");
    return { success: true, data: JSON.parse(c) };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

__HE__.handle("zcode:write-model-config", async (e, d) => {
  try {
    let { default: f } = await import("node:fs"), { default: p } = await import("node:path"), { default: o } = await import("node:os");
    let pcfg = p.join(o.homedir(), ".zcode", "v2", "provider_config.json");
    let cfg = p.join(o.homedir(), ".zcode", "v2", "config.json");
    let target = f.existsSync(pcfg) ? pcfg : cfg;
    f.writeFileSync(target, JSON.stringify(d, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

__HE__.handle("zcode:fetch-models-from-url", async (e, { baseUrl: u, apiKey: k }) => {
  try {
    let { default: ht } = await import("node:https"), { default: h } = await import("node:http");
    let clean = (u || "").trim().replace(/\/+$/, "");
    let candidates = [];
    if (clean.endsWith("/v1")) {
      candidates.push(clean + "/models");
      candidates.push(clean.replace(/\/v1$/, "") + "/models");
    } else {
      candidates.push(clean + "/v1/models");
      candidates.push(clean + "/models");
    }
    if (clean.endsWith("/api")) {
      candidates.unshift(clean + "/v1/models");
    }
    for (let cur of candidates) {
      try {
        let res = await new Promise((resolve, reject) => {
          let mod = cur.startsWith("https:") ? ht : h;
          let req = mod.request(cur, {
            method: "GET",
            headers: {
              "User-Agent": "ZCode/3.11.2",
              "Accept": "application/json",
              ...k ? { Authorization: "Bearer " + k.trim(), "x-api-key": k.trim() } : {}
            },
            timeout: 8000
          }, r => {
            let b = "";
            r.on("data", c => b += c);
            r.on("end", () => {
              if (r.statusCode >= 200 && r.statusCode < 300) {
                try {
                  let j = JSON.parse(b);
                  let l = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : [];
                  let ids = [];
                  for (let it of l) {
                    let id = typeof it == "string" ? it.trim() : (it.id || it.name || "").trim();
                    if (id && !ids.includes(id)) ids.push(id);
                  }
                  if (ids.length > 0) return resolve({ success: true, models: ids });
                } catch (e) {}
              }
              resolve(null);
            });
          });
          req.on("error", () => resolve(null));
          req.on("timeout", () => { req.destroy(); resolve(null); });
          req.end();
        });
        if (res && res.success) return res;
      } catch (e) {}
    }
    return { success: false, error: "未能获取到模型列表，请检查 Base URL 和 API Key" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

__HE__.handle("zcode:add-models-with-metadata", async (e, { baseUrl: u, modelIds: ids, reasoningRange: g, providerName: n, apiKey: k }) => {
  let OMP = __zcode_OMP;
  if (!OMP || typeof OMP !== "object" || Object.keys(OMP).length === 0) {
    return { success: false, error: "OMP efforts 档位表不存在或未加载" };
  }
  let { default: f } = await import("node:fs"), { default: p } = await import("node:path"), { default: o } = await import("node:os"), { default: ht } = await import("node:https");
  let cfgPath = p.join(o.homedir(), ".zcode", "v2", "config.json"), cachePath = p.join(o.homedir(), ".zcode", "v2", ".models-dev-cache.json"), cat = null, cur = null;
  try {
    if (f.existsSync(cachePath)) {
      cur = JSON.parse(f.readFileSync(cachePath, "utf-8"));
      if (cur && typeof cur.fetched_at == "number" && Date.now() - cur.fetched_at < 259200000) cat = cur.data;
    }
  } catch (w) { if (!cat && cur && cur.data) cat = cur.data; }
  if (!cat) {
    try {
      let txt = await new Promise(res => {
        let req = ht.get("https://models.dev/models.json", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2", "Accept": "application/json" } }, r => {
          let b = ""; r.on("data", c => b += c); r.on("end", () => res(b));
        });
        req.on("error", () => res(null));
        req.on("timeout", () => { req.destroy(); res(null); });
        req.setTimeout(12000);
      });
      if (txt) {
        try {
          let j = JSON.parse(txt);
          try {
            f.mkdirSync(p.dirname(cachePath), { recursive: true });
            f.writeFileSync(cachePath, JSON.stringify({ fetched_at: Date.now(), data: j }));
          } catch (w2) {}
          cat = j;
        } catch (w2) {}
      } else if (cur && cur.data) cat = cur.data;
    } catch (w) {}
  }

  let build = (mid, m, rd) => {
    let e = {}, isGpt = /^gpt-/i.test(__zcode_stripAffixes(mid));
    if (m && m.name) e.name = m.name;
    let lim = {};
    if (m && m.limit && m.limit.context) {
      lim.context = m.limit.context;
      if (m.limit.output) lim.output = m.limit.output;
    } else if (isGpt) {
      lim.context = 272000;
      lim.output = 128000;
    }
    if (isGpt) {
      if (lim.context) lim.context = Math.min(lim.context, 272000);
      if (!lim.output) lim.output = 128000;
    }
    if (Object.keys(lim).length) e.limit = lim;
    if (m && m.modalities) {
      e.modalities = { input: m.modalities.input || ["text"], output: m.modalities.output || ["text"] };
    }
    if (m && typeof m.tool_call == "boolean") e.supportsTools = m.tool_call;
    if (m && typeof m.structured_output == "boolean") e.supportsStructuredOutput = m.structured_output;

    let pr = __zcode_getPresetEfforts(mid, OMP);
    if (!pr.error && pr.variants && pr.variants.length > 0) {
      let EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];
      let base = pr.variants;
      let tiers = null;
      if (rd) {
        let a = rd.min ? EFFORTS.indexOf(rd.min) : -1, b = rd.max ? EFFORTS.indexOf(rd.max) : -1;
        if (a < 0) a = 0;
        if (b < 0) b = EFFORTS.length - 1;
        if (b < a) { let t = a; a = b; b = t; }
        tiers = EFFORTS.slice(a, b + 1);
      }
      let vars = tiers ? tiers.filter(v => base.indexOf(v) >= 0) : base;
      if (tiers && vars.length === 0) vars = tiers;
      let dv2 = tiers ? (rd && rd.max && vars.indexOf(rd.max) >= 0 ? rd.max : (pr.default && vars.indexOf(pr.default) >= 0 ? pr.default : vars[vars.length - 1])) : (pr.default ? (vars.indexOf(pr.default) >= 0 ? pr.default : vars[vars.length - 1]) : vars[vars.length - 1]);
      let lv = {};
      for (let vv of vars) lv[vv] = { value: vv };
      e.reasoning = { enabled: true, variants: vars, levels: lv };
      if (dv2) { e.reasoning.defaultLevel = dv2; e.reasoning.defaultVariant = dv2; }
    } else if (!pr.error && pr.reasoning) {
      e.reasoning = { enabled: true };
    }
    e.zcode = { modified: false };
    return e;
  };

  try {
    let cfg = JSON.parse(f.readFileSync(cfgPath, "utf-8")), clean = (u || "").trim().replace(/\/+$/, ""), prov = null, newPid = null;
    for (let [pid, pd] of Object.entries(cfg.provider || {})) {
      let b = ((pd.options || {}).baseURL || "").replace(/\/+$/, "");
      if (b && b === clean) { prov = pd; break; }
    }
    if (!prov) {
      let nm = (n || "").trim();
      for (let [pid, pd] of Object.entries(cfg.provider || {})) {
        if (nm && (pd.name || "") === nm) { prov = pd; break; }
      }
    }
    if (!prov) {
      let host = "custom";
      try {
        let uo = new URL(/^https?:/.test(clean) ? clean : "https://" + clean), hn = (uo.hostname || "").replace(/[^\w.-]/g, "");
        if (hn) host = hn;
      } catch (ue) {}
      let cand = "custom-" + host, c2 = 2;
      while (cfg.provider[cand]) { cand = "custom-" + host + "-" + c2; c2++; }
      newPid = cand;
      prov = { name: (n || "").trim() || host, kind: "openai-compatible", options: { baseURL: clean }, enabled: true, source: "custom", models: {} };
      if (k && String(k).trim()) prov.options.apiKey = String(k).trim(); else prov.options.apiKeyRequired = false;
      cfg.provider[newPid] = prov;
    }
    let added = [], entries = {};
    for (let it of ids || []) {
      let nm = (it || "").trim();
      if (!nm) continue;
      if ((prov.models || {})[nm]) continue;
      prov.models = prov.models || {};
      let en = build(nm, __zcode_matchCatalog(nm, cat), g);
      prov.models[nm] = en;
      added.push(nm);
      entries[nm] = en;
    }
    f.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
    return { success: true, added, entries };
  } catch (x) {
    return { success: false, error: String(x) };
  }
});

__HE__.handle("zcode:enrich-model-metadata", async (e, { baseUrl: u, modelIds: ids, reasoningRange: g }) => {
  let OMP = __zcode_OMP;
  if (!OMP || typeof OMP !== "object" || Object.keys(OMP).length === 0) {
    return { success: false, error: "OMP efforts 档位表不存在或未加载" };
  }
  let { default: f } = await import("node:fs"), { default: p } = await import("node:path"), { default: o } = await import("node:os"), { default: ht } = await import("node:https");
  let cfgPath = p.join(o.homedir(), ".zcode", "v2", "config.json"), cachePath = p.join(o.homedir(), ".zcode", "v2", ".models-dev-cache.json"), cat = null, cur = null;
  try {
    if (f.existsSync(cachePath)) {
      cur = JSON.parse(f.readFileSync(cachePath, "utf-8"));
      if (cur && typeof cur.fetched_at == "number" && Date.now() - cur.fetched_at < 259200000) cat = cur.data;
    }
  } catch (w) { if (!cat && cur && cur.data) cat = cur.data; }
  if (!cat) {
    try {
      let txt = await new Promise(res => {
        let req = ht.get("https://models.dev/models.json", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2", "Accept": "application/json" } }, r => {
          let b = ""; r.on("data", c => b += c); r.on("end", () => res(b));
        });
        req.on("error", () => res(null));
        req.on("timeout", () => { req.destroy(); res(null); });
        req.setTimeout(12000);
      });
      if (txt) {
        try {
          let j = JSON.parse(txt);
          try {
            f.mkdirSync(p.dirname(cachePath), { recursive: true });
            f.writeFileSync(cachePath, JSON.stringify({ fetched_at: Date.now(), data: j }));
          } catch (w2) {}
          cat = j;
        } catch (w2) {}
      } else if (cur && cur.data) cat = cur.data;
    } catch (w) {}
  }

  let calc = (mid) => {
    let m = __zcode_matchCatalog(mid, cat), isGpt = /^gpt-/i.test(__zcode_stripAffixes(mid)), e = {}, lim = {};
    if (m && m.name) e.name = m.name;
    if (m && m.limit && m.limit.context) {
      lim.context = m.limit.context;
      if (m.limit.output) lim.output = m.limit.output;
    } else if (isGpt) {
      lim.context = 272000;
      lim.output = 128000;
    }
    if (isGpt) {
      if (lim.context) lim.context = Math.min(lim.context, 272000);
      if (!lim.output) lim.output = 128000;
    }
    if (Object.keys(lim).length) e.limit = lim;
    if (m && m.modalities) e.modalities = { input: m.modalities.input || ["text"], output: m.modalities.output || ["text"] };
    if (m && typeof m.tool_call == "boolean") e.supportsTools = m.tool_call;
    if (m && typeof m.structured_output == "boolean") e.supportsStructuredOutput = m.structured_output;

    let pr = __zcode_getPresetEfforts(mid, OMP);
    if (!pr.error && pr.variants && pr.variants.length > 0) {
      let EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];
      let base = pr.variants;
      let tiers = null;
      if (g) {
        let a = g.min ? EFFORTS.indexOf(g.min) : -1, b = g.max ? EFFORTS.indexOf(g.max) : -1;
        if (a < 0) a = 0;
        if (b < 0) b = EFFORTS.length - 1;
        if (b < a) { let t = a; a = b; b = t; }
        tiers = EFFORTS.slice(a, b + 1);
      }
      let vars = tiers ? tiers.filter(v => base.indexOf(v) >= 0) : base;
      if (tiers && vars.length === 0) vars = tiers;
      let dv2 = tiers ? (g && g.max && vars.indexOf(g.max) >= 0 ? g.max : (pr.default && vars.indexOf(pr.default) >= 0 ? pr.default : vars[vars.length - 1])) : (pr.default ? (vars.indexOf(pr.default) >= 0 ? pr.default : vars[vars.length - 1]) : vars[vars.length - 1]);
      let lv = {};
      for (let vv of vars) lv[vv] = { value: vv };
      e.reasoning = { enabled: true, variants: vars, levels: lv };
      if (dv2) { e.reasoning.defaultLevel = dv2; e.reasoning.defaultVariant = dv2; }
    } else if (!pr.error && pr.reasoning) {
      e.reasoning = { enabled: true };
    }
    return e;
  };

  try {
    let cfg = JSON.parse(f.readFileSync(cfgPath, "utf-8")), clean = (u || "").trim().replace(/\/+$/, ""), prov = null;
    for (let [pid, pd] of Object.entries(cfg.provider || {})) {
      let b = ((pd.options || {}).baseURL || "").replace(/\/+$/, "");
      if (b && b === clean) { prov = pd; break; }
    }
    if (!prov) return { success: false, error: "未找到匹配的供应商，请先完成官方保存后再同步" };
    let touched = 0;
    for (let it of ids || []) {
      let nm = (it || "").trim();
      if (!nm) continue;
      let m = (prov.models || {})[nm];
      if (!m) continue;
      let en = calc(nm), upd = 0;
      if (en.limit) { m.limit = en.limit; upd++; }
      if (en.modalities) { m.modalities = en.modalities; upd++; }
      if (en.supportsTools) m.supportsTools = en.supportsTools;
      if (en.supportsStructuredOutput) m.supportsStructuredOutput = en.supportsStructuredOutput;
      if (en.name && en.name !== nm) m.name = en.name;
      if (en.reasoning) { m.reasoning = en.reasoning; upd++; }
      if (upd) touched++;
    }
    if (touched) f.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
    return { success: true, touched };
  } catch (x) {
    return { success: false, error: String(x) };
  }
});

__HE__.handle("zcode:model-metadata", async (e, { modelIds: ids }) => {
  let { default: f } = await import("node:fs"), { default: p } = await import("node:path"), { default: o } = await import("node:os"), { default: ht } = await import("node:https");
  let OMP = __zcode_OMP;
  if (!OMP || typeof OMP !== "object" || Object.keys(OMP).length === 0) {
    return { success: false, error: "OMP efforts 档位表不存在或未加载" };
  }
  let cachePath = p.join(o.homedir(), ".zcode", "v2", ".models-dev-cache.json"), cat = null, cur = null;
  try {
    if (f.existsSync(cachePath)) {
      cur = JSON.parse(f.readFileSync(cachePath, "utf-8"));
      if (cur && typeof cur.fetched_at == "number" && Date.now() - cur.fetched_at < 259200000) cat = cur.data;
    }
  } catch (w) { if (!cat && cur && cur.data) cat = cur.data; }
  if (!cat) {
    try {
      let txt = await new Promise(res => {
        let req = ht.get("https://models.dev/models.json", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZCode/3.11.2", "Accept": "application/json" } }, r => {
          let b = ""; r.on("data", c => b += c); r.on("end", () => res(b));
        });
        req.on("error", () => res(null));
        req.on("timeout", () => { req.destroy(); res(null); });
        req.setTimeout(12000);
      });
      if (txt) {
        try {
          let j = JSON.parse(txt);
          try {
            f.mkdirSync(p.dirname(cachePath), { recursive: true });
            f.writeFileSync(cachePath, JSON.stringify({ fetched_at: Date.now(), data: j }));
          } catch (w2) {}
          cat = j;
        } catch (w2) {}
      } else if (cur && cur.data) cat = cur.data;
    } catch (w) {}
  }

  let meta = {};
  let errors = [];
  let missingEfforts = [];

  for (let it of ids || []) {
    let nm = (it || "").trim();
    if (!nm) continue;
    let m = __zcode_matchCatalog(nm, cat);
    let coreNm = __zcode_stripAffixes(nm);
    let isGpt = /^gpt-/i.test(coreNm);
    let en = {};
    if (m && m.limit && m.limit.context) en.ctx = m.limit.context;
    else if (isGpt) en.ctx = 272000;
    if (m && m.limit && m.limit.output) en.out = m.limit.output;
    else if (isGpt) en.out = 128000;
    if (m && m.modalities) {
      en.in = m.modalities.input || ["text"];
      en.outM = m.modalities.output || ["text"];
    } else {
      en.in = ["text"];
      en.outM = ["text"];
    }
    if (isGpt && en.ctx) en.ctx = Math.min(en.ctx, 272000);
    if (m && typeof m.tool_call === "boolean") en.tool_call = m.tool_call;
    if (m && typeof m.structured_output === "boolean") en.structured_output = m.structured_output;

    let pr = __zcode_getPresetEfforts(nm, OMP);
    if (pr.error) {
      errors.push(pr.error);
      missingEfforts.push(nm);
    } else if (pr.variants && pr.variants.length > 0) {
      en.r = pr.variants.slice();
      en.reasoning = true;
    } else if (pr.reasoning) {
      en.reasoning = true;
    }
    meta[nm] = en;
  }

  let hasMissing = ids && ids.length === 1 && missingEfforts.includes(ids[0].trim());
  return {
    success: !hasMissing,
    error: hasMissing ? ("未找到模型 " + ids[0] + " 的 OMP efforts 思考档位配置（omp efforts 不存在）") : undefined,
    meta,
    missingEfforts,
    errors: errors.length > 0 ? errors : undefined
  };
});

__HE__.handle("zcode:simulate-mouse-click", async (ev, { x, y }) => {
  try {
    ev.sender.sendInputEvent({ type: "mouseDown", x: x, y: y, button: "left", clickCount: 1 });
    ev.sender.sendInputEvent({ type: "mouseUp", x: x, y: y, button: "left", clickCount: 1 });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

__HE__.handle("zcode:simulate-mouse-move", async (ev, { x, g }) => {
  try {
    ev.sender.sendInputEvent({ type: "mouseMove", x: x, y: g });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
