import type { TrendData, TrendPoint } from "../analysis/types.js";

const API_BASE = "https://openapi.naver.com/v1/datalab/search";

/**
 * Naver DataLab search trend API
 * POST method, 12-month monthly trend
 */
export async function getTrend(keyword: string): Promise<TrendData> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Naver Developer API credentials. Set NAVER_CLIENT_ID, NAVER_CLIENT_SECRET.");
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const body = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: "month",
    keywordGroups: [
      {
        groupName: keyword,
        keywords: [keyword],
      },
    ],
  };

  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataLab API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const group = result.results?.[0];

  const points: TrendPoint[] = (group?.data || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => ({
      period: item.period,
      ratio: Number(item.ratio) || 0,
    })
  );

  return {
    keyword,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: "month",
    results: points,
  };
}
