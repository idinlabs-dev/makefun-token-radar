# Token Launch Radar — build transcript

Competition **token-radar-01** ("Build the best token launch radar"), $1,325
prize pool, deadline Mon 14 Dec 2026 17:00 WIB. This log records how the entry
was built, phase by phase, in the order the work actually happened. It is a
record of decisions and fixes, not a sales pitch — where the model is weak,
the log says so.

## Phase 1 — Specification (`63dc031b`)

The phase began by reading only the competition's own materials: `RULES.txt`
in full, `competition.yaml`, `kit.json`, the kit's input README, and a
read-only Python analysis of `input/snapshot.json`. The starter code was
deliberately never opened, per the anti-poisoning rule in the competition
rules.

What the snapshot turned out to contain: 758 protocols as of 2026-11-14
(DefiLlama), a 40-protocol watchlist, 128 protocols with a positive market
cap to fit on, and 342 protocols that record no token — the 40 watchlist
members plus 302 below the $50M floor. The data quirks that shaped the model
were found here, not later: 15 protocols with market cap exactly 0 and one
at −1 (so `ln(mcap)` is undefined for them), a +4,448.47% seven-day change
on one protocol, 4 null seven-day changes, 113 null listing dates
(33 of them inside the fit set), and 2 watchlist members with no listing
date at all.

The spec also resolved the places where the original concept and the rules
pulled in different directions, and the rules won every time: the
"TGE-readiness hazard window" survives only as a weighting `W` that scales
the pool estimate, never as a launch prediction or date; the 7% pool share
is labelled a stated assumption, not a fact; the board is all 342
token-less protocols rather than the starter's 200-row shape; and the
65,536-byte cap is treated as a cap on the whole dossier text (headers and
metadata included), not on the dashboard files alone. No program or dashboard
code was written in this phase.

## Phase 2 — Model, farm engine, entrypoint (`ed2aead4`)

`lib/model.ts`, `lib/farm.ts` and `main.ts` were written from the spec, plus
the kit library `vendor/makefun-board.ts` copied in byte-for-byte (verified
by sha256 — the one file the rules allow to be copied). The model is OLS on
`ln(Mcap)` with the four snapshot features, fit on N=128 with median
imputation for missing ages and seven-day changes, followed by Empirical
Bayes category shrinkage (λ = 5) and Duan smearing for the bands.

The farm engine builds a 9–12 step plan per board row from category
playbooks and a per-chain fee table, with per-step fee, opportunity cost at
a 4.5% annual rate, active minutes and EV, written for a $2,500 bankroll.
The entrypoint reads the snapshot, fits, scores all 758 protocols, writes
`board.json`, packs the columnar dashboard data, copies the dashboard and
screenshots, and calls `buildDossier`.

Gate self-check at the end of this phase: **18/18 gates passed**.

## Phase 2b — The P50 switch (`4804968`)

The first version used the Duan-smeared mean as the point estimate, the way
the spec had originally written it. Then it was tested out-of-sample under
the same stratified 5-fold CV as everything else, and it lost badly:
R² −0.6169 and MdAPE 5.5009 — worse than the category-median baseline
(R² −0.1985, MdAPE 0.9367). The smeared mean multiplies every prediction by
8.7176, and on held-out data that systematic lift is mostly error.

So the point estimate became the P50 median, `exp(ŷ_adj)` with no smear.
The ranks did not change — multiplying every prediction by the same constant
cannot reorder them — but every implied value was rescaled by 1/8.7176.
With the median as the point estimate the full model scores R² 0.1229,
Spearman ρ 0.3682, MdAPE 0.894 and P15–P85 coverage 0.6328, beating both
benchmarks on R² and MdAPE (simple log-log on TVL alone: R² −0.8751,
MdAPE 8.3020). The Duan smear was kept, but only where it belongs: widening
the P15/P85 bands around the median. The smeared-mean variant stays visible
in the dashboard's validation panel as the variant that was tested and
rejected, so the choice is auditable rather than hidden.

## Phase 3 — Dashboard (`cc1da3d`)

The dashboard was built as a dark telemetry terminal: header strip with the
snapshot counts, a sortable 342-row board, preset filter chips, a per-protocol
detail view with the IV band, model decomposition, readiness gauge, pool
estimate and farm plan, an SVG regression curve, and an honest CV panel with
both benchmarks and the rejected variant.

