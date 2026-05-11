// Data-driven library page renderer.
(() => {
  const root = document.getElementById("library-page-root");
  if (!root) return;

  const dataSource = String(root.getAttribute("data-source") || "").trim();
  if (!dataSource) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function applyTitleBrushMetrics(scope) {
    const rootNode = scope || document;
    rootNode.querySelectorAll(".game-card-title-brush").forEach((title) => {
      const styles = window.getComputedStyle(title);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        title.style.setProperty("--title-line-count", "1");
        return;
      }
      const lines = Math.max(1, Math.round(title.getBoundingClientRect().height / lineHeight));
      title.style.setProperty("--title-line-count", String(lines));
    });
  }

  function renderGameCard(item) {
    if (item.placeholder) {
      return el("div", "card game-card category-placeholder", String(item.text || ""));
    }

    const card = el("div", "card game-card");
    const link = el("a", "cover-link");
    link.href = String(item.href || "#");

    const image = document.createElement("img");
    image.src = String(item.imageSrc || "");
    image.alt = String(item.imageAlt || item.title || "");
    image.className = "game-cover wide-cover";
    link.appendChild(image);
    const title = el("h3", "");
    const titleText = el("span", "game-card-title-brush", String(item.title || ""));
    title.appendChild(titleText);
    link.appendChild(title);
    card.appendChild(link);

    const info = el("a", "more-info-btn", "More Info");
    info.href = String(item.moreInfoHref || "#");
    info.target = "_blank";
    info.rel = "noopener noreferrer";
    card.appendChild(info);
    return card;
  }

  function renderPage(data) {
    document.title = "BGB - Library";
    root.innerHTML = "";

    const container = el("div", "container");
    container.appendChild(el("h2", "section-title collection-banner", String(data.pageTitle || "Game Collection")));

    (Array.isArray(data.categories) ? data.categories : []).forEach((category) => {
      const section = el("section", "collection-category");
      section.appendChild(el("h3", "category-title", String(category.title || "")));
      const grid = el("div", "grid category-grid");
      (Array.isArray(category.items) ? category.items : []).forEach((item) => {
        grid.appendChild(renderGameCard(item || {}));
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    root.appendChild(container);
    applyTitleBrushMetrics(container);
  }

  async function init() {
    try {
      const response = await window.fetch(dataSource, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load library data (${response.status})`);
      const data = await response.json();
      renderPage(data || {});
    } catch (error) {
      const container = el("div", "container");
      container.appendChild(el("h2", "section-title collection-banner", "Game Collection"));
      const card = el("div", "card game-card category-placeholder", error && error.message ? error.message : "Unable to render library page.");
      container.appendChild(card);
      root.replaceChildren(container);
    }
  }

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (resizeRaf) window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(() => {
      applyTitleBrushMetrics(root);
      resizeRaf = 0;
    });
  });

  void init();
})();
