# 검증 루프 스킬

Claude Code 작업 세션을 위한 완전한 검증 시스템.

## 사용 시점

다음 상황에서 이 스킬을 호출하세요:
- 기능이나 주요 코드 변경 완료 후
- PR 생성 전
- 품질 게이트 통과를 확인하고 싶을 때
- 리팩터링 후

## 검증 단계

### 단계 1: 빌드 검증
```bash
# 프로젝트가 빌드되는지 확인
npm run build 2>&1 | tail -20
# 또는
pnpm build 2>&1 | tail -20
```

빌드가 실패하면 중단하고 계속하기 전에 수정하세요.

### 단계 2: 타입 검사
```bash
# TypeScript 프로젝트
npx tsc --noEmit 2>&1 | head -30

# Python 프로젝트
pyright . 2>&1 | head -30
```

모든 타입 에러를 보고합니다. 계속하기 전에 치명적인 에러를 수정하세요.

### 단계 3: Lint 검사
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### 단계 4: 테스트 스위트
```bash
# 커버리지 포함 테스트 실행
npm run test -- --coverage 2>&1 | tail -50

# 커버리지 임계값 확인
# 목표: 최소 80%
```

보고:
- 전체 테스트 수: X
- 통과: X
- 실패: X
- 커버리지: X%

### 단계 5: 보안 스캔
```bash
# 시크릿 확인
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# console.log 확인
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### 단계 6: diff 리뷰
```bash
# 변경 내용 표시
git diff --stat
git diff HEAD~1 --name-only
```

변경된 각 파일을 리뷰:
- 예상치 못한 변경 사항
- 누락된 에러 처리
- 잠재적 엣지 케이스

## 출력 형식

모든 단계 실행 후 검증 보고서를 생성합니다:

```
검증 보고서
==================

빌드:     [PASS/FAIL]
타입:     [PASS/FAIL] (X개 에러)
Lint:     [PASS/FAIL] (X개 경고)
테스트:   [PASS/FAIL] (X/Y 통과, Z% 커버리지)
보안:     [PASS/FAIL] (X개 이슈)
diff:     [X개 파일 변경됨]

종합:     [READY/NOT READY] for PR

수정할 이슈:
1. ...
2. ...
```

## 지속 모드

장시간 작업 세션에서는 15분마다 또는 주요 변경 후에 검증을 실행합니다:

```markdown
정신적 체크포인트 설정:
- 각 함수 완료 후
- 컴포넌트 완료 후
- 다음 작업으로 이동하기 전

실행: /verify
```

## Hooks와의 통합

이 스킬은 PostToolUse hooks를 보완하지만 더 깊은 검증을 제공합니다.
Hooks는 즉시 문제를 포착하고, 이 스킬은 포괄적인 리뷰를 제공합니다.
