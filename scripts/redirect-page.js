// Shared zero-delay redirect page bootstrap.
(() => {
  const target = String(document.body?.dataset?.redirectTo || "").trim();
  if (!target) return;

  const title = String(document.body?.dataset?.redirectTitle || "Redirecting...").trim();
  document.title = title;

  const meta = document.createElement("meta");
  meta.httpEquiv = "refresh";
  meta.content = `0; url=${target}`;
  document.head.appendChild(meta);

  const p = document.createElement("p");
  p.appendChild(document.createTextNode("Redirecting to "));
  const a = document.createElement("a");
  a.href = target;
  a.textContent = target;
  p.appendChild(a);
  p.appendChild(document.createTextNode("..."));
  document.body.appendChild(p);

  window.location.replace(target);
})();
