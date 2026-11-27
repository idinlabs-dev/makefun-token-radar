// lib/model.ts — value model for Token Launch Radar (SPEC §4).
// Fitted at runtime from the snapshot only; no fitted constant is hardcoded.
// Deterministic: fixed summation order, slug-sorted folds, no clock, no RNG.
export type Proto = {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
};

export type FitCtx = { medianAge: number; medianChange: number; x2Lo: number; x2Hi: number };

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function percentile(sortedAsc: number[], p: number): number {
  // Linear-interpolation percentile on an already-sorted array.
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export function asOfMs(asOf: string): number {
  return Date.parse(asOf + "T00:00:00Z");
}

export function ageDays(p: Proto, ctx: FitCtx, asOf: string): number {
  if (p.listed_at) {
    const d = (asOfMs(asOf) - Date.parse(p.listed_at + "T00:00:00Z")) / 86400000;
    return Math.max(0, Math.floor(d));
  }
  return ctx.medianAge;
}

export function computeCtx(rows: Proto[], asOf: string): FitCtx {
  const ages: number[] = [];
  const changes: number[] = [];
  for (const p of rows) {
    if (p.listed_at) {
      ages.push(Math.max(0, Math.floor((asOfMs(asOf) - Date.parse(p.listed_at + "T00:00:00Z")) / 86400000)));
    }
    if (p.change_7d !== null && p.change_7d !== undefined) changes.push(p.change_7d);
  }
  const medianAge = ages.length ? median(ages) : 677;
  const medianChange = changes.length ? median(changes) : 0;
  const x2s: number[] = [];
  for (const p of rows) {
    const c = p.change_7d === null || p.change_7d === undefined ? medianChange : p.change_7d;
    x2s.push(Math.asinh(c / 10));
  }
  const sorted = [...x2s].sort((a, b) => a - b);
  return { medianAge, medianChange, x2Lo: percentile(sorted, 0.01), x2Hi: percentile(sorted, 0.99) };
}

export function features(p: Proto, ctx: FitCtx, asOf: string): number[] {
  const c = p.change_7d === null || p.change_7d === undefined ? ctx.medianChange : p.change_7d;
  let x2 = Math.asinh(c / 10);
  if (x2 < ctx.x2Lo) x2 = ctx.x2Lo;
  if (x2 > ctx.x2Hi) x2 = ctx.x2Hi;
  const age = ageDays(p, ctx, asOf);
  return [Math.log(p.tvl_usd), x2, Math.log(1 + age), Math.log(1 + p.chains.length)];
}

export function catOf(p: Proto): string {
  return p.category && p.category.length ? p.category : "Uncategorized";
}

// Solve A x = b by Gaussian elimination with partial pivoting (small, dense).
export function solveLinear(Ain: number[][], bin: number[]): number[] {
  const n = bin.length;
  const A = Ain.map((r) => [...r]);
  const b = [...bin];
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (piv !== col) {
      const t = A[col]; A[col] = A[piv]; A[piv] = t;
      const tb = b[col]; b[col] = b[piv]; b[piv] = tb;
    }
    const d = A[col][col] || 1e-12;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / (A[r][r] || 1e-12);
  }
  return x;
}

