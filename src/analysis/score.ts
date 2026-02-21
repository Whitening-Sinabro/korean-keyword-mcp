import type {
  SearchVolumeData,
  BlogCompetitionData,
  TrendData,
  NicheScoreResult,
  NicheScoreBreakdown,
  NicheGrade,
} from "./types.js";

// ===== Weights (v2 tuning) =====
const WEIGHTS = {
  volume: 20,
  competition: 30,
  freshness: 15,
  trend: 20,
  efficiency: 15,
} as const;

// ===== 1. Volume score (20 points max) =====
// Sweet spot: 500 ~ 30,000
export function calcVolumeScore(totalSearches: number, weight: number = WEIGHTS.volume): number {
  if (totalSearches === 0) return 0;

  if (totalSearches >= 1000 && totalSearches <= 30000) {
    if (totalSearches >= 3000 && totalSearches <= 15000) {
      return weight; // peak
    }
    if (totalSearches < 3000) {
      return weight * (0.7 + 0.3 * ((totalSearches - 1000) / 2000));
    }
    return weight * (0.6 + 0.4 * ((30000 - totalSearches) / 15000));
  }

  if (totalSearches < 10) {
    return weight * 0.05;
  }
  if (totalSearches < 100) {
    return weight * (0.15 + 0.15 * ((totalSearches - 10) / 90));
  }
  if (totalSearches < 500) {
    return weight * (0.3 + 0.2 * ((totalSearches - 100) / 400));
  }
  if (totalSearches < 1000) {
    return weight * (0.5 + 0.2 * ((totalSearches - 500) / 500));
  }
  if (totalSearches <= 100000) {
    return weight * (0.5 * ((100000 - totalSearches) / 70000));
  }
  return weight * 0.05;
}

// ===== 2. Competition score (30 points max) =====
function calcCompetitionScore(blogData: BlogCompetitionData): number {
  const { totalResults, posts } = blogData;

  let totalScore: number;
  if (totalResults < 500) {
    totalScore = 1.0;
  } else if (totalResults < 3000) {
    totalScore = 1.0 - 0.15 * ((totalResults - 500) / 2500);
  } else if (totalResults < 10000) {
    totalScore = 0.85 - 0.2 * ((totalResults - 3000) / 7000);
  } else if (totalResults < 50000) {
    totalScore = 0.65 - 0.2 * ((totalResults - 10000) / 40000);
  } else if (totalResults < 200000) {
    totalScore = 0.45 - 0.2 * ((totalResults - 50000) / 150000);
  } else if (totalResults < 1000000) {
    totalScore = 0.25 - 0.15 * ((totalResults - 200000) / 800000);
  } else {
    totalScore = 0.1 - Math.min(0.08, 0.08 * ((totalResults - 1000000) / 9000000));
  }

  const uniqueBloggers = new Set(posts.map((p) => p.bloggerlink)).size;
  const diversityRatio = posts.length > 0 ? uniqueBloggers / posts.length : 1;
  const diversityBonus = diversityRatio >= 0.7 ? 1.0 : diversityRatio / 0.7;

  const combined = totalScore * 0.55 + diversityBonus * 0.45;
  return WEIGHTS.competition * combined;
}

// ===== 3. Content freshness score (15 points max) =====
function calcFreshnessScore(posts: BlogCompetitionData["posts"]): number {
  if (posts.length === 0) return WEIGHTS.freshness * 0.5;

  const now = new Date();
  const ageDays = posts.map((post) => {
    const year = parseInt(post.postdate.substring(0, 4));
    const month = parseInt(post.postdate.substring(4, 6)) - 1;
    const day = parseInt(post.postdate.substring(6, 8));
    const postDate = new Date(year, month, day);
    return (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
  });

  const avgAge = ageDays.reduce((a, b) => a + b, 0) / ageDays.length;

  if (avgAge > 365) return WEIGHTS.freshness * 1.0;
  if (avgAge > 180) return WEIGHTS.freshness * 0.85;
  if (avgAge > 90) return WEIGHTS.freshness * 0.65;
  if (avgAge > 60) return WEIGHTS.freshness * 0.5;
  if (avgAge > 30) return WEIGHTS.freshness * 0.35;
  return WEIGHTS.freshness * 0.15;
}

// ===== 4. Trend direction score (20 points max) =====
export function calcTrendScore(
  trendData: TrendData
): { score: number; slope: number; direction: "rising" | "stable" | "declining" } {
  const points = trendData.results;
  if (points.length < 3) {
    return { score: WEIGHTS.trend * 0.5, slope: 0, direction: "stable" };
  }

  const n = points.length;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.ratio);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  let direction: "rising" | "stable" | "declining";
  let score: number;

  if (slope > 2) {
    direction = "rising";
    score = WEIGHTS.trend * Math.min(1.0, 0.7 + slope / 20);
  } else if (slope > 0.5) {
    direction = "rising";
    score = WEIGHTS.trend * (0.55 + (slope - 0.5) / 3.3);
  } else if (slope >= -0.5) {
    direction = "stable";
    score = WEIGHTS.trend * 0.5;
  } else if (slope >= -2) {
    direction = "declining";
    score = WEIGHTS.trend * (0.25 + 0.25 * ((slope + 2) / 1.5));
  } else {
    direction = "declining";
    score = WEIGHTS.trend * 0.15;
  }

  return { score, slope, direction };
}

