// Data-driven renderer for Arkham parallel campaign record pages.
(() => {
  const root = document.getElementById("arkham-parallel-campaign-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "").trim();
  if (!dataSource) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function appendItems(parent, items, className) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      parent.appendChild(el("span", className, String(item || "")));
    });
  }

  function normalizeCatalogKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/["']/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function getCustomizableDefinition(cardName) {
    const lib = window.AHLCG_CUSTOMIZABLE_LIBRARY && typeof window.AHLCG_CUSTOMIZABLE_LIBRARY === "object"
      ? window.AHLCG_CUSTOMIZABLE_LIBRARY.cards || {}
      : {};
    return lib[normalizeCatalogKey(cardName)] || null;
  }

  function getCustomizableGroupIds(group) {
    const boxes = Number(group && group.boxes) > 0 ? Number(group.boxes) : 0;
    const baseId = String(group && group.id ? group.id : "").trim();
    if (!baseId || boxes <= 0) return [];
    return Array.from({ length: boxes }, (_, idx) => `${baseId}.${idx + 1}`);
  }

  function renderCustomizableStateNote(note) {
    const wrap = el("div", "story-note customizable-state-note");
    if (note.title) wrap.appendChild(el("h4", "", String(note.title)));
    if (note.text) wrap.appendChild(el("p", "", String(note.text)));

    const definition = getCustomizableDefinition(note.card);
    if (!definition) return wrap;

    const meta = el("div", "record-meta");
    appendItems(meta, [
      `Investigator: ${String(note.investigator || "")}`,
      `Card: ${String(definition.displayName || note.card || "")}`,
    ], "meta-item");
    wrap.appendChild(meta);

    const checked = new Set(Array.isArray(note.checkedIds) ? note.checkedIds.map((id) => String(id || "").trim()).filter(Boolean) : []);
    const list = el("div", "customizable-preview-panel");
    (definition.groups || []).forEach((group) => {
      const row = el("div", "customizable-group");
      const head = el("div", "customizable-group-head");
      head.appendChild(el("span", "customizable-group-label", String(group.label || "").replace(/\.$/, "")));
      const boxes = el("div", "customizable-group-boxes");
      getCustomizableGroupIds(group).forEach((id, idx) => {
        const chip = el("span", "customizable-box", String(idx + 1));
        if (checked.has(id)) chip.classList.add("is-inherited");
        boxes.appendChild(chip);
      });
      head.appendChild(boxes);
      row.appendChild(head);
      if (group.text) row.appendChild(el("p", "customizable-group-text", String(group.text)));
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderStoryNote(note) {
    if (note && typeof note === "object" && note.customizableState) {
      return renderCustomizableStateNote(note.customizableState);
    }
    const wrap = el("div", "story-note");
    if (note.title) wrap.appendChild(el("h4", "", String(note.title)));
    if (note.text) wrap.appendChild(el("p", "", String(note.text)));
    if (Array.isArray(note.items) && note.items.length) {
      const list = el("ul", note.listClass || "");
      note.items.forEach((item) => {
        const li = el("li", item && item.className ? String(item.className) : "", String(item && item.text ? item.text : item || ""));
        list.appendChild(li);
      });
      wrap.appendChild(list);
    }
    return wrap;
  }

  function appendStoryNoteContent(parent, note) {
    if (!note || typeof note !== "object") return;
    if (note.title) parent.appendChild(el("h4", "", String(note.title)));
    if (note.text) parent.appendChild(el("p", "", String(note.text)));
    if (Array.isArray(note.items) && note.items.length) {
      const list = el("ul", note.listClass || "");
      note.items.forEach((item) => {
        const li = el("li", item && item.className ? String(item.className) : "", String(item && item.text ? item.text : item || ""));
        list.appendChild(li);
      });
      parent.appendChild(list);
    }
  }

  function renderLinearStoryEntry(entry) {
    if (String(entry.variant || "") === "session-meta") {
      const meta = el("div", "record-meta linear-session-meta");
      appendItems(meta, entry.metaItems, "meta-item");
      return meta;
    }
    const section = el("div", "scenario-log linear-story-entry");
    section.appendChild(el("h3", "", String(entry.title || "")));

    if (Array.isArray(entry.statusChips) && entry.statusChips.length) {
      const status = el("div", "campaign-status");
      appendItems(status, entry.statusChips, "status-chip");
      section.appendChild(status);
    }

    if (Array.isArray(entry.metaItems) && entry.metaItems.length) {
      const meta = el("div", "record-meta");
      appendItems(meta, entry.metaItems, "meta-item");
      section.appendChild(meta);
    }

    const storyNote = el("div", "story-note");
    (Array.isArray(entry.notes) ? entry.notes : []).forEach((note) => {
      appendStoryNoteContent(storyNote, note || {});
    });
    section.appendChild(storyNote);

    return section;
  }

  function renderCampaignLogSection(data, main) {
    if (!data || !Array.isArray(data.sections) || !data.sections.length) return;
    const section = el("section", "record-section");
    section.id = "campaign-log";
    section.appendChild(el("h2", "section-title", String(data.title || "Campaign Log")));
    const card = el("div", "record-card");

    (Array.isArray(data.sections) ? data.sections : []).forEach((entry) => {
      const block = el("div", "scenario-log");
      block.appendChild(el("h3", "", String(entry.title || "")));
      if (Array.isArray(entry.metaItems) && entry.metaItems.length) {
        const meta = el("div", "record-meta");
        appendItems(meta, entry.metaItems, "meta-item");
        block.appendChild(meta);
      }
      (Array.isArray(entry.notes) ? entry.notes : []).forEach((note) => {
        block.appendChild(renderStoryNote(note || {}));
      });
      card.appendChild(block);
    });

    section.appendChild(card);
    main.appendChild(section);
  }

  function renderUpgradeCard(card) {
    const article = el("article", "upgrade-card");
    const heading = el("h3");
    if (card.name) {
      heading.setAttribute("data-investigator-name", String(card.name));
    }
    const pill = el("span", "investigator-pill card-ref", String(card.name || ""));
    const preview = document.createElement("img");
    preview.className = "card-preview";
    preview.src = String(card.imageSrc || "");
    preview.alt = String(card.imageAlt || card.name || "");
    pill.appendChild(preview);
    heading.appendChild(pill);
    article.appendChild(heading);

    article.appendChild(el("p", "xp-line", String(card.currentXp || "Current XP: 0")));

    const upgradeList = el("div", "upgrade-list");
    upgradeList.innerHTML = String(card.upgradeHtml || "").trim();
    article.appendChild(upgradeList);

    article.appendChild(el("p", "current-trauma-status", String(card.currentTraumaStatus || "Current Trauma Status: Physical 0, Mental 0.")));
    return article;
  }

  function renderUpgradeTrack(track) {
    const wrap = el("div", "dream-upgrade-track");
    wrap.appendChild(el("h3", "track-upgrade-title", String(track.title || "")));

    if (Array.isArray(track.cards) && track.cards.length) {
      const grid = el("div", "upgrade-grid");
      grid.dataset.cardRemoveBound = "1";
      grid.dataset.traumaEditBound = "1";
      track.cards.forEach((card) => grid.appendChild(renderUpgradeCard(card || {})));
      wrap.appendChild(grid);
      return wrap;
    }

    if (track.emptyNote) {
      wrap.appendChild(renderStoryNote(track.emptyNote));
    }
    return wrap;
  }

  function buildPersistableParallelCampaignJson(state, sourceContent) {
    const payload = JSON.parse(String(sourceContent || "{}"));
    const tracks = Array.isArray(payload.upgradeTracks) ? payload.upgradeTracks : [];
    tracks.forEach((track) => {
      const cards = Array.isArray(track.cards) ? track.cards : [];
      cards.forEach((card) => {
        const name = String(card && card.name ? card.name : "").trim();
        if (!name || typeof state[name] !== "string") return;
        const renderedCard = Array.from(document.querySelectorAll(".upgrade-card")).find((node) => {
          const heading = node.querySelector("h3");
          if (!heading) return false;
          const dataName = String(heading.getAttribute("data-investigator-name") || "").trim();
          return dataName === name;
        });
        if (!renderedCard) return;
        const xpLine = renderedCard.querySelector(".xp-line");
        const traumaStatus = renderedCard.querySelector(".current-trauma-status");
        card.upgradeHtml = state[name];
        if (xpLine) card.currentXp = xpLine.textContent.trim();
        if (traumaStatus) card.currentTraumaStatus = traumaStatus.textContent.trim();
      });
    });
    return JSON.stringify(payload, null, 2) + "\n";
  }

  function renderPage(data) {
    root.innerHTML = "";
    document.title = String(data.pageTitle || "Arkham Horror LCG");
    window.BGB_AHLCG_CUSTOMIZABLE_STATE = {};
    (Array.isArray(data.customizableState) ? data.customizableState : []).forEach((row) => {
      const investigator = String(row && row.investigator ? row.investigator : "").trim();
      const card = String(row && row.card ? row.card : "").trim();
      if (!investigator || !card) return;
      if (!window.BGB_AHLCG_CUSTOMIZABLE_STATE[investigator]) {
        window.BGB_AHLCG_CUSTOMIZABLE_STATE[investigator] = {};
      }
      window.BGB_AHLCG_CUSTOMIZABLE_STATE[investigator][card] = Array.isArray(row.checkedIds)
        ? row.checkedIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
    });

    const main = el("main", "container");
    main.appendChild(el("h1", "page-title", String(data.headerTitle || data.pageTitle || "Arkham Horror LCG")));

    const subnav = el("div", "subnav");
    (Array.isArray(data.subnav) ? data.subnav : []).forEach((item) => {
      const link = el("a", "", String(item.label || ""));
      link.href = String(item.href || "#");
      subnav.appendChild(link);
    });
    main.appendChild(subnav);

    const overview = data.overview || {};
    const overviewSection = el("section", "record-section");
    overviewSection.id = "story-notes";
    overviewSection.appendChild(el("h2", "section-title", String(overview.title || "Campaign Overview")));
    const overviewCard = el("div", "record-card");

    const campaignStatus = el("div", "campaign-status");
    appendItems(campaignStatus, overview.statusChips, "status-chip");
    overviewCard.appendChild(campaignStatus);

    const meta = el("div", "record-meta");
    appendItems(meta, overview.metaItems, "meta-item");
    overviewCard.appendChild(meta);

    const useLinearStoryLayout = Boolean(data.linearStoryLayout);
    if (Array.isArray(data.storyNotes) && data.storyNotes.length) {
      data.storyNotes.forEach((entry) => {
        overviewCard.appendChild(renderLinearStoryEntry(entry || {}));
      });
      overviewSection.appendChild(overviewCard);
      main.appendChild(overviewSection);
    } else {
      (Array.isArray(overview.sections) ? overview.sections : []).forEach((section) => {
        const scenarioLog = el("div", "scenario-log");
        scenarioLog.appendChild(el("h3", "", String(section.title || "")));
        if (Array.isArray(section.metaItems) && section.metaItems.length) {
          const innerMeta = el("div", "record-meta");
          appendItems(innerMeta, section.metaItems, "meta-item");
          scenarioLog.appendChild(innerMeta);
        }
        (Array.isArray(section.notes) ? section.notes : []).forEach((note) => {
          scenarioLog.appendChild(renderStoryNote(note || {}));
        });
        overviewCard.appendChild(scenarioLog);
      });

      if (Array.isArray(overview.teamColumns) && overview.teamColumns.length) {
        const teamGrid = el("div", "dream-eaters-overview-grid");
        overview.teamColumns.forEach((note) => teamGrid.appendChild(renderStoryNote(note || {})));
        overviewCard.appendChild(teamGrid);
      }
      overviewSection.appendChild(overviewCard);
      main.appendChild(overviewSection);
    }

    if (useLinearStoryLayout) {
      renderCampaignLogSection(data.campaignLog || {}, main);
    } else {
      const timeline = data.timeline || {};
      const timelineSection = el("section", "record-section");
      timelineSection.id = "timeline";
      timelineSection.appendChild(el("h2", "section-title", String(timeline.title || "Interwoven Timeline")));
      const timelineCard = el("div", "record-card");
      const timelineGrid = el("div", "timeline-grid");
      (Array.isArray(timeline.steps) ? timeline.steps : []).forEach((step) => {
        timelineGrid.appendChild(renderStoryNote({
          title: step.title || "",
          text: step.text || "",
        }));
        timelineGrid.lastChild.classList.add("timeline-step");
      });
      timelineCard.appendChild(timelineGrid);
      if (timeline.crossNotes) timelineCard.appendChild(renderStoryNote(timeline.crossNotes));
      timelineSection.appendChild(timelineCard);
      main.appendChild(timelineSection);

      const trackSection = el("section", "record-section");
      trackSection.id = "parallel-campaigns";
      trackSection.appendChild(el("h2", "section-title", String(data.trackSectionTitle || "Parallel Campaign Tracks")));
      const trackGrid = el("div", "dream-track-grid");
      (Array.isArray(data.tracks) ? data.tracks : []).forEach((track) => {
        const article = el("article", "record-card dream-track-card");
        if (track.id) article.id = String(track.id);
        const header = el("div", "track-header");
        header.appendChild(el("h3", "", String(track.title || "")));
        if (track.subtitle) header.appendChild(el("p", "track-subtitle", String(track.subtitle)));
        article.appendChild(header);

        const status = el("div", "campaign-status");
        appendItems(status, track.statusChips, "status-chip");
        article.appendChild(status);

        const trackMeta = el("div", "record-meta");
        appendItems(trackMeta, track.metaItems, "meta-item");
        article.appendChild(trackMeta);

        (Array.isArray(track.notes) ? track.notes : []).forEach((note) => article.appendChild(renderStoryNote(note || {})));

        const scenarioGrid = el("div", "track-scenario-grid");
        (Array.isArray(track.scenarios) ? track.scenarios : []).forEach((note) => scenarioGrid.appendChild(renderStoryNote(note || {})));
        article.appendChild(scenarioGrid);
        trackGrid.appendChild(article);
      });
      trackSection.appendChild(trackGrid);
      main.appendChild(trackSection);
    }

    const upgradeSection = el("section", "record-section");
    upgradeSection.id = "upgrade-history";
    upgradeSection.appendChild(el("h2", "section-title", String(data.upgradeHistoryTitle || "Deck Upgrade History")));
    const upgradeCard = el("div", "record-card");
    (Array.isArray(data.upgradeTracks) ? data.upgradeTracks : []).forEach((track) => {
      upgradeCard.appendChild(renderUpgradeTrack(track || {}));
    });
    upgradeSection.appendChild(upgradeCard);
    main.appendChild(upgradeSection);

    const backWrap = el("div", "back-link-wrap");
    const backLink = el("a", "back-link", String(data.backLabel || "Back to Arkham Horror LCG"));
    backLink.href = String(data.backHref || "/arkham_horror_lcg/");
    backWrap.appendChild(backLink);
    main.appendChild(backWrap);

    root.appendChild(main);

    if (window.BGB && typeof window.BGB.setupHoverImagePreview === "function") {
      window.BGB.setupHoverImagePreview();
    }

    const ahlcgLibrary = window.AHLCG_STANDARD_NAME_LIBRARY || {};
    const upgradeConfig = data.upgradeManager || {};
    if (typeof window.initAhlcgUpgradeManager === "function") {
      window.initAhlcgUpgradeManager({
        storageKey: String(upgradeConfig.storageKey || "ahlcg_parallel_campaign_upgrade_state_v1"),
        editPassword: String(upgradeConfig.editPassword || ""),
        cardDir: String(upgradeConfig.cardDir || "/assets/boardgames/ahlcg_cards"),
        investigatorDir: String(upgradeConfig.investigatorDir || "/assets/boardgames/ahlcg_investigators"),
        cardImageFiles: ahlcgLibrary.cardImageFiles || [],
        standardCardNames: ahlcgLibrary.standardCardNames || [],
        myriadCardNames: ahlcgLibrary.myriadCardNames || [],
        exceptionalCardNames: ahlcgLibrary.exceptionalCardNames || [],
        customizableCardNames: ahlcgLibrary.customizableCardNames || [],
        customizableBaselineState: window.BGB_AHLCG_CUSTOMIZABLE_STATE || {},
        campaignStartNote: upgradeConfig.campaignStartNote || null,
        inactivityMs: Number(upgradeConfig.inactivityMs) > 0 ? Number(upgradeConfig.inactivityMs) : 120000,
        remoteSync: upgradeConfig.remoteSync || null,
        remoteSyncTokenStorageKey: String(upgradeConfig.remoteSyncTokenStorageKey || "bgb_github_sync_token_v1"),
        remoteSyncDebounceMs: Number(upgradeConfig.remoteSyncDebounceMs) > 0 ? Number(upgradeConfig.remoteSyncDebounceMs) : 2800,
        buildPersistableContent: buildPersistableParallelCampaignJson,
      });
    }
  }

  async function init() {
    try {
      const response = await window.fetch(dataSource, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load parallel campaign data (${response.status})`);
      const data = await response.json();
      renderPage(data || {});
    } catch (error) {
      const main = el("main", "container");
      main.appendChild(el("h1", "page-title", "Arkham Horror LCG"));
      const card = el("div", "record-card");
      card.appendChild(el("p", "", error && error.message ? error.message : "Unable to render parallel campaign page."));
      main.appendChild(card);
      root.replaceChildren(main);
    }
  }

  void init();
})();
