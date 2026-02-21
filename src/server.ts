import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getSearchVolume } from "./naver/searchad.js";
import { getTrend } from "./naver/datalab.js";
import { getBlogCompetition } from "./naver/search.js";
import { calculateNicheScore, calcTrendScore } from "./analysis/score.js";
import { calcQuickScore } from "./analysis/quick-score.js";
import type {
  NicheScoreResult,
  QuickScoreResult,
  TrendData,
} from "./analysis/types.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "korean-keyword-mcp",
    version: "1.0.0",
    description: "Korean keyword niche analysis using Naver SearchAd, DataLab, and Blog Search APIs",
  });

  // ─── Tool 1: keyword_expand ────────────────────────────────────
  server.tool(
    "keyword_expand",
    "Expand seed keyword into 50+ related keywords with Quick Score, and calculate Full Niche Score for top N candidates. Returns niche opportunities ranked by score.",
    {
      keyword: z.string().min(1).max(40).describe("Seed keyword to analyze (Korean or English, 1-40 chars)"),
      fullScoreCount: z.number().min(1).max(20).default(10).describe("Number of top keywords for Full Score (default 10)"),
    },
    async ({ keyword, fullScoreCount }) => {
      const startTime = Date.now();
      const apiCalls = { searchAd: 0, dataLab: 0, blogSearch: 0 };

      const searchVolumeData = await getSearchVolume(keyword);
      apiCalls.searchAd += keyword.includes(" ") ? 2 : 1;

      const relatedKeywords = searchVolumeData.relatedKeywords;
      if (relatedKeywords.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: `No related keywords found for "${keyword}". Try a more general keyword.` }),
          }],
        };
      }

      let seedTrendData: TrendData | null = null;
      try {
        seedTrendData = await getTrend(keyword);
        apiCalls.dataLab += 1;
      } catch {
        // trend failure → neutral score
      }

      const quickScores: QuickScoreResult[] = relatedKeywords
        .map((kw) => calcQuickScore(kw, seedTrendData, keyword))
        .sort((a, b) => b.quickScore - a.quickScore);

      const topCandidates = quickScores.slice(0, fullScoreCount);
      const fullScores: NicheScoreResult[] = [];

      const promises = topCandidates.map(async (candidate) => {
        try {
          const kwData = relatedKeywords.find((k) => k.relKeyword === candidate.keyword);
          if (!kwData) return null;

          const totalSearches = kwData.monthlyPcQcCnt + kwData.monthlyMobileQcCnt;
          const [trendData, blogData] = await Promise.all([
            getTrend(candidate.keyword),
            getBlogCompetition(candidate.keyword),
          ]);

          apiCalls.dataLab += 1;
          apiCalls.blogSearch += 1;

          return calculateNicheScore(
            {
              keyword: candidate.keyword,
              totalMonthlySearches: totalSearches,
              pcSearches: kwData.monthlyPcQcCnt,
              mobileSearches: kwData.monthlyMobileQcCnt,
              competitionIndex: kwData.compIdx,
              relatedKeywords: [],
            },
            blogData,
            trendData
          );
        } catch {
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      let fullScoreFailed = 0;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          fullScores.push(r.value);
        } else {
          fullScoreFailed += 1;
        }
      }
      fullScores.sort((a, b) => b.totalScore - a.totalScore);

      const output = {
        seedKeyword: keyword,
        quickScoresCount: quickScores.length,
        quickScoresTop10: quickScores.slice(0, 10).map((q) => ({
          keyword: q.keyword,
          quickScore: q.quickScore,
          totalSearches: q.totalSearches,
          compIdx: q.compIdx,
        })),
        fullScores: fullScores.map((f) => ({
          keyword: f.keyword,
          totalScore: f.totalScore,
          grade: f.grade,
          breakdown: f.breakdown,
          details: f.details,
        })),
        metadata: {
          totalRelated: relatedKeywords.length,
          quickScored: quickScores.length,
          fullScored: fullScores.length,
          fullScoreFailed,
          durationMs: Date.now() - startTime,
          apiCalls,
        },
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // ─── Tool 2: niche_score ───────────────────────────────────────
  server.tool(
    "niche_score",
    "Calculate full niche score for a single keyword. Analyzes search volume (Naver SearchAd), blog competition, and 12-month trend to produce a 0-100 score with A-F grade.",
    {
      keyword: z.string().min(1).max(40).describe("Keyword to analyze"),
    },
    async ({ keyword }) => {
      const [searchVolume, trendData, blogData] = await Promise.all([
        getSearchVolume(keyword),
        getTrend(keyword),
        getBlogCompetition(keyword),
      ]);

      const result = calculateNicheScore(searchVolume, blogData, trendData);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            {
              keyword: result.keyword,
              totalScore: result.totalScore,
              grade: result.grade,
              breakdown: result.breakdown,
              details: result.details,
              analyzedAt: result.analyzedAt,
            },
            null,
            2
          ),
        }],
      };
    }
  );

  // ─── Tool 3: search_volume ─────────────────────────────────────
  server.tool(
    "search_volume",
    "Get monthly search volume from Naver SearchAd API. Returns PC/mobile breakdown, competition index (CPC level), and top 20 related keywords with their volumes.",
    {
      keyword: z.string().min(1).max(40).describe("Keyword to search"),
    },
    async ({ keyword }) => {
      const data = await getSearchVolume(keyword);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            {
              keyword: data.keyword,
              totalMonthlySearches: data.totalMonthlySearches,
              pcSearches: data.pcSearches,
              mobileSearches: data.mobileSearches,
              competitionIndex: data.competitionIndex,
              relatedKeywordsCount: data.relatedKeywords.length,
              topRelated: data.relatedKeywords.slice(0, 20).map((k) => ({
                keyword: k.relKeyword,
                totalSearches: k.monthlyPcQcCnt + k.monthlyMobileQcCnt,
                compIdx: k.compIdx,
              })),
            },
            null,
            2
          ),
        }],
      };
    }
  );

  // ─── Tool 4: trend ─────────────────────────────────────────────
  server.tool(
    "trend",
    "Get 12-month search trend from Naver DataLab. Returns monthly relative values (0-100) showing how search interest changed over time.",
    {
      keyword: z.string().min(1).max(40).describe("Keyword to search"),
    },
    async ({ keyword }) => {
      const data = await getTrend(keyword);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
  );

  // ─── Tool 5: blog_competition ──────────────────────────────────
  server.tool(
    "blog_competition",
    "Analyze blog competition for a keyword using Naver Search API. Returns total blog post count and top 10 posts with metadata (title, blogger, date).",
    {
      keyword: z.string().min(1).max(40).describe("Keyword to search"),
    },
    async ({ keyword }) => {
      const data = await getBlogCompetition(keyword);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            {
              keyword: data.keyword,
              totalResults: data.totalResults,
              posts: data.posts.map((p) => ({
                title: p.title,
                bloggername: p.bloggername,
                postdate: p.postdate,
              })),
            },
            null,
            2
          ),
        }],
      };
    }
  );

  // ─── Tool 6: batch_analyze ─────────────────────────────────────
  server.tool(
    "batch_analyze",
    "Batch niche analysis for up to 10 keywords. Calculates full niche score for each keyword in parallel and returns a sorted comparison table. Useful for comparing multiple keyword candidates at once.",
    {
      keywords: z.array(z.string().min(1).max(40)).min(1).max(10).describe("List of keywords to analyze (1-10)"),
    },
    async ({ keywords }) => {
      const startTime = Date.now();

      const promises = keywords.map(async (keyword) => {
        try {
          const [searchVolume, trendData, blogData] = await Promise.all([
            getSearchVolume(keyword),
            getTrend(keyword),
            getBlogCompetition(keyword),
          ]);
          return calculateNicheScore(searchVolume, blogData, trendData);
        } catch (err) {
          return {
            keyword,
            error: err instanceof Error ? err.message : "Analysis failed",
          };
        }
      });

      const results = await Promise.allSettled(promises);
      const scores: NicheScoreResult[] = [];
      const errors: { keyword: string; error: string }[] = [];

      for (const r of results) {
        if (r.status === "fulfilled") {
          if ("totalScore" in r.value) {
            scores.push(r.value as NicheScoreResult);
          } else {
            errors.push(r.value as { keyword: string; error: string });
          }
        }
      }

      scores.sort((a, b) => b.totalScore - a.totalScore);

      const output = {
        results: scores.map((s) => ({
          keyword: s.keyword,
          totalScore: s.totalScore,
          grade: s.grade,
          breakdown: s.breakdown,
          details: s.details,
        })),
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: keywords.length,
          analyzed: scores.length,
          failed: errors.length,
          bestKeyword: scores[0]?.keyword || null,
          bestScore: scores[0]?.totalScore || null,
          bestGrade: scores[0]?.grade || null,
          durationMs: Date.now() - startTime,
        },
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // ─── Tool 7: trending_discover ─────────────────────────────────
  server.tool(
    "trending_discover",
    "Discover rising-trend keywords from a seed keyword's related keywords. Expands the seed, then filters only keywords with upward 12-month trends. Returns opportunities sorted by trend strength.",
    {
      keyword: z.string().min(1).max(40).describe("Seed keyword to expand"),
      limit: z.number().min(1).max(20).default(10).describe("Max trending keywords to return (default 10)"),
    },
    async ({ keyword, limit }) => {
      const startTime = Date.now();

      // Get related keywords
      const searchVolumeData = await getSearchVolume(keyword);
      const relatedKeywords = searchVolumeData.relatedKeywords;

      if (relatedKeywords.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: `No related keywords found for "${keyword}".` }),
          }],
        };
      }

      // Filter to keywords with decent volume (>= 50 total searches)
      const candidates = relatedKeywords
        .filter((kw) => kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt >= 50)
        .slice(0, 30); // Check up to 30 for trends

      // Fetch trend data for each candidate in parallel
      const trendPromises = candidates.map(async (kw) => {
        try {
          const trendData = await getTrend(kw.relKeyword);
          const trendResult = calcTrendScore(trendData);
          return {
            keyword: kw.relKeyword,
            totalSearches: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
            pcSearches: kw.monthlyPcQcCnt,
            mobileSearches: kw.monthlyMobileQcCnt,
            compIdx: kw.compIdx,
            trendDirection: trendResult.direction,
            trendSlope: Math.round(trendResult.slope * 100) / 100,
            trendScore: Math.round(trendResult.score * 10) / 10,
            recentTrend: trendData.results.slice(-3).map((p) => ({
              period: p.period,
              ratio: p.ratio,
            })),
          };
        } catch {
          return null;
        }
      });

      const trendResults = await Promise.allSettled(trendPromises);
      const risingKeywords = trendResults
        .filter((r) => r.status === "fulfilled" && r.value !== null && r.value.trendDirection === "rising")
        .map((r) => (r as PromiseFulfilledResult<NonNullable<Awaited<(typeof trendPromises)[number]>>>).value)
        .sort((a, b) => b.trendSlope - a.trendSlope)
        .slice(0, limit);

      const output = {
        seedKeyword: keyword,
        risingKeywords,
        summary: {
          totalRelated: relatedKeywords.length,
          candidatesChecked: candidates.length,
          risingFound: risingKeywords.length,
          durationMs: Date.now() - startTime,
        },
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  return server;
}
