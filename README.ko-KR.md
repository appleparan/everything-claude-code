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

[**English**](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](docs/zh-TW/README.md) | [한국어](README.ko-KR.md)

</div>

---

**Anthropic 해커톤 우승자의 완전한 Claude Code 설정 모음.**

실제 제품을 구축하며 10개월 이상의 집중적인 일상 사용을 통해 발전시킨 프로덕션 수준의 에이전트, 스킬, 훅, 커맨드, 규칙, MCP 설정.

---

## 가이드

이 저장소는 원시 코드만 포함되어 있습니다. 가이드에서 모든 것을 설명합니다.

<table>
<tr>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2012378465664745795">
<img src="https://github.com/user-attachments/assets/1a471488-59cc-425b-8345-5245c7efbcef" alt="The Shorthand Guide to Everything Claude Code" />
</a>
</td>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2014040193557471352">
<img src="https://github.com/user-attachments/assets/c9ca43bc-b149-427f-b551-af6840c368f0" alt="The Longform Guide to Everything Claude Code" />
</a>
</td>
</tr>
<tr>
<td align="center"><b>간략 가이드</b><br/>설정, 기초, 철학. <b>이것을 먼저 읽으세요.</b></td>
<td align="center"><b>상세 가이드</b><br/>토큰 최적화, 메모리 영속성, 평가, 병렬화.</td>
</tr>
</table>

| 주제 | 배울 내용 |
|-------|-------------------|
| 토큰 최적화 | 모델 선택, 시스템 프롬프트 슬리밍, 백그라운드 프로세스 |
| 메모리 영속성 | 세션 간에 자동으로 컨텍스트를 저장/로드하는 훅 |
| 지속적 학습 | 세션에서 재사용 가능한 스킬로 패턴을 자동 추출 |
| 검증 루프 | 체크포인트 vs 지속적 평가, 채점 유형, pass@k 지표 |
| 병렬화 | Git worktree, 캐스케이드 방식, 인스턴스 확장 시점 |
| 서브에이전트 오케스트레이션 | 컨텍스트 문제, 반복적 검색 패턴 |

---

## 🚀 빠른 시작

2분 이내에 시작하기:

### 1단계: 플러그인 설치

```bash
# 마켓플레이스 추가
/plugin marketplace add affaan-m/everything-claude-code

# 플러그인 설치
/plugin install everything-claude-code@everything-claude-code
```

### 2단계: 규칙 설치 (필수)

> ⚠️ **중요:** Claude Code 플러그인은 `rules`를 자동으로 배포할 수 없습니다. 수동으로 설치해야 합니다:

```bash
# 먼저 저장소 클론
git clone https://github.com/affaan-m/everything-claude-code.git

# 규칙 복사 (모든 프로젝트에 적용)
cp -r everything-claude-code/rules/* ~/.claude/rules/
```

### 3단계: 사용 시작

```bash
# 커맨드 사용해 보기
/plan "사용자 인증 추가"

# 사용 가능한 커맨드 확인
/plugin list everything-claude-code@everything-claude-code
```

✨ **완료!** 이제 15개 이상의 에이전트, 30개 이상의 스킬, 20개 이상의 커맨드를 사용할 수 있습니다.

---

## 🌐 크로스 플랫폼 지원

이 플러그인은 이제 **Windows, macOS, Linux**를 완전히 지원합니다. 모든 훅과 스크립트가 최대 호환성을 위해 Node.js로 재작성되었습니다.

### 패키지 매니저 감지

플러그인은 선호하는 패키지 매니저(npm, pnpm, yarn 또는 bun)를 다음 우선순위로 자동 감지합니다:

1. **환경 변수**: `CLAUDE_PACKAGE_MANAGER`
2. **프로젝트 설정**: `.claude/package-manager.json`
3. **package.json**: `packageManager` 필드
4. **락 파일**: package-lock.json, yarn.lock, pnpm-lock.yaml 또는 bun.lockb에서 감지
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

## 📦 포함 내용

이 저장소는 **Claude Code 플러그인**입니다 - 직접 설치하거나 컴포넌트를 수동으로 복사하세요.

