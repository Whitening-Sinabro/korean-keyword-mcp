import crypto from "crypto";
import type { SearchAdKeywordResult, SearchVolumeData } from "../analysis/types.js";

const API_BASE = "https://api.searchad.naver.com";

/**
 * HMAC-SHA256 signature for Naver SearchAd API authentication
 */
function generateSignature(
  timestamp: string,
  method: string,
  path: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${path}`;
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(message);
  return hmac.digest("base64");
}

/**
 * Common request headers for SearchAd API
 */
function getHeaders(method: string, path: string) {
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID;
  const apiKey = process.env.NAVER_SEARCHAD_API_KEY;
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY;

  if (!customerId || !apiKey || !secretKey) {
    throw new Error("Missing Naver SearchAd API credentials. Set NAVER_SEARCHAD_CUSTOMER_ID, NAVER_SEARCHAD_API_KEY, NAVER_SEARCHAD_SECRET_KEY.");
  }

  const timestamp = String(Date.now());
  const signature = generateSignature(timestamp, method, path, secretKey);

  return {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Timestamp": timestamp,
    "X-API-KEY": apiKey,
    "X-Customer": customerId,
    "X-Signature": signature,
  };
}

/**
 * Parse strings like "< 10" to numbers
 */
function parseSearchCount(value: string | number): number {
  if (typeof value === "number") return value;
  const str = String(value).trim();
  if (str === "< 10") return 5;
  return parseInt(str.replace(/,/g, ""), 10) || 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseKeywordList(items: any[]): SearchAdKeywordResult[] {
  return items.map((item) => ({
    relKeyword: item.relKeyword,
    monthlyPcQcCnt: parseSearchCount(item.monthlyPcQcCnt),
    monthlyMobileQcCnt: parseSearchCount(item.monthlyMobileQcCnt),
    monthlyAvePcClkCnt: parseSearchCount(item.monthlyAvePcClkCnt),
    monthlyAveMobileClkCnt: parseSearchCount(item.monthlyAveMobileClkCnt),
    monthlyAvePcCtr: Number(item.monthlyAvePcCtr) || 0,
    monthlyAveMobileCtr: Number(item.monthlyAveMobileCtr) || 0,
    plAvgDepth: Number(item.plAvgDepth) || 0,
    compIdx: item.compIdx || "낮음",
  }));
}

/**
 * Single hintKeywords API call
 */
async function fetchKeywordTool(
  hintValue: string
): Promise<SearchAdKeywordResult[]> {
  const path = "/keywordstool";
  const headers = getHeaders("GET", path);
  const queryString = `hintKeywords=${encodeURIComponent(hintValue)}&showDetail=1`;
  const url = `${API_BASE}${path}?${queryString}`;

  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SearchAd API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  return parseKeywordList(result.keywordList || []);
}

/**
 * Find best matching keyword from results
 */
function findBestMatch(
  keywords: SearchAdKeywordResult[],
  original: string
): SearchAdKeywordResult | undefined {
  const noSpace = original.replace(/\s+/g, "");
  const parts = original.trim().split(/\s+/);

  // 1. Exact match (spaces removed)
  const exact = keywords.find((k) => k.relKeyword === noSpace);
  if (exact) return exact;

  // 2. All words included
  const allParts = keywords.find((k) =>
    parts.every((p) => k.relKeyword.includes(p))
  );
  if (allParts) return allParts;

  // 3. Best partial match
  if (parts.length > 1) {
    let bestCount = 0;
    let bestMatch: SearchAdKeywordResult | undefined;
    for (const kw of keywords) {
      const count = parts.filter((p) => kw.relKeyword.includes(p)).length;
      if (count > bestCount) {
        bestCount = count;
        bestMatch = kw;
      }
    }
    if (bestMatch && bestCount >= Math.ceil(parts.length / 2)) {
      return bestMatch;
    }
  }

  return undefined;
}

/**
 * Get keyword search volume — 2-stage strategy
 *
 * Stage 1: Single keyword (spaces removed) — exact match
 * Stage 2: If volume < 100, retry with comma-separated words — broad match
 */
export async function getSearchVolume(
  keyword: string
): Promise<SearchVolumeData> {
  const noSpaceKeyword = keyword.trim().replace(/\s+/g, "");
  const hasSpaces = keyword.trim().includes(" ");

  // === Stage 1: Single keyword ===
  const step1Keywords = await fetchKeywordTool(noSpaceKeyword);
  const step1Match = step1Keywords.find((k) => k.relKeyword === noSpaceKeyword);
  const step1Volume = step1Match
    ? step1Match.monthlyPcQcCnt + step1Match.monthlyMobileQcCnt
    : 0;

  if (step1Volume >= 100) {
    return {
      keyword,
      totalMonthlySearches: step1Volume,
      pcSearches: step1Match!.monthlyPcQcCnt,
      mobileSearches: step1Match!.monthlyMobileQcCnt,
      competitionIndex: step1Match!.compIdx,
      relatedKeywords: step1Keywords,
    };
  }

  // === Stage 2: Comma-separated (multi-word only) ===
  if (hasSpaces) {
    const commaValue = keyword.trim().split(/\s+/).filter(Boolean).join(",");
    const step2Keywords = await fetchKeywordTool(commaValue);
    const step2Match = findBestMatch(step2Keywords, keyword);

    if (step2Match) {
      const step2Volume =
        step2Match.monthlyPcQcCnt + step2Match.monthlyMobileQcCnt;

      if (step2Volume > step1Volume) {
        return {
          keyword,
          totalMonthlySearches: step2Volume,
          pcSearches: step2Match.monthlyPcQcCnt,
          mobileSearches: step2Match.monthlyMobileQcCnt,
          competitionIndex: step2Match.compIdx,
          relatedKeywords: mergeKeywords(step1Keywords, step2Keywords),
        };
      }
    }
  }

  // Fallback to stage 1
  const fallback = step1Match || step1Keywords[0];
  return {
    keyword,
    totalMonthlySearches: fallback
      ? fallback.monthlyPcQcCnt + fallback.monthlyMobileQcCnt
      : 0,
    pcSearches: fallback?.monthlyPcQcCnt || 0,
    mobileSearches: fallback?.monthlyMobileQcCnt || 0,
    competitionIndex: fallback?.compIdx || "낮음",
    relatedKeywords: step1Keywords,
  };
}

/**
 * Merge two keyword lists (deduplicated)
 */
function mergeKeywords(
  a: SearchAdKeywordResult[],
  b: SearchAdKeywordResult[]
): SearchAdKeywordResult[] {
  const seen = new Set(a.map((k) => k.relKeyword));
  const merged = [...a];
  for (const kw of b) {
    if (!seen.has(kw.relKeyword)) {
      merged.push(kw);
      seen.add(kw.relKeyword);
    }
  }
  return merged;
}
