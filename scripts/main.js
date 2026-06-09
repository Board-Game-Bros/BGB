// ===================== MAIN.JS =====================
// Medieval-themed interactions and future expansion hooks

// 1. Smooth Scrolling for Anchor Links
const setupSmoothScrollLinks = () => {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    if (anchor.dataset.smoothScrollBound === "1") return;
    anchor.dataset.smoothScrollBound = "1";
    anchor.addEventListener("click", function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (!target) return;
      target.scrollIntoView({
        behavior: "smooth"
      });
    });
  });
};

setupSmoothScrollLinks();

// 1.1 Highlight active subnav pill on click/scroll
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
    if (link.dataset.subnavActiveBound === "1") return;
    link.dataset.subnavActiveBound = "1";
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

// 1.15 Inline chaos token replacement for static campaign pages.
const INLINE_CHAOS_TOKENS = [
  { pattern: "elder thing", src: "/assets/icon/elder_thing_token.png", alt: "elder thing" },
  { pattern: "cultist", src: "/assets/icon/cultist_token.png", alt: "cultist" },
  { pattern: "skull", src: "/assets/icon/skull_token.png", alt: "skull" },
  { pattern: "tablet", src: "/assets/icon/tablet_token.png", alt: "tablet" },
];

const inlineChaosTokenPattern = new RegExp(
  `(${INLINE_CHAOS_TOKENS.map((token) => token.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "gi"
);

const replaceInlineChaosTokensInNode = (textNode) => {
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
  const source = String(textNode.nodeValue || "");
  if (!source || !inlineChaosTokenPattern.test(source)) return;
  inlineChaosTokenPattern.lastIndex = 0;

  const frag = document.createDocumentFragment();
  source.split(inlineChaosTokenPattern).forEach((part) => {
    if (!part) return;
    const token = INLINE_CHAOS_TOKENS.find((entry) => new RegExp(`^${entry.pattern}$`, "i").test(part));
    if (token) {
      const img = document.createElement("img");
      img.className = "inline-chaos-token";
      img.src = token.src;
      img.alt = token.alt;
      frag.appendChild(img);
      return;
    }
    frag.appendChild(document.createTextNode(part));
  });

  if (textNode.parentNode) {
    textNode.parentNode.replaceChild(frag, textNode);
  }
};

const setupInlineChaosTokenText = (root = document) => {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  const containers = scope.querySelectorAll([
    ".story-note",
    ".campaign-log-list",
    ".record-meta",
    ".status-chip",
    ".meta-item",
  ].join(", "));

  containers.forEach((container) => {
    if (!container || container.dataset.inlineChaosTokensBound === "1") return;
    container.dataset.inlineChaosTokensBound = "1";
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".card-ref, .card-preview, button, script, style")) return NodeFilter.FILTER_REJECT;
        inlineChaosTokenPattern.lastIndex = 0;
        return inlineChaosTokenPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    textNodes.forEach((node) => replaceInlineChaosTokensInNode(node));
  });
};

window.BGBSetupInlineChaosTokenText = setupInlineChaosTokenText;
setupInlineChaosTokenText();

// 1.2 Shared hover-preview reset helper.
const resetHoverPreviewStyles = (previewEl) => {
  if (!previewEl) return;
  previewEl.style.position = "";
  previewEl.style.left = "";
  previewEl.style.top = "";
  previewEl.style.right = "";
  previewEl.style.bottom = "";
  previewEl.style.transform = "";
  previewEl.style.width = "";
  previewEl.style.height = "";
  previewEl.style.maxWidth = "";
  previewEl.style.maxHeight = "";
  previewEl.style.overflow = "";
  previewEl.style.zIndex = "";
};

const bindCardRefViewportPreviews = (root = document) => {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  const previewMargin = 8;
  const previewGap = 10;
  let activeCardRef = null;

  const isInteractive = (cardRef) => {
    if (!cardRef) return false;
    const preview = cardRef.querySelector(".card-preview");
    const activeEl = document.activeElement;
    const cardHovered = typeof cardRef.matches === "function" && cardRef.matches(":hover");
    const previewHovered = !!(preview && typeof preview.matches === "function" && preview.matches(":hover"));
    const cardFocused = !!(activeEl && cardRef.contains(activeEl));
    const previewFocused = !!(preview && activeEl && preview.contains(activeEl));
    return cardHovered || previewHovered || cardFocused || previewFocused;
  };

  const resetPreview = (preview) => {
    if (!preview) return;
    resetHoverPreviewStyles(preview);
    preview.style.removeProperty("display");
    preview.style.removeProperty("visibility");
  };

  const forceShow = (preview) => {
    if (!preview) return;
    preview.style.setProperty("display", "block", "important");
    preview.style.setProperty("visibility", "visible", "important");
  };

  const clampPreview = (cardRef) => {
    if (!cardRef) return;
    const preview = cardRef.querySelector(".card-preview");
    if (!preview) return;

    forceShow(preview);
    resetHoverPreviewStyles(preview);

    const rect = preview.getBoundingClientRect();
    const width = rect.width || 0;
    const height = rect.height || 0;
    if (!width || !height) return;

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
    if (!viewportWidth || !viewportHeight) return;
    const maxWidth = Math.max(160, viewportWidth - (previewMargin * 2));
    const maxHeight = Math.max(160, viewportHeight - (previewMargin * 2));
    const overflowLeft = rect.left < previewMargin;
    const overflowRight = rect.right > (viewportWidth - previewMargin);
    const overflowTop = rect.top < previewMargin;
    const overflowBottom = rect.bottom > (viewportHeight - previewMargin);
    if (!(overflowLeft || overflowRight || overflowTop || overflowBottom)) {
      preview.style.removeProperty("display");
      preview.style.removeProperty("visibility");
      return;
    }

    const clamp = (value, min, max) => {
      if (max < min) return min;
      return Math.min(Math.max(value, min), max);
    };

    let displayWidth = width;
    let displayHeight = height;
    if (preview.tagName === "IMG") {
      const scale = Math.min(1, maxWidth / width, maxHeight / height);
      displayWidth = Math.round(width * scale);
      displayHeight = Math.round(height * scale);
      preview.style.width = `${displayWidth}px`;
      preview.style.height = `${displayHeight}px`;
      preview.style.maxWidth = "none";
      preview.style.maxHeight = "none";
      preview.style.overflow = "visible";
    } else {
      preview.style.maxWidth = `${maxWidth}px`;
      preview.style.maxHeight = `${maxHeight}px`;
      preview.style.overflow = "auto";
    }

    const anchor = cardRef.getBoundingClientRect();
    let left = anchor.left + (anchor.width / 2) - (displayWidth / 2);
    left = clamp(left, previewMargin, viewportWidth - displayWidth - previewMargin);

    let top = anchor.top - previewGap - displayHeight;
    if (top < previewMargin) {
      top = anchor.bottom + previewGap;
    }
    top = clamp(top, previewMargin, viewportHeight - displayHeight - previewMargin);

    preview.style.position = "fixed";
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
    preview.style.right = "auto";
    preview.style.bottom = "auto";
    preview.style.transform = "none";
    preview.style.zIndex = "2147483000";
  };

  const refreshActive = () => {
    if (!activeCardRef) return;
    if (!isInteractive(activeCardRef)) {
      resetPreview(activeCardRef.querySelector(".card-preview"));
      activeCardRef = null;
      return;
    }
    clampPreview(activeCardRef);
  };

  if (scope.__bgbViewportPreviewViewportBound !== true) {
    scope.__bgbViewportPreviewViewportBound = true;
    window.addEventListener("scroll", () => {
      window.requestAnimationFrame(refreshActive);
    }, { passive: true });
    window.addEventListener("resize", () => {
      window.requestAnimationFrame(refreshActive);
    }, { passive: true });
  }

  scope.querySelectorAll(".card-ref").forEach((cardRef) => {
    if (cardRef.__bgbViewportPreviewBound === true) return;
    cardRef.__bgbViewportPreviewBound = true;

    const activate = () => {
      const preview = cardRef.querySelector(".card-preview");
      if (!preview) return;
      if (activeCardRef && activeCardRef !== cardRef) {
        resetPreview(activeCardRef.querySelector(".card-preview"));
      }
      activeCardRef = cardRef;
      forceShow(preview);
      window.requestAnimationFrame(() => clampPreview(cardRef));
    };

    const reset = (event) => {
      const relatedTarget = event && event.relatedTarget;
      if (relatedTarget instanceof Node && cardRef.contains(relatedTarget)) {
        return;
      }
      window.requestAnimationFrame(() => {
        if (isInteractive(cardRef)) return;
        resetPreview(cardRef.querySelector(".card-preview"));
        if (activeCardRef === cardRef) activeCardRef = null;
      });
    };

    cardRef.addEventListener("mouseenter", activate);
    cardRef.addEventListener("mousemove", activate);
    cardRef.addEventListener("focusin", activate);
    cardRef.addEventListener("mouseleave", reset);
    cardRef.addEventListener("focusout", reset);

    const preview = cardRef.querySelector(".card-preview");
    const canPreviewReceiveHover = preview && !preview.matches("img.card-preview, .card-preview-placeholder");
    if (canPreviewReceiveHover && preview.__bgbViewportPreviewHoverBound !== true) {
      preview.__bgbViewportPreviewHoverBound = true;
      preview.addEventListener("mouseenter", activate);
      preview.addEventListener("mousemove", activate);
      preview.addEventListener("mouseleave", reset);
    }
  });
};

// 1.3 Generic hover image preview for elements with data-hover-preview-src.
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
    if (!viewportWidth) return;

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    let left = anchor.right + gap;
    if (left + popupWidth > viewportWidth - margin) {
      left = anchor.left - popupWidth - gap;
    }
    const minLeft = margin;
    const maxLeft = Math.max(minLeft, viewportWidth - popupWidth - margin);
    left = Math.min(Math.max(left, minLeft), maxLeft);

    const centerY = anchor.top + (anchor.height / 2);
    const top = scrollY + centerY - (popupHeight / 2);

    wrap.style.position = "absolute";
    wrap.style.left = `${Math.round(scrollX + left)}px`;
    wrap.style.top = `${Math.round(Math.max(margin, top))}px`;
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

// 2. Page Fade-in Animation
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
});

// 3. Dark Mode Toggle (Medieval Torchlight Theme)
let torchFlickerTimer = 0;

const startTorchFlicker = () => {
  if (torchFlickerTimer) return;
  torchFlickerTimer = window.setInterval(() => {
    if (!document.body.classList.contains("torch-mode")) return;
    document.body.style.filter = `brightness(${0.9 + Math.random() * 0.2})`;
  }, 200);
};

const stopTorchFlicker = () => {
  if (!torchFlickerTimer) return;
  window.clearInterval(torchFlickerTimer);
  torchFlickerTimer = 0;
};

const enableTorchMode = () => {
  document.body.classList.add("torch-mode");
  localStorage.setItem("torchMode", "enabled");
  startTorchFlicker();
};

const disableTorchMode = () => {
  document.body.classList.remove("torch-mode");
  localStorage.setItem("torchMode", "disabled");
  stopTorchFlicker();
  document.body.style.filter = "brightness(1)";
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

if (document.body.classList.contains("torch-mode")) {
  startTorchFlicker();
}

// 4. Shared helpers used by page-specific scripts.
window.BGB = {
  ...(window.BGB || {}),
  setupSmoothScrollLinks,
  setupSubnavActiveState,
  setupHoverImagePreview,
  resetHoverPreviewStyles,
  bindCardRefViewportPreviews,
};
