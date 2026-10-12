// space.js — the full-screen chord space: an SVG world with pan/zoom, skeletal nodes on a grid,
// edges for the sequence and the candidates, and "halos" of move pills around a landing.

const NS = 'http://www.w3.org/2000/svg';
export const NODE_W = 128, NODE_H = 62;

export function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (attrs[k] == null) continue;
    if (k === 'text') e.textContent = attrs[k];
    else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(e.style, attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of children) if (c) e.appendChild(c);
  return e;
}

// Shorten a segment so it ends on the rectangle boundary of a node (plus a gap).
function boundaryOffset(ux, uy, w = NODE_W / 2, h = NODE_H / 2, gap = 6) {
  const tx = Math.abs(ux) < 1e-6 ? Infinity : w / Math.abs(ux);
  const ty = Math.abs(uy) < 1e-6 ? Infinity : h / Math.abs(uy);
  return Math.min(tx, ty) + gap;
}

export function quadPoint(p0, c, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
}

// A curved edge between two node centers; bend is a fraction of the distance (sign = side).
export function edgeGeometry(a, b, bend = 0.15, fromSize, toSize) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 1) return null;
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const sa = fromSize ? boundaryOffset(ux, uy, fromSize.w / 2, fromSize.h / 2) : boundaryOffset(ux, uy);
  const sb = toSize ? boundaryOffset(ux, uy, toSize.w / 2, toSize.h / 2) : boundaryOffset(ux, uy);
  const p0 = { x: a.x + ux * sa, y: a.y + uy * sa };
  const p2 = { x: b.x - ux * sb, y: b.y - uy * sb };
  const c = { x: (a.x + b.x) / 2 + nx * bend * d, y: (a.y + b.y) / 2 + ny * bend * d };
  return { p0, c, p2, path: `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}` };
}

// A loop that leaves a node from the top and returns to it (the one-chord loop).
export function loopPath(a) {
  const x = a.x, y = a.y - NODE_H / 2 - 6;
  return `M${x - 28} ${y} C${x - 110} ${y - 120}, ${x + 110} ${y - 120}, ${x + 28} ${y}`;
}

