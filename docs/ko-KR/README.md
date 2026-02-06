# Everything Claude Code

[![Stars](https://img.shields.io/github/stars/affaan-m/everything-claude-code?style=flat)](https://github.com/affaan-m/everything-claude-code/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Shell](https://img.shields.io/badge/-Shell-4EAA25?logo=gnu-bash&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Go](https://img.shields.io/badge/-Go-00ADD8?logo=go&logoColor=white)
![Markdown](https://img.shields.io/badge/-Markdown-000000?logo=markdown&logoColor=white)

---

<div align="center">

**🌐 Language / 语言 / 語言 / 언어**

[**English**](../../README.md) | [简体中文](../../README.zh-CN.md) | [繁體中文](../zh-TW/README.md) | [한국어](README.md)

</div>

---

**Anthropic 해커톤 우승팀이 만든 완전한 Claude Code 설정 모음.**

10개월 이상의 집중적인 일상 사용과 실제 제품 개발을 통해 검증된 프로덕션 수준의 에이전트, 스킬, 훅, 커맨드, 규칙 및 MCP 설정.

---

## 가이드

이 저장소에는 소스 코드만 포함되어 있습니다. 가이드에서 모든 내용을 설명합니다.

<table>
<tr>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2012378465664745795">
<img src="https://github.com/user-attachments/assets/1a471488-59cc-425b-8345-5245c7efbcef" alt="Everything Claude Code 간편 가이드" />
</a>
</td>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2014040193557471352">
<img src="https://github.com/user-attachments/assets/c9ca43bc-b149-427f-b551-af6840c368f0" alt="Everything Claude Code 전체 가이드" />
</a>
</td>
</tr>
<tr>
<td align="center"><b>간편 가이드</b><br/>설정, 기초, 철학. <b>먼저 이 가이드를 읽어주세요.</b></td>
<td align="center"><b>전체 가이드</b><br/>토큰 최적화, 메모리 지속성, 평가, 병렬 처리.</td>
</tr>
</table>

| 주제 | 학습 내용 |
|------|----------|
| 토큰 최적화 | 모델 선택, 시스템 프롬프트 간소화, 백그라운드 프로세스 |
| 메모리 지속성 | 세션 간 컨텍스트를 자동 저장/로드하는 훅 |
| 지속적 학습 | 세션에서 패턴을 자동 추출하여 재사용 가능한 스킬로 전환 |
| 검증 루프 | 체크포인트 vs 지속적 평가, 채점기 유형, pass@k 지표 |
| 병렬 처리 | Git worktrees, 체이닝 방법, 인스턴스 확장 시기 |
| 서브 에이전트 조율 | 컨텍스트 문제, 점진적 검색 패턴 |

---

## 🚀 빠른 시작

2분 안에 시작하기:

### 1단계: 플러그인 설치

```bash
# 마켓플레이스 추가
/plugin marketplace add affaan-m/everything-claude-code

# 플러그인 설치
/plugin install everything-claude-code@everything-claude-code
```

### 2단계: 규칙 설치 (필수)

> ⚠️ **중요:** Claude Code 플러그인은 `rules`를 자동 배포할 수 없으므로 수동 설치가 필요합니다:

```bash
# 먼저 저장소를 클론합니다
git clone https://github.com/affaan-m/everything-claude-code.git

# 규칙 복사 (모든 프로젝트에 적용)
cp -r everything-claude-code/rules/* ~/.claude/rules/
```

### 3단계: 사용 시작

```bash
# 커맨드 사용해보기
/plan "사용자 인증 추가"

# 사용 가능한 커맨드 확인
/plugin list everything-claude-code@everything-claude-code
```

✨ **완료!** 이제 15개 이상의 에이전트, 30개 이상의 스킬, 20개 이상의 커맨드를 사용할 수 있습니다.

---

## 🌐 크로스 플랫폼 지원

이 플러그인은 **Windows, macOS, Linux**을 완벽하게 지원합니다. 모든 훅과 스크립트는 최적의 호환성을 위해 Node.js로 재작성되었습니다.

### 패키지 매니저 감지

플러그인은 선호하는 패키지 매니저(npm, pnpm, yarn 또는 bun)를 다음 우선순위로 자동 감지합니다:

1. **환경 변수**: `CLAUDE_PACKAGE_MANAGER`
2. **프로젝트 설정**: `.claude/package-manager.json`
3. **package.json**: `packageManager` 필드
4. **잠금 파일**: package-lock.json, yarn.lock, pnpm-lock.yaml 또는 bun.lockb에서 감지
5. **전역 설정**: `~/.claude/package-manager.json`
6. **폴백**: 사용 가능한 첫 번째 패키지 매니저

선호하는 패키지 매니저 설정:

```bash
# 환경 변수로 설정
export CLAUDE_PACKAGE_MANAGER=pnpm

# 전역 설정으로
node scripts/setup-package-manager.js --global pnpm

# 프로젝트 설정으로
node scripts/setup-package-manager.js --project bun

# 현재 설정 감지
node scripts/setup-package-manager.js --detect
```

또는 Claude Code에서 `/setup-pm` 커맨드를 사용하세요.

---

## 📦 구성 요소 개요

이 저장소는 **Claude Code 플러그인**입니다 - 바로 설치하거나 개별 구성 요소를 수동으로 복사할 수 있습니다.

```
everything-claude-code/
|-- .claude-plugin/   # 플러그인 및 마켓플레이스 매니페스트
|   |-- plugin.json         # 플러그인 메타데이터 및 구성 요소 경로
|   |-- marketplace.json    # /plugin marketplace add용 마켓플레이스 카탈로그
|
|-- agents/           # 작업 위임을 위한 전문 서브 에이전트
|   |-- planner.md           # 기능 구현 계획
|   |-- architect.md         # 시스템 설계 결정
|   |-- tdd-guide.md         # 테스트 주도 개발
|   |-- code-reviewer.md     # 품질 및 보안 리뷰
|   |-- security-reviewer.md # 취약점 분석
|   |-- build-error-resolver.md
|   |-- e2e-runner.md        # Playwright E2E 테스트
|   |-- refactor-cleaner.md  # 불필요한 코드 정리
|   |-- doc-updater.md       # 문서 동기화
|   |-- go-reviewer.md       # Go 코드 리뷰 (신규)
|   |-- go-build-resolver.md # Go 빌드 오류 해결 (신규)
|
|-- skills/           # 워크플로우 정의 및 도메인 지식
|   |-- coding-standards/           # 프로그래밍 언어 모범 사례
|   |-- backend-patterns/           # API, 데이터베이스, 캐시 패턴
|   |-- frontend-patterns/          # React, Next.js 패턴
|   |-- continuous-learning/        # 세션에서 자동 패턴 추출 (전체 가이드)
|   |-- continuous-learning-v2/     # 직관 기반 학습 및 신뢰도 점수
|   |-- iterative-retrieval/        # 서브 에이전트의 점진적 컨텍스트 정제
|   |-- strategic-compact/          # 수동 압축 제안 (전체 가이드)
|   |-- tdd-workflow/               # TDD 방법론
|   |-- security-review/            # 보안 체크리스트
|   |-- eval-harness/               # 검증 루프 평가 (전체 가이드)
|   |-- verification-loop/          # 지속적 검증 (전체 가이드)
|   |-- golang-patterns/            # Go 관용적 문법 및 모범 사례 (신규)
|   |-- golang-testing/             # Go 테스트 패턴, TDD, 벤치마크 (신규)
|
|-- commands/         # 빠른 실행을 위한 슬래시 커맨드
|   |-- tdd.md              # /tdd - 테스트 주도 개발
|   |-- plan.md             # /plan - 구현 계획
|   |-- e2e.md              # /e2e - E2E 테스트 생성
|   |-- code-review.md      # /code-review - 품질 리뷰
|   |-- build-fix.md        # /build-fix - 빌드 오류 수정
|   |-- refactor-clean.md   # /refactor-clean - 불필요한 코드 제거
|   |-- learn.md            # /learn - 세션에서 패턴 추출 (전체 가이드)
|   |-- checkpoint.md       # /checkpoint - 검증 상태 저장 (전체 가이드)
|   |-- verify.md           # /verify - 검증 루프 실행 (전체 가이드)
|   |-- setup-pm.md         # /setup-pm - 패키지 매니저 설정
|   |-- go-review.md        # /go-review - Go 코드 리뷰 (신규)
|   |-- go-test.md          # /go-test - Go TDD 워크플로우 (신규)
|   |-- go-build.md         # /go-build - Go 빌드 오류 수정 (신규)
|
|-- rules/            # 반드시 준수해야 하는 가이드라인 (~/.claude/rules/에 복사)
|   |-- security.md         # 필수 보안 검사
|   |-- coding-style.md     # 불변성, 파일 구성
|   |-- testing.md          # TDD, 80% 커버리지 요구사항
|   |-- git-workflow.md     # 커밋 형식, PR 프로세스
|   |-- agents.md           # 서브 에이전트에 위임하는 시기
|   |-- performance.md      # 모델 선택, 컨텍스트 관리
|
|-- hooks/            # 트리거 기반 자동화
|   |-- hooks.json                # 모든 훅 설정 (PreToolUse, PostToolUse, Stop 등)
|   |-- memory-persistence/       # 세션 생명주기 훅 (전체 가이드)
|   |-- strategic-compact/        # 압축 제안 (전체 가이드)
|
|-- scripts/          # 크로스 플랫폼 Node.js 스크립트 (신규)
|   |-- lib/                     # 공유 유틸리티
|   |   |-- utils.js             # 크로스 플랫폼 파일/경로/시스템 유틸리티
|   |   |-- package-manager.js   # 패키지 매니저 감지 및 선택
|   |-- hooks/                   # 훅 구현
|   |   |-- session-start.js     # 세션 시작 시 컨텍스트 로드
|   |   |-- session-end.js       # 세션 종료 시 상태 저장
|   |   |-- pre-compact.js       # 압축 전 상태 저장
|   |   |-- suggest-compact.js   # 전략적 압축 제안
|   |   |-- evaluate-session.js  # 세션에서 패턴 추출
|   |-- setup-package-manager.js # 대화형 패키지 매니저 설정
|
|-- tests/            # 테스트 스위트 (신규)
|   |-- lib/                     # 라이브러리 테스트
|   |-- hooks/                   # 훅 테스트
|   |-- run-all.js               # 모든 테스트 실행
|
|-- contexts/         # 동적 시스템 프롬프트 주입 컨텍스트 (전체 가이드)
|   |-- dev.md              # 개발 모드 컨텍스트
|   |-- review.md           # 코드 리뷰 모드 컨텍스트
|   |-- research.md         # 연구/탐색 모드 컨텍스트
|
|-- examples/         # 예제 설정 및 세션
|   |-- CLAUDE.md           # 프로젝트 수준 설정 예제
|   |-- user-CLAUDE.md      # 사용자 수준 설정 예제
|
|-- mcp-configs/      # MCP 서버 설정
|   |-- mcp-servers.json    # GitHub, Supabase, Vercel, Railway 등
|
|-- marketplace.json  # 자체 호스팅 마켓플레이스 설정 (/plugin marketplace add용)
```

---

## 🛠️ 생태계 도구

### ecc.tools - 스킬 빌더

저장소에서 Claude Code 스킬을 자동으로 생성합니다.

[GitHub App 설치](https://github.com/apps/skill-creator) | [ecc.tools](https://ecc.tools)

저장소를 분석하여 다음을 생성합니다:
- **SKILL.md 파일** - Claude Code에서 바로 사용할 수 있는 스킬
- **직관 모음** - continuous-learning-v2용
- **패턴 추출** - 커밋 히스토리에서 학습

```bash
# GitHub App 설치 후 스킬은 다음 경로에 생성됩니다:
~/.claude/skills/generated/
```

`continuous-learning-v2` 스킬과 매끄럽게 통합되어 직관을 상속합니다.

---

## 📥 설치

### 옵션 1: 플러그인으로 설치 (권장)

이 저장소를 가장 쉽게 사용하는 방법 - Claude Code 플러그인으로 설치:

```bash
# 이 저장소를 마켓플레이스로 추가
/plugin marketplace add affaan-m/everything-claude-code

# 플러그인 설치
/plugin install everything-claude-code@everything-claude-code
```

또는 `~/.claude/settings.json`에 직접 추가:

```json
{
  "extraKnownMarketplaces": {
    "everything-claude-code": {
      "source": {
        "source": "github",
        "repo": "affaan-m/everything-claude-code"
      }
    }
  },
  "enabledPlugins": {
    "everything-claude-code@everything-claude-code": true
  }
}
```

이렇게 하면 모든 커맨드, 에이전트, 스킬 및 훅에 즉시 접근할 수 있습니다.

---

### 🔧 옵션 2: 수동 설치

설치 내용을 직접 제어하고 싶은 경우:

```bash
# 저장소 클론
git clone https://github.com/affaan-m/everything-claude-code.git

# 에이전트를 Claude 설정에 복사
cp everything-claude-code/agents/*.md ~/.claude/agents/

# 규칙 복사
cp everything-claude-code/rules/*.md ~/.claude/rules/

# 커맨드 복사
cp everything-claude-code/commands/*.md ~/.claude/commands/

# 스킬 복사
cp -r everything-claude-code/skills/* ~/.claude/skills/
```

#### settings.json에 훅 추가

`hooks/hooks.json`의 훅을 `~/.claude/settings.json`에 복사합니다.

#### MCP 설정

`mcp-configs/mcp-servers.json`에서 필요한 MCP 서버를 `~/.claude.json`에 복사합니다.

**중요:** `YOUR_*_HERE` 플레이스홀더를 실제 API 키로 교체하세요.

---

## 🎯 핵심 개념

### 에이전트 (Agents)

서브 에이전트는 제한된 범위에서 위임된 작업을 처리합니다. 예시:

```markdown
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
---

You are a senior code reviewer...
```

### 스킬 (Skills)

스킬은 커맨드나 에이전트가 호출하는 워크플로우 정의입니다:

```markdown
# TDD Workflow

1. Define interfaces first
2. Write failing tests (RED)
3. Implement minimal code (GREEN)
4. Refactor (IMPROVE)
5. Verify 80%+ coverage
```

### 훅 (Hooks)

훅은 도구 이벤트 시 트리거됩니다. 예시 - console.log 경고:

```json
{
  "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx)$\"",
  "hooks": [{
    "type": "command",
    "command": "#!/bin/bash\ngrep -n 'console\\.log' \"$file_path\" && echo '[Hook] Remove console.log' >&2"
  }]
}
```

### 규칙 (Rules)

규칙은 반드시 준수해야 하는 가이드라인입니다. 모듈화를 유지하세요:

```
~/.claude/rules/
  security.md      # 하드코딩된 시크릿 금지
  coding-style.md  # 불변성, 파일 제한
  testing.md       # TDD, 커버리지 요구사항
```

---

## 🧪 테스트 실행

플러그인에는 완전한 테스트 스위트가 포함되어 있습니다:

```bash
# 모든 테스트 실행
node tests/run-all.js

# 개별 테스트 파일 실행
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
```

---

## 🤝 기여하기

**기여를 환영하고 권장합니다.**

이 저장소는 커뮤니티 리소스를 지향합니다. 다음과 같은 것을 가지고 계시다면:
- 유용한 에이전트나 스킬
- 기발한 훅
- 더 나은 MCP 설정
- 개선된 규칙

기여해 주세요! 가이드라인은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

### 기여 아이디어

- 특정 언어 스킬 (Python, Rust 패턴) - Go는 이미 포함!
- 특정 프레임워크 설정 (Django, Rails, Laravel)
- DevOps 에이전트 (Kubernetes, Terraform, AWS)
- 테스트 전략 (다양한 프레임워크)
- 특정 도메인 지식 (ML, 데이터 엔지니어링, 모바일 개발)

---

## 📖 배경

저는 Claude Code가 실험적으로 출시된 이후부터 사용해 왔습니다. 2025년 9월 [@DRodriguezFX](https://x.com/DRodriguezFX)와 함께 Claude Code를 사용해 [zenith.chat](https://zenith.chat)을 만들어 Anthropic x Forum Ventures 해커톤에서 우승했습니다.

이 설정들은 여러 프로덕션 애플리케이션에서 실전 검증되었습니다.

---

## ⚠️ 중요 참고사항

### 컨텍스트 윈도우 관리

**핵심:** 모든 MCP를 동시에 활성화하지 마세요. 너무 많은 도구를 활성화하면 200k 컨텍스트 윈도우가 70k로 줄어듭니다.

경험 법칙:
- MCP는 20-30개 설정
- 프로젝트당 10개 미만 활성화
- 활성화된 도구는 80개 미만

프로젝트 설정에서 `disabledMcpServers`를 사용하여 사용하지 않는 MCP를 비활성화하세요.

### 커스터마이징

이 설정은 제 워크플로우에 맞춰져 있습니다. 다음과 같이 사용하세요:
1. 공감하는 부분부터 시작
2. 본인의 기술 스택에 맞게 수정
3. 불필요한 부분 제거
4. 나만의 패턴 추가

---

## 🌟 Star 히스토리

[![Star History Chart](https://api.star-history.com/svg?repos=affaan-m/everything-claude-code&type=Date)](https://star-history.com/#affaan-m/everything-claude-code&Date)

---

## 🔗 링크

- **간편 가이드 (여기서 시작):** [Everything Claude Code 간편 가이드](https://x.com/affaanmustafa/status/2012378465664745795)
- **전체 가이드 (고급):** [Everything Claude Code 전체 가이드](https://x.com/affaanmustafa/status/2014040193557471352)
- **팔로우:** [@affaanmustafa](https://x.com/affaanmustafa)
- **zenith.chat:** [zenith.chat](https://zenith.chat)

---

## 📄 라이선스

MIT - 자유롭게 사용하고, 필요에 따라 수정하고, 가능하다면 기여로 보답해 주세요.

---

**도움이 되셨다면 이 저장소에 Star를 눌러주세요. 두 가이드를 모두 읽어보세요. 멋진 것을 만들어 보세요.**
