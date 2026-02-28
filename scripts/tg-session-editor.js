// Tainted Grail session renderer + in-page editor + GitHub JSON sync.
(() => {
  const campaignRoot = document.getElementById("tg-campaign-root");
  const editorRoot = document.getElementById("tg-editor-root");
  if (!campaignRoot || !editorRoot) return;

  const dataSource = String(campaignRoot.getAttribute("data-source") || "assets/data/tainted_grail_foa_sessions.json");
  const defaultSyncConfig = normalizeSyncConfig(window.TG_FOA_SYNC || {});

  const draftKey = "bgb_tg_foa_sessions_draft_v1";
  const tokenKey = "bgb_github_sync_token_v1";
  const syncConfigKey = "bgb_tg_foa_sync_cfg_v1";
  const autoSyncKey = "bgb_tg_foa_auto_sync_v1";

  let state = { campaign: {}, sessions: [] };
  let sourceStateRaw = "";
  let selectedSessionId = "";
  let editorStatusEl = null;
  let syncStatusEl = null;
  let syncInFlight = false;
  let syncTimer = null;
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

  function getStoredSyncConfig() {
    try {
      const raw = localStorage.getItem(syncConfigKey);
      if (!raw) return defaultSyncConfig;
      const parsed = JSON.parse(raw);
      return normalizeSyncConfig(parsed) || defaultSyncConfig;
    } catch (_error) {
      return defaultSyncConfig;
    }
  }

  function setStoredSyncConfig(cfg) {
    try {
      localStorage.setItem(syncConfigKey, JSON.stringify(cfg));
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function getToken() {
    try {
      return String(localStorage.getItem(tokenKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(tokenKey, token);
      else localStorage.removeItem(tokenKey);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function getAutoSync() {
    try {
      return localStorage.getItem(autoSyncKey) === "1";
    } catch (_error) {
      return false;
    }
  }

  function setAutoSync(next) {
    try {
      localStorage.setItem(autoSyncKey, next ? "1" : "0");
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeData(raw) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const campaign = safe.campaign && typeof safe.campaign === "object" ? safe.campaign : {};
    const sessions = Array.isArray(safe.sessions) ? safe.sessions : [];

    return {
      campaign: {
        title: String(campaign.title || "The Fall of Avalon"),
        startedOn: String(campaign.startedOn || ""),
        summary: String(campaign.summary || ""),
      },
      sessions: sessions.map((session, index) => sanitizeSession(session, index + 1)),
    };
  }

  function sanitizeSession(raw, fallbackNo) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const sessionNo = Number(safe.sessionNo) > 0 ? Number(safe.sessionNo) : fallbackNo;
    const date = String(safe.date || "").trim();
    return {
      id: String(safe.id || `session-${sessionNo}-${Date.now()}`),
      sessionNo,
      date,
      menhirs: normalizeRows(safe.menhirs, ["location", "value", "dial"]),
      tasks: normalizeRows(safe.tasks, ["tag", "text"]),
      locationChanges: normalizeRows(safe.locationChanges, ["from", "to"]),
      notes: normalizeNoteRows(safe.notes),
    };
  }

  function normalizeRows(list, keys) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      const row = {};
      keys.forEach((key) => {
        row[key] = String((item && item[key]) || "");
      });
      return row;
    });
  }

  function normalizeNoteRows(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => (typeof item === "string" ? item : String((item && item.text) || "")));
  }

  function sortSessions(list) {
    list.sort((a, b) => {
      if (a.sessionNo !== b.sessionNo) return a.sessionNo - b.sessionNo;
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  }

  function formatDateDisplay(dateText) {
    const iso = String(dateText || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const parts = iso.split("-");
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function renderCampaign() {
    campaignRoot.innerHTML = "";
    const group = el("div", "campaign-group");

    const subtitleWrap = el("div", "campaign-subtitle-wrapper");
    const subtitleHeader = el("div", "subtitle-header");
    const subtitle = el("h3", "campaign-subtitle", state.campaign.title || "The Fall of Avalon");
    const started = state.campaign.startedOn ? `Started on ${formatDateDisplay(state.campaign.startedOn)}` : "";
    const meta = el("span", "campaign-meta", started);
    subtitleHeader.append(subtitle, meta);
    subtitleWrap.appendChild(subtitleHeader);

    const summaryCard = el("div", "card");
    const summary = el("h4", "", state.campaign.summary || "");
    summary.style.marginBottom = "0";
    summaryCard.appendChild(summary);

    const logsCard = el("div", "card");
    logsCard.id = "logs";
    logsCard.appendChild(el("h3", "", "Campaign Logs"));

    const sorted = deepClone(state.sessions);
    sortSessions(sorted);
    sorted.forEach((session) => {
      logsCard.appendChild(renderSession(session));
    });

    group.append(subtitleWrap, summaryCard, logsCard);
    campaignRoot.appendChild(group);
  }

  function renderSession(session) {
    const sessionEl = el("div", "session");

    const header = el("div", "session-header");
    const title = `Session ${String(session.sessionNo).padStart(2, "0")} - ${formatDateDisplay(session.date)}`;
    header.appendChild(el("h4", "session-title", title));
    sessionEl.appendChild(header);

    sessionEl.appendChild(renderMenhirBlock(session));
    sessionEl.appendChild(renderTasksBlock(session));
    sessionEl.appendChild(renderLocationBlock(session));
    sessionEl.appendChild(renderNotesBlock(session));

    return sessionEl;
  }

  function renderMenhirBlock(session) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "巨神柱状态"));

    const grid = el("div", "tg-menhir-grid");
    grid.appendChild(el("div", "tg-menhir-head tg-menhir-head-loc", "Location"));
    grid.appendChild(el("div", "tg-menhir-head tg-menhir-head-dial", "Dial Value"));

    session.menhirs.forEach((item) => {
      grid.appendChild(el("div", "tg-menhir-row", item.location || ""));
      grid.appendChild(el("div", "tg-menhir-cell", item.value || ""));
      grid.appendChild(el("div", "tg-menhir-cell", item.dial || ""));
    });

    block.appendChild(grid);
    return block;
  }

  function renderTasksBlock(session) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "任务"));
    const list = el("div", "tg-list");

    session.tasks.forEach((item) => {
      const line = el("div", "tg-line");
      line.appendChild(el("span", "tg-tag", item.tag || ""));
      line.appendChild(el("span", "tg-text", item.text || ""));
      list.appendChild(line);
    });

    block.appendChild(list);
    return block;
  }

  function renderLocationBlock(session) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "地点变化"));
    const list = el("div", "tg-list");

    session.locationChanges.forEach((item) => {
      const move = el("div", "tg-move");
      move.appendChild(el("span", "tg-tag", item.from || ""));
      move.appendChild(el("span", "tg-arrow-img"));
      move.appendChild(el("span", "tg-tag", item.to || ""));
      list.appendChild(move);
    });

    block.appendChild(list);
    return block;
  }

  function renderNotesBlock(session) {
    const block = el("div", "tg-block cn");
    block.lang = "zh";
    block.appendChild(el("div", "tg-title", "冒险笔记"));
    const list = el("div", "tg-list");

    session.notes.forEach((note) => {
      list.appendChild(el("div", "tg-note", note || ""));
    });

    block.appendChild(list);
    return block;
  }

  function getSelectedSession() {
    return state.sessions.find((session) => session.id === selectedSessionId) || null;
  }

  function ensureSelectedSession() {
    if (getSelectedSession()) return;
    const sorted = deepClone(state.sessions);
    sortSessions(sorted);
    selectedSessionId = sorted.length ? sorted[sorted.length - 1].id : "";
  }

  function setEditorStatus(text) {
    if (editorStatusEl) editorStatusEl.textContent = text;
  }

  function setSyncStatus(text) {
    if (syncStatusEl) syncStatusEl.textContent = text;
  }

  function scheduleDraftSave() {
    window.clearTimeout(scheduleDraftSave.timerId);
    scheduleDraftSave.timerId = window.setTimeout(() => {
      saveDraft();
      if (getAutoSync()) scheduleSync();
    }, 180);
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(state));
      setEditorStatus("草稿已保存到本地");
    } catch (_error) {
      setEditorStatus("本地草稿保存失败");
    }
  }
  scheduleDraftSave.timerId = 0;

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return sanitizeData(parsed);
    } catch (_error) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function renderEditor() {
    ensureSelectedSession();
    const selected = getSelectedSession();
    editorRoot.innerHTML = "";

    const wrapper = el("div", "card tg-editor");
    const topTitle = el("h3", "", "Tainted Grail Session Editor");
    topTitle.style.marginTop = "0";
    wrapper.appendChild(topTitle);

    editorStatusEl = el("div", "tg-editor-status", "就绪");
    wrapper.appendChild(editorStatusEl);

    const toolbar = el("div", "tg-editor-toolbar");
    const sessionSelectLabel = el("label", "", "编辑 Session");
    const sessionSelect = el("select");
    const sorted = deepClone(state.sessions);
    sortSessions(sorted);
    sorted.forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = `Session ${String(session.sessionNo).padStart(2, "0")} - ${formatDateDisplay(session.date)}`;
      if (session.id === selectedSessionId) option.selected = true;
      sessionSelect.appendChild(option);
    });
    sessionSelect.addEventListener("change", () => {
      selectedSessionId = sessionSelect.value;
      renderEditor();
    });
    sessionSelectLabel.appendChild(sessionSelect);
    toolbar.appendChild(sessionSelectLabel);

    const cloneLatestBtn = el("button", "", "新增 Session（复制最新）");
    cloneLatestBtn.type = "button";
    cloneLatestBtn.addEventListener("click", () => {
      createSession(true);
    });
    toolbar.appendChild(cloneLatestBtn);

    const emptyBtn = el("button", "", "新增 Session（仅题头）");
    emptyBtn.type = "button";
    emptyBtn.addEventListener("click", () => {
      createSession(false);
    });
    toolbar.appendChild(emptyBtn);

    const deleteBtn = el("button", "", "删除当前 Session");
    deleteBtn.type = "button";
    deleteBtn.addEventListener("click", () => {
      deleteCurrentSession();
    });
    toolbar.appendChild(deleteBtn);

    const saveBtn = el("button", "", "保存本地草稿");
    saveBtn.type = "button";
    saveBtn.addEventListener("click", () => saveDraft());
    toolbar.appendChild(saveBtn);

    const resetBtn = el("button", "", "重置为远程数据");
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => {
      const ok = window.confirm("确定清除本地草稿并恢复到远程文件内容吗？");
      if (!ok) return;
      clearDraft();
      if (sourceStateRaw) {
        state = sanitizeData(JSON.parse(sourceStateRaw));
        ensureSelectedSession();
        renderCampaign();
        renderEditor();
        setEditorStatus("已恢复远程数据");
      }
    });
    toolbar.appendChild(resetBtn);

    wrapper.appendChild(toolbar);

    const syncCfg = getStoredSyncConfig();
    const syncBox = el("div", "tg-editor-sync");

    const ownerInput = buildLabeledInput("Owner", syncCfg ? syncCfg.owner : "", false);
    const repoInput = buildLabeledInput("Repo", syncCfg ? syncCfg.repo : "", false);
    const branchInput = buildLabeledInput("Branch", syncCfg ? syncCfg.branch : "main", false);
    const pathInput = buildLabeledInput("File", syncCfg ? syncCfg.filePath : dataSource, false);

    syncBox.append(ownerInput.wrap, repoInput.wrap, branchInput.wrap, pathInput.wrap);

    [ownerInput.input, repoInput.input, branchInput.input, pathInput.input].forEach((inputEl) => {
      inputEl.addEventListener("input", () => {
        const nextCfg = readSyncInputs(ownerInput.input, repoInput.input, branchInput.input, pathInput.input);
        if (nextCfg) setStoredSyncConfig(nextCfg);
      });
    });

    const tokenBtn = el("button", "", getToken() ? "更新 GitHub Token" : "连接 GitHub Token");
    tokenBtn.type = "button";
    tokenBtn.addEventListener("click", () => {
      const current = getToken();
      const input = window.prompt("输入 GitHub PAT（需要 repo contents:write 权限）。留空表示断开。", current);
      if (input === null) return;
      setToken(String(input || "").trim());
      tokenBtn.textContent = getToken() ? "更新 GitHub Token" : "连接 GitHub Token";
      setSyncStatus(getToken() ? "GitHub 已连接，可同步" : "GitHub 未连接");
    });
    syncBox.appendChild(tokenBtn);

    const autoSyncLabel = el("label", "", "自动同步");
    const autoSyncInput = document.createElement("input");
    autoSyncInput.type = "checkbox";
    autoSyncInput.checked = getAutoSync();
    autoSyncInput.addEventListener("change", () => {
      setAutoSync(autoSyncInput.checked);
      setSyncStatus(autoSyncInput.checked ? "自动同步已开启" : "自动同步已关闭");
    });
    autoSyncLabel.appendChild(autoSyncInput);
    syncBox.appendChild(autoSyncLabel);

    const syncNowBtn = el("button", "", "立即同步到 GitHub");
    syncNowBtn.type = "button";
    syncNowBtn.addEventListener("click", () => {
      const cfg = readSyncInputs(ownerInput.input, repoInput.input, branchInput.input, pathInput.input);
      if (!cfg) {
        setSyncStatus("同步配置不完整");
        return;
      }
      setStoredSyncConfig(cfg);
      void syncNow(cfg, false);
    });
    syncBox.appendChild(syncNowBtn);

    syncStatusEl = el("div", "tg-editor-status", getToken() ? "GitHub 已连接，可同步" : "GitHub 未连接");

    wrapper.append(syncBox, syncStatusEl);

    const meta = el("div", "tg-editor-session-meta");
    const noInput = buildLabeledInput("Session No", selected ? String(selected.sessionNo) : "", true);
    const dateInput = buildLabeledInput("Date", selected ? selected.date : "", true);
    dateInput.input.type = "date";
    noInput.input.type = "number";
    noInput.input.min = "1";

    noInput.input.addEventListener("input", () => {
      const current = getSelectedSession();
      if (!current) return;
      const next = Number(noInput.input.value);
      if (next > 0) current.sessionNo = next;
      renderCampaign();
      scheduleDraftSave();
    });

    dateInput.input.addEventListener("input", () => {
      const current = getSelectedSession();
      if (!current) return;
      current.date = dateInput.input.value;
      renderCampaign();
      scheduleDraftSave();
    });

    meta.append(noInput.wrap, dateInput.wrap);
    wrapper.appendChild(meta);

    const grid = el("div", "tg-editor-grid");
    grid.appendChild(buildMenhirPanel(selected));
    grid.appendChild(buildTaskPanel(selected));
    grid.appendChild(buildLocationPanel(selected));
    grid.appendChild(buildNotesPanel(selected));

    wrapper.appendChild(grid);
    editorRoot.appendChild(wrapper);
  }

  function buildLabeledInput(labelText, value, readOnly) {
    const wrap = el("label", "", labelText);
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.readOnly = !!readOnly;
    wrap.appendChild(input);
    return { wrap, input };
  }

  function buildMenhirPanel(session) {
    const panel = el("div", "tg-editor-panel");
    panel.appendChild(el("h4", "", "Menhir（逐条追加）"));
    const list = el("div", "tg-item-list");

    (session ? session.menhirs : []).forEach((item, index) => {
      const row = el("div", "tg-item-row menhir");
      const loc = document.createElement("input");
      loc.value = item.location || "";
      const value = document.createElement("input");
      value.value = item.value || "";
      const dial = document.createElement("input");
      dial.value = item.dial || "";
      const del = el("button", "", "删");
      del.type = "button";

      loc.addEventListener("input", () => updateRow("menhirs", index, "location", loc.value));
      value.addEventListener("input", () => updateRow("menhirs", index, "value", value.value));
      dial.addEventListener("input", () => updateRow("menhirs", index, "dial", dial.value));
      del.addEventListener("click", () => removeRow("menhirs", index));

      row.append(loc, value, dial, del);
      list.appendChild(row);
    });

    const add = el("button", "", "+ 添加 Menhir");
    add.type = "button";
    add.addEventListener("click", () => {
      pushRow("menhirs", { location: "", value: "", dial: "" });
    });

    panel.append(list, add);
    return panel;
  }

  function buildTaskPanel(session) {
    const panel = el("div", "tg-editor-panel");
    panel.appendChild(el("h4", "", "任务（逐条追加）"));
    const list = el("div", "tg-item-list");

    (session ? session.tasks : []).forEach((item, index) => {
      const row = el("div", "tg-item-row");
      const tag = document.createElement("input");
      tag.value = item.tag || "";
      const text = document.createElement("input");
      text.value = item.text || "";
      const del = el("button", "", "删");
      del.type = "button";

      tag.addEventListener("input", () => updateRow("tasks", index, "tag", tag.value));
      text.addEventListener("input", () => updateRow("tasks", index, "text", text.value));
      del.addEventListener("click", () => removeRow("tasks", index));

      row.append(tag, text, del);
      list.appendChild(row);
    });

    const add = el("button", "", "+ 添加任务");
    add.type = "button";
    add.addEventListener("click", () => {
      pushRow("tasks", { tag: "", text: "" });
    });

    panel.append(list, add);
    return panel;
  }

  function buildLocationPanel(session) {
    const panel = el("div", "tg-editor-panel");
    panel.appendChild(el("h4", "", "地点变化（逐条追加）"));
    const list = el("div", "tg-item-list");

    (session ? session.locationChanges : []).forEach((item, index) => {
      const row = el("div", "tg-item-row move");
      const from = document.createElement("input");
      from.value = item.from || "";
      const to = document.createElement("input");
      to.value = item.to || "";
      const del = el("button", "", "删");
      del.type = "button";

      from.addEventListener("input", () => updateRow("locationChanges", index, "from", from.value));
      to.addEventListener("input", () => updateRow("locationChanges", index, "to", to.value));
      del.addEventListener("click", () => removeRow("locationChanges", index));

      row.append(from, to, del);
      list.appendChild(row);
    });

    const add = el("button", "", "+ 添加地点变化");
    add.type = "button";
    add.addEventListener("click", () => {
      pushRow("locationChanges", { from: "", to: "" });
    });

    panel.append(list, add);
    return panel;
  }

  function buildNotesPanel(session) {
    const panel = el("div", "tg-editor-panel");
    panel.appendChild(el("h4", "", "冒险笔记（逐条追加）"));
    const list = el("div", "tg-item-list");

    (session ? session.notes : []).forEach((item, index) => {
      const row = el("div", "tg-item-row note");
      const text = document.createElement("input");
      text.value = item || "";
      const del = el("button", "", "删");
      del.type = "button";

      text.addEventListener("input", () => updateNote(index, text.value));
      del.addEventListener("click", () => removeNote(index));

      row.append(text, del);
      list.appendChild(row);
    });

    const add = el("button", "", "+ 添加冒险笔记");
    add.type = "button";
    add.addEventListener("click", () => {
      pushNote("");
    });

    panel.append(list, add);
    return panel;
  }

  function updateRow(section, index, key, value) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session[section]) || !session[section][index]) return;
    session[section][index][key] = value;
    renderCampaign();
    scheduleDraftSave();
  }

  function removeRow(section, index) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session[section])) return;
    session[section].splice(index, 1);
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
  }

  function pushRow(section, row) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session[section])) return;
    session[section].push(row);
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
  }

  function updateNote(index, value) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session.notes) || index < 0 || index >= session.notes.length) return;
    session.notes[index] = value;
    renderCampaign();
    scheduleDraftSave();
  }

  function removeNote(index) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session.notes)) return;
    session.notes.splice(index, 1);
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
  }

  function pushNote(value) {
    const session = getSelectedSession();
    if (!session || !Array.isArray(session.notes)) return;
    session.notes.push(value);
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
  }

  function createSession(copyLatest) {
    let sessionNo = 1;
    state.sessions.forEach((session) => {
      sessionNo = Math.max(sessionNo, Number(session.sessionNo || 0) + 1);
    });

    let next = {
      id: uid("tg-session"),
      sessionNo,
      date: todayIso(),
      menhirs: [],
      tasks: [],
      locationChanges: [],
      notes: [],
    };

    if (copyLatest && state.sessions.length) {
      const sorted = deepClone(state.sessions);
      sortSessions(sorted);
      const latest = sorted[sorted.length - 1];
      next = {
        id: uid("tg-session"),
        sessionNo,
        date: todayIso(),
        menhirs: deepClone(latest.menhirs || []),
        tasks: deepClone(latest.tasks || []),
        locationChanges: deepClone(latest.locationChanges || []),
        notes: deepClone(latest.notes || []),
      };
    }

    state.sessions.push(next);
    selectedSessionId = next.id;
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
    setEditorStatus(copyLatest ? "已复制最新 Session，可继续逐条追加/修改" : "已创建空 Session（仅题头）");
  }

  function deleteCurrentSession() {
    const current = getSelectedSession();
    if (!current) return;
    const ok = window.confirm(`确定删除 Session ${String(current.sessionNo).padStart(2, "0")} 吗？`);
    if (!ok) return;
    state.sessions = state.sessions.filter((session) => session.id !== current.id);
    ensureSelectedSession();
    renderCampaign();
    renderEditor();
    scheduleDraftSave();
    setEditorStatus("当前 Session 已删除");
  }

  function readSyncInputs(ownerInput, repoInput, branchInput, pathInput) {
    const raw = {
      provider: "github",
      owner: ownerInput.value,
      repo: repoInput.value,
      branch: branchInput.value || "main",
      filePath: pathInput.value || dataSource,
    };
    return normalizeSyncConfig(raw);
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
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

  async function fetchRemoteSha(cfg, token) {
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
    const payload = await response.json();
    if (!payload || typeof payload.sha !== "string") throw new Error("GitHub response missing file SHA");
    return payload.sha;
  }

  async function syncNow(cfg, isAuto) {
    const token = getToken();
    if (!token) {
      setSyncStatus("GitHub token 缺失");
      return;
    }
    if (!cfg) {
      setSyncStatus("同步配置不完整");
      return;
    }
    if (syncInFlight) return;

    const text = `${JSON.stringify(state, null, 2)}\n`;
    const nextHash = quickHash(text);
    if (isAuto && nextHash === lastSyncedHash) return;

    syncInFlight = true;
    setSyncStatus(isAuto ? "自动同步中..." : "正在同步到 GitHub...");

    try {
      const sha = await fetchRemoteSha(cfg, token);
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}`;
      const now = new Date();
      const message = `update tainted grail sessions ${now.toISOString().slice(0, 19)}Z`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          content: encodeBase64Utf8(text),
          branch: cfg.branch,
          sha,
        }),
      });
      if (!response.ok) throw new Error(`GitHub write failed (${response.status})`);

      lastSyncedHash = nextHash;
      const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setSyncStatus(`GitHub 已同步 (${at})`);
      setEditorStatus("已提交到 GitHub");
    } catch (error) {
      const message = error && error.message ? error.message : "同步失败";
      setSyncStatus(message);
    } finally {
      syncInFlight = false;
    }
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      const cfg = getStoredSyncConfig();
      if (!cfg) return;
      void syncNow(cfg, true);
    }, 2400);
  }

  async function loadInitialData() {
    let remoteData = { campaign: {}, sessions: [] };
    try {
      const response = await fetch(`${dataSource}?v=20260228`);
      if (!response.ok) throw new Error("fetch failed");
      remoteData = sanitizeData(await response.json());
    } catch (_error) {
      remoteData = sanitizeData({
        campaign: {
          title: "The Fall of Avalon",
          startedOn: "",
          summary: "",
        },
        sessions: [],
      });
    }

    sourceStateRaw = JSON.stringify(remoteData);
    const draftData = loadDraft();
    state = draftData || remoteData;

    ensureSelectedSession();
    renderCampaign();
    renderEditor();

    if (draftData) {
      setEditorStatus("已加载本地草稿（可直接继续编辑）");
    }
  }

  void loadInitialData();
})();
