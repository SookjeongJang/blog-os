function getOutputText(data) {
  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  let text = "";

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item.content)) continue;

      for (const part of item.content) {
        if (
          part.type === "output_text" &&
          typeof part.text === "string"
        ) {
          text += part.text;
        }
      }
    }
  }

  return text.trim();
}


export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "POST 요청만 사용할 수 있어요."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY 환경변수를 찾지 못했어요."
    });
  }

  const {
    title = "",
    html = "",
    verification = null,
    source_url = "",
    source_name = ""
  } = req.body || {};

  if (!title.trim()) {
    return res.status(400).json({
      error: "제목이 필요해요."
    });
  }

  if (!html.trim()) {
    return res.status(400).json({
      error: "수정할 글이 없어요."
    });
  }

  if (
    !verification ||
    !Array.isArray(verification.checks)
  ) {
    return res.status(400).json({
      error: "사실 검증 결과가 없어요. 먼저 사실 검증을 해주세요."
    });
  }

  const problems = verification.checks.filter(
    item =>
      item.status === "incorrect" ||
      item.status === "needs_check"
  );

  if (!problems.length) {
    return res.status(400).json({
      error: "수정할 사실 오류가 없어요."
    });
  }

  const today = new Date().toLocaleDateString(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );

  const prompt = `
오늘은 대한민국 시간 기준 ${today}이다.

너는 한국 생활정보·경제정보 블로그의
팩트 수정 편집자다.

아래 글은 이미 작성된 Blogger용 HTML이다.

전체 글을 새로 쓰지 말고,
사실 검증에서 문제가 확인된 부분만
최소한으로 수정하라.


제목:
${title}


현재 HTML:
${html}


글감 단계의 공식 출처:
기관명: ${source_name || "없음"}
URL: ${source_url || "없음"}


사실 검증에서 문제가 된 항목:
${JSON.stringify(problems, null, 2)}


[수정 원칙]

1. incorrect 항목은 반드시 공식 출처 기준으로 바로잡는다.

2. needs_check 항목은
   현재 공식 자료에서 확실히 확인할 수 있으면 수정한다.

3. 끝까지 확실히 확인되지 않는 내용은
   추측해서 새 사실을 만들지 않는다.

4. 확인할 수 없는 문장이 독자를 오해하게 만들 수 있다면
   단정 표현을 제거하거나
   "공식 안내에서 별도 확인이 필요합니다"처럼 안전하게 수정한다.

5. 날짜, 금액, 지급일, 신청기간, 대상 조건 등
   숫자와 조건은 공식 자료와 일치해야 한다.

6. 기존 글의 말투와 쉬운 문장 스타일은 유지한다.

7. 이미 맞는 문장, 소제목, FAQ, 요약,
   광고 placeholder는 최대한 그대로 둔다.

8. official-action 버튼의 URL은
   검증된 공식 URL만 사용한다.

9. 실제 URL이 없는 내부 링크 버튼은 만들지 않는다.
기존 HTML에 INTERNAL_LINK, href="#" 등
placeholder 링크가 있다면 제거한다.

10. 아래 광고 placeholder도 그대로 유지한다.

<!-- ADSENSE_TOP -->
<!-- ADSENSE_MIDDLE -->
<!-- ADSENSE_BOTTOM -->

11. 글을 불필요하게 길게 만들지 않는다.

12. 새로운 관련 정보를 임의로 추가하지 않는다.

13. HTML 구조를 깨뜨리지 않는다.

14. h1은 추가하지 않는다.

15. 마크다운 코드블록은 출력하지 않는다.


[출력]

수정된 Blogger용 HTML 본문만 출력한다.
`;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_FIX_MODEL ||
            "gpt-5.6-luna",

          reasoning: {
            effort: "low"
          },

          tools: [
            {
              type: "web_search",
              search_context_size: "low",

              user_location: {
                type: "approximate",
                country: "KR",
                region: "Seoul"
              }
            }
          ],

          input: prompt,

          max_output_tokens: 5000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI fix error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "글 수정 요청에 실패했어요."
      });
    }

    let fixedHtml = getOutputText(data);

    fixedHtml = fixedHtml
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    if (!fixedHtml) {
      return res.status(502).json({
        error:
          "수정된 HTML을 받지 못했어요. 다시 시도해 주세요."
      });
    }

    return res.status(200).json({
      html: fixedHtml
    });

  } catch (error) {
    console.error(
      "Fix endpoint crash:",
      error
    );

    return res.status(500).json({
      error:
        "검증 결과를 반영하는 중 서버 오류가 발생했어요."
    });
  }
}
