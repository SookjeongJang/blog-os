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

  const requestedCount = Number(req.body?.count || 8);
  const count = Math.max(3, Math.min(10, requestedCount));

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const prompt = `
오늘은 대한민국 시간 기준 ${today}이다.

한국의 생활·경제 정보 블로그에 쓸
"지금 작성 가치가 높은 최신 글감"을 정확히 ${count}개 찾아라.

반드시 웹 검색을 사용해 최신성을 확인하라.

관심 카테고리:
- 정부지원 / 복지 / 정책
- 경제 / 금리 / 물가
- 금융 / 세금
- 생활정보 / 공공서비스
- 지역축제 / 여행 / 예약정보

선정 기준:

1. 최근 발표
2. 신청 시작 또는 마감 임박
3. 제도 변경
4. 새로운 일정 공개
5. 지금 검색할 이유가 있는 주제
6. 한국 사용자가 실제로 검색할 만한 실용적인 정보
7. 같은 내용의 중복 주제 제외
8. 단순 연예, 사건사고, 정치 공방 제외
9. 확인되지 않은 일정, 금액, 지원대상을 만들지 말 것

출처는 가능하면 다음 기관을 우선한다.

- 정부부처
- 공공기관
- 한국은행
- 금융위원회
- 금융감독원
- 국세청
- 지자체
- 공식 관광기관

각 주제는 블로그 검색 유입에 적합한 제목으로 다시 작성한다.

우선순위:
S = 지금 바로 쓰기 좋은 주제
A = 이번 주 안에 쓰기 좋은 주제
B = 보관해두고 작성할 주제

score는 100점 만점 정수.

freshness는 아래 중 하나:
오늘
이번 주
이번 달
시즌

source_url에는
실제로 확인한 가장 중요한 출처 URL 하나를 넣어라.
`;

  const schema = {
    type: "object",
    additionalProperties: false,

    required: ["topics"],

    properties: {
      topics: {
        type: "array",
        minItems: count,
        maxItems: count,

        items: {
          type: "object",
          additionalProperties: false,

          required: [
            "grade",
            "score",
            "category",
            "title",
            "reason",
            "key_points",
            "freshness",
            "source_name",
            "source_url"
          ],

          properties: {
            grade: {
              type: "string",
              enum: ["S", "A", "B"]
            },

            score: {
              type: "integer",
              minimum: 0,
              maximum: 100
            },

            category: {
              type: "string"
            },

            title: {
              type: "string"
            },

            reason: {
              type: "string"
            },

            key_points: {
              type: "string"
            },

            freshness: {
              type: "string",
              enum: [
                "오늘",
                "이번 주",
                "이번 달",
                "시즌"
              ]
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
          process.env.OPENAI_SEARCH_MODEL ||
          "gpt-5.6-luna",

        reasoning: {
        effort: "none"
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
              name: "blog_topic_results",
              strict: true,
              schema: schema
            }
          },

          max_output_tokens: 8000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI topic search error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI 웹 검색 요청에 실패했어요."
      });
    }

    const outputText = getOutputText(data);

    if (!outputText) {
      console.error(
        "No output text:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error:
          "OpenAI 응답에 글감 데이터가 없어요. 다시 시도해 주세요."
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      console.error(
        "Structured output parse failed:",
        outputText
      );

      return res.status(502).json({
        error:
          "구조화된 글감 데이터를 읽지 못했어요. 다시 시도해 주세요."
      });
    }

    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.slice(0, count)
      : [];

    return res.status(200).json({
      topics: topics
    });

  } catch (error) {
    console.error(
      "Topic endpoint crash:",
      error
    );

    return res.status(500).json({
      error:
        "최신 글감을 찾는 중 서버 오류가 발생했어요."
    });
  }
}
