// Tainted Grail sessions: render history + inline "new session" editor + GitHub sync.
(() => {
  const root = document.getElementById("tg-campaign-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "assets/data/tainted_grail_foa_sessions.json");
  const defaultSyncConfig = normalizeSyncConfig(window.TG_FOA_SYNC || {});

  const draftKey = "bgb_tg_foa_sessions_draft_v2";
  const tokenKey = "bgb_github_sync_token_v1";
  const syncConfigKey = "bgb_tg_foa_sync_cfg_v2";
  const autoSyncKey = "bgb_tg_foa_auto_sync_v2";

  let state = { campaign: {}, sessions: [], draftSession: null };
  let sourceRaw = "";
  let syncStatusNode = null;
  let pageStatusNode = null;
  let syncTimer = null;
  let syncInFlight = false;
  let lastSyncedHash = "";

  function normalizeSyncConfig(raw) {
    if (!raw || typeof raw !== "object") return null;
    const provider = String(raw.provider || "").trim().toLowerCase();
    if (provider !== "github") return null;
    const owner = String(raw.owner || "").trim();
    const repo = String(raw.repo || "").trim();
    const branch = String(raw.branch || "main").trim();
    const filePath = String(raw.filePath || "").trim().replace(/^\/+/, "");
    if (!owner || !repo || !filePath) return null;
    return { provider, owner, repo, branch, filePath };
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function sanitizeRows(list, keys) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      const row = {};
      keys.forEach((k) => {
        row[k] = String((item && item[k]) || "").trim();
      });
      return row;
    });
  }

  function sanitizeNotes(list) {
    if (!Array.isArray(list)) return [];
    return list.map((note) => (typeof note === "string" ? note : String((note && note.text) || "").trim()));
  }

  function sanitizeSession(raw, fallbackNo) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const sessionNo = Number(safe.sessionNo) > 0 ? Number(safe.sessionNo) : fallbackNo;
    return {
      id: String(safe.id || `session-${sessionNo}-${Date.now()}`),
      sessionNo,
      date: String(safe.date || ""),
      menhirs: sanitizeRows(safe.menhirs, ["location", "value", "dial"]),
      tasks: sanitizeRows(safe.tasks, ["tag", "text"]),
      locationChanges: sanitizeRows(safe.locationChanges, ["from", "to"]),
      notes: sanitizeNotes(safe.notes),
    };
  }

  function sanitizeData(raw) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const campaign = safe.campaign && typeof safe.campaign === "object" ? safe.campaign : {};
    const sessions = Array.isArray(safe.sessions) ? safe.sessions : [];
    const draftSession = safe.draftSession ? sanitizeSession(safe.draftSession, getNextSessionNo(sessions)) : null;
    return {
      campaign: {
        title: String(campaign.title || "The Fall of Avalon"),
        startedOn: String(campaign.startedOn || ""),
        summary: String(campaign.summary || ""),
      },
      sessions: sessions.map((s, i) => sanitizeSession(s, i + 1)),
      draftSession,
    };
  }

  function sortSessions(list) {
    list.sort((a, b) => {
      if (a.sessionNo !== b.sessionNo) return a.sessionNo - b.sessionNo;
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function fmtDate(dateIso) {
    const t = String(dateIso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const [y, m, d] = t.split("-");
    return `${m}/${d}/${y}`;
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function getNextSessionNo(sessionsLike) {
    const sessions = Array.isArray(sessionsLike) ? sessionsLike : state.sessions;
    let maxNo = 0;
    sessions.forEach((s) => {
      maxNo = Math.max(maxNo, Number(s.sessionNo || 0));
    });
    return maxNo + 1;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (typeof text === "string") n.textContent = text;
    return n;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(state));
      setPageStatus("本地草稿已保存");
    } catch (_error) {
      setPageStatus("本地草稿保存失败");
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      return sanitizeData(JSON.parse(raw));
    } catch (_error) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch (_error) {
      // Ignore.
    }
  }

  function setPageStatus(text) {
    if (pageStatusNode) pageStatusNode.textContent = text;
  }

  function setSyncStatus(text) {
    if (syncStatusNode) syncStatusNode.textContent = text;
  }

  function wireSaveAndSync() {
    saveDraft();
    if (getAutoSync()) scheduleSync();
  }

  function createDraftSession() {
    if (state.draftSession) return;
    const sorted = deepClone(state.sessions);
    sortSessions(sorted);
    const latest = sorted[sorted.length - 1] || null;
    state.draftSession = {
      id: `draft-${Date.now()}`,
      sessionNo: getNextSessionNo(),
      date: todayIso(),
      menhirs: [],
      tasks: [],
      // User requested: inherit these two sections from latest session.
      locationChanges: latest ? deepClone(latest.locationChanges || []) : [],
      notes: latest ? deepClone(latest.notes || []) : [],
    };
    wireSaveAndSync();
    render();
    setPageStatus("已创建 New Session，可在每个区块点击 + 逐条添加");
  }

  function discardDraftSession() {
    state.draftSession = null;
    wireSaveAndSync();
    render();
    setPageStatus("已取消 New Session");
  }

  function appendDraftToHistory() {
    const d = state.draftSession;
    if (!d) return;
    state.sessions.push(deepClone(d));
    sortSessions(state.sessions);
    state.draftSession = null;
    wireSaveAndSync();
    render();
    setPageStatus("New Session 已追加到历史列表");
  }

  function updateDraftField(key, value) {
    if (!state.draftSession) return;
    state.draftSession[key] = value;
    wireSaveAndSync();
    render();
  }

  function addDraftRow(section, row) {
    if (!state.draftSession || !Array.isArray(state.draftSession[section])) return;
    state.draftSession[section].push(row);
    wireSaveAndSync();
    render();
  }

  function deleteDraftRow(section, index) {
    if (!state.draftSession || !Array.isArray(state.draftSession[section])) return;
    state.draftSession[section].splice(index, 1);
    wireSaveAndSync();
    render();
  }

  function updateDraftRow(section, index, key, value) {
    if (!state.draftSession || !Array.isArray(state.draftSession[section])) return;
    const row = state.draftSession[section][index];
    if (!row) return;
    row[key] = value;
    wireSaveAndSync();
  }

  function updateDraftNote(index, value) {
    if (!state.draftSession || !Array.isArray(state.draftSession.notes)) return;
    state.draftSession.notes[index] = value;
    wireSaveAndSync();
  }

  function renderSessionReadOnly(session) {
    const wrap = el("div", "session");
    const header = el("div", "session-header");
    header.appendChild(el("h4", "session-title", `Session ${String(session.sessionNo).padStart(2, "0")} - ${fmtDate(session.date)}`));
    wrap.appendChild(header);
    wrap.appendChild(renderMenhirBlock(session, false));
    wrap.appendChild(renderTasksBlock(session, false));
    wrap.appendChild(renderLocationBlock(session, false));
    wrap.appendChild(renderNotesBlock(session, false));
    return wrap;
  }

  function renderSessionEditable(session) {
    const wrap = el("div", "session tg-draft-session");
    const header = el("div", "session-header");
    const title = el("h4", "session-title", "New Session");
    const controls = el("div", "tg-draft-head");

    const noLabel = el("label", "tg-mini-label", "No");
    const noInput = document.createElement("input");
    noInput.type = "number";
    noInput.min = "1";
    noInput.value = String(session.sessionNo || getNextSessionNo());
    noInput.addEventListener("input", () => {
      const next = Number(noInput.value);
      if (next > 0) updateDraftField("sessionNo", next);
    });
    noLabel.appendChild(noInput);

    const dateLabel = el("label", "tg-mini-label", "Date");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = session.date || todayIso();
    dateInput.addEventListener("input", () => {
      updateDraftField("date", dateInput.value);
    });
    dateLabel.appendChild(dateInput);

    controls.append(noLabel, dateLabel);
    header.append(title, controls);
    wrap.appendChild(header);

    wrap.appendChild(renderMenhirBlock(session, true));
    wrap.appendChild(renderTasksBlock(session, true));
    wrap.appendChild(renderLocationBlock(session, true));
    wrap.appendChild(renderNotesBlock(session, true));

    const actions = el("div", "tg-draft-actions");
    const appendBtn = el("button", "tg-add-btn", "Append To History");
    appendBtn.type = "button";
    appendBtn.addEventListener("click", appendDraftToHistory);

    const cancelBtn = el("button", "tg-add-btn", "Cancel");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", discardDraftSession);

    actions.append(appendBtn, cancelBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  function renderMenhirBlock(session, editable) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "巨神柱状态"));

    const grid = el("div", "tg-menhir-grid");
    grid.appendChild(el("div", "tg-menhir-head tg-menhir-head-loc", "Location"));
    grid.appendChild(el("div", "tg-menhir-head tg-menhir-head-dial", "Dial Value"));

    session.menhirs.forEach((row, index) => {
      if (!editable) {
        grid.appendChild(el("div", "tg-menhir-row", row.location || ""));
        grid.appendChild(el("div", "tg-menhir-cell", row.value || ""));
        grid.appendChild(el("div", "tg-menhir-cell", row.dial || ""));
        return;
      }

      const loc = document.createElement("input");
      loc.className = "tg-edit-input";
      loc.value = row.location || "";
      loc.placeholder = "Location";
      loc.addEventListener("input", () => updateDraftRow("menhirs", index, "location", loc.value));

      const val = document.createElement("input");
      val.className = "tg-edit-input";
      val.value = row.value || "";
      val.placeholder = "Value";
      val.addEventListener("input", () => updateDraftRow("menhirs", index, "value", val.value));

      const dial = document.createElement("input");
      dial.className = "tg-edit-input";
      dial.value = row.dial || "";
      dial.placeholder = "Dial";
      dial.addEventListener("input", () => updateDraftRow("menhirs", index, "dial", dial.value));

      const del = el("button", "tg-inline-del", "- ");
      del.type = "button";
      del.addEventListener("click", () => deleteDraftRow("menhirs", index));

      const locWrap = el("div", "tg-menhir-row tg-edit-box");
      const valWrap = el("div", "tg-menhir-cell tg-edit-box");
      const dialWrap = el("div", "tg-menhir-cell tg-edit-box");
      locWrap.append(loc, del);
      valWrap.appendChild(val);
      dialWrap.appendChild(dial);
      grid.append(locWrap, valWrap, dialWrap);
    });

    block.appendChild(grid);

    if (editable) {
      const add = el("button", "tg-add-btn", "+ Menhir");
      add.type = "button";
      add.addEventListener("click", () => addDraftRow("menhirs", { location: "", value: "", dial: "" }));
      block.appendChild(add);
    }

    return block;
  }

  function renderTasksBlock(session, editable) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "任务"));
    const list = el("div", "tg-list");

    session.tasks.forEach((row, index) => {
      if (!editable) {
        const line = el("div", "tg-line");
        line.append(el("span", "tg-tag", row.tag || ""), el("span", "tg-text", row.text || ""));
        list.appendChild(line);
        return;
      }

      const line = el("div", "tg-line tg-edit-line");
      const tag = document.createElement("input");
      tag.className = "tg-edit-input tg-edit-tag";
      tag.value = row.tag || "";
      tag.placeholder = "Tag";
      tag.addEventListener("input", () => updateDraftRow("tasks", index, "tag", tag.value));

      const text = document.createElement("input");
      text.className = "tg-edit-input";
      text.value = row.text || "";
      text.placeholder = "Task";
      text.addEventListener("input", () => updateDraftRow("tasks", index, "text", text.value));

      const del = el("button", "tg-inline-del", "-");
      del.type = "button";
      del.addEventListener("click", () => deleteDraftRow("tasks", index));

      const tagWrap = el("span", "tg-tag tg-edit-box");
      const textWrap = el("span", "tg-text tg-edit-box");
      tagWrap.appendChild(tag);
      textWrap.append(text, del);
      line.append(tagWrap, textWrap);
      list.appendChild(line);
    });

    block.appendChild(list);
    if (editable) {
      const add = el("button", "tg-add-btn", "+ Task");
      add.type = "button";
      add.addEventListener("click", () => addDraftRow("tasks", { tag: "", text: "" }));
      block.appendChild(add);
    }
    return block;
  }

  function renderLocationBlock(session, editable) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "地点变化"));
    const list = el("div", "tg-list");

    session.locationChanges.forEach((row, index) => {
      if (!editable) {
        const move = el("div", "tg-move");
        move.append(el("span", "tg-tag", row.from || ""), el("span", "tg-arrow-img"), el("span", "tg-tag", row.to || ""));
        list.appendChild(move);
        return;
      }

      const line = el("div", "tg-move tg-edit-move");
      const from = document.createElement("input");
      from.className = "tg-edit-input";
      from.value = row.from || "";
      from.placeholder = "From";
      from.addEventListener("input", () => updateDraftRow("locationChanges", index, "from", from.value));

      const to = document.createElement("input");
      to.className = "tg-edit-input";
      to.value = row.to || "";
      to.placeholder = "To";
      to.addEventListener("input", () => updateDraftRow("locationChanges", index, "to", to.value));

      const del = el("button", "tg-inline-del", "-");
      del.type = "button";
      del.addEventListener("click", () => deleteDraftRow("locationChanges", index));

      const fromWrap = el("span", "tg-tag tg-edit-box");
      const toWrap = el("span", "tg-tag tg-edit-box");
      fromWrap.appendChild(from);
      toWrap.appendChild(to);
      line.append(fromWrap, el("span", "tg-arrow-img"), toWrap, del);
      list.appendChild(line);
    });

    block.appendChild(list);
    if (editable) {
      const add = el("button", "tg-add-btn", "+ Location Change");
      add.type = "button";
      add.addEventListener("click", () => addDraftRow("locationChanges", { from: "", to: "" }));
      block.appendChild(add);
    }
    return block;
  }

  function renderNotesBlock(session, editable) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "冒险笔记"));
    const list = el("div", "tg-list");

    session.notes.forEach((note, index) => {
      if (!editable) {
        list.appendChild(el("div", "tg-note", note || ""));
        return;
      }

      const noteWrap = el("div", "tg-note tg-edit-box tg-edit-note");
      const input = document.createElement("input");
      input.className = "tg-edit-input";
      input.value = note || "";
      input.placeholder = "Note";
      input.addEventListener("input", () => updateDraftNote(index, input.value));

      const del = el("button", "tg-inline-del", "-");
      del.type = "button";
      del.addEventListener("click", () => deleteDraftRow("notes", index));

      noteWrap.append(input, del);
      list.appendChild(noteWrap);
    });

    block.appendChild(list);
    if (editable) {
      const add = el("button", "tg-add-btn", "+ Note");
      add.type = "button";
      add.addEventListener("click", () => addDraftRow("notes", ""));
      block.appendChild(add);
    }

    return block;
  }

  function getToken() {
    try {
      return String(localStorage.getItem(tokenKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function setToken(next) {
    try {
      if (next) localStorage.setItem(tokenKey, next);
      else localStorage.removeItem(tokenKey);
    } catch (_error) {
      // Ignore.
    }
  }

  function getAutoSync() {
    try {
      return localStorage.getItem(autoSyncKey) === "1";
    } catch (_error) {
      return false;
    }
  }

  function setAutoSync(v) {
    try {
      localStorage.setItem(autoSyncKey, v ? "1" : "0");
    } catch (_error) {
      // Ignore.
    }
  }

  function getSyncConfig() {
    try {
      const raw = localStorage.getItem(syncConfigKey);
      if (!raw) return defaultSyncConfig;
      return normalizeSyncConfig(JSON.parse(raw)) || defaultSyncConfig;
    } catch (_error) {
      return defaultSyncConfig;
    }
  }

  function setSyncConfig(cfg) {
    try {
      localStorage.setItem(syncConfigKey, JSON.stringify(cfg));
    } catch (_error) {
      // Ignore.
    }
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function quickHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function getPersistablePayload() {
    return {
      campaign: deepClone(state.campaign),
      sessions: deepClone(state.sessions),
    };
  }

  async function fetchRemoteSha(cfg, token) {
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    const payload = await res.json();
    if (!payload || typeof payload.sha !== "string") throw new Error("GitHub response missing file SHA");
    return payload.sha;
  }

  async function syncNow(force) {
    const token = getToken();
    const cfg = getSyncConfig();
    if (!token) {
      setSyncStatus("GitHub token 缺失");
      return;
    }
    if (!cfg) {
      setSyncStatus("GitHub 配置不完整");
      return;
    }
    if (syncInFlight) return;

    const content = `${JSON.stringify(getPersistablePayload(), null, 2)}\n`;
    const nextHash = quickHash(content);
    if (!force && nextHash === lastSyncedHash) return;

    syncInFlight = true;
    setSyncStatus("同步中...");

    try {
      const sha = await fetchRemoteSha(cfg, token);
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}`;
      const message = `update tainted grail sessions ${new Date().toISOString().slice(0, 19)}Z`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          content: encodeBase64Utf8(content),
          branch: cfg.branch,
          sha,
        }),
      });
      if (!res.ok) throw new Error(`GitHub write failed (${res.status})`);
      lastSyncedHash = nextHash;
      setSyncStatus(`已同步 (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`);
    } catch (error) {
      setSyncStatus(error && error.message ? error.message : "同步失败");
    } finally {
      syncInFlight = false;
    }
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      void syncNow(false);
    }, 2200);
  }

  function renderSyncControls(host) {
    const box = el("div", "tg-sync-bar");
    const cfg = getSyncConfig() || defaultSyncConfig || {
      provider: "github", owner: "", repo: "", branch: "main", filePath: dataSource,
    };

    const owner = mkInput("Owner", cfg.owner);
    const repo = mkInput("Repo", cfg.repo);
    const branch = mkInput("Branch", cfg.branch || "main");
    const file = mkInput("File", cfg.filePath || dataSource);
    box.append(owner.wrap, repo.wrap, branch.wrap, file.wrap);

    const saveCfgBtn = el("button", "tg-add-btn", "Save Sync Config");
    saveCfgBtn.type = "button";
    saveCfgBtn.addEventListener("click", () => {
      const next = normalizeSyncConfig({
        provider: "github",
        owner: owner.input.value,
        repo: repo.input.value,
        branch: branch.input.value || "main",
        filePath: file.input.value || dataSource,
      });
      if (!next) {
        setSyncStatus("Sync 配置无效");
        return;
      }
      setSyncConfig(next);
      setSyncStatus("Sync 配置已保存");
    });

    const tokenBtn = el("button", "tg-add-btn", getToken() ? "Update Token" : "Connect Token");
    tokenBtn.type = "button";
    tokenBtn.addEventListener("click", () => {
      const current = getToken();
      const input = window.prompt("输入 GitHub PAT（repo contents:write）。留空则断开。", current);
      if (input === null) return;
      setToken(String(input || "").trim());
      tokenBtn.textContent = getToken() ? "Update Token" : "Connect Token";
      setSyncStatus(getToken() ? "Token 已连接" : "Token 已断开");
    });

    const autoLabel = el("label", "tg-mini-label", "Auto Sync");
    const auto = document.createElement("input");
    auto.type = "checkbox";
    auto.checked = getAutoSync();
    auto.addEventListener("change", () => {
      setAutoSync(auto.checked);
      setSyncStatus(auto.checked ? "Auto Sync 已开启" : "Auto Sync 已关闭");
    });
    autoLabel.appendChild(auto);

    const nowBtn = el("button", "tg-add-btn", "Sync Now");
    nowBtn.type = "button";
    nowBtn.addEventListener("click", () => {
      void syncNow(true);
    });

    syncStatusNode = el("div", "tg-page-status", getToken() ? "Token 已连接" : "Token 未连接");
    box.append(saveCfgBtn, tokenBtn, autoLabel, nowBtn, syncStatusNode);

    host.appendChild(box);
  }

  function mkInput(labelText, value) {
    const wrap = el("label", "tg-mini-label", labelText);
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    wrap.appendChild(input);
    return { wrap, input };
  }

  function render() {
    root.innerHTML = "";

    const group = el("div", "campaign-group");
    const subtitleWrap = el("div", "campaign-subtitle-wrapper");
    const subtitleHeader = el("div", "subtitle-header");
    subtitleHeader.append(
      el("h3", "campaign-subtitle", state.campaign.title || "The Fall of Avalon"),
      el("span", "campaign-meta", state.campaign.startedOn ? `Started on ${fmtDate(state.campaign.startedOn)}` : "")
    );
    subtitleWrap.appendChild(subtitleHeader);

    const summary = el("div", "card");
    const h4 = el("h4", "", state.campaign.summary || "");
    h4.style.marginBottom = "0";
    summary.appendChild(h4);

    const logsCard = el("div", "card");
    logsCard.id = "logs";
    const title = el("h3", "", "Campaign Logs");
    title.style.marginTop = "0";
    logsCard.appendChild(title);

    const sorted = deepClone(state.sessions);
    sortSessions(sorted);
    sorted.forEach((s) => logsCard.appendChild(renderSessionReadOnly(s)));

    const newBtnWrap = el("div", "tg-new-session-wrap");
    const newBtn = el("button", "tg-add-btn tg-new-session-btn", "+ New Session");
    newBtn.type = "button";
    newBtn.addEventListener("click", createDraftSession);
    newBtn.disabled = !!state.draftSession;
    newBtnWrap.appendChild(newBtn);
    logsCard.appendChild(newBtnWrap);

    if (state.draftSession) {
      logsCard.appendChild(renderSessionEditable(state.draftSession));
    }

    pageStatusNode = el("div", "tg-page-status", "Ready");
    logsCard.appendChild(pageStatusNode);

    renderSyncControls(logsCard);

    group.append(subtitleWrap, summary, logsCard);
    root.appendChild(group);
  }

  async function init() {
    let remoteData = { campaign: {}, sessions: [], draftSession: null };
    try {
      const res = await fetch(`${dataSource}?v=20260228`);
      if (!res.ok) throw new Error("fetch failed");
      remoteData = sanitizeData(await res.json());
    } catch (_error) {
      remoteData = sanitizeData(remoteData);
    }

    sourceRaw = JSON.stringify(remoteData);
    const draft = loadDraft();
    state = draft || remoteData;
    render();
    if (draft) setPageStatus("已加载本地草稿");
  }

  void init();
})();
