---
description: Enforce TDD workflow for Go. Write table-driven tests first, then implement. Verify 80%+ coverage with go test -cover.
---

# Go TDD 명령어

이 명령어는 관용적인 Go 테스트 패턴을 사용하여 Go 코드에 테스트 주도 개발 방법론을 적용합니다.

## 이 명령어의 기능

1. **타입/인터페이스 정의**: 함수 시그니처 골격을 먼저 생성
2. **테이블 주도 테스트 작성**: 포괄적인 테스트 케이스 생성 (RED)
3. **테스트 실행**: 올바른 이유로 테스트가 실패하는지 확인
4. **코드 구현**: 테스트를 통과시키는 최소한의 코드 작성 (GREEN)
5. **리팩터링**: 테스트가 통과하는 상태를 유지하면서 개선
6. **커버리지 확인**: 80% 이상 커버리지 보장

## 언제 사용하나요

다음과 같은 경우 `/go-test`를 사용하세요:
- 새로운 Go 함수를 구현할 때
- 기존 코드에 테스트 커버리지를 추가할 때
- 버그를 수정할 때 (먼저 실패하는 테스트 작성)
- 핵심 비즈니스 로직을 구축할 때
- Go에서 TDD 워크플로를 학습할 때

## TDD 사이클

```
RED     → 실패하는 테이블 주도 테스트 작성
GREEN   → 테스트를 통과시키는 최소한의 코드 구현
REFACTOR → 코드 개선, 테스트는 통과 상태 유지
REPEAT  → 다음 테스트 케이스
```

## 테스트 패턴

### 테이블 주도 테스트
```go
tests := []struct {
    name     string
    input    InputType
    want     OutputType
    wantErr  bool
}{
    {"case 1", input1, want1, false},
    {"case 2", input2, want2, true},
}

for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got, err := Function(tt.input)
        // 단언
    })
}
```

### 병렬 테스트
```go
for _, tt := range tests {
    tt := tt // 캡처
    t.Run(tt.name, func(t *testing.T) {
        t.Parallel()
        // 테스트 내용
    })
}
```

### 테스트 헬퍼 함수
```go
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db := createDB()
    t.Cleanup(func() { db.Close() })
    return db
}
```

## 커버리지 명령어

```bash
# 기본 커버리지
go test -cover ./...

# 커버리지 profile
go test -coverprofile=coverage.out ./...

# 브라우저에서 확인
go tool cover -html=coverage.out

# 함수별 커버리지 표시
go tool cover -func=coverage.out

# 레이스 감지 포함
go test -race -cover ./...
```

## 커버리지 목표

| 코드 유형 | 목표 |
|-----------|------|
| 핵심 비즈니스 로직 | 100% |
| 공개 API | 90%+ |
| 일반 코드 | 80%+ |
| 생성된 코드 | 제외 |

## TDD 모범 사례

**해야 할 것:**
- 구현 전에 항상 테스트를 먼저 작성
- 매 변경 후 테스트 실행
- 포괄적인 커버리지를 위해 테이블 주도 테스트 사용
- 구현 세부사항이 아닌 동작을 테스트
- 경계 케이스 포함 (빈 값, nil, 최댓값)

**하지 말아야 할 것:**
- 테스트 전에 구현 코드 작성
- RED 단계 건너뛰기
- 비공개 함수를 직접 테스트
- 테스트에서 `time.Sleep` 사용
- 불안정한 테스트 무시

## 관련 명령어

- `/go-build` - 빌드 오류 수정
- `/go-review` - 구현 후 코드 리뷰
- `/verify` - 전체 검증 사이클 실행

## 관련 항목

- 스킬: `skills/golang-testing/`
- 스킬: `skills/tdd-workflow/`
