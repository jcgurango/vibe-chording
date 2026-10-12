// Sweeps the tuning knobs against the repertoire and prints the best settings. Run: npx tsx scripts/tune.ts
import { benchAll, summarize } from '../src/bench/bench';
import { TUNING } from '../src/theory/scoring';
import { STRENGTH } from '../src/theory/moves';

const grid = {
  tensionPenalty: [0.15, 0.2, 0.25, 0.3],
  deceptiveDiscount: [0.5, 0.6],
  room2: [0.75, 0.85],
  unlistedLeft: [0.6, 0.7, 0.8],
  smoothDivisor: [10, 12, 14],
};
type Row = { settings: Record<string, number>; chordTop5: number; chordMean: number; moveTop3: number; moveMean: number; score: number };
const rows: Row[] = [];
for (const tensionPenalty of grid.tensionPenalty)
  for (const deceptiveDiscount of grid.deceptiveDiscount)
    for (const room2 of grid.room2)
      for (const unlistedLeft of grid.unlistedLeft)
        for (const smoothDivisor of grid.smoothDivisor) {
          Object.assign(TUNING, { tensionPenalty, room2, unlistedLeft, smoothDivisor });
          STRENGTH.deceptiveDiscount = deceptiveDiscount;
          const s = summarize(benchAll());
          rows.push({ settings: { tensionPenalty, deceptiveDiscount, room2, unlistedLeft, smoothDivisor },
            chordTop5: s.chordTop5, chordMean: s.chordMean, moveTop3: s.moveTop3, moveMean: s.moveMean,
            score: s.chordTop5 + s.moveTop3 - 0.02 * (s.chordMean + s.moveMean) });
        }
rows.sort((a, b) => b.score - a.score);
for (const r of rows.slice(0, 12)) {
  console.log(`${r.score.toFixed(3)}  chord top5 ${(r.chordTop5 * 100).toFixed(0)}% mean ${r.chordMean.toFixed(2)}  move top3 ${(r.moveTop3 * 100).toFixed(0)}% mean ${r.moveMean.toFixed(2)}  ${JSON.stringify(r.settings)}`);
}
