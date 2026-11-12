# 칼선 회귀검사

Node.js 22.13 이상에서 실행합니다. 테스트 전용 Canvas 의존성은
`@napi-rs/canvas@0.1.100`으로 고정되어 있습니다.

```sh
npm ci
npm run test:baseline
npm run test:regression
npm test
```

| 명령 | 범위 |
| --- | --- |
| `npm run test:baseline` | 기존 6개 검사 파일. 기존 assertion은 유지하고 Canvas 로딩/출력 경로만 이식 가능하게 변경 |
| `npm run test:regression` | 신규 순수 기하 6건 + 실제 편집기/내보내기 68건 |
| `npm test` | 전체 85건. 현재 5건의 실패를 의도적으로 드러내므로 종료 코드 1 |

현재 결과와 수정 우선순위는 [REGRESSION_REPORT.md](./REGRESSION_REPORT.md)에 있습니다.
실패를 `todo`, `skip`, 허용 오차 확대로 숨기지 마세요. 기존 기능 통과와
신규 제작 조건 실패를 따로 판단하기 위해 명령을 분리했습니다.

## 실행 환경과 미실행 구분

Canvas는 먼저 프로젝트의 `node_modules`에서 찾고, 없으면
`CODEX_PRIMARY_RUNTIME_NODE_MODULES`에 설치된 동일 모듈을 찾습니다.
두 경로 모두 없으면 Canvas 의존 검사마다 `SKIP / Not executed`와 설치 안내를 출력합니다.
이 경우 테스트 명령의 종료 코드가 0이어도 전체 검증 통과가 아닙니다.
릴리스 판단에는 **실패 0 및 미실행 0**이 필요합니다.

검사끼리 동시에 큰 Canvas 메모리를 잡지 않도록 `--test-concurrency=1`을 사용하고,
60개 조합은 같은 편집기 Canvas를 재사용합니다. 앱 동작 코드는 변경하지 않습니다.

## 검사 구성

- `cutline-regression.test.mjs`: 깊은 오목부, 좁은 목, 비대칭 외곽의 닫힘·접선 연속성·자기교차·양방향 변형 범위,
  1px 연결부, 잔상 정리 3단계, 1mm 접힘선 경계값과 다른 타공 간섭.
- `editor-regression.test.mjs`: 5종 도안 × 지름 7~12mm × 타공 1~2개 = 60건.
  실제 `public/app.js`를 VM에서 실행하고 네이티브 Canvas로 계산·그립니다.
  실제 SVG/PDF 버튼 핸들러의 다운로드만 메모리로 받습니다.
- `fixtures/cutouts.mjs`: 고정 좌표의 합성 알파 도안 8종. **실제 고객 파일이 아닙니다.**
- `helpers/geometry-oracles.mjs`: 거리·선분 교차·포함 여부 및 SVG/PDF 파서.
  검증 시 앱의 `foldClearance`, `contourPdfPath`를 정답 생성기로 재사용하지 않습니다.
- `helpers/export-oracles.mjs`: 실제 Canvas stroke 기록과 SVG의 외곽·원·접힘선,
  PDF 페이지 크기·xref·레이어·곡선·타공·접힘선을 검사합니다.
- `helpers/editor-harness.mjs`: DOM 컨트롤은 스텁, Canvas/Path2D와 앱 함수는 실제 구현.
  네트워크 요청은 금지합니다. 메일 제출 검사는 별도의 기존 mock 검사입니다.

## 허용 오차

| 항목 | 기준 |
| --- | --- |
| 외곽 보정 전후 거리 | 양방향 0.24mm 이하, 순수 기하 fixture 3종 |
| SVG/PDF 외곽 | 직렬화 후 곡선 샘플 좌표 오차 0.00012pt 미만 |
| PDF 타공 원 | 4개의 3차 베지어 근사로 인한 반지름 오차 0.002mm 미만 |
| 접힘선 | 길이 2mm, 전체 선분에서 외곽 및 모든 타공까지 최소 1mm |
| 최종 사진 여백 | 1.5mm 이상, 측정 허용 오차 0.001mm |

거리 측정은 정리된 사진 마스크의 경계 픽셀 네 꼭짓점에서 최종 외곽선까지 계산합니다.
외곽 교차 검사는 평탄화된 선분, 별도 곡선 검사는 32구간 샘플링을 사용합니다.
이 유한한 검사가 모든 임의 도안의 기하 안정성이나 실제 재단 장비 정밀도를 증명하지는 않습니다.

## 시각 확인용 출력

```sh
node tests/render-fixtures.mjs
# 또는 STRAWPICK_TEST_OUTPUT 환경변수로 출력 폴더 지정
```

기본 출력은 Git에서 제외된 `outputs/cutline-regression/`입니다.
8종 도안의 미리보기 PNG, 실제 SVG/PDF 및 manifest를 생성합니다.
기존 `editor-geometry.test.mjs`의 출력은 `STRAWPICK_TEST_OUTPUT` 지정 시에만 생성합니다.
브라우저 UI, 모바일 업로드, AI 배경제거 서비스와 실물 인쇄·재단은 별도 확인해야 합니다.
