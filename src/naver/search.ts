import type { BlogCompetitionData, BlogPost } from "../analysis/types.js";

const API_BASE = "https://openapi.naver.com/v1/search/blog.json";

/**
 * Strip HTML tags
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

/**
 * Naver Blog Search API
 * Top 10 results for competition analysis
 */
export async function getBlogCompetition(
  keyword: string
): Promise<BlogCompetitionData> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Naver Developer API credentials. Set NAVER_CLIENT_ID, NAVER_CLIENT_SECRET.");
  }

  const params = new URLSearchParams({
    query: keyword,
    display: "10",
    start: "1",
    sort: "sim",
  });

  const response = await fetch(`${API_BASE}?${params}`, {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  const posts: BlogPost[] = (result.items || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => ({
      title: stripHtml(item.title),
      link: item.link,
      description: stripHtml(item.description),
      bloggername: item.bloggername,
      bloggerlink: item.bloggerlink,
      postdate: item.postdate,
    })
  );

  return {
    keyword,
    totalResults: result.total || 0,
    posts,
  };
}
