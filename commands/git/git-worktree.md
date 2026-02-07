# Git Worktree 구조 변환

기존 Git 프로젝트를 bare repository + worktree 기반 구조로 변환한다.

## Usage

`/git-worktree <프로젝트 경로> [추가 브랜치...]`

## 입력

- **프로젝트 경로**: 변환할 기존 Git 프로젝트의 절대 경로
- **추가 브랜치 목록** (선택): worktree로 함께 생성할 브랜치 이름들

## 변환 규칙

1. 기존 프로젝트 경로를 `{프로젝트경로}.tmp`로 임시 bare clone한다.
2. 최종 디렉토리 구조:
   ```
   {프로젝트명}/
   ├── {프로젝트명}.git/    ← bare repository
   └── worktree/
       ├── {기본브랜치}/    ← 기본 브랜치 worktree
       ├── {브랜치1}/       ← 추가 브랜치 worktree
       └── {브랜치2}/
   ```
3. 기본 브랜치는 기존 프로젝트의 HEAD 브랜치(main 또는 master 등)를 따른다.
4. 추가 브랜치가 기존 저장소에 이미 존재하면 그대로 체크아웃하고, 없으면 `-b` 옵션으로 새로 생성한다.
5. 기존 원격 저장소(origin) URL이 있으면 bare repository에 다시 설정한다.
6. 변환 완료 후 기존 프로젝트를 삭제하고 임시 디렉토리를 원래 경로로 이동한다.

## 변환 절차

사용자에게 아래 단계를 순서대로 실행할 수 있는 쉘 명령어를 생성하여 제시한다.

### 1. 사전 정보 수집

```bash
# 프로젝트 디렉토리로 이동
cd <프로젝트 경로>

# 기본 브랜치 확인
DEFAULT_BRANCH=$(git symbolic-ref --short HEAD)

# 원격 저장소 URL 확인
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")

# 프로젝트명 추출
PROJECT_NAME=$(basename <프로젝트 경로>)
PROJECT_PATH=$(cd <프로젝트 경로> && pwd)
```

### 2. 임시 bare clone 생성

```bash
# 임시 구조 생성
mkdir -p "${PROJECT_PATH}.tmp/worktree"

# bare clone
git clone --bare "$PROJECT_PATH" "${PROJECT_PATH}.tmp/${PROJECT_NAME}.git"
```

### 3. 기본 브랜치 worktree 추가

```bash
cd "${PROJECT_PATH}.tmp/${PROJECT_NAME}.git"
git worktree add "../worktree/${DEFAULT_BRANCH}" "$DEFAULT_BRANCH"
```

### 4. 추가 브랜치 worktree 추가

각 추가 브랜치에 대해:

```bash
# 브랜치가 이미 존재하는지 확인
if git show-ref --verify --quiet "refs/heads/<브랜치명>"; then
    # 기존 브랜치 체크아웃
    git worktree add "../worktree/<브랜치명>" "<브랜치명>"
else
    # 새 브랜치 생성
    git worktree add "../worktree/<브랜치명>" -b "<브랜치명>"
fi
```

### 5. 원격 저장소 재설정

```bash
# origin이 있으면 재설정 (bare clone은 로컬 경로를 origin으로 가지므로)
if [ -n "$ORIGIN_URL" ]; then
    git remote remove origin
    git remote add origin "$ORIGIN_URL"
    git fetch origin
fi
```

### 6. 기존 프로젝트 교체

```bash
# 기존 프로젝트 삭제 후 임시 디렉토리를 원래 경로로 이동
rm -rf "$PROJECT_PATH"
mv "${PROJECT_PATH}.tmp" "$PROJECT_PATH"
```

### 7. 완료 안내

변환 후 사용법을 안내한다:

```bash
# 작업 시작
cd <프로젝트 경로>/worktree/<기본브랜치>

# worktree 목록 확인
git worktree list

# 새 worktree 추가
cd <프로젝트 경로>/<프로젝트명>.git
git worktree add ../worktree/<새브랜치> -b <새브랜치>

# worktree 제거
git worktree remove ../worktree/<브랜치명>
```

## 출력 형식

1. **실행 명령어 블록**: 사용자의 입력값이 치환된, 복사-붙여넣기 가능한 쉘 스크립트
2. **각 단계 주석**: 무엇을 하는지 간단한 설명
3. **최종 구조 트리**: 변환 후 디렉토리 구조
4. **사용법 안내**: 일상 워크플로우 (cd, worktree add/remove/list)

## 예시

### 입력

> 프로젝트 경로: ~/my-app
> 추가 브랜치: feature, develop

### 출력

```bash
# 1. 사전 정보 수집
cd ~/my-app
DEFAULT_BRANCH=$(git symbolic-ref --short HEAD)
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")

# 2. 임시 bare clone
mkdir -p ~/my-app.tmp/worktree
git clone --bare ~/my-app ~/my-app.tmp/my-app.git

# 3. 기본 브랜치 worktree
cd ~/my-app.tmp/my-app.git
git worktree add ../worktree/$DEFAULT_BRANCH $DEFAULT_BRANCH

# 4. 추가 브랜치 worktree
git worktree add ../worktree/feature feature 2>/dev/null \
    || git worktree add ../worktree/feature -b feature
git worktree add ../worktree/develop develop 2>/dev/null \
    || git worktree add ../worktree/develop -b develop

# 5. 원격 저장소 재설정
if [ -n "$ORIGIN_URL" ]; then
    git remote remove origin
    git remote add origin "$ORIGIN_URL"
    git fetch origin
fi

# 6. 기존 프로젝트 교체
rm -rf ~/my-app
mv ~/my-app.tmp ~/my-app

# 완료! 작업 시작:
cd ~/my-app/worktree/$DEFAULT_BRANCH
git worktree list
```

### 최종 구조

```
~/my-app/
├── my-app.git/          ← bare repository
└── worktree/
    ├── main/            ← 기본 브랜치 (HEAD)
    ├── feature/         ← 추가 브랜치
    └── develop/         ← 추가 브랜치
```

## 주의사항

- 변환 전 커밋되지 않은 변경사항이 있으면 **경고**하고 중단한다.
- `rm -rf` 실행 전 사용자에게 **확인을 요청**한다.
- bare clone은 로컬 경로를 origin으로 설정하므로 반드시 원격 URL을 재설정해야 한다.
- worktree 내에서 `git worktree list`로 전체 현황을 확인할 수 있다.

## Arguments

$ARGUMENTS:
- `<프로젝트 경로>` - 변환할 Git 프로젝트의 절대 경로 (필수)
- `[브랜치...]` - worktree로 추가할 브랜치 이름들 (선택)
