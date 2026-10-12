// app.js — state, the focused gap, candidate computation, the space model, the panel, the loop bar.
//
// The sequence is open-ended. A "focus" says which gap is being worked on:
//   { kind: 'end' }      after the last chord: where could it lead, and by way of what?
//   { kind: 'gap', i }   between seq[i] and seq[i+1]; i = n-1 is the wrap back to the first chord,
//                        which is one option among the gaps, not an obligation.

import { KEYS, buildPalette, ROWS, fifthsIndex, movesInto, pitchName, MOVE_TYPES, makeChord, mod } from './theory.js';
import { voiceAll, voiceNext } from './voicing.js';
import { scoreChord, scoreMove, DIM_LABELS, weightsFor } from './scoring.js';
import { playVoicing, playVoicings } from './audio.js';
import { Space, NODE_W, NODE_H } from './space.js';

const COL_W = 200, ROW_H = 190, X0 = 200, Y0 = 160;
const ROW_ORDER = ['sharp', 'diatonic', 'minor', 'modes'];
const PANEL_ORDER = ['diatonic', 'minor', 'modes', 'sharp'];
const MAX_EDGES = 8, VIA_CANDS = 5, VIA_PILLS = 2, MAX_PILLS = 8, BETWEEN_CANDS = 5;

const state = {
  home: 0,
  dial: -0.5,
  seq: [],                 // instances: { chord, skeletalId?, move?, label, voicing }
  focus: { kind: 'end' },
  hover: null,             // { kind: 'skeletal', id } | { kind: 'move', idx } | null
  palette: [], byKey: new Map(), byId: new Map(),
  cands: null,
};

const $ = sel => document.querySelector(sel);
const svg = $('#space');
const space = new Space(svg, {
  onNodeClick: (n, e) => onNodeClick(n, e),
  onNodeHover: n => setHover(n && n.kind === 'skeletal' ? { kind: 'skeletal', id: n.id } : null),
  onPillClick: (pill, e) => onPillClick(pill, e),
  onPillHover: pill => (pill ? showWhyForPill(pill) : renderWhyForHover()),
  onGapClick: i => setFocus({ kind: 'gap', i }),
});

// ---------- palette & layout ----------
function rebuildPalette() {
  state.palette = buildPalette(state.home);
  state.byKey = new Map(state.palette.map(p => [p.chord.key, p]));
  state.byId = new Map(state.palette.map(p => [p.id, p]));
}
function colFor(pc) { return 6 - fifthsIndex(pc, state.home); }
function posFor(p) { return { x: X0 + colFor(p.chord.root) * COL_W, y: Y0 + ROW_ORDER.indexOf(p.row) * ROW_H }; }
function skeletalIdFor(ch) { const p = state.byKey.get(ch.key); return p ? p.id : undefined; }

function renderGrid() {
  const rows = ROW_ORDER.map((r, i) => ({ label: ROWS[r].label, sub: ROWS[r].sub, y: Y0 + i * ROW_H, h: ROW_H - 16 }));
  const items = [];
  for (let col = 0; col < 12; col++) {
    const f = 6 - col;
    const pc = mod(state.home + [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5][mod(f, 12)], 12);
    items.push({ x: X0 + col * COL_W, label: makeChord(pc, 'maj7', state.home).name.replace('maj7', ''), home: f === 0 });
  }
  space.renderGrid(rows, { x0: X0 - NODE_W / 2, width: 11 * COL_W + NODE_W, y0: Y0 - ROW_H / 2 + 8, items });
}

// ---------- the focused gap ----------
function gapEnds(focus = state.focus) {
  const n = state.seq.length;
  if (!n) return null;
  if (focus.kind === 'end' || focus.i >= n) return { kind: 'end', left: state.seq[n - 1], right: null, i: n - 1, before: state.seq };
  const i = focus.i, j = (i + 1) % n;
  return { kind: 'gap', wrap: j === 0, left: state.seq[i], right: state.seq[j], i, j, before: state.seq.slice(0, i + 1) };
}
function prevGapMoveType(before) {
  for (let k = before.length - 1; k >= 0; k--) if (before[k].move) return before[k].move.type;
  return null;
}

function revoice() {
  const vs = voiceAll(state.seq.map(i => i.chord));
  state.seq.forEach((inst, k) => { inst.voicing = vs[k]; });
}

