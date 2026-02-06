---
name: continuous-learning-v2
description: Instinct-based learning system that observes sessions via hooks, creates atomic instincts with confidence scoring, and evolves them into skills/commands/agents.
version: 2.0.0
---

# 지속적 학습 v2 - 본능 기반 아키텍처

원자적 "본능" (신뢰도 점수가 있는 작은 학습된 행동)을 통해 Claude Code 세션을 재사용 가능한 지식으로 전환하는 고급 학습 시스템.

## v2의 새로운 기능

| 기능 | v1 | v2 |
|------|----|----|
| 관찰 | Stop hook (세션 종료) | PreToolUse/PostToolUse (100% 신뢰) |
| 분석 | 메인 컨텍스트 | 백그라운드 agent (Haiku) |
| 세밀도 | 전체 스킬 | 원자적 "본능" |
| 신뢰도 | 없음 | 0.3-0.9 가중치 |
| 진화 | 바로 스킬 | 본능 → 클러스터링 → 스킬/명령/agent |
| 공유 | 없음 | 본능 내보내기/가져오기 |

## 본능 모델

본능은 작은 학습된 행동입니다:

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
source: "session-observation"
---

# 함수형 스타일 선호

## 동작
적절한 경우 클래스 대신 함수 패턴을 사용합니다.

## 근거
- 함수 패턴 선호가 5회 관찰됨
- 사용자가 2025-01-15에 클래스 기반 접근을 함수형으로 수정
```

**속성:**
- **원자적** -- 하나의 트리거, 하나의 동작
- **신뢰도 가중치** -- 0.3 = 잠정적, 0.9 = 거의 확실
- **도메인 태그** -- code-style, testing, git, debugging, workflow 등
- **증거 기반** -- 생성한 관찰을 추적

## 작동 방식

```
세션 활동
      │
      │ Hooks가 프롬프트 + 도구 사용을 캡처 (100% 신뢰)
      ▼
┌─────────────────────────────────────────┐
│         observations.jsonl              │
│   (프롬프트, 도구 호출, 결과)            │
└─────────────────────────────────────────┘
      │
      │ Observer agent가 읽음 (백그라운드, Haiku)
      ▼
┌─────────────────────────────────────────┐
│          패턴 감지                       │
│   • 사용자 수정 → 본능                  │
│   • 오류 해결 → 본능                    │
│   • 반복 워크플로 → 본능                │
└─────────────────────────────────────────┘
      │
      │ 생성/업데이트
      ▼
┌─────────────────────────────────────────┐
│         instincts/personal/             │
│   • prefer-functional.md (0.7)          │
│   • always-test-first.md (0.9)          │
│   • use-zod-validation.md (0.6)         │
└─────────────────────────────────────────┘
      │
      │ /evolve 클러스터링
      ▼
┌─────────────────────────────────────────┐
│              evolved/                   │
│   • commands/new-feature.md             │
│   • skills/testing-workflow.md          │
│   • agents/refactor-specialist.md       │
└─────────────────────────────────────────┘
```

## 빠른 시작

### 1. 관찰 Hooks 활성화

`~/.claude/settings.json`에 추가:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh post"
      }]
    }]
  }
}
```

### 2. 디렉토리 구조 초기화

```bash
mkdir -p ~/.claude/homunculus/{instincts/{personal,inherited},evolved/{agents,skills,commands}}
touch ~/.claude/homunculus/observations.jsonl
```

### 3. Observer Agent 실행 (선택)

관찰자는 백그라운드에서 실행되어 관찰을 분석할 수 있습니다:

```bash
# 백그라운드 관찰자 시작
~/.claude/skills/continuous-learning-v2/agents/start-observer.sh
```

## 명령어

| 명령어 | 설명 |
|------|------|
| `/instinct-status` | 모든 학습된 본능과 신뢰도 표시 |
| `/evolve` | 관련 본능을 스킬/명령으로 클러스터링 |
| `/instinct-export` | 공유를 위해 본능 내보내기 |
| `/instinct-import <file>` | 다른 사람의 본능 가져오기 |

