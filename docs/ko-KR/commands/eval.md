# Eval 명령어

평가 주도 개발 워크플로를 관리합니다.

## 사용 방법

`/eval [define|check|report|list] [feature-name]`

## Eval 정의

`/eval define feature-name`

새로운 eval 정의를 생성합니다:

1. 템플릿을 사용하여 `.claude/evals/feature-name.md`를 생성합니다:

```markdown
## EVAL: feature-name
생성일: $(date)

### 기능 Eval
- [ ] [기능 1에 대한 설명]
- [ ] [기능 2에 대한 설명]

### 회귀 Eval
- [ ] [기존 동작 1이 여전히 작동함]
- [ ] [기존 동작 2가 여전히 작동함]

### 성공 기준
- 기능 eval의 pass@3 > 90%
- 회귀 eval의 pass^3 = 100%
```

2. 사용자에게 구체적인 기준을 채워달라고 안내

## Eval 확인

`/eval check feature-name`

기능의 eval을 실행합니다:

1. `.claude/evals/feature-name.md`에서 eval 정의를 읽기
2. 각 기능 eval에 대해:
   - 기준 검증 시도
   - 통과/실패 기록
   - `.claude/evals/feature-name.log`에 시도 기록
3. 각 회귀 eval에 대해:
   - 관련 테스트 실행
   - 기준선과 비교
   - 통과/실패 기록
4. 현재 상태 보고:

```
EVAL 확인: feature-name
========================
기능: X/Y 통과
회귀: X/Y 통과
상태: 진행 중 / 준비 완료
```

## Eval 보고

`/eval report feature-name`

종합적인 eval 보고서를 생성합니다:

```
EVAL 보고서: feature-name
=========================
생성일: $(date)

기능 EVAL
----------------
[eval-1]: 통과 (pass@1)
[eval-2]: 통과 (pass@2) - 재시도 필요
[eval-3]: 실패 - 비고 참조

회귀 EVAL
----------------
[test-1]: 통과
[test-2]: 통과
[test-3]: 통과

지표
-------
기능 pass@1: 67%
기능 pass@3: 100%
회귀 pass^3: 100%

비고
-----
[문제, 경계 케이스 또는 관찰 사항]

권장 사항
--------------
[릴리스 / 개선 필요 / 차단]
```

## Eval 목록

`/eval list`

모든 eval 정의를 표시합니다:

```
EVAL 정의
================
feature-auth      [3/5 통과] 진행 중
feature-search    [5/5 통과] 준비 완료
feature-export    [0/4 통과] 미시작
```

## 매개변수

$ARGUMENTS:
- `define <name>` - 새 eval 정의 생성
- `check <name>` - eval 실행 및 확인
- `report <name>` - 전체 보고서 생성
- `list` - 모든 eval 표시
- `clean` - 오래된 eval 로그 제거 (최근 10회 실행 유지)