function computeCandidates() {
  const g = gapEnds();
  if (!g) { state.cands = null; return; }
  const ctx = { home: state.home, left: g.left, right: g.right, before: g.before, dial: state.dial, prevGapMoveType: prevGapMoveType(g.before), skeletalIdFor };
  const skeletal = state.palette.map(p => ({ p, score: scoreChord({ chord: p.chord, skeletalId: p.id }, ctx) })).sort((a, b) => b.score.total - a.score.total);
  const moves = g.right
    ? movesInto(g.right.chord, g.left.chord, state.home, state.palette).map(move => ({ move, score: scoreMove(move, ctx) })).sort((a, b) => b.score.total - a.score.total)
    : [];
  moves.forEach((m, idx) => { m.idx = idx; });
  const viaCache = new Map();
  const via = id => {
    if (!viaCache.has(id)) {
      const p = state.byId.get(id);
      viaCache.set(id, movesInto(p.chord, g.left.chord, state.home, state.palette));
    }
    return viaCache.get(id);
  };
  state.cands = { ...g, skeletal, moves, byId: new Map(skeletal.map(s => [s.p.id, s])), via };
}

function commit() {
  revoice();
  if (state.focus.kind === 'gap' && state.focus.i >= state.seq.length - 1 && !(state.seq.length && state.focus.i === state.seq.length - 1)) state.focus = { kind: 'end' };
  if (!state.seq.length) state.focus = { kind: 'end' };
  computeCandidates();
  state.hover = null;
  renderAll();
}
function setFocus(f) {
  state.focus = f;
  computeCandidates();
  state.hover = null;
  renderAll();
}

// ---------- editing the sequence ----------
function insertionPoint() { const g = gapEnds(); return g ? g.i + 1 : 0; }
function addSkeletal(p) {
  const at = insertionPoint();
  const g = gapEnds();
  state.seq.splice(at, 0, { chord: p.chord, skeletalId: p.id, label: p.id });
  if (g && g.kind === 'gap') state.focus = { kind: 'gap', i: at }; // keep working between the new chord and its right neighbor
  commit();
  playVoicings(g && g.kind === 'gap' ? [state.seq[at].voicing, state.seq[(at + 1) % state.seq.length].voicing] : [state.seq[at].voicing]);
}
function addMove(move, landingP) {
  const at = insertionPoint();
  const g = gapEnds();
  const insts = move.chords.map((ch, i) => ({
    chord: ch, skeletalId: skeletalIdFor(ch), label: move.labels[i],
    move: { type: move.type, name: move.name, strength: move.strength, landingKey: move.landingKey, landing: move.landing },
  }));
  if (landingP) insts.push({ chord: landingP.chord, skeletalId: landingP.id, label: landingP.id });
  state.seq.splice(at, 0, ...insts);
  if (g && g.kind === 'gap') state.focus = landingP ? { kind: 'gap', i: at + insts.length - 1 } : { kind: 'end' };
  commit();
  const played = state.seq.slice(at, at + insts.length).map(x => x.voicing);
  if (g && g.kind === 'gap' && !landingP) played.push(state.seq[(at + insts.length) % state.seq.length].voicing);
  playVoicings(played);
}
function removeAt(i) {
  state.seq.splice(i, 1);
  if (state.focus.kind === 'gap' && state.focus.i >= state.seq.length - 1) state.focus = { kind: 'end' };
  commit();
}
function clearSeq() { state.seq = []; state.focus = { kind: 'end' }; commit(); }

function previewChords(chords) {
  const g = gapEnds();
  let prev = g ? g.left.voicing : null;
  const vs = chords.map(ch => (prev = voiceNext(ch, prev)));
  playVoicings(vs);
}

// ---------- interactions ----------
function onNodeClick(n, e) {
  if (n.kind === 'seqmove') { playVoicing(state.seq[n.seqIndex].voicing); return; }
  const p = state.byId.get(n.id);
  if (!p) return;
  if (e.shiftKey || e.altKey) { previewChords([p.chord]); return; }
  addSkeletal(p);
}
function onPillClick(pill, e) {
  if (e.shiftKey || e.altKey) { previewChords(pill.landingP ? [...pill.move.chords, pill.landingP.chord] : pill.move.chords); return; }
  addMove(pill.move, pill.landingP || null);
}
function setHover(h) {
  const same = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.id === b.id && a.idx === b.idx);
  if (same(state.hover, h)) return;
  state.hover = h;
  renderHover();
}