```
everything-claude-code/
|-- .claude-plugin/   # 플러그인 및 마켓플레이스 매니페스트
|   |-- plugin.json         # 플러그인 메타데이터 및 컴포넌트 경로
|   |-- marketplace.json    # /plugin marketplace add를 위한 마켓플레이스 카탈로그
|
|-- agents/           # 위임을 위한 전문 서브에이전트
|   |-- planner.md           # 기능 구현 계획
|   |-- architect.md         # 시스템 설계 결정
|   |-- tdd-guide.md         # 테스트 주도 개발
|   |-- code-reviewer.md     # 품질 및 보안 리뷰
|   |-- security-reviewer.md # 취약점 분석
|   |-- build-error-resolver.md
|   |-- e2e-runner.md        # Playwright E2E 테스트
|   |-- refactor-cleaner.md  # 데드 코드 정리
|   |-- doc-updater.md       # 문서 동기화
|   |-- go-reviewer.md       # Go 코드 리뷰 (신규)
|   |-- go-build-resolver.md # Go 빌드 오류 해결 (신규)
|
|-- skills/           # 워크플로 정의 및 도메인 지식
|   |-- coding-standards/           # 언어별 모범 사례
|   |-- backend-patterns/           # API, 데이터베이스, 캐싱 패턴
|   |-- frontend-patterns/          # React, Next.js 패턴
|   |-- continuous-learning/        # 세션에서 패턴 자동 추출 (상세 가이드)
|   |-- continuous-learning-v2/     # 신뢰도 점수 기반 직관적 학습
|   |-- iterative-retrieval/        # 서브에이전트를 위한 점진적 컨텍스트 정제
|   |-- strategic-compact/          # 수동 압축 제안 (상세 가이드)
|   |-- tdd-workflow/               # TDD 방법론
|   |-- security-review/            # 보안 체크리스트
|   |-- eval-harness/               # 검증 루프 평가 (상세 가이드)
|   |-- verification-loop/          # 지속적 검증 (상세 가이드)
|   |-- golang-patterns/            # Go 관용구 및 모범 사례 (신규)
|   |-- golang-testing/             # Go 테스트 패턴, TDD, 벤치마크 (신규)
|
|-- commands/         # 빠른 실행을 위한 슬래시 커맨드
|   |-- tdd.md              # /tdd - 테스트 주도 개발
|   |-- plan.md             # /plan - 구현 계획
|   |-- e2e.md              # /e2e - E2E 테스트 생성
|   |-- code-review.md      # /code-review - 품질 리뷰
|   |-- build-fix.md        # /build-fix - 빌드 오류 수정
|   |-- refactor-clean.md   # /refactor-clean - 데드 코드 제거
|   |-- learn.md            # /learn - 세션 중 패턴 추출 (상세 가이드)
|   |-- checkpoint.md       # /checkpoint - 검증 상태 저장 (상세 가이드)
|   |-- verify.md           # /verify - 검증 루프 실행 (상세 가이드)
|   |-- setup-pm.md         # /setup-pm - 패키지 매니저 설정
|   |-- go-review.md        # /go-review - Go 코드 리뷰 (신규)
|   |-- go-test.md          # /go-test - Go TDD 워크플로 (신규)
|   |-- go-build.md         # /go-build - Go 빌드 오류 수정 (신규)
|   |-- skill-create.md     # /skill-create - git 히스토리에서 스킬 생성 (신규)
|   |-- instinct-status.md  # /instinct-status - 학습된 직관 보기 (신규)
|   |-- instinct-import.md  # /instinct-import - 직관 가져오기 (신규)
|   |-- instinct-export.md  # /instinct-export - 직관 내보내기 (신규)
|   |-- evolve.md           # /evolve - 직관을 스킬로 클러스터링 (신규)
|
|-- rules/            # 항상 따라야 하는 가이드라인 (~/.claude/rules/에 복사)
|   |-- security.md         # 필수 보안 검사
|   |-- coding-style.md     # 불변성, 파일 구조
|   |-- testing.md          # TDD, 80% 커버리지 요구사항
|   |-- git-workflow.md     # 커밋 형식, PR 프로세스
|   |-- agents.md           # 서브에이전트에 위임할 시점
|   |-- performance.md      # 모델 선택, 컨텍스트 관리
|
|-- hooks/            # 트리거 기반 자동화
|   |-- hooks.json                # 모든 훅 설정 (PreToolUse, PostToolUse, Stop 등)
|   |-- memory-persistence/       # 세션 라이프사이클 훅 (상세 가이드)
|   |-- strategic-compact/        # 압축 제안 (상세 가이드)
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
|   |-- setup-package-manager.js # 대화형 PM 설정
|
|-- tests/            # 테스트 스위트 (신규)
|   |-- lib/                     # 라이브러리 테스트
|   |-- hooks/                   # 훅 테스트
|   |-- run-all.js               # 모든 테스트 실행
|
|-- contexts/         # 동적 시스템 프롬프트 주입 컨텍스트 (상세 가이드)
|   |-- dev.md              # 개발 모드 컨텍스트
|   |-- review.md           # 코드 리뷰 모드 컨텍스트
|   |-- research.md         # 연구/탐색 모드 컨텍스트
|
|-- examples/         # 예제 설정 및 세션
|   |-- CLAUDE.md           # 프로젝트 레벨 설정 예제
|   |-- user-CLAUDE.md      # 사용자 레벨 설정 예제
|
|-- mcp-configs/      # MCP 서버 설정
|   |-- mcp-servers.json    # GitHub, Supabase, Vercel, Railway 등
|
|-- marketplace.json  # 자체 호스팅 마켓플레이스 설정 (/plugin marketplace add용)
```

