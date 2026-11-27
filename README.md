# Token Launch Radar

[![Token Launch Radar — make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/idinlabs-dev/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/idinlabs-dev/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An entry for the make.fun competition **token-radar-01** — *Build the best token launch radar*
($1,325 prize pool, $1,000 for 1st place, judged pairwise by superbot).
Deadline: **Mon 14 Dec 2026 17:00 WIB**.

## What this radar is

Given a sealed DefiLlama snapshot of 758 protocols (as of 2026-11-14), the radar
answers one question for each protocol that **records no token**: what would its
token be worth if it launched one? It ranks all 342 such protocols by a fitted
implied value, pairs every row with a concrete, costed farming plan, and ships
a self-contained dashboard that renders with no network.

"Records no token" is deliberate wording: a DefiLlama record without a token
is not proof that no token exists. The board never claims a launch will happen,
and the readiness weight is a weighting, not a prediction or a date.

## The model

- **OLS on log market cap**: `ln(Mcap)` regressed on `ln(TVL)`,
  `asinh(change_7d / 10)`, `ln(1 + AgeDays)` and `ln(1 + nChains)`, fitted on
  the 128 protocols with a positive market cap (missing ages and 7-day changes
  imputed from fit-set medians; the +4,448% growth outlier tamed by the
  asinh transform and winsorising).
- **Empirical Bayes shrinkage**: each category's mean residual is shrunk
  toward zero with λ = 5, so thin categories borrow strength instead of
  shouting from a handful of rows.
- **Point estimate is the P50 median**, `exp(ŷ_adj)` with no Duan smear.
  The Duan smear factor (8.7176) is still computed and still widens the
  P15/P85 bands — but the smeared mean was tested out-of-sample and lost, so
  the board's number is the median. A modelled airdrop pool,
  `IV × 7% × (0.5 + 0.5W)`, is shown only as the entry's own estimate; the
  7% is a stated assumption, not a fact from the snapshot.
- **Honest out-of-sample scores** (stratified 5-fold CV, slug-sorted folds):
  R² 0.1229, Spearman ρ 0.3682, MdAPE 0.894, P15–P85 coverage 0.6328.
  That beats both rivals run under the same protocol — the category-median
  baseline (R² −0.1985, MdAPE 0.9367) and simple log-log on TVL alone
  (R² −0.8751, MdAPE 8.3020). The rejected smeared-mean variant scored
  R² −0.6169 / MdAPE 5.5009 and is shown in the dashboard only as the
  variant that was tested and dropped. The model is weak in absolute terms —
  a 0.12 out-of-sample R² says most of market cap is not explained by these
  four features — and the dashboard says so rather than hiding it.

## Board coverage

- **342 rows**: every protocol in the snapshot that records no token
  (40 watchlist + 302 below the $50M floor), ranks 1–342, implied value
  non-increasing with rank. Watchlist coverage is **40/40**.
- Implied values run from **$1,431,130** to **$327,222,789**
  (median **$9,326,626**). Rank 1 is bitfinex at $327,222,789, followed by
  bybit, robinhood, bitget and gemini.
- Every row carries a farm plan of **9–12 concrete steps** (3,574 steps
  across the board), each step naming what to do, what it costs and how
  long it takes, written for a $2,500 bankroll. The dashboard recomputes
  the same steps live for $500 and $10,000 bankrolls.

## How to run

Requires **Node 22** (the grader runs 22.23.4; Node ≥ 22.18 runs the
TypeScript entrypoint as-is). Standard library only — nothing to install.

```sh
mkdir -p out
SNAPSHOT_PATH=/path/to/snapshot.json \
MAKEFUN_OUTPUT_DIR=out \
node main.ts --input /path/to/snapshot.json
```

That writes `board.json`, `model.json`, `dashboard/` (with the generated
`data.js`), `screenshots/` and `dossier.json` into the output directory.
The run takes about 0.2 s on one CPU and is deterministic: two runs write
byte-identical output.

To self-check the gates against a fresh output directory:

```sh
node scripts/validate.mjs out
```

On the sealed snapshot this reports **19/19 PASS**.

## Dashboard

`dashboard/` is a dark telemetry terminal: a header strip with the snapshot
counts, a sortable 342-row board with watchlist badges, one-click preset
filters (Watchlist 40/40, Low-Cost High-EV — the top 40 rows by EV per fee —
and Model Validation), and a detail view per protocol with the IV band,
model decomposition, readiness gauge, pool estimate, the full farm plan
with per-step fee / opportunity cost / time / EV, and an SVG regression
curve. It renders from its own directory with no network and no fetch of
`board.json`: all data is packed into the generated `data.js`.

Dashboard source totals **64,497 bytes** (`index.html` 2,744 +
`app.css` 4,041 + `app.js` 23,837 + generated `data.js` 33,875), inside
the 65,536-byte dossier-text cap; the dossier text itself is 64,829 bytes
and the dossier file is 758,855 bytes (≤ 1.5 MiB).

Screenshots in `screenshots/` — all taken from the real dashboard in a
browser, QC-passed at full size with zero console errors:

| File | Shows |
|---|---|
| `1-board.png` (1280×800) | Board / command center, rank 1 on top |
| `2-detail.png` (1440×900) | Protocol detail + regression curve |
| `3-filtered.png` (1280×800) | Filtered view + CV diagnostics |

One display-precision note: the dashboard packs IV to the nearest $1,000
and the readiness weight to 0.001, so a rendered EV total can differ from
`board.json` by at most 0.057%. Exact figures live in `board.json`; the
packing format is documented in `docs/packing.md`.

## Layout

```
main.ts                  Node 22 entrypoint, stdlib only
lib/model.ts             value model (OLS + shrinkage + CV)
lib/farm.ts              farm-plan engine (playbooks + per-step economics)
dashboard/               index.html, app.css, app.js (data.js generated at runtime)
screenshots/             1-board.png, 2-detail.png, 3-filtered.png
vendor/makefun-board.ts  kit library, byte-for-byte (the only copied-in file)
docs/packing.md          dashboard data packing format
scripts/validate.mjs     gate self-check
SPEC.md                  full specification (Phase 1)
TRANSCRIPT.md            build log
```

## License

MIT — see [LICENSE](LICENSE).
