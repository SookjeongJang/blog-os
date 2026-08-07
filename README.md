# Blog OS V4 — AI 초안 생성

이번 버전부터 새 폴더가 딱 하나 생깁니다.

- index.html
- style.css
- app.js
- api/
  - generate.js

`api` 폴더는 화면용 폴더가 아니라 **Vercel 서버 함수**입니다.
OpenAI API Key가 브라우저에 보이지 않도록 여기서 대신 AI를 호출합니다.

## 적용 방법

기존 GitHub Blog OS 저장소에서:
1. index.html 교체
2. style.css 교체
3. app.js 교체
4. 새 `api` 폴더 업로드
5. Commit

## Vercel에서 API 키 등록

Vercel 프로젝트:
Settings → Environment Variables

Name:
OPENAI_API_KEY

Value:
본인의 OpenAI API Key

Production / Preview / Development 중 필요한 환경에 적용하고 저장합니다.
그 뒤 새 배포가 필요합니다.

선택사항:
OPENAI_MODEL = gpt-5-mini

모델 값을 따로 등록하지 않으면 자동으로 gpt-5-mini를 사용합니다.

## 중요

API 키를 app.js에 붙여넣지 마세요.
브라우저에 노출될 수 있습니다.

Google Sheets API:
https://script.google.com/macros/s/AKfycbwCOyxrS93IRXDM-bKdmVeo2okUo_CudJx5GD0USHVZfy2JXOeLPEfOXdEMjvQpq89TPg/exec
