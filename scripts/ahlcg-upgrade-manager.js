(function () {
  function initAhlcgUpgradeManager(config) {
    const options = config || {};
    const cardDir = options.cardDir || "assets/boardgames/ahlcg_cards";
    const cardImageFiles = Array.isArray(options.cardImageFiles) ? options.cardImageFiles : [];
    const storageKey = options.storageKey || "ahlcg_upgrade_state_default_v1";
    const pendingDeleteKey = storageKey + "__pending_delete_v1";
    const rootSelector = options.rootSelector || "#upgrade-history";

    const cardCatalog = cardImageFiles.map((file) => ({
      file,
      key: normalizeText(file.replace(/\.png$/i, "")),
      level: getLevelFromFileName(file),
    }));

    let activeUndo = null;
    let saveTimer = null;

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
      const requestedLevel = getRequestedLevel(cardName);
      let best = null;
      let bestScore = 0;

      cardCatalog.forEach((item) => {
        const itemNameOnly = getNameOnly(item.key);
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

    function inferImagePath(cardName) {
      const normalized = normalizeText(cardName).replace(/\s+/g, "_");
      if (!normalized) return null;
      return cardDir + "/" + normalized + ".png";
    }

    function buildPreviewNode(cardName) {
      const src = findMatchingImage(cardName) || inferImagePath(cardName);
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

    function createCardListItem(cardName) {
      const li = document.createElement("li");
      const ref = document.createElement("span");
      ref.className = "card-ref";
      ref.appendChild(document.createTextNode(cardName));
      ref.appendChild(buildPreviewNode(cardName));
      li.appendChild(ref);
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

    function parseInputCards(textValue) {
      return String(textValue || "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
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

    function getUpgradeCardName(upgradeList) {
      const card = upgradeList ? upgradeList.closest(".upgrade-card") : null;
      const nameNode = card ? card.querySelector("h3") : null;
      return nameNode ? nameNode.textContent.trim() : "";
    }

    function savePendingDelete(payload) {
      try {
        window.localStorage.setItem(pendingDeleteKey, JSON.stringify(payload));
      } catch (_error) {
        // Ignore storage failures.
      }
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
        scheduleSaveUpgradeState();
      }
    }

    function showUndoToast(upgradeList, entry, nextSibling, expiresAt) {
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
      if (entry.querySelector(".upgrade-entry-editor")) return;

      const lists = entry.querySelectorAll(".card-list");
      if (lists.length < 2) return;
      const removedList = lists[0];
      const addedList = lists[1];

      const editor = document.createElement("div");
      editor.className = "upgrade-entry-editor";
      editor.innerHTML = `
        <div class="editor-grid">
          <div class="editor-col">
            <h5>Removed</h5>
            <textarea class="editor-textarea" data-edit="removed" placeholder="One card per line"></textarea>
          </div>
          <div class="editor-col">
            <h5>Added</h5>
            <textarea class="editor-textarea" data-edit="added" placeholder="One card per line"></textarea>
          </div>
        </div>
        <div class="entry-actions">
          <button type="button" class="upgrade-btn" data-action="save-edit">Save</button>
          <button type="button" class="upgrade-btn upgrade-btn-secondary" data-action="cancel-edit">Cancel</button>
          <button type="button" class="upgrade-btn upgrade-btn-danger" data-action="delete-entry">Delete Scenario</button>
        </div>
      `;

      editor.querySelector('[data-edit="removed"]').value = listCardNames(removedList).join("\n");
      editor.querySelector('[data-edit="added"]').value = listCardNames(addedList).join("\n");

      editor.querySelector('[data-action="save-edit"]').addEventListener("click", () => {
        const removedCards = parseInputCards(editor.querySelector('[data-edit="removed"]').value);
        const addedCards = parseInputCards(editor.querySelector('[data-edit="added"]').value);
        setCards(removedList, removedCards);
        setCards(addedList, addedCards);
        editor.remove();
      });

      editor.querySelector('[data-action="cancel-edit"]').addEventListener("click", () => {
        editor.remove();
      });

      editor.querySelector('[data-action="delete-entry"]').addEventListener("click", () => {
        const ok = window.confirm("Delete this scenario entry?");
        if (!ok) return;
        const upgradeList = entry.closest(".upgrade-list");
        const nextSibling = entry.nextElementSibling;
        clearUndo({ forceClearPending: true });
        if (upgradeList) {
          const nextHead = nextSibling && nextSibling.classList.contains("upgrade-entry")
            ? nextSibling.querySelector(".upgrade-entry-head")
            : null;
          savePendingDelete({
            cardName: getUpgradeCardName(upgradeList),
            entryHtml: entry.outerHTML,
            nextEntryHead: nextHead ? nextHead.textContent.trim() : "",
            expiresAt: Date.now() + 60000,
          });
        }
        entry.remove();
        if (upgradeList) {
          showUndoToast(upgradeList, entry, nextSibling, Date.now() + 60000);
        }
      });

      entry.appendChild(editor);
    }

    function ensureEntryActions(entry) {
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

        const addCardFromInput = () => {
          const name = input.value.trim();
          if (!name) return;
          listEl.appendChild(createCardListItem(name));
          input.value = "";
          input.focus();
        };

        addBtn.addEventListener("click", addCardFromInput);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addCardFromInput();
          }
        });
      });

      entry.querySelector('[data-action="confirm-draft"]').addEventListener("click", () => {
        const head = entry.querySelector(".upgrade-entry-head");
        head.textContent = `After Scenario ${intToRoman(scenarioNumber)}`;
        const builder = entry.querySelector(".upgrade-entry-builder");
        if (builder) builder.remove();
        entry.classList.remove("upgrade-entry-draft");
        ensureEntryActions(entry);
      });

      entry.querySelector('[data-action="rollback-draft"]').addEventListener("click", () => {
        entry.remove();
      });

      return entry;
    }

    function addToolbar(card) {
      const upgradeList = card.querySelector(".upgrade-list");
      if (!upgradeList) return;
      if (upgradeList.querySelector(".upgrade-toolbar")) return;

      const toolbar = document.createElement("div");
      toolbar.className = "upgrade-toolbar";
      toolbar.innerHTML = '<button type="button" class="upgrade-btn" data-action="new-scenario">+ New Scenario</button>';

      toolbar.querySelector('[data-action="new-scenario"]').addEventListener("click", () => {
        const hasDraft = !!upgradeList.querySelector(".upgrade-entry-draft");
        if (hasDraft) return;
        const scenarioNum = nextScenarioNumber(upgradeList);
        const draftEntry = createScenarioDraft(scenarioNum);
        upgradeList.appendChild(draftEntry);
      });

      upgradeList.appendChild(toolbar);
    }

    function sanitizeUpgradeListForSave(listEl) {
      const clone = listEl.cloneNode(true);
      clone.querySelectorAll(".upgrade-toolbar, .undo-toast, .upgrade-entry-editor").forEach((node) => {
        node.remove();
      });
      clone.querySelectorAll("[data-bound]").forEach((node) => {
        node.removeAttribute("data-bound");
      });
      return clone.innerHTML;
    }

    function saveUpgradeState() {
      try {
        const state = {};
        document.querySelectorAll(".upgrade-card").forEach((card) => {
          const nameNode = card.querySelector("h3");
          const name = nameNode ? nameNode.textContent.trim() : "";
          const upgradeList = card.querySelector(".upgrade-list");
          if (!name || !upgradeList) return;
          state[name] = sanitizeUpgradeListForSave(upgradeList);
        });
        window.localStorage.setItem(storageKey, JSON.stringify(state));
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

    function restoreUpgradeState() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state || typeof state !== "object") return;

        document.querySelectorAll(".upgrade-card").forEach((card) => {
          const nameNode = card.querySelector("h3");
          const name = nameNode ? nameNode.textContent.trim() : "";
          const upgradeList = card.querySelector(".upgrade-list");
          if (!name || !upgradeList) return;
          if (typeof state[name] === "string") {
            upgradeList.innerHTML = state[name];
          }
        });
      } catch (_error) {
        // Ignore malformed storage.
      }
    }

    function watchUpgradeChanges() {
      const root = document.querySelector(rootSelector + " .upgrade-grid");
      if (!root) return;
      const observer = new MutationObserver(() => {
        scheduleSaveUpgradeState();
      });
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    function bindPreviewFallbacks(container) {
      const root = container || document;
      root.querySelectorAll("img.card-preview").forEach((img) => {
        if (img.dataset.bound === "1") return;
        img.dataset.bound = "1";
        img.addEventListener("error", () => {
          const cardRef = img.closest(".card-ref");
          const cardName = cardRef ? getCardNameFromRef(cardRef) : img.alt || "Unknown Card";
          img.replaceWith(buildPlaceholderPreview(cardName));
        });
      });
    }

    function setupExistingPreviewFallbacks() {
      bindPreviewFallbacks(document);
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
      if (!cardName || !entryHtml) {
        clearPendingDelete();
        return;
      }

      const targetCard = Array.from(document.querySelectorAll(".upgrade-card")).find((card) => {
        const nameNode = card.querySelector("h3");
        return nameNode && nameNode.textContent.trim() === cardName;
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

      let nextSibling = null;
      const nextHeadText = String(pending.nextEntryHead || "");
      if (nextHeadText) {
        nextSibling = Array.from(upgradeList.querySelectorAll(".upgrade-entry")).find((item) => {
          const head = item.querySelector(".upgrade-entry-head");
          return head && head.textContent.trim() === nextHeadText;
        }) || null;
      }

      showUndoToast(upgradeList, entry, nextSibling, expiresAt);
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

    restoreUpgradeState();
    setupExistingPreviewFallbacks();
    document.querySelectorAll(".upgrade-entry").forEach((entry) => {
      ensureEntryActions(entry);
    });
    document.querySelectorAll(".upgrade-card").forEach((card) => {
      addToolbar(card);
    });
    restorePendingDelete();
    watchUpgradeChanges();
    scheduleSaveUpgradeState();
    window.addEventListener("beforeunload", () => {
      saveUpgradeState();
    });
    refreshTraumaStatus();
  }

  window.initAhlcgUpgradeManager = initAhlcgUpgradeManager;
})();
