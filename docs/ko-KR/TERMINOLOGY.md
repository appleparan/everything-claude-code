# 용어 대조표 (Terminology Glossary)

이 문서는 한국어 번역의 용어 대조를 기록하여 번역 일관성을 보장합니다.

## 상태 설명

- **확정 (Confirmed)**: 사용자가 확인한 번역
- **검토 대기 (Pending)**: 사용자 검토가 필요한 번역

---

## 용어표

| English | ko-KR | 상태 | 비고 |
|---------|-------|------|------|
| Agent | 에이전트 | 확정 | 한국어 표기 사용 |
| Hook | 훅 | 확정 | 한국어 표기 사용 |
| Plugin | 플러그인 | 확정 | 한국어 표기 사용 |
| Token | 토큰 | 확정 | 한국어 표기 사용 |
| Skill | 스킬 | 검토 대기 | |
| Command | 커맨드 | 검토 대기 | |
| Rule | 규칙 | 검토 대기 | |
| TDD (Test-Driven Development) | TDD(테스트 주도 개발) | 검토 대기 | 첫 등장 시 풀어서 표기 |
| E2E (End-to-End) | E2E(엔드투엔드) | 검토 대기 | 첫 등장 시 풀어서 표기 |
| API | API | 검토 대기 | 영문 유지 |
| CLI | CLI | 검토 대기 | 영문 유지 |
| IDE | IDE | 검토 대기 | 영문 유지 |
| MCP (Model Context Protocol) | MCP | 검토 대기 | 영문 유지 |
| Workflow | 워크플로우 | 검토 대기 | |
| Codebase | 코드베이스 | 검토 대기 | |
| Coverage | 커버리지 | 검토 대기 | |
| Build | 빌드 | 검토 대기 | |
| Debug | 디버그 | 검토 대기 | |
| Deploy | 배포 | 검토 대기 | |
| Commit | 커밋 | 검토 대기 | Git 용어 한국어 표기 |
| PR (Pull Request) | PR | 검토 대기 | 영문 유지 |
| Branch | 브랜치 | 검토 대기 | |
| Merge | 머지 | 검토 대기 | |
| Repository | 저장소 | 검토 대기 | |
| Fork | Fork | 검토 대기 | 영문 유지 |
| Supabase | Supabase | - | 제품명 유지 |
| Redis | Redis | - | 제품명 유지 |
| Playwright | Playwright | - | 제품명 유지 |
| TypeScript | TypeScript | - | 언어명 유지 |
| JavaScript | JavaScript | - | 언어명 유지 |
| Go/Golang | Go | - | 언어명 유지 |
| React | React | - | 프레임워크명 유지 |
| Next.js | Next.js | - | 프레임워크명 유지 |
| PostgreSQL | PostgreSQL | - | 제품명 유지 |
| RLS (Row Level Security) | RLS(행 수준 보안) | 검토 대기 | 첫 등장 시 풀어서 표기 |
| OWASP | OWASP | - | 영문 유지 |
| XSS | XSS | - | 영문 유지 |
| SQL Injection | SQL 인젝션 | 검토 대기 | |
| CSRF | CSRF | - | 영문 유지 |
| Refactor | 리팩토링 | 검토 대기 | |
| Dead Code | 불필요한 코드 | 검토 대기 | |
| Lint/Linter | Lint | 검토 대기 | 영문 유지 |
| Code Review | 코드 리뷰 | 검토 대기 | |
| Security Review | 보안 리뷰 | 검토 대기 | |
| Best Practices | 모범 사례 | 검토 대기 | |
| Edge Case | 엣지 케이스 | 검토 대기 | |
| Happy Path | 정상 경로 | 검토 대기 | |
| Fallback | 폴백 | 검토 대기 | |
| Cache | 캐시 | 검토 대기 | |
| Queue | 큐 | 검토 대기 | |
| Pagination | 페이지네이션 | 검토 대기 | |
| Cursor | 커서 | 검토 대기 | |
| Index | 인덱스 | 검토 대기 | |
| Schema | 스키마 | 검토 대기 | |
| Migration | 마이그레이션 | 검토 대기 | |
| Transaction | 트랜잭션 | 검토 대기 | |
| Concurrency | 동시성 | 검토 대기 | |
| Goroutine | Goroutine | - | Go 용어 유지 |
| Channel | Channel | 검토 대기 | Go 컨텍스트에서는 유지 가능 |
| Mutex | Mutex | - | 영문 유지 |
| Interface | 인터페이스 | 검토 대기 | |
| Struct | Struct | - | Go 용어 유지 |
| Mock | Mock | 검토 대기 | 테스트 용어 유지 가능 |
| Stub | Stub | 검토 대기 | 테스트 용어 유지 가능 |
| Fixture | Fixture | 검토 대기 | 테스트 용어 유지 가능 |
| Assertion | 어설션 | 검토 대기 | |
| Snapshot | 스냅샷 | 검토 대기 | |
| Trace | 트레이스 | 검토 대기 | |
| Artifact | 아티팩트 | 검토 대기 | |
| CI/CD | CI/CD | - | 영문 유지 |
| Pipeline | 파이프라인 | 검토 대기 | |

---

## 번역 원칙

1. **제품명**: 영문 유지 (Supabase, Redis, Playwright)
2. **프로그래밍 언어**: 영문 유지 (TypeScript, Go, JavaScript)
3. **프레임워크명**: 영문 유지 (React, Next.js, Vue)
4. **기술 약어**: 영문 유지 (API, CLI, IDE, MCP, TDD, E2E)
5. **Git 용어**: 한국어 음차 표기 우선 (커밋, 브랜치, 머지), 일부 영문 유지 (PR, Fork)
6. **코드 내용**: 번역하지 않음 (변수명, 함수명, 주석은 원본 유지, 다만 설명적 주석은 번역 가능)
7. **첫 등장 시**: 약어가 처음 나올 때 풀어서 설명
8. **외래어 표기**: 가능한 한 국립국어원 외래어 표기법 준수

---

## 업데이트 기록

- 2024-XX-XX: 초판 생성, 사용자 확정 용어 포함