// ---------- positions of the chords in the sequence ----------
function sequencePositions() {
  const n = state.seq.length;
  const pos = new Array(n);
  for (let i = 0; i < n; i++) { const p = state.seq[i].skeletalId && state.byId.get(state.seq[i].skeletalId); if (p) pos[i] = { ...posFor(p), size: { w: NODE_W, h: NODE_H } }; }
  const homeP = state.byId.get('Imaj7');
  for (let i = 0; i < n; i++) {
    if (pos[i]) continue;
    let a = i; for (let k = 1; k <= n; k++) { const j = mod(i - k, n); if (pos[j] && state.seq[j].skeletalId) { a = j; break; } }
    let b = i; for (let k = 1; k <= n; k++) { const j = mod(i + k, n); if (pos[j] && state.seq[j].skeletalId) { b = j; break; } }
    const A = pos[a] && state.seq[a].skeletalId ? pos[a] : { ...posFor(homeP) };
    const B = pos[b] && state.seq[b].skeletalId ? pos[b] : A;
    const runLen = mod(b - a, n) - 1 || n;
    const k = mod(i - a, n);
    const t = k / (runLen + 1);
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d < 1) {
      const spread = (k - (runLen + 1) / 2) * 90;
      pos[i] = { x: A.x + spread, y: A.y - 120, size: { w: 92, h: 46 } };
    } else {
      const nx = -dy / d, ny = dx / d;
      pos[i] = { x: A.x + dx * t + nx * 52, y: A.y + dy * t + ny * 52, size: { w: 92, h: 46 } };
    }
  }
  return pos;
}

function pillFor(move, landingP, score) {
  const text = move.chords.map(c => c.name).join(' ');
  const title = `${move.name} · strength ${move.strength.toFixed(1)}\n${move.labels.join(', ')}` + (landingP ? `\nthen ${landingP.chord.name}` : '') + (score ? `\nscore ${(score.total * 100).toFixed(0)}` : '');
  return { id: `${move.type}:${text}`, text, type: move.type, typeName: move.name, strength: move.strength, title, move, landingP, score };
}