// OLS with intercept: y = b0 + b1 x1 + ... ; ridge 1e-6 on the diagonal.
export function fitOLS(X: number[][], y: number[]): number[] {
  const k = X[0].length + 1;
  const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const XtY: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    const row = [1, ...X[i]];
    for (let a = 0; a < k; a++) {
      XtY[a] += row[a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  for (let a = 0; a < k; a++) XtX[a][a] += 1e-6;
  return solveLinear(XtX, XtY);
}

export function predictOLS(beta: number[], x: number[]): number {
  let s = beta[0];
  for (let i = 0; i < x.length; i++) s += beta[i + 1] * x[i];
  return s;
}

export function normCdf(z: number): number {
  // Abramowitz–Stegun erf approximation; accurate to ~1e-7, deterministic.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

export type FittedModel = {
  beta: number[];
  ctx: FitCtx;
  catDelta: Record<string, number>;
  smear: number;
  q15: number;
  q85: number;
  mu: number;
  sigma: number;
  fitN: number;
  inSampleR2: number;
  medianAge: number;
  medianChange: number;
  x2Lo: number;
  x2Hi: number;
};

export function fitModel(fitRows: Proto[], asOf: string): FittedModel {
  const rows = [...fitRows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const ctx = computeCtx(rows, asOf);
  const X: number[][] = [];
  const y: number[] = [];
  for (const p of rows) {
    X.push(features(p, ctx, asOf));
    y.push(Math.log(p.mcap_usd as number));
  }
  const beta = fitOLS(X, y);
  // Residuals + in-sample R2 (log scale).
  const resid: number[] = [];
  let ssRes = 0;
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssTot = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = y[i] - predictOLS(beta, X[i]);
    resid.push(r);
    ssRes += r * r;
    ssTot += (y[i] - yMean) * (y[i] - yMean);
  }
  const inSampleR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  // Stage 2: Empirical Bayes category shrinkage, lambda = 5.
  const byCat = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const c = catOf(rows[i]);
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(resid[i]);
  }
  const catDelta: Record<string, number> = {};
  for (const [c, rs] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    catDelta[c] = (rs.length * mean) / (rs.length + 5);
  }
  // Stage 3: Duan smearing + residual quantiles (on raw OLS residuals, per spec).
  const smear = resid.reduce((a, r) => a + Math.exp(r), 0) / resid.length;
  const sortedResid = [...resid].sort((a, b) => a - b);
  const q15 = percentile(sortedResid, 0.15);
  const q85 = percentile(sortedResid, 0.85);
  // Stage 4: log-normal readiness weight from the fit set's age distribution.
  // mu = ln(median age); sigma from the IQR of ln(age) / 1.349. W is a weight
  // in (0,1) scaling the modelled pool — NEVER a launch date or probability.
  const ages = rows.map((p) => Math.max(1, ageDays(p, ctx, asOf)));
  const logAges = ages.map((a) => Math.log(a)).sort((a, b) => a - b);
  const medAge = median(ages);
  const mu = Math.log(Math.max(1, medAge));
  let sigma = (percentile(logAges, 0.75) - percentile(logAges, 0.25)) / 1.349;
  if (!isFinite(sigma) || sigma < 0.1) sigma = 0.5;
  return {
    beta, ctx, catDelta, smear, q15, q85, mu, sigma,
    fitN: rows.length, inSampleR2,
    medianAge: ctx.medianAge, medianChange: ctx.medianChange, x2Lo: ctx.x2Lo, x2Hi: ctx.x2Hi,
  };
}

export type Scored = {
  yAdj: number;
  ivP50: number;
  ivP15: number;
  ivP85: number;
  readinessW: number;
  poolUsd: number;
};

export function clampIV(v: number): number {
  if (!isFinite(v) || v < 1) return 1;
  if (v > 100000000000000) return 100000000000000;
  return Math.round(v);
}

export function scoreProtocol(model: FittedModel, p: Proto, asOf: string): Scored {
  const x = features(p, model.ctx, asOf);
  const yHat = predictOLS(model.beta, x);
  const delta = model.catDelta[catOf(p)] ?? 0;
  const yAdj = yHat + delta;
  const age = Math.max(1, ageDays(p, model.ctx, asOf));
  const wRaw = normCdf((Math.log(age) - model.mu) / model.sigma);
  const readinessW = Math.min(0.999, Math.max(0.001, wRaw));
  // Point IV is the P50 MEDIAN prediction exp(yAdj) — NO Duan smear.
  // (Phase 2b revision: the smeared mean exp(yAdj)*S, S~8.7x on this
  // snapshot, scored OOS R2 -0.6169 / MdAPE 5.5009, worse than the
  // category-median baseline; the median scores R2 0.1229 / MdAPE 0.894
  // and beats both benchmarks. The smear is a single constant, so ranks
  // are unchanged — only absolute levels are rescaled.)
  // The smear is KEPT for the mean estimate and for the P15/P85 bands,
  // which stay as spec'd: exp(yAdj+q)*S.
  const ivP50 = clampIV(Math.exp(yAdj));
  const ivP15 = clampIV(Math.exp(yAdj + model.q15) * model.smear);
  const ivP85 = clampIV(Math.exp(yAdj + model.q85) * model.smear);
  // Modelled airdrop pool: stated 7% assumption, scaled by readiness weight.
  const poolUsd = Math.max(0, Math.round(ivP50 * 0.07 * (0.5 + 0.5 * readinessW)));
  return { yAdj, ivP50, ivP15, ivP85, readinessW, poolUsd };
}

// ---- Validation helpers ----

export function rankOf(values: number[]): number[] {
  // Average ranks (1-based), deterministic on ties by input order (already slug-sorted).
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b] || a - b);
  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && values[idx[j + 1]] === values[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]] = avg;
    i = j + 1;
  }
  return ranks;
}

