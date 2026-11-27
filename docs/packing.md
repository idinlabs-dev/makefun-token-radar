# Dashboard data packing format — `data.js`

`main.ts` generates `/output/dashboard/data.js` at runtime from the snapshot.
It is a single assignment, `window.TOKEN_RADAR = {...};`, JSON (no functions,
no comments). Phase 3's `app.js` unpacks it; the dashboard never fetches
`board.json` (no network at runtime). The two must agree exactly: same IVs,
same ranks — phase 3 verifies by decoding `data.js` and diffing against
`board.json`.

## Why columnar

758 protocols × full objects would be ~250 KB as JSON. The dossier-text cap
is 65,536 bytes for *all* dashboard source, so `data.js` must be small.
Columnar + dictionary packing gets all 758 protocols plus the 342 board rows
into roughly 33–36 KB, leaving room for phase-3 app code.

## Dictionaries

- `cat`: array of the 53 category names, sorted alphabetically. Category
  column `c` indexes into it.
- `ch`: array of chain names used by board rows, sorted by frequency
  (descending), ties by name ascending. The most-used chains therefore get
  1-character base-36 indices. Chains that appear only on token-bearing
  protocols are *not* in the dictionary (the validation view does not need
  chain names); their primary-chain entry packs as `""`.

## Protocol columns (758 rows, slug-sorted — the snapshot's own order)

All columns are in the same slug-sorted order as `protocols` in the snapshot.
`n` = 758, `nb` = 342 board rows, `nw` = 40 watchlist.

| Key | Encoding |
|---|---|
| `s` | Slugs joined with `\n` (11.4 chars avg). Split on `\n` to get row *i*. |
| `nd` | Names, sparse: only board-row names that differ from the title-cased slug (`my-protocol` → `My Protocol`). Entries `index:name`, joined with `\|`. All other names are derived client-side from the slug. Token-bearing rows need no display name (validation view shows slug). |
| `c` | Category index per protocol, fixed-width 2-char base-36, concatenated (no separator): `c.slice(2*i, 2*i+2)`. |
| `p` | Primary chain index per protocol, base-36, comma-joined; `""` when the chain is not in `ch`. |
| `x` | Extra chains (beyond primary) for board rows only, sparse: `boardRank:idx.idx`, entries joined with `\|`. |
| `t` | TVL in whole thousands of USD, base-36, comma-joined (rounding to $1k is display precision; exact TVL lives in `board.json`). |
| `g` | `change_7d` in tenths of a percent, offset by +1000, base-36, comma-joined; `""` when null. Decode: `value/10 - 100`. |
| `a` | Age in days at `asOf`, base-36, comma-joined; `""` when `listed_at` is null. |
| `m` | Sparse mcap in thousands of USD, only for token-bearing protocols with `mcap_usd > 0`: `index:base36`, joined with `\|`. |

Base-36 is lowercase `0-9a-z` (`Number.toString(36)`), always non-negative
after the documented offsets, so no sign characters appear.

## Board columns (342 rows, in rank order)

| Key | Encoding |
|---|---|
| `b` | Protocol index (into the slug-sorted columns) per rank, base-36, comma-joined. Rank = position + 1. |
| `iv` | Implied value P50 in thousands of USD, base-36, comma-joined. Multiply by 1,000 to recover the whole-dollar IV (rounding to $1k; exact IV lives in `board.json`). |
| `r` | Readiness weight W × 1000, base-36, comma-joined. Divide by 1000. |
| `w` | Watchlist protocol indices, base-36, comma-joined (40 entries). |

Derived client-side, never packed: `IV_P15 = IV × exp(q15) × smear`,
`IV_P85 = IV × exp(q85) × smear` — the P15/P85 bands keep the Duan smear
per SPEC §4 Stage 3, while the P50 point IV itself is the median `exp(ŷ_adj)`
with NO smear (Phase 2b revision: the smeared-mean point estimate was
tested and rejected on OOS MdAPE). The modelled pool is
`Pool = IV × 7% × (0.5 + 0.5W)` — the 7% is a stated
assumption, shown as such in the dashboard. Farm steps are *not* packed:
`app.js` regenerates them from the same playbook tables (category family +
chain + modifiers derivable from the packed columns) — see `lib/farm.ts`.

