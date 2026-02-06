# Agent 협업

## 사용 가능한 Agent

`~/.claude/agents/`에 위치:

| Agent | 용도 | 사용 시점 |
|-------|------|-----------|
| planner | 구현 계획 | 복잡한 기능, 리팩토링 |
| architect | 시스템 설계 | 아키텍처 의사결정 |
| tdd-guide | 테스트 주도 개발 | 새 기능, 버그 수정 |
| code-reviewer | 코드 리뷰 | 코드 작성 후 |
| security-reviewer | 보안 분석 | 커밋 전 |
| build-error-resolver | 빌드 오류 수정 | 빌드 실패 시 |
| e2e-runner | E2E 테스트 | 핵심 사용자 플로우 |
| refactor-cleaner | 불필요한 코드 정리 | 코드 유지보수 |
| doc-updater | 문서화 | 문서 업데이트 |

## Agent 즉시 사용

사용자 프롬프트 없이:
1. 복잡한 기능 요청 - **planner** Agent 사용
2. 코드 작성/수정 직후 - **code-reviewer** Agent 사용
3. 버그 수정 또는 새 기능 - **tdd-guide** Agent 사용
4. 아키텍처 의사결정 - **architect** Agent 사용

## 병렬 태스크 실행

독립적인 작업에는 항상 병렬 Task 실행을 사용:

```markdown
# 좋음: 병렬 실행
3개의 agent를 병렬로 시작:
1. Agent 1: auth.ts 보안 분석
2. Agent 2: 캐시 시스템 성능 리뷰
3. Agent 3: utils.ts 타입 검사

# 나쁨: 불필요한 순차 실행
먼저 agent 1, 그다음 agent 2, 그다음 agent 3
```

## 다관점 분석

복잡한 문제에 대해 역할별 하위 agent를 사용:
- 팩트 체커
- 시니어 엔지니어
- 보안 전문가
- 일관성 검토자
- 중복 검사자
