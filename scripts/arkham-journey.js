// Optional Scarlet Keys journey UI. Map assets and campaign state stay local.
(() => {
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const svgNode = (tag, attrs = {}, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => n.setAttribute(key, String(value)));
    if (text) n.textContent = text;
    return n;
  };
  function renderKey(card) {
    const details = node('details', 'journey-key');
    details.append(node('summary', '', `${card.name} · ${card.bearer}`));
    const img = node('img');
    img.src = card.imageSrc;
    img.alt = `${card.name}, stable side`;
    img.loading = 'lazy';
    details.append(img);
    return details;
  }
  function renderEntry(entry, renderEvent) {
    if (entry.variant === 'travel') {
      const travel = node('div', 'journey-travel');
      travel.append(node('strong', '', entry.title), node('span', '', entry.text));
      return travel;
    }
    const visit = node('section', 'journey-visit');
    visit.id = entry.id;
    visit.tabIndex = -1;
    const heading = node('div', 'journey-visit-heading');
    const meta = node('div', 'record-meta');
    meta.append(node('span', 'meta-item', entry.eyebrow || 'Location'));
    heading.append(meta, node('h3', '', entry.title));
    if (entry.subtitle) heading.append(node('p', '', entry.subtitle));
    visit.append(heading);
    (entry.events || []).forEach(event => {
      const block = renderEvent(event);
      block.classList.add('journey-event');
      // Keep a meaningful heading hierarchy within each visit.
      const title = block.querySelector('h3');
      if (title) title.replaceWith(node('h4', 'journey-event-title', title.textContent));
      block.querySelectorAll('.story-note h4').forEach(h => h.replaceWith(node('h5', '', h.textContent)));
      const status = block.querySelector('.campaign-status') || node('div', 'campaign-status');
      status.prepend(node('span', 'status-chip', `Type: ${event.eventType || 'Location Story'}`));
      if (!status.parentNode) block.querySelector('.journey-event-title').after(status);
      visit.append(block);
    });
    return visit;
  }
  async function renderMap(config) {
    const section = node('section', 'record-section journey-map');
    section.id = 'world-map';
    section.append(node('h2', 'section-title', 'The Journey'));
    const panel = node('div', 'journey-map-panel');
    section.append(panel);
    const stats = node('div', 'journey-map-stats');
    [`Current location · ${config.currentLocationName}`, `Time passed · ${config.timePassed}`, `Last session · ${config.sessionDate}`].forEach(s => stats.append(node('span', '', s)));
    panel.append(stats);
    const disclosure = node('details', 'journey-map-disclosure');
    disclosure.open = !matchMedia('(max-width: 600px)').matches;
    disclosure.append(node('summary', '', 'World map · explore the route'));
    panel.append(disclosure);
    let map;
    try {
      const response = await fetch(config.source);
      if (!response.ok) throw new Error(`Map HTTP ${response.status}`);
      map = await response.json();
    } catch (error) {
      disclosure.append(node('p', '', 'The map could not be loaded. The full journey is recorded below.'));
      console.error(error);
      return section;
    }
    const controls = node('div', 'journey-map-controls');
    const addButton = (label, fn, aria) => {
      const button = node('button', '', label);
      button.type = 'button';
      if (aria) button.setAttribute('aria-label', aria);
      button.addEventListener('click', fn);
      controls.append(button);
      return button;
    };
    const W = map.width, H = map.height;
    const compact = matchMedia('(max-width: 600px)').matches;
    const focusZoom = compact ? 4.3 : 2.6;
    let zoom = focusZoom, cx = 965, cy = 240;
    const svg = svgNode('svg', {class: 'journey-map-canvas', viewBox: `0 0 ${W} ${H}`, tabindex: 0, role: 'group', 'aria-label': 'World travel map. Arrow keys pan; plus and minus zoom. Select a city below for details.'});
    svg.append(svgNode('image', {href: map.imageSrc, width: W, height: H}));
    svg.append(svgNode('image', {href: map.textureSrc, width: W, height: H, opacity: .22, 'pointer-events': 'none'}));
    const locations = new Map(map.locations.map(p => [p.id, p]));
    const current = locations.get(config.currentLocation);
    if (current) { cx = current.x; cy = current.y; }
    const visited = new Set(config.visitedLocations || []);
    const geography = svgNode('g', {class: 'journey-geography', 'aria-hidden': true});
    (map.labels || []).filter(l => l.type.includes('ocean')).forEach(l => geography.append(svgNode('text', {x:l.x, y:l.y, 'text-anchor':'middle', 'font-size':15}, l.name.replace(/\s+/g, ' '))));
    svg.append(geography);
    const route = svgNode('polyline', {class:'journey-route', fill:'none', points:(config.route || []).map(id => locations.get(id)).filter(Boolean).map(p => `${p.x},${p.y}`).join(' '), 'vector-effect':'non-scaling-stroke'});
    svg.append(route);
    const markers = [];
    let selected = config.currentLocation;
    const info = node('div', 'journey-map-info');
    info.setAttribute('aria-live', 'polite');
    // Custom listbox: native macOS menus centre the checked item over the control
    // instead of dropping from it. The list lives on <body> so the panel's overflow can't clip it.
    const label = node('div', 'journey-city-select');
    const labelText = node('span', '', 'Explore a location');
    labelText.id = 'journey-city-label';
    const trigger = node('button', 'journey-city-trigger');
    trigger.type = 'button';
    trigger.id = 'journey-city-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'journey-city-list');
    trigger.setAttribute('aria-labelledby', 'journey-city-label journey-city-trigger');
    const list = node('ul', 'journey-city-list');
    list.id = 'journey-city-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-labelledby', 'journey-city-label');
    list.hidden = true;
    const options = [...map.locations].sort((a,b) => a.name.localeCompare(b.name)).map(p => {
      const option = node('li', '', `${p.name}${p.id === config.currentLocation ? ' · Current' : visited.has(p.id) ? ' · Visited' : ''}`);
      option.dataset.id = p.id;
      option.setAttribute('role', 'option');
      option.tabIndex = -1;
      list.append(option);
      return option;
    });
    label.append(labelText, trigger);
    document.body.append(list);
    function placeList() {
      const r = trigger.getBoundingClientRect(), gap = 4, margin = 8;
      const below = innerHeight - r.bottom - gap - margin, above = r.top - gap - margin;
      const up = below < Math.min(list.scrollHeight, 320) && above > below;
      list.style.maxHeight = `${Math.min(320, up ? above : below)}px`;
      list.style.minWidth = `${r.width}px`;
      list.style.left = `${Math.max(margin, Math.min(r.left, innerWidth - list.offsetWidth - margin))}px`;
      list.style.top = `${up ? r.top - gap - list.offsetHeight : r.bottom + gap}px`;
      list.classList.toggle('is-above', up);
    }
    const onScroll = e => { if (e.target !== list) placeList(); };
    const onOutside = e => { if (!list.contains(e.target) && !trigger.contains(e.target)) closeList(false); };
    function openList() {
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      placeList();
      const current = options.find(o => o.dataset.id === selected) || options[0];
      current.focus({preventScroll: true});
      current.scrollIntoView({block: 'nearest'});
      addEventListener('resize', placeList);
      addEventListener('scroll', onScroll, true);
      document.addEventListener('pointerdown', onOutside);
    }
    function closeList(refocus = true) {
      if (list.hidden) return;
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      removeEventListener('resize', placeList);
      removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onOutside);
      if (refocus) trigger.focus();
    }
    function chooseLocation(id) {
      closeList();
      const p = locations.get(id);
      showLocation(p.id); cx = p.x; cy = p.y; zoom = Math.max(zoom, focusZoom); update();
    }
    trigger.addEventListener('click', () => list.hidden ? openList() : closeList());
    trigger.addEventListener('keydown', e => {
      if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault(); openList();
    });
    let typed = '', typedAt = 0;
    list.addEventListener('click', e => { const o = e.target.closest('[role=option]'); if (o) chooseLocation(o.dataset.id); });
    list.addEventListener('keydown', e => {
      const i = options.indexOf(document.activeElement);
      let next = null;
      if (e.key === 'ArrowDown') next = options[Math.min(options.length - 1, i + 1)];
      else if (e.key === 'ArrowUp') next = options[Math.max(0, i - 1)];
      else if (e.key === 'Home') next = options[0];
      else if (e.key === 'End') next = options[options.length - 1];
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) chooseLocation(options[i].dataset.id); return; }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeList(); return; }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        typed = (Date.now() - typedAt < 600 ? typed : '') + e.key.toLowerCase();
        typedAt = Date.now();
        next = options.find(o => o.textContent.toLowerCase().startsWith(typed));
      }
      if (!next) return;
      e.preventDefault();
      next.focus({preventScroll: true});
      next.scrollIntoView({block: 'nearest'});
    });
    function showLocation(id) {
      selected = id;
      options.forEach(o => o.setAttribute('aria-selected', String(o.dataset.id === id)));
      trigger.textContent = options.find(o => o.dataset.id === id)?.textContent || '';
      const p = locations.get(id);
      const note = (config.locationNotes || {})[id];
      const status = id === config.currentLocation ? 'Current location' : visited.has(id) ? 'Visited' : p.status === 'side' ? 'Side story destination' : p.status === 'locked' ? 'Requires a campaign record' : 'Unvisited destination';
      info.replaceChildren(node('h3', '', p.name), node('span', 'journey-location-status', status));
      info.append(node('p', '', note?.text || 'No visit recorded. Only the public map location is shown.'));
      if (note?.anchor) {
        const link = node('a', 'journey-note-link', 'Read location notes →');
        link.href = `#${note.anchor}`;
        info.append(link);
      }
      markers.forEach(m => m.group.classList.toggle('is-selected', m.p.id === id));
    }
    map.locations.forEach(p => {
      const state = p.id === config.currentLocation ? ' is-current' : visited.has(p.id) ? ' is-visited' : '';
      const group = svgNode('g', {class:`journey-city status-${p.status}${state}`, role:'button', tabindex:-1, 'aria-label':p.name, transform:`translate(${p.x} ${p.y})`});
      const ring = p.id === config.currentLocation ? svgNode('circle', {r:11, class:'journey-current-ring'}) : null;
      if (ring) group.append(ring);
      const circle = svgNode('circle', {r:5});
      const hit = svgNode('circle', {r:11, class:'journey-hit'});
      const text = svgNode('text', {'text-anchor': p.direction === 'left' ? 'end' : 'start', 'dominant-baseline':'middle'}, p.name);
      group.append(hit, circle, text, svgNode('title', {}, p.name));
      group.addEventListener('click', () => { if (!dragged) { showLocation(p.id); update(); } });
      group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showLocation(p.id); } });
      svg.append(group);
      markers.push({p, group, circle, ring, hit, text});
    });
    function update() {
      zoom = Math.min(5, Math.max(1, zoom));
      const w = W / zoom, h = Math.min(H, compact ? w / 1.3 : H / zoom);
      cx = Math.max(w/2, Math.min(W-w/2, cx));
      cy = Math.max(h/2, Math.min(H-h/2, cy));
      svg.setAttribute('viewBox', `${cx-w/2} ${cy-h/2} ${w} ${h}`);
      markers.forEach(({p,circle,ring,hit,text}) => {
        if (ring) ring.setAttribute('r', 11 / Math.sqrt(zoom));
        circle.setAttribute('r', 7 / Math.sqrt(zoom));
        hit.setAttribute('r', 17 / Math.sqrt(zoom));
        text.setAttribute('font-size', (compact ? 30 : 20) / Math.sqrt(zoom));
        text.setAttribute('x', (p.direction === 'left' ? -1 : 1) * (ring ? 16 : 11) / Math.sqrt(zoom));
        // At world scale keep a quiet overview; every city is available via the selector.
        text.style.display = zoom < 1.5 && !visited.has(p.id) && p.id !== selected ? 'none' : '';
      });
      zoomIn.disabled = zoom >= 5;
      zoomOut.disabled = zoom <= 1;
    }
    const zoomIn = addButton('+', () => { zoom *= 1.35; update(); }, 'Zoom in');
    const zoomOut = addButton('−', () => { zoom /= 1.35; update(); }, 'Zoom out');
    addButton('World', () => { zoom = 1; cx = W/2; cy = H/2; update(); });
    addButton('Current location', () => { zoom = focusZoom; cx = current.x; cy = current.y; showLocation(current.id); update(); });
    let drag = null, dragged = false;
    const pointers = new Map();
    let pinch = null;
    svg.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      dragged = false;
      drag = {x:e.clientX,y:e.clientY,cx,cy};
      if (pointers.size === 2) {
        const [a,b] = [...pointers.values()];
        pinch = {distance: Math.hypot(a.x-b.x,a.y-b.y),zoom};
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if (pointers.size === 2 && pinch) {
        const [a,b] = [...pointers.values()];
        zoom = pinch.zoom * Math.hypot(a.x-b.x,a.y-b.y) / Math.max(1,pinch.distance);
        dragged = true; update(); return;
      }
      if (!drag) return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if (Math.hypot(dx,dy)>4) dragged = true;
      if (!dragged) return;
      if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
      const scale = W / zoom / svg.getBoundingClientRect().width;
      cx = drag.cx-dx*scale; cy = drag.cy-dy*scale; update();
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => svg.addEventListener(type, e => {
      pointers.delete(e.pointerId); drag = null; pinch = null;
    }));
    svg.addEventListener('keydown', e => {
      const delta = 65 / zoom;
      if (e.key === 'ArrowLeft') cx -= delta;
      else if (e.key === 'ArrowRight') cx += delta;
      else if (e.key === 'ArrowUp') cy -= delta;
      else if (e.key === 'ArrowDown') cy += delta;
      else if (e.key === '+' || e.key === '=') zoom *= 1.35;
      else if (e.key === '-') zoom /= 1.35;
      else return;
      e.preventDefault(); update();
    });
    disclosure.append(controls, svg, node('p', 'journey-map-hint', 'Drag to explore · pinch or use + / − to zoom · select a city to read its record.'));
    const legend = node('div', 'journey-map-legend');
    [['standard','Destination'],['side','Side story'],['locked','Restricted'],['visited','Visited'],['current','Current']].forEach(([cls,name]) => legend.append(node('span', `legend-${cls}`, name)));
    disclosure.append(legend, label);
    panel.append(info);
    const source = node('p', 'journey-map-source', 'Map artwork and location coordinates: ');
    const sourceLink = node('a', '', 'ArkhamCards');
    sourceLink.href = 'https://github.com/zzorba/ArkhamCards';
    source.append(sourceLink);
    panel.append(source);
    showLocation(selected); update();
    return section;
  }
  window.BGBArkhamJourney = {renderMap, renderEntry, renderKey};
})();
