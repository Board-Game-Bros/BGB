// Tainted Grail sessions: history + inline new-session editor.
(() => {
  const root = document.getElementById("tg-campaign-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "assets/data/tainted_grail_foa_sessions.json");
  const syncConfig = normalizeSyncConfig(window.TG_FOA_SYNC || {});

  const draftKey = "bgb_tg_foa_sessions_draft_v3";
  const tokenKey = "bgb_github_sync_token_v1";
  const editUnlockKey = "bgb_tg_edit_unlocked_v1";

  let state = { campaign: {}, sessions: [], draftSession: null };
  let editingSessionId = "";
  let syncStatusNode = null;
  let pageStatusNode = null;
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
    return { owner, repo, branch, filePath };
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

  function isEditUnlocked() {
    try {
      return localStorage.getItem(editUnlockKey) === "1";
    } catch (_error) {
      return false;
    }
  }

  function setEditUnlocked(next) {
    try {
      localStorage.setItem(editUnlockKey, next ? "1" : "0");
    } catch (_error) {
      // Ignore.
    }
  }

  function getToken() {
    try {
      return String(localStorage.getItem(tokenKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function setPageStatus(text) {
    if (pageStatusNode) pageStatusNode.textContent = text;
  }

  function setSyncStatus(text) {
    if (syncStatusNode) syncStatusNode.textContent = text;
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

  function canEditNow() {
    return isEditUnlocked();
  }

  function createDraftSession() {
    if (!canEditNow()) {
      setPageStatus("当前为锁定状态，先点 Edit Lock 解锁");
      return;
    }
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
      locationChanges: latest ? deepClone(latest.locationChanges || []) : [],
      notes: latest ? deepClone(latest.notes || []) : [],
    };
    saveDraft();
    render();
    setPageStatus("已创建 New Session，可逐条追加");
  }

  function discardDraftSession() {
    if (!canEditNow()) return;
    state.draftSession = null;
    saveDraft();
    render();
    setPageStatus("已取消 New Session");
  }

  function appendDraftToHistory() {
    if (!canEditNow()) return;
    const d = state.draftSession;
    if (!d) return;
    state.sessions.push(deepClone(d));
    sortSessions(state.sessions);
    state.draftSession = null;
    saveDraft();
    render();
    setPageStatus("New Session 已追加到历史");
  }

  function getSessionById(sessionId) {
    return state.sessions.find((s) => s.id === sessionId) || null;
  }

  function startEditSession(sessionId) {
    if (!canEditNow()) {
      setPageStatus("当前为锁定状态，先点 Edit Lock 解锁");
      return;
    }
    if (!getSessionById(sessionId)) return;
    editingSessionId = sessionId;
    saveDraft();
    render();
    setPageStatus("已进入 Session 编辑模式");
  }

  function stopEditSession() {
    editingSessionId = "";
    saveDraft();
    render();
    setPageStatus("已退出 Session 编辑模式");
  }

  function deleteEditingSession() {
    if (!canEditNow() || !editingSessionId) return;
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((s) => s.id !== editingSessionId);
    if (state.sessions.length === before) return;
    editingSessionId = "";
    saveDraft();
    render();
    setPageStatus("Session 已删除");
  }

  function updateSessionField(sessionId, key, value) {
    if (!canEditNow()) return;
    const target = getSessionById(sessionId);
    if (!target) return;
    target[key] = value;
    saveDraft();
    render();
  }

  function addSessionRow(sessionId, section, row) {
    if (!canEditNow()) return;
    const target = getSessionById(sessionId);
    if (!target || !Array.isArray(target[section])) return;
    target[section].push(row);
    saveDraft();
    render();
  }

  function deleteSessionRow(sessionId, section, index) {
    if (!canEditNow()) return;
    const target = getSessionById(sessionId);
    if (!target || !Array.isArray(target[section])) return;
    target[section].splice(index, 1);
    saveDraft();
    render();
  }

  function updateSessionRow(sessionId, section, index, key, value) {
    if (!canEditNow()) return;
    const target = getSessionById(sessionId);
    if (!target || !Array.isArray(target[section])) return;
    const row = target[section][index];
    if (!row || typeof row !== "object") return;
    row[key] = value;
    saveDraft();
  }

  function updateSessionNote(sessionId, index, value) {
    if (!canEditNow()) return;
    const target = getSessionById(sessionId);
    if (!target || !Array.isArray(target.notes)) return;
    target.notes[index] = value;
    saveDraft();
  }

  function updateDraftField(key, value) {
    if (!canEditNow() || !state.draftSession) return;
    state.draftSession[key] = value;
    saveDraft();
    render();
  }

  function addDraftRow(section, row) {
    if (!canEditNow() || !state.draftSession || !Array.isArray(state.draftSession[section])) return;
    state.draftSession[section].push(row);
    saveDraft();
    render();
  }

  function deleteDraftRow(section, index) {
    if (!canEditNow() || !state.draftSession || !Array.isArray(state.draftSession[section])) return;
    state.draftSession[section].splice(index, 1);
    saveDraft();
    render();
  }

  function updateDraftRow(section, index, key, value) {
    if (!canEditNow() || !state.draftSession || !Array.isArray(state.draftSession[section])) return;
    const row = state.draftSession[section][index];
    if (!row || typeof row !== "object") return;
    row[key] = value;
    saveDraft();
  }

  function updateDraftNote(index, value) {
    if (!canEditNow() || !state.draftSession || !Array.isArray(state.draftSession.notes)) return;
    state.draftSession.notes[index] = value;
    saveDraft();
  }

  function renderSessionReadOnly(session) {
    const wrap = el("div", "session");
    const header = el("div", "session-header");
    header.appendChild(el("h4", "session-title", `Session ${String(session.sessionNo).padStart(2, "0")} - ${fmtDate(session.date)}`));
    const actions = el("div", "tg-draft-head");
    const editBtn = el("button", "tg-add-btn", "Edit");
    editBtn.type = "button";
    editBtn.disabled = !canEditNow() || !!state.draftSession || !!editingSessionId;
    editBtn.addEventListener("click", () => startEditSession(session.id));
    actions.appendChild(editBtn);
    header.appendChild(actions);
    wrap.appendChild(header);
    wrap.appendChild(renderMenhirBlock(session, false, null));
    wrap.appendChild(renderTasksBlock(session, false, null));
    wrap.appendChild(renderLocationBlock(session, false, null));
    wrap.appendChild(renderNotesBlock(session, false, null));
    return wrap;
  }

  function renderSessionEditable(session, options) {
    const isDraft = !!(options && options.isDraft);
    const locked = !canEditNow();
    const wrap = el("div", "session tg-draft-session");
    const header = el("div", "session-header");
    const title = el("h4", "session-title", isDraft ? "New Session" : `Edit Session ${String(session.sessionNo).padStart(2, "0")}`);
    const controls = el("div", "tg-draft-head");
    const setField = (key, value) => {
      if (isDraft) updateDraftField(key, value);
      else updateSessionField(session.id, key, value);
    };
    const addRow = (section, row) => {
      if (isDraft) addDraftRow(section, row);
      else addSessionRow(session.id, section, row);
    };
    const deleteRow = (section, index) => {
      if (isDraft) deleteDraftRow(section, index);
      else deleteSessionRow(session.id, section, index);
    };
    const updateRow = (section, index, key, value) => {
      if (isDraft) updateDraftRow(section, index, key, value);
      else updateSessionRow(session.id, section, index, key, value);
    };
    const updateNote = (index, value) => {
      if (isDraft) updateDraftNote(index, value);
      else updateSessionNote(session.id, index, value);
    };
    const handlers = {
      locked,
      addRow,
      deleteRow,
      updateRow,
      updateNote,
    };

    const noLabel = el("label", "tg-mini-label", "No");
    const noInput = document.createElement("input");
    noInput.type = "number";
    noInput.min = "1";
    noInput.value = String(session.sessionNo || getNextSessionNo());
    noInput.disabled = locked;
    noInput.addEventListener("input", () => {
      const next = Number(noInput.value);
      if (next > 0) setField("sessionNo", next);
    });
    noLabel.appendChild(noInput);

    const dateLabel = el("label", "tg-mini-label", "Date");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = session.date || todayIso();
    dateInput.disabled = locked;
    dateInput.addEventListener("input", () => {
      setField("date", dateInput.value);
    });
    dateLabel.appendChild(dateInput);

    controls.append(noLabel, dateLabel);
    header.append(title, controls);
    wrap.appendChild(header);

    wrap.appendChild(renderMenhirBlock(session, true, handlers));
    wrap.appendChild(renderTasksBlock(session, true, handlers));
    wrap.appendChild(renderLocationBlock(session, true, handlers));
    wrap.appendChild(renderNotesBlock(session, true, handlers));

    const actions = el("div", "tg-draft-actions");
    if (isDraft) {
      const appendBtn = el("button", "tg-add-btn", "Append To History");
      appendBtn.type = "button";
      appendBtn.disabled = locked;
      appendBtn.addEventListener("click", appendDraftToHistory);

      const cancelBtn = el("button", "tg-add-btn", "Cancel");
      cancelBtn.type = "button";
      cancelBtn.disabled = locked;
      cancelBtn.addEventListener("click", discardDraftSession);
      actions.append(appendBtn, cancelBtn);
    } else {
      const doneBtn = el("button", "tg-add-btn", "Done");
      doneBtn.type = "button";
      doneBtn.disabled = locked;
      doneBtn.addEventListener("click", stopEditSession);

      const deleteBtn = el("button", "tg-add-btn", "Delete Session");
      deleteBtn.type = "button";
      deleteBtn.disabled = locked;
      deleteBtn.addEventListener("click", deleteEditingSession);
      actions.append(doneBtn, deleteBtn);
    }
    wrap.appendChild(actions);

    return wrap;
  }

  function renderMenhirBlock(session, editable, handlers) {
    const locked = handlers ? !!handlers.locked : !canEditNow();
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
      loc.disabled = locked;
      loc.addEventListener("input", () => handlers.updateRow("menhirs", index, "location", loc.value));

      const val = document.createElement("input");
      val.className = "tg-edit-input";
      val.value = row.value || "";
      val.placeholder = "Value";
      val.disabled = locked;
      val.addEventListener("input", () => handlers.updateRow("menhirs", index, "value", val.value));

      const dial = document.createElement("input");
      dial.className = "tg-edit-input";
      dial.value = row.dial || "";
      dial.placeholder = "Dial";
      dial.disabled = locked;
      dial.addEventListener("input", () => handlers.updateRow("menhirs", index, "dial", dial.value));

      const del = el("button", "tg-inline-del", "×");
      del.type = "button";
      del.disabled = locked;
      del.addEventListener("click", () => handlers.deleteRow("menhirs", index));

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
      add.disabled = locked;
      add.addEventListener("click", () => handlers.addRow("menhirs", { location: "", value: "", dial: "" }));
      block.appendChild(add);
    }

    return block;
  }

  function renderTasksBlock(session, editable, handlers) {
    const locked = handlers ? !!handlers.locked : !canEditNow();
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
      tag.disabled = locked;
      tag.addEventListener("input", () => handlers.updateRow("tasks", index, "tag", tag.value));

      const text = document.createElement("input");
      text.className = "tg-edit-input";
      text.value = row.text || "";
      text.placeholder = "Task";
      text.disabled = locked;
      text.addEventListener("input", () => handlers.updateRow("tasks", index, "text", text.value));

      const del = el("button", "tg-inline-del", "×");
      del.type = "button";
      del.disabled = locked;
      del.addEventListener("click", () => handlers.deleteRow("tasks", index));

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
      add.disabled = locked;
      add.addEventListener("click", () => handlers.addRow("tasks", { tag: "", text: "" }));
      block.appendChild(add);
    }
    return block;
  }

  function renderLocationBlock(session, editable, handlers) {
    const locked = handlers ? !!handlers.locked : !canEditNow();
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
      from.disabled = locked;
      from.addEventListener("input", () => handlers.updateRow("locationChanges", index, "from", from.value));

      const to = document.createElement("input");
      to.className = "tg-edit-input";
      to.value = row.to || "";
      to.placeholder = "To";
      to.disabled = locked;
      to.addEventListener("input", () => handlers.updateRow("locationChanges", index, "to", to.value));

      const del = el("button", "tg-inline-del", "×");
      del.type = "button";
      del.disabled = locked;
      del.addEventListener("click", () => handlers.deleteRow("locationChanges", index));

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
      add.disabled = locked;
      add.addEventListener("click", () => handlers.addRow("locationChanges", { from: "", to: "" }));
      block.appendChild(add);
    }
    return block;
  }

  function renderNotesBlock(session, editable, handlers) {
    const locked = handlers ? !!handlers.locked : !canEditNow();
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
      input.disabled = locked;
      input.addEventListener("input", () => handlers.updateNote(index, input.value));

      const del = el("button", "tg-inline-del", "×");
      del.type = "button";
      del.disabled = locked;
      del.addEventListener("click", () => handlers.deleteRow("notes", index));

      noteWrap.append(input, del);
      list.appendChild(noteWrap);
    });

    block.appendChild(list);
    if (editable) {
      const add = el("button", "tg-add-btn", "+ Note");
      add.type = "button";
      add.disabled = locked;
      add.addEventListener("click", () => handlers.addRow("notes", ""));
      block.appendChild(add);
    }

    return block;
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
    if (!res.ok) throw new Error(`Sync read failed (${res.status})`);
    const payload = await res.json();
    if (!payload || typeof payload.sha !== "string") throw new Error("Sync read payload invalid");
    return payload.sha;
  }

  async function syncNow() {
    if (syncInFlight) return;
    if (!syncConfig) {
      setSyncStatus("Sync 配置无效");
      return;
    }

    const token = getToken();
    if (!token) {
      setSyncStatus("Sync 未连接");
      return;
    }

    const content = `${JSON.stringify(getPersistablePayload(), null, 2)}\n`;
    const nextHash = quickHash(content);
    if (nextHash === lastSyncedHash) {
      setSyncStatus("无需同步");
      return;
    }

    syncInFlight = true;
    setSyncStatus("同步中...");

    try {
      const sha = await fetchRemoteSha(syncConfig, token);
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(syncConfig.owner)}/${encodeURIComponent(syncConfig.repo)}/contents/${encodeURIComponent(syncConfig.filePath).replace(/%2F/g, "/")}`;
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
          branch: syncConfig.branch,
          sha,
        }),
      });
      if (!res.ok) throw new Error(`Sync write failed (${res.status})`);
      lastSyncedHash = nextHash;
      setSyncStatus(`已同步 (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`);
    } catch (error) {
      setSyncStatus(error && error.message ? error.message : "同步失败");
    } finally {
      syncInFlight = false;
    }
  }

  function renderControlBar(host) {
    const bar = el("div", "tg-sync-bar");

    const lockBtn = el("button", "tg-add-btn", isEditUnlocked() ? "Edit Unlocked" : "Edit Locked");
    lockBtn.type = "button";
    lockBtn.addEventListener("click", () => {
      const next = !isEditUnlocked();
      setEditUnlocked(next);
      render();
      setPageStatus(next ? "编辑已解锁" : "编辑已锁定");
    });

    const syncBtn = el("button", "tg-add-btn", "Sync");
    syncBtn.type = "button";
    syncBtn.addEventListener("click", () => {
      void syncNow();
    });

    syncStatusNode = el("div", "tg-page-status", getToken() ? "Sync Ready" : "Sync 未连接");
    bar.append(lockBtn, syncBtn, syncStatusNode);
    host.appendChild(bar);
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
    sorted.forEach((s) => {
      if (editingSessionId && s.id === editingSessionId) {
        logsCard.appendChild(renderSessionEditable(s, { isDraft: false }));
      } else {
        logsCard.appendChild(renderSessionReadOnly(s));
      }
    });

    const newBtnWrap = el("div", "tg-new-session-wrap");
    const newBtn = el("button", "tg-add-btn tg-new-session-btn", "+ New Session");
    newBtn.type = "button";
    newBtn.disabled = !!state.draftSession || !!editingSessionId || !canEditNow();
    newBtn.addEventListener("click", createDraftSession);
    newBtnWrap.appendChild(newBtn);
    logsCard.appendChild(newBtnWrap);

    if (state.draftSession) {
      logsCard.appendChild(renderSessionEditable(state.draftSession, { isDraft: true }));
    }

    pageStatusNode = el("div", "tg-page-status", canEditNow() ? "编辑已解锁" : "编辑已锁定");
    logsCard.appendChild(pageStatusNode);

    renderControlBar(logsCard);

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

    const draft = loadDraft();
    state = draft || remoteData;
    render();
    if (draft) setPageStatus("已加载本地草稿");
  }

  void init();
})();

