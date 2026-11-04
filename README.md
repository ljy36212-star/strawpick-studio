# 스트로우픽 스튜디오

50×70mm 스트로우픽 편집 및 레이어 PDF 첨부 메일 제출.

## 메일 설정

수신 주소는 서버에서 kjso.printing@gmail.com 으로 고정합니다.
Sites 환경변수에 `RESEND_API_KEY`를 Secret으로 저장하고 `EMAIL_FROM`을 설정한 뒤 배포합니다.
`EMAIL_FROM`은 Resend에서 인증한 발신 도메인의 주소를 사용합니다.
Resend 가입 이메일이 수신 주소와 같다면 준비 단계에서 `onboarding@resend.dev`를 사용할 수 있습니다.
키나 발신 주소가 없으면 폼은 명확한 준비 중 상태를 표시하고 발송을 차단합니다.

## 확인

- `node --test tests/submission.test.mjs`: 외부 발송 없이 공급자를 모킹하여 PDF 첨부, 수신 주소 고정, 재시도, 실패 응답 검증
- `node tests/geometry.test.mjs`: 타공 겹침 회귀 검사
- `node /root/.codex/plugins/cache/openai-curated-remote/sites/1.1.1/scripts/build-site.mjs`: Worker 및 정적 자산 빌드
