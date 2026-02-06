---
description: Generate and run end-to-end tests with Playwright. Creates test journeys, runs tests, captures screenshots/videos/traces, and uploads artifacts.
---

# E2E 명령어

이 명령어는 **e2e-runner** Agent를 호출하여 Playwright를 사용한 엔드투엔드 테스트를 생성, 유지보수 및 실행합니다.

## 이 명령어의 기능

1. **테스트 여정 생성** - 사용자 흐름에 대한 Playwright 테스트 생성
2. **E2E 테스트 실행** - 크로스 브라우저 테스트 수행
3. **아티팩트 캡처** - 실패 시 스크린샷, 비디오, 트레이스
4. **결과 업로드** - HTML 보고서 및 JUnit XML
5. **불안정한 테스트 식별** - 불안정한 테스트 격리

## 언제 사용하나요

다음과 같은 경우 `/e2e`를 사용하세요:
- 핵심 사용자 여정 테스트 (로그인, 거래, 결제)
- 다단계 흐름이 엔드투엔드로 작동하는지 검증
- UI 인터랙션 및 네비게이션 테스트
- 프론트엔드와 백엔드 통합 검증
- 프로덕션 배포 준비

## 작동 방식

e2e-runner Agent는:

1. **사용자 흐름을 분석**하고 테스트 시나리오를 식별
2. **Page Object Model 패턴을 사용하여 Playwright 테스트를 생성**
3. **여러 브라우저에서 테스트 실행** (Chrome, Firefox, Safari)
4. **실패한 테스트의 스크린샷, 비디오, 트레이스 캡처**
5. **결과와 아티팩트가 포함된 보고서 생성**
6. **불안정한 테스트를 식별**하고 수정 방법 제안

## 테스트 아티팩트

테스트 실행 시 다음 아티팩트가 캡처됩니다:

**모든 테스트:**
- 타임라인과 결과가 포함된 HTML 보고서
- CI 통합을 위한 JUnit XML

**실패 시에만:**
- 실패 상태의 스크린샷
- 테스트 비디오 녹화
- 디버깅을 위한 트레이스 파일 (단계별 재생)
- 네트워크 로그
- Console 로그

## 아티팩트 확인

```bash
# 브라우저에서 HTML 보고서 확인
npx playwright show-report

# 특정 트레이스 파일 확인
npx playwright show-trace artifacts/trace-abc123.zip

# 스크린샷은 artifacts/ 디렉터리에 저장됩니다
open artifacts/search-results.png
```

## 모범 사례

**해야 할 것:**
- Page Object Model을 사용하여 유지보수성 확보
- data-testid 속성을 셀렉터로 사용
- 임의의 타임아웃 대신 API 응답 대기
- 핵심 사용자 여정을 엔드투엔드로 테스트
- 메인 브랜치에 병합 전 테스트 실행
- 테스트 실패 시 아티팩트 검토

**하지 말아야 할 것:**
- 취약한 셀렉터 사용 (CSS 클래스는 변경될 수 있음)
- 구현 세부사항 테스트
- 프로덕션 환경에서 테스트 실행
- 불안정한 테스트 무시
- 실패 시 아티팩트 검토 건너뛰기
- E2E로 모든 경계 케이스 테스트 (단위 테스트 사용)

## 빠른 명령어

```bash
# 모든 E2E 테스트 실행
npx playwright test

# 특정 테스트 파일 실행
npx playwright test tests/e2e/markets/search.spec.ts

# 시각 모드로 실행 (브라우저 표시)
npx playwright test --headed

# 테스트 디버깅
npx playwright test --debug

# 테스트 코드 생성
npx playwright codegen http://localhost:3000

# 보고서 확인
npx playwright show-report
```

## 다른 명령어와의 통합

- `/plan`을 사용하여 테스트할 핵심 여정 식별
- `/tdd`를 사용하여 단위 테스트 수행 (더 빠르고 세밀함)
- `/e2e`를 사용하여 통합 및 사용자 여정 테스트
- `/code-review`를 사용하여 테스트 품질 검증

## 관련 Agent

이 명령어는 다음 위치의 `e2e-runner` Agent를 호출합니다:
`~/.claude/agents/e2e-runner.md`
