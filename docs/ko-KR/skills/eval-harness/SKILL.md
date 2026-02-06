---
name: eval-harness
description: Formal evaluation framework for Claude Code sessions implementing eval-driven development (EDD) principles
tools: Read, Write, Edit, Bash, Grep, Glob
---

# Eval Harness 스킬

Claude Code 세션을 위한 공식 평가 프레임워크로, eval 기반 개발(EDD) 원칙을 구현합니다.

## 철학

Eval 기반 개발은 evals를 "AI 개발의 단위 테스트"로 취급합니다:
- 구현 전에 예상 동작 정의
- 개발 중 지속적으로 evals 실행
- 매 변경마다 회귀 추적
- pass@k 지표를 사용한 신뢰성 측정

## Eval 유형

### 역량 Evals
Claude가 이전에 할 수 없었던 것을 할 수 있는지 테스트:
```markdown
[CAPABILITY EVAL: feature-name]
작업: Claude가 완료해야 할 내용 설명
성공 기준:
  - [ ] 기준 1
  - [ ] 기준 2
  - [ ] 기준 3
예상 출력: 예상 결과 설명
```

### 회귀 Evals
변경이 기존 기능을 깨뜨리지 않는지 확인:
```markdown
[REGRESSION EVAL: feature-name]
기준선: SHA 또는 체크포인트 이름
테스트:
  - existing-test-1: PASS/FAIL
  - existing-test-2: PASS/FAIL
  - existing-test-3: PASS/FAIL
결과: X/Y 통과 (이전 Y/Y)
```

## 채점기 유형

### 1. 코드 기반 채점기
코드를 사용한 결정론적 검사:
```bash
# 파일이 예상 패턴을 포함하는지 확인
grep -q "export function handleAuth" src/auth.ts && echo "PASS" || echo "FAIL"

# 테스트 통과 확인
npm test -- --testPathPattern="auth" && echo "PASS" || echo "FAIL"

# 빌드 성공 확인
npm run build && echo "PASS" || echo "FAIL"
```

### 2. 모델 기반 채점기
Claude를 사용하여 개방형 출력 평가:
```markdown
[MODEL GRADER PROMPT]
다음 코드 변경을 평가하세요:
1. 명시된 문제를 해결하는가?
2. 구조가 잘 되어 있는가?
3. 엣지 케이스가 처리되었는가?
4. 오류 처리가 적절한가?

점수: 1-5 (1=나쁨, 5=우수)
근거: [설명]
```

### 3. 사람 채점기
수동 검토로 표시:
```markdown
[HUMAN REVIEW REQUIRED]
변경: 변경 내용 설명
사유: 사람의 검토가 필요한 이유
위험 수준: LOW/MEDIUM/HIGH
```

## 지표

### pass@k
"k번 시도 중 최소 한 번 성공"
- pass@1: 첫 번째 시도 성공률
- pass@3: 3번 시도 내 성공
- 일반적 목표: pass@3 > 90%

### pass^k
"모든 k번 시행에서 성공"
- 더 높은 신뢰성 기준
- pass^3: 연속 3번 성공
- 핵심 경로에 사용

## Eval 워크플로

### 1. 정의 (코딩 전)
```markdown
## EVAL 정의: feature-xyz

### 역량 Evals
1. 새 사용자 계정 생성 가능
2. 이메일 형식 검증 가능
3. 비밀번호 안전한 해싱 가능

### 회귀 Evals
1. 기존 로그인 여전히 동작
2. 세션 관리 변경 없음
3. 로그아웃 흐름 온전함

### 성공 지표
- 역량 evals의 pass@3 > 90%
- 회귀 evals의 pass^3 = 100%
```

### 2. 구현
정의된 evals를 통과하기 위한 코드 작성.

### 3. 평가
```bash
# 역량 evals 실행
[각 역량 eval 실행, PASS/FAIL 기록]

# 회귀 evals 실행
npm test -- --testPathPattern="existing"

# 리포트 생성
```

### 4. 리포트
```markdown
EVAL 리포트: feature-xyz
========================

역량 Evals:
  create-user:     PASS (pass@1)
  validate-email:  PASS (pass@2)
  hash-password:   PASS (pass@1)
  전체:            3/3 통과

회귀 Evals:
  login-flow:      PASS
  session-mgmt:    PASS
  logout-flow:     PASS
  전체:            3/3 통과

지표:
  pass@1: 67% (2/3)
  pass@3: 100% (3/3)

상태: 검토 준비 완료
```

## 통합 패턴

### 구현 전
```
/eval define feature-name
```
`.claude/evals/feature-name.md`에 eval 정의 파일 생성

### 구현 중
```
/eval check feature-name
```
현재 evals 실행 및 상태 보고

### 구현 후
```
/eval report feature-name
```
전체 eval 리포트 생성

## Eval 저장소

프로젝트에 evals 저장:
```
.claude/
  evals/
    feature-xyz.md      # Eval 정의
    feature-xyz.log     # Eval 실행 이력
    baseline.json       # 회귀 기준선
```

## 모범 사례

1. **코딩 전에 evals 정의** - 성공 기준에 대한 명확한 사고를 강제
2. **자주 evals 실행** - 회귀를 조기에 포착
3. **시간에 따른 pass@k 추적** - 신뢰성 추세 모니터링
4. **가능하면 코드 채점기 사용** - 결정론적 > 확률적
5. **보안은 사람 검토 필요** - 보안 검사를 완전히 자동화하지 말 것
6. **evals를 빠르게 유지** - 느린 evals는 실행되지 않음
7. **코드와 함께 evals 버전 관리** - Evals는 일급 산출물

## 예시: 인증 추가

```markdown
## EVAL: add-authentication

### 단계 1: 정의 (10분)
역량 Evals:
- [ ] 사용자가 이메일/비밀번호로 가입 가능
- [ ] 사용자가 유효한 자격 증명으로 로그인 가능
- [ ] 잘못된 자격 증명이 적절한 오류와 함께 거부됨
- [ ] 세션이 페이지 새로고침 후에도 유지됨
- [ ] 로그아웃이 세션을 삭제함

회귀 Evals:
- [ ] 공개 경로가 여전히 접근 가능
- [ ] API 응답이 변경되지 않음
- [ ] 데이터베이스 스키마 호환

### 단계 2: 구현 (상황에 따라)
[코드 작성]

### 단계 3: 평가
실행: /eval check add-authentication

### 단계 4: 리포트
EVAL 리포트: add-authentication
==============================
역량: 5/5 통과 (pass@3: 100%)
회귀: 3/3 통과 (pass^3: 100%)
상태: 릴리스 준비 완료
```
