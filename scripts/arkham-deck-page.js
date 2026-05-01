// Data-driven Arkham investigator deck page renderer.
(() => {
  const root = document.getElementById("arkham-deck-page-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "").trim();
  if (!dataSource) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function createCardRow(card) {
    const item = document.createElement("li");
    item.appendChild(document.createTextNode(`${Number(card.qty || 0)}x `));

    const ref = el("span", "card-ref", String(card.name || ""));
    if (card.suffixIconSrc) {
      const icon = document.createElement("img");
      icon.className = "card-name-token";
      icon.src = String(card.suffixIconSrc || "");
      icon.alt = String(card.suffixIconAlt || "");
      ref.appendChild(document.createTextNode(" "));
      ref.appendChild(icon);
    }
    const img = document.createElement("img");
    img.className = "card-preview";
    img.src = String(card.imageSrc || "");
    img.alt = String(card.imageAlt || card.name || "");
    ref.appendChild(img);
    item.appendChild(ref);
    return item;
  }

  function renderSection(columnEl, section) {
    if (section.title) {
      columnEl.appendChild(el("h4", "", String(section.title)));
    }
    if (section.label) {
      columnEl.appendChild(el("p", "upgrade-entry-head", String(section.label)));
    }
    const list = el("ul", "card-list");
    (Array.isArray(section.cards) ? section.cards : []).forEach((card) => {
      list.appendChild(createCardRow(card || {}));
    });
    columnEl.appendChild(list);
  }

  function renderDeckPage(data) {
    document.title = String(data.title || document.title || "");
    root.innerHTML = "";

    const main = el("main", "container");
    main.appendChild(el("h1", "page-title", String(data.pageTitle || "")));

    const subnav = el("div", "subnav");
    [
      ["#deck-overview", "Deck Overview"],
      ["#deck-list", "Deck List"],
      ["#deck-file", "PDF"],
    ].forEach(([href, label]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      subnav.appendChild(link);
    });
    main.appendChild(subnav);

    const overviewSection = el("section", "record-section");
    overviewSection.id = "deck-overview";
    overviewSection.appendChild(el("h2", "section-title", "Deck Overview"));
    const overviewCard = el("div", "record-card");
    const overviewGrid = el("div", "upgrade-columns deck-overview-grid");

    const imageCol = el("div", "upgrade-col");
    const investigatorCard = el("div", "card game-card investigator-card");
    const wrapper = el("div", "card-wrapper");
    const image = document.createElement("img");
    image.src = String(data.overview?.imageSrc || "");
    image.alt = String(data.overview?.imageAlt || "");
    image.className = "game-cover";
    wrapper.appendChild(image);
    investigatorCard.appendChild(wrapper);
    imageCol.appendChild(investigatorCard);

    const detailCol = el("div", "upgrade-col");
    const storyNote = el("div", "story-note");
    storyNote.appendChild(el("h4", "", String(data.overview?.heading || "")));
    (Array.isArray(data.overview?.details) ? data.overview.details : []).forEach((line) => {
      storyNote.appendChild(el("p", "", String(line)));
    });
    detailCol.appendChild(storyNote);

    overviewGrid.append(imageCol, detailCol);
    overviewCard.appendChild(overviewGrid);
    overviewSection.appendChild(overviewCard);
    main.appendChild(overviewSection);

    const deckSection = el("section", "record-section");
    deckSection.id = "deck-list";
    deckSection.appendChild(el("h2", "section-title", "Deck"));
    const deckCard = el("div", "record-card");
    const deckGrid = el("div", "upgrade-columns deck-list-grid");
    deckGrid.setAttribute("data-deck-preview", "card-panel");

    (Array.isArray(data.deckColumns) ? data.deckColumns : []).forEach((column) => {
      const col = el("div", "upgrade-col");
      (Array.isArray(column.sections) ? column.sections : []).forEach((section) => {
        renderSection(col, section || {});
      });
      deckGrid.appendChild(col);
    });

    const previewPanel = el("aside", "deck-preview-panel");
    previewPanel.setAttribute("data-deck-preview-panel", "");
    const previewImage = document.createElement("img");
    previewImage.setAttribute("data-deck-preview-image", "");
    previewImage.setAttribute("data-default-src", "/assets/boardgames/arkham_horror_lcg_backcover.png");
    previewImage.src = "/assets/boardgames/arkham_horror_lcg_backcover.png";
    previewImage.alt = "Card preview panel";
    previewPanel.appendChild(previewImage);
    deckGrid.appendChild(previewPanel);

    deckCard.appendChild(deckGrid);
    deckSection.appendChild(deckCard);
    main.appendChild(deckSection);

    const pdfSection = el("section", "record-section");
    pdfSection.id = "deck-file";
    pdfSection.appendChild(el("h2", "section-title", "Deck PDF"));
    const pdfCard = el("div", "record-card");
    const pdfLink = el("a", "pill-btn", String(data.pdf?.label || "Open Deck PDF"));
    pdfLink.href = String(data.pdf?.href || "#");
    pdfLink.target = "_blank";
    pdfLink.rel = "noopener";
    pdfCard.appendChild(pdfLink);
    pdfSection.appendChild(pdfCard);
    main.appendChild(pdfSection);

    const backWrap = el("div", "back-link-wrap");
    const backLink = el("a", "back-link", "Back to Arkham Horror LCG");
    backLink.href = "/arkham_horror_lcg/";
    backWrap.appendChild(backLink);
    main.appendChild(backWrap);

    root.appendChild(main);

    if (window.BGB && typeof window.BGB.setupSmoothScrollLinks === "function") {
      window.BGB.setupSmoothScrollLinks();
    }
    if (window.BGB && typeof window.BGB.setupSubnavActiveState === "function") {
      window.BGB.setupSubnavActiveState();
    }
    if (window.BGB && typeof window.BGB.initArkhamDeckPreview === "function") {
      window.BGB.initArkhamDeckPreview();
    }
  }

  async function init() {
    try {
      const response = await window.fetch(dataSource, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load deck data (${response.status})`);
      const data = await response.json();
      renderDeckPage(data || {});
    } catch (error) {
      const main = el("main", "container");
      main.appendChild(el("h1", "page-title", "Deck Page Unavailable"));
      const card = el("div", "record-card");
      card.appendChild(el("p", "", error && error.message ? error.message : "Unable to render deck page."));
      main.appendChild(card);
      root.replaceChildren(main);
    }
  }

  void init();
})();
