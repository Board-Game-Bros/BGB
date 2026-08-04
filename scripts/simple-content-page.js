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

  function renderNews(items) {
    const list = el("div", "news-list");
    if (!items.length) {
      list.appendChild(el("div", "card game-card category-placeholder", "No news yet"));
      return list;
    }
    items.forEach((item) => {
      const article = el("article", "news-card");
      if (item.imageSrc) {
        const imageUrl = String(item.imageSrc).replace(/"/g, "%22");
        article.classList.add("has-news-image");
        article.style.setProperty("--news-bg", `url("${imageUrl}")`);
      }
      const badge = el("div", "news-badge");
      badge.appendChild(el("span", "news-badge-label", String(item.statLabel || "Update")));
      badge.appendChild(el("strong", "news-badge-value", String(item.statValue || "")));

      const body = el("div", "news-card-body");
      const meta = el("div", "news-meta");
      if (item.kicker) meta.appendChild(el("span", "news-kicker", String(item.kicker)));
      if (item.date) meta.appendChild(el("time", "news-date", String(item.date)));
      body.appendChild(meta);

      if (item.title) body.appendChild(el("h3", "news-title", String(item.title)));
      if (item.text) body.appendChild(el("p", "news-lede", String(item.text)));
      if (item.detail) body.appendChild(el("p", "news-detail", String(item.detail)));

      if (Array.isArray(item.tags) && item.tags.length) {
        const tags = el("div", "news-tags");
        item.tags.forEach((tag) => {
          if (tag && typeof tag === "object" && tag.href) {
            const link = el("a", "news-tag", String(tag.label || tag.href));
            link.href = String(tag.href);
            if (tag.external) {
              link.target = "_blank";
              link.rel = "noopener noreferrer";
            }
            tags.appendChild(link);
          } else {
            tags.appendChild(el("span", "news-tag", String(tag)));
          }
        });
        body.appendChild(tags);
      }

      if (item.href) {
        const link = el("a", "more-info-btn news-link", String(item.linkLabel || "Open"));
        link.href = String(item.href);
        if (item.external) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        body.appendChild(link);
      }

      article.append(badge, body);
      list.appendChild(article);
    });
    return list;
  }

  function renderPage(data) {
    document.title = String(data.title || document.title || "");
    root.innerHTML = "";

    const container = el("div", "container");
    container.appendChild(el("h2", "section-title", String(data.heading || "")));

    const items = Array.isArray(data.items) ? data.items : [];
    if (data.layout === "photo-grid") {
      container.appendChild(renderPhotoGrid(items));
    } else if (data.layout === "news") {
      container.appendChild(renderNews(items));
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
