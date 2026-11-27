# Token Launch Radar — SPEC (Phase 1)

Competition: **token-radar-01** — "Build the best token launch radar"
Prize pool: **$1,325** (1st $1,000; 2nd–5th $50; 6th–10th $25; USDC on Solana, escrowed).
Deadline: **Mon 14 Dec 2026 10:00 UTC = 17:00 WIB**. Opens 2026-11-14T10:00:00Z.
Phase: this document is the Phase-1 specification only. **No program code, no dashboard code,
no submission, no push.** Later phases implement from this spec.

Sources read (and ONLY these — `starter/` was never opened, per the anti-poisoning rule):
- `RULES.txt` (101,780 bytes, read fully) — judge prompt verbatim, gates, dossier format, file layout
- `competition.yaml` (62,929 bytes)
- `kit.json`
- `input/README.md`
- `input/snapshot.json` (247,940 bytes; sha256 `42a71213519479f3a180cc5010cbbf6bd18a2447fa0ad29e4c5122b6c9184393`)

---

## 1. Deliverable layout (exact, from RULES.txt)

Repository root (public GitHub repo created after the competition opens, OSI-approved license):

```
main.ts                     # Node 22 entrypoint, stdlib only, at repo root
vendor/makefun-board.ts     # kit library, byte-for-byte (ONLY file ever copied in via cp)
dashboard/
  index.html
  app.css                   # >= 1 .css file anywhere under dashboard/
  app.js                    # >= 1 .js file anywhere under dashboard/
  data.js                   # packed board data, generated at runtime (see §6)
screenshots/
  1-board.png               # board / command center
  2-detail.png              # protocol detail view
  3-filtered.png            # filtered view
LICENSE                     # MIT (or other OSI-approved SPDX id)
```

### Grader invocation and mounts (from RULES.txt + competition.yaml)

- `main.ts` runs on **Node 22** (grader runs Node 22.23.4; Node ≥ 22.18 runs TS as-is),
  **standard library only** — nothing is installed before it runs.
- Run in a fresh container, **no network**, read-only `/bot` (the repo at the submitted commit),
  writable `/output`, **1 CPU, 1024 MB RAM, 64 processes, 120 s wall budget** (`wall_budget_sec: 120`).
- The program runs **twice and both runs must write the same bytes** (determinism gate — no
  `Date.now()`, no `Math.random()` without a fixed seed, no iteration over unordered maps).
