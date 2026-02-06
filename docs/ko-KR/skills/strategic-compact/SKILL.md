---
name: strategic-compact
description: Suggests manual context compaction at logical intervals to preserve context through task phases rather than arbitrary auto-compaction.
---

# 전략적 압축 스킬

임의의 자동 압축에 의존하지 않고, 워크플로우의 전략적 지점에서 수동 `/compact`를 제안합니다.

## 왜 전략적 압축이 필요한가?

자동 압축은 임의의 시점에 트리거됩니다:
- 종종 작업 도중에 발생하여 중요한 컨텍스트를 잃게 됨
- 논리적 작업 경계를 인식하지 못함
- 복잡한 다단계 작업을 중단시킬 수 있음

논리적 경계에서의 전략적 압축:
- **탐색 후, 실행 전** - 조사 컨텍스트를 압축하고 구현 계획을 보존
- **마일스톤 완료 후** - 다음 단계를 위해 새로 시작
- **주요 컨텍스트 전환 전** - 다른 작업 전에 탐색 컨텍스트를 정리

## 작동 방식

`suggest-compact.sh` 스크립트는 PreToolUse(Edit/Write)에서 실행되며:

1. **도구 호출 추적** - 작업 세션에서 도구 호출 횟수를 카운트
2. **임계값 감지** - 설정 가능한 임계값에서 제안 (기본값: 50회 호출)
3. **정기 알림** - 임계값 이후 25회 호출마다 알림

## Hook 설정

`~/.claude/settings.json`에 추가:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "tool == \"Edit\" || tool == \"Write\"",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/strategic-compact/suggest-compact.sh"
      }]
    }]
  }
}
```

## 설정

환경 변수:
- `COMPACT_THRESHOLD` - 첫 번째 제안 전 도구 호출 횟수 (기본값: 50)

## 모범 사례

1. **계획 수립 후 압축** - 계획이 확정되면 압축하여 새로 시작
2. **디버깅 후 압축** - 계속하기 전에 오류 해결 컨텍스트를 정리
3. **구현 도중에는 압축하지 않기** - 관련 변경 사항에 대한 컨텍스트를 유지
4. **제안 내용 읽기** - Hook이 *언제*를 알려주고, *할지 여부*는 본인이 결정

## 관련 자료

- [Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - Token 최적화 섹션
- 메모리 지속성 hooks - 압축 후에도 유지되는 상태용
