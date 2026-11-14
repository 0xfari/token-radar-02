// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the radar can rank: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown with the market's own values, never
// mixed into the ranked board. Wrapped, staked and bridged products of a token that already
// trades (WBTC, Binance staked ETH, USDT0) are set aside, never ranked.
//
// What radar-3 prices with, and what it refuses to pretend:
//   - The multiple is the snapshot's own: the median market-cap-to-TVL ratio of the traded
//     protocols in a protocol's own category (at least three comparables, else the global median),
//     clamped to [0.05, 1.20]. No protocol name is ever special-cased.
//   - Where a category has at least eight traded comparables, the multiple is tilted for size:
//     the category's own log-log slope of market cap on TVL, shrunk toward the global slope, moves
//     the multiple by at most a bounded factor (0.7-1.4x). Categories too thin to measure a slope
//     get no tilt at all. The tilt is small on purpose: the global fit's slope is 0.52 with an
//     R-squared of 0.19, so size alone explains a fifth of the variance, and a curve trusted
//     further than that crushes the biggest protocols to the 0.05 floor. The dashboard says so.
//   - The model is backtested, not just stated: leave-one-out over the traded protocols the
//     snapshot carries, refitting every time, gives a median pricing error near 93% and puts about
//     six in ten inside 2x. So each row carries a range, [implied / 2, implied x 2]: the board
//     prices an order of magnitude, and the range column says so.
//   - Growth, maturity and breadth ride on top, exactly as the bounty asks: the 7-day TVL change,
//     how long the protocol has run with no token, and how many chains it is live on.
//
//   implied = tvl_usd x fitted_multiple x growth_mult x maturity_mult x breadth_mult
//
//   growth_mult   = 1 + clamp(change_7d, -50, 100) / 100 x 0.6
//   maturity_mult = 0.7 + min(age_days, 1095) / 1095 x 0.5   (age unknown: 365 days)
//   breadth_mult  = 1 + 0.02 x min(chains - 1, 4)
//   readiness     = 100 x (0.40 x growth_score + 0.35 x maturity + 0.25 x breadth),
//                   a farm-now signal from the same three figures, 0-100.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  mult_min: number;
  mult_max: number;
  min_comps: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_extra: number;
  tilt_min_comps: number;
  tilt_shrink: number;
  tilt_exp_max: number;
  tilt_factor_min: number;
  tilt_factor_max: number;
  range_factor: number;
}

