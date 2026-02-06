---
description: Comprehensive Go code review for idiomatic patterns, concurrency safety, error handling, and security. Invokes the go-reviewer agent.
---

# Go 코드 리뷰

이 명령어는 **go-reviewer** Agent를 호출하여 포괄적인 Go 전용 코드 리뷰를 수행합니다.

## 이 명령어의 기능

1. **Go 변경 사항 식별**: `git diff`를 통해 수정된 `.go` 파일 찾기
2. **정적 분석 실행**: `go vet`, `staticcheck`, `golangci-lint` 실행
3. **보안 스캔**: SQL 인젝션, 명령어 인젝션, 레이스 컨디션 검사
4. **동시성 리뷰**: goroutine 안전성, channel 사용, mutex 패턴 분석
5. **관용적 Go 검사**: 코드가 Go 관례와 모범 사례를 따르는지 확인
6. **보고서 생성**: 심각도별로 문제 분류

## 언제 사용하나요

다음과 같은 경우 `/go-review`를 사용하세요:
- Go 코드를 작성하거나 수정한 후
- Go 변경 사항을 커밋하기 전
- Go 코드가 포함된 PR을 리뷰할 때
- 새로운 Go 코드베이스에 합류할 때
- 관용적 Go 패턴을 학습할 때

## 리뷰 카테고리

### 치명적 (반드시 수정)
- SQL/명령어 인젝션 취약점
- 동기화 없는 레이스 컨디션
- Goroutine 누수
- 하드코딩된 자격 증명
- 안전하지 않은 포인터 사용
- 핵심 경로에서 오류 무시

### 높음 (수정 권장)
- 컨텍스트를 포함한 오류 래핑 누락
- Error 반환 대신 Panic 사용
- Context 미전달
- 버퍼 없는 channel로 인한 데드락
- 인터페이스 미충족 오류
- mutex 보호 누락

### 중간 (고려)
- 비관용적 코드 패턴
- 내보낸 항목에 godoc 주석 누락
- 비효율적인 문자열 연결
- Slice 사전 할당 누락
- 테이블 주도 테스트 미사용

## 자동 실행 검사

```bash
# 정적 분석
go vet ./...

# 고급 검사 (설치된 경우)
staticcheck ./...
golangci-lint run

# 레이스 감지
go build -race ./...

# 보안 취약점
govulncheck ./...
```

## 승인 기준

| 상태 | 조건 |
|------|------|
| 승인 | 치명적 또는 높은 우선순위 문제 없음 |
| 경고 | 중간 우선순위 문제만 존재 (주의하여 병합) |
| 차단 | 치명적 또는 높은 우선순위 문제 발견 |

## 다른 명령어와의 통합

- 먼저 `/go-test`를 사용하여 테스트 통과 확인
- 빌드 오류 발생 시 `/go-build` 사용
- 커밋 전 `/go-review` 사용
- Go 전용이 아닌 문제에는 `/code-review` 사용

## 관련 항목

- Agent: `agents/go-reviewer.md`
- 스킬: `skills/golang-patterns/`, `skills/golang-testing/`
