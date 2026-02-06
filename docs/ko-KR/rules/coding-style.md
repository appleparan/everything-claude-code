# 코딩 스타일

## 불변성 (핵심)

항상 새로운 객체를 생성하고, 절대 변경하지 않음:

```javascript
// 잘못된 예: 변경(mutation)
function updateUser(user, name) {
  user.name = name  // 변경!
  return user
}

// 올바른 예: 불변성
function updateUser(user, name) {
  return {
    ...user,
    name
  }
}
```

## 파일 구성

작은 파일 여러 개 > 큰 파일 소수:
- 높은 응집도, 낮은 결합도
- 일반적으로 200-400줄, 최대 800줄
- 대형 컴포넌트에서 유틸리티 추출
- 타입이 아닌 기능/도메인별로 구성

## 오류 처리

항상 포괄적으로 오류를 처리:

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('Detailed user-friendly message')
}
```

## 입력 유효성 검사

항상 사용자 입력을 검증:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input)
```

## 코드 품질 체크리스트

작업 완료로 표시하기 전:
- [ ] 코드가 읽기 쉽고 네이밍이 적절함
- [ ] 함수가 작음 (<50줄)
- [ ] 파일이 집중적임 (<800줄)
- [ ] 깊은 중첩 없음 (>4단계)
- [ ] 적절한 오류 처리
- [ ] console.log 문 없음
- [ ] 하드코딩된 값 없음
- [ ] 변경(mutation) 없음 (불변 패턴 사용)
