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

너는 한국의 생활·경제 정보 블로그를 운영하는
SEO 전문 편집자이자 팩트체커다.

아래 주제로 Blogger에 바로 사용할 수 있는
고품질 HTML 본문을 작성하라.

카테고리:
${category}

현재 제목:
${title}

글감 수집 단계에서 확인한 핵심 정보:
${point}

검증된 공식 출처:
기관명: ${source_name || "없음"}
URL: ${source_url || "없음"}

========================
1. 가장 먼저 사실 검증
========================

글을 작성하기 전에 반드시 웹 검색을 수행한다.

검색 우선순위:

정부지원·복지·정책
→ 정부부처 / 지자체 / 공공기관

세금
→ 국세청 / 정부 공식 사이트

금리·경제
→ 한국은행 / 통계청 / 기획재정부

금융
→ 금융위원회 / 금융감독원

여행·축제
→ 지자체 / 공식 관광기관 / 행사 공식 홈페이지


다음 항목은 반드시 현재 기준으로 재검증한다.

- 날짜
- 연도
- 신청기간
- 마감일
- 지급일
- 금액
- 금리
- 대상 조건
- 시행 여부
- 현재 신청 가능 여부
- 운영시간
- 예약기간


중요:

공식 출처에서 확인되지 않은 구체적인 숫자와 날짜를
절대로 추측해서 작성하지 않는다.

과거 자료를 현재 정책처럼 표현하지 않는다.

2025년 등 과거 연도가 등장하더라도
'2025년 귀속소득'처럼 현재 제도 설명에 필요한 기준연도인지
확인한 뒤 의미가 분명하게 작성한다.

서로 다른 시점의 자료를 섞어
하나의 최신 사실처럼 만들지 않는다.

공식 자료와 민간 자료가 충돌하면
공식 자료를 우선한다.

현재 상태를 확인할 수 없는 정보라면
사실인 것처럼 단정하지 않는다.


========================
2. 검색 CTR 최적화
========================

사용자가 Google 검색 결과에서 클릭하고 싶도록
제목의 검색 의도를 정확히 반영한다.

단:

- 자극적인 낚시 제목 금지
- 과장 금지
- 거짓 긴급성 금지
- 확인되지 않은 숫자를 제목에 넣지 않는다

본문 첫 2~3문장 안에서
검색자가 궁금해하는 핵심 답을 먼저 제공한다.

예:

"누가 받을 수 있나?"
"언제까지 신청하나?"
"지금 신청 가능한가?"
"얼마를 받을 수 있나?"

같은 핵심 질문에 초반부터 답한다.


========================
3. SEO 구조
========================

HTML 본문만 출력한다.

마크다운 코드블록은 사용하지 않는다.

h1은 사용하지 않는다.
Blogger 게시물 제목이 별도로 표시된다.

권장 구조:

도입부

핵심 요약 박스

목차

h2 / h3 본문

필요한 경우 표

신청방법 또는 이용방법

주의사항

공식 출처

FAQ 3~5개

마무리


본문은 모바일에서 읽기 쉽게
짧은 문단 위주로 작성한다.

한 문단을 지나치게 길게 만들지 않는다.

핵심 키워드를 자연스럽게 사용하고
같은 키워드를 억지로 반복하지 않는다.


========================
4. 내부링크 CTR
========================

글 중간과 마지막에
사용자가 자연스럽게 다음 정보를 궁금해할 수 있도록
관련 글 영역을 만든다.

단, 아직 실제 URL을 모르므로 아래 형식을 사용한다.

<div class="related-posts">
  <strong>함께 보면 좋은 글</strong>
  <ul>
    <li><a href="INTERNAL_LINK_1">관련 글 제목</a></li>
    <li><a href="INTERNAL_LINK_2">관련 글 제목</a></li>
  </ul>
</div>

관련 글 제목은 현재 글과 검색 의도가 이어지는 주제로 만든다.

억지 클릭 유도 문구는 사용하지 않는다.


========================
5. 애드센스 친화적 가독성
========================

광고 클릭을 직접 유도하는 문구를 작성하지 않는다.

광고를 버튼이나 콘텐츠처럼 오해하게 만드는 표현을 사용하지 않는다.

대신:

- 충분한 본문 길이
- 명확한 소제목
- 모바일 가독성
- 요약과 표
- 자연스러운 콘텐츠 구간

을 만들어
사용자가 편하게 읽을 수 있는 구조로 작성한다.

광고 위치를 위해 다음 placeholder만 사용한다.

<!-- ADSENSE_TOP -->

<!-- ADSENSE_MIDDLE -->

<!-- ADSENSE_BOTTOM -->

권장 위치:

ADSENSE_TOP
→ 도입부와 핵심 요약 이후

ADSENSE_MIDDLE
→ 주요 본문 절반 이후

