---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including unit, integration, and E2E tests.
---

# 테스트 주도 개발 워크플로우

이 스킬은 모든 코드 개발이 TDD 원칙을 따르고 완전한 테스트 커버리지를 갖추도록 보장합니다.

## 활성화 시점

- 새로운 기능이나 기능적 코드 작성 시
- 버그나 이슈 수정 시
- 기존 코드 리팩터링 시
- API 엔드포인트 추가 시
- 새로운 컴포넌트 생성 시

## 핵심 원칙

### 1. 코드보다 테스트 먼저
항상 테스트를 먼저 작성하고, 그 다음 테스트를 통과하는 코드를 구현합니다.

### 2. 커버리지 요구 사항
- 최소 80% 커버리지 (단위 + 통합 + E2E)
- 모든 엣지 케이스 포함
- 에러 시나리오 테스트
- 경계 조건 검증

### 3. 테스트 유형

#### 단위 테스트
- 개별 함수와 유틸리티
- 컴포넌트 로직
- 순수 함수
- 헬퍼 함수와 유틸리티

#### 통합 테스트
- API 엔드포인트
- 데이터베이스 작업
- 서비스 상호작용
- 외부 API 호출

#### E2E 테스트 (Playwright)
- 핵심 사용자 흐름
- 전체 워크플로우
- 브라우저 자동화
- UI 상호작용

## TDD 워크플로우 단계

### 단계 1: 사용자 여정 작성
```
[역할]로서, [행동]을 원합니다, [이점]을 위해

예시:
사용자로서, 마켓을 시맨틱 검색하고 싶습니다,
정확한 키워드가 없어도 관련 마켓을 찾을 수 있도록.
```

### 단계 2: 테스트 케이스 생성
각 사용자 여정에 대한 완전한 테스트 케이스를 생성합니다:

```typescript
describe('Semantic Search', () => {
  it('returns relevant markets for query', async () => {
    // 테스트 구현
  })

  it('handles empty query gracefully', async () => {
    // 엣지 케이스 테스트
  })

  it('falls back to substring search when Redis unavailable', async () => {
    // 폴백 동작 테스트
  })

  it('sorts results by similarity score', async () => {
    // 정렬 로직 테스트
  })
})
```

### 단계 3: 테스트 실행 (실패해야 함)
```bash
npm test
# 테스트가 실패해야 합니다 - 아직 구현하지 않았으므로
```

### 단계 4: 코드 구현
테스트를 통과시키는 최소한의 코드를 작성합니다:

```typescript
// 테스트에 의해 주도되는 구현
export async function searchMarkets(query: string) {
  // 구현 코드
}
```

### 단계 5: 테스트 재실행
```bash
npm test
# 이제 테스트가 통과해야 합니다
```

### 단계 6: 리팩터링
테스트를 통과하는 상태를 유지하면서 코드 품질을 개선합니다:
- 중복 제거
- 네이밍 개선
- 성능 최적화
- 가독성 향상

### 단계 7: 커버리지 확인
```bash
npm run test:coverage
# 80%+ 커버리지 달성 확인
```

## 테스트 패턴

### 단위 테스트 패턴 (Jest/Vitest)
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### API 통합 테스트 패턴
```typescript
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /api/markets', () => {
  it('returns markets successfully', async () => {
    const request = new NextRequest('http://localhost/api/markets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('validates query parameters', async () => {
    const request = new NextRequest('http://localhost/api/markets?limit=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('handles database errors gracefully', async () => {
    // 데이터베이스 실패 Mock
    const request = new NextRequest('http://localhost/api/markets')
    // 에러 처리 테스트
  })
})
```

### E2E 테스트 패턴 (Playwright)
```typescript
import { test, expect } from '@playwright/test'

test('user can search and filter markets', async ({ page }) => {
  // 마켓 페이지로 이동
  await page.goto('/')
  await page.click('a[href="/markets"]')

  // 페이지 로드 확인
  await expect(page.locator('h1')).toContainText('Markets')

  // 마켓 검색
  await page.fill('input[placeholder="Search markets"]', 'election')

  // debounce 및 결과 대기
  await page.waitForTimeout(600)

  // 검색 결과 표시 확인
  const results = page.locator('[data-testid="market-card"]')
  await expect(results).toHaveCount(5, { timeout: 5000 })

  // 결과에 검색어가 포함되어 있는지 확인
  const firstResult = results.first()
  await expect(firstResult).toContainText('election', { ignoreCase: true })

  // 상태별 필터링
  await page.click('button:has-text("Active")')

  // 필터링 결과 확인
  await expect(results).toHaveCount(3)
})

test('user can create a new market', async ({ page }) => {
  // 먼저 로그인
  await page.goto('/creator-dashboard')

  // 마켓 생성 폼 작성
  await page.fill('input[name="name"]', 'Test Market')
  await page.fill('textarea[name="description"]', 'Test description')
  await page.fill('input[name="endDate"]', '2025-12-31')

  // 폼 제출
  await page.click('button[type="submit"]')

  // 성공 메시지 확인
  await expect(page.locator('text=Market created successfully')).toBeVisible()

  // 마켓 페이지로 리다이렉트 확인
  await expect(page).toHaveURL(/\/markets\/test-market/)
})
```

