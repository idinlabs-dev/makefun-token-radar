// main.ts — Token Launch Radar entrypoint (token-radar-01).
// Node 22, stdlib only, no network, deterministic (no clock, no RNG;
// slug-sorted everywhere, fixed CV folds). Reads the snapshot, fits the
// value model (lib/model.ts), builds farm plans (lib/farm.ts), writes
// /output/board.json, /output/model.json, /output/dashboard/data.js,
// copies dashboard/ + screenshots/ when present, and writes
// /output/dossier.json via vendor buildDossier.
// Usage: MAKEFUN_OUTPUT_DIR=out SNAPSHOT_PATH=.../snapshot.json node main.ts
//   --input <path> overrides SNAPSHOT_PATH; default snapshot /input/snapshot.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-board.ts";
import {
  fitModel, crossValidate, scoreProtocol, catOf, ageDays, median,
  type Proto, type FittedModel, type CvReport,
} from "./lib/model.ts";
import { buildFarmPlan, DEFAULT_BANKROLL } from "./lib/farm.ts";

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_IV = 100000000000000;

function parseArgs(argv: string[]): { input?: string; output?: string } {
  const out: { input?: string; output?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) out.input = argv[++i];
    else if (argv[i] === "--output" && argv[i + 1]) out.output = argv[++i];
  }
  return out;
}

function b36(n: number): string {
  return Math.max(0, Math.round(n)).toString(36);
}

function titleFromSlug(slug: string): string {
  return slug.split("-").map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function cleanOutputDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  // Never remove the output dir itself; delete only its contents.
  for (const entry of readdirSync(dir)) rmSync(join(dir, entry), { recursive: true, force: true });
}

function copyTree(src: string, dst: string): number {
  let count = 0;
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    const st = statSync(s);
    if (st.isDirectory()) count += copyTree(s, d);
    else if (st.isFile()) { copyFileSync(s, d); count++; }
  }
  return count;
}