// ===== 5. Efficiency score (15 points max) =====
function calcEfficiencyScore(
  totalSearches: number,
  totalBlogPosts: number
): number {
  if (totalSearches === 0 || totalBlogPosts === 0) {
    return WEIGHTS.efficiency * 0.3;
  }

  const ratio = totalSearches / totalBlogPosts;

  if (ratio >= 1.0) return WEIGHTS.efficiency * 1.0;
  if (ratio >= 0.3) {
    return WEIGHTS.efficiency * (0.7 + 0.3 * ((ratio - 0.3) / 0.7));
  }
  if (ratio >= 0.1) {
    return WEIGHTS.efficiency * (0.45 + 0.25 * ((ratio - 0.1) / 0.2));
  }
  if (ratio >= 0.01) {
    return WEIGHTS.efficiency * (0.15 + 0.3 * ((ratio - 0.01) / 0.09));
  }
  if (ratio >= 0.001) {
    return WEIGHTS.efficiency * (0.05 + 0.1 * ((ratio - 0.001) / 0.009));
  }
  return WEIGHTS.efficiency * 0.02;
}

// ===== Grade =====
function getGrade(score: number): NicheGrade {
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "F";
}

// ===== Main: Calculate niche score =====
export function calculateNicheScore(
  searchVolume: SearchVolumeData,
  blogData: BlogCompetitionData,
  trendData: TrendData
): NicheScoreResult {
  const volumeScore = calcVolumeScore(searchVolume.totalMonthlySearches);
  const competitionScore = calcCompetitionScore(blogData);
  const freshnessScore = calcFreshnessScore(blogData.posts);
  const trendResult = calcTrendScore(trendData);
  const efficiencyScore = calcEfficiencyScore(
    searchVolume.totalMonthlySearches,
    blogData.totalResults
  );

  const breakdown: NicheScoreBreakdown = {
    volumeScore: Math.round(volumeScore * 10) / 10,
    competitionScore: Math.round((competitionScore + efficiencyScore) * 10) / 10,
    freshnessScore: Math.round(freshnessScore * 10) / 10,
    trendScore: Math.round(trendResult.score * 10) / 10,
  };

  const totalScore = Math.round(
    (breakdown.volumeScore +
      breakdown.competitionScore +
      breakdown.freshnessScore +
      breakdown.trendScore) *
      10
  ) / 10;

  const now = new Date();
  const avgPostAgeDays =
    blogData.posts.length > 0
      ? blogData.posts.reduce((sum, post) => {
          const year = parseInt(post.postdate.substring(0, 4));
          const month = parseInt(post.postdate.substring(4, 6)) - 1;
          const day = parseInt(post.postdate.substring(6, 8));
          const postDate = new Date(year, month, day);
          return sum + (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / blogData.posts.length
      : 0;

  return {
    keyword: searchVolume.keyword,
    totalScore,
    grade: getGrade(totalScore),
    breakdown,
    details: {
      searchVolume: searchVolume.totalMonthlySearches,
      totalBlogPosts: blogData.totalResults,
      avgPostAgeDays: Math.round(avgPostAgeDays),
      trendDirection: trendResult.direction,
      trendSlope: Math.round(trendResult.slope * 100) / 100,
    },
    analyzedAt: new Date().toISOString(),
  };
}