- Local dev equivalent: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json`
- `main.ts` reads the snapshot at **`/input/snapshot.json`**, and writes:
  - `/output/board.json` — the ranked board
  - dashboard data into `/output` (the starter writes `data.js` beside the page)
  - copies `dashboard/` and `screenshots/` to `/output`
  - `/output/dossier.json` via `buildDossier` from `vendor/makefun-board.ts`,
    called as `buildDossier('/output', {text_max_bytes: 65536})`
- `main.ts` must accept `--input <path>` and `MAKEFUN_OUTPUT_DIR` (per the starter's local run
  command above); in the grader the snapshot is mounted at `/input/snapshot.json` and output
  goes to `/output`.

### Runtime data flow (binding)

- **The repo must NOT commit generated data files.** `board.json`, `data.js` and `dossier.json`
  are generated at runtime by `main.ts` from the snapshot. The repo ships only source:
  `main.ts`, `lib/` (model + farm engine, authored), `dashboard/` source, `screenshots/`,
  `vendor/makefun-board.ts`, `LICENSE`.
- `main.ts` flow: read `/input/snapshot.json` → fit the value model (deterministic, §4) →
  score all 758 protocols → build board rows (§5) → write `board.json` → pack columnar
  dashboard data (§6) → copy `dashboard/` + `screenshots/` to `/output` → `buildDossier`.

---

## 2. Gates table (exact numbers — every gate must pass, else Valid = 0, no rate, no reward)

| Gate row | Requirement (exact) |
|---|---|
| `dashboard_files` | `dashboard/` holds `index.html` + ≥1 `.css` + ≥1 `.js` anywhere under it; ≤ **400 files**, ≤ **4 MiB** total; every file a regular file, name 1–128 chars of letters/digits/`._-`, not starting with `.` or `-`, no directory starting with `.`; **no `http://` or `https://` in any HTML attribute value, HTML `<style>` body, inline `<script>` import, CSS file, or JS import / export-from / require / dynamic-import specifier** (visible text and comments may carry URLs). First offending file is the detail. |
| `board_file` | `board.json` is UTF-8 JSON object with `rows` array (a bare array is also read), **100–4,000 rows**, ≤ **8 MiB**. Each row: `slug` 1–128 chars, no whitespace, unique, one of the snapshot's protocols; `name` non-empty string; `rank` positive whole number; `implied_value_usd` positive whole dollars, ≤ **100,000,000,000,000** ($100T); `farm_steps` array (see below). A board of ≥2 rows whose implied values are all equal is refused. |
| `sorted_by_value` | Ranks are exactly **1..N, once each**; `implied_value_usd` **does not rise as rank ascends** (rank 1 = most valuable). All-equal implied values refused. |
| `coverage` | **Every watchlist slug appears among the rows** (`min_watchlist_coverage` = 1). Watchlist = the snapshot's own `watchlist` array. |
| `farm_steps` | Every row's `farm_steps`: **3–12 strings**, each **20–600 characters once trimmed**. Concrete steps with cost + time, not slogans. |
| `screenshots` | `screenshots/` holds **3–4 images** (names starting with `.` skipped), each a whole PNG or JPEG, ≤ **512 KiB**, long side ≤ **1440 px**, short side ≥ **800 px**. |
| `dossier_matches` | `dossier.json` is **byte-for-byte** what `buildDossier('/output', {text_max_bytes: 65536})` writes from `dashboard/` + `screenshots/`, and ≤ **1.5 MiB**. |
| **Dossier text** | Text ≤ **65,536 UTF-8 bytes**: opens with `## Dashboard` block (file count, bytes, every file's path + size), then `## Source` with each text file's path, size, line count and contents in a fenced block by path, in path order; first file that does not fit goes in up to its last complete line that fits + a line saying how many lines are not shown; nothing follows but a last line naming how many whole files and bytes were left out. Only extensions `.html .css .js .json .mjs .svg .md .txt` are shown; others are named in the Dashboard block only. |
| **Dashboard source budget** | Keep dashboard source **under 64 KB total** (target **~48 KB** incl. packed data) so the judge reads the whole source — a page past 65,536 bytes is cut and the judge reads a partial source. NOTE: the 65,536 cap covers the *entire dossier text* including the `## Dashboard`/`## Source` headers and per-file metadata, so the source files themselves must sit comfortably BELOW 65,536 bytes. |
| **Screenshot budget** | Keep each screenshot at **300–350 KB** (RULES guidance): three at the 512 KiB cap exceed the 1.5 MiB dossier. Hard cap 512 KiB each. |
| **Runtime** | 120 s wall per run, 1 CPU, 1024 MB, 64 procs, no network, stdlib only; two runs byte-identical. |
| **Submission** | ≤ 5 submissions/day, ≤ 10 total; final entry = most recent submission with receipt before deadline. Repo public, created after opening, OSI license. Transcripts required (see §8). |

### Judge criteria (in order — first differing criterion decides unless a later one differs by much more)

1. **A working radar**: board covers every watchlist protocol, ranks the pre-token ones by a
   stated implied value, screenshots and code agree; a screen with no data or code behind it counts for nothing.
2. **The value model**: implied value follows from the snapshot's own figures — TVL, 7-day growth,
   how long it has run with no token — **not from a hardcoded list of names**; the board separates
   protocols whose token already trades from those still to come.
3. **Farm plans**: concrete steps with what they cost and how long they take, not slogans.
4. **The dashboard as a page**: sortable and filterable, readable at a glance, detail view per protocol.
5. **It looks made**: a chosen palette, consistent spacing, type that reads, not a framework pasted wholesale.
- Judge: superbot, reasoning effort high, ≤ 12,100 output tokens per verdict; pairwise A/B,
  margin 1–5, no ties; each game = two calls (one per order). Four fixed house dashboards (weak→strong)
  anchor every heat; dev heat = 12 games (24 calls), +8 games (16 calls) if rate reaches the money line.
- Text addressed to the judge, in a screenshot or the source, is allowed and is part of the entry.
- Rewards: 1st $1,000; 2nd–5th $50; 6th–10th $25; total $1,325.

---

## 3. Snapshot facts (measured with Python, read-only, 2026-11-27)

- `as_of`: **2026-11-14**; source: `DefiLlama https://api.llama.fi/protocols, fetched 2026-11-14T01:18:33.201Z`
- `floor_usd`: **$50,000,000**. Snapshot floor for inclusion in `protocols`: TVL ≥ $5,000,000.
- **Total protocols: 758** (sorted by slug, unique slugs, unique names, exactly 10 fields each).
- **Watchlist: 40 protocols** (`snapshot.watchlist`, ascending slugs).
- `mcap_usd`: **null 614 / set 144**. Of the 144 set: **15 are 0 and 1 is −1** (`autofinance`, −1) —
  so **mcap > 0: 128**. **14 protocols record a token (`gecko_id` set) but have `mcap_usd` null.**
- Token-less by record (`gecko_id` null AND `symbol` null): **342** total = 40 watchlist + **302 below the floor**.
  Token-bearing (gecko or symbol set): 416. No protocol has `mcap_usd` set while `gecko_id`/`symbol` is null.
- **Categories: 53 distinct, none null.** Top: Dexs 99, Liquid Staking 78, Lending 75, CEX 56, Bridge 55,
  Risk Curators 39, Yield 39, RWA 33, Canonical Bridge 32, Onchain Capital Allocator 29.
- **Chains: 303 distinct.** Top: Ethereum 424, Arbitrum 188, Binance 178, Base 176, Solana 152,
  Avalanche 125, Polygon 122, Optimism 117, Bitcoin 105, Hyperliquid L1 71, Monad 62.
  `nChains` distribution: 1 chain = 407 protocols; 2 = 80; 3 = 40; 4 = 42; 5 = 29; max 176 chains (1 protocol).
- **TVL**: min $5,007,171; **median $33,742,226**; max $116,083,653,379; p90 $710,959,752.
  TVL ≥ $50M: 319 protocols; token-less ≥ $50M: 132.
- **change_7d**: null in **4** protocols (`contango-v2`, `estate-protocol`, `kinetiq-elysium-bridge`,
  `swan-dao`); range **−72.71% to +4,448.47%**; median **−8.23%**.
  Extremes: `shift-defi` +4,448.47% (TVL $47,599,147), `nuva` +160.80%, `monolith-market` +162.86%.
- **listed_at**: null in **113** protocols; age (days, as of 2026-11-14) min **2**, **median 677**, max **1,851**.
- **Fittable for OLS**: mcap present 144; mcap > 0 **128**; mcap > 0 AND change_7d present AND
  listed_at present **95**. Of the 128 with mcap > 0, **0 miss change_7d** but **33 miss listed_at** —
  so the model MUST impute missing age (median-age imputation, §4) or it loses 33/128 (26%) of the fit set.
- Fit set: 34 categories represented; top Lending 15, Dexs 11, Liquid Staking 9, Yield 9, CEX 9, RWA 9.
  Fit-set medians: TVL $32,575,274; mcap $10,707,268; **median mcap/TVL ratio 0.214**.
- **Watchlist detail**: TVL min $51,272,081 / **median $152,788,602** / max $2,753,981,495
  (`steakhouse-financial`; then `gauntlet` $1,577,685,462; `veda` $1,563,415,482; `usdd` $1,055,793,606;
  `nonce-capital` $513,783,671). change_7d range −28.53% to +11.23%, median −3.29% (none null).
  Age: min 45 / **median 511.5** / max 1,563 days; **2 watchlist members have `listed_at` null**
  (`lightning-network`, `noble`) — age imputation applies to them too.
  Categories: Risk Curators 12, RWA 7, Onchain Capital Allocator 3, Basis Trading 2, Lending 2, Chain 2,
  Yield 2, then 1 each: Restaking, Dexs, CeDeFi, Insurance, Payments, Governance Incentives,
  Staking Pool, Stablecoin Wrapper, Collateral Markets, CDP. Chains top: Ethereum 26, Monad 15, Base 12,
  Binance 11, Arbitrum 8, Hyperliquid L1 7, Avalanche 7, Solana 7, Plasma 6, Flare 5.
  nChains: 16 single-chain, 7 with 3 chains, 4 with 2, max 23 chains (1 protocol).

### Watchlist definition (where it lives, how to identify the 40)

- The watchlist is **given** as `snapshot.watchlist` (40 slugs) — the entry READS this list, it does
  not re-derive it. The house rule that produced it (from RULES.txt + input/README.md):
  `tvl_usd` ≥ `floor_usd` ($50M) AND no token recorded (both `gecko_id` and `symbol` null) AND
  DefiLlama records no `parentProtocol` AND category NOT in {Bridge, Canonical Bridge,
  Liquid Staking, Liquid Restaking, Restaked BTC, CEX} AND name does not end in a version marker
  (pattern `\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$`) AND name carries no whole word
  `wrapped` / `staked` / `staking` (any case) AND name does not begin with an exchange name
  (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini).
- **Verification (this phase, Python)**: all 40 watchlist slugs exist in `protocols`; **0 rule
  violations** found when re-checking every member against floor / token-less / version-name /
  bad-category / wrapped-staked-word / exchange-prefix; **0 watchlist members have `mcap_usd` set**.
  Watchlist confirmation: **40/40, no problems found.**
- **Token-less rule (language + scope)**: DefiLlama's record is not proof — say a protocol
  **"records no token"**, NEVER "has none". A listed protocol may still have a token its DefiLlama
  record does not carry. **Exclude wrapped/staked/bridged products of a trading token** (e.g. WBTC,
  Binance staked ETH, USDT0 are off the list because each is a wrapped/staked product of a token
  that already trades) — they are not protocols still waiting on a launch of their own.
- **Floor, never ceiling**: a protocol below the floor, or one the list leaves out, is no worse a
  subject. The board MUST hold ≥ 100 rows while the watchlist is 40, so **≥ 60 rows name protocols
  outside the watchlist**. Board composition decision (§5): all 342 token-less protocols.

### Data quirks the model must handle (do not silently drop)

1. `mcap_usd` = 0 (15 protocols) and −1 (`autofinance`): `ln(mcap)` undefined → **excluded from the
   fit set** (fit requires mcap > 0). They are token-bearing by record, so they never enter the board anyway.
2. `change_7d` = +4,448.47% (`shift-defi`): extreme outlier → use `asinh(change_7d/10)` (bounded
   influence) and winsorize/clamp the transformed value at the fit set's 1st/99th percentile (§4).
3. `change_7d` null (4 protocols) → impute with the fit-set median (−8.23% overall median; use the
   fit-set median at runtime, computed, never hardcoded).
4. `listed_at` null (113 protocols; 33 of the fit set; 2 watchlist members) → impute age with the
   fit-set median age (677 days overall median; use the fit-set median at runtime).
5. `category` null: never occurs in this snapshot (0 nulls) — but code defensively (fallback `"Uncategorized"`).
6. `chains` never empty; `tvl_usd` never ≤ 0 (min $5,007,171).
7. 14 protocols record a token but carry no mcap — excluded from fit, shown in the dashboard only as
   "token already trades" context (not board rows).

---

## 4. Value-model spec (the concept, pinned down)

Goal: an **implied value (IV)** for every token-less protocol — "what its token would be worth if
the protocol's record stayed as it is". IV is the entry's own claim, never make.fun's. The model
uses ONLY snapshot fields (TVL, 7-day change, age, chain count, category) — **no hardcoded list of
names** (judge criterion 2). All fitted constants are computed at runtime from the snapshot;
no fitted coefficient may be hardcoded.

### Features (per protocol, computed from the snapshot)

- `x1 = ln(TVL)` — TVL in whole USD, always > 0.
- `x2 = asinh(change_7d / 10)` — change_7d in percent; null → fit-set median; then winsorize at the
  fit set's 1st/99th percentile of x2 (kills the +4,448% outlier's leverage).
