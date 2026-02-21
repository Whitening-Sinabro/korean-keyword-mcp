import type { SearchAdKeywordResult, TrendData, QuickScoreResult } from "./types.js";
import { calcVolumeScore } from "./score.js";

// Quick Score weights (100 points from SearchAd metadata only)
const QS_WEIGHTS = {
  volume: 30,
  competition: 25,
  efficiency: 25,
  trendApprox: 20,
} as const;

// compIdx string → multiplier
const COMP_IDX_MAP: Record<string, number> = {
  높음: 0.2,
  중간: 0.5,
  낮음: 1.0,
};

/**
 * Competition score (25 points max)
 * Lower compIdx = more niche opportunity = higher score
 */
function calcCompScore(compIdx: string): number {
  const ratio = COMP_IDX_MAP[compIdx] ?? 0.5;
  return QS_WEIGHTS.competition * ratio;
}

/**
 * Efficiency score (25 points max)
 * Search volume / estimated competition ratio
 */
function calcEfficiencyScore(totalSearches: number, compIdx: string): number {
  if (totalSearches === 0) return QS_WEIGHTS.efficiency * 0.1;

  const compMultiplier: Record<string, number> = {
    높음: 50000,
    중간: 10000,
    낮음: 2000,
  };
  const estimatedBlogs = compMultiplier[compIdx] ?? 10000;
  const ratio = totalSearches / estimatedBlogs;

  if (ratio >= 1.0) return QS_WEIGHTS.efficiency * 1.0;
  if (ratio >= 0.3) return QS_WEIGHTS.efficiency * (0.6 + 0.4 * ((ratio - 0.3) / 0.7));
  if (ratio >= 0.1) return QS_WEIGHTS.efficiency * (0.35 + 0.25 * ((ratio - 0.1) / 0.2));
  if (ratio >= 0.01) return QS_WEIGHTS.efficiency * (0.1 + 0.25 * ((ratio - 0.01) / 0.09));
  return QS_WEIGHTS.efficiency * 0.05;
}

/**
 * Trend approximation score (20 points max)
 * Uses seed keyword's trend data for all related keywords
 */
function calcTrendApproxScore(seedTrendData: TrendData | null): number {
  if (!seedTrendData || seedTrendData.results.length < 3) {
    return QS_WEIGHTS.trendApprox * 0.5;
  }

  const points = seedTrendData.results;
  const n = points.length;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.ratio);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (slope > 2) return QS_WEIGHTS.trendApprox * Math.min(1.0, 0.7 + slope / 20);
  if (slope > 0.5) return QS_WEIGHTS.trendApprox * (0.55 + (slope - 0.5) / 3.3);
  if (slope >= -0.5) return QS_WEIGHTS.trendApprox * 0.5;
  if (slope >= -2) return QS_WEIGHTS.trendApprox * (0.25 + 0.25 * ((slope + 2) / 1.5));
  return QS_WEIGHTS.trendApprox * 0.15;
}

/**
 * Seed relevance bonus (max +5 points)
 * Bonus if keyword contains seed words
 */
function calcSeedRelevanceBonus(keyword: string, seed: string | null): number {
  if (!seed) return 0;
  const seedParts = seed.trim().replace(/\s+/g, "").toLowerCase();
  const kwLower = keyword.toLowerCase();

  if (kwLower.includes(seedParts)) return 5;

  const parts = seed.trim().split(/\s+/);
  if (parts.length > 1) {
    const matchCount = parts.filter((p) => kwLower.includes(p.toLowerCase())).length;
    if (matchCount === parts.length) return 4;
    if (matchCount > 0) return 2 * (matchCount / parts.length);
  }

  return 0;
}

/**
 * Quick Score calculation
 * Fast keyword scoring using SearchAd metadata + seed trend
 */
export function calcQuickScore(
  kw: SearchAdKeywordResult,
  seedTrendData: TrendData | null,
  seed: string | null = null
): QuickScoreResult {
  const totalSearches = kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt;

  const volumeScore = calcVolumeScore(totalSearches, QS_WEIGHTS.volume);
  const compScore = calcCompScore(kw.compIdx);
  const efficiencyScore = calcEfficiencyScore(totalSearches, kw.compIdx);
  const trendApproxScore = calcTrendApproxScore(seedTrendData);
  const relevanceBonus = calcSeedRelevanceBonus(kw.relKeyword, seed);

  const quickScore =
    Math.round(
      (volumeScore + compScore + efficiencyScore + trendApproxScore + relevanceBonus) * 10
    ) / 10;

  return {
    keyword: kw.relKeyword,
    totalSearches,
    pcSearches: kw.monthlyPcQcCnt,
    mobileSearches: kw.monthlyMobileQcCnt,
    compIdx: kw.compIdx,
    quickScore,
    breakdown: {
      volumeScore: Math.round(volumeScore * 10) / 10,
      compScore: Math.round(compScore * 10) / 10,
      efficiencyScore: Math.round(efficiencyScore * 10) / 10,
      trendApproxScore: Math.round(trendApproxScore * 10) / 10,
    },
  };
}