The binding constraint was the byte budget. All 758 protocols plus the board
had to fit in `data.js` inside the 65,536-byte dossier-text cap, so the data
is columnar and dictionary-packed (categories and chains as index arrays,
numbers as base-36, IVs rounded to $1,000, weights to 0.001) and the farm
steps are regenerated in the browser from the same playbook tables instead
of being packed per protocol. The generated `data.js` measured 33,875 bytes.

Verification in this phase: the page rendered with **0 console errors**,
and decoding `data.js` and diffing it against `board.json` produced
**0 mismatches** on slugs, ranks and IVs (within the $1,000 packing
rounding).

## Phase 4 — Screenshots and fixes (`d0abc9a`)

Three screenshots were taken from the real dashboard in a browser
(1-board 1280×800, 2-detail 1440×900, 3-filtered 1280×800) and QC-passed
at full size with 0 console errors. Comparing the rendered dashboard
against `board.json` row by row turned up real bugs, and they were fixed
here rather than papered over:

- **Two bugs in `lib/farm.ts`.** First, the Lending Borrow step was missing
  its `deployFrac`, which left the EV null on 16 rows — the dashboard and
  the board disagreed on those plans until the fraction was supplied.
  Second, the TVL-change modifier had a rounding fault that made the
  rendered step text diverge from the board's step strings.
- **Farm steps aligned verbatim, 342/342.** After the fixes, the steps the
  dashboard regenerates in the browser match the `farm_steps` strings in
  `board.json` exactly on every board row.
- **Low-Cost High-EV filter redefined.** The original threshold form
  (plan fees under 5% of the pool estimate and EV above zero) did not
  discriminate — it matched too much of the board to be a useful filter.
  It was redefined as the **top 40 rows by EV per unit of fee**, so the
  chip now surfaces a genuinely selective shortlist.
- **Waterfall capped.** The detail view's model-decomposition waterfall was
  capped so extreme feature contributions cannot blow out the chart.

## Phase 5 — Docs and final verification (this phase)

Fresh `README.md`, `TRANSCRIPT.md` (this file), `LICENSE` (MIT) and
`.makefun/owner.json` were written, and the whole entry was re-verified
from a clean output directory — no code was edited in this phase.

Final verification, run 27 Nov 2026 (fresh `main.ts` run into a clean
directory, then `scripts/validate.mjs`):

- `scripts/validate.mjs`: **19/19 PASS** — 342 rows, ranks exactly 1–342,
  IV non-increasing with rank, all IVs positive whole dollars, slugs
  unique and in the snapshot, watchlist **40/40**, farm steps 3–12 ×
  20–600 chars on every row (3,574 steps total), `board.json` 723,645
  bytes (≤ 8 MiB), `data.js` decodes and agrees with `board.json`.
- **Determinism**: two runs into separate clean directories produced
  byte-identical output (`diff -r` clean). Wall time ≈ 0.21 s per run
  against the 120 s budget.
- **Dossier is real**: `dossier.json` is 758,855 bytes (≤ 1.5 MiB) with
  keys `cover`, `images`, `schema`, `text` — the real `buildDossier`
  output, no fallback. Dossier text is 64,829 bytes (≤ 65,536).
- **Dashboard source**: 64,497 bytes total (`index.html` 2,744 +
  `app.css` 4,041 + `app.js` 23,837 + generated `data.js` 33,875),
  inside the 65,536-byte cap. Note this is larger than the 58,640 bytes
  quoted in the Phase 3 notes: the Phase 4 farm-plan alignment fixes
  grew `app.js`. The verified figure is 64,497.
- **Screenshots** (repo `screenshots/`): `1-board.png` 1280×800,
  156,047 bytes; `2-detail.png` 1440×900, 205,419 bytes;
  `3-filtered.png` 1280×800, 156,558 bytes — all ≤ 512 KiB, all
  within the long-side ≤ 1440 px / short-side ≥ 800 px limits.
- **No URLs in dashboard source**: a scan of `index.html`, `app.css`,
  `app.js` and the generated `data.js` found no `http://` or `https://`
  strings.

### Packing / rounding note

Rendered EV totals in the dashboard can differ from `board.json` by at
most **0.057%**. That is display precision, not a disagreement: `data.js`
packs implied values to the nearest $1,000 and readiness weights to
0.001, while `board.json` carries exact whole-dollar values. The format
is documented in `docs/packing.md`, and the validator confirms the
decoded dashboard data agrees with the board within that rounding.

### What was not done

Nothing was submitted or pushed in any phase. The repository was kept
public-ready with an MIT license, and the only file ever copied into it
was the kit's own `vendor/makefun-board.ts`.
