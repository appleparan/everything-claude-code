# Orchestrate 명령어

복잡한 작업을 위한 순차적 Agent 워크플로입니다.

## 사용 방법

`/orchestrate [workflow-type] [task-description]`

## 워크플로 유형

### feature
전체 기능 구현 워크플로:
```
planner -> tdd-guide -> code-reviewer -> security-reviewer
```

### bugfix
버그 조사 및 수정 워크플로:
```
explorer -> tdd-guide -> code-reviewer
```

### refactor
안전한 리팩터링 워크플로:
```
architect -> code-reviewer -> tdd-guide
```

### security
보안 중심 리뷰:
```
security-reviewer -> code-reviewer -> architect
```

## 실행 모드

워크플로의 각 Agent에 대해:

1. **Agent 호출**, 이전 Agent의 컨텍스트를 함께 전달
2. **출력을 수집**하여 구조화된 인수인계 문서로 작성
3. **다음 Agent에 전달**
4. **결과를 종합**하여 최종 보고서 작성

## 인수인계 문서 형식

Agent 간에 인수인계 문서를 생성합니다:

```markdown
## 인수인계: [이전 Agent] -> [다음 Agent]

### 컨텍스트
[완료된 작업 요약]

### 발견 사항
[주요 발견 또는 결정 사항]

### 수정된 파일
[영향을 받은 파일 목록]

### 미해결 문제
[다음 Agent를 위한 미해결 항목]

### 권장 사항
[권장되는 다음 단계]
```

## 최종 보고서 형식

```
오케스트레이션 보고서
====================
워크플로: feature
작업: 사용자 인증 추가
Agents: planner -> tdd-guide -> code-reviewer -> security-reviewer

요약
-------
[한 단락 요약]

AGENT 출력
-------------
Planner: [요약]
TDD Guide: [요약]
Code Reviewer: [요약]
Security Reviewer: [요약]

변경된 파일
-------------
[수정된 모든 파일 목록]

테스트 결과
------------
[테스트 통과/실패 요약]

보안 상태
---------------
[보안 관련 발견 사항]

권장 사항
--------------
[릴리스 / 개선 필요 / 차단]
```

## 병렬 실행

독립적인 검사의 경우 Agent를 병렬로 실행합니다:

```markdown
### 병렬 단계
동시 실행:
- code-reviewer (품질)
- security-reviewer (보안)
- architect (설계)

### 결과 병합
출력을 단일 보고서로 통합
```

## 매개변수

$ARGUMENTS:
- `feature <description>` - 전체 기능 워크플로
- `bugfix <description>` - 버그 수정 워크플로
- `refactor <description>` - 리팩터링 워크플로
- `security <description>` - 보안 리뷰 워크플로
- `custom <agents> <description>` - 사용자 정의 Agent 시퀀스

## 사용자 정의 워크플로 예시

```
/orchestrate custom "architect,tdd-guide,code-reviewer" "캐시 레이어 재설계"
```

## 팁

1. **복잡한 기능은 planner로 시작하세요**
2. **병합 전에 항상 code-reviewer를 포함하세요**
3. **인증/결제/PII에는 security-reviewer를 사용하세요**
4. **인수인계는 간결하게 유지하세요** - 다음 Agent에 필요한 내용에 집중
5. **필요한 경우 Agent 사이에 verification을 실행하세요**