// ---------- the model for the space ----------
function buildModel() {
  const { seq, cands, palette } = state;
  const nodes = [], edges = [], halos = [];
  const seqIdxById = new Map();
  seq.forEach((inst, i) => { if (inst.skeletalId) { if (!seqIdxById.has(inst.skeletalId)) seqIdxById.set(inst.skeletalId, []); seqIdxById.get(inst.skeletalId).push(i + 1); } });
  const hv = state.hover && state.hover.kind === 'skeletal' ? state.hover.id : null;

  for (const p of palette) {
    const pos = posFor(p);
    const c = cands ? cands.byId.get(p.id) : null;
    const cls = [];
    if (!cands && p.start) cls.push('start');
    if (seqIdxById.has(p.id)) cls.push('in-seq');
    if (cands && cands.left.skeletalId === p.id) cls.push('anchor-left');
    if (cands && cands.right && cands.right.skeletalId === p.id) cls.push('anchor-right');
    if (hv === p.id) cls.push('hover');
    const title = `${p.chord.name} (${p.id})\n${p.fit}` + (c ? `\nscore ${(c.score.total * 100).toFixed(0)}` : '');
    nodes.push({ id: p.id, kind: 'skeletal', x: pos.x, y: pos.y, name: p.chord.name, numeral: p.id, row: p.row, cls, score: c ? c.score.total : null, tension: p.tension, seqIdx: seqIdxById.get(p.id), title });
  }
  if (!seq.length) return { nodes, edges, halos };

  const pos = sequencePositions();
  const n = seq.length;
  seq.forEach((inst, i) => {
    if (inst.skeletalId) return;
    const cls = ['in-seq'];
    if (cands.left === inst) cls.push('anchor-left');
    if (cands.right === inst) cls.push('anchor-right');
    nodes.push({ id: `seq-${i}`, kind: 'seqmove', seqIndex: i, small: true, x: pos[i].x, y: pos[i].y, name: inst.chord.name, sub: inst.label, row: 'move', cls, seqIdx: [i + 1], title: `${inst.chord.name} · ${inst.label}` });
  });

  // the sequence's own path; every edge is a gap you can click on; the wrap is dashed
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, wrap = j === 0;
    const a = pos[i], b = pos[j];
    const loop = Math.hypot(a.x - b.x, a.y - b.y) < 1;
    const sel = cands.kind === 'gap' && cands.i === i;
    if (wrap && n === 1 && !sel) continue;
    edges.push({ from: a, to: b, fromSize: a.size, toSize: b.size, cls: wrap ? 'seq seq-wrap' : 'seq', marker: 'seq', bend: 0.12, loop, gap: i, sel, label: wrap && n > 1 ? '↻' : undefined });
  }
  const leftPos = pos[cands.i];

  if (cands.kind === 'end') {
    // where could the last chord lead, and by way of which moves?
    const top = cands.skeletal.filter(c => c.p.id !== cands.left.skeletalId).slice(0, MAX_EDGES);
    const shown = new Set(top.map(c => c.p.id));
    for (const c of top) {
      edges.push({ from: leftPos, to: posFor(c.p), fromSize: leftPos.size, cls: 'cand' + (hv === c.p.id ? ' hover' : ''), marker: 'cand', weight: c.score.total, bend: 0.15 });
    }
    if (hv && !shown.has(hv) && hv !== cands.left.skeletalId) {
      const c = cands.byId.get(hv);
      edges.push({ from: leftPos, to: posFor(c.p), fromSize: leftPos.size, cls: 'cand hover', marker: 'cand', weight: c.score.total, bend: 0.15 });
    }
    const viaFor = hv ? (hv !== cands.left.skeletalId ? [cands.byId.get(hv)] : []) : top.slice(0, VIA_CANDS);
    for (const c of viaFor) {
      const moves = cands.via(c.p.id).slice(0, hv ? MAX_PILLS : VIA_PILLS);
      halos.push({ landing: posFor(c.p), jumpoff: leftPos, pills: moves.map(m => pillFor(m, c.p, null)) });
    }
  } else {
    // between two chords: moves into the right chord, and chords that could sit between
    const rightPos = pos[cands.j];
    const leftKey = cands.left.chord.key, rightKey = cands.right.chord.key;
    const between = cands.skeletal.filter(c => c.p.chord.key !== leftKey && c.p.chord.key !== rightKey).slice(0, BETWEEN_CANDS);
    const shown = new Set(between.map(c => c.p.id));
    const drawVia = c => {
      const to = posFor(c.p);
      const isHv = hv === c.p.id;
      edges.push({ from: leftPos, to, fromSize: leftPos.size, cls: 'cand' + (isHv ? ' hover' : ''), marker: 'cand', weight: c.score.total, bend: 0.15 });
      const loop = Math.hypot(to.x - rightPos.x, to.y - rightPos.y) < 1;
      edges.push({ from: to, to: rightPos, toSize: rightPos.size, cls: 'return' + (isHv ? ' hover' : ''), marker: 'return', weight: c.score.dims.right, bend: -0.15, loop, label: isHv && !loop ? `→ ${cands.right.chord.name}` : undefined });
    };
    for (const c of between) drawVia(c);
    if (hv && !shown.has(hv) && hv !== cands.left.skeletalId) drawVia(cands.byId.get(hv));
    if (hv && hv !== cands.left.skeletalId) {
      const c = cands.byId.get(hv);
      halos.push({ landing: posFor(c.p), jumpoff: leftPos, pills: cands.via(hv).slice(0, MAX_PILLS).map(m => pillFor(m, c.p, null)) });
    } else {
      halos.push({ landing: rightPos, jumpoff: leftPos, pills: cands.moves.slice(0, MAX_PILLS).map(c => ({ ...pillFor(c.move, null, c.score), cls: 'closing', idx: c.idx })) });
    }
  }
  return { nodes, edges, halos };
}

