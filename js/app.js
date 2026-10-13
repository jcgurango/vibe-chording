'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const NODE_R = 26;
  const LOOKAHEAD = 0.25;   // seconds of audio scheduled ahead by the player

  const state = {
    keyIdx: 0,
    rules: { ...Theory.DEFAULT_RULES },
    palette: [], byId: new Map(), trans: new Map(), trimmed: [], pos: new Map(),
    tempo: 100,
    progression: [],   // [{ id, slash, top, len, goto, times }] see Song for len / goto / times
    cursor: 0,         // insertion point: the progression index a new chord goes in front of
    ghost: null,       // { id, slash, top } auditioned at the cursor, not yet added
    filterPrev: false, // keep only chords that can follow the chord before the cursor
    filterNext: false, // keep only chords that can lead into the chord after the cursor
    voicings: [],      // parallel to sequence(): the progression with the ghost spliced in
    hover: null,
    playTimers: [],      // pending timeouts of the player; empty when stopped
    filter: new Map(),   // piano filter: pitch class -> 'in' (must have) | 'out' (must not have)
    pickerIndex: null,   // progression index (or 'ghost') whose picker is open
    pickerKind: null,    // 'slash' | 'top'
  };

  const $ = (id) => document.getElementById(id);
  const svg = $('map');
  const layers = {};

  const svgEl = (name, attrs = {}, parent = null) => {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const key = () => Theory.KEYS[state.keyIdx];
  const newEntry = (id) => ({ id, slash: null, top: null, len: Song.BAR, goto: null, times: null });
  const transOf = (a, b) => state.trans.get(a + '>' + b);
  const entryBass = (e) => e.slash ?? state.byId.get(e.id).rootPc;

  // Principle 3 between two progression entries, on their actual bass notes.
  function transEntries(a, b) {
    return Theory.transition(state.byId.get(a.id), state.byId.get(b.id), state.rules, entryBass(a), entryBass(b));
  }

  // ---------- tension colour ----------
  // Red (adds tension) through yellow (neutral) to green (resolves).
  const T_LO = -4, T_HI = 6, T_STEPS = 11;
  function tensionT(score) {
    const t = score < 0 ? 0.5 * (1 - Math.min(1, score / T_LO)) : 0.5 + 0.5 * Math.min(1, score / T_HI);
    return Math.max(0, Math.min(1, t));
  }
  const tensionHue = (t) => t < 0.5 ? t * 2 * 52 : 52 + (t - 0.5) * 2 * 80;
  const tensionColor = (score) => `hsl(${tensionHue(tensionT(score)).toFixed(0)} 85% 58%)`;
  const tensionStep = (score) => Math.round(tensionT(score) * (T_STEPS - 1));
  const tensionLabel = (score) => (score > 0 ? `resolves +${score}` : score < 0 ? `tension ${score}` : 'neutral 0');
  const tensionChip = (t) =>
    `<span class="tens" style="--t: ${tensionColor(t.score)}" title="${t.parts.join(' · ') || 'nothing owed, nothing landed on'}">${tensionLabel(t.score)}</span>`;
  const tensionOf = (a, b) => Theory.tension(state.byId.get(a.id), state.byId.get(b.id));

  // ---------- insertion point ----------
  // The progression with the ghost spliced in at the cursor.
  function sequence() {
    const seq = state.progression.map((e) => ({ e, ghost: false }));
    if (state.ghost) seq.splice(state.cursor, 0, { e: state.ghost, ghost: true });
    return seq;
  }
  const seqIndex = (i) => i + (state.ghost && i >= state.cursor ? 1 : 0);
  const ghostIndex = () => state.cursor;

  // The chord a candidate must follow, if that filter is on. At the start it wraps to the last chord.
  function prevEntry() {
    const n = state.progression.length;
    if (!state.filterPrev || !n) return null;
    return state.progression[state.cursor > 0 ? state.cursor - 1 : n - 1];
  }
  // The chord a candidate must lead into, if that filter is on. At the end it wraps to the first chord.
  function nextEntry() {
    const n = state.progression.length;
    if (!state.filterNext || !n) return null;
    return state.progression[state.cursor < n ? state.cursor : 0];
  }

  // Every active check on a candidate entry: [{ dir: 'after' | 'into', other, t }].
  function checks(cand) {
    const out = [];
    const p = prevEntry(), nx = nextEntry();
    if (p) out.push({ dir: 'after', other: p, t: transEntries(p, cand) });
    if (nx) out.push({ dir: 'into', other: nx, t: transEntries(cand, nx) });
    return out;
  }
  const legalEntry = (cand) => checks(cand).every((c) => c.t.ok);

  function defaultFilters() {
    state.filterPrev = state.cursor > 0;
    state.filterNext = state.cursor < state.progression.length;
  }

  function setCursor(i) {
    state.cursor = Math.max(0, Math.min(state.progression.length, i));
    state.ghost = null;
    state.pickerIndex = null;
    defaultFilters();
    refresh();
  }

  function refresh() {
    revoice();
    updateActive();
    renderList();
    renderFilterBar();
  }

  // Spell a pitch class in the context of a chord (so the 9th of Db7 is Eb, not D#).
  const spellPc = (pc, chord) => chord.spelling[pc] ?? Theory.spellInKey(pc, key());

  function noteName(midi, chord) {
    const sp = spellPc(midi % 12, chord);
    const octave = Math.floor((midi - sp.acc) / 12) - 1;
    return sp.name + octave;
  }

  function entryName(e) {
    const c = state.byId.get(e.id);
    return e.slash == null ? c.name : `${c.name}/${spellPc(e.slash, c).name}`;
  }

  // ---------- rebuild on key / rule change ----------
  function rebuild() {
    const full = Theory.buildPalette(key());
    const { kept, trimmed } = Theory.trim(full, state.rules);
    state.palette = kept;
    state.trimmed = trimmed;
    state.byId = new Map(kept.map((c) => [c.id, c]));
    state.trans = Theory.transitionTable(kept, state.rules);
    state.pos = Layout.place(kept, key().pc);
    state.progression = state.progression.filter((e) => state.byId.has(e.id));
    if (state.ghost && !state.byId.has(state.ghost.id)) state.ghost = null;
    state.cursor = Math.min(state.cursor, state.progression.length);
    revoice();
    renderPiano();
    renderMap();
    renderList();
    renderFilterBar();
    $('trim-note').textContent = trimmed.length
      ? `Trimmed (no diatonic entry or exit): ${trimmed.map((c) => c.name).join(', ')}`
      : 'Nothing trimmed under these rules.';
  }

  function revoice() {
    const items = sequence().map(({ e }) => ({ chord: state.byId.get(e.id), bassPc: e.slash, topPc: e.top }));
    state.voicings = Voicing.voiceLead(items, key().pc);
  }

  // ---------- map ----------
  function renderMap() {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '-520 -520 1040 1040');
    const defs = svgEl('defs', {}, svg);
    const marker = (id, color) => {
      const m = svgEl('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
      svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: color }, m);
    };
    marker('arrow-base', 'rgba(255,255,255,.25)');
    for (let i = 0; i < T_STEPS; i++) marker(`arrow-t${i}`, `hsl(${tensionHue(i / (T_STEPS - 1)).toFixed(0)} 85% 58%)`);

    layers.base = svgEl('g', { class: 'edges-base' }, svg);
    layers.active = svgEl('g', { class: 'edges-active' }, svg);
    layers.nodes = svgEl('g', { class: 'nodes' }, svg);

    for (const [a, b] of Theory.MOVES) {
      if (!state.byId.has(a) || !state.byId.has(b)) continue;
      if (!transOf(a, b).ok) continue;
      svgEl('path', { d: edgePath(a, b), 'data-from': a, 'data-to': b }, layers.base);
    }

    for (const c of state.palette) {
      const p = state.pos.get(c.id);
      const g = svgEl('g', { class: `node cat-${c.cat}`, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, 'data-id': c.id }, layers.nodes);
      svgEl('circle', { class: 'halo', r: NODE_R + 2 }, g);
      svgEl('circle', { class: 'body', r: NODE_R }, g);
      const name = svgEl('text', { class: 'name', y: 0 }, g);
      name.textContent = c.name;
      if (c.name.length > 6) name.setAttribute('font-size', c.name.length > 7 ? 9.5 : 10.5);
      const roman = svgEl('text', { class: 'roman', y: NODE_R + 13 }, g);
      roman.textContent = c.roman;
      svgEl('circle', { class: 'dot', r: 2.5, cy: -NODE_R - 7 }, g);
      g.addEventListener('click', (ev) => onPick(c.id, ev));
      g.addEventListener('dblclick', (ev) => { ev.preventDefault(); commitGhost(); });
      g.addEventListener('mouseenter', (ev) => onHover(c.id, ev));
      g.addEventListener('mousemove', (ev) => moveTooltip(ev));
      g.addEventListener('mouseleave', () => onHover(null));
    }
    updateActive();
  }

  function edgePath(a, b, curve = 0.14) {
    const pa = state.pos.get(a), pb = state.pos.get(b);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const off = len * curve;
    const cx = (pa.x + pb.x) / 2 + nx * off, cy = (pa.y + pb.y) / 2 + ny * off;
    // tangent directions at the ends of the quadratic curve
    const t0x = cx - pa.x, t0y = cy - pa.y, t0 = Math.hypot(t0x, t0y) || 1;
    const t1x = pb.x - cx, t1y = pb.y - cy, t1 = Math.hypot(t1x, t1y) || 1;
    const sx = pa.x + (t0x / t0) * (NODE_R + 1), sy = pa.y + (t0y / t0) * (NODE_R + 1);
    const ex = pb.x - (t1x / t1) * (NODE_R + 7), ey = pb.y - (t1y / t1) * (NODE_R + 7);
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }

  // Node states for the insertion point, plus arrows out of the previous chord
  // and (dashed) into the next one for every chord that passes both filters.
  function updateActive() {
    layers.active.innerHTML = '';
    const p = prevEntry(), nx = nextEntry();
    const anchored = !!(p || nx);
    const inProg = new Set(state.progression.map((e) => e.id));
    const legal = new Set();
    for (const g of layers.nodes.children) {
      const id = g.dataset.id;
      const ok = legalEntry({ id, slash: null });
      if (ok) legal.add(id);
      g.classList.toggle('current', !!p && id === p.id);
      g.classList.toggle('next', !!nx && id === nx.id);
      g.classList.toggle('ghost', !!state.ghost && id === state.ghost.id);
      g.classList.toggle('in-prog', inProg.has(id));
      g.classList.toggle('legal', anchored && ok);
      g.classList.toggle('blocked', anchored && !ok);
      g.classList.toggle('filtered', !matchesFilter(state.byId.get(id)));
    }
    for (const c of state.palette) {
      if (!legal.has(c.id)) continue;
      const cand = { id: c.id, slash: null };
      if (p && c.id !== p.id) arrow(p.id, c.id, tensionOf(p, cand).score, '');
      if (nx && c.id !== nx.id) arrow(c.id, nx.id, tensionOf(cand, nx).score, 'into');
    }
  }

  function arrow(from, to, score, cls) {
    svgEl('path', {
      d: edgePath(from, to, 0.1), 'data-node': cls === 'into' ? from : to, class: cls,
      style: `stroke: ${tensionColor(score)}`, 'marker-end': `url(#arrow-t${tensionStep(score)})`,
    }, layers.active);
  }

  // ---------- piano note filter ----------
  const matchesFilter = (chord) =>
    [...state.filter].every(([pc, mode]) => chord.pcs.includes(pc) === (mode === 'in'));

  const PIANO_LO = 48;   // C3, two octaves
  function renderPiano() {
    const piano = $('piano');
    piano.innerHTML = '';
    const W = 34, B = 22;
    let whiteIdx = 0;
    for (let m = PIANO_LO; m < PIANO_LO + 24; m++) {
      const pc = m % 12;
      const black = [1, 3, 6, 8, 10].includes(pc);
      const k = document.createElement('div');
      k.className = (black ? 'black' : 'white') + keyState(pc);
      k.dataset.pc = pc;
      k.textContent = Theory.spellInKey(pc, key()).name;
      if (black) k.style.left = (whiteIdx * W - B / 2) + 'px';
      else whiteIdx += 1;
      k.addEventListener('click', (ev) => toggleNote(pc, m, ev.shiftKey));
      piano.appendChild(k);
    }
    $('piano-clear').hidden = state.filter.size === 0;
  }

  const keyState = (pc) => ({ in: ' on', out: ' off' })[state.filter.get(pc)] ?? '';

  // Click: require the note. Shift-click: exclude it. Repeating clears it.
  function toggleNote(pc, midi, exclude) {
    const want = exclude ? 'out' : 'in';
    if (state.filter.get(pc) === want) state.filter.delete(pc);
    else { state.filter.set(pc, want); stopPlayAll(); Audio.playNote(midi); }
    refreshPiano();
  }

  function clearNotes() {
    state.filter.clear();
    refreshPiano();
  }

  function refreshPiano() {
    for (const k of $('piano').children) {
      k.classList.remove('on', 'off');
      const st = keyState(Number(k.dataset.pc)).trim();
      if (st) k.classList.add(st);
    }
    $('piano-clear').hidden = state.filter.size === 0;
    updateActive();
  }

  // ---------- insertion filter bar ----------
  function renderFilterBar() {
    const n = state.progression.length, c = state.cursor;
    $('slot-label').textContent = !n ? 'Adding the first chord'
      : c === 0 ? 'Inserting at the start'
      : c === n ? 'Adding at the end'
      : `Inserting between ${c} and ${c + 1}`;
    const pe = n ? state.progression[c > 0 ? c - 1 : n - 1] : null;
    const ne = n ? state.progression[c < n ? c : 0] : null;
    const fp = $('f-prev'), fn = $('f-next');
    fp.checked = state.filterPrev; fp.disabled = !n;
    fn.checked = state.filterNext; fn.disabled = !n;
    $('f-prev-label').textContent = pe ? `after ${entryName(pe)}${c === 0 ? ' (last)' : ''}` : 'after the previous chord';
    $('f-next-label').textContent = ne ? `into ${entryName(ne)}${c === n ? ' (first)' : ''}` : 'into the next chord';
  }

  // ---------- picking ----------
  // Single click: audition the chord as a ghost at the cursor. Double click commits it.
  function onPick(id, ev) {
    stopPlayAll();
    flash(id);
    const same = state.ghost?.id === id;
    if (!same) {
      state.ghost = newEntry(id);
      state.pickerIndex = null;
      refresh();
      scrollToSlot();
    }
    // the second click of a double click would only retrigger the same sound
    if (!(same && ev.detail > 1)) Audio.playVoicing(state.voicings[ghostIndex()]);
  }

  function commitGhost() {
    const g = state.ghost;
    if (!g) return;
    const bad = checks(g).find((c) => !c.t.ok);
    if (bad) {
      const verb = bad.dir === 'after' ? "can't follow" : "can't lead into";
      toast(`${entryName(g)} ${verb} ${entryName(bad.other)} under the current rules · untick that filter to force it`);
      return;
    }
    for (const e of state.progression) if (e.goto != null && e.goto >= state.cursor) e.goto += 1;
    state.progression.splice(state.cursor, 0, g);
    state.ghost = null;
    setCursor(state.cursor + 1);
    scrollToSlot();
  }

  function discardGhost() {
    if (!state.ghost) return;
    state.ghost = null;
    state.pickerIndex = null;
    refresh();
  }

  function scrollToSlot() {
    $('prog').querySelector('li.slot, li.ghost')?.scrollIntoView({ block: 'nearest' });
  }

  function flash(id) {
    const g = layers.nodes.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!g) return;
    g.classList.add('flash');
    setTimeout(() => g.classList.remove('flash'), 220);
  }

  // ---------- hover / tooltip ----------
  function onHover(id, ev) {
    state.hover = id;
    const tip = $('tooltip');
    layers.active.classList.toggle('has-hover', !!id);
    for (const p of layers.active.children) p.classList.toggle('hovered', p.dataset.node === id);
    if (!id) { tip.hidden = true; return; }
    const c = state.byId.get(id);
    const tones = ['root', 'third', 'fifth', 'seventh'].map((f) => c.tones[f].name).join(' ');
    let html = `<b>${c.name}</b><span class="roman">${c.roman}</span><br>${tones}<br><span class="role">${c.catLabel} · ${c.role}</span>`;
    for (const ch of checks({ id, slash: null })) {
      const other = entryName(ch.other);
      const tn = ch.dir === 'after' ? tensionOf(ch.other, { id }) : tensionOf({ id }, ch.other);
      html += ch.t.ok
        ? `<br><span class="ok">${ch.dir} ${other}: ${ch.t.reasons.join(' · ')}</span>`
        : `<br><span class="no">${ch.dir === 'after' ? "can't follow" : "can't lead into"} ${other}</span>`;
      html += `<br><span class="tens" style="--t: ${tensionColor(tn.score)}">${tensionLabel(tn.score)}</span>${tn.parts.length ? ' · ' + tn.parts.join(' · ') : ''}`;
    }
    tip.innerHTML = html;
    tip.hidden = false;
    moveTooltip(ev);
  }

  function moveTooltip(ev) {
    const tip = $('tooltip');
    if (tip.hidden || !ev) return;
    const wrap = $('map-wrap').getBoundingClientRect();
    let x = ev.clientX - wrap.left + 16, y = ev.clientY - wrap.top + 16;
    if (x + tip.offsetWidth > wrap.width - 8) x = ev.clientX - wrap.left - tip.offsetWidth - 12;
    if (y + tip.offsetHeight > wrap.height - 8) y = ev.clientY - wrap.top - tip.offsetHeight - 12;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- progression list ----------
  const FREE_LABEL = { fifth: null, root: null, ninth: '9th emerged', eleventh: '11th emerged' };

  // Cards for the chords, thin clickable gaps between them, and at the cursor
  // either the ghost card or an empty slot.
  function renderList() {
    const ol = $('prog');
    ol.innerHTML = '';
    const n = state.progression.length;
    $('empty-hint').hidden = n > 0;
    for (let i = 0; i <= n; i++) {
      if (i === state.cursor) ol.appendChild(state.ghost ? card(state.ghost, 'ghost') : slotItem());
      else ol.appendChild(gapItem(i));
      if (i < n) ol.appendChild(card(state.progression[i], i));
    }
  }

  function gapItem(i) {
    const li = document.createElement('li');
    li.className = 'gap';
    li.title = 'Insert here';
    li.innerHTML = '<span class="line"></span><span class="plus">+</span><span class="line"></span>';
    li.addEventListener('click', () => setCursor(i));
    return li;
  }

  function slotItem() {
    const li = document.createElement('li');
    li.className = 'slot';
    li.textContent = 'insert here · click a chord on the map to try it, double-click to add it';
    return li;
  }

  function card(e, i) {
    const isGhost = i === 'ghost';
    const c = state.byId.get(e.id);
    const seq = sequence();
    const si = isGhost ? ghostIndex() : seqIndex(i);
    const v = state.voicings[si];
    const li = document.createElement('li');
    li.className = `card cat-${c.cat}` + (isGhost ? ' ghost' : '');

    const upper = v.upper.map((m) => noteName(m, c)).join(' ');
    const tag = FREE_LABEL[v.free] ? `<span class="tag">${FREE_LABEL[v.free]}</span>` : '';
    const parts = [];
    let warn = false;
    if (isGhost) {
      for (const ch of checks(e)) {
        const tn = ch.dir === 'after' ? tensionOf(ch.other, e) : tensionOf(e, ch.other);
        if (ch.t.ok) parts.push(`${ch.dir} ${entryName(ch.other)}: ${ch.t.reasons.join(' · ')} ${tensionChip(tn)}`);
        else { parts.push(`${ch.dir === 'after' ? "can't follow" : "can't lead into"} ${entryName(ch.other)} ${tensionChip(tn)}`); warn = true; }
      }
      if (!parts.length) parts.push(si === 0 ? 'start' : 'unfiltered');
    } else if (si > 0) {
      const prevE = seq[si - 1].e;
      const t = transEntries(prevE, e);
      if (t.ok) parts.push(t.reasons.join(' · '));
      else { parts.push('does not satisfy the current rules'); warn = true; }
      parts.push(tensionChip(tensionOf(prevE, e)));
    } else parts.push('start');
    if (si > 0) parts.push(`moves ${v.movement} st`);

    const slashed = e.slash != null, topped = e.top != null;
    const topBadge = topped ? `<span class="topnote" title="Pinned top note">▲${spellPc(e.top, c).name}</span>` : '';
    const actions = isGhost
      ? `<button class="add" title="Add it here (Enter)">add</button><button class="rm" title="Discard (Esc)">×</button>`
      : `<button class="rm" title="Remove">×</button>`;
    li.innerHTML = `
      <div class="row1"><span class="idx">${isGhost ? '+' : i + 1}</span><span class="name">${entryName(e)}</span><span class="roman">${c.roman}</span>${topBadge}
        <button class="slash${slashed ? ' on' : ''}" title="Pin the bass to a note">/</button>
        <button class="top${topped ? ' on' : ''}" title="Pin the top note">▲</button>${actions}</div>
      <div class="row2"><span class="bass">${noteName(v.bass, c)}</span><span class="upper">${upper}</span>${tag}${v.home ? `<span class="home">→ ${v.home}</span>` : ''}</div>
      <div class="row3${warn ? ' warn' : ''}">${parts.join(' · ')}</div>`;
    li.appendChild(timingRow(e, i, isGhost));
    if (state.pickerIndex === i) li.appendChild(state.pickerKind === 'top' ? topPicker(e, c, i) : slashPicker(e, c, i));
    li.querySelector('.rm').addEventListener('click', (ev) => { ev.stopPropagation(); isGhost ? discardGhost() : removeAt(i); });
    li.querySelector('.add')?.addEventListener('click', (ev) => { ev.stopPropagation(); commitGhost(); });
    for (const kind of ['slash', 'top']) {
      li.querySelector('.' + kind).addEventListener('click', (ev) => {
        ev.stopPropagation();
        const open = state.pickerIndex === i && state.pickerKind === kind;
        state.pickerIndex = open ? null : i;
        state.pickerKind = open ? null : kind;
        renderList();
      });
    }
    li.addEventListener('click', () => { stopPlayAll(); Audio.playVoicing(v); pulse(li); });
    return li;
  }

  // Length (bars + fraction) and what happens after the chord.
  function timingRow(e, i, isGhost) {
    const row = document.createElement('div');
    row.className = 'row4';
    row.addEventListener('click', (ev) => ev.stopPropagation());
    const sel = (cls, options, value, onChange) => {
      const s = document.createElement('select');
      s.className = cls;
      for (const [v, label] of options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = label;
        s.appendChild(o);
      }
      s.value = value;
      s.addEventListener('change', () => onChange(s.value));
      row.appendChild(s);
      return s;
    };
    const label = (text) => { const sp = document.createElement('span'); sp.textContent = text; row.appendChild(sp); };
    const bars = Math.floor(e.len / Song.BAR), frac = e.len % Song.BAR;
    const setLen = (b, f) => {
      if (b >= Song.MAX_BARS) f = 0;
      if (b === 0 && f === 0) f = 3;
      e.len = b * Song.BAR + f;
      stopPlayAll();
      renderList();
    };
    label('length');
    sel('bars', [0, 1, 2, 3, 4].map((b) => [b, `${b} bar${b === 1 ? '' : 's'}`]), bars, (v) => setLen(Number(v), frac));
    label('+');
    const fracSel = sel('frac', Song.FRACTIONS.map((f) => [f.tw, f.label]), frac, (v) => setLen(bars, Number(v)));
    fracSel.disabled = bars >= Song.MAX_BARS;
    if (isGhost) return row;
    label('then');
    const targets = [['', 'next']];
    for (let k = 0; k < i; k++) targets.push([k, `back to #${k + 1}`]);
    sel('act', targets, e.goto ?? '', (v) => {
      e.goto = v === '' ? null : Number(v);
      if (e.goto == null) e.times = null;
      stopPlayAll();
      renderList();
    });
    if (e.goto != null) {
      sel('times', Song.TIMES.map((t) => [t ?? '', t == null ? '∞' : `×${t}`]), e.times ?? '', (v) => {
        e.times = v === '' ? null : Number(v);
        stopPlayAll();
      });
    }
    return row;
  }

  // Bass-note picker: chord tones first, then every other pitch class.
  function slashPicker(e, c, i) {
    const box = document.createElement('div');
    box.className = 'picker';
    box.addEventListener('click', (ev) => ev.stopPropagation());
    const chip = (label, pc, cls = '') => {
      const b = document.createElement('button');
      b.className = `chip ${cls}` + ((e.slash ?? null) === pc ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => setPin(i, 'slash', pc));
      return b;
    };
    const tonesRow = document.createElement('div');
    tonesRow.className = 'chips';
    tonesRow.appendChild(chip('root', null, 'tone'));
    for (const fn of ['third', 'fifth', 'seventh']) {
      const sp = c.tones[fn];
      tonesRow.appendChild(chip(`${sp.name} (${fn === 'third' ? '3' : fn === 'fifth' ? '5' : '7'})`, c.pcs[['third', 'fifth', 'seventh'].indexOf(fn) + 1], 'tone'));
    }
    const othersRow = document.createElement('div');
    othersRow.className = 'chips';
    for (let pc = 0; pc < 12; pc++) {
      if (c.pcs.includes(pc)) continue;
      othersRow.appendChild(chip(spellPc(pc, c).name, pc));
    }
    box.appendChild(tonesRow);
    box.appendChild(othersRow);
    return box;
  }

  // Top-note picker: only notes the upper voices may hold under Principle 2.
  const FN_SHORT = { third: '3', seventh: '7', fifth: '5', root: 'R', ninth: '9', eleventh: '11' };
  function topPicker(e, c, i) {
    const box = document.createElement('div');
    box.className = 'picker';
    box.addEventListener('click', (ev) => ev.stopPropagation());
    const row = document.createElement('div');
    row.className = 'chips';
    const chip = (label, pc) => {
      const b = document.createElement('button');
      b.className = 'chip tone' + ((e.top ?? null) === pc ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => setPin(i, 'top', pc));
      row.appendChild(b);
    };
    chip('free', null);
    const sus = c.quality === 'sus7';
    for (const { fn, pc } of Voicing.topChoices(c)) {
      chip(`${spellPc(pc, c).name} (${sus && fn === 'third' ? '4' : FN_SHORT[fn]})`, pc);
    }
    box.appendChild(row);
    return box;
  }

  // Pin the bass or top note of a progression entry or the ghost, then play it.
  function setPin(i, field, pc) {
    const target = i === 'ghost' ? state.ghost : state.progression[i];
    target[field] = pc;
    refresh();
    stopPlayAll();
    Audio.playVoicing(state.voicings[i === 'ghost' ? ghostIndex() : seqIndex(i)]);
  }

  function pulse(li) {
    li.classList.add('playing');
    setTimeout(() => li.classList.remove('playing'), 500);
  }

  function removeAt(i) {
    state.progression.splice(i, 1);
    for (const e of state.progression) {
      if (e.goto === i) { e.goto = null; e.times = null; }
      else if (e.goto != null && e.goto > i) e.goto -= 1;
    }
    if (state.cursor > i) state.cursor -= 1;
    state.pickerIndex = null;
    defaultFilters();
    refresh();
  }

  function clearAll() {
    stopPlayAll();
    Audio.stopAll();
    state.progression = [];
    state.ghost = null;
    state.pickerIndex = null;
    setCursor(0);
  }

  // ---------- player ----------
  // Plays the sequence (ghost included) at the tempo, following each chord's
  // length and action, until stopped. Audio is scheduled a little ahead on the
  // audio clock so the timing doesn't drift with the timers.
  const playing = () => state.playTimers.length > 0;

  function togglePlay() {
    if (playing()) stopPlayAll(); else startPlay();
  }

  function startPlay() {
    stopPlayAll();
    const seq = sequence();
    const n = seq.length;
    if (!n) return;
    const steps = seq.map(({ e, ghost }) => ({
      len: e.len, times: e.times,
      goto: ghost || e.goto == null ? null : seqIndex(e.goto),
    }));
    const items = [...$('prog').querySelectorAll('li.card')];
    const counts = new Array(n).fill(0);
    const secPerTwelfth = (60 / state.tempo) * 4 / Song.BAR;
    let i = 0;
    let next = Audio.now() + 0.05;
    const tick = () => {
      const now = Audio.now();
      while (next < now + LOOKAHEAD) {
        const at = i, dur = steps[i].len * secPerTwelfth;
        Audio.playVoicing(state.voicings[i], { when: next - now, dur });
        state.playTimers.push(setTimeout(() => {
          items.forEach((li, j) => li.classList.toggle('playing', j === at));
          items[at]?.scrollIntoView({ block: 'nearest' });
        }, Math.max(0, (next - now) * 1000)));
        next += dur;
        i = Song.advance(steps, i, counts, { unlimitedOnce: false });
        if (i >= n) { i = 0; counts.fill(0); }
      }
      state.playTimers.push(setTimeout(tick, 100));
    };
    $('play-all').textContent = '■ Stop';
    tick();
  }

  function stopPlayAll() {
    if (!playing()) return;
    for (const t of state.playTimers) clearTimeout(t);
    state.playTimers = [];
    Audio.stopAll();
    for (const li of $('prog').children) li.classList.remove('playing');
    $('play-all').textContent = '▶ Play';
  }

  // ---------- export / import ----------
  function songData() {
    return {
      key: key().name, tempo: state.tempo,
      chords: state.progression.map((e) => ({
        name: entryName(e), len: e.len, goto: e.goto, times: e.times,
        top: e.top == null ? null : spellPc(e.top, state.byId.get(e.id)).name,
      })),
    };
  }

  // Replace the progression with one read from text. Throws with a readable message.
  function importSong(text) {
    const song = Song.parse(text);
    let keyIdx = state.keyIdx;
    if (song.key) {
      keyIdx = Theory.KEYS.findIndex((k) => Song.norm(k.name) === Song.norm(song.key));
      if (keyIdx < 0) throw new Error(`Unknown key "${song.key}"`);
    }
    const k = Theory.KEYS[keyIdx];
    const palette = Theory.trim(Theory.buildPalette(k), state.rules).kept;
    const entries = song.chords.map((c) => {
      const [chordName, bassName] = c.name.split('/');
      const chord = palette.find((p) => [p.name, p.roman, p.id].some((x) => Song.norm(x) === Song.norm(chordName)));
      if (!chord) throw new Error(`Line ${c.line}: no chord "${chordName}" in ${k.name}`);
      const e = { ...newEntry(chord.id), len: c.len, goto: c.goto, times: c.times };
      if (bassName != null) {
        e.slash = Song.notePc(bassName);
        if (e.slash == null) throw new Error(`Line ${c.line}: can't read bass note "${bassName}"`);
        if (e.slash === chord.rootPc) e.slash = null;
      }
      if (c.top) {
        const pc = Song.notePc(c.top);
        if (pc == null || !Voicing.topChoices(chord).some((t) => t.pc === pc)) throw new Error(`Line ${c.line}: ${chord.name} can't have ${c.top} on top`);
        e.top = pc;
      }
      return e;
    });
    // everything resolved: now apply
    stopPlayAll();
    state.keyIdx = keyIdx;
    $('key-select').value = keyIdx;
    if (song.tempo) setTempo(song.tempo);
    state.progression = entries;
    state.ghost = null;
    state.pickerIndex = null;
    state.cursor = entries.length;
    defaultFilters();
    rebuild();
  }

  function setTempo(bpm) {
    state.tempo = Math.max(20, Math.min(300, Math.round(bpm) || 100));
    $('tempo').value = state.tempo;
  }

  function openIO() {
    $('io-text').value = Song.format(songData());
    $('io-msg').textContent = '';
    $('io').showModal();
  }

  function exportMidi() {
    if (!state.progression.length) { toast('Nothing to export yet'); return; }
    const items = state.progression.map((e) => ({ chord: state.byId.get(e.id), bassPc: e.slash, topPc: e.top }));
    const voicings = Voicing.voiceLead(items, key().pc);
    const order = Song.expand(state.progression.map((e) => ({ len: e.len, goto: e.goto, times: e.times })));
    const events = order.map((i) => {
      const v = voicings[i];
      return { notes: [v.bass, ...v.upper], len: state.progression[i].len };
    });
    const blob = new Blob([Song.midi(events, state.tempo)], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibe-chording-${key().name.replace('♭', 'b')}.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- controls ----------
  function initControls() {
    const sel = $('key-select');
    Theory.KEYS.forEach((k, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = k.name;
      sel.appendChild(o);
    });
    sel.value = state.keyIdx;
    sel.addEventListener('change', () => { state.keyIdx = Number(sel.value); rebuild(); });

    for (const input of document.querySelectorAll('[data-rule]')) {
      input.addEventListener('change', () => {
        const r = input.dataset.rule;
        state.rules[r] = input.type === 'checkbox' ? input.checked : Number(input.value);
        rebuild();
      });
    }

    $('f-prev').addEventListener('change', (ev) => { state.filterPrev = ev.target.checked; updateActive(); renderList(); });
    $('f-next').addEventListener('change', (ev) => { state.filterNext = ev.target.checked; updateActive(); renderList(); });

    $('play-all').addEventListener('click', togglePlay);
    $('tempo').value = state.tempo;
    $('tempo').addEventListener('change', () => { setTempo(Number($('tempo').value)); stopPlayAll(); });
    $('io-open').addEventListener('click', openIO);
    $('io-close').addEventListener('click', () => $('io').close());
    $('io-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('io-text').value); $('io-msg').textContent = 'Copied'; }
      catch (_) { $('io-text').select(); $('io-msg').textContent = 'Select and copy'; }
    });
    $('io-import').addEventListener('click', () => {
      try { importSong($('io-text').value); $('io').close(); }
      catch (err) { $('io-msg').textContent = err.message; }
    });
    $('midi').addEventListener('click', exportMidi);
    $('piano-clear').addEventListener('click', clearNotes);
    $('undo').addEventListener('click', () => { if (state.progression.length) removeAt(state.progression.length - 1); });
    $('clear').addEventListener('click', clearAll);

    document.addEventListener('keydown', (ev) => {
      if ($('io').open) return;
      const tag = ev.target.tagName;
      if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && ev.target.type !== 'checkbox')) return;
      if (ev.key === 'Enter' && state.ghost) { ev.preventDefault(); commitGhost(); }
      else if (ev.key === 'Escape' && state.ghost) discardGhost();
    });

    const legend = $('legend');
    for (const [cat, label] of Object.entries(Theory.CATEGORIES)) {
      legend.insertAdjacentHTML('beforeend', `<span><i style="--c: var(--${cat})"></i>${label}</span>`);
    }
    const stops = [];
    for (let i = 0; i < T_STEPS; i++) stops.push(`hsl(${tensionHue(i / (T_STEPS - 1)).toFixed(0)} 85% 58%)`);
    legend.insertAdjacentHTML('beforeend', `<span class="tension-key">adds tension<i class="grad" style="background: linear-gradient(90deg, ${stops.join(', ')})"></i>resolves</span>`);
  }

  initControls();
  rebuild();
})();
