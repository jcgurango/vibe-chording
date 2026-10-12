'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const NODE_R = 26;
  const STEP_SECONDS = 0.95;

  const state = {
    keyIdx: 0,
    rules: { ...Theory.DEFAULT_RULES },
    palette: [], byId: new Map(), trans: new Map(), trimmed: [], pos: new Map(),
    progression: [],   // [{ id, slash, top }] pitch classes pinned in the bass / on top, or null
    voicings: [],      // parallel to progression
    hover: null,
    playTimer: null,
    filter: new Map(),   // piano filter: pitch class -> 'in' (must have) | 'out' (must not have)
    pickerIndex: null,   // progression index whose picker is open
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
  const currentEntry = () => state.progression[state.progression.length - 1] ?? null;
  const current = () => currentEntry()?.id ?? null;
  const transOf = (a, b) => state.trans.get(a + '>' + b);
  const entryBass = (e) => e.slash ?? state.byId.get(e.id).rootPc;

  // Principle 3 between two progression entries, on their actual bass notes.
  function transEntries(a, b) {
    return Theory.transition(state.byId.get(a.id), state.byId.get(b.id), state.rules, entryBass(a), entryBass(b));
  }
  // May chord `id` (on its root) follow the current entry?
  function transFromCurrent(id) {
    const cur = currentEntry();
    return Theory.transition(state.byId.get(cur.id), state.byId.get(id), state.rules, entryBass(cur), state.byId.get(id).rootPc);
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
    revoice();
    renderPiano();
    renderMap();
    renderList();
    $('trim-note').textContent = trimmed.length
      ? `Trimmed (no diatonic entry or exit): ${trimmed.map((c) => c.name).join(', ')}`
      : 'Nothing trimmed under these rules.';
  }

  function revoice() {
    const items = state.progression.map((e) => ({ chord: state.byId.get(e.id), bassPc: e.slash, topPc: e.top }));
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
    marker('arrow-common', '#2ec4b6');
    marker('arrow-chromatic', '#c58cff');
    marker('arrow-root', '#ffb347');

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
      g.addEventListener('click', () => onPick(c.id));
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

  // Arrows out of the current chord, plus node states.
  function updateActive() {
    layers.active.innerHTML = '';
    const cur = current();
    const inProg = new Set(state.progression.map((e) => e.id));
    for (const g of layers.nodes.children) {
      const id = g.dataset.id;
      g.classList.toggle('current', id === cur);
      g.classList.toggle('in-prog', inProg.has(id));
      const legal = cur && id !== cur ? transFromCurrent(id).ok : false;
      g.classList.toggle('legal', !!legal);
      g.classList.toggle('blocked', !!cur && id !== cur && !legal);
      g.classList.toggle('filtered', !matchesFilter(state.byId.get(id)));
    }
    if (!cur) return;
    for (const c of state.palette) {
      if (c.id === cur) continue;
      const t = transFromCurrent(c.id);
      if (!t.ok) continue;
      svgEl('path', { d: edgePath(cur, c.id, 0.1), 'data-to': c.id, 'data-kind': t.kinds[0] }, layers.active);
    }
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

  // ---------- picking ----------
  function onPick(id) {
    const chord = state.byId.get(id);
    stopPlayAll();
    Audio.playPure(Theory.pureNotes(chord));
    flash(id);
    const cur = currentEntry();
    if (cur && !transFromCurrent(id).ok) {
      toast(`${chord.name} can't follow ${entryName(cur)} under the current rules`);
      return;
    }
    state.progression.push({ id, slash: null, top: null });
    revoice();
    updateActive();
    renderList();
    const list = $('prog');
    list.scrollTop = list.scrollHeight;
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
    for (const p of layers.active.children) p.classList.toggle('hovered', p.dataset.to === id);
    if (!id) { tip.hidden = true; return; }
    const c = state.byId.get(id);
    const tones = ['root', 'third', 'fifth', 'seventh'].map((f) => c.tones[f].name).join(' ');
    let html = `<b>${c.name}</b><span class="roman">${c.roman}</span><br>${tones}<br><span class="role">${c.catLabel} · ${c.role}</span>`;
    const cur = currentEntry();
    if (cur && cur.id !== id) {
      const t = transFromCurrent(id);
      const from = entryName(cur);
      html += t.ok
        ? `<br><span class="ok">after ${from}: ${t.reasons.join(' · ')}</span>`
        : `<br><span class="no">can't follow ${from}</span>`;
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
    toastTimer = setTimeout(() => { t.hidden = true; }, 2000);
  }

  // ---------- progression list ----------
  const FREE_LABEL = { fifth: null, root: null, ninth: '9th emerged', eleventh: '11th emerged' };

  function renderList() {
    const ol = $('prog');
    ol.innerHTML = '';
    $('empty-hint').hidden = state.progression.length > 0;
    state.progression.forEach((e, i) => {
      const c = state.byId.get(e.id);
      const v = state.voicings[i];
      const li = document.createElement('li');
      li.className = `cat-${c.cat}`;
      li.dataset.index = i;

      const upper = v.upper.map((m) => noteName(m, c)).join(' ');
      const tag = FREE_LABEL[v.free] ? `<span class="tag">${FREE_LABEL[v.free]}</span>` : '';
      let row3 = 'start';
      let warn = false;
      if (i > 0) {
        const t = transEntries(state.progression[i - 1], e);
        if (t.ok) row3 = t.reasons.join(' · ');
        else { row3 = 'does not satisfy the current rules'; warn = true; }
        row3 += ` · moves ${v.movement} st`;
      }
      const slashed = e.slash != null, topped = e.top != null;
      const topBadge = topped ? `<span class="topnote" title="Pinned top note">▲${spellPc(e.top, c).name}</span>` : '';
      li.innerHTML = `
        <div class="row1"><span class="idx">${i + 1}</span><span class="name">${entryName(e)}</span><span class="roman">${c.roman}</span>${topBadge}
          <button class="slash${slashed ? ' on' : ''}" title="Pin the bass to a note">/</button>
          <button class="top${topped ? ' on' : ''}" title="Pin the top note">▲</button>
          <button class="rm" title="Remove">×</button></div>
        <div class="row2"><span class="bass">${noteName(v.bass, c)} ${noteName(v.bass2, c)}</span><span class="upper">${upper}</span>${tag}${v.home ? `<span class="home">→ ${v.home}</span>` : ''}</div>
        <div class="row3${warn ? ' warn' : ''}">${row3}</div>`;
      if (state.pickerIndex === i) li.appendChild(state.pickerKind === 'top' ? topPicker(e, c, i) : slashPicker(e, c, i));
      li.querySelector('.rm').addEventListener('click', (ev) => { ev.stopPropagation(); removeAt(i); });
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
      ol.appendChild(li);
    });
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
      b.addEventListener('click', () => setSlash(i, pc));
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

  function setSlash(i, pc) { setPin(i, 'slash', pc); }
  function setTop(i, pc) { setPin(i, 'top', pc); }

  function setPin(i, field, pc) {
    state.progression[i][field] = pc;
    revoice();
    updateActive();
    renderList();
    stopPlayAll();
    Audio.playVoicing(state.voicings[i]);
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
      b.addEventListener('click', () => setTop(i, pc));
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

  function pulse(li) {
    li.classList.add('playing');
    setTimeout(() => li.classList.remove('playing'), 500);
  }

  function removeAt(i) {
    state.progression.splice(i, 1);
    state.pickerIndex = null;
    revoice();
    updateActive();
    renderList();
  }

  function playAll() {
    stopPlayAll();
    if (!state.progression.length) return;
    Audio.ensure();
    const items = [...$('prog').children];
    state.voicings.forEach((v, i) => {
      Audio.playVoicing(v, { when: i * STEP_SECONDS, dur: STEP_SECONDS + 0.5 });
    });
    let i = 0;
    const tick = () => {
      items.forEach((li, j) => li.classList.toggle('playing', j === i));
      items[i]?.scrollIntoView({ block: 'nearest' });
      i += 1;
      if (i < items.length) state.playTimer = setTimeout(tick, STEP_SECONDS * 1000);
      else state.playTimer = setTimeout(() => items.forEach((li) => li.classList.remove('playing')), STEP_SECONDS * 1000);
    };
    tick();
  }

  function stopPlayAll() {
    clearTimeout(state.playTimer);
    state.playTimer = null;
    for (const li of $('prog').children) li.classList.remove('playing');
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

    $('play-all').addEventListener('click', playAll);
    $('piano-clear').addEventListener('click', clearNotes);
    $('undo').addEventListener('click', () => { if (state.progression.length) removeAt(state.progression.length - 1); });
    $('clear').addEventListener('click', () => { stopPlayAll(); Audio.stopAll(); state.progression = []; state.pickerIndex = null; revoice(); updateActive(); renderList(); });

    const legend = $('legend');
    for (const [cat, label] of Object.entries(Theory.CATEGORIES)) {
      legend.insertAdjacentHTML('beforeend', `<span><i style="--c: var(--${cat})"></i>${label}</span>`);
    }
    for (const [kind, label] of [['common', 'common tones'], ['chromatic', 'chromatic'], ['root', 'root motion']]) {
      legend.insertAdjacentHTML('beforeend', `<span><i class="edge" style="--c: var(--${kind})"></i>${label}</span>`);
    }
  }

  initControls();
  rebuild();
})();
