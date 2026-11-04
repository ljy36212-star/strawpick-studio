# Codex에서 스트로우픽 작업 이어가기

이 폴더는 기존 스트로우픽 스튜디오의 전체 소스와 아직 공개 배포되지 않은 KJSO 브랜딩 수정본입니다.

## 시작
1. ZIP을 압축 해제합니다.
2. ChatGPT 데스크톱 앱의 Codex에서 로컬 프로젝트를 만들고 이 `strawpick-studio` 폴더를 연결합니다. VS Code Codex 확장에서는 이 폴더를 엽니다.
3. 아래 내용을 Codex에 입력합니다.

> CODEX_HANDOFF.md를 먼저 읽고 스트로우픽 스튜디오 작업을 이어가줘. 현재 KJSO 로고와 코발트 블루·라임색 디자인을 검토하고, 기존 편집 기능을 유지하면서 실행해줘. 공개 사이트에 반영되지 않은 수정본이므로 배포 상태도 확인해줘.

## 개발 명령
Node.js 22.13 이상과 npm이 필요합니다.

```sh
npm ci
npm run dev
```

실행 로그에 표시된 로컬 주소를 엽니다. 로컬 기본 개발 포트는 5173입니다.

```sh
npm run build
```

`public/index.html`을 변경한 뒤 개발 서버에서 반영되지 않으면 아래 명령으로 서버용 HTML을 다시 만드세요.

```sh
node scripts/sync-editor-html.mjs
```

## 웹 Codex를 쓰는 경우
이 소스를 본인의 Git 저장소에 올린 뒤 해당 저장소가 포함된 Codex Cloud 환경을 생성/선택합니다. 압축파일에 Git 이력이나 저장소 접근 토큰은 포함하지 않았습니다.

## 메일과 배포
편집 화면은 메일 API 키 없이 실행할 수 있습니다. 실제 메일 발송에는 서버의 `RESEND_API_KEY`, `EMAIL_FROM` 설정이 필요합니다. 기존 배포 환경의 비밀값은 이 소스에 포함되지 않습니다.

기존 Sites URL의 업데이트에는 해당 사이트를 수정할 수 있는 Sites 연결이 필요합니다. 소스를 실행하거나 다른 Git 저장소에 올리는 것만으로 기존 공개 사이트가 바뀌지는 않습니다.

공식 안내: https://learn.chatgpt.com/docs/projects
Codex 실행 환경: https://learn.chatgpt.com/docs/environments/modes
