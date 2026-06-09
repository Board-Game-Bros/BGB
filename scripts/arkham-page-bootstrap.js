// Shared bootstrap for lightweight Arkham data-driven pages.
(() => {
  const pageType = String(document.body?.dataset?.arkhamPage || "").trim();
  const dataSource = String(document.body?.dataset?.source || "").trim();
  const initialTitle = String(document.body?.dataset?.title || "Arkham Horror LCG").trim();

  const pageConfigs = {
    "campaign-index": {
      rootId: "arkham-campaign-root",
      scripts: [
        "/scripts/arkham-campaign-page.js?v=20260401a",
      ],
    },
    "deck": {
      rootId: "arkham-deck-page-root",
      scripts: [
        "/scripts/arkham-deck-page.js?v=20260401a",
        "/scripts/arkham-deck-preview.js?v=20260401a",
      ],
    },
    "parallel-campaign": {
      rootId: "arkham-parallel-campaign-root",
      scripts: [
        "/scripts/ahlcg-standard-library.js?v=20260609a",
        "/scripts/ahlcg-customizable-library.js",
        "/scripts/ahlcg-customizable-state.js?v=20260512a",
        "/scripts/shared-github-sync.js?v=20260401a",
        "/scripts/shared-edit-sync-gate.js?v=20260228a",
        "/scripts/shared-local-state-envelope.js?v=20260306a",
        "/scripts/ahlcg-upgrade-manager.js?v=20260609e",
        "/scripts/arkham-parallel-campaign-page.js?v=20260609a",
      ],
    },
  };

  const config = pageConfigs[pageType];
  if (!config || !dataSource) return;

  window.BGB_SHELL = { title: "Board Game Bros", activeNav: "library" };
  document.title = initialTitle;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/styles/pages/arkham_horror_lcg.css?v=20260609a";
  document.head.appendChild(stylesheet);

  const root = document.createElement("div");
  root.id = config.rootId;
  root.setAttribute("data-source", dataSource);
  document.body.appendChild(root);

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });

  (async () => {
    try {
      await loadScript("/scripts/shell-layout.js");
      await loadScript("/scripts/main.js?v=20260609d");
      for (const src of config.scripts) {
        await loadScript(src);
      }
    } catch (error) {
      console.error(error);
    }
  })();
})();
