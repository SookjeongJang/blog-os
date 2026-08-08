function getOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  let text = "";
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (part.type === "output_text" && typeof part.text === "string") text += part.text;
      }
    }
  }
  return text.trim();
}

function parseJsonLoose(text) {
  let cleaned = String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("JSON을 찾지 못했습니다.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 사용할 수 있어요." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Vercel의 OPENAI_API_KEY 환경변수를 찾지 못했어요." });

  const requestedCount = Number(req.body?.count || 8);
  const count = Math.max(3, Math.min(10, requestedCount));
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

  const prompt = `
오늘은 대한민국 시간 기준 ${today}이다.
한국의 생활·경제 정보 블로그에 쓸 "지금 작성 가치가 높은 최신 글감"을 정확히 ${count}개 찾아라.
반드시 웹 검색으로 최신성을 확인하라.

관심 카테고리:
- 정부지원 / 복지 / 정책
- 경제 / 금리 / 물가
- 금융 / 세금
- 생활정보 / 공공서비스
- 지역축제 / 여행 / 예약정보

선정 기준:
1. 최근 발표, 신청 시작/마감 임박, 제도 변경, 일정 공개처럼 지금 검색할 이유가 있는 주제
2. 한국 사용자가 실제로 검색할 만한 실용적 주제
3. 정부부처, 공공기관, 한국은행, 금융위원회, 금융감독원, 국세청, 지자체, 공식 관광기관 등 1차 출처 우선
4. 단순 연예·사건사고·정치 공방 제외
5. 중복 주제 제외
6. 확인되지 않은 일정·금액·지원대상은 만들지 말 것

각 주제를 블로그 검색 유입용 제목으로 바꾸고 우선순위를 S/A/B로 평가하라.
score는 100점 만점 정수, freshness는 오늘/이번 주/이번 달/시즌 중 하나.
source_url은 실제로 확인한 핵심 출처 URL 하나를 넣어라.

반드시 아래 JSON 형식만 출력하라. 마크다운이나 설명은 추가하지 마라.
{
  "topics": [
    {
      "grade": "S",
      "score": 98,
      "category": "정부지원",
      "title": "블로그용 제목",
      "reason": "왜 지금 써야 하는지 한두 문장",
      "key_points": "글에 반드시 확인해서 넣을 핵심 정보",
      "freshness": "오늘",
      "source_name": "기관명 또는 사이트명",
      "source_url": "https://..."
    }
  ]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || "gpt-5.6",
        tools: [{
          type: "web_search",
          search_context_size: "low",
          user_location: { type: "approximate", country: "KR", region: "Seoul" }
        }],
        input: prompt,
        max_output_tokens: 3500
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI topic search error:", data);
      return res.status(response.status).json({ error: data?.error?.message || "OpenAI 웹 검색 요청에 실패했어요." });
    }

    const parsed = parseJsonLoose(getOutputText(data));
    if (!Array.isArray(parsed.topics)) return res.status(502).json({ error: "AI가 글감 목록을 올바른 형식으로 반환하지 않았어요. 다시 눌러보세요." });

    return res.status(200).json({ topics: parsed.topics.slice(0, count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "최신 글감을 찾는 중 서버 오류가 발생했어요." });
  }
}