---

## 🛠️ 에코시스템 도구

### 스킬 크리에이터

저장소에서 Claude Code 스킬을 생성하는 두 가지 방법:

#### 옵션 A: 로컬 분석 (내장)

외부 서비스 없이 `/skill-create` 커맨드로 로컬 분석:

```bash
/skill-create                    # 현재 저장소 분석
/skill-create --instincts        # continuous-learning용 직관도 생성
```

이것은 로컬에서 git 히스토리를 분석하고 SKILL.md 파일을 생성합니다.

#### 옵션 B: GitHub 앱 (고급)

고급 기능(10k+ 커밋, 자동 PR, 팀 공유):

[GitHub 앱 설치](https://github.com/apps/skill-creator) | [ecc.tools](https://ecc.tools)

```bash
# 이슈에 코멘트:
/skill-creator analyze

# 또는 기본 브랜치에 푸시할 때 자동 트리거
```

두 옵션 모두 생성하는 것:
- **SKILL.md 파일** - Claude Code에서 바로 사용할 수 있는 스킬
- **직관 컬렉션** - continuous-learning-v2용
- **패턴 추출** - 커밋 히스토리에서 학습

### 🧠 지속적 학습 v2

직관 기반 학습 시스템이 자동으로 패턴을 학습합니다:

```bash
/instinct-status        # 신뢰도와 함께 학습된 직관 표시
/instinct-import <file> # 다른 사람의 직관 가져오기
/instinct-export        # 공유를 위해 직관 내보내기
/evolve                 # 관련 직관을 스킬로 클러스터링
```

전체 문서는 `skills/continuous-learning-v2/`를 참조하세요.

---

## 📋 요구사항

### Claude Code CLI 버전

**최소 버전: v2.1.0 이상**

이 플러그인은 훅 시스템 처리 방식 변경으로 인해 Claude Code CLI v2.1.0 이상이 필요합니다.

버전 확인:
```bash
claude --version
```

### 중요: 훅 자동 로딩 동작

> ⚠️ **기여자 참고:** `.claude-plugin/plugin.json`에 `"hooks"` 필드를 추가하지 마세요. 이것은 회귀 테스트로 강제됩니다.

Claude Code v2.1+는 설치된 플러그인에서 `hooks/hooks.json`을 관례에 따라 **자동으로 로드**합니다. `plugin.json`에 명시적으로 선언하면 중복 감지 오류가 발생합니다:

```
Duplicate hooks file detected: ./hooks/hooks.json resolves to already-loaded file
```

**히스토리:** 이것은 이 저장소에서 반복적인 수정/되돌리기 사이클을 일으켰습니다 ([#29](https://github.com/affaan-m/everything-claude-code/issues/29), [#52](https://github.com/affaan-m/everything-claude-code/issues/52), [#103](https://github.com/affaan-m/everything-claude-code/issues/103)). Claude Code 버전 간에 동작이 변경되어 혼란을 초래했습니다. 현재 이것이 다시 도입되는 것을 방지하는 회귀 테스트가 있습니다.

---

## 📥 설치

### 옵션 1: 플러그인으로 설치 (권장)

이 저장소를 사용하는 가장 쉬운 방법 - Claude Code 플러그인으로 설치:

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

이렇게 하면 모든 커맨드, 에이전트, 스킬, 훅에 즉시 접근할 수 있습니다.

> **참고:** Claude Code 플러그인 시스템은 플러그인을 통해 `rules`를 배포하는 것을 지원하지 않습니다 ([업스트림 제한](https://code.claude.com/docs/en/plugins-reference)). 규칙은 수동으로 설치해야 합니다:
>
> ```bash
> # 먼저 저장소 클론
> git clone https://github.com/affaan-m/everything-claude-code.git
>
> # 옵션 A: 사용자 레벨 규칙 (모든 프로젝트에 적용)
> cp -r everything-claude-code/rules/* ~/.claude/rules/
>
> # 옵션 B: 프로젝트 레벨 규칙 (현재 프로젝트에만 적용)
> mkdir -p .claude/rules
> cp -r everything-claude-code/rules/* .claude/rules/
> ```

---

### 🔧 옵션 2: 수동 설치

설치할 내용을 수동으로 제어하려면:

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

`hooks/hooks.json`의 훅을 `~/.claude/settings.json`에 복사하세요.

#### MCP 설정

원하는 MCP 서버를 `mcp-configs/mcp-servers.json`에서 `~/.claude.json`으로 복사하세요.

**중요:** `YOUR_*_HERE` 플레이스홀더를 실제 API 키로 교체하세요.

---

## 🎯 핵심 개념

### 에이전트

서브에이전트는 제한된 범위에서 위임된 작업을 처리합니다. 예시:

```markdown
---
name: code-reviewer
description: 코드의 품질, 보안, 유지보수성을 리뷰합니다
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
---

당신은 시니어 코드 리뷰어입니다...
```

### 스킬

스킬은 커맨드나 에이전트에 의해 호출되는 워크플로 정의입니다:

```markdown
# TDD 워크플로

1. 먼저 인터페이스 정의
2. 실패하는 테스트 작성 (RED)
3. 최소한의 코드 구현 (GREEN)
4. 리팩토링 (IMPROVE)
5. 80%+ 커버리지 확인
```

### 훅

훅은 도구 이벤트에서 발동됩니다. 예시 - console.log 경고:

```json
{
  "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx)$\"",
  "hooks": [{
    "type": "command",
    "command": "#!/bin/bash\ngrep -n 'console\\.log' \"$file_path\" && echo '[Hook] console.log를 제거하세요' >&2"
  }]
}
```

### 규칙

규칙은 항상 따라야 하는 가이드라인입니다. 모듈식으로 유지하세요:

```
~/.claude/rules/
  security.md      # 하드코딩된 시크릿 금지
  coding-style.md  # 불변성, 파일 제한
  testing.md       # TDD, 커버리지 요구사항
```

---

## 🧪 테스트 실행

플러그인에 포괄적인 테스트 스위트가 포함되어 있습니다:

```bash
# 모든 테스트 실행
node tests/run-all.js

# 개별 테스트 파일 실행
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
```

---

## 🤝 기여

**기여를 환영하고 권장합니다.**

이 저장소는 커뮤니티 자원이 되기 위한 것입니다. 다음을 가지고 있다면:
- 유용한 에이전트나 스킬
- 영리한 훅
- 더 나은 MCP 설정
- 개선된 규칙

기여해 주세요! 가이드라인은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

### 기여 아이디어

- 언어별 스킬 (Python, Rust 패턴) - Go는 이미 포함!
- 프레임워크별 설정 (Django, Rails, Laravel)
- DevOps 에이전트 (Kubernetes, Terraform, AWS)
- 테스트 전략 (다양한 프레임워크)
- 도메인별 지식 (ML, 데이터 엔지니어링, 모바일)

---

## 📖 배경

실험적 출시 이후 Claude Code를 사용해 왔습니다. 2025년 9월, [@DRodriguezFX](https://x.com/DRodriguezFX)와 함께 Claude Code만으로 [zenith.chat](https://zenith.chat)을 구축하여 Anthropic x Forum Ventures 해커톤에서 우승했습니다.

이 설정들은 여러 프로덕션 애플리케이션에서 실전 검증되었습니다.

---

## ⚠️ 중요 참고사항

### 컨텍스트 윈도우 관리

**핵심:** 모든 MCP를 한꺼번에 활성화하지 마세요. 너무 많은 도구를 활성화하면 200k 컨텍스트 윈도우가 70k로 줄어들 수 있습니다.

경험 법칙:
- 20-30개의 MCP를 설정
- 프로젝트당 10개 미만 활성화
- 80개 미만의 활성 도구

프로젝트 설정에서 `disabledMcpServers`를 사용하여 미사용 항목을 비활성화하세요.

### 커스터마이징

이 설정은 제 워크플로에 맞춰져 있습니다. 여러분은:
1. 공감가는 것부터 시작
2. 여러분의 기술 스택에 맞게 수정
3. 사용하지 않는 것 제거
4. 자신만의 패턴 추가

---

## 🌟 Star 히스토리

[![Star History Chart](https://api.star-history.com/svg?repos=affaan-m/everything-claude-code&type=Date)](https://star-history.com/#affaan-m/everything-claude-code&Date)

---

## 🔗 링크

- **간략 가이드 (여기서 시작):** [The Shorthand Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **상세 가이드 (고급):** [The Longform Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)
- **팔로우:** [@affaanmustafa](https://x.com/affaanmustafa)
- **zenith.chat:** [zenith.chat](https://zenith.chat)

---

## 📄 라이선스

MIT - 자유롭게 사용하고, 필요에 따라 수정하며, 가능하다면 기여해 주세요.

---

**이 저장소가 도움이 되었다면 Star를 눌러주세요. 두 가이드를 모두 읽으세요. 멋진 것을 만드세요.**
