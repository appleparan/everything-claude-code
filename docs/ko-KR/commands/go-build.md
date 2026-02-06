---
description: Fix Go build errors, go vet warnings, and linter issues incrementally. Invokes the go-build-resolver agent for minimal, surgical fixes.
---

# Go 빌드 및 수정

이 명령어는 **go-build-resolver** Agent를 호출하여 최소한의 변경으로 Go 빌드 오류를 점진적으로 수정합니다.

## 이 명령어의 기능

1. **진단 실행**: `go build`, `go vet`, `staticcheck` 실행
2. **오류 분석**: 파일별로 그룹화하고 심각도별로 정렬
3. **점진적 수정**: 한 번에 하나의 오류씩 수정
4. **매 수정 후 검증**: 각 변경 후 빌드 재실행
5. **요약 보고**: 수정된 항목과 남은 문제 표시

## 언제 사용하나요

다음과 같은 경우 `/go-build`를 사용하세요:
- `go build ./...`가 오류와 함께 실패할 때
- `go vet ./...`가 문제를 보고할 때
- `golangci-lint run`이 경고를 표시할 때
- 모듈 의존성이 손상되었을 때
- 빌드를 깨뜨리는 변경 사항을 풀(pull)한 후

## 실행되는 진단 명령어

```bash
# 주요 빌드 검사
go build ./...

# 정적 분석
go vet ./...

# 확장 린팅 (사용 가능한 경우)
staticcheck ./...
golangci-lint run

# 모듈 문제
go mod verify
go mod tidy -v
```

## 자주 수정되는 오류

| 오류 | 일반적인 수정 |
|------|----------|
| `undefined: X` | import 추가 또는 오타 수정 |
| `cannot use X as Y` | 타입 변환 또는 할당 수정 |
| `missing return` | return 문 추가 |
| `X does not implement Y` | 누락된 메서드 추가 |
| `import cycle` | 패키지 재구성 |
| `declared but not used` | 변수 제거 또는 사용 |
| `cannot find package` | `go get` 또는 `go mod tidy` |

## 수정 전략

1. **빌드 오류 우선** - 코드가 반드시 컴파일되어야 함
2. **Vet 경고 다음** - 의심스러운 구조 수정
3. **Lint 경고 세 번째** - 스타일 및 모범 사례
4. **한 번에 하나씩 수정** - 각 변경을 검증
5. **최소 변경** - 리팩터링하지 말고 수정만

## 중지 조건

Agent는 다음과 같은 경우 중지하고 보고합니다:
- 3회 시도 후에도 동일한 오류가 지속될 때
- 수정이 더 많은 오류를 도입할 때
- 아키텍처 변경이 필요할 때
- 외부 의존성이 누락되었을 때

## 관련 명령어

- `/go-test` - 빌드 성공 후 테스트 실행
- `/go-review` - 코드 품질 리뷰
- `/verify` - 전체 검증 사이클

## 관련 항목

- Agent: `agents/go-build-resolver.md`
- 스킬: `skills/golang-patterns/`
