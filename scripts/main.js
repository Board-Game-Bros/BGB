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
  const gap = 10;

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