// ---------- rendering ----------
function renderAll() {
  const model = buildModel();
  svg.classList.toggle('empty', !state.seq.length);
  space.renderNodes(model.nodes);
  space.renderEdges(model.edges);
  space.renderHalos(model.halos);
  renderPanel();
  renderSeqBar();
  renderWhy(null);
}
function renderHover() {
  const model = buildModel();
  for (const n of model.nodes) {
    const elx = svg.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`);
    if (elx) elx.classList.toggle('hover', n.cls.includes('hover'));
  }
  space.renderEdges(model.edges);
  space.renderHalos(model.halos);
  document.querySelectorAll('.cand-item').forEach(b => b.classList.toggle('hover', !!state.hover && b.dataset.kind === state.hover.kind && (b.dataset.id === state.hover.id || (state.hover.idx != null && Number(b.dataset.idx) === state.hover.idx))));
  renderWhyForHover();
}
function renderWhyForHover() {
  const h = state.hover;
  if (h && h.kind === 'skeletal' && state.cands) renderWhy(state.cands.byId.get(h.id));
  else if (h && h.kind === 'move' && state.cands) { const c = state.cands.moves[h.idx]; if (c) showWhyForPill(pillFor(c.move, null, c.score)); }
  else renderWhy(null);
}

function noteList(v, chord) {
  const b = pitchName(v.bass, chord), ups = v.upper.map(n => pitchName(n, chord));
  return `<span class="bass">${b.name}<sub>${b.octave}</sub></span> <span class="sep">|</span> ${ups.map(u => `${u.name}<sub>${u.octave}</sub>`).join(' ')}`;
}
function dimsHtml(score) {
  const w = weightsFor('right' in score.dims);
  return `<div class="dims">${Object.keys(w).map(k => {
    const v = score.dims[k];
    const note = score.notes && score.notes[k] ? ` <em>${score.notes[k]}</em>` : '';
    return `<div class="dim"><span class="dim-label">${DIM_LABELS[k]} <small>×${w[k]}</small>${note}</span><span class="dim-bar"><i style="width:${(v * 100).toFixed(0)}%"></i></span><span class="dim-val">${v.toFixed(2)}</span></div>`;
  }).join('')}</div>`;
}
function renderWhy(c) {
  const box = $('#why');
  if (!state.seq.length) { box.innerHTML = `<p class="muted">Once there is a chord, hover any chord or move here to see why it fits.</p>`; return; }
  if (!c) { box.innerHTML = `<p class="muted">Hover a chord or a move to see how it scores for this gap.</p>`; return; }
  const p = c.p, s = c.score;
  box.innerHTML = `
    <div class="why-head"><b>${p.chord.name}</b> <span class="numeral">${p.id}</span> <span class="score">${(s.total * 100).toFixed(0)}</span></div>
    <p class="fit">${p.fit}</p>
    <p class="meta">Tension ${s.level} · ${s.outside} note${s.outside === 1 ? '' : 's'} outside home · voiced ${noteList(s.voicing, p.chord)}</p>
    ${dimsHtml(s)}`;
}
function showWhyForPill(pill) {
  const m = pill.move;
  const box = $('#why');
  const chords = m.chords.map((c, i) => `<b>${c.name}</b> <span class="numeral">${c.numeral}</span> <small>${m.labels[i]}</small>`).join('<br>');
  const landingScore = pill.landingP && state.cands ? state.cands.byId.get(pill.landingP.id) : null;
  box.innerHTML = `
    <div class="why-head"><b>${m.name}</b> <span class="numeral">into ${m.landing.name}</span> <span class="score">${pill.score ? (pill.score.total * 100).toFixed(0) : 'strength ' + m.strength.toFixed(1)}</span></div>
    <p class="fit">${MOVE_TYPES[m.type].blurb} Strength ${m.strength.toFixed(1)}.</p>
    <p class="meta">${chords}${pill.landingP ? `<br>then <b>${pill.landingP.chord.name}</b> <span class="numeral">${pill.landingP.id}</span>${landingScore ? ` <small>scores ${(landingScore.score.total * 100).toFixed(0)} here</small>` : ''}` : ''}</p>
    ${pill.score ? dimsHtml(pill.score) : ''}`;
}

function renderPanel() {
  const status = $('#status');
  const { seq, cands } = state;
  if (!seq.length) {
    status.innerHTML = `<p>Pick a chord to start. The usual starting places are lit: <b>ii7</b>, <b>IVmaj7</b>, <b>vi7</b> and <b>Imaj7</b>.</p>`;
  } else if (cands.kind === 'end') {
    status.innerHTML = `<p>Where could <b>${cands.left.chord.name}</b> lead? Pick the next chord, or go there by way of a move. Click a gap in the loop bar or on a path to work between two chords.</p>`;
  } else {
    status.innerHTML = `<p>Between <b>${cands.left.chord.name}</b> and <b>${cands.right.chord.name}</b>${cands.wrap ? ' (the wrap back to the start)' : ''}: moves into ${cands.right.chord.name}, or a chord that sits between. <button class="link" id="focus-end">Back to the end</button></p>`;
    $('#focus-end').addEventListener('click', () => setFocus({ kind: 'end' }));
  }
  const list = $('#cands');
  if (!cands) {
    list.innerHTML = PANEL_ORDER.map(r => groupHtml(ROWS[r].label, state.palette.filter(p => p.row === r).map(p => itemHtml({ kind: 'skeletal', id: p.id, name: p.chord.name, numeral: p.id, score: null, start: p.start, tension: p.tension, title: p.fit })))).join('');
  } else {
    const groups = PANEL_ORDER.map(r => {
      const items = cands.skeletal.filter(c => c.p.row === r);
      return groupHtml(ROWS[r].label, items.map(c => itemHtml({
        kind: 'skeletal', id: c.p.id, name: c.p.chord.name, numeral: c.p.id, score: c.score.total, tension: c.p.tension, title: c.p.fit,
        via: c.p.id === cands.left.skeletalId ? [] : cands.via(c.p.id).slice(0, 3),
      })));
    });
    if (cands.kind === 'gap') {
      groups.unshift(groupHtml(`Moves into ${cands.right.chord.name}`, cands.moves.map(c => itemHtml({ kind: 'move', idx: c.idx, name: c.move.chords.map(x => x.name).join(' '), numeral: c.move.name, score: c.score.total, tension: c.score.level, title: c.move.labels.join(', ') })), 'closing'));
    }
    list.innerHTML = groups.join('');
  }
  list.querySelectorAll('.cand-item').forEach(b => {
    const kind = b.dataset.kind;
    b.addEventListener('click', e => {
      if (e.target.closest('.chip')) return;
      if (kind === 'skeletal') { const p = state.byId.get(b.dataset.id); if (e.shiftKey || e.altKey) previewChords([p.chord]); else addSkeletal(p); }
      else { const c = state.cands.moves[Number(b.dataset.idx)]; if (e.shiftKey || e.altKey) previewChords(c.move.chords); else addMove(c.move, null); }
    });
    b.addEventListener('pointerenter', () => setHover(kind === 'skeletal' ? { kind, id: b.dataset.id } : { kind, idx: Number(b.dataset.idx) }));
    b.addEventListener('pointerleave', () => setHover(null));
    b.querySelectorAll('.chip').forEach(chip => {
      const p = state.byId.get(b.dataset.id);
      const move = state.cands.via(p.id)[Number(chip.dataset.m)];
      chip.addEventListener('click', e => { e.stopPropagation(); if (e.shiftKey || e.altKey) previewChords([...move.chords, p.chord]); else addMove(move, p); });
      chip.addEventListener('pointerenter', e => { e.stopPropagation(); showWhyForPill(pillFor(move, p, null)); });
      chip.addEventListener('pointerleave', () => renderWhyForHover());
    });
  });
}
function groupHtml(label, items, cls = '') {
  return `<section class="group ${cls}"><h3>${label}</h3><div class="items">${items.join('')}</div></section>`;
}
function itemHtml(it) {
  const dots = `<span class="dots">${[0, 1, 2].map(i => `<i class="${i < (it.tension || 0) ? 'on' : ''}"></i>`).join('')}</span>`;
  const via = it.via && it.via.length ? `<div class="via-row"><span class="via-label">by way of</span>${it.via.map((m, k) => `<button class="chip type-${m.type}" data-m="${k}" title="${m.name} · strength ${m.strength.toFixed(1)}">${m.chords.map(c => c.name).join(' ')}</button>`).join('')}</div>` : '';
  // a div, not a button: the chips inside are buttons and buttons cannot nest
  return `<div class="cand-item ${it.start ? 'start' : ''}" role="button" tabindex="0" data-kind="${it.kind}" ${it.id ? `data-id="${it.id}"` : ''} ${it.idx != null ? `data-idx="${it.idx}"` : ''} title="${(it.title || '').replace(/"/g, '&quot;')}" ${it.score != null ? `style="--score:${it.score}"` : ''}>
    <span class="ci-name">${it.name}</span><span class="ci-numeral">${it.numeral}</span>${dots}
    ${it.score != null ? `<span class="ci-bar"><i style="width:${(it.score * 100).toFixed(0)}%"></i></span><span class="ci-score">${(it.score * 100).toFixed(0)}</span>` : '<span></span><span></span>'}
    ${via}
  </div>`;
}

function renderSeqBar() {
  const wrap = $('#seq-cards');
  const { seq, focus } = state;
  if (!seq.length) { wrap.innerHTML = `<div class="seq-empty">Your sequence will appear here with each chord's name and its voiced notes.</div>`; return; }
  const n = seq.length;
  const isSel = i => focus.kind === 'gap' && focus.i === i;
  const gapBtn = (i, cls, text, title) => `<button class="gap ${cls} ${isSel(i) ? 'sel' : ''}" data-gap="${i}" title="${title}">${text}</button>`;
  let html = '';
  seq.forEach((inst, i) => {
    html += `
    <div class="card ${inst.move ? 'is-move' : ''}" data-i="${i}" title="Click to hear it">
      <div class="card-label">${inst.label}${inst.move ? ` <span class="card-alt">· ${inst.chord.numeral}</span>` : ''}</div>
      <div class="card-name">${inst.chord.name}</div>
      <div class="card-notes">${noteList(inst.voicing, inst.chord)}</div>
      <button class="card-x" title="Remove">×</button>
    </div>`;
    if (i < n - 1) html += gapBtn(i, '', '<span class="gap-arrow">→</span><span class="gap-plus">+</span>', 'Work on what goes between these two');
  });
  html += `<button class="gap end ${focus.kind === 'end' ? 'sel' : ''}" data-gap="end" title="Keep going from the last chord">→ ?</button>`;
  html += gapBtn(n - 1, 'wrap', `↻ ${seq[0].chord.name}`, 'Work on the wrap back to the first chord');
  wrap.innerHTML = html;
  wrap.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('card-x')) { removeAt(Number(card.dataset.i)); return; }
      playVoicing(seq[Number(card.dataset.i)].voicing);
    });
  });
  wrap.querySelectorAll('.gap').forEach(b => b.addEventListener('click', () => setFocus(b.dataset.gap === 'end' ? { kind: 'end' } : { kind: 'gap', i: Number(b.dataset.gap) })));
}