## 설정

`config.json` 편집:

```json
{
  "version": "2.0",
  "observation": {
    "enabled": true,
    "store_path": "~/.claude/homunculus/observations.jsonl",
    "max_file_size_mb": 10,
    "archive_after_days": 7
  },
  "instincts": {
    "personal_path": "~/.claude/homunculus/instincts/personal/",
    "inherited_path": "~/.claude/homunculus/instincts/inherited/",
    "min_confidence": 0.3,
    "auto_approve_threshold": 0.7,
    "confidence_decay_rate": 0.05
  },
  "observer": {
    "enabled": true,
    "model": "haiku",
    "run_interval_minutes": 5,
    "patterns_to_detect": [
      "user_corrections",
      "error_resolutions",
      "repeated_workflows",
      "tool_preferences"
    ]
  },
  "evolution": {
    "cluster_threshold": 3,
    "evolved_path": "~/.claude/homunculus/evolved/"
  }
}
```

## 파일 구조

```
~/.claude/homunculus/
├── identity.json           # 개인 프로필, 기술 수준
├── observations.jsonl      # 현재 세션 관찰
├── observations.archive/   # 처리된 관찰
├── instincts/
│   ├── personal/           # 자동 학습된 본능
│   └── inherited/          # 다른 사람에게서 가져온 것
└── evolved/
    ├── agents/             # 생성된 전문 agents
    ├── skills/             # 생성된 스킬
    └── commands/           # 생성된 명령어
```

## Skill Creator와 통합

[Skill Creator GitHub App](https://skill-creator.app)을 사용할 때, 이제 **두 가지 모두** 생성합니다:
- 기존 SKILL.md 파일 (하위 호환성)
- 본능 컬렉션 (v2 학습 시스템용)

저장소 분석에서 나온 본능은 `source: "repo-analysis"`를 가지며 소스 저장소 URL을 포함합니다.

## 신뢰도 점수

신뢰도는 시간에 따라 진화합니다:

| 점수 | 의미 | 동작 |
|------|------|------|
| 0.3 | 잠정적 | 제안하되 강제하지 않음 |
| 0.5 | 중간 | 관련 시 적용 |
| 0.7 | 강력 | 자동 승인 적용 |
| 0.9 | 거의 확실 | 핵심 동작 |

**신뢰도가 증가하는 경우:**
- 패턴이 반복적으로 관찰됨
- 사용자가 제안된 동작을 수정하지 않음
- 다른 소스의 유사한 본능이 동의

**신뢰도가 감소하는 경우:**
- 사용자가 명시적으로 동작을 수정
- 오랫동안 패턴이 관찰되지 않음
- 모순되는 증거 발생

## 왜 관찰에 Hooks vs Skills인가?

> "v1은 관찰에 스킬을 사용했습니다. 스킬은 확률적입니다 -- Claude의 판단에 따라 약 50-80%의 확률로 트리거됩니다."

Hooks는 **100% 확률로** 결정론적으로 트리거됩니다. 이는 다음을 의미합니다:
- 모든 도구 호출이 관찰됨
- 놓치는 패턴 없음
- 학습이 포괄적

## 하위 호환성

v2는 v1과 완전히 호환됩니다:
- 기존 `~/.claude/skills/learned/` 스킬은 여전히 동작
- Stop hook도 여전히 실행 (이제 v2에도 피드)
- 점진적 마이그레이션 경로: 두 시스템 병렬 실행

## 프라이버시

- 관찰은 사용자의 머신 **로컬**에 유지
- **본능** (패턴)만 내보내기 가능
- 실제 코드나 대화 내용은 공유되지 않음
- 내보내는 내용을 사용자가 제어

## 관련 자료

- [Skill Creator](https://skill-creator.app) - 저장소 이력에서 본능 생성
- [Homunculus](https://github.com/humanplane/homunculus) - v2 아키텍처 영감
- [Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - 지속적 학습 섹션

---

*본능 기반 학습: 한 번에 하나의 관찰로 Claude에게 당신의 패턴을 가르칩니다.*
