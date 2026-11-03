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
    heading.append(node('span', 'journey-eyebrow', entry.eyebrow || 'Location'), node('h3', '', entry.title));
    if (entry.subtitle) heading.append(node('p', '', entry.subtitle));
    visit.append(heading);
    (entry.events || []).forEach(event => {
      const block = renderEvent(event);
      block.classList.add('journey-event');
      // Keep a meaningful heading hierarchy within each visit.
      const title = block.querySelector('h3');
      if (title) title.replaceWith(node('h4', 'journey-event-title', title.textContent));
      block.querySelectorAll('.story-note h4').forEach(h => h.replaceWith(node('h5', '', h.textContent)));
      block.prepend(node('span', 'journey-event-type', event.eventType || 'Location Story'));
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
    const label = node('label', 'journey-city-select', 'Explore a location');
    const select = node('select');
    select.setAttribute('aria-label', 'Explore a location');
    [...map.locations].sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
      const option = node('option', '', `${p.name}${p.id === config.currentLocation ? ' · Current' : visited.has(p.id) ? ' · Visited' : ''}`);
      option.value = p.id;
      select.append(option);
    });
    label.append(select);
    function showLocation(id) {
      selected = id;
      select.value = id;
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
    select.addEventListener('change', () => {
      const p = locations.get(select.value);
      showLocation(p.id); cx = p.x; cy = p.y; zoom = Math.max(zoom, focusZoom); update();
    });
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