## 테스트 파일 구조

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx          # 단위 테스트
│   │   └── Button.stories.tsx       # Storybook
│   └── MarketCard/
│       ├── MarketCard.tsx
│       └── MarketCard.test.tsx
├── app/
│   └── api/
│       └── markets/
│           ├── route.ts
│           └── route.test.ts         # 통합 테스트
└── e2e/
    ├── markets.spec.ts               # E2E 테스트
    ├── trading.spec.ts
    └── auth.spec.ts
```

## 외부 서비스 Mock

### Supabase Mock
```typescript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{ id: 1, name: 'Test Market' }],
          error: null
        }))
      }))
    }))
  }
}))
```

### Redis Mock
```typescript
jest.mock('@/lib/redis', () => ({
  searchMarketsByVector: jest.fn(() => Promise.resolve([
    { slug: 'test-market', similarity_score: 0.95 }
  ])),
  checkRedisHealth: jest.fn(() => Promise.resolve({ connected: true }))
}))
```

### OpenAI Mock
```typescript
jest.mock('@/lib/openai', () => ({
  generateEmbedding: jest.fn(() => Promise.resolve(
    new Array(1536).fill(0.1) // Mock 1536차원 임베딩 벡터
  ))
}))
```

## 테스트 커버리지 검증

### 커버리지 리포트 실행
```bash
npm run test:coverage
```

### 커버리지 임계값
```json
{
  "jest": {
    "coverageThresholds": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## 흔한 테스트 실수 피하기

### 잘못된 방법: 구현 세부사항 테스트
```typescript
// 내부 상태를 테스트하지 마세요
expect(component.state.count).toBe(5)
```

### 올바른 방법: 사용자가 볼 수 있는 동작 테스트
```typescript
// 사용자에게 보이는 것을 테스트하세요
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

### 잘못된 방법: 깨지기 쉬운 셀렉터
```typescript
// 쉽게 깨짐
await page.click('.css-class-xyz')
```

### 올바른 방법: 시맨틱 셀렉터
```typescript
// 변경에 탄력적
await page.click('button:has-text("Submit")')
await page.click('[data-testid="submit-button"]')
```

### 잘못된 방법: 테스트 격리 없음
```typescript
// 테스트 간 의존성
test('creates user', () => { /* ... */ })
test('updates same user', () => { /* 이전 테스트에 의존 */ })
```

### 올바른 방법: 독립적인 테스트
```typescript
// 각 테스트가 자체 데이터를 설정
test('creates user', () => {
  const user = createTestUser()
  // 테스트 로직
})

test('updates user', () => {
  const user = createTestUser()
  // 업데이트 로직
})
```

## 지속적 테스트

### 개발 중 Watch 모드
```bash
npm test -- --watch
# 파일 변경 시 자동으로 테스트 실행
```

### Pre-Commit Hook
```bash
# 매 commit 전 실행
npm test && npm run lint
```

### CI/CD 통합
```yaml
# GitHub Actions
- name: Run Tests
  run: npm test -- --coverage
- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## 모범 사례

1. **테스트를 먼저 작성** - 항상 TDD
2. **하나의 테스트에 하나의 assertion** - 단일 동작에 집중
3. **서술적인 테스트 이름** - 테스트 내용을 설명
4. **Arrange-Act-Assert** - 명확한 테스트 구조
5. **외부 의존성 Mock** - 단위 테스트 격리
6. **엣지 케이스 테스트** - Null, undefined, 빈 값, 큰 값
7. **에러 경로 테스트** - 정상 경로만이 아닌
8. **테스트를 빠르게 유지** - 단위 테스트 각각 < 50ms
9. **테스트 후 정리** - 부작용 없음
10. **커버리지 리포트 확인** - 빈틈 식별

## 성공 지표

- 80%+ 코드 커버리지 달성
- 모든 테스트 통과 (그린)
- 건너뛴 테스트나 비활성화된 테스트 없음
- 빠른 테스트 실행 (단위 테스트 < 30초)
- E2E 테스트가 핵심 사용자 흐름을 커버
- 테스트가 프로덕션 전에 버그를 포착

---

**기억하세요**: 테스트는 선택이 아닙니다. 테스트는 자신감 있는 리팩터링, 빠른 개발, 프로덕션 신뢰성을 위한 안전망입니다.