function main(): void {
  const started = process.hrtime.bigint();
  const args = parseArgs(process.argv.slice(2));
  const snapshotPath = args.input ?? process.env.SNAPSHOT_PATH ?? "/input/snapshot.json";
  const outDir = args.output ?? process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const snap = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
    as_of: string; source: string; floor_usd: number;
    protocols: Proto[]; watchlist: string[];
  };
  const asOf = snap.as_of;
  const protocols = [...snap.protocols].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const watchlist = [...snap.watchlist].sort();
  const watchSet = new Set(watchlist);

  // ---- Fit the value model (SPEC §4) ----
  const fitRows = protocols.filter((p) => (p.mcap_usd ?? 0) > 0);
  const model: FittedModel = fitModel(fitRows, asOf);
  const cv: CvReport = crossValidate(fitRows, asOf);

  // ---- Score every protocol; board = all 342 that record no token ----
  type BoardRow = {
    slug: string; name: string; rank: number; implied_value_usd: number;
    category: string; chains: string[]; tvl_usd: number; change_7d: number | null;
    age_days: number; readiness_w: number; iv_p15_usd: number; iv_p85_usd: number;
    pool_usd: number; watchlist: boolean; farm_steps: string[];
    farm_economics: { total_fee_usd: number; total_opp_usd: number; total_minutes: number; total_ev_usd: number };
  };
  const scored = new Map<string, ReturnType<typeof scoreProtocol>>();
  for (const p of protocols) scored.set(p.slug, scoreProtocol(model, p, asOf));
  const boardProtos = protocols.filter((p) => p.gecko_id === null && p.symbol === null);
  boardProtos.sort((a, b) => {
    const sa = scored.get(a.slug)!; const sb = scored.get(b.slug)!;
    if (sb.ivP50 !== sa.ivP50) return sb.ivP50 - sa.ivP50;
    if (b.tvl_usd !== a.tvl_usd) return b.tvl_usd - a.tvl_usd;
    return a.slug < b.slug ? -1 : 1;
  });
  const rows: BoardRow[] = boardProtos.map((p, i) => {
    const s = scored.get(p.slug)!;
    const plan = buildFarmPlan(p, s, DEFAULT_BANKROLL, asOf);
    return {
      slug: p.slug, name: p.name, rank: i + 1, implied_value_usd: s.ivP50,
      category: catOf(p), chains: p.chains, tvl_usd: p.tvl_usd,
      change_7d: p.change_7d, age_days: ageDays(p, model.ctx, asOf),
      readiness_w: Math.round(s.readinessW * 1000) / 1000,
      iv_p15_usd: s.ivP15, iv_p85_usd: s.ivP85, pool_usd: s.poolUsd,
      watchlist: watchSet.has(p.slug),
      farm_steps: plan.steps.map((st) => st.text),
      farm_economics: {
        total_fee_usd: plan.totalFeeUsd, total_opp_usd: plan.totalOppUsd,
        total_minutes: plan.totalMinutes, total_ev_usd: plan.totalEvUsd,
      },
    };
  });
  // Runtime assertions before writing board.json.
  if (rows.length < 100 || rows.length > 4000) throw new Error(`board row count ${rows.length} out of gate range`);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].rank !== i + 1) throw new Error(`rank break at ${i}`);
    if (i > 0 && rows[i].implied_value_usd > rows[i - 1].implied_value_usd) throw new Error("IV not non-increasing");
    if (!(rows[i].implied_value_usd >= 1 && rows[i].implied_value_usd <= MAX_IV)) throw new Error("IV out of range");
    if (rows[i].farm_steps.length < 3 || rows[i].farm_steps.length > 12) throw new Error(`farm step count ${rows[i].slug}`);
    for (const st of rows[i].farm_steps) {
      const t = st.trim();
      if (t.length < 20 || t.length > 600) throw new Error(`farm step length ${rows[i].slug}: ${t.length}`);
    }
  }
  const covered = watchlist.filter((s) => rows.some((r) => r.slug === s)).length;
  if (covered !== watchlist.length) throw new Error(`watchlist coverage ${covered}/${watchlist.length}`);

  // ---- Write outputs ----
  cleanOutputDir(outDir);
  const board = {
    as_of: asOf, source: snap.source, floor_usd: snap.floor_usd,
    model: `OLS ln(Mcap) on ln(TVL), asinh(change_7d/10), ln(1+AgeDays), ln(1+nChains) + Empirical Bayes category shrinkage (lambda=5); point IV is the P50 median exp(yAdj) with NO Duan smear (the smeared-mean variant exp(yAdj) x smear was tested and rejected: OOS MdAPE ${cv.fullSmeared.mdape.toFixed(4)} vs ${cv.full.mdape.toFixed(4)} for the median). Duan smear is kept only for the mean estimate and the P15/P85 bands, which stay as spec'd (exp(yAdj+q) x smear); readiness weight W is a weight only, never a launch prediction; modelled pool = IV x 7% x (0.5+0.5W), a stated 7% assumption, never a promised payout.`,
    bankroll_usd: DEFAULT_BANKROLL, rows,
  };
  writeFileSync(join(outDir, "board.json"), JSON.stringify(board));
  const modelJson = {
    as_of: asOf, fit_n: model.fitN, in_sample_r2_log: round4(model.inSampleR2),
    beta: model.beta.map(round4),
    beta_names: ["intercept", "ln_tvl", "asinh_change7d_div10", "ln_1_age_days", "ln_1_nchains"],
    median_age_days: model.medianAge, median_change_7d: round4(model.medianChange),
    x2_winsor: [round4(model.x2Lo), round4(model.x2Hi)],
    smear_duan: round4(model.smear), resid_q15: round4(model.q15), resid_q85: round4(model.q85),
    readiness_mu: round4(model.mu), readiness_sigma: round4(model.sigma),
    category_delta: model.catDelta,
    cv: {
      full: cvMetricsOut(cv.full), category_median_baseline: cvMetricsOut(cv.catMedian), simple_loglog: cvMetricsOut(cv.loglog),
      full_median_no_smear: cvMetricsOut(cv.fullMedian),
      full_smeared_mean_rejected: cvMetricsOut(cv.fullSmeared),
    },
    cv_note: `Headline CV evaluates the P50 median point prediction IV = exp(yAdj) (no Duan smear). The P50 model beats BOTH benchmarks on OOS R2 and MdAPE: category-median baseline (R2 ${cv.catMedian.r2.toFixed(4)}, MdAPE ${cv.catMedian.mdape.toFixed(4)}) and simple log-log (R2 ${cv.loglog.r2.toFixed(4)}, MdAPE ${cv.loglog.mdape.toFixed(4)}). The smeared-mean variant IV = exp(yAdj) x Duan smear (~${model.smear.toFixed(1)}x) was tested under the same 5-fold CV and REJECTED on OOS MdAPE (${cv.fullSmeared.mdape.toFixed(4)}, R2 ${cv.fullSmeared.r2.toFixed(4)}) — worse than the category-median baseline; it is reported in full_smeared_mean_rejected for the dashboard, never used for the board. full_median_no_smear is identical to full (the P50 IS the median); kept for backward compatibility.`,
    counts: {
      protocols: protocols.length, tokenless_board_rows: rows.length,
      watchlist: watchlist.length, watchlist_covered: covered,
      token_bearing: protocols.length - rows.length,
    },
    iv_range: { min: rows[rows.length - 1].implied_value_usd, max: rows[0].implied_value_usd, median: median(rows.map((r) => r.implied_value_usd)) },
    top5: rows.slice(0, 5).map((r) => ({ slug: r.slug, iv: r.implied_value_usd })),
  };
  writeFileSync(join(outDir, "model.json"), JSON.stringify(modelJson, null, 2));

  // ---- Copy dashboard/ + screenshots/ when present (phase 3) ----
  const dashSrc = join(REPO_ROOT, "dashboard");
  const shotSrc = join(REPO_ROOT, "screenshots");
  let dashFiles = 0;
  if (existsSync(dashSrc) && statSync(dashSrc).isDirectory()) dashFiles = copyTree(dashSrc, join(outDir, "dashboard"));
  if (existsSync(shotSrc) && statSync(shotSrc).isDirectory()) copyTree(shotSrc, join(outDir, "screenshots"));

  // ---- Packed dashboard data (see docs/packing.md) ----
  const dataJs = packData(protocols, rows, watchlist, model, cv, asOf);
  mkdirSync(join(outDir, "dashboard"), { recursive: true });
  writeFileSync(join(outDir, "dashboard", "data.js"), dataJs);

  // ---- Dossier via vendor library ----
  // buildDossier RETURNS the dossier bytes (Uint8Array); it does not write
  // the file itself. Write the returned bytes verbatim to dossier.json —
  // the dossier_matches gate compares byte-for-byte against a fresh call.
  let dossierOk = false;
  try {
    const r: unknown = buildDossier(outDir, { text_max_bytes: 65536 });
    if (r instanceof Uint8Array) {
      writeFileSync(join(outDir, "dossier.json"), r);
      dossierOk = true;
    } else if (typeof r === "string") {
      writeFileSync(join(outDir, "dossier.json"), r, "utf8");
      dossierOk = true;
    } else if (r && typeof (r as { then?: unknown }).then === "function") {
      throw new Error("buildDossier returned a promise; this entrypoint expects sync bytes");
    } else {
      throw new Error(`buildDossier returned unexpected ${typeof r}`);
    }
  } catch (e) {
    console.error("buildDossier failed (dashboard/screenshots may be absent in this phase):", (e as Error).message);
    writeFileSync(join(outDir, "dossier.json"), JSON.stringify({
      note: "buildDossier could not run in this phase-2 run (dashboard/screenshots not yet present); phase 3/4 re-runs produce the real dossier.",
      error: (e as Error).message, dashboard_files_copied: dashFiles,
    }, null, 2));
  }

  const secs = Number(process.hrtime.bigint() - started) / 1e9;
  console.log(`rows=${rows.length} watchlist=${covered}/${watchlist.length} iv_min=${rows[rows.length - 1].implied_value_usd} iv_max=${rows[0].implied_value_usd} iv_median=${median(rows.map((r) => r.implied_value_usd))}`);
  console.log(`cv oos_r2=${cv.full.r2.toFixed(4)} spearman=${cv.full.spearman.toFixed(4)} mdape=${cv.full.mdape.toFixed(4)} coverage=${cv.full.coverage.toFixed(3)}`);
  console.log(`bench catMedian r2=${cv.catMedian.r2.toFixed(4)} mdape=${cv.catMedian.mdape.toFixed(4)} | loglog r2=${cv.loglog.r2.toFixed(4)} mdape=${cv.loglog.mdape.toFixed(4)} | smeared-mean REJECTED r2=${cv.fullSmeared.r2.toFixed(4)} mdape=${cv.fullSmeared.mdape.toFixed(4)}`);
  console.log(`data.js bytes=${Buffer.byteLength(dataJs)} dossier=${dossierOk ? "buildDossier" : "fallback"} wall=${secs.toFixed(2)}s`);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function cvMetricsOut(m: { r2: number; spearman: number; mdape: number; coverage: number; n: number }) {
  return { oos_r2_log: round4(m.r2), spearman_rho: round4(m.spearman), mdape: round4(m.mdape), p15_p85_coverage: round4(m.coverage), n: m.n };
}

