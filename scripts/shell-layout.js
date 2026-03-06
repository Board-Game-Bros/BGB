// Shared page shell renderer: torch button, header, nav, footer.
(() => {
  const cfg = window.BGB_SHELL || {};

  const navItems = [
    { key: "home", href: "/", label: "Home" },
    { key: "library", href: "/library/", label: "Library" },
    { key: "news", href: "/news/", label: "News" },
    { key: "daily", href: "/daily/", label: "Daily" },
  ];

  const resolveActiveNav = () => {
    if (cfg.activeNav) return String(cfg.activeNav).toLowerCase();
    const pathname = String(window.location.pathname || "/").toLowerCase();
    const segments = pathname.split("/").filter(Boolean);
    const file = (segments[segments.length - 1] || "index.html").toLowerCase();
    const directory = pathname.endsWith("/") ? (segments[segments.length - 1] || "") : "";

    if (directory === "library") return "library";
    if (directory === "news") return "news";
    if (directory === "daily") return "daily";
    if (file === "index.html") return "home";
    if (file === "news.html") return "news";
    if (file === "daily.html") return "daily";
    if ([
      "library.html",
      "arkham_horror_lcg.html",
      "arkham_horror_lcg_tcu_20260215.html",
      "tainted_grail_foa.html",
    ].includes(file)) return "library";
    return "home";
  };

  const removeExistingShell = () => {
    const selectors = [
      "body > .torch-btn",
      "body > header",
      "body > nav",
      "body > footer",
    ];
    selectors.forEach((selector) => {
      const el = document.querySelector(selector);
      if (el) el.remove();
    });
  };

  const buildTorchButton = () => {
    const btn = document.createElement("button");
    btn.id = "torch-toggle";
    btn.className = "torch-btn";
    btn.setAttribute("type", "button");

    const img = document.createElement("img");
    img.src = cfg.torchIconSrc || "/assets/icon/torch.svg";
    img.alt = "Torch Mode";
    btn.appendChild(img);
    return btn;
  };

  const buildHeader = () => {
    const header = document.createElement("header");
    header.className = "site-header";

    if (cfg.showLogo !== false) {
      const logo = document.createElement("img");
      logo.src = cfg.logoSrc || "/assets/icon/BGB_transparent.png";
      logo.alt = cfg.logoAlt || "BGB Logo";
      logo.className = "logo";
      header.appendChild(logo);
    }

    const h1 = document.createElement("h1");
    h1.textContent = cfg.title || "Board Game Bros";
    header.appendChild(h1);
    return header;
  };

  const buildNav = () => {
    const nav = document.createElement("nav");
    const activeKey = resolveActiveNav();
    navItems.forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (item.key === activeKey) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  };

  const buildFooter = () => {
    const footer = document.createElement("footer");
    const p = document.createElement("p");
    p.textContent = cfg.footerText || "© 2025 Board Game Bros";
    footer.appendChild(p);
    return footer;
  };

  removeExistingShell();

  const body = document.body;
  if (!body) return;
  const anchor = body.querySelector("main, .container");
  const torch = buildTorchButton();
  const header = buildHeader();
  const nav = buildNav();
  const footer = buildFooter();

  if (anchor) {
    body.insertBefore(nav, anchor);
    body.insertBefore(header, nav);
    body.insertBefore(torch, header);
  } else {
    body.prepend(nav);
    body.prepend(header);
    body.prepend(torch);
  }
  body.appendChild(footer);
})();