ADSENSE_BOTTOM
→ FAQ 또는 마무리 이전


========================
6. 공식 출처 표시
========================

실제로 웹 검색에서 확인한
가장 중요한 공식 출처를 글 하단에 표시한다.

예:

<div class="official-source">
  <strong>공식 출처</strong>
  <p>
    <a href="실제 공식 URL" target="_blank" rel="noopener noreferrer">
      기관명 - 자료명
    </a>
  </p>
</div>

검색한 공식 URL이 확실하지 않으면
가짜 URL을 만들지 않는다.


========================
7. 글 품질
========================

독자가 실제 행동할 수 있을 만큼
구체적이고 실용적으로 작성한다.

불필요한 서론이나 반복 설명은 줄인다.

문장은 자연스러운 한국어로 작성한다.

지나친 AI식 표현을 피한다.


========================
8. 쉬운 말 + 짧은 글
========================

이 글은 어려운 행정 문서처럼 쓰지 않는다.

- 중학생도 이해할 수 있는 쉬운 한국어를 사용한다.
- 어려운 행정·세금·금융 용어는 가능한 일상어로 바꾼다.
- 전문용어가 꼭 필요하면 바로 뒤에서 한 문장으로 쉽게 설명한다.
- 한 문장은 짧게 쓴다.
- 한 문단은 2~3문장을 넘기지 않는 것을 권장한다.
- 긴 배경 설명보다 독자가 원하는 답을 먼저 준다.
- 불필요하게 글자 수를 채우지 않는다.
- 한 글은 하나의 핵심 질문에 집중한다.
- 기본 분량은 약 800~1,300자 정도로 한다.
- 내용이 많다면 한 글에 억지로 모두 넣지 말고 관련 시리즈로 나눈다.


========================
9. 도입부 행동 버튼
========================

독자가 이 글에 들어온 목적이
예약, 신청, 조회, 결과 확인, 대상 확인처럼
즉시 행동할 수 있는 주제라면
도입부 초반에 공식 행동 버튼을 1개 넣는다.

단, 버튼은 source_url이 실제 검증된 공식 URL로 제공된 경우에만 만든다.

source_url이 없으면 절대 URL을 추측해서 만들지 않는다.

예시:

<div class="official-action">
  <a href="검증된 공식 URL" target="_blank" rel="noopener noreferrer">
    화담숲 예약하러 가기 →
  </a>
</div>

또는

<div class="official-action">
  <a href="검증된 공식 URL" target="_blank" rel="noopener noreferrer">
    근로장려금 심사 결과 확인하러 가기 →
  </a>
</div>

버튼 문구는
"자세히 보기"처럼 막연하게 쓰지 않는다.

클릭 후 무엇을 할 수 있는지 명확하게 쓴다.

예:
- 예약하러 가기
- 신청하러 가기
- 대상 확인하러 가기
- 지급 결과 확인하러 가기
- 공식 일정 확인하러 가기

공식 사이트로 이동하는 버튼과
블로그 내부 관련글 버튼을 구분한다.


========================
10. 시리즈 및 내부 이동 버튼
========================

현재 글과 이어서 읽기 좋은 질문이 있다면
2~3개의 시리즈 글 제목을 제안한다.

현재 글과 내용이 겹치지 않게 한다.

본문 중간 또는 마지막에는
문맥에 맞는 관련글 버튼을 최대 2개 넣을 수 있다.

아직 실제 내부 URL을 모르므로 다음 형식을 사용한다.

<div class="related-button">
  <a href="INTERNAL_LINK_1">
    지급액이 예상과 다른 이유 보기 →
  </a>
</div>

<div class="related-button">
  <a href="INTERNAL_LINK_2">
    심사 결과 확인 방법 보기 →
  </a>
</div>

버튼 문구는
"자세히 보기"가 아니라
클릭 후 어떤 정보를 보게 되는지 구체적으로 작성한다.

글 마지막에는 아래 형식으로 시리즈 추천을 넣는다.

<div class="series-next">
  <strong>다음에 읽으면 좋은 글</strong>
  <ul>
    <li>시리즈 글 제목 1</li>
    <li>시리즈 글 제목 2</li>
    <li>시리즈 글 제목 3</li>
  </ul>
</div>


========================
최종 검수
========================

출력 직전에 반드시 점검한다.

1. 날짜와 숫자는 공식 출처와 일치하는가?
2. 현재 기준으로 유효한 정보인가?
3. 과거 자료를 최신 자료처럼 표현하지 않았는가?
4. 제목과 본문의 정보가 일치하는가?
5. 존재하지 않는 URL을 만들지 않았는가?
6. 사용자가 검색한 질문에 초반부터 답했는가?
7. 모바일에서 읽기 쉬운 구조인가?
8. 과도한 광고 클릭 유도 표현이 없는가?

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

          max_output_tokens: 7000
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