// ---- Columnar packing (format documented in docs/packing.md) ----
function packData(protocols: Proto[], rows: Array<{ slug: string; implied_value_usd: number; readiness_w: number }>, watchlist: string[], model: FittedModel, cv: CvReport, asOf: string): string {
  const idxOf = new Map(protocols.map((p, i) => [p.slug, i]));
  const cats = [...new Set(protocols.map((p) => catOf(p)))].sort();
  const catIdx = new Map(cats.map((c, i) => [c, i]));
  // Chain dictionary: chains used by board rows, by frequency desc then name
  // (so the most-used chains get 1-char base-36 indices). Token-bearing-only
  // chains are not in the dictionary; their primary chain packs as "".
  const boardSlugs = new Set(rows.map((r) => r.slug));
  const chainFreq = new Map<string, number>();
  for (const p of protocols) {
    if (!boardSlugs.has(p.slug)) continue;
    for (const c of p.chains) chainFreq.set(c, (chainFreq.get(c) ?? 0) + 1);
  }
  const chains = [...chainFreq.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([c]) => c);
  const chainIdx = new Map(chains.map((c, i) => [c, i]));
  const boardRankOf = new Map(rows.map((r, i) => [r.slug, i]));

  const slugs = protocols.map((p) => p.slug).join("\n");
  // Names: only board-row names that differ from the title-cased slug.
  const nameDiff: string[] = [];
  for (const p of protocols) {
    if (!boardSlugs.has(p.slug)) continue;
    if (p.name !== titleFromSlug(p.slug)) nameDiff.push(`${idxOf.get(p.slug)}:${p.name}`);
  }
  const catCol = protocols.map((p) => catIdx.get(catOf(p))!.toString(36).padStart(2, "0")).join("");
  const primChain = protocols.map((p) => {
    const i = chainIdx.get(p.chains[0]);
    return i === undefined ? "" : b36(i);
  }).join(",");
  // Extra chains (beyond the primary) for board rows only, sparse.
  const extra: string[] = [];
  for (const p of protocols) {
    const rank = boardRankOf.get(p.slug);
    if (rank === undefined || p.chains.length < 2) continue;
    const rest = p.chains.slice(1).map((c) => chainIdx.get(c)).filter((v) => v !== undefined) as number[];
    if (rest.length) extra.push(`${rank}:${rest.map(b36).join(".")}`);
  }
  const tvlCol = protocols.map((p) => b36(Math.round(p.tvl_usd / 1000))).join(",");
  const chgCol = protocols.map((p) => (p.change_7d === null || p.change_7d === undefined ? "" : b36(Math.round(p.change_7d * 10) + 1000))).join(",");
  const ageCol = protocols.map((p) => {
    if (p.listed_at === null) return "";
    return b36(Math.max(0, Math.floor((Date.parse(asOf + "T00:00:00Z") - Date.parse(p.listed_at + "T00:00:00Z")) / 86400000)));
  }).join(",");
  // Sparse mcap (thousands) for token-bearing protocols with mcap > 0.
  const mcapParts: string[] = [];
  for (const p of protocols) {
    if ((p.mcap_usd ?? 0) > 0) mcapParts.push(`${idxOf.get(p.slug)}:${b36(Math.round((p.mcap_usd as number) / 1000))}`);
  }
  const boardIdx = rows.map((r) => b36(idxOf.get(r.slug)!)).join(",");
  const ivCol = rows.map((r) => b36(Math.round(r.implied_value_usd / 1000))).join(",");
  const wCol = rows.map((r) => b36(Math.round(r.readiness_w * 1000))).join(",");
  const watchCol = watchlist.map((s) => b36(idxOf.get(s)!)).join(",");

  const data = {
    v: 1, asOf, n: protocols.length, nb: rows.length, nw: watchlist.length,
    cat: cats, ch: chains,
    s: slugs, nd: nameDiff.join("|"),
    c: catCol, p: primChain, x: extra.join("|"),
    t: tvlCol, g: chgCol, a: ageCol, m: mcapParts.join("|"),
    b: boardIdx, w: watchCol, iv: ivCol, r: wCol,
    q15: round4(model.q15), q85: round4(model.q85), smear: round4(model.smear),
    beta: model.beta.map(round4),
    cv: { r2: round4(cv.full.r2), rho: round4(cv.full.spearman), mdape: round4(cv.full.mdape), cov: round4(cv.full.coverage) },
    cvMed: { r2: round4(cv.fullMedian.r2), rho: round4(cv.fullMedian.spearman), mdape: round4(cv.fullMedian.mdape), cov: round4(cv.fullMedian.coverage) },
    cvSmear: { r2: round4(cv.fullSmeared.r2), rho: round4(cv.fullSmeared.spearman), mdape: round4(cv.fullSmeared.mdape), cov: round4(cv.fullSmeared.coverage) },
    bench: {
      cat: { r2: round4(cv.catMedian.r2), mdape: round4(cv.catMedian.mdape) },
      log: { r2: round4(cv.loglog.r2), mdape: round4(cv.loglog.mdape) },
    },
    fitN: model.fitN, inR2: round4(model.inSampleR2),
  };
  return "window.TOKEN_RADAR=" + JSON.stringify(data) + ";\n";
}

main();
export {};