- `x3 = ln(1 + AgeDays)` — AgeDays = (`as_of` − `listed_at`) in days; null `listed_at` → fit-set
  median age. AgeDays ≥ 0 (min observed 2).
- `x4 = ln(1 + nChains)` — nChains = `chains.length` (≥ 1).
- Target: `y = ln(Mcap)` on the fit set (mcap > 0 only).

### Stage 1 — OLS

Fit on the **128** protocols with `mcap_usd > 0` (after the imputations above):

```
ln(Mcap) = b0 + b1·ln(TVL) + b2·asinh(change_7d/10) + b3·ln(1+AgeDays) + b4·ln(1+nChains)
```

- Solve by normal equations with a small ridge (λ_ridge = 1e-6) for numerical stability; implement
  the 5×5 linear solve by hand (stdlib only, no dependencies). Deterministic: fixed summation order.
- Record and display the fitted coefficients, fit-set N (= 128), and in-sample R².

### Stage 2 — Empirical Bayes category shrinkage on residuals

- Residual `r_i = y_i − ŷ_i` for each fit protocol, grouped by `category`.
- Category effect `δ_c = (n_c · mean(r_c)) / (n_c + λ)`, **λ = 5** (shrinkage prior strength).
  Categories with few protocols shrink toward 0; categories absent from the fit set get δ = 0.
