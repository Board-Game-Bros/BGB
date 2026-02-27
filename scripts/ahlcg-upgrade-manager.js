(function () {
  function initAhlcgUpgradeManager(config) {
    const options = config || {};
    const cardDir = options.cardDir || "assets/boardgames/ahlcg_cards";
    const investigatorDir = options.investigatorDir || "assets/boardgames/ahlcg_investigators";
    const cardImageFiles = Array.isArray(options.cardImageFiles) ? options.cardImageFiles : [];
    const standardCardNames = Array.isArray(options.standardCardNames) ? options.standardCardNames : [];
    const exceptionalCardNames = Array.isArray(options.exceptionalCardNames) ? options.exceptionalCardNames : [];
    const storageKey = options.storageKey || "ahlcg_upgrade_state_default_v1";
    const pendingDeleteKey = storageKey + "__pending_delete_v1";
    const rootSelector = options.rootSelector || "#upgrade-history";
    const configuredPassword = typeof options.editPassword === "string" ? options.editPassword : "";
    const onTcuPage = /arkham_horror_lcg_tcu_20260215\.html$/i.test(String(window.location.pathname || ""));
    const fallbackPassword = onTcuPage ? "bgbzhangyan2026" : "";
    const editPassword = String(configuredPassword || fallbackPassword);
    const requireEditPassword = editPassword.length > 0;
    const inactivityMs = Number(options.inactivityMs) > 0 ? Number(options.inactivityMs) : 120000;
    const remoteSync = normalizeRemoteSync(options.remoteSync);
    const remoteSyncTokenStorageKey = typeof options.remoteSyncTokenStorageKey === "string" && options.remoteSyncTokenStorageKey.trim()
      ? options.remoteSyncTokenStorageKey.trim()
      : "bgb_github_sync_token_v1";
    const remoteSyncDebounceMs = Number(options.remoteSyncDebounceMs) > 0 ? Number(options.remoteSyncDebounceMs) : 2800;

    const cardCatalog = cardImageFiles.map((file) => ({
      file,
      key: normalizeText(file.replace(/\.png$/i, "")),
      level: getLevelFromFileName(file),
    }));
    const exceptionalCatalogKeys = exceptionalCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const exceptionalNameOnlySet = new Set(
      exceptionalCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );

    let activeUndo = null;
    let saveTimer = null;
    let inactivityTimer = null;
    let inactivityBound = false;
    let pendingRestoreDone = false;
    let editUnlocked = !requireEditPassword;
    let editGateButton = null;
    let editGateStatus = null;
    let remoteSyncButton = null;
    let remoteSyncStatus = null;
    let remoteSyncTimer = null;
    let remoteSyncInFlight = false;
    let remoteSyncQueued = false;
    let lastSyncedHtmlHash = "";
    let remoteSyncReady = false;
    let lastSavedStateRaw = "";
    let entryUidCounter = 1;
    const previewBaseWidth = 420;
    const previewAspectRatio = 600 / 420;
    const previewMargin = 8;
    const previewGap = 18;

    function normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/["']/g, "")
        .replace(/\(\s*x\s*\d+\s*\)/gi, " ")
        .replace(/\(([^)]*)\)/g, " $1 ")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
    }

    function normalizeRemoteSync(rawConfig) {
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

    function getRemoteSyncToken() {
      if (!remoteSync) return "";
      try {
        return String(window.localStorage.getItem(remoteSyncTokenStorageKey) || "").trim();
      } catch (_error) {
        return "";
      }
    }

    function setRemoteSyncToken(nextToken) {
      if (!remoteSync) return;
      try {
        if (nextToken) {
          window.localStorage.setItem(remoteSyncTokenStorageKey, nextToken);
        } else {
          window.localStorage.removeItem(remoteSyncTokenStorageKey);
        }
      } catch (_error) {
        // Ignore storage failures.
      }
    }

    function getRemoteSyncConfigLabel() {
      if (!remoteSync) return "";
      return `${remoteSync.owner}/${remoteSync.repo}:${remoteSync.branch}`;
    }

    function refreshRemoteSyncUi(textOverride) {
      if (!remoteSync) return;
      const hasToken = !!getRemoteSyncToken();
      if (remoteSyncButton) {
        remoteSyncButton.textContent = hasToken ? "GitHub Sync Connected" : "Connect GitHub Sync";
      }
      if (remoteSyncStatus) {
        if (textOverride) {
          remoteSyncStatus.textContent = textOverride;
        } else if (!hasToken) {
          remoteSyncStatus.textContent = "GitHub sync not connected";
        } else {
          remoteSyncStatus.textContent = `GitHub sync ready (${getRemoteSyncConfigLabel()})`;
        }
      }
    }

    function toBase64Utf8(value) {
      const bytes = new TextEncoder().encode(String(value || ""));
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return window.btoa(binary);
    }

    function fromBase64Utf8(value) {
      const binary = window.atob(String(value || ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    function makeQuickHash(value) {
      let hash = 5381;
      const text = String(value || "");
      for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
      }
      return String(hash >>> 0);
    }

    function getLevelFromFileName(fileName) {
      const match = String(fileName || "").match(/_(\d+)\.png$/i);
      if (!match) return null;
      return Number(match[1]);
    }

    function getRequestedLevel(inputName) {
      const text = String(inputName || "");
      const parenGroups = text.match(/\(([^)]*)\)/g) || [];
      for (let i = parenGroups.length - 1; i >= 0; i -= 1) {
        const group = parenGroups[i].replace(/[()]/g, "").trim();
        if (/^x\s*\d+$/i.test(group)) continue;
        const num = group.match(/\d+/);
        if (num) return Number(num[0]);
      }
      return null;
    }

    function getNameOnly(normalizedText) {
      return String(normalizedText || "")
        .split(" ")
        .filter((token) => token && !/^\d+$/.test(token))
        .join(" ");
    }

    function levenshteinDistance(a, b) {
      const left = String(a || "");
      const right = String(b || "");
      const rows = left.length + 1;
      const cols = right.length + 1;
      const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

      for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
      for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

      for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
          const cost = left[i - 1] === right[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      return matrix[rows - 1][cols - 1];
    }

    function similarityScore(a, b) {
      const left = String(a || "");
      const right = String(b || "");
      if (!left || !right) return 0;
      if (left === right) return 1;
      const distance = levenshteinDistance(left, right);
      return 1 - distance / Math.max(left.length, right.length);
    }

    function computeAdaptivePreviewSize() {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || previewBaseWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || (previewBaseWidth * previewAspectRatio);
      const maxByWidth = Math.max(160, viewportWidth - (previewMargin * 2));
      // Keep one uniform size that still fits above or below even near the viewport center.
      const maxHeightForAnyAnchor = Math.max(160, (viewportHeight / 2) - previewMargin - previewGap);
      const maxByHeight = Math.max(160, maxHeightForAnyAnchor / previewAspectRatio);
      const width = Math.min(previewBaseWidth, maxByWidth, maxByHeight);
      return {
        width,
        height: width * previewAspectRatio,
      };
    }

    function applyAdaptivePreviewSize() {
      const size = computeAdaptivePreviewSize();
      document.documentElement.style.setProperty("--card-preview-width", Math.round(size.width) + "px");
    }

    function romanToInt(roman) {
      const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      const chars = String(roman || "").toUpperCase().split("");
      let total = 0;
      let prev = 0;
      chars.reverse().forEach((char) => {
        const current = map[char] || 0;
        if (current < prev) {
          total -= current;
        } else {
          total += current;
          prev = current;
        }
      });
      return total;
    }

    function intToRoman(num) {
      const table = [
        [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
        [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
        [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
      ];
      let value = Number(num) || 1;
      let roman = "";
      table.forEach(([point, symbol]) => {
        while (value >= point) {
          roman += symbol;
          value -= point;
        }
      });
      return roman;
    }

    function findMatchingImage(cardName) {
      const target = normalizeText(cardName);
      if (!target) return null;
      const targetNameOnly = getNameOnly(target);
      const targetTokens = targetNameOnly.split(" ").filter(Boolean);
      const requiredTokens = targetTokens.filter((token) => {
        if (token.length < 3) return false;
        return !["the", "and", "for", "with", "from", "into", "campaign", "story", "asset"].includes(token);
      });
      const requestedLevel = getRequestedLevel(cardName);
      let best = null;
      let bestScore = 0;

      cardCatalog.forEach((item) => {
        const itemNameOnly = getNameOnly(item.key);
        if (requiredTokens.length > 0) {
          const missingRequired = requiredTokens.some((token) => !itemNameOnly.includes(token));
          if (missingRequired) return;
        }
        const nameSimilarity = similarityScore(targetNameOnly, itemNameOnly);
        const overlap = targetTokens.length > 0
          ? targetTokens.filter((t) => itemNameOnly.includes(t)).length / targetTokens.length
          : 0;

        let score = nameSimilarity * 70 + overlap * 30;

        if (item.key === target) {
          score += 30;
        } else if (item.key.includes(target)) {
          score += 15;
        } else if (target.includes(item.key)) {
          score += 10;
        }

        if (requestedLevel !== null) {
          if (item.level === requestedLevel) {
            score += 40;
          } else if (item.level === null) {
            score -= 8;
          } else {
            score -= 18;
          }
        }

        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      });

      if (!best || bestScore < 28) return null;
      return cardDir + "/" + best.file;
    }

    function findExactImage(cardName) {
      const target = normalizeText(cardName);
      if (!target) return null;
      const targetNameOnly = getNameOnly(target);
      const requestedLevel = getRequestedLevel(cardName);

      const exact = cardCatalog.find((item) => item.key === target);
      if (exact) return cardDir + "/" + exact.file;

      if (requestedLevel !== null) {
        const byLevel = cardCatalog.find((item) => (
          getNameOnly(item.key) === targetNameOnly && item.level === requestedLevel
        ));
        if (byLevel) return cardDir + "/" + byLevel.file;
      }

      const noLevel = cardCatalog.find((item) => (
        getNameOnly(item.key) === targetNameOnly && item.level === null
      ));
      if (noLevel) return cardDir + "/" + noLevel.file;

      // Fallback by catalog key to bridge labels like "(Story Asset)" vs "_campaign".
      const targetCatalogKey = getCatalogKey(cardName);
      if (targetCatalogKey) {
        const byCatalogKey = cardCatalog.find((item) => {
          const inferredName = toDisplayNameFromFile(item.file);
          return getCatalogKey(inferredName) === targetCatalogKey;
        });
        if (byCatalogKey) return cardDir + "/" + byCatalogKey.file;
      }

      return null;
    }

    function inferImagePath(cardName) {
      const normalized = normalizeText(cardName).replace(/\s+/g, "_");
      if (!normalized) return null;
      return cardDir + "/" + normalized + ".png";
    }

    function inferInvestigatorImagePath(investigatorName) {
      const normalized = normalizeText(investigatorName).replace(/\s+/g, "_");
      if (!normalized) return null;
      return investigatorDir + "/" + normalized + ".png";
    }

    function buildPreviewNode(cardName) {
      const src = findExactImage(cardName) || findMatchingImage(cardName) || inferImagePath(cardName);
      if (src) {
        const img = document.createElement("img");
        img.className = "card-preview";
        img.src = src;
        img.alt = cardName;
        img.addEventListener("error", () => {
          const fallback = buildPlaceholderPreview(cardName);
          img.replaceWith(fallback);
        });
        return img;
      }
      return buildPlaceholderPreview(cardName);
    }

    function buildPlaceholderPreview(cardName) {
      const placeholder = document.createElement("div");
      placeholder.className = "card-preview card-preview-placeholder";
      placeholder.textContent = "No card image found for \"" + cardName + "\" yet.";
      return placeholder;
    }

    function buildCustomPreviewNode(name, src, notFoundText) {
      if (src) {
        const img = document.createElement("img");
        img.className = "card-preview";
        img.src = src;
        img.alt = name;
        img.addEventListener("error", () => {
          const fallback = document.createElement("div");
          fallback.className = "card-preview card-preview-placeholder";
          fallback.textContent = notFoundText;
          img.replaceWith(fallback);
        });
        return img;
      }
      const placeholder = document.createElement("div");
      placeholder.className = "card-preview card-preview-placeholder";
      placeholder.textContent = notFoundText;
      return placeholder;
    }

    function createCardListItem(cardName) {
      const li = document.createElement("li");
      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName));
      li.appendChild(ref);
      return li;
    }

    function createDraftCardListItem(cardName) {
      const li = document.createElement("li");
      li.className = "draft-card-item";
      const inline = document.createElement("span");
      inline.className = "draft-card-inline";

      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "draft-card-remove";
      removeBtn.setAttribute("aria-label", "Remove " + cardName);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        decrementOrRemoveCardRow(li);
        syncDerivedUpgradeState();
      });
      inline.appendChild(ref);
      inline.appendChild(removeBtn);
      li.appendChild(inline);

      return li;
    }

    function getCardNameFromRef(ref) {
      return Array.from(ref.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("")
        .trim();
    }

    function listCardNames(listEl) {
      return Array.from(listEl.querySelectorAll(".card-ref"))
        .map((ref) => getCardNameFromRef(ref))
        .filter(Boolean);
    }

    function setCards(listEl, cardNames) {
      listEl.innerHTML = "";
      cardNames.forEach((name) => {
        listEl.appendChild(createCardListItem(name));
      });
    }

    function setCardsWithInlineRemove(listEl, cardNames) {
      listEl.innerHTML = "";
      (cardNames || []).forEach((name) => {
        listEl.appendChild(createDraftCardListItem(name));
      });
    }

    function normalizeStaticEntryCardRows(entry) {
      if (!entry) return;
      if (entry.classList.contains("upgrade-entry-draft")) return;
      if (entry.querySelector(".upgrade-entry-editor")) return;
      const lists = entry.querySelectorAll(".card-list");
      lists.forEach((listEl) => {
        const names = listCardNames(listEl);
        setCards(listEl, names);
      });
    }

    function parseTrailingQuantity(cardName) {
      const text = String(cardName || "").trim();
      const match = text.match(/\(\s*x\s*(\d+)\s*\)\s*$/i);
      if (!match) return { base: text, qty: 1 };
      const qty = Number(match[1]);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const base = text.slice(0, match.index).trim();
      return { base, qty: safeQty };
    }

    function formatCardNameWithQuantity(baseName, qty) {
      const base = String(baseName || "").trim();
      const safeQty = Number.isFinite(Number(qty)) ? Math.max(1, Math.trunc(Number(qty))) : 1;
      if (!base) return "";
      return safeQty > 1 ? (base + " (x" + safeQty + ")") : base;
    }

    function decrementOrRemoveCardRow(row) {
      if (!row) return;
      const ref = row.querySelector(".card-ref");
      if (!ref) {
        row.remove();
        return;
      }
      const currentName = getCardNameFromRef(ref);
      const parsed = parseTrailingQuantity(currentName);
      if (parsed.qty <= 1) {
        row.remove();
        return;
      }

      const nextName = formatCardNameWithQuantity(parsed.base, parsed.qty - 1);
      replaceCardRefText(ref, nextName);

      const preview = ref.querySelector(".card-preview");
      if (preview && preview.tagName === "IMG") {
        preview.setAttribute("alt", parsed.base);
        const src = findExactImage(parsed.base);
        if (src) preview.setAttribute("src", src);
      }
    }

    function addOrIncrementCardInList(listEl, rawName) {
      if (!listEl) return;
      const normalized = normalizeCardNameInput(rawName);
      if (!normalized) return;

      const incoming = parseTrailingQuantity(normalized);
      const incomingBase = incoming.base;
      const incomingQty = incoming.qty;
      if (!incomingBase) return;
      const incomingKey = getCatalogKey(incomingBase);

      const existingRefs = Array.from(listEl.querySelectorAll(".card-ref"));
      for (let i = 0; i < existingRefs.length; i += 1) {
        const ref = existingRefs[i];
        const existingText = getCardNameFromRef(ref);
        const existing = parseTrailingQuantity(existingText);
        if (getCatalogKey(existing.base) !== incomingKey) continue;
        const nextQty = existing.qty + incomingQty;
        const nextName = formatCardNameWithQuantity(existing.base, nextQty);
        replaceCardRefText(ref, nextName);
        const preview = ref.querySelector(".card-preview");
        if (preview && preview.tagName === "IMG") {
          preview.setAttribute("alt", existing.base);
          const src = findExactImage(existing.base);
          if (src) preview.setAttribute("src", src);
        }
        return;
      }

      listEl.appendChild(createDraftCardListItem(formatCardNameWithQuantity(incomingBase, incomingQty)));
    }

    function parseInputCards(textValue) {
      return String(textValue || "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function getCardQuantity(cardName) {
      const text = String(cardName || "");
      const match = text.match(/\(\s*x\s*(\d+)\s*\)\s*$/i);
      if (!match) return 1;
      const value = Number(match[1]);
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function getCardLevel(cardName) {
      const text = String(cardName || "");
      const groups = text.match(/\(([^)]*)\)/g) || [];
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const inner = groups[i].replace(/[()]/g, "").trim();
        if (/^x\s*\d+$/i.test(inner)) continue;
        const match = inner.match(/^\d+$/);
        if (match) return Number(match[0]);
      }
      return 0;
    }

    function isStoryCardName(cardName) {
      const text = String(cardName || "");
      const groups = text.match(/\(([^)]*)\)/g) || [];
      for (let i = 0; i < groups.length; i += 1) {
        const inner = groups[i].replace(/[()]/g, "").trim();
        if (!inner) continue;
        // Quantity suffix like (x2) is never a story marker.
        if (/^x\s*\d+$/i.test(inner)) continue;
        if (/\bstory\b/i.test(inner) || /\bcampaign\b/i.test(inner)) {
          return true;
        }
      }
      return false;
    }

    function getAddedCardCost(cardName) {
      if (isStoryCardName(cardName)) return 0;
      const level = getCardLevel(cardName);
      const baseCost = level <= 0 ? 1 : level;
      return isExceptionalCardName(cardName) ? (baseCost * 2) : baseCost;
    }

    function getRemovedCardValue(cardName) {
      if (isStoryCardName(cardName)) return 0;
      const level = getCardLevel(cardName);
      return level > 0 ? level : 0;
    }

    function isExceptionalCardName(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return false;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return false;
      if (exceptionalNameOnlySet.has(nameOnly)) return true;
      return exceptionalCatalogKeys.some((ek) => {
        const eNameOnly = getNameOnly(ek);
        if (!eNameOnly) return false;
        return (
          nameOnly === eNameOnly ||
          nameOnly.startsWith(eNameOnly + " ") ||
          eNameOnly.startsWith(nameOnly + " ")
        );
      });
    }

    function sumAddedCostsFromCardNames(cardNames) {
      return (cardNames || []).reduce((acc, name) => {
        const qty = getCardQuantity(name);
        const cost = getAddedCardCost(name);
        return acc + qty * cost;
      }, 0);
    }

    function sumRemovedValuesFromCardNames(cardNames) {
      return (cardNames || []).reduce((acc, name) => {
        const qty = getCardQuantity(name);
        const cost = getRemovedCardValue(name);
        return acc + qty * cost;
      }, 0);
    }

    function computeNetSpentXp(removedCardNames, addedCardNames) {
      const removedValue = sumRemovedValuesFromCardNames(removedCardNames);
      const addedCost = sumAddedCostsFromCardNames(addedCardNames);
      return Math.max(0, addedCost - removedValue);
    }

    function getEntryCardLists(entry) {
      const lists = entry ? entry.querySelectorAll(".card-list") : [];
      const removedList = lists[0] || null;
      const addedList = lists[1] || null;
      return { removedList, addedList };
    }

    function getEntryNetSpentXp(entry) {
      const { removedList, addedList } = getEntryCardLists(entry);
      const removedNames = removedList ? listCardNames(removedList) : [];
      const addedNames = addedList ? listCardNames(addedList) : [];
      return computeNetSpentXp(removedNames, addedNames);
    }

    function sumEarnedXpFromEntryHeads(card, excludedEntry) {
      if (!card) return 0;
      let earned = 0;
      card.querySelectorAll(".upgrade-entry-head").forEach((head) => {
        const entry = head.closest(".upgrade-entry");
        if (!entry) return;
        if (entry.classList.contains("upgrade-entry-draft")) return;
        if (excludedEntry && entry === excludedEntry) return;
        earned += getXpFromHead(head.textContent);
      });
      return earned;
    }

    function sumEarnedXpFromSummaryLines(card) {
      if (!card) return 0;
      let earned = 0;
      card.querySelectorAll(".upgrade-list > p").forEach((line) => {
        const text = String(line.textContent || "");
        if (!/xp/i.test(text)) return;
        const matches = text.match(/[+-]\s*\d+\s*XP/gi) || [];
        matches.forEach((chunk) => {
          const num = chunk.match(/[+-]\s*\d+/);
          if (!num) return;
          earned += Number(num[0].replace(/\s+/g, ""));
        });
      });
      return earned;
    }

    function hasConfirmedEntries(card) {
      if (!card) return false;
      return !!card.querySelector(".upgrade-entry:not(.upgrade-entry-draft)");
    }

    function computeEarnedXp(card, excludedEntry) {
      // Use one source of truth to avoid double-counting:
      // once structured entries exist, ignore legacy summary paragraphs.
      if (hasConfirmedEntries(card)) {
        return sumEarnedXpFromEntryHeads(card, excludedEntry);
      }
      return sumEarnedXpFromSummaryLines(card);
    }

    function computeAvailableXpExcludingEntry(card, excludedEntry) {
      if (!card) return 0;
      const earned = computeEarnedXp(card, excludedEntry);
      let spent = 0;

      card.querySelectorAll(".upgrade-entry").forEach((entry) => {
        if (excludedEntry && entry === excludedEntry) return;
        if (entry.classList.contains("upgrade-entry-draft")) return;
        spent += getEntryNetSpentXp(entry);
      });

      // Keep negative balances so validation can block further overspending.
      return earned - spent;
    }

    function setInlineValidationMessage(messageNode, text) {
      if (!messageNode) return;
      const msg = String(text || "").trim();
      if (!msg) {
        messageNode.textContent = "";
        messageNode.hidden = true;
        return;
      }
      messageNode.textContent = msg;
      messageNode.hidden = false;
    }

    function ensureEntryUid(entry) {
      if (!entry) return "";
      const existing = String(entry.dataset.entryUid || "").trim();
      if (existing) return existing;
      const next = "e" + entryUidCounter;
      entryUidCounter += 1;
      entry.dataset.entryUid = next;
      return next;
    }

    function getScenarioLabelFromTraumaRow(row) {
      if (!row) return "";
      const fromData = String(row.dataset.traumaLabel || "");
      const fromText = String(row.textContent || "");
      const source = fromData || fromText;
      const match = source.match(/Scenario\s+([IVXLCDM]+)/i);
      return match ? match[1].toUpperCase() : "";
    }

    function findLinkedTraumaRow(entry) {
      if (!entry) return null;
      const upgradeList = entry.closest(".upgrade-list");
      if (!upgradeList) return null;

      const uid = String(entry.dataset.entryUid || "").trim();
      if (uid) {
        const byUid = upgradeList.querySelector(`.scenario-trauma[data-entry-uid-link="${uid}"]`);
        if (byUid) return byUid;
      }

      const head = entry.querySelector(".upgrade-entry-head");
      const scenarioLabel = getScenarioLabelFromHead(head ? head.textContent : "");
      if (!scenarioLabel) return null;

      const traumaRows = Array.from(upgradeList.querySelectorAll(".scenario-trauma"));
      return traumaRows.find((row) => getScenarioLabelFromTraumaRow(row) === scenarioLabel) || null;
    }

    function createScenarioTraumaRow(scenarioLabel, opts) {
      const options = opts || {};
      const physical = toNonNegativeInteger(options.physical || 0);
      const mental = toNonNegativeInteger(options.mental || 0);
      const row = document.createElement("p");
      row.className = "scenario-trauma";
      row.dataset.physical = String(physical);
      row.dataset.mental = String(mental);
      row.dataset.traumaLabel = `Trauma (Scenario ${scenarioLabel}):`;
      renderTraumaRow(row);
      return row;
    }

    function toDisplayNameFromFile(fileName) {
      let base = String(fileName || "").replace(/\.png$/i, "");
      let level = null;
      const levelMatch = base.match(/_(\d+)$/);
      if (levelMatch) {
        level = Number(levelMatch[1]);
        base = base.slice(0, -levelMatch[0].length);
      }
      const name = base
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      if (level !== null) return name + " (" + level + ")";
      return name;
    }

    function getCatalogKey(name) {
      return normalizeText(name)
        .replace(/\bcampaign\b/g, " ")
        .replace(/\bstory\b/g, " ")
        .replace(/\basset\b/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    }

    function getCardNameCatalog() {
      const map = new Map();
      const playableKeys = new Set(
        cardImageFiles
          .map((file) => getCatalogKey(toDisplayNameFromFile(file)))
          .filter(Boolean)
      );

      const filteredStandard = standardCardNames.filter((name) => playableKeys.has(getCatalogKey(name)));
      const sourceNames = standardCardNames.length > 0
        ? (filteredStandard.length > 0 ? filteredStandard : standardCardNames)
        : cardImageFiles.map((file) => toDisplayNameFromFile(file));

      sourceNames.forEach((name) => {
        const key = getCatalogKey(name);
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, { name, key });
        }
      });

      return Array.from(map.values());
    }

    function getCardNameSuggestions(queryText, limit) {
      const query = getCatalogKey(queryText);
      if (!query) return [];
      const cap = typeof limit === "number" ? limit : 8;
      const catalog = getCardNameCatalog();

      return catalog
        .map((item) => {
          const key = item.key;
          let score = 0;
          if (key === query) score = 100;
          else if (key.startsWith(query)) score = 90;
          else if (key.includes(query)) score = 75;
          else score = Math.round(similarityScore(key, query) * 60);
          return { ...item, score };
        })
        .filter((item) => item.score >= 45)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, cap);
    }

    function normalizeCardNameInput(rawText) {
      const original = String(rawText || "").trim();
      if (!original) return "";
      const normalized = getCatalogKey(original);
      const catalog = getCardNameCatalog();
      const exact = catalog.find((item) => item.key === normalized);
      if (exact) return exact.name;
      const requestedLevel = getRequestedLevel(original);
      if (requestedLevel !== null) {
        const levelMatched = catalog.filter((item) => getRequestedLevel(item.name) === requestedLevel);
        const exactLevel = levelMatched.find((item) => getCatalogKey(item.name) === normalized);
        if (exactLevel) return exactLevel.name;
      }
      const nameOnly = getNameOnly(normalized);
      if (!nameOnly) return original;
      const sameBaseName = catalog.filter((item) => getNameOnly(item.key) === nameOnly);
      if (sameBaseName.length === 1) {
        return sameBaseName[0].name;
      }
      return original;
    }

    function wireCardAutocomplete(input, onPick, onSubmit) {
      if (!input || input.dataset.autocompleteBound === "1") return;
      input.dataset.autocompleteBound = "1";

      const row = input.closest(".builder-input-row");
      if (!row) return;

      const panel = document.createElement("div");
      panel.className = "card-autocomplete";
      panel.hidden = true;
      row.appendChild(panel);

      let current = [];
      let activeIndex = -1;
      const previewMargin = 8;

      function resetAutocompletePreviewPosition(preview) {
        if (!preview) return;
        preview.style.left = "auto";
        preview.style.right = "auto";
        preview.style.top = "auto";
        preview.style.bottom = "auto";
        preview.style.transform = "none";
      }

      function clampAutocompletePreviewPosition(option, preview) {
        if (!option || !preview) return;
        const rect = option.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const adaptive = computeAdaptivePreviewSize();
        const previewWidth = adaptive.width;
        const previewHeight = adaptive.height;

        resetAutocompletePreviewPosition(preview);

        const rightSideLeft = rect.right + previewMargin;
        const hasRightSpace = rightSideLeft + previewWidth <= viewportWidth - previewMargin;
        if (hasRightSpace) {
          preview.style.left = "calc(100% + 8px)";
          preview.style.right = "auto";
        } else {
          preview.style.right = "calc(100% + 8px)";
          preview.style.left = "auto";
        }

        const idealTop = rect.top + rect.height / 2 - previewHeight / 2;
        const minTop = previewMargin;
        const maxTop = Math.max(previewMargin, viewportHeight - previewHeight - previewMargin);
        const safeTop = Math.min(maxTop, Math.max(minTop, idealTop));
        const offset = Math.round(safeTop - idealTop);
        if (offset === 0) {
          preview.style.top = "50%";
        } else if (offset > 0) {
          preview.style.top = "calc(50% + " + offset + "px)";
        } else {
          preview.style.top = "calc(50% - " + Math.abs(offset) + "px)";
        }
        preview.style.bottom = "auto";
        preview.style.transform = "translateY(-50%)";
      }

      function closePanel() {
        panel.hidden = true;
        panel.innerHTML = "";
        current = [];
        activeIndex = -1;
      }

      function pick(name) {
        closePanel();
        onPick(name);
      }

      function renderPanel() {
        if (!current.length) {
          closePanel();
          return;
        }
        panel.innerHTML = "";
        current.forEach((item, idx) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "card-autocomplete-item";
          option.appendChild(document.createTextNode(item.name));
          const preview = buildPreviewNode(item.name);
          preview.classList.add("card-autocomplete-preview");
          option.addEventListener("mouseenter", () => {
            clampAutocompletePreviewPosition(option, preview);
          });
          option.addEventListener("mousemove", () => {
            clampAutocompletePreviewPosition(option, preview);
          });
          option.addEventListener("mouseleave", () => {
            resetAutocompletePreviewPosition(preview);
          });
          option.appendChild(preview);
          if (idx === activeIndex) option.classList.add("is-active");
          option.addEventListener("click", () => pick(item.name));
          panel.appendChild(option);
        });
        panel.hidden = false;
      }

      input.addEventListener("input", () => {
        const value = input.value.trim();
        if (value.length < 2) {
          closePanel();
          return;
        }
        current = getCardNameSuggestions(value, 8);
        activeIndex = -1;
        renderPanel();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" && !panel.hidden && current.length) {
          event.preventDefault();
          activeIndex = (activeIndex + 1) % current.length;
          renderPanel();
        } else if (event.key === "ArrowUp" && !panel.hidden && current.length) {
          event.preventDefault();
          activeIndex = (activeIndex - 1 + current.length) % current.length;
          renderPanel();
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (!panel.hidden && current.length && activeIndex >= 0 && current[activeIndex]) {
            pick(current[activeIndex].name);
          } else if (typeof onSubmit === "function") {
            onSubmit();
          }
        } else if (event.key === "Escape") {
          closePanel();
        }
      });

      document.addEventListener("click", (event) => {
        if (!row.contains(event.target)) {
          closePanel();
        }
      });

      panel.addEventListener("scroll", () => {
        const hovered = panel.querySelector(".card-autocomplete-item:hover");
        if (!hovered) return;
        const preview = hovered.querySelector(".card-autocomplete-preview");
        clampAutocompletePreviewPosition(hovered, preview);
      });
    }

    function nextScenarioNumber(upgradeList) {
      let max = 0;
      upgradeList.querySelectorAll(".upgrade-entry-head").forEach((head) => {
        const match = head.textContent.match(/After Scenario\s+([IVXLCDM]+)/i);
        if (!match) return;
        max = Math.max(max, romanToInt(match[1]));
      });
      return Math.max(1, max + 1);
    }

    function getScenarioLabelFromHead(headText) {
      const match = String(headText || "").match(/After Scenario\s+([IVXLCDM]+)/i);
      return match ? match[1].toUpperCase() : "";
    }

    function getXpFromHead(headText) {
      const match = String(headText || "").match(/\(([+-]?\d+)\s*XP\)/i);
      return match ? Number(match[1]) : 0;
    }

    function toNonNegativeInteger(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 0;
      return Math.max(0, Math.trunc(parsed));
    }

    function formatEntryHead(scenarioLabel, xpValue) {
      const label = scenarioLabel || "I";
      const xp = toNonNegativeInteger(xpValue);
      return "After Scenario " + label + " (+" + xp + " XP)";
    }

    function getUpgradeCardName(upgradeList) {
      const card = upgradeList ? upgradeList.closest(".upgrade-card") : null;
      return getCardOwnerName(card);
    }

    function getCardOwnerName(card) {
      const nameNode = card ? card.querySelector("h3") : null;
      if (!nameNode) return "";
      const dataName = nameNode.getAttribute("data-investigator-name");
      if (dataName) return dataName.trim();
      return nameNode.textContent.trim();
    }

    function resolveInvestigatorCanonicalName(investigatorName) {
      const base = String(investigatorName || "").trim();
      if (!base) return "";
      const normalizedBase = normalizeText(base);
      const fromStandard = standardCardNames.find((name) => {
        if (!name || !name.includes(":")) return false;
        const head = String(name).split(":")[0].trim();
        return normalizeText(head) === normalizedBase;
      });
      return fromStandard || base;
    }

    function decorateInvestigatorHeaders() {
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        const heading = card.querySelector("h3");
        if (!heading || heading.querySelector(".investigator-pill")) return;
        const baseName = heading.textContent.trim();
        const canonicalName = resolveInvestigatorCanonicalName(baseName);
        const imagePath = inferInvestigatorImagePath(canonicalName);
        heading.setAttribute("data-investigator-name", baseName);
        heading.textContent = "";

        const pill = document.createElement("span");
        pill.className = "investigator-pill card-ref";
        pill.appendChild(document.createTextNode(baseName));
        pill.appendChild(
          buildCustomPreviewNode(
            canonicalName,
            imagePath,
            "No investigator image found for \"" + canonicalName + "\" yet."
          )
        );
        heading.appendChild(pill);
      });
    }

    function savePendingDelete(payload) {
      try {
        window.localStorage.setItem(pendingDeleteKey, JSON.stringify(payload));
      } catch (_error) {
        // Ignore storage failures.
      }
    }

    function serializeEntryForPendingDelete(entry) {
      if (!entry) return "";
      const clone = entry.cloneNode(true);
      clone.querySelectorAll(".upgrade-entry-editor").forEach((node) => node.remove());
      clone.querySelectorAll("[data-bound]").forEach((node) => {
        node.removeAttribute("data-bound");
      });
      clone.querySelectorAll("[data-preview-bound]").forEach((node) => {
        node.removeAttribute("data-preview-bound");
      });
      clone.querySelectorAll(".card-preview").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.style.removeProperty("display");
        node.style.removeProperty("visibility");
        node.style.removeProperty("position");
        node.style.removeProperty("left");
        node.style.removeProperty("right");
        node.style.removeProperty("top");
        node.style.removeProperty("bottom");
        node.style.removeProperty("transform");
        node.style.removeProperty("z-index");
      });
      return clone.outerHTML;
    }

    function readPendingDelete() {
      try {
        const raw = window.localStorage.getItem(pendingDeleteKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    }

    function clearPendingDelete() {
      try {
        window.localStorage.removeItem(pendingDeleteKey);
      } catch (_error) {
        // Ignore storage failures.
      }
    }

    function isEditEnabled() {
      return !requireEditPassword || editUnlocked;
    }

    function stopInactivityTimer() {
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    }

    function lockEditMode() {
      if (!requireEditPassword) return;
      editUnlocked = false;
      stopInactivityTimer();
      clearUndo({ forceClearPending: true, skipSave: true });
      document.querySelectorAll(".upgrade-entry-editor, .upgrade-entry-draft").forEach((node) => {
        node.remove();
      });
      document.querySelectorAll(".upgrade-entry").forEach((entry) => {
        ensureEntryActions(entry);
      });
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        addToolbar(card);
      });
      refreshEditGateUi();
      scheduleSaveUpgradeState();
    }

    function refreshEditGateUi() {
      if (!requireEditPassword) return;
      if (editGateButton) {
        editGateButton.textContent = isEditEnabled() ? "Lock Edit" : "Edit Page";
      }
      if (editGateStatus) {
        editGateStatus.textContent = isEditEnabled() ? "Edit unlocked" : "Edit locked";
      }
    }

    function resetInactivityTimer() {
      if (!requireEditPassword || !isEditEnabled()) return;
      stopInactivityTimer();
      inactivityTimer = window.setTimeout(() => {
        lockEditMode();
      }, inactivityMs);
    }

    function bindInactivityTracking() {
      if (!requireEditPassword || inactivityBound) return;
      inactivityBound = true;
      ["pointerdown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
        window.addEventListener(eventName, () => {
          resetInactivityTimer();
        }, { passive: true });
      });
    }

    function tryUnlockEditMode() {
      if (!requireEditPassword) return true;
      const input = window.prompt("Enter edit password:");
      if (input === null) return false;
      if (input !== editPassword) {
        window.alert("Incorrect password.");
        return false;
      }
      editUnlocked = true;
      resetInactivityTimer();
      document.querySelectorAll(".upgrade-entry").forEach((entry) => {
        ensureEntryActions(entry);
      });
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        addToolbar(card);
      });
      if (!pendingRestoreDone) {
        restorePendingDelete();
        pendingRestoreDone = true;
      }
      refreshEditGateUi();
      return true;
    }

    function renderEditGate() {
      if (!requireEditPassword) return;
      const section = document.querySelector(rootSelector);
      if (!section) return;
      if (section.querySelector(".edit-gate")) return;

      const gate = document.createElement("div");
      gate.className = "edit-gate";
      gate.innerHTML = `
        <button type="button" class="upgrade-btn upgrade-btn-secondary" data-action="toggle-edit-lock">Edit Page</button>
        <span class="edit-gate-status">Edit locked</span>
      `;
      editGateButton = gate.querySelector('[data-action="toggle-edit-lock"]');
      editGateStatus = gate.querySelector(".edit-gate-status");

      editGateButton.addEventListener("click", () => {
        if (isEditEnabled()) {
          lockEditMode();
          return;
        }
        tryUnlockEditMode();
      });

      if (remoteSync) {
        const remoteBtn = document.createElement("button");
        remoteBtn.type = "button";
        remoteBtn.className = "upgrade-btn upgrade-btn-secondary";
        remoteBtn.textContent = "Connect GitHub Sync";
        remoteBtn.addEventListener("click", () => {
          openRemoteSyncPrompt();
        });
        remoteSyncButton = remoteBtn;
        gate.appendChild(remoteBtn);

        const remoteStatusEl = document.createElement("span");
        remoteStatusEl.className = "edit-gate-status";
        remoteStatusEl.textContent = "GitHub sync not connected";
        remoteSyncStatus = remoteStatusEl;
        gate.appendChild(remoteStatusEl);
      }

      const title = section.querySelector(".section-title");
      if (title && title.nextSibling) {
        section.insertBefore(gate, title.nextSibling);
      } else {
        section.prepend(gate);
      }

      refreshEditGateUi();
      refreshRemoteSyncUi();
    }

    function clearUndo(opts) {
      const options = opts || {};
      const preservePending = !!options.preservePending;
      const skipSave = !!options.skipSave;
      const forceClearPending = !!options.forceClearPending;
      const hasActiveUndo = !!activeUndo;
      if (activeUndo) {
        window.clearTimeout(activeUndo.timerId);
        if (activeUndo.toast && activeUndo.toast.isConnected) {
          activeUndo.toast.remove();
        }
        activeUndo = null;
      }
      if (!preservePending && (hasActiveUndo || forceClearPending)) {
        clearPendingDelete();
      }
      if (!skipSave) {
        syncDerivedUpgradeState();
      }
    }

    function showUndoToast(upgradeList, entry, traumaRow, nextSibling, expiresAt) {
      if (!isEditEnabled()) return;
      clearUndo({ preservePending: true, skipSave: true });

      const toast = document.createElement("div");
      toast.className = "undo-toast";
      toast.innerHTML = [
        "<span>Scenario deleted.</span>",
        '<button type="button" class="upgrade-btn upgrade-btn-secondary">Undo</button>',
      ].join("");

      const undoBtn = toast.querySelector("button");
      undoBtn.addEventListener("click", () => {
        const entryHead = entry.querySelector(".upgrade-entry-head");
        const entryHeadText = entryHead ? entryHead.textContent.trim() : "";
        const alreadyExists = entryHeadText
          ? Array.from(upgradeList.querySelectorAll(".upgrade-entry")).some((item) => {
            const head = item.querySelector(".upgrade-entry-head");
            return head && head.textContent.trim() === entryHeadText;
          })
          : false;

        if (alreadyExists) {
          clearUndo();
          return;
        }

        if (nextSibling && nextSibling.parentNode === upgradeList) {
          upgradeList.insertBefore(entry, nextSibling);
        } else {
          upgradeList.appendChild(entry);
        }
        if (traumaRow) {
          const insertionAnchor = entry.nextSibling;
          if (insertionAnchor) {
            upgradeList.insertBefore(traumaRow, insertionAnchor);
          } else {
            upgradeList.appendChild(traumaRow);
          }
        }
        ensureEntryActions(entry);
        bindPreviewFallbacks(entry);
        clearUndo();
      });

      const toolbar = upgradeList.querySelector(".upgrade-toolbar");
      if (toolbar) {
        upgradeList.insertBefore(toast, toolbar);
      } else {
        upgradeList.prepend(toast);
      }

      const expireAt = Number(expiresAt) || (Date.now() + 60000);
      const remainingMs = Math.max(0, expireAt - Date.now());
      const timerId = window.setTimeout(() => {
        clearUndo();
      }, remainingMs);

      activeUndo = { toast, timerId };
    }

    function attachEditor(entry) {
      if (!isEditEnabled()) return;
      if (entry.querySelector(".upgrade-entry-editor")) return;

      const lists = entry.querySelectorAll(".card-list");
      if (lists.length < 2) return;
      const removedList = lists[0];
      const addedList = lists[1];
      const directChildren = Array.from(entry.children || []);
      const displayColumns = directChildren.find((node) => node.classList && node.classList.contains("upgrade-columns")) || null;
      const displayActions = directChildren.find((node) => node.classList && node.classList.contains("entry-actions")) || null;

      const hideDisplayLayer = () => {
        if (displayColumns) displayColumns.style.display = "none";
        if (displayActions) displayActions.style.display = "none";
      };

      const showDisplayLayer = () => {
        if (displayColumns) displayColumns.style.removeProperty("display");
        if (displayActions) displayActions.style.removeProperty("display");
      };

      const editor = document.createElement("div");
      editor.className = "upgrade-entry-editor";
      editor.innerHTML = `
        <div class="builder-input-row">
          <label>XP Gained</label>
          <input type="number" class="upgrade-input" data-edit="xp" min="0" step="1" />
        </div>
        <div class="builder-grid">
          <div class="builder-col" data-edit-builder="removed">
            <h5>Removed</h5>
            <div class="builder-input-row">
              <input type="text" class="upgrade-input" placeholder="Type card name..." />
              <button type="button" class="upgrade-btn upgrade-btn-secondary">Add</button>
            </div>
            <p class="builder-hint">Input a card name and click Add (or press Enter).</p>
            <ul class="card-list" data-edit-list="removed"></ul>
          </div>
          <div class="builder-col" data-edit-builder="added">
            <h5>Added</h5>
            <div class="builder-input-row">
              <input type="text" class="upgrade-input" placeholder="Type card name..." />
              <button type="button" class="upgrade-btn upgrade-btn-secondary">Add</button>
            </div>
            <p class="builder-hint">Input a card name and click Add (or press Enter).</p>
            <ul class="card-list" data-edit-list="added"></ul>
          </div>
        </div>
        <p class="builder-error" data-edit-error hidden></p>
        <div class="entry-actions">
          <button type="button" class="upgrade-btn" data-action="save-edit">Save</button>
          <button type="button" class="upgrade-btn upgrade-btn-secondary" data-action="cancel-edit">Cancel</button>
          <button type="button" class="upgrade-btn upgrade-btn-danger" data-action="delete-entry">Delete Scenario</button>
        </div>
      `;

      const removedEditList = editor.querySelector('[data-edit-list="removed"]');
      const addedEditList = editor.querySelector('[data-edit-list="added"]');
      const errorNode = editor.querySelector('[data-edit-error]');
      setCardsWithInlineRemove(removedEditList, listCardNames(removedList));
      setCardsWithInlineRemove(addedEditList, listCardNames(addedList));
      const head = entry.querySelector(".upgrade-entry-head");
      const currentHeadText = head ? head.textContent : "";
      const editXpInput = editor.querySelector('[data-edit="xp"]');
      editXpInput.value = String(getXpFromHead(currentHeadText));
      ["input", "change"].forEach((evtName) => {
        editXpInput.addEventListener(evtName, () => {
          refreshCurrentXp();
        });
      });

      editor.querySelectorAll("[data-edit-builder]").forEach((builderCol) => {
        const mode = builderCol.getAttribute("data-edit-builder");
        const listEl = editor.querySelector(`[data-edit-list="${mode}"]`);
        const input = builderCol.querySelector(".upgrade-input");
        const addBtn = builderCol.querySelector(".upgrade-btn");

        const addCardToEditorList = (rawName) => {
          addOrIncrementCardInList(listEl, rawName);
          input.value = "";
          input.focus();
        };

        const addFromInput = () => addCardToEditorList(input.value);
        addBtn.addEventListener("click", addFromInput);
        wireCardAutocomplete(input, addCardToEditorList, addFromInput);
      });

      editor.querySelector('[data-action="save-edit"]').addEventListener("click", () => {
        const removedCards = listCardNames(removedEditList);
        const addedCards = listCardNames(addedEditList);
        const xpValue = toNonNegativeInteger(editor.querySelector('[data-edit="xp"]').value);
        const card = entry.closest(".upgrade-card");
        const availableBefore = computeAvailableXpExcludingEntry(card, entry);
        const netSpent = computeNetSpentXp(removedCards, addedCards);
        if (netSpent > availableBefore + xpValue) {
          const overBy = netSpent - (availableBefore + xpValue);
          setInlineValidationMessage(
            errorNode,
            `XP exceeded by ${overBy}. Available ${availableBefore} + gained ${xpValue}, but update spends ${netSpent}.`
          );
          return;
        }
        setInlineValidationMessage(errorNode, "");
        setCards(removedList, removedCards);
        setCards(addedList, addedCards);
        if (head) {
          const scenarioLabel = getScenarioLabelFromHead(currentHeadText) || "I";
          head.textContent = formatEntryHead(scenarioLabel, xpValue);
        }
        editor.remove();
        showDisplayLayer();
        normalizeStaticEntryCardRows(entry);
        syncDerivedUpgradeState();
      });

      editor.querySelector('[data-action="cancel-edit"]').addEventListener("click", () => {
        editor.remove();
        showDisplayLayer();
      });

      editor.querySelector('[data-action="delete-entry"]').addEventListener("click", () => {
        const ok = window.confirm("Delete this scenario entry?");
        if (!ok) return;
        const upgradeList = entry.closest(".upgrade-list");
        const linkedTrauma = findLinkedTraumaRow(entry);
        const nextSibling = linkedTrauma ? linkedTrauma.nextElementSibling : entry.nextElementSibling;
        clearUndo({ forceClearPending: true });
        if (upgradeList) {
          const nextHead = nextSibling && nextSibling.classList.contains("upgrade-entry")
            ? nextSibling.querySelector(".upgrade-entry-head")
            : null;
          savePendingDelete({
            cardName: getUpgradeCardName(upgradeList),
            entryHtml: serializeEntryForPendingDelete(entry),
            traumaHtml: linkedTrauma ? linkedTrauma.outerHTML : "",
            nextEntryHead: nextHead ? nextHead.textContent.trim() : "",
            expiresAt: Date.now() + 60000,
          });
        }
        if (linkedTrauma) linkedTrauma.remove();
        entry.remove();
        if (upgradeList) {
          showUndoToast(upgradeList, entry, linkedTrauma, nextSibling, Date.now() + 60000);
        }
        syncDerivedUpgradeState();
      });

      hideDisplayLayer();
      entry.appendChild(editor);
    }

    function ensureEntryActions(entry) {
      if (!isEditEnabled()) {
        const existing = entry.querySelector(".entry-actions");
        if (existing) existing.remove();
        return;
      }
      let actions = entry.querySelector(".entry-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "entry-actions";
        entry.appendChild(actions);
      }

      let editBtn = actions.querySelector('[data-action="edit-entry"]');
      if (!editBtn) {
        editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "upgrade-btn upgrade-btn-secondary";
        editBtn.setAttribute("data-action", "edit-entry");
        editBtn.textContent = "Edit";
        actions.appendChild(editBtn);
      }
      // Always rebind to handle HTML restored from storage/undo (listeners are not persisted).
      editBtn.onclick = () => {
        attachEditor(entry);
      };
    }

    function createScenarioDraft(scenarioNumber) {
      const entry = document.createElement("div");
      entry.className = "upgrade-entry upgrade-entry-draft";
      ensureEntryUid(entry);
      entry.innerHTML = `
        <p class="upgrade-entry-head">After Scenario ${intToRoman(scenarioNumber)} (Draft)</p>
        <div class="upgrade-columns">
          <div class="upgrade-col">
            <h4>Removed</h4>
            <ul class="card-list" data-list="removed"></ul>
          </div>
          <div class="upgrade-col">
            <h4>Added</h4>
            <ul class="card-list" data-list="added"></ul>
          </div>
        </div>
        <div class="upgrade-entry-builder">
          <div class="builder-input-row">
            <label>XP Gained</label>
            <input type="number" class="upgrade-input" data-draft="xp" min="0" step="1" value="0" />
          </div>
          <div class="builder-grid">
            <div class="builder-col" data-builder="removed">
              <h5>Removed</h5>
              <div class="builder-input-row">
                <input type="text" class="upgrade-input" placeholder="Type card name..." />
                <button type="button" class="upgrade-btn upgrade-btn-secondary">Add</button>
              </div>
              <p class="builder-hint">Input a card name and click Add (or press Enter).</p>
            </div>
            <div class="builder-col" data-builder="added">
              <h5>Added</h5>
              <div class="builder-input-row">
                <input type="text" class="upgrade-input" placeholder="Type card name..." />
                <button type="button" class="upgrade-btn upgrade-btn-secondary">Add</button>
              </div>
              <p class="builder-hint">Input a card name and click Add (or press Enter).</p>
            </div>
          </div>
          <p class="builder-error" data-draft-error hidden></p>
          <div class="entry-actions">
            <button type="button" class="upgrade-btn" data-action="confirm-draft">Confirm Update</button>
            <button type="button" class="upgrade-btn upgrade-btn-danger" data-action="rollback-draft">Rollback</button>
          </div>
        </div>
      `;

      entry.querySelectorAll("[data-builder]").forEach((builderCol) => {
        const mode = builderCol.getAttribute("data-builder");
        const listEl = entry.querySelector(`.card-list[data-list="${mode}"]`);
        const input = builderCol.querySelector(".upgrade-input");
        const addBtn = builderCol.querySelector(".upgrade-btn");

        const addCardToList = (rawName) => {
          addOrIncrementCardInList(listEl, rawName);
          input.value = "";
          input.focus();
        };

        const addCardFromInput = () => {
          addCardToList(input.value);
        };

        addBtn.addEventListener("click", addCardFromInput);
        wireCardAutocomplete(input, addCardToList, addCardFromInput);
      });

      entry.querySelector('[data-action="confirm-draft"]').addEventListener("click", () => {
        const head = entry.querySelector(".upgrade-entry-head");
        const xpInput = entry.querySelector('[data-draft="xp"]');
        const draftErrorNode = entry.querySelector('[data-draft-error]');
        const xpValue = toNonNegativeInteger(xpInput ? xpInput.value : 0);
        const lists = entry.querySelectorAll(".card-list");
        const removedList = lists[0] || null;
        const addedList = lists[1] || null;
        const removedCards = removedList ? listCardNames(removedList) : [];
        const addedCards = addedList ? listCardNames(addedList) : [];
        const netSpent = computeNetSpentXp(removedCards, addedCards);
        const card = entry.closest(".upgrade-card");
        const availableBefore = computeAvailableXpExcludingEntry(card, entry);
        const budget = availableBefore + xpValue;
        if (netSpent > availableBefore + xpValue) {
          const overBy = netSpent - budget;
          setInlineValidationMessage(
            draftErrorNode,
            `XP exceeded by ${overBy}. Available ${availableBefore} + gained ${xpValue}, but update spends ${netSpent}.`
          );
          return;
        }
        setInlineValidationMessage(draftErrorNode, "");
        setCards(removedList, removedCards);
        setCards(addedList, addedCards);
        head.textContent = formatEntryHead(intToRoman(scenarioNumber), xpValue);
        const builder = entry.querySelector(".upgrade-entry-builder");
        if (builder) builder.remove();
        entry.classList.remove("upgrade-entry-draft");
        ensureEntryActions(entry);
        normalizeStaticEntryCardRows(entry);
        syncDerivedUpgradeState();
      });

      entry.querySelector('[data-action="rollback-draft"]').addEventListener("click", () => {
        const linkedTrauma = findLinkedTraumaRow(entry);
        if (linkedTrauma) linkedTrauma.remove();
        entry.remove();
        syncDerivedUpgradeState();
      });

      const draftXpInput = entry.querySelector('[data-draft="xp"]');
      if (draftXpInput) {
        ["input", "change"].forEach((evtName) => {
          draftXpInput.addEventListener(evtName, () => {
            refreshCurrentXp();
          });
        });
      }

      return entry;
    }

    function bindNewScenarioButton(upgradeList, button) {
      if (!upgradeList || !button) return;
      button.onclick = () => {
        if (!isEditEnabled()) return;
        const hasDraft = !!upgradeList.querySelector(".upgrade-entry-draft");
        if (hasDraft) return;
        const scenarioNum = nextScenarioNumber(upgradeList);
        const draftEntry = createScenarioDraft(scenarioNum);
        const traumaRow = createScenarioTraumaRow(intToRoman(scenarioNum));
        const entryUid = ensureEntryUid(draftEntry);
        traumaRow.dataset.entryUidLink = entryUid;
        upgradeList.appendChild(draftEntry);
        upgradeList.appendChild(traumaRow);
        syncDerivedUpgradeState();
      };
    }

    function addToolbar(card) {
      const upgradeList = card.querySelector(".upgrade-list");
      if (!upgradeList) return;
      const existingToolbar = upgradeList.querySelector(".upgrade-toolbar");
      if (!isEditEnabled()) {
        if (existingToolbar) existingToolbar.remove();
        return;
      }
      if (existingToolbar) {
        const existingButton = existingToolbar.querySelector('[data-action="new-scenario"]');
        bindNewScenarioButton(upgradeList, existingButton);
        return;
      }

      const toolbar = document.createElement("div");
      toolbar.className = "upgrade-toolbar";
      toolbar.innerHTML = '<button type="button" class="upgrade-btn" data-action="new-scenario">+ New Scenario</button>';
      const newScenarioBtn = toolbar.querySelector('[data-action="new-scenario"]');
      bindNewScenarioButton(upgradeList, newScenarioBtn);

      upgradeList.appendChild(toolbar);
    }

    function sanitizeUpgradeListForSave(listEl) {
      const clone = listEl.cloneNode(true);
      clone.querySelectorAll(".upgrade-toolbar, .undo-toast, .upgrade-entry-editor, .upgrade-entry-draft").forEach((node) => {
        node.remove();
      });
      clone.querySelectorAll("[data-bound]").forEach((node) => {
        node.removeAttribute("data-bound");
      });
      clone.querySelectorAll("[data-preview-bound], [data-bound], [data-card-remove-bound], [data-trauma-edit-bound]").forEach((node) => {
        node.removeAttribute("data-preview-bound");
        node.removeAttribute("data-bound");
        node.removeAttribute("data-card-remove-bound");
        node.removeAttribute("data-trauma-edit-bound");
      });
      clone.querySelectorAll(".card-preview").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.style.removeProperty("display");
        node.style.removeProperty("visibility");
        node.style.removeProperty("position");
        node.style.removeProperty("left");
        node.style.removeProperty("right");
        node.style.removeProperty("top");
        node.style.removeProperty("bottom");
        node.style.removeProperty("transform");
        node.style.removeProperty("z-index");
      });
      return clone.innerHTML;
    }

    function buildCurrentUpgradeState() {
      const state = {};
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        const name = getCardOwnerName(card);
        const upgradeList = card.querySelector(".upgrade-list");
        if (!name || !upgradeList) return;
        state[name] = sanitizeUpgradeListForSave(upgradeList);
      });
      return state;
    }

    function getOwnerNameFromCardNode(card) {
      if (!card) return "";
      const heading = card.querySelector("h3");
      if (!heading) return "";
      const dataName = heading.getAttribute("data-investigator-name");
      if (dataName) return dataName.trim();
      return heading.textContent.trim();
    }

    function sanitizeRuntimeNodesFromDoc(doc) {
      if (!doc) return;
      doc.querySelectorAll(".edit-gate").forEach((node) => node.remove());
      doc.querySelectorAll("#torch-toggle, header.site-header, nav.sticky, footer").forEach((node) => node.remove());
      doc.querySelectorAll("#hl-aria-live-message-container, #hl-aria-live-alert-container").forEach((node) => node.remove());
      doc.querySelectorAll("grammarly-desktop-integration").forEach((node) => node.remove());

      const htmlEl = doc.documentElement;
      if (htmlEl) {
        htmlEl.removeAttribute("data-preview-viewport-bound");
        htmlEl.removeAttribute("style");
      }
      const bodyEl = doc.body;
      if (bodyEl) {
        bodyEl.classList.remove("loaded");
        bodyEl.classList.remove("deck-panel-mode");
        bodyEl.removeAttribute("style");
        Array.from(bodyEl.attributes).forEach((attr) => {
          if (/^data-new-gr-c-s-check-loaded$/i.test(attr.name)) {
            bodyEl.removeAttribute(attr.name);
          }
          if (/^data-gr-ext-installed$/i.test(attr.name)) {
            bodyEl.removeAttribute(attr.name);
          }
        });
      }
      doc.querySelectorAll(".subnav a.is-active").forEach((node) => node.classList.remove("is-active"));
      doc.querySelectorAll(".card-preview").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.style.removeProperty("display");
        node.style.removeProperty("visibility");
        node.style.removeProperty("position");
        node.style.removeProperty("left");
        node.style.removeProperty("right");
        node.style.removeProperty("top");
        node.style.removeProperty("bottom");
        node.style.removeProperty("transform");
        node.style.removeProperty("z-index");
      });
    }

    function buildPersistableHtml(sourceHtml, state) {
      const parser = new window.DOMParser();
      const sourceDoc = parser.parseFromString(String(sourceHtml || ""), "text/html");
      sourceDoc.querySelectorAll(".upgrade-card").forEach((card) => {
        const ownerName = getOwnerNameFromCardNode(card);
        const upgradeList = card.querySelector(".upgrade-list");
        if (!ownerName || !upgradeList) return;
        if (typeof state[ownerName] === "string") {
          upgradeList.innerHTML = state[ownerName];
        }
      });
      sanitizeRuntimeNodesFromDoc(sourceDoc);
      return "<!DOCTYPE html>\n" + sourceDoc.documentElement.outerHTML;
    }

    async function requestGitHubFileMeta(token) {
      if (!remoteSync) return "";
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(remoteSync.owner)}/${encodeURIComponent(remoteSync.repo)}/contents/${encodeURIComponent(remoteSync.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(remoteSync.branch)}`;
      const response = await window.fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub read failed (${response.status})`);
      }
      const payload = await response.json();
      if (!payload || typeof payload.sha !== "string") {
        throw new Error("GitHub response missing file SHA");
      }
      const encodedContent = typeof payload.content === "string" ? payload.content : "";
      const sourceHtml = encodedContent ? fromBase64Utf8(encodedContent.replace(/\n/g, "")) : "";
      return {
        sha: payload.sha,
        sourceHtml,
      };
    }

    async function pushHtmlToGitHub(state) {
      if (!remoteSync) return;
      const token = getRemoteSyncToken();
      if (!token) {
        refreshRemoteSyncUi("GitHub token missing");
        return;
      }
      const fileMeta = await requestGitHubFileMeta(token);
      const htmlText = buildPersistableHtml(fileMeta.sourceHtml, state);
      const nextHash = makeQuickHash(htmlText);
      if (nextHash === lastSyncedHtmlHash) return;

      const endpoint = `https://api.github.com/repos/${encodeURIComponent(remoteSync.owner)}/${encodeURIComponent(remoteSync.repo)}/contents/${encodeURIComponent(remoteSync.filePath).replace(/%2F/g, "/")}`;
      const now = new Date();
      const message = `auto-sync deck upgrade ${now.toISOString().slice(0, 19)}Z`;
      const response = await window.fetch(endpoint, {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          content: toBase64Utf8(htmlText),
          branch: remoteSync.branch,
          sha: fileMeta.sha,
        }),
      });
      if (!response.ok) {
        throw new Error(`GitHub write failed (${response.status})`);
      }
      lastSyncedHtmlHash = nextHash;
    }

    async function runRemoteSyncNow() {
      if (!remoteSync) return;
      if (remoteSyncInFlight) {
        remoteSyncQueued = true;
        return;
      }
      remoteSyncInFlight = true;
      refreshRemoteSyncUi("Syncing HTML to GitHub...");
      try {
        const state = buildCurrentUpgradeState();
        await pushHtmlToGitHub(state);
        const syncedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        refreshRemoteSyncUi(`GitHub synced at ${syncedAt}`);
      } catch (error) {
        const message = error && error.message ? error.message : "GitHub sync failed";
        refreshRemoteSyncUi(message);
      } finally {
        remoteSyncInFlight = false;
        if (remoteSyncQueued) {
          remoteSyncQueued = false;
          window.setTimeout(() => {
            void runRemoteSyncNow();
          }, 300);
        }
      }
    }

    function scheduleRemoteSync() {
      if (!remoteSync) return;
      if (!remoteSyncReady) return;
      if (requireEditPassword && !isEditEnabled()) return;
      if (!getRemoteSyncToken()) {
        refreshRemoteSyncUi();
        return;
      }
      if (remoteSyncTimer) {
        window.clearTimeout(remoteSyncTimer);
      }
      remoteSyncTimer = window.setTimeout(() => {
        remoteSyncTimer = null;
        void runRemoteSyncNow();
      }, remoteSyncDebounceMs);
    }

    function openRemoteSyncPrompt() {
      if (!remoteSync) return;
      const existing = getRemoteSyncToken();
      const input = window.prompt(
        [
          "Paste a GitHub Personal Access Token with repository content write access.",
          `Target: ${getRemoteSyncConfigLabel()} (${remoteSync.filePath})`,
          "Leave blank to disconnect sync.",
        ].join("\n"),
        existing
      );
      if (input === null) return;
      const nextToken = String(input || "").trim();
      setRemoteSyncToken(nextToken);
      lastSyncedHtmlHash = "";
      if (nextToken) {
        refreshRemoteSyncUi("GitHub connected. Pending first sync...");
        scheduleRemoteSync();
      } else {
        refreshRemoteSyncUi("GitHub sync disconnected");
      }
    }

    function saveUpgradeState() {
      try {
        const state = buildCurrentUpgradeState();
        const nextRaw = JSON.stringify(state);
        if (nextRaw === lastSavedStateRaw) return;
        window.localStorage.setItem(storageKey, nextRaw);
        lastSavedStateRaw = nextRaw;
        scheduleRemoteSync();
      } catch (_error) {
        // Ignore storage failures.
      }
    }

    function scheduleSaveUpgradeState() {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }
      saveTimer = window.setTimeout(() => {
        saveUpgradeState();
        saveTimer = null;
      }, 120);
    }

    function syncDerivedUpgradeState() {
      scheduleSaveUpgradeState();
      refreshCurrentXp();
      refreshTraumaStatus();
    }

    function restoreUpgradeState() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state || typeof state !== "object") return;

        document.querySelectorAll(".upgrade-card").forEach((card) => {
          const name = getCardOwnerName(card);
          const upgradeList = card.querySelector(".upgrade-list");
          if (!name || !upgradeList) return;
          if (typeof state[name] === "string") {
            upgradeList.innerHTML = state[name];
          }
        });
        lastSavedStateRaw = JSON.stringify(state);
      } catch (_error) {
        // Ignore malformed storage.
      }
    }

    function watchUpgradeChanges() {
      const root = document.querySelector(rootSelector + " .upgrade-grid");
      if (!root) return;
      const observer = new MutationObserver(() => {
        scheduleSaveUpgradeState();
        refreshCurrentXp();
      });
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    function bindPreviewFallbacks(container) {
      const root = container || document;
      const previewMargin = 8;
      const previewGap = 10;

      function getActiveCardRef() {
        return window.__bgbActiveCardRef || null;
      }

      function setActiveCardRef(cardRef) {
        window.__bgbActiveCardRef = cardRef || null;
      }

      function resetCardPreviewPosition(preview) {
        if (!preview) return;
        if (window.BGB && typeof window.BGB.resetHoverPreviewStyles === "function") {
          window.BGB.resetHoverPreviewStyles(preview);
        }
        preview.style.removeProperty("display");
        preview.style.removeProperty("visibility");
        preview.style.removeProperty("position");
        preview.style.removeProperty("left");
        preview.style.removeProperty("right");
        preview.style.removeProperty("top");
        preview.style.removeProperty("bottom");
        preview.style.removeProperty("transform");
        preview.style.removeProperty("z-index");
      }

      function forceShowCardPreview(preview) {
        if (!preview) return;
        preview.style.setProperty("display", "block", "important");
        preview.style.setProperty("visibility", "visible", "important");
      }

      function clampCardPreviewPosition(cardRef) {
        if (!cardRef) return;
        const preview = cardRef.querySelector(".card-preview");
        if (!preview) return;
        // Ensure measurable box on first hover frame.
        forceShowCardPreview(preview);
        preview.style.removeProperty("position");
        preview.style.removeProperty("left");
        preview.style.removeProperty("right");
        preview.style.removeProperty("top");
        preview.style.removeProperty("bottom");
        preview.style.removeProperty("transform");
        preview.style.removeProperty("z-index");

        const rect = preview.getBoundingClientRect();
        const width = rect.width || 0;
        const height = rect.height || 0;
        if (!width || !height) return;

        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
        if (!viewportWidth || !viewportHeight) return;

        const overflowLeft = rect.left < previewMargin;
        const overflowRight = rect.right > (viewportWidth - previewMargin);
        const overflowTop = rect.top < previewMargin;
        if (!(overflowLeft || overflowRight || overflowTop)) {
          // Keep default CSS hover behavior when within viewport.
          preview.style.removeProperty("display");
          preview.style.removeProperty("visibility");
          return;
        }

        const clamp = (value, min, max) => {
          if (max < min) return min;
          return Math.min(Math.max(value, min), max);
        };

        const anchor = cardRef.getBoundingClientRect();
        let left = anchor.left + (anchor.width / 2) - (width / 2);
        left = clamp(left, previewMargin, viewportWidth - width - previewMargin);

        let top = anchor.top - previewGap - height;
        if (top < previewMargin) {
          top = anchor.bottom + previewGap;
        }
        top = clamp(top, previewMargin, viewportHeight - height - previewMargin);

        preview.style.position = "fixed";
        preview.style.left = Math.round(left) + "px";
        preview.style.top = Math.round(top) + "px";
        preview.style.right = "auto";
        preview.style.bottom = "auto";
        preview.style.transform = "none";
        preview.style.zIndex = "2147483000";
      }

      function refreshActivePreview() {
        const activeCardRef = getActiveCardRef();
        if (!activeCardRef) return;
        if (!(activeCardRef.matches(":hover") || activeCardRef.contains(document.activeElement))) {
          const preview = activeCardRef.querySelector(".card-preview");
          resetCardPreviewPosition(preview);
          setActiveCardRef(null);
          return;
        }
        clampCardPreviewPosition(activeCardRef);
      }

      if (root === document && document.documentElement.dataset.previewViewportBound !== "1") {
        document.documentElement.dataset.previewViewportBound = "1";
        window.addEventListener("scroll", () => {
          window.requestAnimationFrame(refreshActivePreview);
        }, { passive: true });
        window.addEventListener("resize", () => {
          window.requestAnimationFrame(refreshActivePreview);
        }, { passive: true });
      }

      root.querySelectorAll(".card-ref").forEach((cardRef) => {
        if (cardRef.__bgbPreviewBound === true) return;
        cardRef.__bgbPreviewBound = true;
        if (cardRef instanceof HTMLElement) {
          cardRef.removeAttribute("data-preview-bound");
        }

        const activate = () => {
          setActiveCardRef(cardRef);
          const preview = cardRef.querySelector(".card-preview");
          forceShowCardPreview(preview);
          window.requestAnimationFrame(() => {
            clampCardPreviewPosition(cardRef);
          });
        };

        const move = () => {
          if (getActiveCardRef() !== cardRef) return;
          const preview = cardRef.querySelector(".card-preview");
          forceShowCardPreview(preview);
          window.requestAnimationFrame(() => {
            clampCardPreviewPosition(cardRef);
          });
        };

        const reset = () => {
          const preview = cardRef.querySelector(".card-preview");
          resetCardPreviewPosition(preview);
          if (getActiveCardRef() === cardRef) {
            setActiveCardRef(null);
          }
        };

        cardRef.addEventListener("mouseenter", activate);
        cardRef.addEventListener("mousemove", move);
        cardRef.addEventListener("focusin", activate);
        cardRef.addEventListener("mouseleave", reset);
        cardRef.addEventListener("focusout", reset);
      });

      root.querySelectorAll("img.card-preview").forEach((img) => {
        if (img.__bgbPreviewImgBound === true) return;
        img.__bgbPreviewImgBound = true;
        if (img instanceof HTMLElement) {
          img.removeAttribute("data-bound");
        }
        img.addEventListener("error", () => {
          const cardRef = img.closest(".card-ref");
          const cardName = cardRef ? getCardNameFromRef(cardRef) : img.alt || "Unknown Card";
          img.replaceWith(buildPlaceholderPreview(cardName));
        });
      });
    }

    function bindCardRemoveDelegation() {
      const root = document.querySelector(rootSelector + " .upgrade-grid");
      if (!root || root.dataset.cardRemoveBound === "1") return;
      root.dataset.cardRemoveBound = "1";

      root.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const removeBtn = target.closest(".draft-card-remove");
        if (!removeBtn) return;
        if (!isEditEnabled()) return;

        const row = removeBtn.closest("li");
        if (!row) return;
        event.preventDefault();
        event.stopPropagation();
        decrementOrRemoveCardRow(row);
        syncDerivedUpgradeState();
      });
    }

    function setupExistingPreviewFallbacks() {
      bindPreviewFallbacks(document);
    }

    function extractFileNameFromSrc(src) {
      const text = String(src || "");
      const clean = text.split("?")[0].split("#")[0];
      const parts = clean.split("/");
      return parts.length ? parts[parts.length - 1] : "";
    }

    function extractQuantitySuffix(nameText) {
      const match = String(nameText || "").match(/\(\s*x\s*\d+\s*\)\s*$/i);
      if (!match) return "";
      const num = match[0].match(/\d+/);
      if (!num) return "";
      return "(x" + Number(num[0]) + ")";
    }

    function findStandardNameByFile(fileName) {
      const file = String(fileName || "").trim();
      if (!file) return "";
      const inferred = toDisplayNameFromFile(file);
      const inferredKey = getCatalogKey(inferred);
      if (!inferredKey) return inferred;
      const fromStandard = standardCardNames.find((name) => getCatalogKey(name) === inferredKey);
      return fromStandard || inferred;
    }

    function replaceCardRefText(cardRef, nextText) {
      const text = String(nextText || "").trim();
      if (!text) return;
      const first = cardRef.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) {
        first.textContent = text;
      } else {
        cardRef.insertBefore(document.createTextNode(text), first || null);
      }
    }

    function normalizeExistingCardNames() {
      let changed = false;
      document.querySelectorAll(".card-list .card-ref").forEach((cardRef) => {
        const currentName = getCardNameFromRef(cardRef);
        if (!currentName) return;
        const qty = extractQuantitySuffix(currentName);
        const img = cardRef.querySelector("img.card-preview");

        let normalizedBase = "";
        if (img && img.getAttribute("src")) {
          normalizedBase = findStandardNameByFile(extractFileNameFromSrc(img.getAttribute("src")));
        }
        if (!normalizedBase) {
          normalizedBase = normalizeCardNameInput(currentName);
        }
        if (!normalizedBase) return;

        const nextName = qty ? (normalizedBase + " " + qty) : normalizedBase;
        if (nextName !== currentName) {
          replaceCardRefText(cardRef, nextName);
          changed = true;
        }
        if (cardRef instanceof HTMLElement && cardRef.hasAttribute("data-preview-bound")) {
          cardRef.removeAttribute("data-preview-bound");
          changed = true;
        }
        const previewNode = cardRef.querySelector(".card-preview");
        const preferredSrc = findExactImage(normalizedBase);
        if (previewNode instanceof HTMLElement) {
          previewNode.style.removeProperty("display");
          previewNode.style.removeProperty("visibility");
          previewNode.style.removeProperty("position");
          previewNode.style.removeProperty("left");
          previewNode.style.removeProperty("right");
          previewNode.style.removeProperty("top");
          previewNode.style.removeProperty("bottom");
          previewNode.style.removeProperty("transform");
          previewNode.style.removeProperty("z-index");
          if (previewNode.hasAttribute("data-bound")) {
            previewNode.removeAttribute("data-bound");
            changed = true;
          }
        }
        if (img && img.getAttribute("alt") !== normalizedBase) {
          img.setAttribute("alt", normalizedBase);
          changed = true;
        }
        if (img && preferredSrc && img.getAttribute("src") !== preferredSrc) {
          img.setAttribute("src", preferredSrc);
          changed = true;
        }

        // Recover from previously persisted placeholder previews in localStorage.
        if (!img || (previewNode && previewNode.classList.contains("card-preview-placeholder"))) {
          if (previewNode) previewNode.remove();
          cardRef.appendChild(buildPreviewNode(normalizedBase));
          changed = true;
        }
      });

      if (changed) {
        bindPreviewFallbacks(document);
        scheduleSaveUpgradeState();
      }
    }

    function restorePendingDelete() {
      const pending = readPendingDelete();
      if (!pending) return;

      const expiresAt = Number(pending.expiresAt) || 0;
      if (expiresAt <= Date.now()) {
        clearPendingDelete();
        return;
      }

      const cardName = String(pending.cardName || "");
      const entryHtml = String(pending.entryHtml || "");
      const traumaHtml = String(pending.traumaHtml || "");
      if (!cardName || !entryHtml) {
        clearPendingDelete();
        return;
      }

      const targetCard = Array.from(document.querySelectorAll(".upgrade-card")).find((card) => {
        return getCardOwnerName(card) === cardName;
      });
      if (!targetCard) {
        clearPendingDelete();
        return;
      }

      const upgradeList = targetCard.querySelector(".upgrade-list");
      if (!upgradeList) {
        clearPendingDelete();
        return;
      }

      const temp = document.createElement("div");
      temp.innerHTML = entryHtml.trim();
      const entry = temp.firstElementChild;
      if (!entry) {
        clearPendingDelete();
        return;
      }
      entry.querySelectorAll(".upgrade-entry-editor").forEach((node) => node.remove());
      entry.querySelectorAll("[data-bound]").forEach((node) => {
        node.removeAttribute("data-bound");
      });
      ensureEntryUid(entry);

      let traumaRow = null;
      if (traumaHtml) {
        const traumaTemp = document.createElement("div");
        traumaTemp.innerHTML = traumaHtml.trim();
        traumaRow = traumaTemp.firstElementChild;
      }
      if (!traumaRow) {
        const head = entry.querySelector(".upgrade-entry-head");
        const scenarioLabel = getScenarioLabelFromHead(head ? head.textContent : "");
        if (scenarioLabel) {
          traumaRow = createScenarioTraumaRow(scenarioLabel);
        }
      }
      if (traumaRow) {
        traumaRow.classList.add("scenario-trauma");
        traumaRow.dataset.entryUidLink = String(entry.dataset.entryUid || "");
      }

      let nextSibling = null;
      const nextHeadText = String(pending.nextEntryHead || "");
      if (nextHeadText) {
        nextSibling = Array.from(upgradeList.querySelectorAll(".upgrade-entry")).find((item) => {
          const head = item.querySelector(".upgrade-entry-head");
          return head && head.textContent.trim() === nextHeadText;
        }) || null;
      }

      showUndoToast(upgradeList, entry, traumaRow, nextSibling, expiresAt);
    }

    function refreshTraumaStatus() {
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        const traumaRows = card.querySelectorAll(".scenario-trauma");
        let physical = 0;
        let mental = 0;

        traumaRows.forEach((row) => {
          physical += Number(row.dataset.physical || 0);
          mental += Number(row.dataset.mental || 0);
        });

        const status = card.querySelector(".current-trauma-status");
        if (status) {
          status.textContent = `Current Trauma Status: Physical ${physical}, Mental ${mental}.`;
        }
      });
    }

    function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getTraumaLabel(row) {
      const saved = String(row.dataset.traumaLabel || "").trim();
      if (saved) return saved;
      const text = String(row.textContent || "");
      const match = text.match(/^(.*?:)\s*Physical\s*\d+\s*,\s*Mental\s*\d+\s*\.?$/i);
      if (match && match[1]) return match[1].trim();
      return "Trauma:";
    }

    function renderTraumaRow(row) {
      if (!row) return;
      const label = getTraumaLabel(row);
      const physical = toNonNegativeInteger(row.dataset.physical || 0);
      const mental = toNonNegativeInteger(row.dataset.mental || 0);
      row.dataset.physical = String(physical);
      row.dataset.mental = String(mental);
      row.dataset.traumaLabel = label;
      row.innerHTML = `${escapeHtml(label)} Physical <button type="button" class="trauma-value" data-trauma-field="physical">${physical}</button>, Mental <button type="button" class="trauma-value" data-trauma-field="mental">${mental}</button>.`;
    }

    function startTraumaInlineEdit(button) {
      if (!button || !isEditEnabled()) return;
      if (button.closest(".scenario-trauma")?.querySelector(".trauma-input")) return;
      const row = button.closest(".scenario-trauma");
      if (!row) return;
      const field = button.getAttribute("data-trauma-field");
      if (field !== "physical" && field !== "mental") return;
      const currentValue = toNonNegativeInteger(row.dataset[field] || button.textContent || 0);

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.className = "trauma-input";
      input.value = String(currentValue);

      const commit = () => {
        const next = toNonNegativeInteger(input.value);
        row.dataset[field] = String(next);
        renderTraumaRow(row);
        syncDerivedUpgradeState();
      };

      const cancel = () => {
        renderTraumaRow(row);
      };

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      });
      input.addEventListener("blur", commit, { once: true });

      button.replaceWith(input);
      input.focus();
      input.select();
    }

    function bindTraumaInlineEditing() {
      const root = document.querySelector(rootSelector + " .upgrade-grid");
      if (!root || root.dataset.traumaEditBound === "1") return;
      root.dataset.traumaEditBound = "1";

      root.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const valueBtn = target.closest(".trauma-value");
        if (!valueBtn) return;
        event.preventDefault();
        startTraumaInlineEdit(valueBtn);
      });
    }

    function normalizeScenarioTraumaRows() {
      document.querySelectorAll(".upgrade-entry").forEach((entry) => {
        ensureEntryUid(entry);
      });
      document.querySelectorAll(".scenario-trauma").forEach((row) => {
        renderTraumaRow(row);
        if (!row.dataset.entryUidLink) {
          const prevEntry = row.previousElementSibling;
          if (prevEntry && prevEntry.classList.contains("upgrade-entry")) {
            row.dataset.entryUidLink = ensureEntryUid(prevEntry);
          }
        }
      });
    }

    function parseAllXpFromCard(card) {
      const earned = computeEarnedXp(card, null);
      let spent = 0;

      card.querySelectorAll(".upgrade-entry").forEach((entry) => {
        if (entry.classList.contains("upgrade-entry-draft")) return;
        spent += getEntryNetSpentXp(entry);
      });

      // Surface overspending as negative XP instead of masking it as 0.
      return earned - spent;
    }

    function getPendingXpPreviewDelta(card) {
      if (!card) return 0;
      let delta = 0;

      // Draft entries are not committed yet, so preview contributes full XP gained.
      card.querySelectorAll(".upgrade-entry-draft").forEach((entry) => {
        const xpInput = entry.querySelector('[data-draft="xp"]');
        const xpValue = toNonNegativeInteger(xpInput ? xpInput.value : 0);
        delta += xpValue;
      });

      // Editors are opened on committed entries, so preview contributes only delta.
      card.querySelectorAll(".upgrade-entry-editor").forEach((editor) => {
        const entry = editor.closest(".upgrade-entry");
        if (!entry) return;
        const head = entry.querySelector(".upgrade-entry-head");
        const currentXp = getXpFromHead(head ? head.textContent : "");
        const xpInput = editor.querySelector('[data-edit="xp"]');
        const previewXp = toNonNegativeInteger(xpInput ? xpInput.value : currentXp);
        delta += (previewXp - currentXp);
      });

      return delta;
    }

    function refreshCurrentXp() {
      document.querySelectorAll(".upgrade-card").forEach((card) => {
        const xpLine = card.querySelector(".xp-line");
        if (!xpLine) return;
        const totalXp = parseAllXpFromCard(card) + getPendingXpPreviewDelta(card);
        const nextText = "Current XP: " + totalXp;
        if (xpLine.textContent.trim() !== nextText) {
          xpLine.textContent = nextText;
        }
      });
    }

    applyAdaptivePreviewSize();
    window.addEventListener("resize", () => {
      applyAdaptivePreviewSize();
    }, { passive: true });

    restoreUpgradeState();
    normalizeExistingCardNames();
    document.querySelectorAll(".upgrade-entry").forEach((entry) => {
      normalizeStaticEntryCardRows(entry);
    });
    // Ensure upgrade page hover previews are never suppressed by deck panel mode.
    document.body.classList.remove("deck-panel-mode");
    setupExistingPreviewFallbacks();
    bindCardRemoveDelegation();
    bindTraumaInlineEditing();
    normalizeScenarioTraumaRows();
    decorateInvestigatorHeaders();
    bindPreviewFallbacks(document);
    renderEditGate();
    bindInactivityTracking();
    document.querySelectorAll(".upgrade-entry").forEach((entry) => {
      ensureEntryActions(entry);
    });
    document.querySelectorAll(".upgrade-card").forEach((card) => {
      addToolbar(card);
    });
    if (isEditEnabled()) {
      restorePendingDelete();
      pendingRestoreDone = true;
    }
    watchUpgradeChanges();
    try {
      lastSavedStateRaw = JSON.stringify(buildCurrentUpgradeState());
    } catch (_error) {
      // Ignore serialization failures.
    }
    remoteSyncReady = true;
    scheduleSaveUpgradeState();
    window.addEventListener("beforeunload", () => {
      saveUpgradeState();
    });
    refreshCurrentXp();
    refreshTraumaStatus();
  }

  window.initAhlcgUpgradeManager = initAhlcgUpgradeManager;
})();
