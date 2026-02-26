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

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!viewportWidth || !viewportHeight) return;

  previewEl.style.position = "fixed";
  previewEl.style.left = `${margin}px`;
  previewEl.style.top = `${margin}px`;
  previewEl.style.right = "auto";
  previewEl.style.bottom = "auto";
  previewEl.style.transform = "none";
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
    placeAbove = (availableAbove >= previewHeight) || (availableAbove >= availableBelow);
  } else {
    placeAbove = !((availableBelow >= previewHeight) || (availableBelow >= availableAbove));
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
};

// 2.3 Keep campaign hover previews fully inside viewport.
const setupCampaignPreviewPositioning = () => {
  const wrappers = Array.from(document.querySelectorAll(".campaign-subtitle-wrapper"));
  if (!wrappers.length) return;

  const positionPreview = (wrapper) => {
    const preview = wrapper.querySelector(".campaign-preview-container");
    if (!preview) return;
    preview.style.setProperty(
      "--campaign-preview-max-width",
      `${Math.round(Math.max(220, Math.min(450, (window.innerWidth || 0) - 20)))}px`
    );
    positionHoverPreview(wrapper, preview, {
      margin: 10,
      gap: 10,
      preferAbove: true,
      align: "start",
      maxWidth: 450
    });
  };

  wrappers.forEach((wrapper) => {
    const preview = wrapper.querySelector(".campaign-preview-container");
    const title = wrapper.querySelector(".campaign-subtitle");
    if (!preview) return;
    if (!title) return;

    const refresh = () => {
      if (!wrapper.classList.contains("is-preview-open")) return;
      positionPreview(wrapper);
    };

    const openPreview = () => {
      wrapper.classList.add("is-preview-open");
      positionPreview(wrapper);
    };

    const closePreview = () => {
      wrapper.classList.remove("is-preview-open");
      resetHoverPreviewStyles(preview);
      preview.style.removeProperty("--campaign-preview-max-width");
    };

    // Only the campaign title opens the preview; other controls in the header do not.
    title.addEventListener("mouseenter", openPreview);
    title.addEventListener("focusin", openPreview);
    wrapper.addEventListener("mouseleave", closePreview);
    wrapper.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && wrapper.contains(next)) return;
      closePreview();
    });

    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });
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
