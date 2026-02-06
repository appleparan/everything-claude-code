# Everything Claude Code에 기여하기

기여에 관심을 가져주셔서 감사합니다. 이 저장소는 Claude Code 사용자를 위한 커뮤니티 리소스를 지향합니다.

## 우리가 찾고 있는 것

### 에이전트 (Agents)

특정 작업을 효과적으로 처리할 수 있는 새로운 에이전트:
- 특정 언어 리뷰어 (Python, Go, Rust)
- 프레임워크 전문가 (Django, Rails, Laravel, Spring)
- DevOps 전문가 (Kubernetes, Terraform, CI/CD)
- 도메인 전문가 (ML 파이프라인, 데이터 엔지니어링, 모바일 개발)

### 스킬 (Skills)

워크플로우 정의 및 도메인 지식:
- 언어별 모범 사례
- 프레임워크 패턴
- 테스트 전략
- 아키텍처 가이드
- 특정 도메인 지식

### 커맨드 (Commands)

유용한 워크플로우를 호출하는 슬래시 커맨드:
- 배포 커맨드
- 테스트 커맨드
- 문서화 커맨드
- 코드 생성 커맨드

### 훅 (Hooks)

유용한 자동화:
- Lint/포맷팅 훅
- 보안 검사
- 유효성 검증 훅
- 알림 훅

### 규칙 (Rules)

반드시 준수해야 하는 가이드라인:
- 보안 규칙
- 코드 스타일 규칙
- 테스트 요구사항
- 네이밍 컨벤션

### MCP 설정

새로운 또는 개선된 MCP 서버 설정:
- 데이터베이스 통합
- 클라우드 공급자 MCP
- 모니터링 도구
- 커뮤니케이션 도구

---

## 기여 방법

### 1. 저장소 Fork

```bash
git clone https://github.com/YOUR_USERNAME/everything-claude-code.git
cd everything-claude-code
```

### 2. 브랜치 생성

```bash
git checkout -b add-python-reviewer
```

### 3. 기여 내용 추가

적절한 디렉토리에 파일을 배치하세요:
- `agents/` - 새 에이전트
- `skills/` - 스킬 (단일 .md 파일 또는 디렉토리)
- `commands/` - 슬래시 커맨드
- `rules/` - 규칙 파일
- `hooks/` - 훅 설정
- `mcp-configs/` - MCP 서버 설정

### 4. 형식 준수

**에이전트**에는 frontmatter를 포함해야 합니다:

```markdown
---
name: agent-name
description: What it does
tools: Read, Grep, Glob, Bash
model: sonnet
---

Instructions here...
```

**스킬**은 명확하고 실행 가능해야 합니다:

```markdown
# Skill Name

## When to Use

...

## How It Works

...

## Examples

...
```

**커맨드**에는 기능 설명을 포함해야 합니다:

```markdown
---
description: Brief description of command
---

# Command Name

Detailed instructions...
```

**훅**에는 설명을 포함해야 합니다:

```json
{
  "matcher": "...",
  "hooks": [...],
  "description": "What this hook does"
}
```

### 5. 기여 내용 테스트

제출하기 전에 설정이 Claude Code와 정상적으로 작동하는지 확인하세요.

### 6. PR 제출

```bash
git add .
git commit -m "Add Python code reviewer agent"
git push origin add-python-reviewer
```

그런 다음 PR을 열어 다음을 포함하세요:
- 무엇을 추가했는지
- 왜 유용한지
- 어떻게 테스트했는지

---

## 가이드라인

### 권장 사항

- 설정을 집중적이고 모듈화하여 유지
- 명확한 설명 포함
- 제출 전에 테스트
- 기존 패턴 준수
- 의존성 문서화

### 지양 사항

- 민감한 데이터 포함 (API 키, 토큰, 경로)
- 지나치게 복잡하거나 특수한 설정 추가
- 테스트하지 않은 설정 제출
- 중복 기능 생성
- 대체 수단 없이 특정 유료 서비스가 필요한 설정 추가

---

## 파일 네이밍

- 소문자와 하이픈 사용: `python-reviewer.md`
- 설명적으로 작성: `workflow.md` 대신 `tdd-workflow.md`
- 에이전트/스킬 이름과 파일명을 일치

---

## 질문이 있으신가요?

Issue를 열거나 X에서 연락하세요: [@affaanmustafa](https://x.com/affaanmustafa)

---

기여해 주셔서 감사합니다. 함께 훌륭한 리소스를 만들어 갑시다.
