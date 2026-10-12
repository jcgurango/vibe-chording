// Prints the repertoire bench as a table. Run with: npm run bench
import { benchAll, summarize } from '../src/bench/bench';

const dial = Number(process.argv[2] ?? -0.5);
const results = benchAll({ homeDial: dial });
const pad = (s: string | number, n: number) => String(s).padEnd(n);
let last = '';
for (const r of results) {
  if (r.example !== last) { console.log(`\n${r.example}`); last = r.example; }
  const cr = r.chordRank === null ? '  —' : String(r.chordRank).padStart(3);
  const mr = r.via === 'bare' ? '      ' : (r.moveRank === null ? '  —' : String(r.moveRank).padStart(3)) + '/' + String(r.moveOf).padStart(2);
  console.log(`  ${pad(r.from, 9)} → ${pad(r.to, 8)} ${pad(r.via, 28)} chord ${cr}/${r.chordOf}  move ${mr}   top chord: ${pad(r.topChord, 9)} top move: ${r.topMove}`);
}
const s = summarize(results);
console.log(`\nhome dial ${dial}: ${s.ranked}/${s.gaps} gaps ranked`);
console.log(`chord rank  mean ${s.chordMean.toFixed(2)}  top3 ${(s.chordTop3 * 100).toFixed(0)}%  top5 ${(s.chordTop5 * 100).toFixed(0)}%`);
console.log(`move rank   mean ${s.moveMean.toFixed(2)}  top1 ${(s.moveTop1 * 100).toFixed(0)}%  top3 ${(s.moveTop3 * 100).toFixed(0)}%  missing ${s.moveMissing}`);
