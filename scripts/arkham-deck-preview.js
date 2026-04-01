// Arkham investigator deck preview panel interactions.
(() => {
  function initArkhamDeckPreview() {
  const grids = Array.from(document.querySelectorAll(".deck-list-grid[data-deck-preview]"));
  if (!grids.length) {
    document.body.classList.remove("deck-panel-mode");
    return;
  }

  document.body.classList.add("deck-panel-mode");

  const getPreviewSource = (ref) => {
    const img = ref ? ref.querySelector("img.card-preview") : null;
    return img ? (img.getAttribute("src") || "") : "";
  };

  grids.forEach((grid) => {
    if (grid.dataset.deckPanelBound === "1") return;
    grid.dataset.deckPanelBound = "1";

    const panelImg = grid.querySelector("[data-deck-preview-image]");
    if (!panelImg) return;
    const defaultSrc = panelImg.getAttribute("data-default-src") || panelImg.getAttribute("src") || "";

    const setPanelSrc = (src) => {
      panelImg.setAttribute("src", src || defaultSrc);
    };

    setPanelSrc(defaultSrc);

    const activateFromTarget = (target) => {
      const ref = target && typeof target.closest === "function" ? target.closest(".card-ref") : null;
      if (!ref || !grid.contains(ref)) {
        setPanelSrc(defaultSrc);
        return;
      }
      setPanelSrc(getPreviewSource(ref) || defaultSrc);
    };

    grid.addEventListener("pointerover", (event) => {
      activateFromTarget(event.target);
    });
    grid.addEventListener("focusin", (event) => {
      activateFromTarget(event.target);
    });
    grid.addEventListener("pointerleave", () => {
      setPanelSrc(defaultSrc);
    });
    grid.addEventListener("focusout", () => {
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        const activeRef = active && typeof active.closest === "function" ? active.closest(".card-ref") : null;
        if (!activeRef || !grid.contains(activeRef)) {
          setPanelSrc(defaultSrc);
        }
      });
    });
  });
  }

  window.BGB = {
    ...(window.BGB || {}),
    initArkhamDeckPreview,
  };

  initArkhamDeckPreview();
})();
