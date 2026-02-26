// ===================== MAIN.JS =====================
// Medieval-themed interactions and future expansion hooks

// 1. Sticky Navigation on Scroll
window.addEventListener("scroll", () => {
  const nav = document.querySelector("nav");
  if (window.scrollY > 80) nav.classList.add("sticky");
  else nav.classList.remove("sticky");
});

// 2. Smooth Scrolling for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth"
    });
  });
});

// 2.1 Highlight active subnav pill on click/scroll
const setupSubnavActiveState = () => {
  const subnavLinks = Array.from(document.querySelectorAll(".subnav a"));
  if (!subnavLinks.length || typeof IntersectionObserver === "undefined") return;

  const subnavSections = subnavLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!subnavSections.length) return;

  const markActive = (targetId) => {
    subnavLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${targetId}`;
      link.classList.toggle("is-active", isActive);
    });
  };

  subnavLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetId = link.getAttribute("href").slice(1);
      markActive(targetId);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible && visible.target && visible.target.id) {
        markActive(visible.target.id);
      }
    },
    { threshold: [0.35, 0.6, 0.85] }
  );

  subnavSections.forEach((section) => observer.observe(section));
  markActive(subnavSections[0].id);
};

setupSubnavActiveState();

// 2.2 Shared hover-preview positioning helpers.
const positionHoverPreview = (anchorEl, previewEl, options = {}) => {
  if (!anchorEl || !previewEl) return;

  const margin = Number.isFinite(options.margin) ? options.margin : 10;
  const gap = Number.isFinite(options.gap) ? options.gap : 10;
  const preferAbove = options.preferAbove !== false;
  const align = options.align || "start"; // "start" | "center" | "end"
  const maxWidth = Number(options.maxWidth) || 0;
  const maxHeight = Number(options.maxHeight) || 0;
  const zIndex = Number(options.zIndex) || 0;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!viewportWidth || !viewportHeight) return;

  previewEl.style.position = "fixed";
  previewEl.style.left = `${margin}px`;
  previewEl.style.top = `${margin}px`;
  previewEl.style.right = "auto";
  previewEl.style.bottom = "auto";
  previewEl.style.transform = "none";
  if (zIndex > 0) previewEl.style.zIndex = String(Math.round(zIndex));
  if (maxWidth > 0) previewEl.style.maxWidth = `${Math.round(Math.min(maxWidth, viewportWidth - margin * 2))}px`;
  if (maxHeight > 0) previewEl.style.maxHeight = `${Math.round(Math.min(maxHeight, viewportHeight - margin * 2))}px`;

  const anchorRect = anchorEl.getBoundingClientRect();
  const previewRect = previewEl.getBoundingClientRect();
  const previewWidth = previewRect.width || 0;
  const previewHeight = previewRect.height || 0;
  if (!previewWidth || !previewHeight) return;

  const availableAbove = anchorRect.top - margin - gap;
  const availableBelow = viewportHeight - anchorRect.bottom - margin - gap;

  let placeAbove;
  if (preferAbove) {
    if (availableAbove >= previewHeight) {
      placeAbove = true;
    } else if (availableBelow >= previewHeight) {
      placeAbove = false;
    } else {
      placeAbove = availableAbove >= availableBelow;
    }
  } else {
    if (availableBelow >= previewHeight) {
      placeAbove = false;
    } else if (availableAbove >= previewHeight) {
      placeAbove = true;
    } else {
      placeAbove = availableAbove >= availableBelow;
    }
  }

  let top = placeAbove
    ? anchorRect.top - previewHeight - gap
    : anchorRect.bottom + gap;

  const minTop = margin;
  const maxTop = Math.max(margin, viewportHeight - previewHeight - margin);
  top = Math.min(Math.max(top, minTop), maxTop);

  let left;
  if (align === "center") {
    left = anchorRect.left + (anchorRect.width - previewWidth) / 2;
  } else if (align === "end") {
    left = anchorRect.right - previewWidth;
  } else {
    left = anchorRect.left;
  }

  const minLeft = margin;
  const maxLeft = Math.max(margin, viewportWidth - previewWidth - margin);
  left = Math.min(Math.max(left, minLeft), maxLeft);

  previewEl.style.left = `${Math.round(left)}px`;
  previewEl.style.top = `${Math.round(top)}px`;
};

const resetHoverPreviewStyles = (previewEl) => {
  if (!previewEl) return;
  previewEl.style.position = "";
  previewEl.style.left = "";
  previewEl.style.top = "";
  previewEl.style.right = "";
  previewEl.style.bottom = "";
  previewEl.style.transform = "";
  previewEl.style.maxWidth = "";
  previewEl.style.maxHeight = "";
  previewEl.style.zIndex = "";
};

// 2.3 Keep campaign hover previews fully inside viewport (clean rewrite).
const setupCampaignPreviewPositioning = () => {
  const wrappers = Array.from(document.querySelectorAll(".campaign-subtitle-wrapper"));
  if (!wrappers.length) return;

  wrappers.forEach((wrapper) => {
    if (wrapper.dataset.previewBound === "1") return;
    wrapper.dataset.previewBound = "1";

    const preview = wrapper.querySelector(".campaign-preview-container");
    const title = wrapper.querySelector(".campaign-subtitle");
    const previewImg = preview ? preview.querySelector(".campaign-preview-img") : null;
    if (!preview) return;
    if (!title) return;

    let overTitle = false;
    let overPreview = false;
    let repositionTimer = null;

    const positionPreview = () => {
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!vw || !vh) return;

      const margin = 10;
      const gap = 10;
      const maxW = Math.max(220, Math.min(450, vw - margin * 2));
      const globalMaxH = Math.max(220, vh - margin * 2);
      preview.style.setProperty("--campaign-preview-max-width", `${Math.round(maxW)}px`);
      preview.style.setProperty("--campaign-preview-max-height", `${Math.round(globalMaxH)}px`);

      // Measure in hidden state first, then place, then reveal.
      preview.style.visibility = "hidden";
      preview.style.opacity = "0";
      preview.style.pointerEvents = "none";
      preview.style.left = "-9999px";
      preview.style.top = "-9999px";

      const anchor = title.getBoundingClientRect();
      const box = preview.getBoundingClientRect();
      let naturalH = box.height || 0;
      let naturalW = box.width || 0;
      if (!naturalH || !naturalW) return;

      // Side-placement logic (same idea as deck-update autocomplete):
      // prefer right of title; if no room, place left; keep vertically centered and clamped.
      const rightLeft = anchor.right + gap;
      const hasRightSpace = rightLeft + naturalW <= vw - margin;
      const leftLeft = anchor.left - naturalW - gap;
      const hasLeftSpace = leftLeft >= margin;

      let left;
      if (hasRightSpace) {
        left = rightLeft;
      } else if (hasLeftSpace) {
        left = leftLeft;
      } else {
        // Neither side fits fully: pick side with more space then clamp.
        const rightSpace = vw - anchor.right - margin - gap;
        const leftSpace = anchor.left - margin - gap;
        left = rightSpace >= leftSpace ? rightLeft : leftLeft;
      }

      // Keep height within viewport and center around title.
      const sideMaxH = Math.min(globalMaxH, vh - margin * 2);
      preview.style.setProperty("--campaign-preview-max-height", `${Math.round(sideMaxH)}px`);
      preview.style.left = "-9999px";
      preview.style.top = "-9999px";
      const fitted = preview.getBoundingClientRect();
      const h = fitted.height || naturalH;
      const w = fitted.width || naturalW;
      const idealTop = anchor.top + (anchor.height / 2) - (h / 2);
      const minTop = margin;
      const maxTop = Math.max(margin, vh - h - margin);
      const top = Math.min(Math.max(idealTop, minTop), maxTop);

      const minLeft = margin;
      const maxLeft = Math.max(margin, vw - w - margin);
      left = Math.min(Math.max(left, minLeft), maxLeft);

      preview.style.left = `${Math.round(left)}px`;
      preview.style.top = `${Math.round(top)}px`;
      preview.style.visibility = "visible";
      preview.style.opacity = "1";
      preview.style.pointerEvents = "auto";
    };

    const scheduleReposition = () => {
      if (!wrapper.classList.contains("is-preview-open")) return;
      window.requestAnimationFrame(positionPreview);
      // Extra delayed passes: handles late image decode/layout.
      if (repositionTimer) window.clearTimeout(repositionTimer);
      repositionTimer = window.setTimeout(() => {
        if (!wrapper.classList.contains("is-preview-open")) return;
        positionPreview();
      }, 80);
    };

    const openPreview = () => {
      wrapper.classList.add("is-preview-open");
      window.requestAnimationFrame(() => {
        positionPreview();
        window.requestAnimationFrame(positionPreview);
      });
      window.setTimeout(() => {
        if (!wrapper.classList.contains("is-preview-open")) return;
        positionPreview();
      }, 160);
    };

    const closePreview = () => {
      wrapper.classList.remove("is-preview-open");
      if (repositionTimer) {
        window.clearTimeout(repositionTimer);
        repositionTimer = null;
      }
      resetHoverPreviewStyles(preview);
      preview.style.opacity = "0";
      preview.style.visibility = "hidden";
      preview.style.pointerEvents = "none";
      preview.style.removeProperty("--campaign-preview-max-width");
      preview.style.removeProperty("--campaign-preview-max-height");
    };

    const maybeClose = () => {
      if (overTitle || overPreview) return;
      closePreview();
    };

    title.addEventListener("mouseenter", () => {
      overTitle = true;
      openPreview();
    });
    title.addEventListener("mouseleave", () => {
      overTitle = false;
      window.requestAnimationFrame(maybeClose);
    });
    title.addEventListener("focusin", openPreview);
    title.addEventListener("focusout", maybeClose);

    preview.addEventListener("mouseenter", () => {
      overPreview = true;
      if (!wrapper.classList.contains("is-preview-open")) openPreview();
    });
    preview.addEventListener("mouseleave", () => {
      overPreview = false;
      window.requestAnimationFrame(maybeClose);
    });

    const refresh = () => {
      if (!wrapper.classList.contains("is-preview-open")) return;
      scheduleReposition();
    };
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });

    if (previewImg && previewImg.dataset.previewLoadBound !== "1") {
      previewImg.dataset.previewLoadBound = "1";
      previewImg.addEventListener("load", scheduleReposition);
      if (previewImg.complete) {
        window.requestAnimationFrame(scheduleReposition);
      }
      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => {
          if (!wrapper.classList.contains("is-preview-open")) return;
          scheduleReposition();
        });
        ro.observe(previewImg);
        ro.observe(preview);
      }
    }
  });
};

setupCampaignPreviewPositioning();

// 3. Page Fade-in Animation
window.onload = () => {
  document.body.classList.add("loaded");
};

// 4. Dark Mode Toggle (Medieval Torchlight Theme)
const enableTorchMode = () => {
  document.body.classList.add("torch-mode");
  localStorage.setItem("torchMode", "enabled");
};

const disableTorchMode = () => {
  document.body.classList.remove("torch-mode");
  localStorage.setItem("torchMode", "disabled");
};

// Restore saved mode
if (localStorage.getItem("torchMode") === "enabled") enableTorchMode();

// Optional toggle button handler (if added to HTML)
const torchBtn = document.getElementById("torch-toggle");
if (torchBtn) {
  torchBtn.addEventListener("click", () => {
    if (document.body.classList.contains("torch-mode")) disableTorchMode();
    else enableTorchMode();
  });
}

// 5. Light flicker effect for dark mode
setInterval(() => {
  if (document.body.classList.contains("torch-mode")) {
    document.body.style.filter = `brightness(${0.9 + Math.random() * 0.2})`;
  } else {
    document.body.style.filter = "brightness(1)";
  }
}, 200);

// 6. Placeholder expandable functions for future features
window.BGB = {
  ...(window.BGB || {}),
  positionHoverPreview,
  resetHoverPreviewStyles,
  addGameToLibrary: () => {},       // future expansion
  loadNewsFeed: () => {},           // API hooks for board game news
  loadCrowdfundingUpdates: () => {}, // Kickstarter/Gamefound integration
  addWeeklyEvent: () => {},         // dynamic event logging
};