## Model constants (for the validation / detail views)

- `q15`, `q85`: fit-residual 15th/85th percentiles (log scale).
- `smear`: Duan smearing factor.
- `beta`: the 5 fitted OLS coefficients, in order
  `[intercept, ln(TVL), asinh(change_7d/10), ln(1+AgeDays), ln(1+nChains)]`,
  rounded to 4 decimals.
- `cv`: `{r2, rho, mdape, cov}` — out-of-sample R² (log scale), Spearman ρ,
  MdAPE, P15–P85 coverage of the full model, point prediction = the P50
  median `exp(ŷ_adj)` with NO Duan smear (Phase 2b revision). On the sealed
  snapshot: R² 0.1229, ρ 0.3682, MdAPE 0.894, coverage 0.6328 — beating both
  benchmarks below on OOS R² and MdAPE.
- `cvMed`: same four metrics for the median prediction — now identical to
  `cv` (the P50 IS the median); kept for backward compatibility.
- `cvSmear`: same four metrics for the REJECTED smeared-mean variant
  (point prediction `exp(ŷ_adj) × smear`, smeared bands): R² -0.6169,
  MdAPE 5.5009 — worse than the category-median baseline, so the dashboard
  shows it only as the tested-and-rejected variant, never as the board IV.
- `bench`: `{cat: {r2, mdape}, log: {r2, mdape}}` — category-median baseline
  and simple log-log rival under the same 5-fold CV protocol.
- `fitN`, `inR2`: fit-set N (128) and in-sample R² (log scale).
- `v: 1`: format version. `asOf`: snapshot date (`2026-11-14`).

## Size budget

Measured on the sealed snapshot (758 protocols, 342 board rows):

| Piece | Approx bytes |
|---|---|
| `data.js` (this file) | **33,875 measured** (phase-2b run, incl. `cvMed` + `cvSmear`) |
| Phase-3 `app.js` + `index.html` + `app.css` | must fit in the remainder |
| **Total dashboard source** | **≤ 65,536 bytes hard cap (dossier text); target ~48,000** |

Verified with a scratch dashboard (dummy page + 3 small PNGs): real
`buildDossier` output was 84,219 bytes with dossier text **34,598 bytes** —
i.e. `data.js` (33,875) dominates the text, leaving ~31 KB of headroom for
phase-3 app code before the 65,536-byte dossier-text cap. Keep phase-3
`app.js` + `index.html` + `app.css` under ~25 KB to stay safely inside it.

The 65,536 cap covers the *entire dossier text*, including the `## Dashboard`
and `## Source` headers and per-file metadata, so source files themselves
must sit comfortably below it. If phase 3 runs over budget, cut in this
order: (1) drop the sparse `m` mcap column (validation view can show counts
only); (2) drop `x` extra-chain lists (show primary chain only);
(3) drop `nd` names and derive all names from slugs. Never cut board rows
or the `iv`/`b` columns — the board is the entry.

## Unpacker sketch (phase 3)

```js
const D = window.TOKEN_RADAR;
const slugs = D.s.split("\n");
const nameOf = (i) => { /* nd lookup, else title-case slugs[i] */ };
const catOf = (i) => D.cat[parseInt(D.c.slice(2*i, 2*i+2), 36)];
const tvlOf = (i) => parseInt(D.t.split(",")[i], 36) * 1000;
const boardRow = (rank) => {
  const i = parseInt(D.b.split(",")[rank], 36);
  const iv = parseInt(D.iv.split(",")[rank], 36) * 1000;
  const w = parseInt(D.r.split(",")[rank], 36) / 1000;
  return { i, iv, w, p15: iv * Math.exp(D.q15) * D.smear, p85: iv * Math.exp(D.q85) * D.smear,
           pool: iv * 0.07 * (0.5 + 0.5 * w) };
};
```

Split each comma-joined column once at load and cache the arrays; do not
re-split per row render.
