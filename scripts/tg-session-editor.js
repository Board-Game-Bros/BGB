// Tainted Grail sessions: history + inline new-session editor.
(() => {
  const root = document.getElementById("tg-campaign-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "/assets/data/tainted_grail_foa_sessions.json");
  const syncConfig = normalizeSyncConfig(window.TG_FOA_SYNC || {});
  const configuredEditPassword = String(window.TG_FOA_EDIT_PASSWORD || "").trim();
  const editPassword = String(configuredEditPassword || "bgbzhangyan2026");
  const requireEditPassword = editPassword.length > 0;

  const draftKey = "bgb_tg_foa_sessions_draft_v4";
  const legacyDraftKey = "bgb_tg_foa_sessions_draft_v3";
  const staleDraftBackupKey = `${draftKey}__stale_backup_v1`;
  const localStateEnvelope = window.BGBLocalStateEnvelope && typeof window.BGBLocalStateEnvelope === "object"
    ? window.BGBLocalStateEnvelope
    : null;
  const useLocalDraft = true;
  const tokenKey = "bgb_github_sync_token_v1";

  let state = { campaign: {}, sessions: [], statuses: [], draftSession: null };
  let editingSessionId = "";
  let editGateStatusNode = null;
  let syncStatusNode = null;
  let syncButtonNode = null;
  let lockButtonNode = null;
  let pageStatusNode = null;
  let editUnlocked = !requireEditPassword;
  let syncInFlight = false;
  let syncQueued = false;
  let lastSyncedHash = "";
  let sourcePersistHashAtLoad = "";

  function buildDefaultStatuses() {
    const make = (name, size, numbered, note) => ({
      name: String(name || ""),
      note: String(note || ""),
      slots: Array.from({ length: Math.max(0, Number(size) || 0) }, (_v, i) => ({
        label: numbered ? String(i + 1) : "",
        owned: false,
      })),
    });
    return [
      make("Allies of Avalon", 5, true),
      make("Black Cauldron", 3, true),
      make("Burning Mystery", 9, true),
      make("Call from Beyond", 1, false),
      make("Charred Knowledge", 1, false),
      make("Cherished Belongings", 1, false),
      make("Cold Pyre", 1, false),
      make("Cosuil", 5, true),
      make("Deal Breaker", 1, false),
      make("Deep Secret", 1, false),
      make("Diplomat", 3, true),
      make("Diplomatic Mission", 6, true),
      make("Disturbing Information", 3, true),
      make("Dreams and Prophecies", 8, true),
      make("End of the Road", 1, false),
      make("Enemies of Avalon", 3, true),
      make("Escalation", 3, true),
      make("Fael's Legacy", 1, false),
      make("Fall of Chivalry", 8, true, "When you have any six parts of this status, go to BoS, Verse 525."),
      make("Farpoint Clues", 5, true),
      make("Fate of the Expedition", 9, true, "When you have parts 1-8 of this status, go to BoS, Verse 405."),
      make("Final Confrontations", 7, true),
      make("Final Lesson", 5, true),
      make("Fortunate Meetings", 5, true),
      make("General Directions", 1, false),
      make("Gerraint's Successor", 3, true),
      make("Glen Ritual", 2, true),
      make("Guest of Honor", 1, false),
      make("Halfway Intrigue", 3, true),
      make("Helping Hand", 6, true),
      make("Helping the Knights", 4, false),
      make("Hidden Treasures", 8, true),
      make("Hunter's Mark", 1, false),
      make("Lady's Task", 1, false),
      make("Last Haven", 5, true),
      make("Left Behind", 9, true),
      make("Lost and Fallen", 7, true),
      make("Maggot's Redemption", 1, false),
      make("Matricide", 1, false),
      make("Monastery Discovered", 1, false),
      make("Moonring Mission", 1, false),
      make("Morgaine's Task", 1, false),
      make("Mourning Song", 2, true),
      make("Mystery Solved", 1, false),
      make("Pathfinder", 8, true),
      make("Peace in Borough", 1, false),
      make("People's Champion", 1, false),
      make("Pillager", 5, true),
      make("Reclamation", 1, false),
      make("Redemption", 5, false),
      make("Remedy", 4, true),
      make("Remnants", 5, true),
      make("Restoring the Order", 8, true, "When you have any six parts of this status, go to BoS, Verse 512."),
      make("Riddle of the Oldsteel", 1, false),
      make("Saved by the Goddess", 1, false),
      make("Scrounger", 1, false),
      make("Secrets of the Forest", 4, true),
      make("Shelter in the Storm", 1, false),
      make("Shrine Secure", 1, false),
      make("Something is Watching", 4, false, "When you have all four parts of this status, resolve Special Event C."),
      make("Stonemason's Secret", 1, false),
      make("Strange Encounters", 8, true),
      make("Supplying the Revolt", 4, false),
      make("Tangleroot Knowledge", 2, true),
      make("Tracker", 1, false),
      make("Traveler", 3, true),
      make("Traveling Menhir", 2, true),
      make("Tuathan Exploration", 5, false),
      make("Underfern", 5, true),
      make("War for Avalon", 4, true),
      make("Winds of Wyrdness", 1, false),
    ];
  }

  const defaultStatuses = buildDefaultStatuses();
  const statusZhMap = {
    "Allies of Avalon": "阿瓦隆之友",
    "Black Cauldron": "神锅",
    "Burning Mystery": "奥秘",
    "Call from Beyond": "遥远的呼唤",
    "Charred Knowledge": "烧焦的知识",
    "Cherished Belongings": "珍重之物",
    "Cold Pyre": "寒焰余烬",
    Cosuil: "科绥尔",
    "Deal Breaker": "毁约",
    "Deep Secret": "深层秘密",
    Diplomat: "外交官",
    "Diplomatic Mission": "外交任务",
    "Disturbing Information": "扰人的消息",
    "Dreams and Prophecies": "梦境与预言",
    "End of the Road": "旅途的终点",
    "Enemies of Avalon": "阿瓦隆之敌",
    Escalation: "提升",
    "Fael's Legacy": "法埃尔的遗产",
    "Fall of Chivalry": "骑士的陨落",
    "Farpoint Clues": "海崖的线索",
    "Fate of the Expedition": "远征的命运",
    "Final Confrontations": "最后的冲突",
    "Final Lesson": "最后一课",
    "Fortunate Meetings": "幸运的会面",
    "General Directions": "大致方向",
    "Gerraint's Successor": "杰兰特的继任者",
    "Glen Ritual": "峡谷的仪式",
    "Guest of Honor": "贵宾",
    "Halfway Intrigue": "半路阴谋",
    "Helping Hand": "帮手",
    "Helping the Knights": "帮助骑士",
    "Hidden Treasures": "秘宝",
    "Hunter's Mark": "猎人的印记",
    "Lady's Task": "女士的任务",
    "Last Haven": "最后的避难所",
    "Left Behind": "遗留",
    "Lost and Fallen": "迷失与陨落",
    "Maggot's Redemption": "蛆虫的救赎",
    Matricide: "弑母",
    "Monastery Discovered": "发现修道院",
    "Moonring Mission": "月环任务",
    "Morgaine's Task": "莫盖恩的任务",
    "Mourning Song": "哀悼曲",
    "Mystery Solved": "真案",
    Pathfinder: "探路者",
    "Peace in Borough": "城区安宁",
    "People's Champion": "人民英雄",
    Pillager: "掠夺者",
    Reclamation: "收回",
    Redemption: "救赎",
    Remedy: "解药",
    Remnants: "残余",
    "Restoring the Order": "重建骑士团",
    "Riddle of the Oldsteel": "古钢的谜题",
    "Saved by the Goddess": "天母的拯救",
    Scrounger: "拾荒者",
    "Secrets of the Forest": "森林的秘密",
    "Shelter in the Storm": "暴风避难",
    "Shrine Secure": "圣殿的安危",
    "Something is Watching": "某物在观察",
    "Stonemason's Secret": "石匠的秘密",
    "Strange Encounters": "怪异的遭遇",
    "Supplying the Revolt": "支援叛乱",
    "Tangleroot Knowledge": "盘根树林知识",
    Tracker: "追踪者",
    Traveler: "旅者",
    "Traveling Menhir": "旅行的巨神柱",
    "Tuathan Exploration": "图瓦坦探索",
    Underfern: "蕨海洞穴",
    "War for Avalon": "阿瓦隆战争",
    "Winds of Wyrdness": "诡异之风",
  };
  const statusNoteZhMap = {
    "When you have any six parts of this status, go to BoS, Verse 525.": "当你获得该状态任意 6 个部分时，前往 BoS 第 525 段。",
    "When you have parts 1-8 of this status, go to BoS, Verse 405.": "当你获得该状态第 1-8 部分时，前往 BoS 第 405 段。",
    "When you have any six parts of this status, go to BoS, Verse 512.": "当你获得该状态任意 6 个部分时，前往 BoS 第 512 段。",
    "When you have all four parts of this status, resolve Special Event C.": "当你获得该状态全部 4 个部分时，结算特殊事件 C。",
  };

  function sanitizeStatusRows(rawRows) {
    const defaults = deepClone(defaultStatuses);
    const incoming = Array.isArray(rawRows) ? rawRows : [];
    const incomingByName = new Map();

    incoming.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const name = String(row.name || "").trim();
      if (!name) return;
      incomingByName.set(name, row);
    });

    const normalized = defaults.map((template) => {
      const source = incomingByName.get(template.name) || {};
      const sourceSlots = Array.isArray(source.slots) ? source.slots : [];
      const slots = template.slots.map((slotTemplate, idx) => {
        const sourceSlot = sourceSlots[idx] && typeof sourceSlots[idx] === "object" ? sourceSlots[idx] : null;
        return {
          label: sourceSlot && String(sourceSlot.label || "").trim()
            ? String(sourceSlot.label || "").trim()
            : String(slotTemplate.label || ""),
          owned: !!(sourceSlot && (sourceSlot.owned || sourceSlot.checked)),
        };
      });
      return {
        name: template.name,
        note: String((source && source.note) || template.note || ""),
        slots,
      };
    });

    incoming.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const name = String(row.name || "").trim();
      if (!name) return;
      if (defaults.some((d) => d.name === name)) return;
      const sourceSlots = Array.isArray(row.slots) ? row.slots : [];
      const slots = sourceSlots.map((slot) => {
        const safeSlot = slot && typeof slot === "object" ? slot : {};
        return {
          label: String(safeSlot.label || "").trim(),
          owned: !!(safeSlot.owned || safeSlot.checked),
        };
      });
      normalized.push({
        name,
        note: String(row.note || "").trim(),
        slots,
      });
    });

    return normalized;
  }

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
      statuses: sanitizeStatusRows(safe.statuses),
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
    return editUnlocked;
  }

  function setEditUnlocked(next) {
    editUnlocked = !!next;
  }

  function getToken() {
    try {
      return String(localStorage.getItem(tokenKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function setToken(nextToken) {
    try {
      if (nextToken) localStorage.setItem(tokenKey, nextToken);
      else localStorage.removeItem(tokenKey);
    } catch (_error) {
      // Ignore.
    }
  }

  function getSyncConfigLabel() {
    if (!syncConfig) return "";
    return `${syncConfig.owner}/${syncConfig.repo}:${syncConfig.branch}`;
  }

  function setPageStatus(text) {
    if (pageStatusNode) pageStatusNode.textContent = text;
  }

  function setSyncStatus(text) {
    if (syncStatusNode) syncStatusNode.textContent = text;
  }

  function setEditGateStatus(text) {
    if (editGateStatusNode) editGateStatusNode.textContent = text;
  }

  function refreshEditGateUi() {
    if (lockButtonNode) {
      lockButtonNode.textContent = isEditUnlocked() ? "Lock Edit" : "Edit Page";
    }
    setEditGateStatus(isEditUnlocked() ? "Edit unlocked" : "Edit locked");
  }

  function refreshSyncUi(textOverride) {
    const hasToken = !!getToken();
    if (syncButtonNode) {
      syncButtonNode.textContent = hasToken ? "Host Sync Connected" : "Connect Host Sync";
    }
    if (textOverride) {
      setSyncStatus(textOverride);
      return;
    }
    if (!syncConfig) {
      setSyncStatus("Host sync config invalid");
      return;
    }
    if (!hasToken) {
      setSyncStatus("Host sync not connected");
      return;
    }
    setSyncStatus(`Host sync ready (${getSyncConfigLabel()})`);
  }

  function openSyncPrompt() {
    if (!syncConfig) {
      refreshSyncUi("Host sync config invalid");
      return;
    }
    const existing = getToken();
    const input = window.prompt(
      [
        "Paste a Host Personal Access Token with repository content write access.",
        `Target: ${getSyncConfigLabel()} (${syncConfig.filePath})`,
        "Leave blank to disconnect sync.",
      ].join("\n"),
      existing
    );
    if (input === null) return;

    const nextToken = String(input).trim();
    setToken(nextToken);
    lastSyncedHash = getPersistableHash({
      campaign: deepClone(state.campaign),
      sessions: deepClone(state.sessions),
      statuses: deepClone(state.statuses),
    });
    if (nextToken) {
      refreshSyncUi("Host connected. Lock Edit or click Sync to upload.");
    } else {
      refreshSyncUi("Host sync disconnected");
    }
  }

  function handleSyncButtonClick() {
    if (!getToken()) {
      openSyncPrompt();
      return;
    }
    void syncNow();
  }

  function tryUnlockEdit() {
    if (!requireEditPassword) return true;
    const input = window.prompt("Enter edit password:");
    if (input === null) return false;
    if (input !== editPassword) {
      window.alert("Incorrect password.");
      return false;
    }
    return true;
  }

  function saveDraft() {
    if (useLocalDraft) {
      try {
        writeDraftEnvelope();
        setPageStatus("本地草稿已保存");
      } catch (_error) {
        setPageStatus("本地草稿保存失败");
      }
    }
  }

  function loadDraft() {
    if (!useLocalDraft) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsedEnvelope = localStateEnvelope && typeof localStateEnvelope.parseEnvelope === "function"
          ? localStateEnvelope.parseEnvelope(raw)
          : null;
        if (parsedEnvelope && parsedEnvelope.isEnvelope) {
          return {
            state: sanitizeData(parsedEnvelope.state),
            meta: {
              dirty: !!parsedEnvelope.meta.dirty,
              persistHash: String(parsedEnvelope.meta.persistHash || ""),
              sourcePersistHash: String(parsedEnvelope.sourceHash || ""),
            },
          };
        }
        const parsed = JSON.parse(raw);
        if (parsed && parsed.state && parsed.meta && typeof parsed.meta === "object") {
          return {
            state: sanitizeData(parsed.state),
            meta: {
              dirty: !!parsed.meta.dirty,
              persistHash: String(parsed.meta.persistHash || ""),
              sourcePersistHash: String(parsed.meta.sourcePersistHash || ""),
            },
          };
        }
      }

      const legacyRaw = localStorage.getItem(legacyDraftKey);
      if (!legacyRaw) return null;
      const legacyState = sanitizeData(JSON.parse(legacyRaw));
      if (!legacyState.draftSession) {
        clearLegacyDraft();
        return null;
      }

      const migrated = {
        state: legacyState,
        meta: {
          dirty: true,
          persistHash: "",
          sourcePersistHash: "",
        },
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(buildDraftEnvelope(migrated.state, { forceDirty: true })));
        clearLegacyDraft();
      } catch (_error) {
        // Ignore migration failure.
      }
      return migrated;
    } catch (_error) {
      return null;
    }
  }

  function canEditNow() {
    return isEditUnlocked();
  }

  function createDraftSession() {
    if (!canEditNow()) {
      setPageStatus("当前为锁定状态，先点 Edit Page 解锁");
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
      setPageStatus("当前为锁定状态，先点 Edit Page 解锁");
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
      const menhirLabel = `Menhir #${index + 1}`;
      if (!editable) {
        grid.appendChild(el("div", "tg-menhir-row", menhirLabel));
        grid.appendChild(el("div", "tg-menhir-cell", row.value || ""));
        grid.appendChild(el("div", "tg-menhir-cell", row.dial || ""));
        return;
      }

      const menhirName = el("span", "tg-edit-input", menhirLabel);

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
      locWrap.append(menhirName, del);
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

  function setStatusSlotVisual(slotButton, owned) {
    if (!slotButton) return;
    slotButton.classList.toggle("is-owned", !!owned);
    slotButton.setAttribute("aria-pressed", owned ? "true" : "false");
  }

  function toggleStatusSlot(statusIndex, slotIndex, slotButton) {
    if (!canEditNow()) {
      setPageStatus("当前为锁定状态，先点 Edit Page 解锁");
      return;
    }
    const rows = Array.isArray(state.statuses) ? state.statuses : [];
    const row = rows[statusIndex];
    if (!row || !Array.isArray(row.slots)) return;
    const slot = row.slots[slotIndex];
    if (!slot || typeof slot !== "object") return;
    slot.owned = !slot.owned;
    setStatusSlotVisual(slotButton, slot.owned);
    saveDraft();
  }

  function renderStatusBoard() {
    const block = el("div", "tg-block tg-status-board");
    block.appendChild(el("div", "tg-title", "状态"));

    const rows = sanitizeStatusRows(state.statuses);
    state.statuses = rows;
    const splitIndex = Math.ceil(rows.length / 2);
    const left = rows.slice(0, splitIndex);
    const right = rows.slice(splitIndex);

    const board = el("div", "tg-status-columns");
    const renderColumn = (list, offset) => {
      const col = el("div", "tg-status-col");
      list.forEach((row, localIndex) => {
        const rowIndex = offset + localIndex;
        const line = el("div", "tg-status-row");
        const main = el("div", "tg-status-row-main");
        const statusName = String(row.name || "");
        main.appendChild(el("span", "tg-status-name", statusZhMap[statusName] || statusName));
        const slotsWrap = el("div", "tg-status-slots");
        (row.slots || []).forEach((slot, slotIndex) => {
          const slotButton = document.createElement("button");
          slotButton.type = "button";
          slotButton.className = "tg-status-slot";
          slotButton.disabled = !canEditNow();
          slotButton.textContent = String((slot && slot.label) || "");
          setStatusSlotVisual(slotButton, !!(slot && slot.owned));
          slotButton.addEventListener("click", () => {
            toggleStatusSlot(rowIndex, slotIndex, slotButton);
          });
          slotsWrap.appendChild(slotButton);
        });
        main.appendChild(slotsWrap);
        line.appendChild(main);
        if (row.note) {
          const statusNote = String(row.note || "");
          line.appendChild(el("div", "tg-status-note", statusNoteZhMap[statusNote] || statusNote));
        }
        col.appendChild(line);
      });
      return col;
    };

    board.append(renderColumn(left, 0), renderColumn(right, splitIndex));
    block.appendChild(board);
    return block;
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function decodeBase64Utf8(base64Text) {
    const binary = atob(base64Text);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
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
      statuses: deepClone(state.statuses),
    };
  }

  function persistableText(payloadLike) {
    const payload = payloadLike && typeof payloadLike === "object"
      ? payloadLike
      : getPersistablePayload();
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  function getPersistableHash(payloadLike) {
    return quickHash(persistableText(payloadLike));
  }

  function parsePersistablePayload(text) {
    try {
      const parsed = sanitizeData(JSON.parse(String(text || "")));
      return {
        campaign: deepClone(parsed.campaign),
        sessions: deepClone(parsed.sessions),
        statuses: deepClone(parsed.statuses),
      };
    } catch (_error) {
      return null;
    }
  }

  function sessionMergeKey(session) {
    const safe = session && typeof session === "object" ? session : {};
    const id = String(safe.id || "").trim();
    if (id) return `id:${id}`;
    const no = Number(safe.sessionNo || 0);
    const date = String(safe.date || "").trim();
    return `no:${no}|date:${date}`;
  }

  function mergeStatusRows(remoteRowsLike, localRowsLike) {
    const remoteRows = sanitizeStatusRows(remoteRowsLike);
    const localRows = sanitizeStatusRows(localRowsLike);
    const byName = new Map();
    const merged = [];

    remoteRows.forEach((row) => {
      const key = String(row.name || "").trim().toLowerCase();
      const clone = deepClone(row);
      if (key) byName.set(key, clone);
      merged.push(clone);
    });

    localRows.forEach((row) => {
      const key = String(row.name || "").trim().toLowerCase();
      if (!key) return;
      const target = byName.get(key);
      if (!target) {
        const clone = deepClone(row);
        byName.set(key, clone);
        merged.push(clone);
        return;
      }
      const targetSlots = Array.isArray(target.slots) ? target.slots : [];
      const localSlots = Array.isArray(row.slots) ? row.slots : [];
      const maxLen = Math.max(targetSlots.length, localSlots.length);
      target.slots = Array.from({ length: maxLen }, (_v, idx) => {
        const remoteSlot = targetSlots[idx] || {};
        const localSlot = localSlots[idx] || {};
        const remoteLabel = String(remoteSlot.label || "");
        const localLabel = String(localSlot.label || "");
        return {
          label: remoteLabel || localLabel,
          owned: !!(remoteSlot.owned || localSlot.owned),
        };
      });
      if (!target.note && row.note) target.note = String(row.note);
    });

    return sanitizeStatusRows(merged);
  }

  function mergePersistablePayload(remotePayloadLike, localPayloadLike, options) {
    const remoteSafe = sanitizeData(remotePayloadLike || {});
    const localSafe = sanitizeData(localPayloadLike || {});
    const opts = options && typeof options === "object" ? options : {};
    const preferLocalForExistingSessions = !!opts.preferLocalForExistingSessions;
    const mergedSessionsByKey = new Map();

    remoteSafe.sessions.forEach((s) => {
      mergedSessionsByKey.set(sessionMergeKey(s), deepClone(s));
    });
    localSafe.sessions.forEach((s) => {
      const key = sessionMergeKey(s);
      if (!mergedSessionsByKey.has(key) || preferLocalForExistingSessions) {
        mergedSessionsByKey.set(key, deepClone(s));
      }
    });

    const mergedSessions = Array.from(mergedSessionsByKey.values());
    sortSessions(mergedSessions);
    const mergedStatuses = mergeStatusRows(remoteSafe.statuses, localSafe.statuses);
    return {
      campaign: deepClone(
        remoteSafe.campaign && Object.keys(remoteSafe.campaign).length
          ? remoteSafe.campaign
          : localSafe.campaign
      ),
      sessions: mergedSessions,
      statuses: mergedStatuses,
    };
  }

  function clearLegacyDraft() {
    try {
      localStorage.removeItem(legacyDraftKey);
    } catch (_error) {
      // Ignore.
    }
  }

  function buildDraftEnvelope(stateLike, options) {
    const safeState = sanitizeData(stateLike || {});
    const persistHash = getPersistableHash({
      campaign: deepClone(safeState.campaign),
      sessions: deepClone(safeState.sessions),
      statuses: deepClone(safeState.statuses),
    });
    const opts = options && typeof options === "object" ? options : {};
    const dirty = typeof opts.forceDirty === "boolean"
      ? opts.forceDirty
      : (!!safeState.draftSession || !lastSyncedHash || persistHash !== lastSyncedHash);
    if (localStateEnvelope && typeof localStateEnvelope.createEnvelope === "function") {
      return localStateEnvelope.createEnvelope({
        version: 1,
        sourceHash: sourcePersistHashAtLoad || "",
        savedAt: Date.now(),
        meta: {
          dirty,
          persistHash,
        },
        state: safeState,
      });
    }
    return {
      __bgbLocalStateEnvelope: 1,
      version: 1,
      sourceHash: sourcePersistHashAtLoad || "",
      savedAt: Date.now(),
      meta: {
        dirty,
        persistHash,
      },
      state: safeState,
    };
  }

  function writeDraftEnvelope(options) {
    if (!useLocalDraft) return;
    localStorage.setItem(draftKey, JSON.stringify(buildDraftEnvelope(state, options)));
    clearLegacyDraft();
  }

  function markLocalDraftClean() {
    try {
      if (state && state.draftSession) {
        writeDraftEnvelope({ forceDirty: true });
      } else {
        writeDraftEnvelope({ forceDirty: false });
      }
    } catch (_error) {
      // Ignore.
    }
  }

  function backupAndClearStaleDraft() {
    if (!useLocalDraft) return;
    try {
      if (localStateEnvelope && typeof localStateEnvelope.backupAndClear === "function") {
        localStateEnvelope.backupAndClear({
          storageKey: draftKey,
          backupSuffix: "__stale_backup_v1",
        });
      } else {
        const raw = localStorage.getItem(draftKey);
        if (raw) localStorage.setItem(staleDraftBackupKey, raw);
        localStorage.removeItem(draftKey);
      }
      clearLegacyDraft();
    } catch (_error) {
      // Ignore.
    }
  }

  async function fetchRemoteSnapshot(cfg, token) {
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`Host read failed (${res.status})`);
    const payload = await res.json();
    if (!payload || typeof payload.sha !== "string") throw new Error("Host response missing file SHA");
    let text = "";
    if (typeof payload.content === "string" && payload.content) {
      text = decodeBase64Utf8(String(payload.content).replace(/\n/g, ""));
    }
    return {
      sha: payload.sha,
      text,
      hash: quickHash(text),
    };
  }

  async function parseHostError(res) {
    if (!res) return "";
    try {
      const payload = await res.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch (_error) {
      // Ignore non-JSON payloads.
    }
    return "";
  }

  async function syncNow() {
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    if (!syncConfig) {
      refreshSyncUi("Host sync config invalid");
      return;
    }

    const token = getToken();
    if (!token) {
      refreshSyncUi();
      return;
    }

    let payloadToPersist = getPersistablePayload();
    let content = persistableText(payloadToPersist);
    let nextHash = quickHash(content);

    syncInFlight = true;
    setSyncStatus("Syncing JSON to Host...");

    try {
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(syncConfig.owner)}/${encodeURIComponent(syncConfig.repo)}/contents/${encodeURIComponent(syncConfig.filePath).replace(/%2F/g, "/")}`;
      const message = `update tainted grail sessions ${new Date().toISOString().slice(0, 19)}Z`;

      let synced = false;
      let lastError = "";
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const snapshot = await fetchRemoteSnapshot(syncConfig, token);
        if (nextHash === snapshot.hash) {
          markLocalDraftClean();
          lastSyncedHash = nextHash;
          setSyncStatus("No sync needed");
          return;
        }
        if (lastSyncedHash && snapshot.hash !== lastSyncedHash) {
          const remotePayload = parsePersistablePayload(snapshot.text);
          if (!remotePayload) {
            throw new Error("Host data changed remotely. Refresh page before syncing.");
          }
          payloadToPersist = mergePersistablePayload(remotePayload, payloadToPersist, {
            preferLocalForExistingSessions: true,
          });
          content = persistableText(payloadToPersist);
          nextHash = quickHash(content);
          if (nextHash === snapshot.hash) {
            state.campaign = deepClone(payloadToPersist.campaign);
            state.sessions = deepClone(payloadToPersist.sessions);
            state.statuses = sanitizeStatusRows(payloadToPersist.statuses);
            sortSessions(state.sessions);
            render();
            markLocalDraftClean();
            lastSyncedHash = nextHash;
            setSyncStatus("No sync needed");
            return;
          }
        }
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
            sha: snapshot.sha,
          }),
        });
        if (res.ok) {
          synced = true;
          break;
        }

        const detail = await parseHostError(res);
        lastError = detail ? `Host write failed (${res.status}): ${detail}` : `Host write failed (${res.status})`;
        if (res.status !== 409 || attempt === 3) break;
        await delay(220 * attempt);
      }

      if (!synced) throw new Error(lastError || "Host write failed");

      state.campaign = deepClone(payloadToPersist.campaign);
      state.sessions = deepClone(payloadToPersist.sessions);
      state.statuses = sanitizeStatusRows(payloadToPersist.statuses);
      sortSessions(state.sessions);
      render();
      markLocalDraftClean();
      lastSyncedHash = nextHash;
      setSyncStatus(`Host synced at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      setSyncStatus(error && error.message ? error.message : "Host sync failed");
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncQueued = false;
        window.setTimeout(() => {
          void syncNow();
        }, 0);
      }
    }
  }

  function renderControlBar(host) {
    const gateFactory = window.BGBEditSyncGate && typeof window.BGBEditSyncGate.create === "function"
      ? window.BGBEditSyncGate.create
      : null;

    if (!gateFactory) {
      const bar = el("div", "tg-sync-bar");
      host.appendChild(bar);
      return;
    }

    const gate = gateFactory({
      rootClass: "tg-sync-bar",
      buttonClass: "tg-add-btn",
      statusClass: "tg-page-status",
      getEditUnlocked: () => isEditUnlocked(),
      getSyncConnected: () => !!getToken(),
      onEditToggle: (currentlyUnlocked) => {
        let autoSyncAfterRender = false;
        if (currentlyUnlocked) {
          setEditUnlocked(false);
          editingSessionId = "";
          autoSyncAfterRender = true;
        } else {
          if (!tryUnlockEdit()) return false;
          setEditUnlocked(true);
        }
        render();
        if (autoSyncAfterRender) {
          void syncNow();
        }
        return false;
      },
      onSyncClick: () => {
        handleSyncButtonClick();
      },
      labels: {
        editLockedButton: "Edit Page",
        editUnlockedButton: "Lock Edit",
        editLockedStatus: "Edit locked",
        editUnlockedStatus: "Edit unlocked",
        syncDisconnectedButton: "Connect Host Sync",
        syncConnectedButton: "Host Sync Connected",
        syncDisconnectedStatus: "Host sync not connected",
        syncConnectedStatus: "Host sync ready",
      },
    });

    lockButtonNode = gate.editButton;
    editGateStatusNode = gate.editStatus;
    syncButtonNode = gate.syncButton;
    syncStatusNode = gate.syncStatus;
    refreshEditGateUi();
    refreshSyncUi();
    host.appendChild(gate.root);
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

    logsCard.appendChild(renderStatusBoard());

    pageStatusNode = el("div", "tg-page-status", "");
    logsCard.appendChild(pageStatusNode);

    renderControlBar(logsCard);

    group.append(subtitleWrap, summary, logsCard);
    root.appendChild(group);
  }

  async function init() {
    let remoteData = { campaign: {}, sessions: [], statuses: [], draftSession: null };
    try {
      const res = await fetch(`${dataSource}?v=${Date.now()}`);
      if (!res.ok) throw new Error("fetch failed");
      remoteData = sanitizeData(await res.json());
    } catch (_error) {
      remoteData = sanitizeData(remoteData);
    }

    const remoteHash = getPersistableHash({
      campaign: deepClone(remoteData.campaign),
      sessions: deepClone(remoteData.sessions),
      statuses: deepClone(remoteData.statuses),
    });
    sourcePersistHashAtLoad = remoteHash;

    const localDraft = loadDraft();
    let restoredLocal = false;
    if (localDraft && localDraft.state) {
      const savedSourceHash = String((localDraft.meta && localDraft.meta.sourcePersistHash) || "");
      const hasSourceMismatch = localStateEnvelope && typeof localStateEnvelope.isSourceHashMismatch === "function"
        ? localStateEnvelope.isSourceHashMismatch(savedSourceHash, remoteHash)
        : (!!savedSourceHash && savedSourceHash !== remoteHash);
      if (hasSourceMismatch) {
        backupAndClearStaleDraft();
        state = remoteData;
      } else {
      const localHash = getPersistableHash({
        campaign: deepClone(localDraft.state.campaign || {}),
        sessions: deepClone(localDraft.state.sessions || []),
        statuses: deepClone(localDraft.state.statuses || []),
      });
      const hasDraftSession = !!localDraft.state.draftSession;
      const isDirty = !!(localDraft.meta && localDraft.meta.dirty);
        if (isDirty && (hasDraftSession || localHash !== remoteHash)) {
          state = mergePersistablePayload(remoteData, localDraft.state, {
            preferLocalForExistingSessions: false,
          });
          restoredLocal = true;
        } else {
          state = remoteData;
        }
      }
    } else {
      state = remoteData;
    }

    lastSyncedHash = getPersistableHash({
      campaign: deepClone(state.campaign),
      sessions: deepClone(state.sessions),
      statuses: deepClone(state.statuses),
    });
    if (!restoredLocal) {
      markLocalDraftClean();
    }
    render();
    if (restoredLocal) {
      setPageStatus("Recovered unsynced local edits. Review and sync.");
    }
  }

  void init();
})();
