# korean-keyword-mcp

한국어 키워드 니치 분석 MCP 서버. 네이버 검색광고 API(CPC/경쟁지수/클릭률)를 노출하는 **유일한** MCP 서버입니다.

## 왜 필요한가?

| 기능 | korean-keyword-mcp | 다른 네이버 MCP 서버 |
|---|---|---|
| 검색광고 API (CPC, 경쟁지수) | **YES** | NO |
| 니치 스코어링 (0-100, A-F) | **YES** | NO |
| 블로그 경쟁 심층분석 | **YES** | 기본 검색만 |
| 키워드 확장 + 점수화 | **YES** | NO |
| 배치 비교 분석 | **YES** | NO |
| 상승 트렌드 키워드 발견 | **YES** | NO |

## 도구 (7개)

| 도구 | 설명 |
|------|------|
| `keyword_expand` | 시드 키워드 → 50+ 연관 키워드 Quick Score + 상위 N개 Full Score |
| `niche_score` | 단일 키워드 니치 분석 (0-100점 + A-F 등급) |
| `search_volume` | 네이버 검색광고 월간 검색량 (PC/모바일 분리, 경쟁지수) |
| `trend` | 네이버 데이터랩 12개월 검색 트렌드 (월별 상대값 0-100) |
| `blog_competition` | 블로그 경쟁도 분석 (총 결과 수 + 상위 10개 포스트) |
| `batch_analyze` | 최대 10개 키워드 병렬 니치 분석 + 정렬된 비교 테이블 |
| `trending_discover` | 시드 키워드의 연관 중 상승 트렌드만 필터링 |

## 점수 산정 알고리즘

**Full Niche Score (100점 만점)**

| 항목 | 비중 | 데이터 소스 |
|------|------|-------------|
| 검색량 | 20점 | 검색광고 API — 스윗스팟: 1K-30K |
| 경쟁도 | 30점 | 블로그 총 결과 수 + 블로거 다양성 |
| 신선도 | 15점 | 상위 글 평균 나이 (오래될수록 기회) |
| 트렌드 | 20점 | 12개월 선형 회귀 기울기 |
| 효율성 | 15점 | 검색량 / 블로그 수 비율 |

**등급**: A (75+), B (60+), C (45+), D (30+), F (<30)

## 설정 방법

### 1. 네이버 API 키 발급

**네이버 검색광고 API** (검색량, CPC, 경쟁지수):
1. [네이버 검색광고](https://searchad.naver.com) 접속
2. 계정 생성 → 도구 → API 라이선스
3. 고객 ID, API 키, Secret 키 확인

**네이버 개발자 API** (데이터랩 트렌드, 블로그 검색):
1. [네이버 개발자센터](https://developers.naver.com) 접속
2. 애플리케이션 등록 → "검색", "데이터랩" API 선택
3. Client ID, Client Secret 확인

### 2. Claude Desktop 설정

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "korean-keyword": {
      "command": "npx",
      "args": ["-y", "korean-keyword-mcp"],
      "env": {
        "NAVER_SEARCHAD_CUSTOMER_ID": "고객-ID",
        "NAVER_SEARCHAD_API_KEY": "API-키",
        "NAVER_SEARCHAD_SECRET_KEY": "시크릿-키",
        "NAVER_CLIENT_ID": "클라이언트-ID",
        "NAVER_CLIENT_SECRET": "클라이언트-시크릿"
      }
    }
  }
}
```

### 3. 확인

Claude Desktop을 재시작하면 MCP 서버 목록에 "korean-keyword"가 표시되며, 7개 도구를 사용할 수 있습니다.

## 사용 예시

연결 후 Claude에게 요청:

- "캠핑의자의 니치 가능성을 분석해줘" → `niche_score` 사용
- "다이어트 관련 니치 키워드를 찾아줘" → `keyword_expand` 사용
- "캠핑의자, 캠핑테이블, 캠핑조명을 비교 분석해줘" → `batch_analyze` 사용
- "캠핑 관련 상승 트렌드 키워드를 찾아줘" → `trending_discover` 사용
- "에어프라이어 검색량이 얼마야?" → `search_volume` 사용

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `NAVER_SEARCHAD_CUSTOMER_ID` | Yes | 검색광고 API 고객 ID |
| `NAVER_SEARCHAD_API_KEY` | Yes | 검색광고 API 키 |
| `NAVER_SEARCHAD_SECRET_KEY` | Yes | 검색광고 API 시크릿 |
| `NAVER_CLIENT_ID` | Yes | 네이버 개발자 클라이언트 ID |
| `NAVER_CLIENT_SECRET` | Yes | 네이버 개발자 클라이언트 시크릿 |

## 라이선스

MIT