export class Space {
  constructor(svg, handlers) {
    this.svg = svg;
    this.h = handlers;
    this.view = { x: 0, y: 0, s: 1 };
    this.defs = el('defs');
    for (const [id, cls] of [['arrow-seq', 'm-seq'], ['arrow-cand', 'm-cand'], ['arrow-return', 'm-return'], ['arrow-via', 'm-via']]) {
      this.defs.appendChild(el('marker', { id, class: cls, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, [
        el('path', { d: 'M0 0 L10 5 L0 10 z' }),
      ]));
    }
    this.world = el('g', { id: 'world' });
    this.layers = { grid: el('g', { class: 'layer-grid' }), edges: el('g', { class: 'layer-edges' }), nodes: el('g', { class: 'layer-nodes' }), halo: el('g', { class: 'layer-halo' }) };
    for (const k of ['grid', 'edges', 'nodes', 'halo']) this.world.appendChild(this.layers[k]);
    svg.appendChild(this.defs);
    svg.appendChild(this.world);
    this.bindPanZoom();
    this.apply();
  }

  apply() {
    const { x, y, s } = this.view;
    this.world.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
  }

  // Center a world point in the visible region (left of the panel, above the sequence bar).
  centerOn(wx, wy, region) {
    const cx = region.left + region.width / 2, cy = region.top + region.height / 2;
    this.view.x = cx - wx * this.view.s;
    this.view.y = cy - wy * this.view.s;
    this.apply();
  }

  zoomBy(factor, cx, cy) {
    const s0 = this.view.s, s1 = Math.max(0.35, Math.min(2.5, s0 * factor));
    const k = s1 / s0;
    this.view.x = cx - (cx - this.view.x) * k;
    this.view.y = cy - (cy - this.view.y) * k;
    this.view.s = s1;
    this.apply();
  }

  bindPanZoom() {
    const svg = this.svg;
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      if (e.target.closest('.node, .pill')) return;
      drag = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      this.view.x = drag.vx + (e.clientX - drag.sx);
      this.view.y = drag.vy + (e.clientY - drag.sy);
      this.apply();
    });
    const end = () => { drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else { this.view.x -= e.deltaX; this.view.y -= e.deltaY; this.apply(); }
    }, { passive: false });
  }

  renderGrid(rows, cols) {
    const g = this.layers.grid;
    g.replaceChildren();
    for (const r of rows) {
      g.appendChild(el('rect', { class: 'row-band', x: cols.x0 - 60, y: r.y - r.h / 2, width: cols.width + 120, height: r.h, rx: 18 }));
      g.appendChild(el('text', { class: 'row-label', x: cols.x0 - 48, y: r.y - r.h / 2 + 22, text: r.label }));
      g.appendChild(el('text', { class: 'row-sub', x: cols.x0 - 48, y: r.y - r.h / 2 + 38, text: r.sub }));
    }
    for (const c of cols.items) {
      g.appendChild(el('text', { class: 'col-label' + (c.home ? ' home' : ''), x: c.x, y: cols.y0 - 14, 'text-anchor': 'middle', text: c.label }));
    }
    g.appendChild(el('text', { class: 'axis-label', x: cols.x0, y: cols.y0 - 40, text: 'brighter ◂  chain of fourths  ▸ darker' }));
  }

  renderNodes(nodes) {
    const g = this.layers.nodes;
    g.replaceChildren();
    for (const n of nodes) {
      const w = n.small ? 92 : NODE_W, h = n.small ? 46 : NODE_H;
      const cls = ['node', `row-${n.row}`, ...(n.cls || [])];
      if (n.small) cls.push('small');
      const node = el('g', { class: cls.join(' '), transform: `translate(${n.x} ${n.y})`, 'data-id': n.id, style: n.score != null ? { '--score': n.score } : undefined }, [
        el('rect', { class: 'node-bg', x: -w / 2, y: -h / 2, width: w, height: h, rx: n.small ? 10 : 13 }),
        el('text', { class: 'node-name', y: n.small ? 3 : -3, 'text-anchor': 'middle', text: n.name }),
        !n.small && el('text', { class: 'node-numeral', y: 17, 'text-anchor': 'middle', text: n.numeral }),
        n.small && n.sub && el('text', { class: 'node-sub', y: 16, 'text-anchor': 'middle', text: n.sub }),
        el('title', { text: n.title || n.name }),
      ]);
      if (n.score != null) {
        node.appendChild(el('rect', { class: 'score-track', x: -w / 2 + 10, y: h / 2 - 7, width: w - 20, height: 3, rx: 1.5 }));
        node.appendChild(el('rect', { class: 'score-fill', x: -w / 2 + 10, y: h / 2 - 7, width: (w - 20) * n.score, height: 3, rx: 1.5 }));
      }
      if (n.tension != null && !n.small) {
        for (let i = 0; i < 3; i++) node.appendChild(el('circle', { class: 'tension-dot' + (i < n.tension ? ' on' : ''), cx: -w / 2 + 12 + i * 8, cy: -h / 2 + 11, r: 2.4 }));
      }
      if (n.seqIdx && n.seqIdx.length) {
        n.seqIdx.forEach((idx, i) => {
          const bx = w / 2 - 10 - i * 22, by = -h / 2 - 2;
          node.appendChild(el('circle', { class: 'seq-badge', cx: bx, cy: by, r: 10 }));
          node.appendChild(el('text', { class: 'seq-badge-text', x: bx, y: by + 3.5, 'text-anchor': 'middle', text: idx }));
        });
      }
      node.addEventListener('click', e => this.h.onNodeClick(n, e));
      node.addEventListener('pointerenter', () => this.h.onNodeHover(n));
      node.addEventListener('pointerleave', () => this.h.onNodeHover(null));
      g.appendChild(node);
    }
  }

  renderEdges(edges) {
    const g = this.layers.edges;
    g.replaceChildren();
    for (const e of edges) {
      let d;
      if (e.loop) d = loopPath(e.from);
      else { const geo = edgeGeometry(e.from, e.to, e.bend ?? 0.15, e.fromSize, e.toSize); if (!geo) continue; d = geo.path; }
      g.appendChild(el('path', { class: `edge ${e.cls}` + (e.sel ? ' sel' : ''), d, 'marker-end': `url(#arrow-${e.marker || 'cand'})`, style: e.weight != null ? { '--w': e.weight } : undefined }));
      if (e.gap != null) {
        const hit = el('path', { class: 'edge-hit', d }, [el('title', { text: e.sel ? 'This gap is selected' : 'Click to work on this gap' })]);
        hit.addEventListener('click', ev => { ev.stopPropagation(); this.h.onGapClick(e.gap); });
        g.appendChild(hit);
      }
      if (e.label) {
        const geo = e.loop ? null : edgeGeometry(e.from, e.to, e.bend ?? 0.15);
        const p = geo ? quadPoint(geo.p0, geo.c, geo.p2, 0.5) : { x: e.from.x, y: e.from.y - NODE_H / 2 - 96 };
        g.appendChild(el('text', { class: 'edge-label', x: p.x, y: p.y - 6, 'text-anchor': 'middle', text: e.label }));
      }
    }
  }

  // Where the pills of a halo go. Three cases: a one-chord loop (fan over the top of the node),
  // neighbours close together (a fan on the landing's side facing the jumpoff), and distant
  // neighbours (two lanes along the edge between them, so nothing sits on other nodes).
  pillPositions(landing, jumpoff, n) {
    const dx = jumpoff.x - landing.x, dy = jumpoff.y - landing.y, d = Math.hypot(dx, dy);
    const out = [];
    const centerOut = [];
    const mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) centerOut.push(i);
    centerOut.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    if (d < 1) {
      const a0 = (-150 * Math.PI) / 180, a1 = (-30 * Math.PI) / 180;
      for (let r = 0; r < n; r++) {
        const slot = centerOut[r];
        const ang = n > 1 ? a0 + ((a1 - a0) * slot) / (n - 1) : -Math.PI / 2;
        const radius = slot % 2 === 0 ? 150 : 200;
        out.push({ x: landing.x + Math.cos(ang) * radius, y: landing.y + Math.sin(ang) * radius });
      }
      return out;
    }
    if (d < 420) {
      const base = Math.atan2(dy, dx);
      const span = Math.min(((20 * Math.PI) / 180) * (n - 1), (110 * Math.PI) / 180);
      for (let r = 0; r < n; r++) {
        const slot = centerOut[r];
        const ang = n > 1 ? base - span / 2 + (span * slot) / (n - 1) : base;
        const radius = slot % 2 === 0 ? 120 : 172;
        out.push({ x: landing.x + Math.cos(ang) * radius, y: landing.y + Math.sin(ang) * radius });
      }
      return out;
    }
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const lanes = n <= 4 ? 1 : 2;
    const perLane = Math.ceil(n / lanes);
    for (let r = 0; r < n; r++) {
      const lane = r % lanes, k = Math.floor(r / lanes);
      const lo = n <= 2 ? 0.38 : 0.2, hi = n <= 2 ? 0.62 : 0.8;
      const t = perLane > 1 ? lo + ((hi - lo) * k) / (perLane - 1) : 0.5;
      const off = lanes === 1 ? 40 : (lane === 0 ? 40 : -40);
      out.push({ x: landing.x + dx * t + nx * off, y: landing.y + dy * t + ny * off });
    }
    return out;
  }

  // A halo: pills for each move into `landing`, with a faint path jumpoff → pill
  // and an arrow pill → landing ("by way of").
  renderHalos(halos) {
    const g = this.layers.halo;
    g.replaceChildren();
    for (const halo of halos) {
      const { landing, jumpoff, pills } = halo;
      if (!pills.length) continue;
      const same = Math.hypot(landing.x - jumpoff.x, landing.y - jumpoff.y) < 1;
      const positions = this.pillPositions(landing, jumpoff, pills.length);
      pills.forEach((pill, rank) => {
        const { x: px, y: py } = positions[rank];
        const text = pill.text;
        const w = Math.max(44, text.length * 7.4 + 20), h = 26;
        const pos = { x: px, y: py };
        if (!same) {
          const gin = edgeGeometry(jumpoff, pos, 0.05, null, { w, h });
          if (gin) g.appendChild(el('path', { class: 'via via-in', d: gin.path }));
        }
        const gout = edgeGeometry(pos, landing, 0.0, { w, h }, null);
        if (gout) g.appendChild(el('path', { class: 'via via-out', d: gout.path, 'marker-end': 'url(#arrow-via)', style: { '--w': pill.strength } }));
        const p = el('g', { class: `pill type-${pill.type}` + (pill.cls ? ' ' + pill.cls : ''), transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})`, style: { '--w': pill.strength } }, [
          el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 13 }),
          el('text', { class: 'pill-text', y: 4, 'text-anchor': 'middle', text }),
          el('text', { class: 'pill-type', y: -h / 2 - 4, 'text-anchor': 'middle', text: pill.typeName }),
          el('title', { text: pill.title || text }),
        ]);
        p.addEventListener('click', e => { e.stopPropagation(); this.h.onPillClick(pill, e); });
        p.addEventListener('pointerenter', () => this.h.onPillHover(pill));
        p.addEventListener('pointerleave', () => this.h.onPillHover(null));
        g.appendChild(p);
      });
    }
  }
}
