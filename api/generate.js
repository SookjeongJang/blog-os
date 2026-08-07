export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 사용할 수 있어요." });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel에 OPENAI_API_KEY 환경변수가 아직 등록되지 않았어요."
    });
  }

  const { category = "", title = "", point = "" } = req.body || {};

  if (!title.trim()) {
    return res.status(400).json({ error: "제목이 필요해요." });
  }

  const prompt = `
너는 한국어 SEO 정보 블로그 편집자다.

아래 주제로 Blogger에 바로 붙여 넣을 수 있는 고품질 HTML 초안을 작성하라.

카테고리: ${category}
제목: ${title}
핵심 포인트: ${point}

중요 규칙:
- HTML 본문만 출력한다. 마크다운 코드블록은 금지한다.
- h1은 넣지 않는다. 게시물 제목은 Blogger가 따로 표시한다.
- h2, h3, p, ul, li, table 등을 자연스럽게 사용한다.
- 읽기 쉬운 한국어로 작성한다.
- 검색 사용자의 질문에 먼저 답한다.
- 과장, 낚시성 표현, 확인되지 않은 사실을 만들지 않는다.
- 날짜, 금액, 신청기간, 금리, 대상 조건 등 최신 확인이 필요한 정보가 입력에 없다면 임의로 만들지 말고
  "<strong>최신 정보 확인 필요</strong>"라고 표시한다.
- 금융/정부지원/세금 등 중요한 내용은 공식 기관 확인이 필요하다는 짧은 안내를 넣는다.
- 핵심 요약, 본문, 주의사항, FAQ 3개를 포함한다.
- 불필요하게 같은 말을 반복하지 않는다.
- 약 1,500~2,000자 수준의 실용적인 초안으로 작성한다.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
        max_output_tokens: 3000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI API 요청에 실패했어요."
      });
    }

    let html = "";

    if (typeof data.output_text === "string") {
      html = data.output_text;
    }

    if (!html && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === "output_text" && typeof part.text === "string") {
            html += part.text;
          }
        }
      }
    }

    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    if (!html) {
      return res.status(502).json({ error: "AI가 빈 응답을 반환했어요. 다시 시도해 주세요." });
    }

    return res.status(200).json({ html });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "서버에서 AI 요청을 처리하는 중 오류가 발생했어요."
    });
  }
}
