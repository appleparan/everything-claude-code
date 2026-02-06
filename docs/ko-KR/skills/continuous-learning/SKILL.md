---
name: continuous-learning
description: Automatically extract reusable patterns from Claude Code sessions and save them as learned skills for future use.
---

# 지속적 학습 스킬

Claude Code 세션 종료 시 내용을 자동으로 평가하여 재사용 가능한 패턴을 추출하고 학습된 스킬로 저장합니다.

## 작동 방식

이 스킬은 **Stop hook**으로 매 세션 종료 시 실행됩니다:

1. **세션 평가**: 세션에 충분한 메시지가 있는지 확인 (기본값: 10개 이상)
2. **패턴 감지**: 세션에서 추출 가능한 패턴 식별
3. **스킬 추출**: 유용한 패턴을 `~/.claude/skills/learned/`에 저장

## 설정

`config.json`을 편집하여 커스터마이징:

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "~/.claude/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

## 패턴 유형

| 패턴 | 설명 |
|------|------|
| `error_resolution` | 특정 오류가 어떻게 해결되었는지 |
| `user_corrections` | 사용자 수정에서 나온 패턴 |
| `workarounds` | 프레임워크/라이브러리 이상 동작의 우회 방법 |
| `debugging_techniques` | 효과적인 디버깅 방법 |
| `project_specific` | 프로젝트 고유 관례 |

## Hook 설정

`~/.claude/settings.json`에 추가:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning/evaluate-session.sh"
      }]
    }]
  }
}
```

## 왜 Stop Hook인가?

- **경량**: 세션 종료 시 한 번만 실행
- **비차단**: 매 메시지마다 지연을 추가하지 않음
- **완전한 컨텍스트**: 전체 세션 기록에 접근 가능

## 관련 자료

- [Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - 지속적 학습 섹션
- `/learn` 명령 - 세션 중 수동 패턴 추출

---

## 비교 노트 (조사: 2025년 1월)

### vs Homunculus (github.com/humanplane/homunculus)

Homunculus v2는 더 복잡한 접근 방식을 채택합니다:

| 기능 | 우리의 접근 | Homunculus v2 |
|------|----------|---------------|
| 관찰 | Stop hook (세션 종료) | PreToolUse/PostToolUse hooks (100% 신뢰) |
| 분석 | 메인 컨텍스트 | 백그라운드 agent (Haiku) |
| 세밀도 | 전체 스킬 | 원자적 "본능" |
| 신뢰도 | 없음 | 0.3-0.9 가중치 |
| 진화 | 바로 스킬 | 본능 → 클러스터링 → 스킬/명령/agent |
| 공유 | 없음 | 본능 내보내기/가져오기 |

**homunculus의 핵심 통찰:**
> "v1은 관찰에 스킬을 사용했습니다. 스킬은 확률적입니다 -- 약 50-80%의 확률로 트리거됩니다. v2는 관찰에 hooks를 사용하고(100% 신뢰), 본능을 학습된 행동의 원자 단위로 사용합니다."

### 잠재적 v2 개선 사항

1. **본능 기반 학습** - 신뢰도 점수가 있는 더 작은 원자적 행동
2. **백그라운드 관찰자** - Haiku agent가 병렬로 분석
3. **신뢰도 감쇠** - 모순되면 본능의 신뢰도 하락
4. **도메인 태깅** - code-style, testing, git, debugging 등
5. **진화 경로** - 관련 본능을 스킬/명령으로 클러스터링

참조: `/Users/affoon/Documents/tasks/12-continuous-learning-v2.md` 전체 사양.
