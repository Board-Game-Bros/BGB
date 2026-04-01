// Minimal data-driven renderer for simple content pages.
(() => {
  const root = document.getElementById("simple-content-page-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "").trim();
  if (!dataSource) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function renderPhotoGrid(items) {
    const grid = el("div", "photo-grid");
    items.forEach((item) => {
      const img = document.createElement("img");
      img.src = String(item.imageSrc || "");
      img.alt = String(item.imageAlt || "");
      grid.appendChild(img);
    });
    return grid;
  }

  function renderCards(items) {
    const grid = el("div", "grid");
    if (!items.length) {
      grid.appendChild(el("div", "card game-card category-placeholder", "No items yet"));
      return grid;
    }
    items.forEach((item) => {
      const card = el("div", "card game-card");
      if (item.title) {
        card.appendChild(el("h3", "", String(item.title)));
      }
      if (item.text) {
        card.appendChild(el("p", "", String(item.text)));
      }
      if (item.href) {
        const link = el("a", "more-info-btn", String(item.linkLabel || "Open"));
        link.href = String(item.href);
        if (item.external) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        card.appendChild(link);
      }
      grid.appendChild(card);
    });
    return grid;
  }

  function renderPage(data) {
    document.title = String(data.title || document.title || "");
    root.innerHTML = "";

    const container = el("div", "container");
    container.appendChild(el("h2", "section-title", String(data.heading || "")));

    const items = Array.isArray(data.items) ? data.items : [];
    if (data.layout === "photo-grid") {
      container.appendChild(renderPhotoGrid(items));
    } else {
      container.appendChild(renderCards(items));
    }

    root.appendChild(container);
  }

  async function init() {
    try {
      const response = await window.fetch(dataSource, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load page data (${response.status})`);
      const data = await response.json();
      renderPage(data || {});
    } catch (error) {
      const container = el("div", "container");
      container.appendChild(el("h2", "section-title", "Page Unavailable"));
      container.appendChild(el("div", "card game-card category-placeholder", error && error.message ? error.message : "Unable to render page."));
      root.replaceChildren(container);
    }
  }

  void init();
})();
