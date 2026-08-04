(function () {
  function initAhlcgUpgradeManager(config) {
    const options = config || {};
    const githubSync = window.BGBGitHubSync && typeof window.BGBGitHubSync === "object"
      ? window.BGBGitHubSync
      : null;
    const cardDir = options.cardDir || "/assets/boardgames/ahlcg_cards";
    const investigatorDir = options.investigatorDir || "/assets/boardgames/ahlcg_investigators";
    const cardImageFiles = Array.isArray(options.cardImageFiles) ? options.cardImageFiles : [];
    const standardCardNames = Array.isArray(options.standardCardNames) ? options.standardCardNames : [];
    const myriadCardNames = Array.isArray(options.myriadCardNames) ? options.myriadCardNames : [];
    const exceptionalCardNames = Array.isArray(options.exceptionalCardNames) ? options.exceptionalCardNames : [];
    const customizableCardNames = Array.isArray(options.customizableCardNames) ? options.customizableCardNames : [];
    const signatureCardNames = Array.isArray(options.signatureCardNames) ? options.signatureCardNames : [];
    const permanentCardNames = Array.isArray(options.permanentCardNames) ? options.permanentCardNames : [];
    const customizableLibraryCards = window.AHLCG_CUSTOMIZABLE_LIBRARY && typeof window.AHLCG_CUSTOMIZABLE_LIBRARY === "object"
      && window.AHLCG_CUSTOMIZABLE_LIBRARY.cards && typeof window.AHLCG_CUSTOMIZABLE_LIBRARY.cards === "object"
      ? window.AHLCG_CUSTOMIZABLE_LIBRARY.cards
      : {};
    const customizableBaselineSource = options.customizableBaselineState && typeof options.customizableBaselineState === "object"
      ? options.customizableBaselineState
      : (window.BGB_AHLCG_CUSTOMIZABLE_STATE && typeof window.BGB_AHLCG_CUSTOMIZABLE_STATE === "object"
        ? window.BGB_AHLCG_CUSTOMIZABLE_STATE
        : {});
    const customizableInitialSource = options.customizableInitialState && typeof options.customizableInitialState === "object"
      ? options.customizableInitialState
      : customizableBaselineSource;
    const initialDecks = normalizeInitialDeckMap(options.initialDecks);
    const storageKey = options.storageKey || "ahlcg_upgrade_state_default_v1";
    const pendingDeleteKey = storageKey + "__pending_delete_v1";
    const rootSelector = options.rootSelector || "#upgrade-history";
    const configuredPassword = typeof options.editPassword === "string" ? options.editPassword : "";
    const onTcuPage = /arkham_horror_lcg_tcu_20260215(?:\.html)?\/?$/i.test(String(window.location.pathname || ""));
    const fallbackPassword = onTcuPage ? "bgbzhangyan2026" : "";
    const editPassword = String(configuredPassword || fallbackPassword);
    const requireEditPassword = editPassword.length > 0;
    const inactivityMs = Number(options.inactivityMs) > 0 ? Number(options.inactivityMs) : 120000;
    const remoteSync = githubSync && typeof githubSync.normalizeConfig === "function"
      ? githubSync.normalizeConfig(options.remoteSync)
      : null;
    const remoteSyncTokenStorageKey = typeof options.remoteSyncTokenStorageKey === "string" && options.remoteSyncTokenStorageKey.trim()
      ? options.remoteSyncTokenStorageKey.trim()
      : "bgb_github_sync_token_v1";
    const buildPersistableContent = typeof options.buildPersistableContent === "function"
      ? options.buildPersistableContent
      : null;
    const localStateEnvelope = window.BGBLocalStateEnvelope && typeof window.BGBLocalStateEnvelope === "object"
      ? window.BGBLocalStateEnvelope
      : null;
    const campaignStartNote = options.campaignStartNote && typeof options.campaignStartNote === "object"
      ? options.campaignStartNote
      : null;
    const campaignStartDate = campaignStartNote && typeof campaignStartNote.date === "string"
      ? campaignStartNote.date.trim()
      : "";
    const campaignStartRunName = campaignStartNote && typeof campaignStartNote.runName === "string"
      ? campaignStartNote.runName.trim()
      : "";

    const cardCatalog = cardImageFiles.map((file) => ({
      file,
      key: normalizeText(file.replace(/\.png$/i, "")),
      level: getLevelFromFileName(file),
    }));
    const exceptionalCatalogKeys = exceptionalCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const myriadCatalogKeys = myriadCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const exceptionalNameOnlySet = new Set(
      exceptionalCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );
    const myriadNameOnlySet = new Set(
      myriadCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );
    const customizableCatalogKeys = customizableCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const customizableNameOnlySet = new Set(
      customizableCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );
    const signatureCatalogKeys = signatureCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const signatureNameOnlySet = new Set(
      signatureCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );
    const permanentCatalogKeys = permanentCardNames
      .map((name) => getCatalogKey(name))
      .filter(Boolean);
    const permanentNameOnlySet = new Set(
      permanentCatalogKeys.map((key) => getNameOnly(key)).filter(Boolean)
    );
    const deckSizeAdjustmentRules = [
      {
        cardKey: getCatalogKey("Versatile (2)"),
        nameOnly: getNameOnly(getCatalogKey("Versatile (2)")),
        freeLevel0Cards: 5,
        deckSlots: 0,
      },
    ].filter((rule) => rule.cardKey && rule.nameOnly && rule.freeLevel0Cards > 0);
    const customizableBaselineState = normalizeCustomizableBaselineState(customizableInitialSource);

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
    let remoteSyncInFlight = false;
    let remoteSyncQueued = false;
    let lastSyncedHtmlHash = "";
    let remoteSyncReady = false;
    let lastSavedStateRaw = "";
    let sourceStateHashAtLoad = "";
    let entryUidCounter = 1;
    let activeCustomizableEditor = null;
    let activeCustomizableEditorRow = null;
    let activeCustomizableEditorAnchor = null;
    let customizableEditorOutsideHandler = null;
    let customizableEditorEscapeHandler = null;
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

    function normalizeCustomizableBaselineState(rawState) {
      const normalized = {};
      if (!rawState || typeof rawState !== "object") return normalized;
      Object.keys(rawState).forEach((investigatorName) => {
        const investigatorKey = normalizeText(investigatorName);
        if (!investigatorKey) return;
        const cardMap = rawState[investigatorName];
        if (!cardMap || typeof cardMap !== "object") return;
        normalized[investigatorKey] = {};
        Object.keys(cardMap).forEach((cardName) => {
          const cardKey = getCatalogKey(cardName);
          if (!cardKey) return;
          const rawIds = Array.isArray(cardMap[cardName]) ? cardMap[cardName] : [];
          normalized[investigatorKey][cardKey] = rawIds
            .map((id) => String(id || "").trim())
            .filter(Boolean);
        });
      });
      return normalized;
    }

    function getCustomizableDefinition(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return null;
      return customizableLibraryCards[key] || null;
    }

    function normalizeInitialDeckMap(rawDecks) {
      const normalized = {};
      if (!rawDecks || typeof rawDecks !== "object") return normalized;
      Object.keys(rawDecks).forEach((investigatorName) => {
        const investigatorKey = normalizeText(investigatorName);
        if (!investigatorKey) return;
        const rows = Array.isArray(rawDecks[investigatorName]) ? rawDecks[investigatorName] : [];
        normalized[investigatorKey] = rows
          .map((row) => {
            if (typeof row === "string") return { name: row, qty: getCardQuantity(row) };
            const name = String(row && row.name ? row.name : "").trim();
            const qty = Number(row && row.qty);
            return {
              name,
              qty: Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : getCardQuantity(name),
            };
          })
          .filter((row) => row.name && row.qty > 0);
      });
      return normalized;
    }

    function getCustomizableGroupIds(group) {
      const boxes = Number(group && group.boxes) > 0 ? Number(group.boxes) : 0;
      const baseId = String(group && group.id ? group.id : "").trim();
      if (!baseId || boxes <= 0) return [];
      return Array.from({ length: boxes }, (_, idx) => `${baseId}.${idx + 1}`);
    }

    function getCustomizableGroupBoxLabel(group, idx) {
      const labels = Array.isArray(group && group.boxLabels) ? group.boxLabels : [];
      const label = labels[idx];
      return label !== undefined && label !== null && String(label).trim()
        ? String(label).trim()
        : String(idx + 1);
    }

    function getCustomizableGroupBoxXp(group, idx) {
      const boxXp = Array.isArray(group && group.boxXp) ? Number(group.boxXp[idx]) : NaN;
      if (Number.isFinite(boxXp) && boxXp > 0) return boxXp;
      const boxes = Number(group && group.boxes) > 0 ? Number(group.boxes) : 0;
      const xpTotal = Number(group && group.xpTotal);
      if (boxes === 1 && Number.isFinite(xpTotal) && xpTotal > 0) return xpTotal;
      return 1;
    }

    function getCustomizableGroupSelectedXp(group, idSet) {
      const selectedSet = idSet instanceof Set ? idSet : new Set(uniqueIds(idSet));
      return getCustomizableGroupIds(group).reduce((total, id, idx) => (
        selectedSet.has(id) ? total + getCustomizableGroupBoxXp(group, idx) : total
      ), 0);
    }

    function getCustomizableUpgradeIdsSpentXp(definition, upgradeIds) {
      const idSet = new Set(uniqueIds(upgradeIds));
      return (definition && Array.isArray(definition.groups) ? definition.groups : []).reduce((total, group) => (
        total + getCustomizableGroupSelectedXp(group, idSet)
      ), 0);
    }

    function getCustomizableAllIds(definition) {
      return (definition && Array.isArray(definition.groups) ? definition.groups : [])
        .flatMap((group) => getCustomizableGroupIds(group));
    }

    function getCustomizableBaselineIds(investigatorName, cardName) {
      const investigatorKey = normalizeText(investigatorName);
      const cardKey = getCatalogKey(cardName);
      if (!investigatorKey || !cardKey) return [];
      const investigatorState = customizableBaselineState[investigatorKey];
      if (!investigatorState || typeof investigatorState !== "object") return [];
      return Array.isArray(investigatorState[cardKey]) ? investigatorState[cardKey].slice() : [];
    }

    function parseCustomizableIdList(value) {
      return String(value || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    }

    function uniqueIds(ids) {
      return Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean)));
    }

    function normalizeCustomizableFields(rawFields) {
      const normalized = {};
      if (!rawFields || typeof rawFields !== "object") return normalized;
      Object.keys(rawFields).forEach((fieldId) => {
        const id = String(fieldId || "").trim();
        if (!id) return;
        normalized[id] = String(rawFields[fieldId] == null ? "" : rawFields[fieldId]).trim();
      });
      return normalized;
    }

    function getCustomizableFieldsForRow(row) {
      if (!row || !row.dataset || !row.dataset.customizableFields) return {};
      try {
        return normalizeCustomizableFields(JSON.parse(row.dataset.customizableFields));
      } catch (_error) {
        return {};
      }
    }

    function setCustomizableFieldsForRow(row, fields) {
      if (!row || !row.dataset) return;
      const next = normalizeCustomizableFields(fields);
      if (Object.keys(next).length) {
        row.dataset.customizableFields = JSON.stringify(next);
      } else {
        delete row.dataset.customizableFields;
      }
    }

    function setCustomizableFieldValueForRow(row, fieldId, value) {
      if (!row || !fieldId) return;
      const fields = getCustomizableFieldsForRow(row);
      fields[String(fieldId).trim()] = String(value == null ? "" : value).trim();
      setCustomizableFieldsForRow(row, fields);
    }

    function getCustomizableDefinitionFields(definition) {
      return Array.isArray(definition && definition.fields)
        ? definition.fields.filter((field) => field && field.id)
        : [];
    }

    function getCustomizableGroupFields(group) {
      return Array.isArray(group && group.fields)
        ? group.fields.filter((field) => field && field.id)
        : [];
    }

    function getCustomizableFieldLabel(field) {
      return String(field && field.label ? field.label : "Trait").trim();
    }

    function getCustomizableFieldPlaceholder(field) {
      return String(field && field.placeholder ? field.placeholder : "").trim();
    }

    function getGroupCheckedCount(group, ids) {
      const idSet = new Set(Array.isArray(ids) ? ids : []);
      return getCustomizableGroupIds(group).filter((id) => idSet.has(id)).length;
    }

    function getRemoteSyncToken() {
      if (!remoteSync || !githubSync || typeof githubSync.getToken !== "function") return "";
      return githubSync.getToken(remoteSyncTokenStorageKey);
    }

    function getCampaignStartNoteText() {
      if (!campaignStartDate || !campaignStartRunName) return "";
      return `Campaign Start (${campaignStartDate}): Base deck recorded for the ${campaignStartRunName} run.`;
    }

    function setRemoteSyncToken(nextToken) {
      if (!remoteSync || !githubSync || typeof githubSync.setToken !== "function") return;
      githubSync.setToken(remoteSyncTokenStorageKey, nextToken);
    }

    function getRemoteSyncConfigLabel() {
      return githubSync && typeof githubSync.getConfigLabel === "function"
        ? githubSync.getConfigLabel(remoteSync)
        : "";
    }

    function refreshRemoteSyncUi(textOverride) {
      if (!remoteSync) return;
      const hasToken = !!getRemoteSyncToken();
      if (remoteSyncButton) {
        remoteSyncButton.textContent = hasToken ? "Host Sync Connected" : "Connect Host Sync";
      }
      if (remoteSyncStatus) {
        if (textOverride) {
          remoteSyncStatus.textContent = textOverride;
        } else if (!hasToken) {
          remoteSyncStatus.textContent = "Host sync not connected";
        } else {
          remoteSyncStatus.textContent = `Host sync ready (${getRemoteSyncConfigLabel()})`;
        }
      }
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

    function insertBeforeIfChild(parent, node, anchor) {
      if (!parent || !node) return;
      if (anchor && anchor.parentNode === parent) {
        parent.insertBefore(node, anchor);
      } else {
        parent.appendChild(node);
      }
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

    function appendCustomizableFieldValues(container, fields, values, options) {
      const fieldDefs = Array.isArray(fields) ? fields : [];
      const opts = options && typeof options === "object" ? options : {};
      const valueMap = normalizeCustomizableFields(values);
      const visibleFields = fieldDefs
        .map((field) => ({
          field,
          value: String(valueMap[field.id] || "").trim(),
        }))
        .filter((item) => item.value);
      if (!container || !visibleFields.length) return;

      const wrap = document.createElement("div");
      wrap.className = "customizable-field-preview";
      if (opts.compact) wrap.classList.add("is-compact");
      if (opts.label) {
        const label = document.createElement("span");
        label.className = "customizable-field-preview-label";
        label.textContent = `${opts.label}:`;
        wrap.appendChild(label);
      }
      visibleFields.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "customizable-field-chip";
        chip.textContent = item.value;
        wrap.appendChild(chip);
      });
      container.appendChild(wrap);
    }

    function buildCustomizableChecklistPanel(definition, inheritedIds, addedIds, options) {
      const opts = options && typeof options === "object" ? options : {};
      const showTitle = opts.showTitle === true;
      const showLegend = opts.showLegend === true;
      const previewMode = String(opts.mode || "static").toLowerCase();
      const fieldValues = normalizeCustomizableFields(opts.fields);
      const panel = document.createElement("div");
      panel.className = "customizable-preview-panel";

      if (showTitle) {
        const title = document.createElement("h4");
        title.textContent = "Customization Sheet";
        panel.appendChild(title);
      }

      if (showLegend) {
        const legend = document.createElement("p");
        legend.className = "customizable-preview-legend";
        legend.innerHTML = '<span class="legend-chip is-inherited">Existing</span><span class="legend-chip is-upgrade">This Upgrade</span>';
        panel.appendChild(legend);
      }

      const inheritedSet = new Set(uniqueIds(inheritedIds));
      const addedSet = new Set(uniqueIds(addedIds));
      const checkedSet = new Set(uniqueIds([].concat(inheritedIds || [], addedIds || [])));

      appendCustomizableFieldValues(
        panel,
        getCustomizableDefinitionFields(definition),
        fieldValues,
        { label: definition.fieldsLabel || "Choices" }
      );

      (Array.isArray(definition && definition.groups) ? definition.groups : []).forEach((group) => {
        const row = document.createElement("div");
        row.className = "customizable-group";
        const ids = getCustomizableGroupIds(group);
        const groupActive = ids.some((id) => checkedSet.has(id));

        const head = document.createElement("div");
        head.className = "customizable-group-head";
        const label = document.createElement("span");
        label.className = "customizable-group-label";
        label.textContent = String(group.label || "").replace(/\.$/, "");
        head.appendChild(label);

        const boxes = document.createElement("div");
        boxes.className = "customizable-group-boxes";
        ids.forEach((id, idx) => {
          const chip = document.createElement("span");
          chip.className = "customizable-box";
          chip.textContent = getCustomizableGroupBoxLabel(group, idx);
          if (previewMode === "editor") {
            if (addedSet.has(id)) {
              chip.classList.add("is-upgrade");
            } else if (inheritedSet.has(id)) {
              chip.classList.add("is-inherited");
            }
          } else if (checkedSet.has(id)) {
            chip.classList.add("is-inherited");
          }
          boxes.appendChild(chip);
        });
        head.appendChild(boxes);
        row.appendChild(head);

        if (group.text) {
          const text = document.createElement("p");
          text.className = "customizable-group-text";
          text.textContent = String(group.text);
          row.appendChild(text);
        }
        if (groupActive) {
          appendCustomizableFieldValues(
            row,
            getCustomizableGroupFields(group),
            fieldValues,
            { label: String(group.label || "").replace(/\.$/, ""), compact: true }
          );
        }
        panel.appendChild(row);
      });

      return panel;
    }

    function buildPreviewNode(cardName, previewContext) {
      const context = previewContext && typeof previewContext === "object" ? previewContext : {};
      const definition = getCustomizableDefinition(cardName);
      const src = findExactImage(cardName) || findMatchingImage(cardName) || inferImagePath(cardName);
      if (definition && src && context.showCustomizableState === true) {
        const wrap = document.createElement("div");
        wrap.className = "card-preview customizable-preview";
        const img = document.createElement("img");
        img.className = "customizable-preview-image";
        img.src = src;
        img.alt = cardName;
        img.addEventListener("error", () => {
          const fallback = buildPlaceholderPreview(cardName);
          wrap.replaceWith(fallback);
        });
        wrap.appendChild(img);
        wrap.appendChild(buildCustomizableChecklistPanel(
          definition,
          context.inheritedIds || [],
          context.addedIds || [],
          { mode: "static", showTitle: false, showLegend: false, fields: context.fields || {} }
        ));
        return wrap;
      }
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

    function createCardListItem(cardName, previewContext) {
      const li = document.createElement("li");
      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName, previewContext));
      li.appendChild(ref);
      return li;
    }

    function createDraftCardListItem(cardName, previewContext) {
      const li = document.createElement("li");
      li.className = "draft-card-item";
      const inline = document.createElement("span");
      inline.className = "draft-card-inline";

      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName, previewContext));

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

    function createCustomizedCardListItem(cardName, previewContext) {
      const li = document.createElement("li");
      li.className = "customized-card-item";
      const inline = document.createElement("span");
      inline.className = "draft-card-inline customized-card-inline";

      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName, previewContext));

      inline.appendChild(ref);
      li.appendChild(inline);

      return li;
    }

    function getRowCardName(row) {
      const ref = row ? row.querySelector(".card-ref") : null;
      return ref ? getCardNameFromRef(ref) : "";
    }

    function getListMode(listEl) {
      return String(listEl && (listEl.getAttribute("data-list") || listEl.getAttribute("data-edit-list")) || "")
        .trim()
        .toLowerCase();
    }

    function getCardKeyFromCardName(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const parsed = parseTrailingQuantity(source);
      return getCatalogKey(parsed.base || source);
    }

    function getCustomizableDisplayNameByKey(cardKey) {
      const key = String(cardKey || "").trim();
      if (!key) return "";
      const catalogMatch = getCardNameCatalog().find((item) => item.key === key);
      if (catalogMatch && catalogMatch.name) return catalogMatch.name;
      return key
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }

    function setCustomizablePhysicalForRow(row, isPhysical) {
      if (!row || !row.dataset) return;
      if (isPhysical) {
        row.dataset.customizablePhysical = "1";
      } else {
        delete row.dataset.customizablePhysical;
      }
    }

    function hasLegacyCustomizableRowState(row) {
      if (!row || !row.dataset) return false;
      return !!(
        row.dataset.customizableCardKey ||
        row.dataset.customizableInheritedIds ||
        row.dataset.customizableEffectiveIds ||
        row.dataset.customizableUpgradeIds ||
        row.dataset.customizableSnapshotIds ||
        row.querySelector(".customizable-row-summary")
      );
    }

    function getLegacyCustomizableUpgradeIdsForRow(row) {
      const explicitIds = getCustomizableUpgradeIdsForRow(row);
      if (explicitIds.length) return explicitIds;
      const inheritedIds = parseCustomizableIdList(row && row.dataset ? row.dataset.customizableInheritedIds : "");
      const effectiveIds = parseCustomizableIdList(row && row.dataset ? row.dataset.customizableEffectiveIds : "");
      if (!effectiveIds.length) return [];
      const inheritedSet = new Set(inheritedIds);
      return uniqueIds(effectiveIds.filter((id) => !inheritedSet.has(id)));
    }

    function isPhysicalCustomizableRecord(record) {
      if (!record || typeof record !== "object") return true;
      if (record.customizablePhysical === true || record.customizablePhysical === "1") return true;
      if (record.customizablePhysical === false || record.customizablePhysical === "0") return false;
      if (record.customizableLegacyState) return false;
      const upgradeIds = Array.isArray(record.customizableUpgradeIds) ? uniqueIds(record.customizableUpgradeIds) : [];
      return upgradeIds.length === 0;
    }

    function getInvestigatorNameForRow(row) {
      const card = row ? row.closest(".upgrade-card") : null;
      if (!card) return "";
      const heading = card.querySelector("[data-investigator-name]");
      return heading ? String(heading.getAttribute("data-investigator-name") || "").trim() : "";
    }

    function getCustomizableUpgradeIdsForRow(row) {
      return parseCustomizableIdList(row && row.dataset ? row.dataset.customizableUpgradeIds : "");
    }

    function getCustomizableSnapshotIdsForRow(row) {
      return parseCustomizableIdList(row && row.dataset ? row.dataset.customizableSnapshotIds : "");
    }

    function setCustomizableUpgradeIdsForRow(row, ids) {
      if (!row || !row.dataset) return;
      const next = uniqueIds(ids);
      if (next.length) {
        row.dataset.customizableUpgradeIds = next.join(",");
      } else {
        delete row.dataset.customizableUpgradeIds;
      }
    }

    function setCustomizableSnapshotIdsForRow(row, ids) {
      if (!row || !row.dataset) return;
      const next = uniqueIds(ids);
      if (next.length) {
        row.dataset.customizableSnapshotIds = next.join(",");
      } else {
        delete row.dataset.customizableSnapshotIds;
      }
    }

    function ensureCustomizableSummary(row, inheritedIds, addedIds) {
      if (!row) return;
      const name = getRowCardName(row);
      const definition = getCustomizableDefinition(name);
      let summary = row.querySelector(".customizable-row-summary");
      if (!definition) {
        if (summary) summary.remove();
        return;
      }
      if (!summary) {
        summary = document.createElement("div");
        summary.className = "customizable-row-summary";
        row.appendChild(summary);
      }
      const inheritedSet = new Set(uniqueIds(inheritedIds));
      const addedSet = new Set(uniqueIds(addedIds));
      const parts = [];
      const fieldValues = getCustomizableFieldsForRow(row);
      const baseFieldValues = getCustomizableDefinitionFields(definition)
        .map((field) => String(fieldValues[field.id] || "").trim())
        .filter(Boolean);
      if (baseFieldValues.length) {
        parts.push(`${definition.fieldsLabel || "Choices"}: ${baseFieldValues.join(", ")}`);
      }
      (definition.groups || []).forEach((group) => {
        const ids = getCustomizableGroupIds(group);
        const inheritedCount = ids.filter((id) => inheritedSet.has(id)).length;
        const addedCount = ids.filter((id) => addedSet.has(id)).length;
        const total = inheritedCount + addedCount;
        if (total <= 0) return;
        const inheritedXp = getCustomizableGroupSelectedXp(group, inheritedSet);
        const addedXp = getCustomizableGroupSelectedXp(group, addedSet);
        const totalXp = inheritedXp + addedXp;
        const maxXp = Number(group && group.xpTotal) > 0 ? Number(group.xpTotal) : ids.length;
        const suffix = addedXp > 0 ? ` (+${addedXp})` : "";
        const groupFieldValues = getCustomizableGroupFields(group)
          .map((field) => String(fieldValues[field.id] || "").trim())
          .filter(Boolean);
        const groupFieldText = groupFieldValues.length ? `: ${groupFieldValues.join(", ")}` : "";
        parts.push(`${String(group.label || "").replace(/\.$/, "")} ${totalXp}/${maxXp}${suffix}${groupFieldText}`);
      });
      summary.textContent = parts.length ? parts.join(" • ") : "No checkboxes selected yet.";
    }

    function buildCustomizableAddedIdsFromCounts(definition, inheritedIds, countsByGroup) {
      const inheritedSet = new Set(uniqueIds(inheritedIds));
      const added = [];
      (definition && Array.isArray(definition.groups) ? definition.groups : []).forEach((group) => {
        const ids = getCustomizableGroupIds(group);
        const inheritedCount = ids.filter((id) => inheritedSet.has(id)).length;
        const nextCount = Math.max(0, Number(countsByGroup[group.id]) || 0);
        ids.slice(inheritedCount, inheritedCount + nextCount).forEach((id) => added.push(id));
      });
      return uniqueIds(added);
    }

    function sanitizeCustomizableAddedIds(definition, inheritedIds, addedIds) {
      const inheritedSet = new Set(uniqueIds(inheritedIds));
      const allowedSet = new Set(getCustomizableAllIds(definition));
      return uniqueIds(addedIds).filter((id) => allowedSet.has(id) && !inheritedSet.has(id));
    }

    function createCustomizableFieldInput(row, field, options) {
      const opts = options && typeof options === "object" ? options : {};
      const wrap = document.createElement("label");
      wrap.className = "customizable-field-row";

      const label = document.createElement("span");
      label.className = "customizable-field-label";
      label.textContent = getCustomizableFieldLabel(field);
      wrap.appendChild(label);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "customizable-field-input";
      input.placeholder = getCustomizableFieldPlaceholder(field);
      input.value = String(getCustomizableFieldsForRow(row)[field.id] || "");
      input.autocomplete = "off";
      if (opts.disabled) input.disabled = true;
      input.addEventListener("input", () => {
        setCustomizableFieldValueForRow(row, field.id, input.value);
        const inherited = parseCustomizableIdList(row.dataset.customizableInheritedIds || "");
        const added = getCustomizableUpgradeIdsForRow(row);
        ensureCustomizableSummary(row, inherited, added);
        const ref = row.querySelector(".card-ref");
        const name = getRowCardName(row);
        if (ref && getCustomizableDefinition(name)) {
          replaceCardPreview(ref, name, {
            inheritedIds: inherited,
            addedIds: added,
            fields: getCustomizableFieldsForRow(row),
            showCustomizableState: true,
          });
        }
        scheduleSaveUpgradeState();
      });
      wrap.appendChild(input);

      return { wrap, input };
    }

    function closeCustomizableEditor() {
      if (customizableEditorOutsideHandler) {
        document.removeEventListener("mousedown", customizableEditorOutsideHandler, true);
        customizableEditorOutsideHandler = null;
      }
      if (customizableEditorEscapeHandler) {
        document.removeEventListener("keydown", customizableEditorEscapeHandler, true);
        customizableEditorEscapeHandler = null;
      }
      if (activeCustomizableEditorRow) {
        activeCustomizableEditorRow.classList.remove("has-customizable-popover");
      }
      if (activeCustomizableEditor) {
        activeCustomizableEditor.remove();
      }
      activeCustomizableEditor = null;
      activeCustomizableEditorRow = null;
      activeCustomizableEditorAnchor = null;
    }

    function positionCustomizableEditor() {
      if (!activeCustomizableEditor || !activeCustomizableEditorRow || !activeCustomizableEditorAnchor) return;
      const panel = activeCustomizableEditor;
      const row = activeCustomizableEditorRow;
      const button = activeCustomizableEditorAnchor;
      if (!document.body.contains(row) || !row.contains(button) || !row.contains(panel)) {
        closeCustomizableEditor();
        return;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const margin = 18;
      const gap = 16;
      const preferredWidth = Math.min(560, Math.max(280, viewportWidth - (margin * 2)));
      const maxPanelHeight = Math.max(280, viewportHeight - (margin * 2));

      panel.style.width = `${Math.round(preferredWidth)}px`;
      panel.style.maxWidth = `${Math.round(Math.max(280, viewportWidth - (margin * 2)))}px`;
      panel.style.maxHeight = `${Math.round(maxPanelHeight)}px`;

      const buttonRect = button.getBoundingClientRect();
      panel.classList.remove("is-left-side");
      const panelRect = panel.getBoundingClientRect();
      const canOpenRight = buttonRect.right + gap + panelRect.width + margin <= viewportWidth;
      let left = canOpenRight
        ? buttonRect.right + gap
        : buttonRect.left - gap - panelRect.width;
      if (!canOpenRight) {
        panel.classList.add("is-left-side");
      }
      const maxLeft = Math.max(margin, viewportWidth - panelRect.width - margin);
      left = Math.min(Math.max(left, margin), maxLeft);

      let top = buttonRect.top + (buttonRect.height / 2) - (panelRect.height / 2);
      const maxTop = Math.max(margin, viewportHeight - panelRect.height - margin);
      top = Math.min(Math.max(top, margin), maxTop);

      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    function attachCustomizableEditor(row, anchorButton, options) {
      if (!row) return;
      const opts = options && typeof options === "object" ? options : {};
      const name = getRowCardName(row);
      const definition = getCustomizableDefinition(name);
      if (!definition) return;
      const listEl = row.closest(".card-list");
      const mode = getListMode(listEl);
      if (mode !== "customized") return;
      if (!isCustomizableEditContext(row)) return;

      closeCustomizableEditor();

      const inheritedIds = parseCustomizableIdList(row.dataset.customizableInheritedIds || "");
      const seedSourceIds = Array.isArray(opts.seedAddedIds)
        ? opts.seedAddedIds
        : getCustomizableUpgradeIdsForRow(row);
      const seedAddedIds = sanitizeCustomizableAddedIds(
        definition,
        inheritedIds,
        seedSourceIds
      );
      const inheritedSet = new Set(inheritedIds);
      const seedAddedSet = new Set(seedAddedIds);
      const countsByGroup = {};

      const panel = document.createElement("div");
      panel.className = "customizable-inline-editor customizable-popover";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "customizable-overlay-close";
      closeBtn.setAttribute("aria-label", "Close customizable editor");
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => closeCustomizableEditor());
      panel.appendChild(closeBtn);

      const title = document.createElement("h4");
      title.className = "customizable-overlay-title";
      title.textContent = `${name} Checkboxes`;
      panel.appendChild(title);

      const intro = document.createElement("p");
      intro.className = "customizable-inline-intro";
      intro.textContent = "Select upgrade checkboxes for this scenario. Existing checkboxes are locked and do not spend XP.";
      panel.appendChild(intro);

      const legend = document.createElement("p");
      legend.className = "customizable-preview-legend";
      legend.innerHTML = '<span class="legend-chip is-inherited">Existing</span><span class="legend-chip is-upgrade">This Upgrade</span>';
      panel.appendChild(legend);

      const baseFields = getCustomizableDefinitionFields(definition);
      if (baseFields.length) {
        const fieldPanel = document.createElement("div");
        fieldPanel.className = "customizable-field-panel";

        const fieldTitle = document.createElement("div");
        fieldTitle.className = "customizable-field-panel-title";
        fieldTitle.textContent = definition.fieldsLabel || "Choices";
        fieldPanel.appendChild(fieldTitle);

        const fieldGrid = document.createElement("div");
        fieldGrid.className = "customizable-field-grid";
        baseFields.forEach((field) => {
          fieldGrid.appendChild(createCustomizableFieldInput(row, field).wrap);
        });
        fieldPanel.appendChild(fieldGrid);
        panel.appendChild(fieldPanel);
      }

      (definition.groups || []).forEach((group) => {
        const ids = getCustomizableGroupIds(group);
        const inheritedCount = ids.filter((id) => inheritedSet.has(id)).length;
        const seededAddedCount = ids.filter((id) => seedAddedSet.has(id)).length;
        countsByGroup[group.id] = seededAddedCount;

        const groupWrap = document.createElement("div");
        groupWrap.className = "customizable-inline-group customizable-overlay-group";

        const head = document.createElement("div");
        head.className = "customizable-inline-head";
        const label = document.createElement("strong");
        label.textContent = String(group.label || "").replace(/\.$/, "");
        head.appendChild(label);

        const chips = document.createElement("div");
        chips.className = "customizable-inline-chips";
        ids.forEach((id, idx) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "customizable-inline-chip";
          chip.textContent = getCustomizableGroupBoxLabel(group, idx);
          if (idx < inheritedCount) {
            chip.classList.add("is-inherited");
            chip.disabled = true;
          } else if (idx < inheritedCount + countsByGroup[group.id]) {
            chip.classList.add("is-upgrade");
          }
          chip.addEventListener("click", () => {
            const clickedCount = idx + 1 - inheritedCount;
            countsByGroup[group.id] = countsByGroup[group.id] === clickedCount ? 0 : clickedCount;
            setCustomizableUpgradeIdsForRow(row, buildCustomizableAddedIdsFromCounts(definition, inheritedIds, countsByGroup));
            refreshCustomizableRowsInList(listEl, row.closest(".upgrade-entry"));
            refreshCurrentXp();
            const nextSeedAddedIds = getCustomizableUpgradeIdsForRow(row);
            closeCustomizableEditor();
            attachCustomizableEditor(row, anchorButton || row.querySelector(".customizable-edit-btn"), {
              seedAddedIds: nextSeedAddedIds,
            });
          });
          chips.appendChild(chip);
        });
        head.appendChild(chips);
        groupWrap.appendChild(head);

        if (group.text) {
          const text = document.createElement("p");
          text.className = "customizable-inline-text";
          text.textContent = String(group.text);
          groupWrap.appendChild(text);
        }

        const groupFields = getCustomizableGroupFields(group);
        if (groupFields.length) {
          const groupFieldGrid = document.createElement("div");
          groupFieldGrid.className = "customizable-field-grid customizable-field-grid-inline";
          const groupActive = inheritedCount + countsByGroup[group.id] > 0;
          groupFields.forEach((field) => {
            groupFieldGrid.appendChild(createCustomizableFieldInput(row, field, { disabled: !groupActive }).wrap);
          });
          groupWrap.appendChild(groupFieldGrid);
        }

        panel.appendChild(groupWrap);
      });

      row.appendChild(panel);
      row.classList.add("has-customizable-popover");
      activeCustomizableEditor = panel;
      activeCustomizableEditorRow = row;
      activeCustomizableEditorAnchor = anchorButton || row.querySelector(".customizable-edit-btn");
      panel.scrollTop = 0;
      positionCustomizableEditor();
      window.requestAnimationFrame(() => {
        panel.scrollTop = 0;
        positionCustomizableEditor();
      });
      customizableEditorOutsideHandler = (event) => {
        const target = event.target;
        if (panel.contains(target) || (activeCustomizableEditorAnchor && activeCustomizableEditorAnchor.contains(target))) {
          return;
        }
        closeCustomizableEditor();
      };
      customizableEditorEscapeHandler = (event) => {
        if (event.key === "Escape") {
          closeCustomizableEditor();
        }
      };
      document.addEventListener("mousedown", customizableEditorOutsideHandler, true);
      document.addEventListener("keydown", customizableEditorEscapeHandler, true);
    }

    function isCustomizableEditContext(row) {
      if (!row) return false;
      if (row.closest(".upgrade-entry-editor")) return true;
      const entry = row.closest(".upgrade-entry");
      return !!(entry && entry.classList.contains("upgrade-entry-draft"));
    }

    function ensureCustomizableActionButton(row) {
      if (!row) return;
      const name = getRowCardName(row);
      const definition = getCustomizableDefinition(name);
      const inline = row.querySelector(".draft-card-inline");
      const listEl = row.closest(".card-list");
      const mode = getListMode(listEl);
      const existingBtn = row.querySelector(".customizable-edit-btn");
      if (!definition || !inline || mode !== "customized" || !isCustomizableEditContext(row)) {
        if (activeCustomizableEditorRow === row) closeCustomizableEditor();
        if (existingBtn) existingBtn.remove();
        return;
      }
      if (existingBtn) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "customizable-edit-btn";
      btn.textContent = "Checkboxes";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeCustomizableEditor && activeCustomizableEditorRow === row) {
          closeCustomizableEditor();
          return;
        }
        attachCustomizableEditor(row, btn);
      });
      insertBeforeIfChild(inline, btn, inline.querySelector(".draft-card-remove"));
    }

    function replaceCardPreview(ref, cardName, previewContext) {
      if (!ref) return;
      const existingPreview = ref.querySelector(".card-preview");
      if (existingPreview) existingPreview.remove();
      ref.appendChild(buildPreviewNode(cardName, previewContext));
    }

    function cleanupCustomizableRowState(row) {
      if (!row) return;
      const summary = row.querySelector(".customizable-row-summary");
      if (summary) summary.remove();
      const editBtn = row.querySelector(".customizable-edit-btn");
      if (editBtn) editBtn.remove();
      if (row.dataset) {
        delete row.dataset.customizableCardKey;
        delete row.dataset.customizableInheritedIds;
        delete row.dataset.customizableEffectiveIds;
        delete row.dataset.customizableUpgradeIds;
        delete row.dataset.customizableSnapshotIds;
        delete row.dataset.customizableFields;
      }
    }

    function enhanceCustomizableRow(row, inheritedIds, addedIds) {
      if (!row) return;
      const name = getRowCardName(row);
      const definition = getCustomizableDefinition(name);
      const ref = row.querySelector(".card-ref");
      const mode = getListMode(row.closest(".card-list"));
      if (!definition || !ref || mode !== "customized") {
        cleanupCustomizableRowState(row);
        return;
      }
      const inherited = uniqueIds(inheritedIds);
      const added = sanitizeCustomizableAddedIds(definition, inherited, addedIds);
      const effective = uniqueIds(inherited.concat(added));
      setCustomizableUpgradeIdsForRow(row, added);
      row.dataset.customizableCardKey = getCatalogKey(name);
      row.dataset.customizableInheritedIds = inherited.join(",");
      row.dataset.customizableEffectiveIds = effective.join(",");
      setCustomizableSnapshotIdsForRow(row, effective);
      replaceCardPreview(ref, name, {
        inheritedIds: inherited,
        addedIds: added,
        fields: getCustomizableFieldsForRow(row),
        showCustomizableState: true,
      });
      ensureCustomizableSummary(row, inherited, added);
      ensureCustomizableActionButton(row);
    }

    function buildCustomizableStateBeforeEntry(card, targetEntry) {
      const investigatorName = getUpgradeCardName(card);
      const initial = {};
      Object.keys(customizableLibraryCards).forEach((key) => {
        const baseIds = getCustomizableBaselineIds(investigatorName, key);
        if (baseIds.length) initial[key] = uniqueIds(baseIds);
      });
      const entries = Array.from(card ? card.querySelectorAll(".upgrade-entry") : []);
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (targetEntry && entry === targetEntry) break;
        const customizedList = getEntryList(entry, "customized");
        if (customizedList) {
          Array.from(customizedList.children || []).forEach((row) => {
            const name = getRowCardName(row);
            if (!isCustomizableCardName(name)) return;
            const key = getCatalogKey(name);
            const snapshotIds = getCustomizableSnapshotIdsForRow(row);
            if (snapshotIds.length) {
              initial[key] = snapshotIds;
            } else {
              initial[key] = uniqueIds((initial[key] || []).concat(getCustomizableUpgradeIdsForRow(row)));
            }
          });
        }
        const addedList = getEntryList(entry, "added");
        if (!addedList) continue;
        Array.from(addedList.children || []).forEach((row) => {
          const name = getRowCardName(row);
          if (!isCustomizableCardName(name)) return;
          const legacyIds = getLegacyCustomizableUpgradeIdsForRow(row);
          if (!legacyIds.length) return;
          const key = getCatalogKey(name);
          initial[key] = uniqueIds((initial[key] || []).concat(legacyIds));
        });
      }
      return initial;
    }

    function buildCustomizableFieldStateBeforeEntry(card, targetEntry) {
      const initial = {};
      const entries = Array.from(card ? card.querySelectorAll(".upgrade-entry") : []);
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (targetEntry && entry === targetEntry) break;
        const customizedList = getEntryList(entry, "customized");
        if (!customizedList) continue;
        Array.from(customizedList.children || []).forEach((row) => {
          const name = getRowCardName(row);
          if (!isCustomizableCardName(name)) return;
          const key = getCatalogKey(name);
          const fields = getCustomizableFieldsForRow(row);
          if (key && Object.keys(fields).length) {
            initial[key] = fields;
          }
        });
      }
      return initial;
    }

    function refreshCustomizableRowsInList(listEl, entry) {
      if (!listEl) return;
      const mode = getListMode(listEl);
      const card = listEl.closest(".upgrade-card");
      const stateBefore = buildCustomizableStateBeforeEntry(card, entry || listEl.closest(".upgrade-entry"));
      Array.from(listEl.children || []).forEach((row) => {
        const name = getRowCardName(row);
        if (!isCustomizableCardName(name)) return;
        const key = getCatalogKey(name);
        const upgradeIds = mode === "customized" ? getCustomizableUpgradeIdsForRow(row) : [];
        const snapshotIds = mode === "customized" ? getCustomizableSnapshotIdsForRow(row) : [];
        const upgradeSet = new Set(upgradeIds);
        const inheritedIds = snapshotIds.length
          ? uniqueIds(snapshotIds.filter((id) => !upgradeSet.has(id)))
          : uniqueIds(stateBefore[key] || []);
        const addedIds = upgradeIds;
        enhanceCustomizableRow(row, inheritedIds, addedIds);
      });
    }

    function serializeCardRow(row) {
      const name = getRowCardName(row);
      const mode = getListMode(row ? row.closest(".card-list") : null);
      const upgradeIds = getCustomizableUpgradeIdsForRow(row);
      const serialized = {
        name,
      };
      if (isCustomizableCardName(name)) {
        const snapshotIds = getCustomizableSnapshotIdsForRow(row);
        const customizableFields = getCustomizableFieldsForRow(row);
        if (mode === "customized" || upgradeIds.length) {
          serialized.customizableUpgradeIds = upgradeIds;
        }
        if (mode === "customized" && snapshotIds.length) {
          serialized.customizableSnapshotIds = snapshotIds;
        }
        if (mode === "customized" && Object.keys(customizableFields).length) {
          serialized.customizableFields = customizableFields;
        }
        if (mode === "added") {
          const legacyState = hasLegacyCustomizableRowState(row);
          const legacyIds = legacyState ? getLegacyCustomizableUpgradeIdsForRow(row) : [];
          if (legacyIds.length) {
            serialized.customizableUpgradeIds = legacyIds;
          }
          serialized.customizableLegacyState = legacyState;
          serialized.customizablePhysical = row && row.dataset && row.dataset.customizablePhysical === "1"
            ? true
            : (!legacyState && !upgradeIds.length);
        }
      }
      return serialized;
    }

    function listCardRows(listEl) {
      return Array.from(listEl.children || [])
        .filter((node) => node && node.tagName === "LI")
        .map((row) => serializeCardRow(row))
        .filter((row) => row.name);
    }

    function getCardNameFromRef(ref) {
      return Array.from(ref.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("")
        .trim();
    }

    function listCardNames(listEl) {
      return listCardRows(listEl).map((row) => row.name).filter(Boolean);
    }

    function setCards(listEl, cardRows) {
      listEl.innerHTML = "";
      const mode = getListMode(listEl);
      (cardRows || []).forEach((row) => {
        const cardRow = typeof row === "string" ? { name: row } : row;
        const li = mode === "customized"
          ? createCustomizedCardListItem(cardRow.name)
          : createCardListItem(cardRow.name);
        if (mode === "customized") {
          setCustomizableUpgradeIdsForRow(li, cardRow.customizableUpgradeIds || []);
          setCustomizableSnapshotIdsForRow(li, cardRow.customizableSnapshotIds || []);
          setCustomizableFieldsForRow(li, cardRow.customizableFields || {});
        } else if (mode === "added" && isCustomizableCardName(cardRow.name)) {
          setCustomizablePhysicalForRow(li, isPhysicalCustomizableRecord(cardRow));
        }
        listEl.appendChild(li);
      });
      refreshCustomizableRowsInList(listEl, listEl.closest(".upgrade-entry"));
    }

    function setCardsWithInlineRemove(listEl, cardRows) {
      listEl.innerHTML = "";
      const mode = getListMode(listEl);
      (cardRows || []).forEach((row) => {
        const cardRow = typeof row === "string" ? { name: row } : row;
        const li = mode === "customized"
          ? createCustomizedCardListItem(cardRow.name)
          : createDraftCardListItem(cardRow.name);
        if (mode === "customized") {
          setCustomizableUpgradeIdsForRow(li, cardRow.customizableUpgradeIds || []);
          setCustomizableSnapshotIdsForRow(li, cardRow.customizableSnapshotIds || []);
          setCustomizableFieldsForRow(li, cardRow.customizableFields || {});
        } else if (mode === "added" && isCustomizableCardName(cardRow.name)) {
          setCustomizablePhysicalForRow(li, isPhysicalCustomizableRecord(cardRow));
        }
        listEl.appendChild(li);
      });
      refreshCustomizableRowsInList(listEl, listEl.closest(".upgrade-entry"));
    }

    function getEntryList(entry, mode) {
      if (!entry || !mode) return null;
      return entry.querySelector(`.card-list[data-list="${mode}"], .card-list[data-edit-list="${mode}"]`);
    }

    function getListFromContainer(container, mode) {
      if (!container || !mode) return null;
      return container.querySelector(`.card-list[data-list="${mode}"], .card-list[data-edit-list="${mode}"]`);
    }

    function getCustomizedSection(container) {
      return container ? container.querySelector(":scope > .customized-section") : null;
    }

    function createCustomizedSection(editMode) {
      const section = document.createElement("div");
      section.className = "customized-section";
      const heading = document.createElement("h4");
      heading.textContent = "Customized";
      const list = document.createElement("ul");
      list.className = "card-list customized-list";
      list.setAttribute(editMode ? "data-edit-list" : "data-list", "customized");
      section.appendChild(heading);
      section.appendChild(list);
      return section;
    }

    function insertCustomizedSection(container, section) {
      if (!container || !section) return;
      const anchor = container.querySelector(":scope > .upgrade-entry-builder, :scope > .upgrade-entry-editor, :scope > .builder-error, :scope > .entry-actions");
      insertBeforeIfChild(container, section, anchor);
    }

    function ensureCustomizedSection(container, editMode) {
      if (!container) return null;
      let section = getCustomizedSection(container);
      if (!section) {
        section = createCustomizedSection(editMode);
        insertCustomizedSection(container, section);
      }
      return section;
    }

    function getCustomizedList(container) {
      const section = getCustomizedSection(container);
      return section ? section.querySelector('.card-list[data-list="customized"], .card-list[data-edit-list="customized"]') : null;
    }

    function getCustomizableBaselineKeySet(investigatorName) {
      const investigatorKey = normalizeText(investigatorName);
      const state = investigatorKey ? customizableBaselineState[investigatorKey] : null;
      if (!state || typeof state !== "object") return [];
      return Object.keys(state).filter(Boolean);
    }

    function cloneCustomizableHoldings(holdings) {
      const clone = new Map();
      (holdings || new Map()).forEach((value, key) => {
        clone.set(key, {
          key,
          name: value.name,
          qty: Math.max(0, Number(value.qty) || 0),
        });
      });
      return clone;
    }

    function addCustomizableHolding(holdings, cardName, qty) {
      const key = getCardKeyFromCardName(cardName);
      const amount = Math.max(0, Number(qty) || 0);
      if (!key || amount <= 0) return;
      const existing = holdings.get(key) || {
        key,
        name: getCustomizableDisplayNameByKey(key) || cardName,
        qty: 0,
      };
      existing.qty += amount;
      existing.name = getCustomizableDisplayNameByKey(key) || existing.name || cardName;
      holdings.set(key, existing);
    }

    function removeCustomizableHolding(holdings, cardName, qty) {
      const key = getCardKeyFromCardName(cardName);
      const amount = Math.max(0, Number(qty) || 0);
      if (!key || amount <= 0 || !holdings.has(key)) return;
      const existing = holdings.get(key);
      existing.qty = Math.max(0, (Number(existing.qty) || 0) - amount);
      if (existing.qty <= 0) {
        holdings.delete(key);
      } else {
        holdings.set(key, existing);
      }
    }

    function getCustomizablePhysicalQuantity(record) {
      const name = typeof record === "string" ? record : (record && record.name ? record.name : "");
      if (!isCustomizableCardName(name)) return 0;
      return isPhysicalCustomizableRecord(record) ? getCardQuantity(name) : 0;
    }

    function applyEntryCustomizableCardChanges(holdings, entry, overrideRows) {
      const rows = overrideRows || {};
      const removedRows = Array.isArray(rows.removed)
        ? rows.removed
        : (getEntryList(entry, "removed") ? listCardRows(getEntryList(entry, "removed")) : []);
      const addedRows = Array.isArray(rows.added)
        ? rows.added
        : (getEntryList(entry, "added") ? listCardRows(getEntryList(entry, "added")) : []);

      removedRows.forEach((row) => {
        const name = typeof row === "string" ? row : (row && row.name ? row.name : "");
        if (!isCustomizableCardName(name)) return;
        removeCustomizableHolding(holdings, name, getCardQuantity(name));
      });

      addedRows.forEach((row) => {
        const name = typeof row === "string" ? row : (row && row.name ? row.name : "");
        const qty = getCustomizablePhysicalQuantity(row);
        if (qty <= 0) return;
        addCustomizableHolding(holdings, name, qty);
      });
    }

    function buildCustomizableHoldingsBeforeEntry(card, targetEntry) {
      const holdings = new Map();
      const investigatorName = getUpgradeCardName(card);
      getCustomizableBaselineKeySet(investigatorName).forEach((key) => {
        holdings.set(key, {
          key,
          name: getCustomizableDisplayNameByKey(key),
          qty: 1,
        });
      });

      const entries = Array.from(card ? card.querySelectorAll(".upgrade-entry") : []);
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (targetEntry && entry === targetEntry) break;
        if (entry.classList.contains("upgrade-entry-draft")) continue;
        applyEntryCustomizableCardChanges(holdings, entry);
      }
      return holdings;
    }

    function getCustomizedRowsFromLegacyAddedRows(addedRows) {
      return (addedRows || [])
        .filter((row) => row && row.customizableLegacyState && !isPhysicalCustomizableRecord(row) && isCustomizableCardName(row.name))
        .map((row) => ({
          name: row.name,
          customizableUpgradeIds: uniqueIds(row.customizableUpgradeIds || []),
        }));
    }

    function shouldKeepAddedRow(row) {
      if (!row || !isCustomizableCardName(row.name)) return true;
      return !row.customizableLegacyState || isPhysicalCustomizableRecord(row);
    }

    function mergeCustomizedCardRows(cardRows) {
      const map = new Map();
      (cardRows || []).forEach((row) => {
        const cardRow = typeof row === "string" ? { name: row } : row;
        const key = getCardKeyFromCardName(cardRow.name);
        if (!key) return;
        const existing = map.get(key) || {
          name: getCustomizableDisplayNameByKey(key) || cardRow.name,
          customizableUpgradeIds: [],
          customizableSnapshotIds: [],
          customizableFields: {},
        };
        existing.customizableUpgradeIds = uniqueIds(existing.customizableUpgradeIds.concat(cardRow.customizableUpgradeIds || []));
        if (Array.isArray(cardRow.customizableSnapshotIds) && cardRow.customizableSnapshotIds.length) {
          existing.customizableSnapshotIds = uniqueIds(cardRow.customizableSnapshotIds);
        }
        existing.customizableFields = Object.assign(
          {},
          existing.customizableFields || {},
          normalizeCustomizableFields(cardRow.customizableFields || {})
        );
        map.set(key, existing);
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    function refreshEntryCustomizedSection(entry, options) {
      if (!entry) return;
      const opts = options && typeof options === "object" ? options : {};
      const container = opts.container || entry;
      const editMode = !!opts.editMode;
      const removedList = getListFromContainer(container, "removed");
      const addedList = getListFromContainer(container, "added");
      const removedRows = removedList ? listCardRows(removedList) : [];
      const rawAddedRows = addedList ? listCardRows(addedList) : [];
      const addedRows = rawAddedRows.filter((row) => shouldKeepAddedRow(row));

      if (addedList && addedRows.length !== rawAddedRows.length) {
        setCards(addedList, addedRows);
      }

      const card = entry.closest(".upgrade-card");
      const holdings = cloneCustomizableHoldings(buildCustomizableHoldingsBeforeEntry(card, entry));
      const fieldStateBefore = buildCustomizableFieldStateBeforeEntry(card, entry);
      applyEntryCustomizableCardChanges(holdings, entry, { removed: removedRows, added: addedRows });

      const existingList = getCustomizedList(container);
      const existingCustomizedRows = existingList ? listCardRows(existingList) : [];
      const migratedCustomizedRows = getCustomizedRowsFromLegacyAddedRows(rawAddedRows);
      const existingByKey = new Map();
      mergeCustomizedCardRows(existingCustomizedRows.concat(migratedCustomizedRows)).forEach((row) => {
        existingByKey.set(getCardKeyFromCardName(row.name), row);
      });
      const removedKeys = new Set(
        removedRows
          .filter((row) => row && isCustomizableCardName(row.name))
          .map((row) => getCardKeyFromCardName(row.name))
          .filter(Boolean)
      );

      existingByKey.forEach((row, key) => {
        if (!key || holdings.has(key) || removedKeys.has(key)) return;
        holdings.set(key, {
          key,
          name: getCustomizableDisplayNameByKey(key) || row.name,
          qty: 1,
        });
      });

      const nextRows = Array.from(holdings.values())
        .filter((item) => item.qty > 0)
        .map((item) => {
          const existing = existingByKey.get(item.key);
          const inheritedFields = normalizeCustomizableFields(fieldStateBefore[item.key] || {});
          const existingFields = existing ? normalizeCustomizableFields(existing.customizableFields || {}) : {};
          return {
            name: item.name,
            customizableUpgradeIds: existing ? uniqueIds(existing.customizableUpgradeIds || []) : [],
            customizableSnapshotIds: existing ? uniqueIds(existing.customizableSnapshotIds || []) : [],
            customizableFields: Object.assign({}, inheritedFields, existingFields),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!nextRows.length) {
        const section = getCustomizedSection(container);
        if (section) section.remove();
        return;
      }

      const section = ensureCustomizedSection(container, editMode);
      const customizedList = section ? getCustomizedList(container) : null;
      if (!customizedList) return;
      setCards(customizedList, nextRows);
    }

    function normalizeStaticEntryCardRows(entry) {
      if (!entry) return;
      if (entry.classList.contains("upgrade-entry-draft")) return;
      if (entry.querySelector(".upgrade-entry-editor")) return;
      const removedList = getEntryList(entry, "removed");
      const addedList = getEntryList(entry, "added");
      const customizedList = getEntryList(entry, "customized");
      const rawAddedRows = addedList ? listCardRows(addedList) : [];
      const migratedCustomizedRows = getCustomizedRowsFromLegacyAddedRows(rawAddedRows);
      if (removedList) setCards(removedList, listCardRows(removedList));
      if (addedList) setCards(addedList, rawAddedRows.filter((row) => shouldKeepAddedRow(row)));
      if (customizedList || migratedCustomizedRows.length) {
        const section = ensureCustomizedSection(entry, false);
        const nextCustomizedList = section ? getCustomizedList(entry) : null;
        const existingRows = customizedList ? listCardRows(customizedList) : [];
        if (nextCustomizedList) {
          setCards(nextCustomizedList, mergeCustomizedCardRows(existingRows.concat(migratedCustomizedRows)));
        }
      }
      refreshEntryCustomizedSection(entry);
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

    function refreshEntryAfterCardListChange(listEl) {
      if (!listEl) return;
      const entry = listEl.closest(".upgrade-entry");
      refreshCustomizableRowsInList(listEl, entry);
      const mode = getListMode(listEl);
      if (entry && (mode === "added" || mode === "removed")) {
        const editor = listEl.closest(".upgrade-entry-editor");
        if (editor) {
          refreshEntryCustomizedSection(entry, { container: editor, editMode: true });
        } else {
          refreshEntryCustomizedSection(entry);
        }
      }
    }

    function decrementOrRemoveCardRow(row) {
      if (!row) return;
      const listEl = row.closest(".card-list");
      const ref = row.querySelector(".card-ref");
      if (!ref) {
        row.remove();
        refreshEntryAfterCardListChange(listEl);
        return;
      }
      const currentName = getCardNameFromRef(ref);
      const parsed = parseTrailingQuantity(currentName);
      if (parsed.qty <= 1) {
        row.remove();
        refreshEntryAfterCardListChange(listEl);
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
      refreshEntryAfterCardListChange(listEl);
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
      const mode = getListMode(listEl);

      const existingRefs = Array.from(listEl.querySelectorAll(".card-ref"));
      for (let i = 0; i < existingRefs.length; i += 1) {
        const ref = existingRefs[i];
        const existingText = getCardNameFromRef(ref);
        const existing = parseTrailingQuantity(existingText);
        if (getCatalogKey(existing.base) !== incomingKey) continue;
        const nextQty = existing.qty + incomingQty;
        const nextName = formatCardNameWithQuantity(existing.base, nextQty);
        replaceCardRefText(ref, nextName);
        const row = ref.closest("li");
        if (row && mode === "added" && isCustomizableCardName(incomingBase)) {
          setCustomizablePhysicalForRow(row, true);
        }
        const preview = ref.querySelector(".card-preview");
        if (preview && preview.tagName === "IMG") {
          preview.setAttribute("alt", existing.base);
          const src = findExactImage(existing.base);
          if (src) preview.setAttribute("src", src);
        }
        refreshEntryAfterCardListChange(listEl);
        return;
      }

      const nextRow = createDraftCardListItem(formatCardNameWithQuantity(incomingBase, incomingQty));
      if (mode === "added" && isCustomizableCardName(incomingBase)) {
        setCustomizablePhysicalForRow(nextRow, true);
      }
      listEl.appendChild(nextRow);
      refreshEntryAfterCardListChange(listEl);
    }

    function parseInputCards(textValue) {
      return String(textValue || "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function getCardQuantity(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const text = String(source || "");
      const match = text.match(/\(\s*x\s*(\d+)\s*\)\s*$/i);
      if (!match) return 1;
      const value = Number(match[1]);
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function getInventoryCardInfo(cardRow) {
      const rawName = typeof cardRow === "string" ? cardRow : (cardRow && cardRow.name ? cardRow.name : "");
      const parsed = parseTrailingQuantity(rawName);
      const baseName = parsed.base || rawName;
      // Initial deck data sometimes uses a card's short title while the
      // editor uses the catalog's full title and subtitle. Resolve both to
      // the same canonical catalog name before comparing deck inventory.
      const canonicalName = normalizeCardNameInput(baseName) || baseName;
      const key = getCatalogKey(canonicalName);
      const explicitQty = typeof cardRow === "object" && cardRow
        ? Number(cardRow.qty)
        : NaN;
      return {
        key,
        name: canonicalName,
        qty: Number.isFinite(explicitQty) && explicitQty > 0
          ? Math.trunc(explicitQty)
          : Math.max(1, Number(parsed.qty) || getCardQuantity(rawName)),
      };
    }

    function addInventoryCard(inventory, cardRow) {
      const info = getInventoryCardInfo(cardRow);
      if (!info.key || info.qty <= 0) return;
      const current = inventory.get(info.key) || { name: info.name, qty: 0 };
      current.qty += info.qty;
      inventory.set(info.key, current);
    }

    function removeInventoryCard(inventory, cardRow) {
      const info = getInventoryCardInfo(cardRow);
      if (!info.key || info.qty <= 0) return;
      const current = inventory.get(info.key) || { name: info.name, qty: 0 };
      current.qty = Math.max(0, current.qty - info.qty);
      if (current.qty > 0) {
        inventory.set(info.key, current);
      } else {
        inventory.delete(info.key);
      }
    }

    function getInitialDeckRowsForCard(card) {
      const investigatorName = getUpgradeCardName(card);
      const investigatorKey = normalizeText(investigatorName);
      return investigatorKey && Array.isArray(initialDecks[investigatorKey])
        ? initialDecks[investigatorKey]
        : [];
    }

    function shouldApplyEntryToDeckInventory(entry) {
      if (!entry || entry.classList.contains("upgrade-entry-draft")) return false;
      if (entry.classList.contains("opening-deck-spend")) return false;
      const head = entry.querySelector(".upgrade-entry-head");
      const text = head ? head.textContent.trim() : "";
      return !/^Campaign Start\b/i.test(text);
    }

    function applyEntryToDeckInventory(inventory, entry) {
      if (!shouldApplyEntryToDeckInventory(entry)) return;
      const removedList = getEntryList(entry, "removed");
      const addedList = getEntryList(entry, "added");
      if (removedList) {
        listCardRows(removedList).forEach((row) => removeInventoryCard(inventory, row));
      }
      if (addedList) {
        listCardRows(addedList).forEach((row) => addInventoryCard(inventory, row));
      }
    }

    function buildDeckInventoryBeforeEntry(card, targetEntry) {
      const inventory = new Map();
      getInitialDeckRowsForCard(card).forEach((row) => addInventoryCard(inventory, row));
      if (!inventory.size) return inventory;

      const entries = Array.from(card ? card.querySelectorAll(".upgrade-entry") : []);
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (targetEntry && entry === targetEntry) break;
        applyEntryToDeckInventory(inventory, entry);
      }
      return inventory;
    }

    function validateRemovedCardsAgainstDeck(card, entry, removedCards) {
      const initialRows = getInitialDeckRowsForCard(card);
      if (!initialRows.length) {
        return { valid: true, message: "" };
      }

      const inventory = buildDeckInventoryBeforeEntry(card, entry);
      const working = new Map(inventory);
      const failures = [];
      (removedCards || []).forEach((row) => {
        const info = getInventoryCardInfo(row);
        if (!info.key || info.qty <= 0) return;
        const available = working.has(info.key) ? Number(working.get(info.key).qty) || 0 : 0;
        if (available < info.qty) {
          failures.push({
            name: formatCardNameWithQuantity(info.name, info.qty),
            available,
            needed: info.qty,
          });
          return;
        }
        const next = Object.assign({}, working.get(info.key), { qty: available - info.qty });
        if (next.qty > 0) {
          working.set(info.key, next);
        } else {
          working.delete(info.key);
        }
      });

      if (!failures.length) {
        return { valid: true, message: "" };
      }

      const details = failures.map((failure) => (
        `${failure.name} (deck has ${failure.available}, trying to remove ${failure.needed})`
      )).join("; ");
      return {
        valid: false,
        message: `Cannot save: removed card is not in the current deck before this update. ${details}.`,
      };
    }

    function getCustomizableCheckboxCount(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const text = String(source || "");
      const groups = text.match(/\(([^)]*)\)/g) || [];
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const inner = groups[i].replace(/[()]/g, "").trim();
        if (!inner) continue;
        if (/^x\s*\d+$/i.test(inner)) continue;
        let match = inner.match(/^\+?\s*(\d+)\s*(?:check|checks|checkbox|checkboxes|box|boxes|mark|marks)$/i);
        if (match) return Number(match[1]);
        match = inner.match(/^customizable\s*:\s*\+?\s*(\d+)$/i);
        if (match) return Number(match[1]);
      }
      return null;
    }

    function getCustomizablePaidXp(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const text = String(source || "");
      const groups = text.match(/\(([^)]*)\)/g) || [];
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const inner = groups[i].replace(/[()]/g, "").trim();
        if (!inner) continue;
        let match = inner.match(/^(?:paid|spent)\s*\+?\s*(\d+)\s*xp$/i);
        if (match) return Number(match[1]);
        match = inner.match(/^customizable\s*xp\s*:?\s*\+?\s*(\d+)$/i);
        if (match) return Number(match[1]);
      }
      return null;
    }

    function stripCustomizableMetaMarkers(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      return String(source || "")
        .replace(/\(\s*\+?\s*\d+\s*(?:check|checks|checkbox|checkboxes|box|boxes|mark|marks)\s*\)/gi, " ")
        .replace(/\(\s*customizable\s*:\s*\+?\s*\d+\s*\)/gi, " ")
        .replace(/\(\s*(?:paid|spent)\s*\+?\s*\d+\s*xp\s*\)/gi, " ")
        .replace(/\(\s*customizable\s*xp\s*:?\s*\+?\s*\d+\s*\)/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function getCardLevel(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const text = String(source || "");
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
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const text = String(source || "");
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

    function isSignatureCardName(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return false;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return false;
      if (signatureNameOnlySet.has(nameOnly)) return true;
      return signatureCatalogKeys.some((sk) => {
        const sNameOnly = getNameOnly(sk);
        if (!sNameOnly) return false;
        return (
          nameOnly === sNameOnly ||
          nameOnly.startsWith(sNameOnly + " ") ||
          sNameOnly.startsWith(nameOnly + " ")
        );
      });
    }

    function isNoXpCardName(cardName) {
      return isStoryCardName(cardName) || isSignatureCardName(cardName);
    }

    function isPermanentCardName(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return false;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return false;
      if (permanentNameOnlySet.has(nameOnly)) return true;
      return permanentCatalogKeys.some((pk) => {
        const pNameOnly = getNameOnly(pk);
        if (!pNameOnly) return false;
        return (
          nameOnly === pNameOnly ||
          nameOnly.startsWith(pNameOnly + " ") ||
          pNameOnly.startsWith(nameOnly + " ")
        );
      });
    }

    function getDeckSizeAdjustmentRule(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return null;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return null;
      return deckSizeAdjustmentRules.find((rule) => (
        nameOnly === rule.nameOnly ||
        nameOnly.startsWith(rule.nameOnly + " ") ||
        rule.nameOnly.startsWith(nameOnly + " ")
      )) || null;
    }

    function computeDeckSizeAdjustmentSlots(cardNames) {
      return (cardNames || []).reduce((total, name) => {
        const rule = getDeckSizeAdjustmentRule(name);
        if (!rule) return total;
        return total + (getCardQuantity(name) * rule.freeLevel0Cards);
      }, 0);
    }

    function getAddedCardDeckSlots(cardName) {
      const rule = getDeckSizeAdjustmentRule(cardName);
      if (rule && Number.isFinite(Number(rule.deckSlots))) {
        return Math.max(0, Number(rule.deckSlots));
      }
      if (isPermanentCardName(cardName)) return 0;
      return 1;
    }

    function getAddedCardCost(cardName) {
      if (isNoXpCardName(cardName)) return 0;
      const level = getCardLevel(cardName);
      const baseCost = level <= 0 ? 1 : level;
      return isExceptionalCardName(cardName) ? (baseCost * 2) : baseCost;
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

    function isMyriadCardName(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return false;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return false;
      if (myriadNameOnlySet.has(nameOnly)) return true;
      return myriadCatalogKeys.some((mk) => {
        const mNameOnly = getNameOnly(mk);
        if (!mNameOnly) return false;
        return (
          nameOnly === mNameOnly ||
          nameOnly.startsWith(mNameOnly + " ") ||
          mNameOnly.startsWith(nameOnly + " ")
        );
      });
    }

    function isCustomizableCardName(cardName) {
      const key = getCatalogKey(cardName);
      if (!key) return false;
      const nameOnly = getNameOnly(key);
      if (!nameOnly) return false;
      if (customizableNameOnlySet.has(nameOnly)) return true;
      return customizableCatalogKeys.some((ck) => {
        const cNameOnly = getNameOnly(ck);
        if (!cNameOnly) return false;
        return (
          nameOnly === cNameOnly ||
          nameOnly.startsWith(cNameOnly + " ") ||
          cNameOnly.startsWith(nameOnly + " ")
        );
      });
    }

    function getUpgradeDiscountKey(cardName) {
      const source = typeof cardName === "string" ? cardName : (cardName && cardName.name ? cardName.name : "");
      const parsed = parseTrailingQuantity(source);
      const key = getCatalogKey(parsed.base || source);
      return getNameOnly(key);
    }

    function getRemovedUpgradeCredit(cardName) {
      if (isNoXpCardName(cardName) || isCustomizableCardName(cardName)) return 0;
      const level = getCardLevel(cardName);
      if (level <= 0) return 0;
      return isExceptionalCardName(cardName) ? (level * 2) : level;
    }

    function buildAddedXpCostItems(cardNames) {
      const items = [];
      const groupedMyriad = new Map();
      (cardNames || []).forEach((name) => {
        const qty = getCardQuantity(name);
        if (isNoXpCardName(name)) return;
        if (isCustomizableCardName(name)) {
          if (!isPhysicalCustomizableRecord(name)) return;
          for (let i = 0; i < qty; i += 1) {
            items.push({
              key: "",
              cost: getAddedCardCost(name),
              freeLevel0Eligible: getCardLevel(name) <= 0,
              deckSlots: getAddedCardDeckSlots(name),
              freeLevel0SlotsRequired: 1,
            });
          }
          return;
        }

        const key = getUpgradeDiscountKey(name);
        const cost = getAddedCardCost(name);
        const freeLevel0Eligible = getCardLevel(name) <= 0;
        if (isMyriadCardName(name)) {
          const existing = groupedMyriad.get(key) || {
            key,
            cost,
            freeLevel0Eligible,
            deckSlots: 0,
            freeLevel0SlotsRequired: 1,
          };
          existing.deckSlots += getAddedCardDeckSlots(name) * qty;
          groupedMyriad.set(key, existing);
          return;
        }

        for (let i = 0; i < qty; i += 1) {
          items.push({ key, cost, freeLevel0Eligible, deckSlots: getAddedCardDeckSlots(name), freeLevel0SlotsRequired: 1 });
        }
      });

      groupedMyriad.forEach((item) => {
        items.push(item);
      });
      return items;
    }

    function buildSameNameUpgradeCreditMap(cardNames) {
      const creditsByKey = new Map();
      const groupedMyriad = new Map();
      (cardNames || []).forEach((name) => {
        const credit = getRemovedUpgradeCredit(name);
        if (credit <= 0) return;
        const key = getUpgradeDiscountKey(name);
        if (!key) return;

        if (isMyriadCardName(name)) {
          groupedMyriad.set(key, Math.max(groupedMyriad.get(key) || 0, credit));
          return;
        }

        const credits = creditsByKey.get(key) || [];
        const qty = getCardQuantity(name);
        for (let i = 0; i < qty; i += 1) {
          credits.push(credit);
        }
        creditsByKey.set(key, credits);
      });

      groupedMyriad.forEach((credit, key) => {
        const credits = creditsByKey.get(key) || [];
        credits.push(credit);
        creditsByKey.set(key, credits);
      });

      creditsByKey.forEach((credits) => {
        credits.sort((a, b) => b - a);
      });
      return creditsByKey;
    }

    function getCostItemDeckSlots(item) {
      const value = Number(item && item.deckSlots);
      return Number.isFinite(value) && value >= 0 ? value : 1;
    }

    function computeAddedXpWithSameNameDiscount(removedCardNames, addedCardNames) {
      const creditsByKey = buildSameNameUpgradeCreditMap(removedCardNames);
      // Replacing a removed card with a new level-0 card still costs 1 XP.
      // Only explicit deck-building effects such as Versatile grant free
      // level-0 card slots; ordinary vacancies in the deck do not.
      let availableFreeLevel0Slots = computeDeckSizeAdjustmentSlots(addedCardNames);
      const costItems = buildAddedXpCostItems(addedCardNames).map((item) => {
        const key = item.key || "";
        let credit = 0;
        const credits = key ? creditsByKey.get(key) : null;
        if (credits && credits.length) {
          credit = credits.shift();
        }
        return Object.assign({}, item, {
          adjustedCost: Math.max(0, item.cost - credit),
        });
      });
      return costItems.reduce((total, item) => {
        const deckSlots = getCostItemDeckSlots(item);
        if (item.adjustedCost > 0 && item.freeLevel0Eligible && deckSlots > 0 && availableFreeLevel0Slots > 0) {
          const neededSlots = Math.max(1, Number(item.freeLevel0SlotsRequired) || 1);
          if (availableFreeLevel0Slots >= neededSlots) {
            availableFreeLevel0Slots = Math.max(0, availableFreeLevel0Slots - deckSlots);
            return total;
          }
        }
        return total + item.adjustedCost;
      }, 0);
    }

    function getCustomizableStateMap(cardNames) {
      const map = new Map();
      (cardNames || []).forEach((name) => {
        if (!isCustomizableCardName(name)) return;
        const rawName = typeof name === "string" ? name : (name && name.name ? name.name : "");
        const parsed = parseTrailingQuantity(rawName);
        const baseName = parsed.base || rawName;
        const key = getCatalogKey(baseName);
        if (!key) return;
        const checks = getCustomizableCheckboxCount(rawName);
        const paidXp = getCustomizablePaidXp(rawName);
        const qty = getCardQuantity(rawName);
        const upgradeIds = Array.isArray(name && name.customizableUpgradeIds) ? uniqueIds(name.customizableUpgradeIds) : [];
        const existing = map.get(key) || {
          explicitChecks: null,
          explicitPaidXp: null,
          qty: 0,
          sampleName: baseName,
          upgradeIds: [],
        };
        if (checks !== null) existing.explicitChecks = Math.max(0, checks);
        if (paidXp !== null) existing.explicitPaidXp = Math.max(0, paidXp);
        existing.qty = Math.max(existing.qty, qty);
        existing.sampleName = baseName;
        existing.upgradeIds = uniqueIds(existing.upgradeIds.concat(upgradeIds));
        map.set(key, existing);
      });
      return map;
    }

    function computeCustomizableSpentXp(customizedCardNames) {
      const customizedMap = getCustomizableStateMap(customizedCardNames);
      let total = 0;
      customizedMap.forEach((customizedState) => {
        if (customizedState.upgradeIds && customizedState.upgradeIds.length) {
          const definition = getCustomizableDefinition(customizedState.sampleName);
          const spent = definition
            ? getCustomizableUpgradeIdsSpentXp(definition, customizedState.upgradeIds)
            : customizedState.upgradeIds.length;
          total += spent;
          return;
        }
        if (customizedState.explicitPaidXp !== null) {
          total += customizedState.explicitPaidXp;
          return;
        }
        if (customizedState.explicitChecks !== null) {
          total += Math.max(0, customizedState.explicitChecks);
        }
      });
      return total;
    }

    function computeNetSpentXp(removedCardNames, addedCardNames, customizedCardNames) {
      const addedCost = computeAddedXpWithSameNameDiscount(removedCardNames, addedCardNames);
      const customizableSpent = computeCustomizableSpentXp(customizedCardNames);
      return addedCost + customizableSpent;
    }

    function getEntryCardLists(entry) {
      return {
        removedList: getEntryList(entry, "removed"),
        addedList: getEntryList(entry, "added"),
        customizedList: getEntryList(entry, "customized"),
      };
    }

    function getEntryNetSpentXp(entry) {
      const { removedList, addedList, customizedList } = getEntryCardLists(entry);
      const removedRows = removedList ? listCardRows(removedList) : [];
      const addedRows = addedList ? listCardRows(addedList) : [];
      const customizedRows = customizedList ? listCardRows(customizedList) : [];
      return computeNetSpentXp(removedRows, addedRows, customizedRows);
    }

    function sumEarnedXpFromEntryHeads(card) {
      if (!card) return 0;
      let earned = 0;
      card.querySelectorAll(".upgrade-entry-head").forEach((head) => {
        const entry = head.closest(".upgrade-entry");
        if (!entry) return;
        if (entry.classList.contains("upgrade-entry-draft")) return;
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

    function getStartingXp(card) {
      return toNonNegativeInteger(card && card.dataset ? card.dataset.startingXp : 0);
    }

    function computeEarnedXp(card) {
      // Use one source of truth to avoid double-counting:
      // once structured entries exist, ignore legacy summary paragraphs.
      const startingXp = getStartingXp(card);
      if (hasConfirmedEntries(card)) {
        return startingXp + sumEarnedXpFromEntryHeads(card);
      }
      return startingXp + sumEarnedXpFromSummaryLines(card);
    }

    function computeAvailableXpExcludingEntry(card, excludedEntry) {
      if (!card) return 0;
      if (!excludedEntry) {
        const earned = computeEarnedXp(card);
        let spent = 0;
        card.querySelectorAll(".upgrade-entry").forEach((entry) => {
          if (entry.classList.contains("upgrade-entry-draft")) return;
          spent += getEntryNetSpentXp(entry);
        });
        return earned - spent;
      }

      let earned = getStartingXp(card);
      let spent = 0;
      const entries = Array.from(card.querySelectorAll(".upgrade-entry"));
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry === excludedEntry) break;
        if (entry.classList.contains("upgrade-entry-draft")) continue;
        const head = entry.querySelector(".upgrade-entry-head");
        earned += getXpFromHead(head ? head.textContent : "");
        spent += getEntryNetSpentXp(entry);
      }
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
      let next = "";
      do {
        next = "e" + entryUidCounter;
        entryUidCounter += 1;
      } while (document.querySelector(`.upgrade-entry[data-entry-uid="${next}"]`));
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
      const disciplineNamesByFile = {
        "discipline_alignment_of_spirit.png": "Discipline: Alignment of Spirit (Unbroken)",
        "discipline_alignment_of_spirit_1.png": "Discipline: Alignment of Spirit (Broken)",
        "discipline_balance_of_body.png": "Discipline: Balance of Body (Unbroken)",
        "discipline_balance_of_body_1.png": "Discipline: Balance of Body (Broken)",
        "discipline_prescience_of_fate.png": "Discipline: Prescience of Fate (Unbroken)",
        "discipline_prescience_of_fate_1.png": "Discipline: Prescience of Fate (Broken)",
        "discipline_quiescence_of_thought.png": "Discipline: Quiescence of Thought (Unbroken)",
        "discipline_quiescence_of_thought_1.png": "Discipline: Quiescence of Thought (Broken)",
      };
      const exactFileName = String(fileName || "").split("/").pop();
      if (disciplineNamesByFile[exactFileName]) return disciplineNamesByFile[exactFileName];

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
        .map((part) => (/^[ivxlcdm]+$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(" ");
      if (level !== null) return name + " (" + level + ")";
      return name;
    }

    function getCatalogKey(name) {
      return normalizeText(stripCustomizableMetaMarkers(name))
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
      cardImageFiles.forEach((file) => {
        const name = toDisplayNameFromFile(file);
        const key = getCatalogKey(name);
        if (!key || map.has(key)) return;
        map.set(key, { name, key });
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
      const prefixedName = catalog.filter((item) => (
        item.key.startsWith(normalized + " ") ||
        normalized.startsWith(item.key + " ")
      ));
      if (prefixedName.length === 1) {
        return prefixedName[0].name;
      }
      return original;
    }

    function wireCardAutocomplete(input, onPick) {
      if (!input || input.dataset.autocompleteBound === "1") return;
      input.dataset.autocompleteBound = "1";

      const row = input.closest(".builder-input-row");
      if (!row) return;

      const panel = document.createElement("div");
      panel.className = "card-autocomplete";
      panel.hidden = true;
      document.body.appendChild(panel);

      let current = [];
      let activeIndex = -1;
      let activeAutocompletePreview = null;
      const previewMargin = 8;

      function positionPanel() {
        if (panel.hidden || !input.isConnected) return;
        const rect = input.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const left = Math.max(previewMargin, Math.min(rect.left, viewportWidth - previewMargin));
        const width = Math.max(160, Math.min(rect.width, viewportWidth - (previewMargin * 2)));
        const belowSpace = Math.max(0, viewportHeight - rect.bottom - previewMargin);
        const aboveSpace = Math.max(0, rect.top - previewMargin);
        const openUp = belowSpace < 220 && aboveSpace > belowSpace;
        const availableHeight = Math.max(140, (openUp ? aboveSpace : belowSpace) - 4);

        panel.style.left = Math.round(left) + "px";
        panel.style.width = Math.round(width) + "px";
        panel.style.right = "auto";
        panel.style.maxHeight = Math.round(Math.min(480, availableHeight)) + "px";
        if (openUp) {
          panel.style.top = "auto";
          panel.style.bottom = Math.round(viewportHeight - rect.top + 4) + "px";
        } else {
          panel.style.top = Math.round(rect.bottom + 4) + "px";
          panel.style.bottom = "auto";
        }
      }

      function positionPanelAndActivePreview() {
        positionPanel();
        const hovered = panel.querySelector(".card-autocomplete-item:hover");
        if (hovered && activeAutocompletePreview) {
          clampAutocompletePreviewPosition(hovered, activeAutocompletePreview);
        }
      }

      function resetAutocompletePreviewPosition(preview) {
        if (!preview) return;
        preview.style.setProperty("display", "none", "important");
        preview.style.removeProperty("visibility");
        preview.style.left = "auto";
        preview.style.right = "auto";
        preview.style.top = "auto";
        preview.style.bottom = "auto";
        preview.style.transform = "none";
        preview.style.removeProperty("max-width");
        preview.style.removeProperty("max-height");
        preview.style.removeProperty("overflow");
      }

      function clampAutocompletePreviewPosition(option, preview) {
        if (!option || !preview) return;
        const rect = option.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

        resetAutocompletePreviewPosition(preview);
        preview.style.setProperty("display", "block", "important");
        preview.style.setProperty("visibility", "visible", "important");
        const previewRect = preview.getBoundingClientRect();
        const previewWidth = Math.min(previewRect.width || 0, Math.max(160, viewportWidth - (previewMargin * 2)));
        const previewHeight = Math.min(previewRect.height || 0, Math.max(160, viewportHeight - (previewMargin * 2)));
        if (!previewWidth || !previewHeight) return;
        preview.style.maxWidth = Math.max(160, viewportWidth - (previewMargin * 2)) + "px";
        preview.style.maxHeight = Math.max(160, viewportHeight - (previewMargin * 2)) + "px";
        preview.style.overflow = "auto";

        const rightSideLeft = rect.right + previewMargin;
        const hasRightSpace = rightSideLeft + previewWidth <= viewportWidth - previewMargin;
        const safeLeft = hasRightSpace
          ? rightSideLeft
          : Math.max(previewMargin, rect.left - previewWidth - previewMargin);
        if (hasRightSpace) {
          preview.style.left = Math.round(safeLeft) + "px";
          preview.style.right = "auto";
        } else {
          preview.style.left = Math.round(safeLeft) + "px";
          preview.style.right = "auto";
        }

        const idealTop = rect.top + rect.height / 2 - previewHeight / 2;
        const minTop = previewMargin;
        const maxTop = Math.max(previewMargin, viewportHeight - previewHeight - previewMargin);
        const safeTop = Math.min(maxTop, Math.max(minTop, idealTop));
        preview.style.top = Math.round(safeTop) + "px";
        preview.style.bottom = "auto";
        preview.style.transform = "none";
      }

      function showAutocompletePreview(option, preview) {
        if (activeAutocompletePreview && activeAutocompletePreview !== preview) {
          resetAutocompletePreviewPosition(activeAutocompletePreview);
        }
        activeAutocompletePreview = preview;
        clampAutocompletePreviewPosition(option, preview);
      }

      function hideAutocompletePreview(preview) {
        resetAutocompletePreviewPosition(preview);
        if (activeAutocompletePreview === preview) {
          activeAutocompletePreview = null;
        }
      }

      function cleanupAutocompletePreviews() {
        if (activeAutocompletePreview) {
          resetAutocompletePreviewPosition(activeAutocompletePreview);
          activeAutocompletePreview = null;
        }
        document.querySelectorAll(".card-autocomplete-preview[data-autocomplete-preview-owner]").forEach((preview) => {
          preview.remove();
        });
      }

      function closePanel() {
        cleanupAutocompletePreviews();
        panel.hidden = true;
        panel.innerHTML = "";
        panel.style.removeProperty("left");
        panel.style.removeProperty("right");
        panel.style.removeProperty("top");
        panel.style.removeProperty("bottom");
        panel.style.removeProperty("width");
        panel.style.removeProperty("max-height");
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
        cleanupAutocompletePreviews();
        panel.innerHTML = "";
        current.forEach((item, idx) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "card-autocomplete-item";
          option.appendChild(document.createTextNode(item.name));
          const preview = buildPreviewNode(item.name);
          preview.classList.add("card-autocomplete-preview");
          preview.dataset.autocompletePreviewOwner = "1";
          document.body.appendChild(preview);
          resetAutocompletePreviewPosition(preview);
          option.addEventListener("mouseenter", () => {
            showAutocompletePreview(option, preview);
          });
          option.addEventListener("mousemove", () => {
            showAutocompletePreview(option, preview);
          });
          option.addEventListener("mouseleave", () => {
            hideAutocompletePreview(preview);
          });
          if (idx === activeIndex) option.classList.add("is-active");
          option.addEventListener("click", () => pick(item.name));
          panel.appendChild(option);
        });
        panel.hidden = false;
        positionPanel();
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
          }
        } else if (event.key === "Escape") {
          closePanel();
        }
      });

      document.addEventListener("click", (event) => {
        if (!row.contains(event.target) && !panel.contains(event.target)) {
          closePanel();
        }
      });

      window.addEventListener("scroll", positionPanelAndActivePreview, true);
      window.addEventListener("resize", positionPanelAndActivePreview);

      panel.addEventListener("scroll", () => {
        const hovered = panel.querySelector(".card-autocomplete-item:hover");
        if (!hovered || !activeAutocompletePreview) return;
        clampAutocompletePreviewPosition(hovered, activeAutocompletePreview);
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
      const nestedDataName = nameNode.querySelector("[data-investigator-name]");
      if (nestedDataName) {
        const value = nestedDataName.getAttribute("data-investigator-name");
        if (value) return value.trim();
      }
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

    function restoreEntryDisplayLayer(entry) {
      if (!entry) return;
      const directChildren = Array.from(entry.children || []);
      const displayColumns = directChildren.find((node) => node.classList && node.classList.contains("upgrade-columns")) || null;
      const displayCustomized = directChildren.find((node) => node.classList && node.classList.contains("customized-section")) || null;
      const displayActions = directChildren.find((node) => node.classList && node.classList.contains("entry-actions")) || null;
      if (displayColumns) displayColumns.style.removeProperty("display");
      if (displayCustomized) displayCustomized.style.removeProperty("display");
      if (displayActions) displayActions.style.removeProperty("display");
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
      closeCustomizableEditor();
      document.querySelectorAll(".upgrade-entry-editor").forEach((node) => {
        restoreEntryDisplayLayer(node.closest(".upgrade-entry"));
        node.remove();
      });
      document.querySelectorAll(".upgrade-entry-draft").forEach((draftEntry) => {
        const linkedTrauma = findLinkedTraumaRow(draftEntry);
        if (linkedTrauma) linkedTrauma.remove();
        draftEntry.remove();
      });
      normalizeScenarioTraumaRows();
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

      const gateFactory = window.BGBEditSyncGate && typeof window.BGBEditSyncGate.create === "function"
        ? window.BGBEditSyncGate.create
        : null;
      if (!gateFactory) return;

      const gate = gateFactory({
        rootClass: "edit-gate",
        buttonClass: "upgrade-btn upgrade-btn-secondary",
        statusClass: "edit-gate-status",
        showSync: !!remoteSync,
        getEditUnlocked: () => isEditEnabled(),
        getSyncConnected: () => !!getRemoteSyncToken(),
        onEditToggle: (currentlyUnlocked) => {
          if (currentlyUnlocked) {
            lockEditMode();
            void runRemoteSyncNow();
          } else {
            tryUnlockEditMode();
          }
        },
        onSyncClick: () => {
          handleRemoteSyncButtonClick();
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
      editGateButton = gate.editButton;
      editGateStatus = gate.editStatus;
      remoteSyncButton = gate.syncButton;
      remoteSyncStatus = gate.syncStatus;

      const title = section.querySelector(".section-title");
      insertBeforeIfChild(section, gate.root, title && title.parentNode === section ? title.nextSibling : section.firstChild);

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

        insertBeforeIfChild(upgradeList, entry, nextSibling);
        if (traumaRow) {
          const insertionAnchor = entry.nextSibling;
          insertBeforeIfChild(upgradeList, traumaRow, insertionAnchor);
        }
        normalizeStaticEntryCardRows(entry);
        ensureEntryActions(entry);
        bindPreviewFallbacks(entry);
        clearUndo();
      });

      const toolbar = upgradeList.querySelector(".upgrade-toolbar");
      insertBeforeIfChild(upgradeList, toast, toolbar || upgradeList.firstChild);

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

      const { removedList, addedList, customizedList } = getEntryCardLists(entry);
      if (!removedList || !addedList) return;
      const directChildren = Array.from(entry.children || []);
      const displayColumns = directChildren.find((node) => node.classList && node.classList.contains("upgrade-columns")) || null;
      const displayCustomized = directChildren.find((node) => node.classList && node.classList.contains("customized-section")) || null;
      const displayActions = directChildren.find((node) => node.classList && node.classList.contains("entry-actions")) || null;

      const hideDisplayLayer = () => {
        if (displayColumns) displayColumns.style.display = "none";
        if (displayCustomized) displayCustomized.style.display = "none";
        if (displayActions) displayActions.style.display = "none";
      };

      const showDisplayLayer = () => {
        if (displayColumns) displayColumns.style.removeProperty("display");
        if (displayCustomized) displayCustomized.style.removeProperty("display");
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
                <input type="text" class="upgrade-input" placeholder="Search cards..." />
              </div>
              <p class="builder-hint">Type at least 2 characters, then select a card from the suggestions.</p>
              <ul class="card-list" data-edit-list="removed"></ul>
            </div>
            <div class="builder-col" data-edit-builder="added">
              <h5>Added</h5>
              <div class="builder-input-row">
                <input type="text" class="upgrade-input" placeholder="Search cards..." />
              </div>
              <p class="builder-hint">Type at least 2 characters, then select a card from the suggestions.</p>
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
      hideDisplayLayer();
      entry.appendChild(editor);
      setCardsWithInlineRemove(removedEditList, listCardRows(removedList));
      setCardsWithInlineRemove(addedEditList, listCardRows(addedList));
      const customizedEditSection = ensureCustomizedSection(editor, true);
      const customizedEditList = customizedEditSection ? getCustomizedList(editor) : null;
      if (customizedEditList) {
        setCards(customizedEditList, customizedList ? listCardRows(customizedList) : []);
      }
      refreshEntryCustomizedSection(entry, { container: editor, editMode: true });
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

        const addCardToEditorList = (rawName) => {
          addOrIncrementCardInList(listEl, rawName);
          input.value = "";
          input.focus();
          refreshCurrentXp();
        };

        wireCardAutocomplete(input, addCardToEditorList);
      });

      editor.querySelector('[data-action="save-edit"]').addEventListener("click", () => {
        const removedCards = listCardRows(removedEditList);
        const addedCards = listCardRows(addedEditList);
        const currentCustomizedEditList = getCustomizedList(editor);
        const customizedCards = currentCustomizedEditList ? listCardRows(currentCustomizedEditList) : [];
        const xpValue = toNonNegativeInteger(editor.querySelector('[data-edit="xp"]').value);
        const card = entry.closest(".upgrade-card");
        const removedValidation = validateRemovedCardsAgainstDeck(card, entry, removedCards);
        if (!removedValidation.valid) {
          setInlineValidationMessage(errorNode, removedValidation.message);
          return;
        }
        const availableBefore = computeAvailableXpExcludingEntry(card, entry);
        const netSpent = computeNetSpentXp(removedCards, addedCards, customizedCards);
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
        if (customizedCards.length) {
          const section = ensureCustomizedSection(entry, false);
          const list = section ? getCustomizedList(entry) : null;
          if (list) setCards(list, customizedCards);
        } else {
          const section = getCustomizedSection(entry);
          if (section) section.remove();
        }
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
                  <input type="text" class="upgrade-input" placeholder="Search cards..." />
                </div>
                <p class="builder-hint">Type at least 2 characters, then select a card from the suggestions.</p>
              </div>
              <div class="builder-col" data-builder="added">
                <h5>Added</h5>
                <div class="builder-input-row">
                  <input type="text" class="upgrade-input" placeholder="Search cards..." />
                </div>
                <p class="builder-hint">Type at least 2 characters, then select a card from the suggestions.</p>
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

        const addCardToList = (rawName) => {
          addOrIncrementCardInList(listEl, rawName);
          input.value = "";
          input.focus();
        };

        wireCardAutocomplete(input, addCardToList);
      });

      entry.querySelector('[data-action="confirm-draft"]').addEventListener("click", () => {
        const head = entry.querySelector(".upgrade-entry-head");
        const xpInput = entry.querySelector('[data-draft="xp"]');
        const draftErrorNode = entry.querySelector('[data-draft-error]');
        const xpValue = toNonNegativeInteger(xpInput ? xpInput.value : 0);
        const { removedList, addedList, customizedList } = getEntryCardLists(entry);
        const removedCards = removedList ? listCardRows(removedList) : [];
        const addedCards = addedList ? listCardRows(addedList) : [];
        const customizedCards = customizedList ? listCardRows(customizedList) : [];
        const netSpent = computeNetSpentXp(removedCards, addedCards, customizedCards);
        const card = entry.closest(".upgrade-card");
        const removedValidation = validateRemovedCardsAgainstDeck(card, entry, removedCards);
        if (!removedValidation.valid) {
          setInlineValidationMessage(draftErrorNode, removedValidation.message);
          return;
        }
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
        if (customizedCards.length) {
          const section = ensureCustomizedSection(entry, false);
          const list = section ? getCustomizedList(entry) : null;
          if (list) setCards(list, customizedCards);
        }
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
        refreshEntryCustomizedSection(draftEntry);
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
      clone.querySelectorAll(".upgrade-toolbar, .undo-toast, .upgrade-entry-editor, .upgrade-entry-draft, .customizable-inline-editor, .customizable-popover").forEach((node) => {
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
      clone.querySelectorAll(".has-customizable-popover").forEach((node) => {
        node.classList.remove("has-customizable-popover");
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
      doc.querySelectorAll("#torch-toggle, header.site-header, nav, footer").forEach((node) => node.remove());
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

    function buildPersistableRemoteContent(sourceContent, state) {
      if (buildPersistableContent) {
        return buildPersistableContent(state, sourceContent);
      }
      return buildPersistableHtml(sourceContent, state);
    }

    async function requestGitHubFileMeta(token) {
      if (!remoteSync) return "";
      const endpoint = githubSync && typeof githubSync.buildContentsEndpoint === "function"
        ? githubSync.buildContentsEndpoint(remoteSync)
        : "";
      const response = await window.fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Host read failed (${response.status})`);
      }
      const payload = await response.json();
      if (!payload || typeof payload.sha !== "string") {
        throw new Error("Host response missing file SHA");
      }
      const encodedContent = typeof payload.content === "string" ? payload.content : "";
      const sourceContent = encodedContent && githubSync && typeof githubSync.decodeBase64Utf8 === "function"
        ? githubSync.decodeBase64Utf8(encodedContent.replace(/\n/g, ""))
        : "";
      return {
        sha: payload.sha,
        sourceContent,
        hash: githubSync && typeof githubSync.quickHash === "function"
          ? githubSync.quickHash(sourceContent)
          : "",
      };
    }

    async function seedRemoteSyncBaseline() {
      if (!remoteSync) return false;
      const token = getRemoteSyncToken();
      if (!token) return false;
      try {
        const fileMeta = await requestGitHubFileMeta(token);
        if (fileMeta && typeof fileMeta.hash === "string") {
          lastSyncedHtmlHash = fileMeta.hash;
          return true;
        }
      } catch (_error) {
        // Keep existing baseline when remote metadata cannot be read.
      }
      return false;
    }

    async function pushHtmlToGitHub(state) {
      if (!remoteSync) return;
      const token = getRemoteSyncToken();
      if (!token) {
        refreshRemoteSyncUi("Host token missing");
        return { status: "token_missing" };
      }

      const endpoint = githubSync && typeof githubSync.buildContentsEndpoint === "function"
        ? githubSync.buildContentsEndpoint(remoteSync).replace(/\?ref=.*$/, "")
        : "";
      const now = new Date();
      const message = `auto-sync deck upgrade ${now.toISOString().slice(0, 19)}Z`;
      let lastError = "";

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const fileMeta = await requestGitHubFileMeta(token);
        const nextContent = buildPersistableRemoteContent(fileMeta.sourceContent, state);
        const nextHash = githubSync && typeof githubSync.quickHash === "function"
          ? githubSync.quickHash(nextContent)
          : "";

        if (nextHash === fileMeta.hash) {
          lastSyncedHtmlHash = nextHash;
          return { status: "no_change" };
        }
        if (lastSyncedHtmlHash && fileMeta.hash !== lastSyncedHtmlHash) {
          throw new Error("Host data changed remotely. Refresh page before syncing.");
        }

        const response = await window.fetch(endpoint, {
          method: "PUT",
          headers: {
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            content: githubSync && typeof githubSync.encodeBase64Utf8 === "function"
              ? githubSync.encodeBase64Utf8(nextContent)
              : "",
            branch: remoteSync.branch,
            sha: fileMeta.sha,
          }),
        });
        if (response.ok) {
          lastSyncedHtmlHash = nextHash;
          return { status: "synced" };
        }

        const detail = githubSync && typeof githubSync.parseHostError === "function"
          ? await githubSync.parseHostError(response)
          : "";
        lastError = detail
          ? `Host write failed (${response.status}): ${detail}`
          : `Host write failed (${response.status})`;
        if (response.status !== 409 || attempt === 3) break;
        if (githubSync && typeof githubSync.delay === "function") {
          await githubSync.delay(220 * attempt);
        }
      }

      throw new Error(lastError || "Host write failed");
    }

    async function runRemoteSyncNow() {
      if (!remoteSync) return;
      if (remoteSyncInFlight) {
        remoteSyncQueued = true;
        return;
      }
      if (!getRemoteSyncToken()) {
        refreshRemoteSyncUi("Host token missing");
        return;
      }
      remoteSyncInFlight = true;
      refreshRemoteSyncUi("Syncing HTML to Host...");
      try {
        if (!lastSyncedHtmlHash) {
          const seeded = await seedRemoteSyncBaseline();
          if (!seeded) {
            throw new Error("Host baseline unavailable. Reconnect sync and retry.");
          }
        }
        const state = buildCurrentUpgradeState();
        const result = await pushHtmlToGitHub(state);
        if (result && result.status === "no_change") {
          refreshRemoteSyncUi("No sync needed");
        } else if (result && result.status === "token_missing") {
          refreshRemoteSyncUi("Host token missing");
        } else {
          const syncedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          refreshRemoteSyncUi(`Host synced at ${syncedAt}`);
        }
      } catch (error) {
        const message = error && error.message ? error.message : "Host sync failed";
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

    function handleRemoteSyncButtonClick() {
      if (!remoteSync) return;
      if (!getRemoteSyncToken()) {
        openRemoteSyncPrompt();
        return;
      }
      void runRemoteSyncNow();
    }

    function openRemoteSyncPrompt() {
      if (!remoteSync) return;
      const existing = getRemoteSyncToken();
      const input = window.prompt(
        [
          "Paste a Host Personal Access Token with repository content write access.",
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
        refreshRemoteSyncUi("Host connected. Lock Edit or click Sync to upload.");
        void seedRemoteSyncBaseline();
      } else {
        refreshRemoteSyncUi("Host sync disconnected");
      }
    }

    function saveUpgradeState() {
      try {
        const state = buildCurrentUpgradeState();
        const envelope = localStateEnvelope && typeof localStateEnvelope.createEnvelope === "function"
          ? localStateEnvelope.createEnvelope({
            sourceHash: sourceStateHashAtLoad || "",
            savedAt: Date.now(),
            state,
          })
          : {
            __bgbLocalStateEnvelope: 1,
            version: 1,
            sourceHash: sourceStateHashAtLoad || "",
            savedAt: Date.now(),
            meta: {},
            state,
          };
        const nextRaw = JSON.stringify(envelope);
        if (nextRaw === lastSavedStateRaw) return;
        window.localStorage.setItem(storageKey, nextRaw);
        lastSavedStateRaw = nextRaw;
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
        const parsedEnvelope = localStateEnvelope && typeof localStateEnvelope.parseEnvelope === "function"
          ? localStateEnvelope.parseEnvelope(raw)
          : null;
        const parsedFallback = parsedEnvelope ? parsedEnvelope.parsed : JSON.parse(raw);
        const parsed = parsedFallback && typeof parsedFallback === "object" ? parsedFallback : null;
        if (!parsed) return;

        const isNewEnvelope = !!(parsedEnvelope && parsedEnvelope.isEnvelope);
        const isOldEnvelope = parsed.__bgbUpgradeStateEnvelope === 1
          && parsed.state
          && typeof parsed.state === "object";
        const isEnvelope = isNewEnvelope || isOldEnvelope;
        const state = isEnvelope
          ? (isNewEnvelope ? parsedEnvelope.state : parsed.state)
          : parsed;
        if (!state || typeof state !== "object") return;

        const savedSourceHash = isNewEnvelope
          ? String(parsedEnvelope.sourceHash || "")
          : (isOldEnvelope && typeof parsed.sourceStateHash === "string" ? parsed.sourceStateHash : "");
        const hasSourceMismatch = localStateEnvelope && typeof localStateEnvelope.isSourceHashMismatch === "function"
          ? localStateEnvelope.isSourceHashMismatch(savedSourceHash, sourceStateHashAtLoad)
          : (!!savedSourceHash && !!sourceStateHashAtLoad && savedSourceHash !== sourceStateHashAtLoad);

        if (hasSourceMismatch) {
          if (localStateEnvelope && typeof localStateEnvelope.backupAndClear === "function") {
            localStateEnvelope.backupAndClear({ storageKey, rawValue: raw });
          } else {
            window.localStorage.setItem(storageKey + "__stale_backup_v1", raw);
            window.localStorage.removeItem(storageKey);
          }
          return;
        }

        if (!isEnvelope && remoteSync && sourceStateHashAtLoad) {
          const legacyStateHash = githubSync && typeof githubSync.quickHash === "function"
            ? githubSync.quickHash(JSON.stringify(state))
            : "";
          if (legacyStateHash !== sourceStateHashAtLoad) {
            if (localStateEnvelope && typeof localStateEnvelope.backupAndClear === "function") {
              localStateEnvelope.backupAndClear({ storageKey, rawValue: raw });
            } else {
              window.localStorage.setItem(storageKey + "__stale_backup_v1", raw);
              window.localStorage.removeItem(storageKey);
            }
            return;
          }
        }

        document.querySelectorAll(".upgrade-card").forEach((card) => {
          const name = getCardOwnerName(card);
          const upgradeList = card.querySelector(".upgrade-list");
          if (!name || !upgradeList) return;
          if (typeof state[name] === "string") {
            upgradeList.innerHTML = state[name];
          }
        });
        const restoredEnvelope = localStateEnvelope && typeof localStateEnvelope.createEnvelope === "function"
          ? localStateEnvelope.createEnvelope({
            sourceHash: sourceStateHashAtLoad || "",
            savedAt: Number(isOldEnvelope ? parsed.updatedAt : (isNewEnvelope ? parsedEnvelope.savedAt : Date.now())) || Date.now(),
            state,
          })
          : {
            __bgbLocalStateEnvelope: 1,
            version: 1,
            sourceHash: sourceStateHashAtLoad || "",
            savedAt: Date.now(),
            meta: {},
            state,
          };
        lastSavedStateRaw = JSON.stringify(restoredEnvelope);
      } catch (_error) {
        // Ignore malformed storage.
      }
    }

    function watchUpgradeChanges() {
      const roots = Array.from(document.querySelectorAll(rootSelector + " .upgrade-grid"));
      if (!roots.length) return;
      roots.forEach((root) => {
        if (!(root instanceof HTMLElement) || root.__bgbMutationWatchBound === true) return;
        root.__bgbMutationWatchBound = true;
        const observer = new MutationObserver(() => {
          scheduleSaveUpgradeState();
          refreshCurrentXp();
        });
        observer.observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
        });
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
        const previousCardRef = getActiveCardRef();
        if (previousCardRef && previousCardRef !== cardRef) {
          resetCardPreviewPosition(previousCardRef.querySelector(".card-preview"));
        }
        window.__bgbActiveCardRef = cardRef || null;
      }

      function isCardRefInteractiveActive(cardRef) {
        if (!cardRef) return false;
        const preview = cardRef.querySelector(".card-preview");
        const activeEl = document.activeElement;
        const cardHovered = typeof cardRef.matches === "function" && cardRef.matches(":hover");
        const previewHovered = !!(preview && typeof preview.matches === "function" && preview.matches(":hover"));
        const cardFocused = !!(activeEl && cardRef.contains(activeEl));
        const previewFocused = !!(preview && activeEl && preview.contains(activeEl));
        return cardHovered || previewHovered || cardFocused || previewFocused;
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
        preview.style.removeProperty("width");
        preview.style.removeProperty("height");
        preview.style.removeProperty("max-width");
        preview.style.removeProperty("max-height");
        preview.style.removeProperty("overflow");
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
        preview.style.removeProperty("width");
        preview.style.removeProperty("height");
        preview.style.removeProperty("max-width");
        preview.style.removeProperty("max-height");
        preview.style.removeProperty("overflow");
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
        const maxWidth = Math.max(160, viewportWidth - (previewMargin * 2));
        const maxHeight = Math.max(160, viewportHeight - (previewMargin * 2));
        const overflowLeft = rect.left < previewMargin;
        const overflowRight = rect.right > (viewportWidth - previewMargin);
        const overflowTop = rect.top < previewMargin;
        const overflowBottom = rect.bottom > (viewportHeight - previewMargin);
        if (!(overflowLeft || overflowRight || overflowTop || overflowBottom)) {
          // Keep default CSS hover behavior when within viewport.
          preview.style.removeProperty("display");
          preview.style.removeProperty("visibility");
          return;
        }

        const clamp = (value, min, max) => {
          if (max < min) return min;
          return Math.min(Math.max(value, min), max);
        };

        let displayWidth = width;
        let displayHeight = height;
        if (preview.tagName === "IMG") {
          const scale = Math.min(1, maxWidth / width, maxHeight / height);
          displayWidth = Math.round(width * scale);
          displayHeight = Math.round(height * scale);
          preview.style.width = displayWidth + "px";
          preview.style.height = displayHeight + "px";
          preview.style.maxWidth = "none";
          preview.style.maxHeight = "none";
          preview.style.overflow = "visible";
        } else {
          preview.style.maxWidth = maxWidth + "px";
          preview.style.maxHeight = maxHeight + "px";
          preview.style.overflow = "auto";
        }

        const anchor = cardRef.getBoundingClientRect();
        let left = anchor.left + (anchor.width / 2) - (displayWidth / 2);
        left = clamp(left, previewMargin, viewportWidth - displayWidth - previewMargin);

        let top = anchor.top - previewGap - displayHeight;
        if (top < previewMargin) {
          top = anchor.bottom + previewGap;
        }
        top = clamp(top, previewMargin, viewportHeight - displayHeight - previewMargin);

        preview.style.position = "fixed";
        preview.style.left = Math.round(left) + "px";
        preview.style.top = Math.round(top) + "px";
        preview.style.right = "auto";
        preview.style.bottom = "auto";
        preview.style.transform = "none";
        preview.style.zIndex = "2147483647";
      }

      function refreshActivePreview() {
        const activeCardRef = getActiveCardRef();
        if (!activeCardRef) return;
        if (!isCardRefInteractiveActive(activeCardRef)) {
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
        if (cardRef.__bgbViewportPreviewBound === true) return;
        if (cardRef.__bgbPreviewBound === true) return;
        cardRef.__bgbPreviewBound = true;
        if (cardRef instanceof HTMLElement) {
          cardRef.removeAttribute("data-preview-bound");
        }

        const isWithinCardRef = (target) => {
          return !!(target && target instanceof Node && cardRef.contains(target));
        };

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

        const reset = (event) => {
          const preview = cardRef.querySelector(".card-preview");
          const relatedTarget = event && event.relatedTarget;
          if (isWithinCardRef(relatedTarget)) {
            return;
          }
          window.requestAnimationFrame(() => {
            if (isCardRefInteractiveActive(cardRef)) return;
            resetCardPreviewPosition(preview);
            if (getActiveCardRef() === cardRef) {
              setActiveCardRef(null);
            }
          });
        };

        cardRef.addEventListener("mouseenter", activate);
        cardRef.addEventListener("mousemove", move);
        cardRef.addEventListener("focusin", activate);
        cardRef.addEventListener("mouseleave", reset);
        cardRef.addEventListener("focusout", reset);

        const preview = cardRef.querySelector(".card-preview");
        const canPreviewReceiveHover = preview && !preview.matches("img.card-preview, .card-preview-placeholder");
        if (canPreviewReceiveHover && preview.__bgbPreviewHoverBound !== true) {
          preview.__bgbPreviewHoverBound = true;
          preview.addEventListener("mouseenter", activate);
          preview.addEventListener("mousemove", move);
          preview.addEventListener("mouseleave", (event) => {
            const relatedTarget = event && event.relatedTarget;
            if (isWithinCardRef(relatedTarget)) {
              return;
            }
            reset(event);
          });
        }
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
      const roots = Array.from(document.querySelectorAll(rootSelector + " .upgrade-grid"));
      roots.forEach((root) => {
        if (!(root instanceof HTMLElement) || root.__bgbCardRemoveBound === true) return;
        root.__bgbCardRemoveBound = true;

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
        insertBeforeIfChild(cardRef, document.createTextNode(text), first || null);
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
        let physical = toNonNegativeInteger(card.dataset.startingPhysicalTrauma || 0);
        let mental = toNonNegativeInteger(card.dataset.startingMentalTrauma || 0);

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

    function getUpgradeListTailAnchor(upgradeList) {
      if (!upgradeList) return null;
      return Array.from(upgradeList.children || []).find((node) => {
        return node instanceof HTMLElement && (
          node.classList.contains("upgrade-toolbar") ||
          node.classList.contains("xp-line") ||
          node.classList.contains("current-trauma-status")
        );
      }) || null;
    }

    function getDirectUpgradeEntries(upgradeList) {
      if (!upgradeList) return [];
      const tailAnchor = getUpgradeListTailAnchor(upgradeList);
      return Array.from(upgradeList.querySelectorAll(".upgrade-entry"))
        .filter((entry) => entry.closest(".upgrade-list") === upgradeList)
        .map((entry) => {
          if (entry.parentNode !== upgradeList) {
            insertBeforeIfChild(upgradeList, entry, tailAnchor);
          }
          return entry;
        });
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
      const roots = Array.from(document.querySelectorAll(rootSelector + " .upgrade-grid"));
      roots.forEach((root) => {
        if (!(root instanceof HTMLElement) || root.__bgbTraumaEditBound === true) return;
        root.__bgbTraumaEditBound = true;

        root.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const valueBtn = target.closest(".trauma-value");
          if (!valueBtn) return;
          event.preventDefault();
          startTraumaInlineEdit(valueBtn);
        });
      });
    }

    function normalizeScenarioTraumaRows() {
      document.querySelectorAll(".upgrade-list").forEach((upgradeList) => {
        const seenUids = new Set();
        const entries = getDirectUpgradeEntries(upgradeList);
        entries.forEach((entry) => {
          let uid = String(entry.dataset.entryUid || "").trim();
          if (!uid || seenUids.has(uid)) {
            entry.removeAttribute("data-entry-uid");
            uid = ensureEntryUid(entry);
          }
          seenUids.add(uid);
        });

        const entryTraumaMap = new Map();
        const entryByUid = new Map();
        const entryByScenario = new Map();
        entries.forEach((entry) => {
          const uid = ensureEntryUid(entry);
          entryByUid.set(uid, entry);
          const head = entry.querySelector(".upgrade-entry-head");
          const scenarioLabel = getScenarioLabelFromHead(head ? head.textContent : "");
          if (scenarioLabel && !entryByScenario.has(scenarioLabel)) {
            entryByScenario.set(scenarioLabel, entry);
          }
        });

        Array.from(upgradeList.querySelectorAll(".scenario-trauma")).forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.closest(".upgrade-list") !== upgradeList) return;
          renderTraumaRow(node);

          const linkedUid = String(node.dataset.entryUidLink || "").trim();
          const scenarioLabel = getScenarioLabelFromTraumaRow(node);
          const targetEntry = (linkedUid && entryByUid.get(linkedUid))
            || (scenarioLabel && entryByScenario.get(scenarioLabel))
            || null;
          if (!targetEntry) {
            node.remove();
            return;
          }

          const entryUid = ensureEntryUid(targetEntry);
          const existing = entryTraumaMap.get(entryUid);
          if (existing) {
            existing.dataset.physical = String(Math.max(
              toNonNegativeInteger(existing.dataset.physical || 0),
              toNonNegativeInteger(node.dataset.physical || 0)
            ));
            existing.dataset.mental = String(Math.max(
              toNonNegativeInteger(existing.dataset.mental || 0),
              toNonNegativeInteger(node.dataset.mental || 0)
            ));
            renderTraumaRow(existing);
            node.remove();
            return;
          }

          entryTraumaMap.set(entryUid, node);
        });

        entries.forEach((entry) => {
          const entryUid = ensureEntryUid(entry);
          const head = entry.querySelector(".upgrade-entry-head");
          const scenarioLabel = getScenarioLabelFromHead(head ? head.textContent : "");
          if (!scenarioLabel) return;
          let row = entryTraumaMap.get(entryUid) || null;
          if (!row) {
            row = createScenarioTraumaRow(scenarioLabel);
            entryTraumaMap.set(entryUid, row);
          }
          const anchor = entry.nextSibling;
          row.dataset.entryUidLink = entryUid;
          row.dataset.traumaLabel = `Trauma (Scenario ${scenarioLabel}):`;
          renderTraumaRow(row);
          insertBeforeIfChild(upgradeList, row, anchor);
        });
      });
    }

    function ensureCampaignStartNotes() {
      const noteText = getCampaignStartNoteText();
      if (!noteText) return;

      document.querySelectorAll(".upgrade-card .upgrade-list").forEach((upgradeList) => {
        if (!(upgradeList instanceof HTMLElement)) return;

        const existingNotes = Array.from(upgradeList.querySelectorAll(":scope > .campaign-start-note"));
        let noteNode = existingNotes[0] || null;

        if (!noteNode) {
          const firstParagraph = upgradeList.querySelector(":scope > p");
          if (firstParagraph && /^Campaign Start\s*\(/i.test(String(firstParagraph.textContent || "").trim())) {
            noteNode = firstParagraph;
            noteNode.classList.add("campaign-start-note");
          }
        }

        if (!noteNode) {
          noteNode = document.createElement("p");
          noteNode.className = "campaign-start-note";
          insertBeforeIfChild(upgradeList, noteNode, upgradeList.firstChild);
        }

        noteNode.textContent = noteText;

        existingNotes.slice(1).forEach((node) => node.remove());
        Array.from(upgradeList.querySelectorAll(":scope > p")).forEach((node) => {
          if (node === noteNode) return;
          if (/^Campaign Start\s*\(/i.test(String(node.textContent || "").trim())) {
            node.remove();
          }
        });
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
      if (activeCustomizableEditor) {
        window.requestAnimationFrame(positionCustomizableEditor);
      }
    }, { passive: true });
    window.addEventListener("scroll", () => {
      if (!activeCustomizableEditor) return;
      window.requestAnimationFrame(positionCustomizableEditor);
    }, { passive: true });

    ensureCampaignStartNotes();
    try {
      sourceStateHashAtLoad = githubSync && typeof githubSync.quickHash === "function"
        ? githubSync.quickHash(JSON.stringify(buildCurrentUpgradeState()))
        : "";
    } catch (_error) {
      sourceStateHashAtLoad = "";
    }
    restoreUpgradeState();
    ensureCampaignStartNotes();
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
      const currentEnvelope = localStateEnvelope && typeof localStateEnvelope.createEnvelope === "function"
        ? localStateEnvelope.createEnvelope({
          sourceHash: sourceStateHashAtLoad || "",
          savedAt: Date.now(),
          state: buildCurrentUpgradeState(),
        })
        : {
          __bgbLocalStateEnvelope: 1,
          version: 1,
          sourceHash: sourceStateHashAtLoad || "",
          savedAt: Date.now(),
          meta: {},
          state: buildCurrentUpgradeState(),
        };
      lastSavedStateRaw = JSON.stringify(currentEnvelope);
    } catch (_error) {
      // Ignore serialization failures.
    }
    remoteSyncReady = true;
    if (getRemoteSyncToken()) {
      void seedRemoteSyncBaseline().finally(() => {
        scheduleSaveUpgradeState();
      });
    } else {
      scheduleSaveUpgradeState();
    }
    window.addEventListener("beforeunload", () => {
      saveUpgradeState();
    });
    refreshCurrentXp();
    refreshTraumaStatus();
  }

  window.initAhlcgUpgradeManager = initAhlcgUpgradeManager;
})();