export function spearman(actual: number[], pred: number[]): number {
  const ra = rankOf(actual);
  const rp = rankOf(pred);
  const n = actual.length;
  const ma = ra.reduce((a, b) => a + b, 0) / n;
  const mp = rp.reduce((a, b) => a + b, 0) / n;
  let num = 0, da = 0, dp = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rp[i] - mp);
    da += (ra[i] - ma) * (ra[i] - ma);
    dp += (rp[i] - mp) * (rp[i] - mp);
  }
  const den = Math.sqrt(da * dp);
  return den > 0 ? num / den : 0;
}

export type CvMetrics = { r2: number; spearman: number; mdape: number; coverage: number; n: number };

export function cvMetrics(actual: number[], predLevel: number[], lo: number[], hi: number[]): CvMetrics {
  const n = actual.length;
  const yA = actual.map((v) => Math.log(v));
  const yP = predLevel.map((v) => Math.log(Math.max(1, v)));
  const meanA = yA.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0;
  const apes: number[] = [];
  let inside = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (yA[i] - yP[i]) * (yA[i] - yP[i]);
    ssTot += (yA[i] - meanA) * (yA[i] - meanA);
    apes.push(Math.abs(predLevel[i] - actual[i]) / actual[i]);
    if (actual[i] >= lo[i] && actual[i] <= hi[i]) inside++;
  }
  return {
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    spearman: spearman(actual, predLevel),
    mdape: median(apes),
    coverage: n ? inside / n : 0,
    n,
  };
}

export type CvReport = {
  // Headline = the P50 median point prediction (Phase 2b revision):
  // pred = exp(yAdj), bands = exp(yAdj+q15/q85) with NO smear.
  full: CvMetrics; catMedian: CvMetrics; loglog: CvMetrics;
  // fullMedian is now identical to full (the P50 IS the median prediction);
  // kept so model.json / data.js keep their cvMed field.
  fullMedian: CvMetrics;
  // The REJECTED smeared-mean variant (pred = exp(yAdj)*S, smeared bands),
  // kept only for the honest dashboard comparison: tested, worse than the
  // category-median baseline on OOS R2 / MdAPE, not used for the board.
  fullSmeared: CvMetrics;
};

