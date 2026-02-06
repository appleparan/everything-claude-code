# Git 워크플로우

## Commit 메시지 형식

```
<type>: <description>

<optional body>
```

타입: feat, fix, refactor, docs, test, chore, perf, ci

참고: 귀속(attribution)은 ~/.claude/settings.json에서 전역으로 비활성화됩니다.

## Pull Request 워크플로우

PR 생성 시:
1. 전체 commit 이력 분석 (최신 commit만이 아님)
2. `git diff [base-branch]...HEAD`로 모든 변경사항 확인
3. 포괄적인 PR 요약 작성
4. TODO가 포함된 테스트 계획 포함
5. 새 브랜치인 경우 `-u` flag로 push

## 기능 구현 워크플로우

1. **먼저 계획**
   - **planner** Agent로 구현 계획 작성
   - 의존성과 리스크 식별
   - 단계별로 분해

2. **TDD 방법론**
   - **tdd-guide** Agent 사용
   - 먼저 테스트 작성 (RED)
   - 테스트를 통과하도록 구현 (GREEN)
   - 리팩토링 (IMPROVE)
   - 80%+ 커버리지 검증

3. **코드 리뷰**
   - 코드 작성 직후 **code-reviewer** Agent 사용
   - 치명적 및 높은 우선순위 이슈 처리
   - 가능한 한 중간 우선순위 이슈도 수정

4. **Commit 및 Push**
   - 상세한 commit 메시지
   - Conventional Commits 형식 준수
