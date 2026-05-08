// Data-driven Arkham campaign index page renderer.
(() => {
  const root = document.getElementById("arkham-campaign-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "").trim();
  if (!dataSource) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function renderInvestigatorCard(item) {
    const card = el("div", "card game-card investigator-card");
    const link = el("a", "cover-link");
    link.href = String(item.href || "#");

    const wrapper = el("div", "card-wrapper");
    const image = document.createElement("img");
    image.src = String(item.imageSrc || "");
    image.alt = String(item.imageAlt || "");
    image.className = "game-cover";
    wrapper.appendChild(image);

    const overlay = el("div", "card-overlay");
    const content = el("div", "overlay-content");
    content.appendChild(el("span", "builder-name", String(item.builderName || "")));
    content.appendChild(el("span", "build-date", String(item.buildDate || "")));
    overlay.appendChild(content);
    wrapper.appendChild(overlay);

    link.appendChild(wrapper);
    card.appendChild(link);
    return card;
  }

  function renderInvestigatorGrid(items) {
    const grid = el("div", "grid");
    (Array.isArray(items) ? items : []).forEach((item) => {
      grid.appendChild(renderInvestigatorCard(item || {}));
    });
    return grid;
  }

  function renderSessionTrack(track) {
    const trackEl = el("div", "campaign-track");
    const head = el("div", "campaign-track-head");
    head.appendChild(el("h4", "campaign-track-title", String(track.title || "")));
    if (track.subtitle) {
      head.appendChild(el("p", "campaign-track-subtitle", String(track.subtitle || "")));
    }
    trackEl.appendChild(head);

    const investigators = Array.isArray(track.investigators) ? track.investigators : [];
    if (!investigators.length) {
      trackEl.appendChild(el("p", "campaign-run-empty", "Investigators to be added."));
      return trackEl;
    }

    trackEl.appendChild(renderInvestigatorGrid(investigators));
    return trackEl;
  }

  function renderSession(session) {
    const sessionEl = el("section", "campaign-run");

    const sessionHead = el("div", "campaign-run-head");
    const link = el("a", "campaign-meta-link pill-btn", String(session.label || ""));
    link.href = String(session.href || "#");
    sessionHead.appendChild(link);
    sessionEl.appendChild(sessionHead);

    const tracks = Array.isArray(session.tracks) ? session.tracks : [];
    if (tracks.length) {
      const trackGrid = el("div", "campaign-track-grid");
      tracks.forEach((track) => {
        trackGrid.appendChild(renderSessionTrack(track || {}));
      });
      sessionEl.appendChild(trackGrid);
      return sessionEl;
    }

    const investigators = Array.isArray(session.investigators) ? session.investigators : [];
    if (!investigators.length) {
      sessionEl.appendChild(el("p", "campaign-run-empty", "Investigators to be added."));
      return sessionEl;
    }

    sessionEl.appendChild(renderInvestigatorGrid(investigators));
    return sessionEl;
  }

  function renderCampaign(group) {
    const groupEl = el("div", "campaign-group");
    const subtitleWrap = el("div", "campaign-subtitle-wrapper");
    const subtitle = el("h3", "campaign-subtitle");
    const titleLink = el("a", "campaign-subtitle-link", String(group.title || ""));
    titleLink.href = String(group.href || "#");
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    if (group.hoverPreviewSrc) {
      titleLink.setAttribute("data-hover-preview-src", String(group.hoverPreviewSrc));
    }
    if (group.hoverPreviewAlt) {
      titleLink.setAttribute("data-hover-preview-alt", String(group.hoverPreviewAlt));
    }
    subtitle.appendChild(titleLink);
    subtitleWrap.appendChild(subtitle);

    groupEl.appendChild(subtitleWrap);

    const sessionsWrap = el("div", "campaign-sessions");
    const sessions = Array.isArray(group.sessions) ? group.sessions : [];

    if (sessions.length) {
      sessions.forEach((session) => {
        sessionsWrap.appendChild(renderSession(session || {}));
      });
    } else {
      const fallbackSession = {
        href: group.href || "#",
        label: String(group.title || "Campaign"),
        investigators: Array.isArray(group.investigators) ? group.investigators : [],
      };
      sessionsWrap.appendChild(renderSession(fallbackSession));
    }

    groupEl.appendChild(sessionsWrap);
    return groupEl;
  }

  function renderPage(data) {
    document.title = "Arkham Horror LCG";
    root.innerHTML = "";

    const main = el("main", "container");
    main.appendChild(el("h1", "page-title", String(data.pageTitle || "Arkham Horror: The Card Game")));

    const section = document.createElement("section");
    section.id = "campaigns";
    section.appendChild(el("h2", "section-title", "Campaigns"));
    (Array.isArray(data.campaigns) ? data.campaigns : []).forEach((group) => {
      section.appendChild(renderCampaign(group || {}));
    });
    main.appendChild(section);

    const backWrap = el("div", "back-link-wrap");
    const backLink = el("a", "back-link", "Back to Library");
    backLink.href = "/library/";
    backWrap.appendChild(backLink);
    main.appendChild(backWrap);

    root.appendChild(main);

    if (window.BGB && typeof window.BGB.setupHoverImagePreview === "function") {
      window.BGB.setupHoverImagePreview();
    }
  }

  async function init() {
    try {
      const response = await window.fetch(dataSource, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load campaign data (${response.status})`);
      const data = await response.json();
      renderPage(data || {});
    } catch (error) {
      const main = el("main", "container");
      main.appendChild(el("h1", "page-title", "Arkham Horror LCG"));
      const card = el("div", "record-card");
      card.appendChild(el("p", "", error && error.message ? error.message : "Unable to render campaign page."));
      main.appendChild(card);
      root.replaceChildren(main);
    }
  }

  void init();
})();
