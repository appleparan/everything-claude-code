---
name: iterative-retrieval
description: Pattern for progressively refining context retrieval to solve the subagent context problem
---

# 반복적 검색 패턴

멀티 agent 워크플로우에서 "컨텍스트 문제"를 해결합니다. 서브 agent가 작업을 시작하기 전에 어떤 컨텍스트가 필요한지 알지 못하는 문제입니다.

## 문제

서브 agent는 제한된 컨텍스트로 생성됩니다. 다음을 알지 못합니다:
- 어떤 파일에 관련 코드가 포함되어 있는지
- 코드베이스에 어떤 패턴이 존재하는지
- 프로젝트에서 어떤 용어를 사용하는지

표준 접근 방식의 실패:
- **모든 것을 전송**: 컨텍스트 제한 초과
- **아무것도 전송하지 않음**: Agent가 핵심 정보 부족
- **필요한 것을 추측**: 종종 잘못됨

## 해결책: 반복적 검색

컨텍스트를 점진적으로 정제하는 4단계 사이클:

```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌──────────┐      ┌──────────┐            │
│   │ DISPATCH │─────▶│ EVALUATE │            │
│   └──────────┘      └──────────┘            │
│        ▲                  │                 │
│        │                  ▼                 │
│   ┌──────────┐      ┌──────────┐            │
│   │   LOOP   │◀─────│  REFINE  │            │
│   └──────────┘      └──────────┘            │
│                                             │
│        최대 3회 사이클 후 계속               │
└─────────────────────────────────────────────┘
```

### 단계 1: DISPATCH

초기 광범위 쿼리로 후보 파일을 수집합니다:

```javascript
// 상위 수준의 의도부터 시작
const initialQuery = {
  patterns: ['src/**/*.ts', 'lib/**/*.ts'],
  keywords: ['authentication', 'user', 'session'],
  excludes: ['*.test.ts', '*.spec.ts']
};

// 검색 agent에 디스패치
const candidates = await retrieveFiles(initialQuery);
```

### 단계 2: EVALUATE

검색된 콘텐츠의 관련성을 평가합니다:

```javascript
function evaluateRelevance(files, task) {
  return files.map(file => ({
    path: file.path,
    relevance: scoreRelevance(file.content, task),
    reason: explainRelevance(file.content, task),
    missingContext: identifyGaps(file.content, task)
  }));
}
```

점수 기준:
- **높음 (0.8-1.0)**: 대상 기능을 직접 구현
- **중간 (0.5-0.7)**: 관련 패턴이나 타입 포함
- **낮음 (0.2-0.4)**: 간접적으로 관련
- **없음 (0-0.2)**: 관련 없음, 제외

### 단계 3: REFINE

평가를 기반으로 검색 기준을 업데이트합니다:

```javascript
function refineQuery(evaluation, previousQuery) {
  return {
    // 높은 관련성 파일에서 발견된 새로운 패턴 추가
    patterns: [...previousQuery.patterns, ...extractPatterns(evaluation)],

    // 코드베이스에서 찾은 용어 추가
    keywords: [...previousQuery.keywords, ...extractKeywords(evaluation)],

    // 관련 없음이 확인된 경로 제외
    excludes: [...previousQuery.excludes, ...evaluation
      .filter(e => e.relevance < 0.2)
      .map(e => e.path)
    ],

    // 특정 빈틈에 집중
    focusAreas: evaluation
      .flatMap(e => e.missingContext)
      .filter(unique)
  };
}
```

### 단계 4: LOOP

정제된 기준으로 반복합니다 (최대 3회 사이클):

```javascript
async function iterativeRetrieve(task, maxCycles = 3) {
  let query = createInitialQuery(task);
  let bestContext = [];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const candidates = await retrieveFiles(query);
    const evaluation = evaluateRelevance(candidates, task);

    // 충분한 컨텍스트가 있는지 확인
    const highRelevance = evaluation.filter(e => e.relevance >= 0.7);
    if (highRelevance.length >= 3 && !hasCriticalGaps(evaluation)) {
      return highRelevance;
    }

    // 정제 후 계속
    query = refineQuery(evaluation, query);
    bestContext = mergeContext(bestContext, highRelevance);
  }

  return bestContext;
}
```

## 실제 예시

### 예시 1: 버그 수정 컨텍스트

```
작업: "인증 token 만료 버그 수정"

사이클 1:
  DISPATCH: src/**에서 "token", "auth", "expiry" 검색
  EVALUATE: auth.ts (0.9), tokens.ts (0.8), user.ts (0.3) 발견
  REFINE: "refresh", "jwt" 키워드 추가; user.ts 제외

사이클 2:
  DISPATCH: 정제된 용어로 검색
  EVALUATE: session-manager.ts (0.95), jwt-utils.ts (0.85) 발견
  REFINE: 충분한 컨텍스트 (2개의 높은 관련성 파일)

결과: auth.ts, tokens.ts, session-manager.ts, jwt-utils.ts
```

### 예시 2: 기능 구현

```
작업: "API 엔드포인트에 속도 제한 추가"

사이클 1:
  DISPATCH: routes/**에서 "rate", "limit", "api" 검색
  EVALUATE: 매칭 없음 - 코드베이스는 "throttle" 용어 사용
  REFINE: "throttle", "middleware" 키워드 추가

사이클 2:
  DISPATCH: 정제된 용어로 검색
  EVALUATE: throttle.ts (0.9), middleware/index.ts (0.7) 발견
  REFINE: 라우터 패턴 필요

사이클 3:
  DISPATCH: "router", "express" 패턴 검색
  EVALUATE: router-setup.ts (0.8) 발견
  REFINE: 충분한 컨텍스트

결과: throttle.ts, middleware/index.ts, router-setup.ts
```

## Agent와의 통합

Agent 프롬프트에서 사용:

```markdown
이 작업을 위한 컨텍스트를 검색할 때:
1. 광범위 키워드 검색부터 시작
2. 각 파일의 관련성 평가 (0-1 척도)
3. 아직 빠진 컨텍스트 식별
4. 검색 기준을 정제하고 반복 (최대 3회 사이클)
5. 관련성 >= 0.7인 파일 반환
```

## 모범 사례

1. **넓게 시작하여 점차 좁히기** - 초기 쿼리를 과도하게 구체화하지 않기
2. **코드베이스 용어 학습** - 첫 번째 사이클이 보통 명명 규칙을 드러냄
3. **빠진 내용 추적** - 명시적인 빈틈 식별이 정제를 주도
4. **"충분히 좋을 때" 멈추기** - 3개의 높은 관련성 파일이 10개의 보통 파일보다 나음
5. **자신 있게 제외** - 낮은 관련성 파일은 관련성이 높아지지 않음

## 관련 자료

- [Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - 서브 agent 조율 섹션
- `continuous-learning` 스킬 - 시간에 따라 개선되는 패턴용
- `~/.claude/agents/`의 Agent 정의
