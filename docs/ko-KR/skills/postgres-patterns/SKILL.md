---
name: postgres-patterns
description: PostgreSQL database patterns for query optimization, schema design, indexing, and security. Based on Supabase best practices.
---

# PostgreSQL 패턴

PostgreSQL 모범 사례 빠른 참조. 자세한 가이드는 `database-reviewer` agent를 사용하세요.

## 활성화 시점

- SQL 쿼리 또는 migrations 작성 시
- 데이터베이스 schema 설계 시
- 느린 쿼리 트러블슈팅 시
- Row Level Security 구현 시
- 연결 풀링 설정 시

## 빠른 참조

### 인덱스 치트시트

| 쿼리 패턴 | 인덱스 유형 | 예시 |
|---------|---------|------|
| `WHERE col = value` | B-tree (기본값) | `CREATE INDEX idx ON t (col)` |
| `WHERE col > value` | B-tree | `CREATE INDEX idx ON t (col)` |
| `WHERE a = x AND b > y` | 복합 | `CREATE INDEX idx ON t (a, b)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| `WHERE tsv @@ query` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| 시계열 범위 | BRIN | `CREATE INDEX idx ON t USING brin (col)` |

### 데이터 타입 빠른 참조

| 용도 | 올바른 타입 | 피하기 |
|---------|---------|------|
| IDs | `bigint` | `int`, 랜덤 UUID |
| 문자열 | `text` | `varchar(255)` |
| 타임스탬프 | `timestamptz` | `timestamp` |
| 금액 | `numeric(10,2)` | `float` |
| 플래그 | `boolean` | `varchar`, `int` |

### 일반 패턴

**복합 인덱스 순서:**
```sql
-- 등호 컬럼 먼저, 그 다음 범위 컬럼
CREATE INDEX idx ON orders (status, created_at);
-- 적합 대상: WHERE status = 'pending' AND created_at > '2024-01-01'
```

**커버링 인덱스:**
```sql
CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
-- SELECT email, name, created_at 시 테이블 조회 회피
```

**부분 인덱스:**
```sql
CREATE INDEX idx ON users (email) WHERE deleted_at IS NULL;
-- 더 작은 인덱스, 활성 사용자만 포함
```

**RLS 정책 (최적화):**
```sql
CREATE POLICY policy ON orders
  USING ((SELECT auth.uid()) = user_id);  -- SELECT로 감싸기!
```

**UPSERT:**
```sql
INSERT INTO settings (user_id, key, value)
VALUES (123, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET value = EXCLUDED.value;
```

**커서 페이지네이션:**
```sql
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;
-- O(1) vs OFFSET은 O(n)
```

**큐 처리:**
```sql
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

### 안티패턴 감지

```sql
-- 인덱스가 없는 외래 키 찾기
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- 느린 쿼리 찾기
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- 테이블 블로트 확인
SELECT relname, n_dead_tup, last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### 설정 템플릿

```sql
-- 연결 제한 (RAM에 따라 조정)
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET work_mem = '8MB';

-- 타임아웃
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
ALTER SYSTEM SET statement_timeout = '30s';

-- 모니터링
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 보안 기본값
REVOKE ALL ON SCHEMA public FROM public;

SELECT pg_reload_conf();
```

## 관련 자료

- Agent: `database-reviewer` - 전체 데이터베이스 리뷰 워크플로우
- Skill: `clickhouse-io` - ClickHouse 분석 패턴
- Skill: `backend-patterns` - API 및 백엔드 패턴

---

*[Supabase Agent Skills](https://github.com/supabase/agent-skills) (MIT 라이선스) 기반*
