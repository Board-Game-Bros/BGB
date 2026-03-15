// Shared local-state envelope utilities for edit/sync pages.
(() => {
  function safeString(value) {
    return typeof value === "string" ? value : String(value || "");
  }

  function createEnvelope(options) {
    const opts = options && typeof options === "object" ? options : {};
    const state = opts.state && typeof opts.state === "object" ? opts.state : {};
    const meta = opts.meta && typeof opts.meta === "object" ? opts.meta : {};
    const versionNum = Number(opts.version);
    return {
      __bgbLocalStateEnvelope: 1,
      version: Number.isFinite(versionNum) && versionNum > 0 ? versionNum : 1,
      sourceHash: safeString(opts.sourceHash || "").trim(),
      savedAt: Number(opts.savedAt) > 0 ? Number(opts.savedAt) : Date.now(),
      meta,
      state,
    };
  }

  function parseEnvelope(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      const isEnvelope = !!(parsed
        && typeof parsed === "object"
        && parsed.__bgbLocalStateEnvelope === 1
        && parsed.state
        && typeof parsed.state === "object");
      if (!isEnvelope) {
        return {
          raw,
          parsed,
          isEnvelope: false,
          state: null,
          meta: {},
          sourceHash: "",
          savedAt: 0,
          version: 0,
        };
      }
      return {
        raw,
        parsed,
        isEnvelope: true,
        state: parsed.state,
        meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
        sourceHash: safeString(parsed.sourceHash || "").trim(),
        savedAt: Number(parsed.savedAt) > 0 ? Number(parsed.savedAt) : 0,
        version: Number(parsed.version) > 0 ? Number(parsed.version) : 1,
      };
    } catch (_error) {
      return null;
    }
  }

  function isSourceHashMismatch(savedSourceHash, currentSourceHash) {
    const saved = safeString(savedSourceHash || "").trim();
    const current = safeString(currentSourceHash || "").trim();
    if (!saved || !current) return false;
    return saved !== current;
  }

  function backupAndClear(options) {
    const opts = options && typeof options === "object" ? options : {};
    const storageKey = safeString(opts.storageKey || "").trim();
    if (!storageKey) return false;
    const backupSuffix = safeString(opts.backupSuffix || "__stale_backup_v1");
    const backupKey = storageKey + backupSuffix;
    try {
      const raw = typeof opts.rawValue === "string"
        ? opts.rawValue
        : safeString(window.localStorage.getItem(storageKey) || "");
      if (raw) {
        window.localStorage.setItem(backupKey, raw);
      }
      window.localStorage.removeItem(storageKey);
      return true;
    } catch (_error) {
      return false;
    }
  }

  window.BGBLocalStateEnvelope = {
    createEnvelope,
    parseEnvelope,
    isSourceHashMismatch,
    backupAndClear,
  };
})();
