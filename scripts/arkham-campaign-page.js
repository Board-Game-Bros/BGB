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

    const sessions = el("div", "campaign-session-links");
    (Array.isArray(group.sessions) ? group.sessions : []).forEach((session) => {
      const link = el("a", "campaign-meta-link pill-btn", String(session.label || ""));
      link.href = String(session.href || "#");
      sessions.appendChild(link);
    });
    subtitleWrap.appendChild(sessions);
    groupEl.appendChild(subtitleWrap);

    const grid = el("div", "grid");
    (Array.isArray(group.investigators) ? group.investigators : []).forEach((item) => {
      grid.appendChild(renderInvestigatorCard(item || {}));
    });
    groupEl.appendChild(grid);
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
