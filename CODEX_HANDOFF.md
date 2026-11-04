# 스트로우픽 스튜디오 작업 인계

## 목적과 현재 상태
- 사용자: 인쇄공작소. 기존 스트로우픽 편집기를 계속 개선하며 KJSO 원본 로고와 분위기를 적용하는 중.
- 공개 사이트: https://strawpick-studio.ljy36212.chatgpt.site/
- 기존 Sites project_id: appgprj_6adaf0618c0c81918a0879912c93b26f
- 기준 소스 커밋: e322b67872557dfa57a6dca64eafb4ad71c0d322
- 마지막 확인된 공개 버전: 16. 이후 상태는 재조회할 것.
- 이 ZIP은 기준 커밋 위에 브랜딩 변경이 적용된 작업 복사본. 브랜딩 배포는 아직 완료되지 않음.
- 사용자는 작업을 Codex에서 이어가길 요청했음. 이 파일은 해당 인계용이며 배포 완료를 뜻하지 않음.

## 적용한 브랜딩
- 첨부 ZIP의 원본 PNG 로고를 `public/brand/kjso-logo.png`에 그대로 포함.
- 코발트 블루 #0b3bf3, 라임 #d1fc2e, 흰색을 적용.
- 헤더/푸터 로고, 둥근 단계 탭/버튼, 티켓 모양 포인트, 업로드 영역, 편집 화면의 색상을 통일.
- 원본 로고는 1575×1575 불투명 PNG. CSS viewport crop으로 외곽 여백만 가려 표시. 벡터 파일은 아님.
- 변경 파일: public/index.html, public/brand.css, public/brand/kjso-logo.png, public/app.js의 빈 캔버스 색상, 생성된 app/editor-html.ts.
- 데스크톱 및 390px iframe 화면에서 로고/1단계 배치 확인. 모바일 사진편집 화면의 빨간 볼드 AI 안내문 확인.

## 소스 구조
- public/index.html: 편집기 원본 HTML
- public/style.css: 기존 스타일
- public/brand.css: 새 브랜딩 스타일 (기존 스타일 뒤에 적용)
- public/app.js: 상태, 캔버스, 배경제거, 내보내기, 단계 이동, 제출 UI
- public/geometry.js: 외곽/타공/접힘선 계산
- scripts/sync-editor-html.mjs: HTML → app/editor-html.ts 생성
- app/route.ts, worker/index.ts: 서버 라우팅
- lib/submission.mjs: Resend 메일 제출
- .openai/hosting.json: 기존 사이트 식별자. 같은 사이트를 업데이트할 때 보존
- package.json: Vinext/Vite/Cloudflare 프로젝트, npm dev/build

## 반드시 보존할 제작 조건
- 전체 50×70mm.
- 타공 1~2개, 지름 7/8/9/10/11/12mm. 추출 칼선 지름에는 +0.2mm.
- 타공은 몸통의 보이는 좌우 중심에 자동 정렬. 수동 좌우 메뉴 없음.
- 타공 고리는 사진 외곽에 바로 연결하며 길쭉한 연결 목을 만들지 않음.
- 사진 여백 최소/기본 1.5mm, 몸통 둥글기 최소/기본 2mm.
- 깊고 좁은 안쪽 파임은 바깥으로 메우고 외곽을 부드럽게 처리.
- 이미지 안쪽 구멍 칼선은 생성하지 않음. 외곽과 빨대 타공선만 생성.
- 배경제거 잔상/고립 픽셀을 정리하되 흰색 피사체를 보존.
- 접힘선은 2mm 고정, 몸통/타공 고리 교차 이음부 중앙에 고정. 주변 칼선과 최소 1mm 간격.
- 접힘선이 성립하지 않으면 주황색 배너와 메시지 박스 표시. 확인 후 매 프레임 다시 띄우지 않음.
- 1단계 재질/사진 선택, 2단계 사진편집, 3단계 칼선/타공. 단계 간 이동 가능, 업로드/편집완료 후 다음 단계 이동.
- AI 경고 문구는 빨간 볼드 유지: “AI 배경 제거는 완벽하지 않을 수 있습니다. 되도록 누끼(배경제거)처리된 이미지를 첨부하여 활용하시기를 권장해 드립니다.”
- 레이어 PDF는 Artwork/Cutline/Fold 분리. SVG/투명 PNG/JSON 백업 유지.
- PDF를 저장하지 않고 서버를 통해 kjso.printing@gmail.com으로 제출. 실제 외부 메일을 테스트로 보내지 말 것.

## 검증
현 인계 시점에 다음 검사가 통과함:
- npm run build (관리형 환경; 로컬 새 설치는 별도 확인 필요)
- node --test tests/submission.test.mjs (외부 발송 없이 모킹)
- node tests/geometry.test.mjs
- node tests/junctions.test.mjs
- node tests/noise.test.mjs

추가 tests/editor-geometry.test.mjs는 기존 관리형 환경의 CODEX_PRIMARY_RUNTIME_NODE_MODULES와 @napi-rs/canvas, /workspace/scratch 출력 경로에 의존함. 로컬에서는 해당 테스트의 의존성/출력경로를 환경에 맞게 수정한 뒤 실행할 것. 앱 자체 실행에는 이 테스트 전용 의존성이 필요하지 않음.

## 다음 작업
1. START_HERE.md에 따라 실행하고 브랜딩 수정본을 검토.
2. 이미지 업로드, 칼선/타공, 경고 메시지, PDF 출력의 시각적 회귀 확인.
3. 사용자의 다음 변경 요청을 반영.
4. 기존 사이트를 업데이트하려면 Sites 연결로 현재 상태와 권한 확인 후 기존 project_id를 재사용. 임시 접근 토큰/키는 소스에 기록하지 않음.

Git 메타데이터, node_modules, 빌드 결과, 런타임 상태, 비밀키는 인계 ZIP에서 제외됨.
