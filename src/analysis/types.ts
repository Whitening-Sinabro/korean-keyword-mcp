// korean-keyword-mcp type definitions

/** Naver SearchAd API - Keyword search volume result */
export interface SearchAdKeywordResult {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: string; // "높음" | "중간" | "낮음"
}

export interface SearchVolumeData {
  keyword: string;
  totalMonthlySearches: number;
  pcSearches: number;
  mobileSearches: number;
  competitionIndex: string;
  relatedKeywords: SearchAdKeywordResult[];
}

/** Naver DataLab - Trend data */
export interface TrendPoint {
  period: string; // "2025-01"
  ratio: number;  // 0~100 relative value
}

export interface TrendData {
  keyword: string;
  startDate: string;
  endDate: string;
  timeUnit: "month" | "week" | "date";
  results: TrendPoint[];
}

/** Naver Search API - Blog competition */
export interface BlogPost {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string; // "yyyymmdd"
}

export interface BlogCompetitionData {
  keyword: string;
  totalResults: number;
  posts: BlogPost[];
}

/** Niche score breakdown */
export interface NicheScoreBreakdown {
  volumeScore: number;
  competitionScore: number;
  freshnessScore: number;
  trendScore: number;
}

export type NicheGrade = "A" | "B" | "C" | "D" | "F";

export interface NicheScoreResult {
  keyword: string;
  totalScore: number;
  grade: NicheGrade;
  breakdown: NicheScoreBreakdown;
  details: {
    searchVolume: number;
    totalBlogPosts: number;
    avgPostAgeDays: number;
    trendDirection: "rising" | "stable" | "declining";
    trendSlope: number;
  };
  analyzedAt: string;
}

/** Quick Score (SearchAd metadata only) */
export interface QuickScoreResult {
  keyword: string;
  totalSearches: number;
  pcSearches: number;
  mobileSearches: number;
  compIdx: string;
  quickScore: number;
  breakdown: {
    volumeScore: number;
    compScore: number;
    efficiencyScore: number;
    trendApproxScore: number;
  };
}

/** Keyword expansion result */
export interface ExpandResult {
  seedKeyword: string;
  quickScores: QuickScoreResult[];
  fullScores: NicheScoreResult[];
  metadata: {
    totalRelated: number;
    quickScored: number;
    fullScored: number;
    fullScoreFailed: number;
    durationMs: number;
    apiCalls: {
      searchAd: number;
      dataLab: number;
      blogSearch: number;
    };
  };
  analyzedAt: string;
}
