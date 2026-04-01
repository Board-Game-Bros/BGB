// Shared GitHub sync helpers used by editable pages.
(() => {
  function normalizeConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== "object") return null;
    const provider = String(rawConfig.provider || "").trim().toLowerCase();
    if (provider !== "github") return null;
    const owner = String(rawConfig.owner || "").trim();
    const repo = String(rawConfig.repo || "").trim();
    const branch = String(rawConfig.branch || "main").trim();
    const filePath = String(rawConfig.filePath || "").trim().replace(/^\/+/, "");
    if (!owner || !repo || !filePath) return null;
    return { provider, owner, repo, branch, filePath };
  }

  function getConfigLabel(cfg) {
    if (!cfg) return "";
    return `${cfg.owner}/${cfg.repo}:${cfg.branch}`;
  }

  function getToken(storageKey) {
    if (!storageKey) return "";
    try {
      return String(window.localStorage.getItem(storageKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function setToken(storageKey, nextToken) {
    if (!storageKey) return;
    try {
      if (nextToken) {
        window.localStorage.setItem(storageKey, nextToken);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  }

  function decodeBase64Utf8(value) {
    const binary = window.atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function quickHash(value) {
    let hash = 5381;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return String(hash >>> 0);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function parseHostError(response) {
    if (!response) return "";
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch (_error) {
      // Ignore non-JSON payloads.
    }
    return "";
  }

  function buildContentsEndpoint(cfg) {
    return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
  }

  window.BGBGitHubSync = {
    normalizeConfig,
    getConfigLabel,
    getToken,
    setToken,
    encodeBase64Utf8,
    decodeBase64Utf8,
    quickHash,
    delay,
    parseHostError,
    buildContentsEndpoint,
  };
})();