- Adjusted prediction: `ŷ_adj = ŷ + δ_category`.

### Stage 3 — Duan smearing + P15/P50/P85 bands

- Smearing factor `S = mean(exp(r_i))` over the fit set (Duan, 1983) — corrects the
  log→level retransformation bias.
- Point IV: `IV_P50 = exp(ŷ_adj) · S`.
- Bands from the residual distribution: let `q15`, `q85` be the 15th/85th percentiles of fit
  residuals; `IV_P15 = exp(ŷ_adj + q15) · S`, `IV_P85 = exp(ŷ_adj + q85) · S`.
- Round IV to whole dollars; **cap at the gate ceiling 100,000,000,000,000** ($100T) — clamp,
  never exceed. IV must be a positive whole number; floor at $1.
- **Implied airdrop pool** (the entry's own estimate, labelled as such, never a promise):
  `Pool = IV × 7% × (0.5 + 0.5·W)`, where `W` = TGE-readiness weight in [0,1] from Stage 4.
  Pool is shown in the detail view only, never as a guaranteed payout.

### Stage 4 — Log-normal TGE-readiness hazard window (weight, NOT a prediction)

- Model "readiness" as a log-normal hazard over AgeDays: protocols accumulate readiness as they
  run longer with no token, peaking and then flattening — a smooth weight `W ∈ (0,1)`.
- **CRITICAL framing (RULES)**: the entry does NOT predict whether or when a token is issued.
  `W` is a *weighting* that scales the airdrop-pool estimate and is displayed as "readiness
  weight" — never as a probability, date, or countdown to a launch. No copy may say "will launch",
  "expected launch", or give a launch date.
- Parameters (μ, σ of the log-normal) are fitted from the fit set's age distribution at runtime
  (median age / IQR), never hardcoded.

### Validation — stratified 5-fold CV (reported on the dashboard)

- Stratify folds by **category** (round-robin within each category, seeded deterministically by
  slug sort order — no randomness, or a fixed-seed PRNG with seed 42 documented in code).
- For each fold: refit Stages 1–2 on the other 4 folds, predict the held-out fold.
- Report out-of-sample: **R² (OOS), Spearman ρ** (rank correlation of predicted vs actual mcap),
  **MdAPE** (median absolute percentage error), and **P15–P85 coverage** (share of held-out
  actuals falling inside their predicted P15–P85 band; target ≈ 70%).
- **Benchmark cards** (same CV protocol, shown beside the model): (a) **category-median baseline**
  (predict each protocol's category median mcap; global median when category unseen);
  (b) **simple log-log** (`ln(Mcap) = a + b·ln(TVL)` only). The full model must beat both on OOS R²
  and MdAPE, or the dashboard must say so honestly — never hide a losing benchmark.
- CV diagnostics are rendered in the dashboard (metrics table + a small residual chart) and are
  part of screenshot 3's filtered/CV view.

### What the board ranks

- Board rows = **all 342 token-less protocols** (40 watchlist + 302 below the floor), ranked by
  IV descending. This satisfies coverage (40/40) and the ≥100-row minimum with 242 rows to spare,
  and maximises judge criterion 1 ("the early ones the radar exists to find").
- **Token-bearing protocols (416) are NOT board rows.** They appear in the dashboard only as
  context ("already trades" / reference set) in the model-validation view, so the board visibly
  separates protocols whose token already trades from those still to come (judge criterion 2).
- Tie-break (deterministic, for equal IV after rounding): higher TVL first, then slug ascending.
  Ranks 1..342 exactly once each; IV non-increasing with rank (enforced by construction + a
  runtime assertion before writing `board.json`).

---

## 5. Farm-plan engine spec

Every board row carries `farm_steps`: **3–12 strings, each 20–600 chars trimmed** (gate).
Concept target: **9 steps** per plan (within 3–12). Each step must be concrete: what to do, what it
costs, how long it takes — never slogans (judge criterion 3).

### Inputs (all from the snapshot + fixed lookup tables authored in code)

- Protocol: `slug`, `name`, `category`, `chains[]`, `tvl_usd`, `change_7d`, `listed_at`, IV, pool, W.
- **Chain fee/latency lookup** (authored table in code, values in USD per typical action, documented
  as estimates): per-chain `txFeeUsd` (e.g. Ethereum high, L2s/Base/Arbitrum low, Solana low),
  `confirmMinutes`, `bridgeMinutes` where relevant. Table covers every chain in the snapshot
  (303 chains) via a default bucket for long-tail chains (median fee of the named set) — no chain
  may be missing at runtime.
- **10 category playbooks** (authored templates, one per major category family): Dexs, Lending,
  RWA, Risk Curators, Yield, Basis Trading, Onchain Capital Allocator, Chain, CeDeFi, and a
  Generic fallback playbook for the remaining categories. Each playbook is a sequence of action
  types (e.g. for Lending: supply → borrow loop → repay; for Dexs: swap → add liquidity → hold LP).
- **Conditional modifiers**: e.g. if `nChains > 1` add a cross-chain step; if `change_7d < 0` add a
  "TVL is shrinking — smaller size, watch exit" caution step; if age < 180 days add an
  "early protocol — expect UI churn" note step; if category is RWA add a KYC/eligibility check step.
  Modifiers must keep the total within 3–12 steps (drop the lowest-priority generic step first).

### Per-step economics (computed, shown in the detail view; the `farm_steps` strings carry the numbers)

For each step `s`, given a bankroll `B`:
- **Direct fee**: `fee_s = txFeeUsd(chain) × txCount_s` (txCount from the playbook step definition).
- **Opportunity cost**: `opp_s = B_deployed_s × 4.5% × (activeDays_s / 365)` — 4.5% annual T-bill rate,
  applied to the capital the step ties up for the days it ties it up.
- **Active minutes**: `mins_s = actions_s × confirmMinutes(chain) + manualMinutes_s`
  (manual minutes from the playbook step definition).
- **EV per step**: `EV_s = (Pool × share_s) − fee_s − opp_s`, where `share_s` is the step's share of
  the protocol's farmable allocation (playbook-defined weights summing to 1 across the plan's steps).
  Plan totals: `Σfee`, `Σopp`, `Σmins`, `ΣEV` displayed in the detail view.
- **Bankroll selector**: `$500 / $2,500 / $10,000` — the dashboard lets the reader switch bankroll;
  fees and opportunity cost rescale (fees fixed, opportunity cost ∝ B, EV ∝ B through pool share).
  The `farm_steps` strings in `board.json` are written for the **$2,500** bankroll (the middle,
  documented default); the dashboard recomputes the same steps' economics live for the other two.
- Every step string embeds its cost and time, e.g. "Swap ~$50 USDC → … on Base (≈$0.08 fee, ≈2 min)".
  Steps must read as instructions for THIS protocol (name, chain, category interpolated), never generic.

### Farm-plan quality rules

- No step may promise an airdrop ("you will receive…"). Language: "positions you for a possible
  allocation", "records no token — nothing here is guaranteed".
- Steps reference only chains the protocol actually lists (from `chains[]`).
- If a protocol's IV is very small relative to its fees at the $500 bankroll, the plan must say so
  ("fees exceed the modelled pool share at $500 — use $2,500+ or skip") rather than hide it.

---

## 6. Dashboard spec

### Palette (dark telemetry — fixed)

- Background `#080A0F`; panels `#10141D`; borders `#1E2532` (derived, keep 1 border token).
- Accent amber `#F59E0B` (primary / IV highlights), emerald `#10B981` (positive / EV),
  cyan `#38BDF8` (links / secondary data), crimson `#F43F5E` (negative / warnings).
- Text: near-white `#E6EAF2` primary, muted `#8A94A6` secondary. Monospace numerals for figures
  (system mono stack — **no external fonts**, no network).
- **Inline SVG only** for charts/icons (regression curve, residual chart, readiness gauge). No images,
  no external assets of any kind.

### Layout — 3 zones

1. **Header / command strip**: title "Token Launch Radar", snapshot date (2026-11-14), counts
   (758 protocols · 342 record no token · 40 watchlist · fit N=128), model one-liner, bankroll selector.
2. **Board (main)**: sortable table — Rank, Protocol (name + slug), Category, Chains, TVL, 7d %,
   Age, IV (P50, with P15–P85 on hover/detail), Readiness W, Pool est. Sort by any numeric column;
   default sort = rank (IV desc). Watchlist rows badged "WATCHLIST". Token-status filter chips:
   "Watchlist 40" / "All pre-token 342" / "Low-Cost High-EV" (see presets).
3. **Detail view** (per protocol, click a row): IV + P15/P50/P85 band, model decomposition
   (which features push IV up/down), readiness gauge, airdrop-pool estimate, full 9-step farm plan
   with per-step fee / opportunity cost / active minutes / EV and plan totals, and the
   "records no token" disclaimer.

### Preset filters (must exist as one-click chips — screenshot 3 shows one in use)

- **Watchlist 40/40** — the 40 watchlist protocols only.
- **Low-Cost High-EV** — pre-token rows where plan total fees at $2,500 < 5% of the pool estimate
  AND plan EV > 0 (definition computed live from the packed data; count shown on the chip).
- **Model Validation** — switches the lower panel to CV diagnostics: OOS R², Spearman ρ, MdAPE,
  P15–P85 coverage, benchmark cards (category-median baseline vs simple log-log vs full model),
  fitted coefficients, residual chart.

### Data packing (the binding constraint)

- Dashboard source total (index.html + app.css + app.js + data.js) **≤ 65,536 bytes hard**,
  **target ~48 KB**, so the whole source fits the dossier text (see §2).
- `data.js` packs **all 758 protocols** (board rows + token-bearing context) in **columnar
  dictionary form**: shared dictionaries for category (53) and chain (303) as index arrays;
  numeric columns as compact base-36/rounded arrays (TVL, IV, change_7d, age, W, pool); strings
  only where unavoidable (slug, name). Farm steps are NOT packed per protocol — they are
  **generated in the browser** from the same playbook tables shipped in app.js (the tables are
  small; the per-protocol interpolation happens client-side), OR packed as template-ids + params.
  Phase 2/3 must measure the byte budget and cut scope (e.g. drop per-protocol step text from
  data.js) before cutting the board — the 65,536-byte cap is non-negotiable.
- `board.json` (written by main.ts, ≤ 8 MiB) carries the full `farm_steps` strings; the dashboard
  reads `data.js` (its own packed copy), NOT `board.json`, so the page renders with no network
  from its own directory. The two must agree exactly (same IVs, same ranks) — Phase 3 verifies
  by diffing `data.js` decode against `board.json`.
- No `http://`/`https://` anywhere in an attribute, style body, script import, CSS file or JS
  import/require/dynamic-import (gate). All links are plain text or `javascript:`-free buttons.

### Runtime behaviour

- Renders with **no network** (file:// or any static host). No fetch of `board.json` at runtime
  (data is inlined in `data.js`).
- Sortable columns, text search (slug/name), category multi-select, chain filter, watchlist-only
  toggle, bankroll selector ($500/$2,500/$10,000) recomputing displayed economics.
- Detail view for **every** board row (342), reachable by clicking its row.

---

## 7. Screenshots spec (3 required, 4th optional — ship exactly 3)

Each: whole PNG or JPEG, **≤ 512 KiB** (target **300–350 KB** so three fit the 1.5 MiB dossier),
**long side ≤ 1440 px, short side ≥ 800 px**. Recommended capture: **1440 × 900** viewport.
Taken in a real browser from the built dashboard (local `out/` run), never mocked up.

| File | Content (must show real data from the snapshot, agreeing with the code) |
|---|---|
| `screenshots/1-board.png` | **Board / command center**: header strip with counts, the ranked board (top rows visible, rank 1 at top with the highest IV), watchlist badges, sortable headers. |
| `screenshots/2-detail.png` | **Detail view + regression curve**: one protocol's detail open (pick a watchlist protocol, e.g. the rank-1 row) — IV with P15/P50/P85 band, model decomposition, readiness gauge, pool estimate, **9-step farm plan with per-step fee / time / EV**; plus the **regression curve** (ln TVL vs ln Mcap with the fitted line and the protocol's point) — inline SVG in the detail view. |
| `screenshots/3-filtered.png` | **Filtered view + CV diagnostics**: a preset filter active (Low-Cost High-EV or Watchlist 40/40) with its chip highlighted and the filtered row count visible, AND the **CV diagnostics panel** (OOS R², Spearman ρ, MdAPE, P15–P85 coverage, benchmark cards vs category-median baseline and simple log-log). |

- The first screenshot by name (`1-board.png`) is the **cover image**: it shows publicly on the
  make.fun Feed from the moment the entry is judged — it must look finished on its own.
- Screenshots and code must agree (judge criterion 1): every number visible in a screenshot must
  be reproducible from the snapshot + the model in the repo. Phase 3 re-renders and diffs.

---

## 8. Transcript rules reminder (for Phases 2–4 — these decide whether the entry is graded at all)

From RULES.txt "The transcript gate" (nine checks; any fail = rejected, not graded, no reward):

- `transcripts_present`: ≥ 1 parsed session. `transcripts_recorded`: every session a harness log
  or a self-export naming its harness; a handed-over session (`"handed_over"` + one-line reason)
  skips as a note BUT under `handed_over_places: none` the entry is ranked yet **takes no paid place**.
- `thinking_wellformed`: every message timestamped; no assistant/tool message > 60 s behind the
  latest before it; every tool result answers an earlier tool call.
- `thinking_in_window`: every timestamp between competition opening (2026-11-14T10:00:00Z) and receipt ± 60 s.
- `thinking_reproduces`: transcripts account for **≥ 30% of counted lines** (authored or pasted),
  and **the entrypoint `main.ts` has ≥ 1 authored line**.
- `thinking_turns`: **≥ 5 assistant turns** carrying text or thinking (tool-only turns don't count).
- `thinking_priced`: usage priced to a known model (warning only below 100%, never a rejection);
  self-reported sessions need provider usage on ≥ 50% of assistant messages; Muse app sessions
  need ≥ 1 usage row attached via bundle's `--muse-usage`.
- `thinking_revised`: **some file takes its final content from ≥ 2 assistant messages that write or
  edit it** (a file written once in full and never revised counts 1). **So: every implementation
  phase must write each core file, then revise it in a later message — never one-shot.**
- `thinking_fresh`: for a source-bundle entry, every credited line comes from sessions showing the
  `makefun anchor <root sha> round <round>` line in a tool result before their first counted write.
- `transcripts_run_record`: run record required (bundle writes it); prompt = the person's own opening
  prompt verbatim; harness/version/provider/model/effort declared; system prompt uploaded or
  in-session; every MCP server listed; instruction files collected or explicitly none.
- `thinking_own_work` (from 2026-11-20): entry rejected when its deliverable was downloaded/copied
  rather than written by the agent — **never `cp`/clone code into the repo except
  `vendor/makefun-board.ts` via `cp`** (the kit's own library, explicitly allowed); **never re-type
  anything read** (no re-typing starter code, docs, or web code); **entrypoint `main.ts` must hold
  authored lines**; runs of ≥ 3 consecutive lines from one outside source count. Reading other
  entries' sites/docs/code for reference is allowed only if the entry does not hold that content
  above the bars (Tier 1: ≥ 20 lines and ≥ 10% of counted lines, or ≥ 50% of a counted file ≥ 20
  lines, or any binary file whole — fails).
- **This phase (spec) never opened `starter/`** — later phases must build `main.ts`, `lib/` and
  `dashboard/` from this spec + the rules, not from the starter's code. The starter may be used
  ONLY as the layout reference the rules describe (file names, the `buildDossier` call shape, the
  local run command) and for `vendor/makefun-board.ts` via `cp`.
- Bundle command (parent re-bundles later; usage rows will be 0 for this spec bundle):
  `node <kit>/cli/makefun.mjs bundle --repo <repo> --session <session> --parent-session <parent>
  --no-discover --out <out>.tar.gz --harness muse-app --model muse-spark-1.3 --provider meta
  --effort default --mcp none --prompt-file <prompt> --prompt-origin handed-off --prompt-via "..."`.

---

## 9. RULES.txt vs concept — contradictions / changes flagged (read this first in Phase 2)

1. **"TGE-readiness hazard window" vs "does not predict whether or when a token is issued".**
   RULES is explicit: the entry must NOT predict issuance. The concept's Stage 4 is kept ONLY as a
   readiness *weight* W ∈ [0,1] scaling the pool estimate, displayed as "readiness weight". Any copy
   implying a launch date, probability, or "will launch" is a rules violation in spirit and will
   read as a false claim to the judge. (§4 Stage 4.)
2. **Dashboard source ≤ 65,536 bytes is the DOSSIER TEXT cap, not a per-file cap.** The 65,536 bytes
   include the `## Dashboard` block, `## Source` headers, per-file path/size/line metadata and
   fences. The concept's "~48 KB" target is therefore the right operating budget; 65,536 is NOT
   headroom to spend. If `data.js` lives inside `dashboard/` (as the starter's layout implies),
   its packed bytes count against the same 65,536. Phase 2 must confirm where `data.js` is written
   and measure; if it does not fit, cut data (fewer packed fields), not the budget.
3. **"Implied airdrop pool = IV × 7% × (0.5+0.5W)"** — the 7% and the formula are the entry's own
   invention; the snapshot carries no airdrop flag. It must be labelled everywhere as the entry's
   own estimate ("modelled pool"), never as a promised or announced allocation. Also the judge's
   criterion 2 requires the model to follow from snapshot figures — the 7% is a stated assumption,
   so it must be shown as an assumption in the dashboard, not hidden.
4. **Board row count**: the concept did not fix N. This spec fixes **N = 342** (all token-less
   protocols). The starter's 200-row shape (40 + 160 below-floor by TVL) is NOT followed: ranking
   all 342 is strictly more coverage for judge criterion 1 and costs nothing against the gates
   (board ≤ 4,000 rows, ≤ 8 MiB). If the 48 KB dashboard budget forces a cut, cut dashboard
   *context* rows (token-bearing 416), never board rows.
5. **Screenshot "300–350 KB" is guidance, 512 KiB is the gate.** Three screenshots at the cap
   exceed the 1.5 MiB dossier — target 300–350 KB each.
6. **"Farm-plan 9 steps" fits** (gate: 3–12 steps, 20–600 chars each). The 20-char minimum per step
   is a real constraint: short imperative steps ("Swap on Base.") fail the gate — every step string
   must be a full sentence carrying cost + time.
7. **Determinism**: the grader runs main.ts twice and requires byte-identical output. The CV
   stratification and any tie-break must be fully deterministic (slug-sorted, fixed seed). No
   wall-clock, no unseeded randomness anywhere in main.ts.
8. **No network anywhere**: dashboard must not fetch `board.json` at runtime (it is not in
   `/output/dashboard/` as served) — data must be inlined in `data.js` inside `dashboard/`.
9. **Kit version note**: RULES.txt says "The transcript checks have changed since these rules were
   written… the checks as they stand today are in this file under '## The transcript gate'". This
   spec quotes the in-file gate section (§8), which governs.

---

## 10. Phase plan (for the parent orchestrator)

- **Phase 2 (model + farm engine)**: implement `lib/model.ts` + `lib/farm.ts` from §4–§5 in a fresh
  session; fit on the snapshot, report CV metrics, write `main.ts` (entrypoint, authored lines),
  generate `board.json` locally, verify gates (100–4,000 rows, ranks 1..N, IV non-increasing,
  coverage 40/40, farm steps 3–12 × 20–600 chars). Revise each file in ≥ 2 messages.
- **Phase 3 (dashboard + screenshots)**: implement `dashboard/` from §6 within the 65,536-byte
  dossier-text budget (target ~48 KB total incl. data.js); render in a browser; take the 3
  screenshots per §7 (1440×900, 300–350 KB each); verify screenshots agree with code + board.
- **Phase 4 (verify + submit prep)**: run main.ts twice, byte-diff outputs; run
  `buildDossier` and check dossier ≤ 1.5 MiB and text ≤ 65,536 bytes; local gate self-check;
  bundle transcripts; `makefun check`; submit only on the parent's instruction.

---

*Spec written 2026-11-27 by Phase 1 (spec) from RULES.txt, competition.yaml, kit.json,
input/README.md and a read-only Python analysis of input/snapshot.json. No starter code was read.
No program or dashboard code was written in this phase.*
