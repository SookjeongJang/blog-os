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
      error: "검증할 글이 없어요."
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
엄격한 팩트체커다.

아래 게시물을 웹 검색하여 검증하라.

제목:
${title}

본문 HTML:
${html}

글감 단계에서 확인한 공식 출처:
기관명: ${source_name || "없음"}
URL: ${source_url || "없음"}


[검증 목적]

글을 새로 작성하거나 수정하지 않는다.

오직 현재 게시물에 들어 있는
검증 가능한 사실만 찾아
현재 기준 공식 자료와 비교한다.


[우선 검증할 항목]

- 날짜
- 연도
- 신청기간
- 마감일
- 지급일
- 금액
- 금리
- 대상 조건
- 소득 기준
- 시행일
- 현재 신청 가능 여부
- 예약기간
- 운영시간
- 장소
- 공식 기관명


[출처 우선순위]

정부지원 / 복지 / 정책
→ 정부부처, 지자체, 공공기관

세금
→ 국세청

금리
→ 한국은행

금융
→ 금융위원회, 금융감독원

경제통계
→ 통계청, 한국은행, 기획재정부

여행 / 축제 / 예약
→ 지자체, 공식 관광기관, 공식 행사 사이트


[판정 규칙]

각 사실의 status는 아래 중 하나만 사용한다.

"verified"
= 현재 공식 출처에서 사실이 직접 확인됨

"needs_check"
= 관련 공식 자료는 있으나
  현재 상태 또는 해당 숫자를 확실히 확인하기 어려움

"incorrect"
= 게시물의 내용과 공식 출처가 다름


중요:

- 검색 결과 제목만 보고 판정하지 않는다.
- 가능한 경우 실제 공식 페이지 내용을 확인한다.
- 과거 자료와 현재 자료를 섞지 않는다.
- 확인되지 않은 내용을 추측하지 않는다.
- 틀린 사실이 하나라도 있으면 overall_status는 "fix_required"로 한다.
- needs_check만 있고 incorrect가 없다면 overall_status는 "review".
- 모든 핵심 사실이 확인되면 overall_status는 "verified".
- 글에 검증할 만한 구체적인 사실이 없다면 억지로 항목을 만들지 않는다.

각 항목의 claim에는
게시물에서 검증한 내용을 짧게 적는다.

evidence에는
공식 출처에서 확인한 내용을 쉬운 말로 적는다.

source_name과 source_url에는
실제로 해당 판정에 사용한 가장 중요한 공식 출처를 적는다.
`;


  const schema = {
    type: "object",
    additionalProperties: false,

    required: [
      "overall_status",
      "summary",
      "verified_count",
      "needs_check_count",
      "incorrect_count",
      "checks"
    ],

    properties: {

      overall_status: {
        type: "string",
        enum: [
          "verified",
          "review",
          "fix_required"
        ]
      },

      summary: {
        type: "string"
      },

      verified_count: {
        type: "integer",
        minimum: 0
      },

      needs_check_count: {
        type: "integer",
        minimum: 0
      },

      incorrect_count: {
        type: "integer",
        minimum: 0
      },

      checks: {
        type: "array",

        items: {
          type: "object",
          additionalProperties: false,

          required: [
            "claim",
            "status",
            "evidence",
            "source_name",
            "source_url"
          ],

          properties: {

            claim: {
              type: "string"
            },

            status: {
              type: "string",
              enum: [
                "verified",
                "needs_check",
                "incorrect"
              ]
            },

            evidence: {
              type: "string"
            },

            source_name: {
              type: "string"
            },

            source_url: {
              type: "string"
            }
          }
        }
      }
    }
  };


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
            process.env.OPENAI_VERIFY_MODEL ||
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

          text: {
            format: {
              type: "json_schema",
              name: "blog_fact_check",
              strict: true,
              schema
            }
          },

          max_output_tokens: 5000
        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      console.error(
        "OpenAI verify error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "사실 검증 요청에 실패했어요."
      });
    }


    const outputText = getOutputText(data);


    if (!outputText) {

      console.error(
        "Verify no output:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error:
          "검증 결과를 받지 못했어요. 다시 시도해 주세요."
      });
    }


    let result;

    try {
      result = JSON.parse(outputText);
    } catch (error) {

      console.error(
        "Verify JSON parse error:",
        outputText
      );

      return res.status(502).json({
        error:
          "검증 결과를 읽지 못했어요. 다시 시도해 주세요."
      });
    }


    return res.status(200).json(result);


  } catch (error) {

    console.error(
      "Verify endpoint crash:",
      error
    );

    return res.status(500).json({
      error:
        "사실 검증 중 서버 오류가 발생했어요."
    });
  }
}
