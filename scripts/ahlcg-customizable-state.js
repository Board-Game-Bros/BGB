(() => {
  function normalizeCatalogKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/["']/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function uniqueIds(ids) {
    return Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean)));
  }

  function getCustomizableDefinition(cardName) {
    const key = normalizeCatalogKey(cardName);
    const lib = window.AHLCG_CUSTOMIZABLE_LIBRARY && typeof window.AHLCG_CUSTOMIZABLE_LIBRARY === "object"
      ? window.AHLCG_CUSTOMIZABLE_LIBRARY.cards || {}
      : {};
    return key ? (lib[key] || null) : null;
  }

  function getCustomizableGroupIds(group) {
    const boxes = Number(group && group.boxes) > 0 ? Number(group && group.boxes) : 0;
    const baseId = String(group && group.id ? group.id : "").trim();
    if (!baseId || boxes <= 0) return [];
    return Array.from({ length: boxes }, (_, idx) => `${baseId}.${idx + 1}`);
  }

  function buildRecordKey(investigator, card) {
    const investigatorKey = normalizeCatalogKey(investigator);
    const cardKey = normalizeCatalogKey(card);
    return investigatorKey && cardKey ? `${investigatorKey}::${cardKey}` : "";
  }

  function createRegistry(rawRows) {
    const map = new Map();

    (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
      const investigator = String(row && row.investigator ? row.investigator : "").trim();
      const card = String(row && row.card ? row.card : "").trim();
      const key = buildRecordKey(investigator, card);
      if (!key) return;

      const rawStates = Array.isArray(row.states) ? row.states : [];
      const stateMap = new Map();
      rawStates.forEach((state, idx) => {
        const stateId = String(state && state.id ? state.id : "").trim() || `state_${idx + 1}`;
        stateMap.set(stateId, state || {});
      });

      if (!stateMap.size && Array.isArray(row.checkedIds) && row.checkedIds.length) {
        stateMap.set("__legacy_current__", {
          id: "__legacy_current__",
          checkedIds: row.checkedIds,
        });
      }

      const orderedStateIds = Array.from(stateMap.keys());
      const baselineStateId = String(row && row.baselineStateId ? row.baselineStateId : "").trim()
        || (orderedStateIds[orderedStateIds.length - 1] || "");
      const currentStateId = String(row && row.currentStateId ? row.currentStateId : "").trim()
        || (orderedStateIds[orderedStateIds.length - 1] || baselineStateId);

      const resolvedCache = new Map();
      const resolveStateIds = (stateId, path) => {
        const targetId = String(stateId || "").trim();
        if (!targetId || !stateMap.has(targetId)) return [];
        if (resolvedCache.has(targetId)) return resolvedCache.get(targetId).slice();
        const trail = Array.isArray(path) ? path : [];
        if (trail.includes(targetId)) return [];

        const state = stateMap.get(targetId) || {};
        let next = [];
        const fromId = String(state && state.from ? state.from : "").trim();
        if (fromId) {
          next = resolveStateIds(fromId, trail.concat(targetId));
        }
        if (Array.isArray(state.checkedIds)) {
          next = uniqueIds(state.checkedIds);
        }
        if (Array.isArray(state.activateIds) && state.activateIds.length) {
          next = uniqueIds(next.concat(state.activateIds));
        }
        if (Array.isArray(state.deactivateIds) && state.deactivateIds.length) {
          const blocked = new Set(uniqueIds(state.deactivateIds));
          next = next.filter((id) => !blocked.has(id));
        }
        resolvedCache.set(targetId, next.slice());
        return next.slice();
      };

      map.set(key, {
        investigator,
        card,
        definition: getCustomizableDefinition(card),
        baselineStateId,
        currentStateId,
        states: orderedStateIds.map((id) => ({ id, raw: stateMap.get(id) || {} })),
        resolveStateIds,
      });
    });

    return { map };
  }

  function getRecord(registry, investigator, card) {
    if (!registry || !registry.map || typeof registry.map.get !== "function") return null;
    const key = buildRecordKey(investigator, card);
    return key ? (registry.map.get(key) || null) : null;
  }

  function resolveStateIds(registry, investigator, card, stateId) {
    const record = getRecord(registry, investigator, card);
    if (!record) return [];
    const targetId = String(stateId || "").trim() || record.currentStateId;
    return record.resolveStateIds(targetId);
  }

  function getBaselineIds(registry, investigator, card) {
    const record = getRecord(registry, investigator, card);
    if (!record) return [];
    return record.resolveStateIds(record.baselineStateId);
  }

  function toBaselineStateMap(rawRows) {
    const registry = createRegistry(rawRows);
    const result = {};
    registry.map.forEach((record) => {
      const ids = record.resolveStateIds(record.baselineStateId);
      if (!ids.length) return;
      if (!result[record.investigator]) result[record.investigator] = {};
      result[record.investigator][record.card] = ids.slice();
    });
    return result;
  }

  function getInitialStateId(record) {
    if (!record || !Array.isArray(record.states)) return "";
    const exact = record.states.find((state) => state && state.id === "campaign_start");
    if (exact) return exact.id;
    const start = record.states.find((state) => state && /(?:^|_)campaign_start$|(?:^|_)start$/i.test(String(state.id || "")));
    return start ? start.id : "";
  }

  function toInitialStateMap(rawRows) {
    const registry = createRegistry(rawRows);
    const result = {};
    registry.map.forEach((record) => {
      const initialStateId = getInitialStateId(record);
      if (!initialStateId) return;
      const ids = record.resolveStateIds(initialStateId);
      if (!ids.length) return;
      if (!result[record.investigator]) result[record.investigator] = {};
      result[record.investigator][record.card] = ids.slice();
    });
    return result;
  }

  window.AHLCG_CUSTOMIZABLE_STATE_UTILS = {
    normalizeCatalogKey,
    uniqueIds,
    getCustomizableDefinition,
    getCustomizableGroupIds,
    createRegistry,
    getRecord,
    resolveStateIds,
    getBaselineIds,
    toBaselineStateMap,
    toInitialStateMap,
  };
})();