// ---------- key & dial ----------
function setHome(pc) {
  const delta = pc - state.home;
  state.home = pc;
  rebuildPalette();
  state.seq = state.seq.map(inst => {
    const chord = makeChord(inst.chord.root + delta, inst.chord.quality, pc, { sharp: inst.chord.forceSharp });
    let move, label = inst.label;
    if (inst.move) {
      const landing = makeChord(inst.move.landing.root + delta, inst.move.landing.quality, pc);
      move = { ...inst.move, landing, landingKey: landing.key };
      label = inst.label.replace(inst.move.landing.name, landing.name);
    }
    return { chord, skeletalId: skeletalIdFor(chord), move, label };
  });
  renderGrid();
  commit();
}

function visibleRegion() {
  const panel = $('#panel').getBoundingClientRect();
  const bar = $('#seqbar').getBoundingClientRect();
  return { left: 0, top: 0, width: panel.left, height: bar.top };
}

function init() {
  const sel = $('#key');
  sel.innerHTML = KEYS.map(k => `<option value="${k.pc}">${k.name} major</option>`).join('');
  sel.value = String(state.home);
  sel.addEventListener('change', () => setHome(Number(sel.value)));
  const dial = $('#dial');
  dial.value = String(state.dial);
  dial.addEventListener('input', () => { state.dial = Number(dial.value); computeCandidates(); renderAll(); });
  $('#undo').addEventListener('click', () => { if (state.seq.length) removeAt(state.seq.length - 1); });
  $('#clear').addEventListener('click', clearSeq);
  $('#recenter').addEventListener('click', () => { const h = posFor(state.byId.get('Imaj7')); space.centerOn(h.x, h.y, visibleRegion()); });
  $('#zoom-in').addEventListener('click', () => { const r = visibleRegion(); space.zoomBy(1.2, r.width / 2, r.height / 2); });
  $('#zoom-out').addEventListener('click', () => { const r = visibleRegion(); space.zoomBy(1 / 1.2, r.width / 2, r.height / 2); });
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'Backspace') { e.preventDefault(); if (state.seq.length) removeAt(state.seq.length - 1); }
    if (e.key === 'Escape') setFocus({ kind: 'end' });
  });

  rebuildPalette();
  renderGrid();
  commit();
  const h = posFor(state.byId.get('Imaj7'));
  space.view.s = 0.85;
  space.centerOn(h.x, h.y + 40, visibleRegion());
}

init();