export const MODEL: ModelConstants = {
  mult_min: 0.05,
  mult_max: 1.2,
  min_comps: 3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.5,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.02,
  breadth_max_extra: 4,
  tilt_min_comps: 8,
  tilt_shrink: 8,
  tilt_exp_max: 0.15,
  tilt_factor_min: 0.7,
  tilt_factor_max: 1.4,
  range_factor: 2,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  readiness: number;
  farm_capital_usd: number;
  farm_hold_days: number;
  model: {
    fitted_multiple: number;
    category_multiple: number;
    tilt_factor: number;
    comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page generates the farm plan from it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  readiness: number;
  farm_capital_usd: number;
  farm_hold_days: number;
  fitted_multiple: number;
  category_multiple: number;
  tilt_factor: number;
  comps: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol set aside from the ranked board, with why it does not belong on it. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** The fitted curve, for the dashboard's chart and methodology. */
export interface FitInfo {
  comps: number;
  slope: number;
  intercept: number;
  r_squared: number;
  resid_sd_dex: number;
}

/** The leave-one-out backtest, for the dashboard's methodology. */
export interface BacktestInfo {
  comps: number;
  median_abs_pct: number;
  within_2x_pct: number;
  within_1_5x_pct: number;
}

/** One category's pricing facts, for the dashboard's methodology table. */
export interface CategoryStat {
  category: string;
  comps: number;
  median_multiple: number;
  median_tvl_usd: number;
  tilt_exp: number | null;
}

/** One traded comparable, for the dashboard's fit chart (log10 axes). */
export interface ScatterPoint {
  x: number;
  y: number;
  c: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  fit: FitInfo;
  backtest: BacktestInfo;
  categories: CategoryStat[];
  scatter: ScatterPoint[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A traded comparable: a protocol the market has already priced (positive value, positive TVL). */
export function isComp(p: SnapshotProtocol): boolean {
  return typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** Least squares on log10(market cap) against log10(TVL): the fitted curve. */
export function ols(points: SnapshotProtocol[]): { intercept: number; slope: number } {
  const n = points.length;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += Math.log10(p.tvl_usd);
    my += Math.log10(p.mcap_usd!);
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    const dx = Math.log10(p.tvl_usd) - mx;
    sxy += dx * (Math.log10(p.mcap_usd!) - my);
    sxx += dx * dx;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/** The global fit's strength: R-squared and the residual spread in dex (log10 units). */
export function fitInfo(comps: SnapshotProtocol[]): FitInfo {
  const fit = ols(comps);
  const ys = comps.map((p) => Math.log10(p.mcap_usd!));
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of comps) {
    const pred = fit.intercept + fit.slope * Math.log10(p.tvl_usd);
    const r = Math.log10(p.mcap_usd!) - pred;
    ssRes += r * r;
    ssTot += (Math.log10(p.mcap_usd!) - my) ** 2;
  }
  return {
    comps: comps.length,
    slope: round4(fit.slope),
    intercept: round4(fit.intercept),
    r_squared: round3(ssTot === 0 ? 0 : 1 - ssRes / ssTot),
    resid_sd_dex: round3(Math.sqrt(ssRes / Math.max(1, comps.length))),
  };
}

/** The comparables grouped by category, each list in snapshot order. */
function compsByCategory(comps: SnapshotProtocol[]): Map<string, SnapshotProtocol[]> {
  const out = new Map<string, SnapshotProtocol[]>();
  for (const p of comps) {
    const key = p.category ?? 'Other';
    const list = out.get(key) ?? [];
    list.push(p);
    out.set(key, list);
  }
  return out;
}

/** A category's traded comparables, and the global list when the category has none. */
function categoryComps(byCat: Map<string, SnapshotProtocol[]>, category: string | null): SnapshotProtocol[] {
  return byCat.get(category ?? 'Other') ?? [];
}

/** The median market-cap-to-TVL ratio of a list of comparables, or NaN when it has none. */
function medianMultiple(list: SnapshotProtocol[]): number {
  if (list.length === 0) return NaN;
  return median(list.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b));
}

/**
 * The multiple one protocol is priced at: its category's median multiple, tilted for size
 * only where the category carries enough comparables to measure a slope. The tilt is the
 * category's log-log slope shrunk toward the global slope, its exponent clamped to
 * +/- tilt_exp_max, and the whole tilt factor clamped to [tilt_factor_min, tilt_factor_max],
 * so no protocol's multiple ever moves far from what its category's market says.
 */
export function fittedMultiple(
  protocol: SnapshotProtocol,
  comps: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { multiple: number; categoryMultiple: number; tilt: number; comps: number; tiltExp: number | null } {
  const byCat = compsByCategory(comps);
  const cat = categoryComps(byCat, protocol.category);
  const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const global = median(ratios);
  const catMedian = cat.length >= model.min_comps ? medianMultiple(cat) : NaN;
  const base = Number.isFinite(catMedian) ? catMedian : global;
  let tilt = 1;
  let tiltExp: number | null = null;
  if (cat.length >= model.tilt_min_comps) {
    const g = ols(comps);
    const c = ols(cat);
    const w = cat.length / (cat.length + model.tilt_shrink);
    const slope = w * c.slope + (1 - w) * g.slope;
    tiltExp = clamp(slope - 1, -model.tilt_exp_max, model.tilt_exp_max);
    const tmed = median(cat.map((p) => p.tvl_usd).sort((a, b) => a - b));
    tilt = clamp((protocol.tvl_usd / tmed) ** tiltExp, model.tilt_factor_min, model.tilt_factor_max);
  }
  return {
    multiple: clamp(base * tilt, model.mult_min, model.mult_max),
    categoryMultiple: clamp(base, model.mult_min, model.mult_max),
    tilt: round3(tilt),
    comps: cat.length,
    tiltExp: tiltExp === null ? null : round3(tiltExp),
  };
}

/**
 * The backtest: leave one traded protocol out, refit everything without it, price it, and
 * measure the error against the market's own value. The number the dashboard quotes, so a
 * reader can see how far to trust the board's implied values.
 */
export function backtest(comps: SnapshotProtocol[], model: ModelConstants = MODEL): BacktestInfo {
  const errors: number[] = [];
  for (const p of comps) {
    const rest = comps.filter((q) => q.slug !== p.slug);
    if (rest.length < model.min_comps) continue;
    const f = fittedMultiple(p, rest, model);
    const pred = p.tvl_usd * f.multiple;
    errors.push(Math.abs(pred - p.mcap_usd!) / p.mcap_usd!);
  }
  errors.sort((a, b) => a - b);
  const at = (q: number): number => errors[Math.min(errors.length - 1, Math.floor(q * errors.length))] ?? 0;
  return {
    comps: errors.length,
    median_abs_pct: Math.round(at(0.5) * 1000) / 10,
    within_2x_pct: Math.round((errors.filter((e) => e <= 1).length / Math.max(1, errors.length)) * 1000) / 10,
    within_1_5x_pct: Math.round((errors.filter((e) => e <= 0.5).length / Math.max(1, errors.length)) * 1000) / 10,
  };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comps: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): {
  implied: number;
  low: number;
  high: number;
  readiness: number;
  fit: { multiple: number; categoryMultiple: number; tilt: number; comps: number; tiltExp: number | null };
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const fit = fittedMultiple(protocol, comps, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + model.breadth_step * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * fit.multiple * growthMult * maturityMult * breadthMult));
  // Readiness: momentum, maturity and breadth on a 0-100 scale, from the same three figures.
  const gScore = clamp((rawGrowth + 20) / 70, 0, 1);
  const mScore = (age ?? model.unknown_age_days) / model.maturity_days;
  const bScore = Math.min(protocol.chains.length, 5) / 5;
  const readiness = Math.round(100 * (0.4 * gScore + 0.35 * clamp(mScore, 0, 1) + 0.25 * bScore));
  return {
    implied,
    low: Math.max(1, Math.round(implied / model.range_factor)),
    high: Math.max(1, Math.round(implied * model.range_factor)),
    readiness,
    fit,
    growthPct,
    growthMult,
    maturityMult,
    breadthMult,
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The categories the watchlist rule treats as a wrapped, staked or bridged product of a token
 * that already trades, never a protocol still waiting on a launch of its own.
 */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** The exchanges whose name at the start of a protocol's name marks it as their product. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

/**
 * Whether a protocol is a wrapped, staked or bridged product of a token that already trades:
 * WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in Binance's staking product, and
 * neither is a protocol still waiting on a launch of its own. The same rule the watchlist uses.
 */
export function isWrappedProduct(p: SnapshotProtocol): boolean {
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e));
}

/** Why a wrapped product is set aside, in the words the dashboard shows. */
export function setAsideReason(p: SnapshotProtocol): string {
  if (p.category === 'CEX') return 'A centralised exchange, not a protocol awaiting a token launch.';
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'A bridge moving a token that already trades.';
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') return 'A staked product of a token that already trades.';
  if (WRAPPED_WORD.test(p.name)) return 'A wrapped or staked product of a token that already trades.';
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return 'An exchange\u2019s own product, not a protocol awaiting a token launch.';
  return 'A wrapped or bridged product of a token that already trades.';
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not a wrapped, staked or bridged
 * product of a token that already trades, not an exchange, not a versioned pool.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedProduct(p) && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const comps = snapshot.protocols.filter(isComp);
  const watchSet = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, whatever its TVL. The floor is
  // never the whole board: a protocol below it is no worse a subject for the radar.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comps, model);
    const farm = farmPlan(p, v.age);
    return { p, ...v, farm };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watchSet.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    readiness: s.readiness,
    farm_capital_usd: s.farm.capital,
    farm_hold_days: s.farm.hold,
    model: {
      fitted_multiple: round4(s.fit.multiple),
      category_multiple: round4(s.fit.categoryMultiple),
      tilt_factor: s.fit.tilt,
      comps: s.fit.comps,
      growth_pct: round2(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: s.farm.steps.map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 120;
  return 75;
}

/** The gas of one transaction on a chain, in whole dollars: a plain fee table, not a quote. */
function gasFor(chain: string): number {
  if (chain === 'Ethereum') return 6;
  if (chain === 'Solana') return 0.05;
  if (chain === 'Hyperliquid L1') return 0.1;
  if (chain === 'Bitcoin') return 2;
  if (
    chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Base' || chain === 'Blast' ||
    chain === 'Linea' || chain === 'Scroll' || chain === 'Mantle' || chain === 'Polygon' ||
    chain === 'Sonic' || chain === 'Sui' || chain === 'Avalanche' || chain === 'Binance' ||
    chain === 'zkSync Era'
  ) return 0.5;
  return 1;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/**
 * One mechanism's three moves: the first position, the weekly repeat, and the milestone to
 * watch while holding. The mechanism is read off the snapshot's own category string, never
 * off a protocol's name, so the same rule covers every protocol in the category. `{capital}`
 * is the position's dollars, `{name}` the protocol's name.
 */
function mechanismFor(p: SnapshotProtocol): { action: string; weekly: string; watch: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('chain')) return {
    action: `Bridge {capital} to ${name} and use two of its native apps, so the wallet is active on the chain itself.`,
    weekly: 'Use one native app on the chain, such as a swap or a stake, so the wallet stays active.',
    watch: 'a native app that records the wallet as an early user',
  };
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return {
    action: `Supply {capital} to ${name} as a lender and keep the position open.`,
    weekly: 'Adjust the supply once, or add a small borrow against it, so the wallet keeps moving.',
    watch: 'the loan staying healthy, with collateral well above the liquidation line',
  };
  if (c.includes('dex') || c.includes('amm') || c.includes('swap') || c.includes('liquidity manager')) return {
    action: `Provide {capital} of liquidity to ${name}'s main pool and keep the position open.`,
    weekly: 'Swap a small amount through the pool, or rebalance the position, so the wallet keeps trading.',
    watch: 'the liquidity position staying in range and earning fees',
  };
  if (c.includes('bridge') || c.includes('cross chain')) return {
    action: `Bridge {capital} to another chain through ${name} and use the bridged funds in an app there.`,
    weekly: 'Bridge a small amount again, to a different chain when the route supports it.',
    watch: 'bridged volume building up across more than one destination chain',
  };
  if (c.includes('staking') || c.includes('restak')) return {
    action: `Stake {capital} of the chain's staking asset through ${name} and keep the receipt token.`,
    weekly: 'Top the stake up a little, or restake the rewards, so the position keeps growing.',
    watch: 'the stake accruing rewards without ever leaving the protocol',
  };
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis')) return {
    action: `Deposit {capital} as margin on ${name} and open one small hedged position.`,
    weekly: 'Open and close one small trade, keeping the margin posted between trades.',
    watch: 'trading volume that stays regular without blowing up the margin',
  };
  if (c.includes('prediction')) return {
    action: `Fund the account with {capital} and place one position on a ${name} market.`,
    weekly: 'Place one more small position, on a different market when one is open.',
    watch: 'positions across more than one market, not a single bet',
  };
  if (c.includes('yield') || c.includes('vault') || c.includes('curator') || c.includes('allocator') || c.includes('leveraged farm') || c.includes('farm')) return {
    action: `Deposit {capital} into a ${name} vault and keep the shares while they compound.`,
    weekly: 'Add a small top-up to the vault, or move shares to a second vault when one opens.',
    watch: 'the vault shares compounding instead of sitting idle',
  };
  if (c.includes('stable') || c.includes('algo-stable')) return {
    action: `Mint or deposit {capital} of the stable asset through ${name} and hold it.`,
    weekly: 'Use the stable asset once, such as a swap or a deposit, so the wallet is not just holding.',
    watch: 'the stable asset holding its peg while the position is open',
  };
  if (c.includes('rwa')) return {
    action: `Mint {capital} of the protocol's yield-bearing asset on its chain and hold it.`,
    weekly: 'Top the holding up a little, or use the asset as collateral where the protocol allows it.',
    watch: 'the yield asset accruing returns for the whole holding period',
  };
  if (c.includes('insurance')) return {
    action: `Buy {capital} of cover from ${name} and keep the policy for the whole holding period.`,
    weekly: 'Check the cover stays active, and renew it before it lapses.',
    watch: 'the policy staying live for the full period',
  };
  if (c.includes('launchpad') || c.includes('locker')) return {
    action: `Hold {capital} in the ${name} contract and join one launch through it.`,
    weekly: 'Keep the holding staked and join a new launch when one opens.',
    watch: 'participation in more than one launch, not a single one',
  };
  if (c.includes('payment') || c.includes('card')) return {
    action: `Fund the account with {capital} and make one real payment through ${name}.`,
    weekly: 'Make one more small payment, so the wallet shows repeated use.',
    watch: 'payments that repeat over weeks, not a single transfer',
  };
  if (c.includes('index') || c.includes('synthetic')) return {
    action: `Mint or buy {capital} of the index product through ${name} and hold it.`,
    weekly: 'Top the holding up a little, or rebalance it when the index rebalances.',
    watch: 'the holding tracking the index without long gaps',
  };
  return {
    action: `Deposit {capital} into ${name} and keep the position open.`,
    weekly: 'Repeat one qualifying action, such as a deposit, a swap, a vote or a borrow, so the wallet stays active.',
    watch: 'activity landing in more than one snapshot',
  };
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, plus the plan's
 * totals. The plan is derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names. The dashboard's page generates the same six steps
 * from the same rules, so the board and the page always agree.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): { steps: FarmStep[]; capital: number; hold: number; gasTotal: number } {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  const mech = mechanismFor(p);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const gasTotal = Math.round((gas * (2 + weeks) + 0.5) * 10) / 10;
  return {
    capital,
    hold,
    gasTotal,
    steps: [
      {
        text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
        cost: `under $${gas + 2} of gas for the first transaction`,
        time: '5 minutes',
      },
      {
        text: mech.action.split('{capital}').join(`$${capital} of USDC`),
        cost: `$${capital} of capital and about $${gas} of gas`,
        time: '15 minutes to set up',
      },
      {
        text: mech.weekly,
        cost: `about $${gas} of gas a week`,
        time: '10 minutes a week',
      },
      {
        text: `Hold the position for at least ${hold} days, watching for ${mech.watch}, so the activity lands in more than one snapshot.`,
        cost: `the $${capital} stays in the position`,
        time: `${hold} days`,
      },
      {
        text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
        cost: 'no fee to check, and never pay to claim',
        time: '10 minutes',
      },
      {
        text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
        cost: 'nothing but the log',
        time: '5 minutes',
      },
    ],
  };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    readiness: row.readiness,
    farm_capital_usd: row.farm_capital_usd,
    farm_hold_days: row.farm_hold_days,
    fitted_multiple: row.model.fitted_multiple,
    category_multiple: row.model.category_multiple,
    tilt_factor: row.model.tilt_factor,
    comps: row.model.comps,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watchlist: row.watchlist,
  };
}

/** The wrapped and bridged products set aside from the board, biggest first. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && isWrappedProduct(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, 12)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p),
    }));
}

/** One category's pricing facts, from the traded comparables. */
function categoryStats(comps: SnapshotProtocol[], model: ModelConstants): CategoryStat[] {
  const byCat = compsByCategory(comps);
  const global = ols(comps);
  const rows: CategoryStat[] = [];
  for (const [category, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (list.length < model.min_comps) continue;
    let tiltExp: number | null = null;
    if (list.length >= model.tilt_min_comps) {
      const c = ols(list);
      const w = list.length / (list.length + model.tilt_shrink);
      tiltExp = round3(clamp(w * c.slope + (1 - w) * global.slope - 1, -model.tilt_exp_max, model.tilt_exp_max));
    }
    rows.push({
      category,
      comps: list.length,
      median_multiple: round3(medianMultiple(list)),
      median_tvl_usd: median(list.map((p) => p.tvl_usd).sort((a, b) => a - b)),
      tilt_exp: tiltExp,
    });
  }
  return rows;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const comps = snapshot.protocols.filter(isComp);
  const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: round4(median(ratios)),
    fit: fitInfo(comps),
    backtest: backtest(comps, model),
    categories: categoryStats(comps, model),
    scatter: comps.map((p) => ({ x: round3(Math.log10(p.tvl_usd)), y: round3(Math.log10(p.mcap_usd!)), c: p.category ?? 'Other' })),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: snapshot.protocols.filter((p) => isPreToken(p) && isWrappedProduct(p)).length,
    rows: board.map(radarRow),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd > 0 && r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) {
      return `${r.slug} has a range that does not hold its implied value`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
