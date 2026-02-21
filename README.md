# korean-keyword-mcp

MCP server for Korean keyword niche analysis. The **only** MCP server that exposes Naver SearchAd API data (CPC competition, click rates) for keyword research.

## Why This Exists

| Feature | korean-keyword-mcp | Other Naver MCP servers |
|---|---|---|
| SearchAd API (CPC, competition index) | **YES** | NO |
| Niche scoring (0-100, A-F grade) | **YES** | NO |
| Blog competition deep analysis | **YES** | Basic search only |
| Keyword expansion + scoring | **YES** | NO |
| Batch comparison analysis | **YES** | NO |
| Trending keyword discovery | **YES** | NO |

## Tools (7)

| Tool | Description |
|------|-------------|
| `keyword_expand` | Expand seed keyword → 50+ related keywords with Quick Score + top N Full Score |
| `niche_score` | Single keyword full niche analysis (0-100 score + A-F grade) |
| `search_volume` | Naver SearchAd monthly search volume (PC/mobile split, competition index) |
| `trend` | Naver DataLab 12-month search trend (monthly relative values 0-100) |
| `blog_competition` | Blog competition analysis (total results + top 10 posts) |
| `batch_analyze` | Batch niche analysis for up to 10 keywords with sorted comparison |
| `trending_discover` | Discover rising-trend keywords from seed keyword's related keywords |

## Scoring Algorithm

**Full Niche Score (100 points)**

| Component | Weight | Source |
|-----------|--------|--------|
| Volume | 20 | SearchAd API — sweet spot: 1K-30K searches |
| Competition | 30 | Blog total results + blogger diversity |
| Freshness | 15 | Average post age (older = less competition) |
| Trend | 20 | 12-month linear regression slope |
| Efficiency | 15 | Search volume / blog post ratio |

**Grades**: A (75+), B (60+), C (45+), D (30+), F (<30)

## Setup

### 1. Get Naver API Keys

You need two sets of API credentials:

**Naver SearchAd API** (for search volume, CPC, competition):
1. Go to [Naver SearchAd](https://searchad.naver.com)
2. Create an account → Tools → API License
3. Note your Customer ID, API Key, and Secret Key

**Naver Developer API** (for DataLab trends, blog search):
1. Go to [Naver Developers](https://developers.naver.com)
2. Register application → Select "Search" and "DataLab" APIs
3. Note your Client ID and Client Secret

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "korean-keyword": {
      "command": "npx",
      "args": ["-y", "korean-keyword-mcp"],
      "env": {
        "NAVER_SEARCHAD_CUSTOMER_ID": "your-customer-id",
        "NAVER_SEARCHAD_API_KEY": "your-api-key",
        "NAVER_SEARCHAD_SECRET_KEY": "your-secret-key",
        "NAVER_CLIENT_ID": "your-client-id",
        "NAVER_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### 3. Verify

Restart Claude Desktop. You should see "korean-keyword" in the MCP servers list with 7 tools available.

## Example Usage

Once connected, you can ask Claude:

- "Analyze the niche potential of '캠핑의자'" → uses `niche_score`
- "Find niche keywords related to '다이어트'" → uses `keyword_expand`
- "Compare these keywords: 캠핑의자, 캠핑테이블, 캠핑조명" → uses `batch_analyze`
- "What keywords related to '캠핑' are trending up?" → uses `trending_discover`
- "How much search volume does '에어프라이어' get?" → uses `search_volume`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NAVER_SEARCHAD_CUSTOMER_ID` | Yes | SearchAd API customer ID |
| `NAVER_SEARCHAD_API_KEY` | Yes | SearchAd API key |
| `NAVER_SEARCHAD_SECRET_KEY` | Yes | SearchAd API secret |
| `NAVER_CLIENT_ID` | Yes | Naver Developer client ID |
| `NAVER_CLIENT_SECRET` | Yes | Naver Developer client secret |

## License

MIT
