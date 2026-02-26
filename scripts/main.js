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

// 2.2 Shared hover-preview reset helper.
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

// 2.3 Generic hover image preview for elements with data-hover-preview-src.
const setupHoverImagePreview = () => {
  const targets = Array.from(document.querySelectorAll("[data-hover-preview-src]"));
  if (!targets.length) return;

  const margin = 10;
  const gap = 18;

  const createPreview = (target) => {
    const src = target.getAttribute("data-hover-preview-src");
    if (!src) return null;
    const alt = target.getAttribute("data-hover-preview-alt") || "Preview";

    const wrap = document.createElement("div");
    wrap.className = "hover-preview-pop";
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    return { wrap, img };
  };

  const placePreview = (target, preview) => {
    if (!target || !preview) return;
    const { wrap } = preview;
    const anchor = target.getBoundingClientRect();
    const box = wrap.getBoundingClientRect();
    const popupWidth = box.width || 0;
    const popupHeight = box.height || 0;
    if (!popupWidth || !popupHeight) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportWidth || !viewportHeight) return;

    let left = anchor.right + gap;
    if (left + popupWidth > viewportWidth - margin) {
      left = anchor.left - popupWidth - gap;
    }
    const minLeft = margin;
    const maxLeft = Math.max(minLeft, viewportWidth - popupWidth - margin);
    left = Math.min(Math.max(left, minLeft), maxLeft);

    const centerY = anchor.top + (anchor.height / 2);
    let top = centerY - (popupHeight / 2);
    const minTop = margin;
    const maxTop = Math.max(minTop, viewportHeight - popupHeight - margin);
    top = Math.min(Math.max(top, minTop), maxTop);

    wrap.style.left = `${Math.round(left)}px`;
    wrap.style.top = `${Math.round(top)}px`;
  };

  targets.forEach((target) => {
    if (target.dataset.hoverPreviewBound === "1") return;
    target.dataset.hoverPreviewBound = "1";

    const preview = createPreview(target);
    if (!preview) return;
    const { wrap, img } = preview;
    let open = false;

    const show = () => {
      open = true;
      wrap.classList.add("is-open");
      wrap.style.left = "-9999px";
      wrap.style.top = "-9999px";
      window.requestAnimationFrame(() => {
        placePreview(target, preview);
      });
    };

    const hide = () => {
      open = false;
      wrap.classList.remove("is-open");
    };

    const refresh = () => {
      if (!open) return;
      placePreview(target, preview);
    };

    target.addEventListener("mouseenter", show);
    target.addEventListener("mouseleave", hide);
    target.addEventListener("focusin", show);
    target.addEventListener("focusout", hide);
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });
    img.addEventListener("load", refresh);
  });
};

setupHoverImagePreview();

// 2.4 Clamp card previews (.card-ref .card-preview) to viewport.
const setupCardRefPreviewClamp = () => {
  const isInvestigatorDeckPage = /arkham_horror_lcg_tcu_(harvey_walters|michael_mcglen|wendy_adams)_20260214\.html$/i
    .test(String(window.location.pathname || ""));
  if (!isInvestigatorDeckPage) return;
  if (document.body) {
    document.body.classList.add("card-preview-js-mode");
  }

  const refs = Array.from(document.querySelectorAll(".card-ref"));
  if (!refs.length) return;

  const margin = 8;
  const gap = 12;
  const fallbackWidth = 420;
  const fallbackHeight = 600;
  let activeRef = null;

  const clamp = (value, min, max) => {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  };

  const getTextAnchorRect = (cardRef) => {
    if (!cardRef) return null;
    const walker = document.createTreeWalker(cardRef, NodeFilter.SHOW_TEXT);
    const rects = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = String(node.nodeValue || "");
      if (!value.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const parts = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      rects.push(...parts);
    }
    if (!rects.length) return cardRef.getBoundingClientRect();
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  };

  const floating = document.createElement("img");
  floating.className = "card-preview card-preview-floating";
  floating.alt = "";
  floating.setAttribute("aria-hidden", "true");
  document.body.appendChild(floating);

  const getPreviewSize = () => {
    const rect = floating.getBoundingClientRect();
    const width = rect.width || floating.offsetWidth || fallbackWidth;
    const ratio = (floating.naturalWidth > 0 && floating.naturalHeight > 0)
      ? (floating.naturalHeight / floating.naturalWidth)
      : (fallbackHeight / fallbackWidth);
    const height = rect.height || floating.offsetHeight || Math.round(width * ratio);
    return { width, height };
  };

  const placeFloatingPreview = () => {
    if (!activeRef) return;
    const anchor = getTextAnchorRect(activeRef);
    if (!anchor) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportWidth || !viewportHeight) return;

    const size = getPreviewSize();
    const width = size.width;
    const height = size.height;

    const rightLeft = anchor.right + gap;
    const leftLeft = anchor.left - gap - width;
    const canPlaceRight = rightLeft + width <= viewportWidth - margin;
    const idealLeft = canPlaceRight ? rightLeft : leftLeft;
    const left = clamp(idealLeft, margin, viewportWidth - width - margin);

    const centerY = anchor.top + (anchor.height / 2);
    const idealTop = centerY - (height / 2);
    const top = clamp(idealTop, margin, viewportHeight - height - margin);

    floating.style.left = `${Math.round(left)}px`;
    floating.style.top = `${Math.round(top)}px`;
  };

  const showFloatingPreview = (cardRef) => {
    const source = cardRef ? cardRef.querySelector("img.card-preview") : null;
    const src = source ? source.getAttribute("src") : "";
    if (!src) return;
    activeRef = cardRef;
    floating.src = src;
    floating.alt = source ? (source.getAttribute("alt") || "") : "";
    floating.classList.add("is-active");
    placeFloatingPreview();
  };

  const hideFloatingPreview = (cardRef) => {
    if (cardRef && activeRef && cardRef !== activeRef) return;
    activeRef = null;
    floating.classList.remove("is-active");
    floating.removeAttribute("src");
    floating.removeAttribute("alt");
  };

  refs.forEach((cardRef) => {
    if (cardRef.dataset.cardPreviewClampBound === "1") return;
    cardRef.dataset.cardPreviewClampBound = "1";

    cardRef.addEventListener("mouseenter", () => showFloatingPreview(cardRef));
    cardRef.addEventListener("mousemove", () => {
      if (activeRef === cardRef) placeFloatingPreview();
    });
    cardRef.addEventListener("focusin", () => showFloatingPreview(cardRef));
    cardRef.addEventListener("mouseleave", () => hideFloatingPreview(cardRef));
    cardRef.addEventListener("focusout", () => hideFloatingPreview(cardRef));
  });

  window.addEventListener("scroll", () => {
    if (!activeRef) return;
    const stillActive = activeRef.matches(":hover") || activeRef.contains(document.activeElement);
    if (!stillActive) {
      hideFloatingPreview();
      return;
    }
    placeFloatingPreview();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!activeRef) return;
    placeFloatingPreview();
  }, { passive: true });

  floating.addEventListener("load", () => {
    if (!activeRef) return;
    placeFloatingPreview();
  });
};

setupCardRefPreviewClamp();

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
  resetHoverPreviewStyles,
  addGameToLibrary: () => {},       // future expansion
  loadNewsFeed: () => {},           // API hooks for board game news
  loadCrowdfundingUpdates: () => {}, // Kickstarter/Gamefound integration
  addWeeklyEvent: () => {},         // dynamic event logging
};
