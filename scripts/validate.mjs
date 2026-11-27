// scripts/validate.mjs — gate self-check for a main.ts output dir.
// Usage: node scripts/validate.mjs <output-dir> [snapshot-path]
// Checks: board row count/ranks/IV monotonic/range, watchlist 40/40,
// farm steps 3-12 x 20-600 chars, board.json + dossier + data.js sizes,
// data.js decodes and agrees with board.json on IV/rank.
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "out";
const snapPath = process.argv[3] ?? "/home/hatch/workspace/makefun-kit/token-radar-01-kit/token-radar-01-kit/input/snapshot.json";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

const snap = JSON.parse(readFileSync(snapPath, "utf8"));
const board = JSON.parse(readFileSync(join(outDir, "board.json"), "utf8"));
const rows = board.rows;
check("board rows 100-4000", rows.length >= 100 && rows.length <= 4000, `${rows.length} rows`);
check("board rows == 342 tokenless", rows.length === 342, `${rows.length}`);
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
check("ranks exactly 1..N", ranks.every((r, i) => r === i + 1));
const byRank = [...rows].sort((a, b) => a.rank - b.rank);
check("IV non-increasing with rank", byRank.every((r, i) => i === 0 || r.implied_value_usd <= byRank[i - 1].implied_value_usd));
check("IV positive whole <= $100T", rows.every((r) => Number.isInteger(r.implied_value_usd) && r.implied_value_usd >= 1 && r.implied_value_usd <= 100_000_000_000_000));
check("IV not all equal", new Set(rows.map((r) => r.implied_value_usd)).size > 1);
const slugs = new Set(rows.map((r) => r.slug));
check("slugs unique + in snapshot", slugs.size === rows.length && rows.every((r) => snap.protocols.some((p) => p.slug === r.slug)));
check("watchlist 40/40", snap.watchlist.every((s) => slugs.has(s)), `${snap.watchlist.filter((s) => slugs.has(s)).length}/40`);
check("names non-empty", rows.every((r) => typeof r.name === "string" && r.name.length > 0));
let badSteps = [];
for (const r of rows) {
  if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) badSteps.push(`${r.slug}:count`);
  for (const s of r.farm_steps ?? []) {
    const t = String(s).trim();
    if (t.length < 20 || t.length > 600) badSteps.push(`${r.slug}:len${t.length}`);
  }
}
check("farm steps 3-12 x 20-600 chars", badSteps.length === 0, badSteps.slice(0, 5).join("; ") || `${rows.reduce((a, r) => a + r.farm_steps.length, 0)} steps total`);
const boardBytes = statSync(join(outDir, "board.json")).size;
check("board.json <= 8 MiB", boardBytes <= 8 * 1024 * 1024, `${boardBytes} bytes`);
if (existsSync(join(outDir, "dossier.json"))) {
  const dBytes = statSync(join(outDir, "dossier.json")).size;
  check("dossier.json <= 1.5 MiB", dBytes <= 1.5 * 1024 * 1024, `${dBytes} bytes`);
  try {
    const d = JSON.parse(readFileSync(join(outDir, "dossier.json"), "utf8"));
    if (typeof d.text === "string") {
      check("dossier text <= 65,536 bytes", Buffer.byteLength(d.text, "utf8") <= 65536, `${Buffer.byteLength(d.text, "utf8")} bytes`);
    }
  } catch { /* fallback dossier in phase 2 is not the real one; skip */ }
} else check("dossier.json exists", false);
const dataPath = join(outDir, "dashboard", "data.js");
if (existsSync(dataPath)) {
  const dBytes = statSync(dataPath).size;
  check("data.js present", true, `${dBytes} bytes`);
  // Decode data.js in a sandbox-ish way: strip the assignment wrapper.
  const src = readFileSync(dataPath, "utf8");
  const json = src.replace(/^window\.TOKEN_RADAR=/, "").replace(/;\s*$/, "");
  const D = JSON.parse(json);
  check("data.js protocols == 758", D.n === 758 && D.s.split("\n").length === 758, `n=${D.n}`);
  check("data.js board rows == 342", D.nb === 342 && D.b.split(",").length === 342);
  const dSlugs = D.s.split("\n");
  const dIv = D.iv.split(",").map((x) => parseInt(x, 36) * 1000);
  const dBoard = D.b.split(",").map((x) => parseInt(x, 36));
  let agree = true;
  for (let rank = 0; rank < 342; rank++) {
    const row = byRank[rank];
    if (dSlugs[dBoard[rank]] !== row.slug) { agree = false; break; }
    if (Math.abs(dIv[rank] - row.implied_value_usd) > 1000) { agree = false; break; }
  }
  check("data.js agrees with board.json (slug + IV within $1k rounding)", agree);
  check("data.js IV non-increasing", dIv.every((v, i) => i === 0 || v <= dIv[i - 1]));
} else check("data.js present", false);
if (existsSync(join(outDir, "model.json"))) {
  const m = JSON.parse(readFileSync(join(outDir, "model.json"), "utf8"));
  console.log(`model: fitN=${m.fit_n} inR2=${m.in_sample_r2_log} cv r2=${m.cv.full.oos_r2_log} rho=${m.cv.full.spearman_rho} mdape=${m.cv.full.mdape} cov=${m.cv.full.p15_p85_coverage}`);
  console.log(`bench: catMedian r2=${m.cv.category_median_baseline.oos_r2_log} mdape=${m.cv.category_median_baseline.mdape} | loglog r2=${m.cv.simple_loglog.oos_r2_log} mdape=${m.cv.simple_loglog.mdape}`);
  check("model.json fitN == 128", m.fit_n === 128, `fitN=${m.fit_n}`);
}
const ivs = byRank.map((r) => r.implied_value_usd);
console.log(`IV range: min $${ivs[ivs.length - 1].toLocaleString()} max $${ivs[0].toLocaleString()} median $${ivs.sort((a, b) => a - b)[171].toLocaleString()}`);
console.log("top5:", byRank.slice(0, 5).map((r) => `${r.slug}=$${r.implied_value_usd.toLocaleString()}`).join(", "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