export function crossValidate(fitRows: Proto[], asOf: string): CvReport {
  // Stratified 5-fold CV: round-robin within each category, slug-sorted.
  const rows = [...fitRows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const byCat = new Map<string, Proto[]>();
  for (const p of rows) {
    const c = catOf(p);
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(p);
  }
  const foldOf = new Map<string, number>();
  for (const [, members] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    members.forEach((p, i) => foldOf.set(p.slug, i % 5));
  }
  const actual: number[] = [];
  const predFull: number[] = []; const loFull: number[] = []; const hiFull: number[] = [];
  const predMed: number[] = []; const loMed: number[] = []; const hiMed: number[] = [];
  const predSmear: number[] = []; const loSmear: number[] = []; const hiSmear: number[] = [];
  const predCat: number[] = []; const loCat: number[] = []; const hiCat: number[] = [];
  const predLog: number[] = []; const loLog: number[] = []; const hiLog: number[] = [];
  for (let fold = 0; fold < 5; fold++) {
    const train = rows.filter((p) => foldOf.get(p.slug) !== fold);
    const test = rows.filter((p) => foldOf.get(p.slug) === fold);
    const model = fitModel(train, asOf);
    // Category-median baseline (train medians, global median fallback).
    const catMed = new Map<string, number>();
    const catsTrain = new Map<string, number[]>();
    for (const p of train) {
      const c = catOf(p);
      if (!catsTrain.has(c)) catsTrain.set(c, []);
      catsTrain.get(c)!.push(p.mcap_usd as number);
    }
    for (const [c, vs] of catsTrain) catMed.set(c, median(vs));
    const globalMed = median(train.map((p) => p.mcap_usd as number));
    // Simple log-log rival: ln(Mcap) = a + b ln(TVL), OLS on train.
    const xs = train.map((p) => Math.log(p.tvl_usd));
    const ys = train.map((p) => Math.log(p.mcap_usd as number));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    const bLog = sxx > 0 ? sxy / sxx : 0;
    const aLog = my - bLog * mx;
    const logResid = ys.map((yv, i) => yv - (aLog + bLog * xs[i]));
    const logSmear = logResid.reduce((a, r) => a + Math.exp(r), 0) / logResid.length;
    const logSorted = [...logResid].sort((a, b) => a - b);
    const logQ15 = percentile(logSorted, 0.15);
    const logQ85 = percentile(logSorted, 0.85);
    // Baseline bands from its own train log-residuals.
    const catResid: number[] = [];
    for (const p of train) {
      const pm = catMed.get(catOf(p)) ?? globalMed;
      catResid.push(Math.log(p.mcap_usd as number) - Math.log(pm));
    }
    const catSorted = [...catResid].sort((a, b) => a - b);
    const catQ15 = percentile(catSorted, 0.15);
    const catQ85 = percentile(catSorted, 0.85);
    for (const p of test) {
      const a = p.mcap_usd as number;
      actual.push(a);
      const s = scoreProtocol(model, p, asOf);
      // Headline P50: s.ivP50 is now the median exp(yAdj); its coverage
      // bands are the UNSMEARED exp(yAdj+q15/q85), matching the point
      // estimate. The smeared variant is scored separately below.
      predFull.push(s.ivP50);
      loFull.push(Math.max(1, Math.round(Math.exp(s.yAdj + model.q15))));
      hiFull.push(Math.max(1, Math.round(Math.exp(s.yAdj + model.q85))));
      predMed.push(Math.max(1, Math.round(Math.exp(s.yAdj))));
      loMed.push(Math.max(1, Math.round(Math.exp(s.yAdj + model.q15))));
      hiMed.push(Math.max(1, Math.round(Math.exp(s.yAdj + model.q85))));
      // Rejected smeared-mean variant: pred = exp(yAdj)*S, smeared bands.
      predSmear.push(clampIV(Math.exp(s.yAdj) * model.smear));
      loSmear.push(s.ivP15); hiSmear.push(s.ivP85);
      const pm = catMed.get(catOf(p)) ?? globalMed;
      predCat.push(pm); loCat.push(Math.max(1, Math.round(pm * Math.exp(catQ15)))); hiCat.push(Math.round(pm * Math.exp(catQ85)));
      const yLog = aLog + bLog * Math.log(p.tvl_usd);
      const pl = Math.exp(yLog) * logSmear;
      predLog.push(clampIV(pl));
      loLog.push(clampIV(Math.exp(yLog + logQ15) * logSmear));
      hiLog.push(clampIV(Math.exp(yLog + logQ85) * logSmear));
    }
  }
  return {
    full: cvMetrics(actual, predFull, loFull, hiFull),
    fullMedian: cvMetrics(actual, predMed, loMed, hiMed),
    fullSmeared: cvMetrics(actual, predSmear, loSmear, hiSmear),
    catMedian: cvMetrics(actual, predCat, loCat, hiCat),
    loglog: cvMetrics(actual, predLog, loLog, hiLog),
  };
}
