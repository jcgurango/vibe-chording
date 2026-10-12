# Vibe Chording

A browser-based chord player and progression builder. Open `index.html` directly
in a browser (no build step, no dependencies).

## Principles

1. **7ths as base.** Every chord in the palette is a 7th chord. No plain triads.
2. **Four-part voice leading.** The left hand plays the root with the 5th above it. The other hand plays
   three notes: the 3rd and 7th are always present, the third voice is the
   5th, root, 9th or 11th, whichever moves least from the previous chord.
   9ths and 11ths are never selected, they emerge. The first chord is in root
   position. When options tie on movement, the one nearer home (the closed
   voicing of Imaj7 or vi7, whichever is nearer) wins.
3. **What can follow what.** Chord B may follow chord A if any of these hold:
   common tones (threshold adjustable), chromatic step-wise motion (every voice
   holds or moves a half step), or strong root motion (by step, third or fifth).
   Each condition can be toggled in the Rules panel.

## Palette

Built around the selected key: the 7 diatonic chords, the 7 chords of the
parallel minor plus ♭VIImaj7 borrowed from Mixolydian, secondary dominants
and their related iis, tritone substitutions, the backdoor move (iv7 → ♭VII7 → I), sus dominants and
chromatic passing dim7 chords. Non-diatonic chords with no Principle 3 entry
from a diatonic chord, or no exit into one, are trimmed.

## Using it

- The map lays chords out by category ring and circle-of-fifths angle. Faint
  lines are named moves. Bright arrows show everything that fits the insertion point.
- The progression has an insertion point: the thin lines between chords, and
  before the first and after the last, are clickable. The active one shows a
  dashed slot.
- Click a chord on the map to try it: it appears as a ghost in the slot, voiced
  in context, and plays. Double-click it (or press Enter, or click "add") to
  add it; the insertion point moves to just after it. Esc or × discards the ghost.
  The ghost takes `/` and `▲` pins like any other chord, so you can audition
  inversions and top notes before committing.
- The map is filtered to the insertion point: with chords on both sides only
  chords that can follow the previous one *and* lead into the next one stay lit.
  Solid arrows come out of the previous chord, dashed arrows lead into the next.
  Arrow colour runs from red (adds tension) through yellow to green (resolves),
  from a score of what the move resolves minus what it lands on:
  a tritone collapsing by contrary half steps (+3), each note a half step from
  the next chord's root, 3rd or 5th (+1), and each note that owes a resolution
  and pays it: a 7th falling to the 3rd, a sus 4th dropping to the 3rd, a ♭5 or
  °7 falling a half step (+1 each); landing on a tritone costs 3, on a suspension 1.
  Hovering a chord, and each row in the list, shows the score and its reasons.
  The two checkboxes under the map toggle each side and reset whenever the
  insertion point moves (previous only at the end, next only at the start, both in
  between). Turning on the other side at the start or end wraps around: "after"
  at the start filters on the last chord, "into" at the end filters on the first,
  which is how you tighten a loop.
- Click a chord in the progression list to hear it voice-led. The list shows
  the left hand (root + 5th), the three upper voices, which extension emerged, and why the
  transition is allowed.
- Play runs the sequence voice-led, ghost included, at the tempo (♩ = BPM)
  and loops until stopped. Each chord has a length: whole bars plus a
  fraction (1/6, 1/4, 1/3, 1/2, 2/3, 3/4, 5/6), up to four bars. Each chord
  also has a "then" action: move on to the next chord (the last chord wraps to
  the first), or go back to an earlier chord, either forever or so that the
  stretch is heard 2, 3, 4 or 8 times. Repeats nest: an inner repeat starts
  over every time an outer one jumps back.
- Text opens the progression as pastable text: key, tempo, then one chord per
  line with its length, pinned top note and action, e.g.
  `4  G7/B  1+1/4 bars  top F  then back to 2 x2`. Edit or paste and press
  Import to replace the progression. Chords are matched by name or roman numeral.
- MIDI downloads a single-track, single-channel file at the tempo, with the
  play order expanded: repeats are written out, an unlimited repeat is taken
  once, and the end does not wrap.
- The piano under the map is a note filter. Click a key to require that note
  (chords without it are greyed out); shift-click to exclude it (chords with
  it are greyed out). Each note sounds when selected; clicking again clears it.
- The `/` button on a progression item pins the bass to any note (slash
  chord). The left hand then plays that note with the root or 5th above it,
  the upper voices are unchanged, and the root-motion rule is judged on the
  actual bass line.
- The `▲` button pins the top note. Choices are the notes the upper voices
  may hold (3rd, 7th, 5th, root, 9th, 11th); the voicing search then only
  considers placements with that note on top.

## Files

- `js/theory.js` palette, spelling, Principle 3 rules, trimming, move catalogue
- `js/voicing.js` Principle 2 voice leading
- `js/layout.js` map positions
- `js/audio.js` Web Audio playback
- `js/song.js` chord lengths, play order, text format, MIDI writer
- `js/app.js` UI
