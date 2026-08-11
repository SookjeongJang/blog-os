function getOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
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
      error: "Vercel의 OPENAI_API_KEY 환경변수를 찾지 못했어요."
    });
  }

  const {
    category = "",
    title = "",
    point = "",
    source_url = "",
    source_name = ""
  } = req.body || {};

  if (!title.trim()) {
    return res.status(400).json({
      error: "제목이 필요해요."
    });
  }

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const prompt = `
오늘은 대한민국 시간 기준 ${today}이다.

너는 한국의 생활정보·경제정보 블로그를 운영하는
SEO 편집자이자 팩트체커다.

아래 주제로 Blogger에 바로 사용할 수 있는
짧고 읽기 쉬운 HTML 글을 작성하라.

카테고리:
${category}

제목:
${title}

글감 단계에서 확인한 핵심 정보:
${point}

검증된 공식 출처:
기관명: ${source_name || "없음"}
URL: ${source_url || "없음"}


========================
1. 가장 먼저 사실 확인
========================

글을 작성하기 전에 반드시 웹 검색을 사용한다.

날짜, 금액, 신청기간, 지급일, 금리, 대상 조건,
운영시간, 예약일정 등은 현재 기준으로 다시 확인한다.

공식 출처를 가장 우선한다.

정부지원·복지·정책
→ 정부부처 / 지자체 / 공공기관

세금
→ 국세청

금리·경제
→ 한국은행 / 통계청 / 기획재정부

금융
→ 금융위원회 / 금융감독원

여행·축제·예약
→ 지자체 / 공식 관광기관 / 공식 행사 홈페이지


절대 하지 말 것:

- 확인되지 않은 숫자 만들기
- 미래 일정 추측하기
- 오래된 자료를 현재 정보처럼 표현하기
- 서로 다른 연도의 정보를 섞기
- 존재하지 않는 URL 만들기

공식 출처와 다른 자료가 충돌하면 공식 자료를 우선한다.


========================
2. 글은 짧고 쉽게
========================

이 글은 행정문서처럼 쓰지 않는다.

중학생이 읽어도 쉽게 이해할 수 있는 말로 쓴다.

어려운 단어는 쉬운 말로 바꾼다.

전문용어가 꼭 필요하면
바로 다음 문장에서 쉽게 설명한다.

한 문장은 짧게 쓴다.

한 문단은 1~3문장 정도로 쓴다.

긴 배경설명부터 시작하지 않는다.

독자가 궁금한 답을 먼저 알려준다.

기본 분량은 약 800~1,300자다.

정보가 적으면 더 짧아도 된다.

내용이 많으면 억지로 한 글에 넣지 말고
시리즈 글로 나눈다.


========================
3. 도입부는 바로 답
========================

첫 2~3문장 안에서
검색자가 가장 궁금해할 질문에 답한다.

예:

- 언제까지 신청하나요?
- 누가 받을 수 있나요?
- 지금 예약할 수 있나요?
- 얼마인가요?
- 어디에서 확인하나요?

불필요한 인사말이나 긴 소개는 넣지 않는다.


========================
4. 공식 행동 버튼
========================

예약, 신청, 조회, 결과 확인처럼
바로 행동할 수 있는 주제라면
도입부 초반에 행동 버튼을 최대 1개 넣는다.

중요:

source_url이 제공된 경우에만
그 URL을 행동 버튼에 사용할 수 있다.

source_url이 없으면 버튼 URL을 절대 만들지 않는다.

예:

<div class="official-action">
  <a href="${source_url}" target="_blank" rel="noopener noreferrer">
    신청하러 가기 →
  </a>
</div>

또는

<div class="official-action">
  <a href="${source_url}" target="_blank" rel="noopener noreferrer">
    예약하러 가기 →
  </a>
</div>

또는

<div class="official-action">
  <a href="${source_url}" target="_blank" rel="noopener noreferrer">
    지급 결과 확인하러 가기 →
  </a>
</div>

버튼 문구는
"자세히 보기"처럼 모호하게 쓰지 않는다.

클릭 후 무엇을 할 수 있는지 명확하게 쓴다.

본문에 긴 URL 문자열을 그대로 노출하지 않는다.


========================
5. HTML 구조
========================

HTML 본문만 출력한다.

마크다운 코드블록은 출력하지 않는다.

h1은 사용하지 않는다.

권장 구조:

짧은 도입부

공식 행동 버튼
(필요한 경우만)

핵심 요약

<!-- ADSENSE_TOP -->

h2 본문

필요한 경우 짧은 표 또는 목록

관련글 버튼

<!-- ADSENSE_MIDDLE -->

주의사항

FAQ 2~3개

다음 시리즈

<!-- ADSENSE_BOTTOM -->

공식 출처


========================
6. 핵심 요약
========================

도입부 다음에
3~4개 정도의 짧은 핵심만 보여준다.

예:

<div class="summary-box">
  <strong>핵심만 먼저</strong>
  <ul>
    <li>신청기간: 확인된 공식 일정</li>
    <li>대상: 핵심 조건</li>
    <li>신청방법: 가장 간단한 방법</li>
  </ul>
</div>

불필요하게 긴 요약은 만들지 않는다.


========================
7. 관련글 버튼
========================

현재 글과 이어서 궁금할 만한 주제가 있다면
본문 중간 또는 끝에 관련글 버튼을 최대 2개 만든다.

아직 실제 내부 URL을 모르므로
INTERNAL_LINK placeholder를 사용한다.

예:

<div class="related-button">
  <a href="INTERNAL_LINK_1">
    지급액이 달라지는 이유 보기 →
  </a>
</div>

<div class="related-button">
  <a href="INTERNAL_LINK_2">
    심사 결과 확인 방법 보기 →
  </a>
</div>

버튼 문구는
클릭 후 무엇을 볼 수 있는지 명확하게 작성한다.

"자세히 보기"는 사용하지 않는다.


========================
8. 시리즈 확장
========================

한 글에서 모든 내용을 설명하지 않는다.

현재 글과 자연스럽게 이어지는
시리즈 주제 2~3개를 추천한다.

각 시리즈는 검색 질문이 서로 달라야 한다.

예:

<div class="series-next">
  <strong>다음에 읽으면 좋은 글</strong>
  <ul>
    <li>근로장려금 심사 결과 확인하는 방법</li>
    <li>지급액이 예상보다 적은 이유</li>
    <li>입금되지 않았을 때 확인할 것</li>
  </ul>
</div>


========================
9. SEO와 검색 CTR
========================

현재 제목의 검색 의도를 유지한다.

본문 첫 부분에서
제목에서 약속한 답을 바로 제공한다.

키워드를 억지로 반복하지 않는다.

자극적인 문구,
거짓 긴급성,
과장 표현은 사용하지 않는다.

소제목은 검색자가 실제로 궁금해할 표현으로 쓴다.

예:

"신청 대상은 누구인가요?"

"예약은 어디서 하나요?"

"언제까지 사용할 수 있나요?"


========================
10. 애드센스 친화적 구조
========================

광고 클릭을 유도하는 문구는 작성하지 않는다.

광고를 버튼이나 콘텐츠로 착각하게 만들지 않는다.

대신:

- 짧은 문단
- 명확한 소제목
- 자연스러운 본문 구간
- 모바일 가독성
- 표와 목록

을 활용한다.

광고 위치는 아래 placeholder만 사용한다.

<!-- ADSENSE_TOP -->

<!-- ADSENSE_MIDDLE -->

<!-- ADSENSE_BOTTOM -->


========================
11. 공식 출처
========================

글 마지막에는
실제로 확인한 공식 출처를 표시한다.

source_url이 제공됐다면
가능하면 그 URL을 우선 사용한다.

예:

<div class="official-source">
  <strong>공식 출처</strong>
  <p>
    <a href="${source_url}" target="_blank" rel="noopener noreferrer">
      ${source_name || "공식 사이트"}
    </a>
  </p>
</div>

가짜 URL을 만들지 않는다.


========================
12. 최종 점검
========================

출력 직전에 반드시 확인한다.

1. 글이 어렵지 않은가?
2. 첫 부분에서 바로 답했는가?
3. 문단이 너무 길지 않은가?
4. 날짜와 숫자는 공식 출처와 일치하는가?
5. 오래된 정보를 최신 정보처럼 쓰지 않았는가?
6. 긴 URL이 본문에 그대로 노출되지 않았는가?
7. 행동 버튼은 공식 URL만 사용하는가?
8. 관련글 버튼은 INTERNAL_LINK placeholder를 사용하는가?
9. 글이 필요 이상으로 길지 않은가?
10. 한 글에 너무 많은 내용을 넣지 않았는가?

검수 후 Blogger용 HTML 본문만 출력한다.
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
            process.env.OPENAI_MODEL ||
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
        "OpenAI generate error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI API 요청에 실패했어요."
      });
    }

    let html = getOutputText(data);

    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    if (!html) {
      console.error(
        "No HTML output:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error:
          "AI가 HTML 본문을 반환하지 않았어요. 다시 시도해 주세요."
      });
    }

    return res.status(200).json({
      html
    });

  } catch (error) {
    console.error(
      "Generate endpoint crash:",
      error
    );

    return res.status(500).json({
      error:
        "서버에서 글을 작성하는 중 오류가 발생했어요."
    });
  }
}
