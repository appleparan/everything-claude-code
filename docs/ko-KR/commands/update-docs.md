# 문서 업데이트

단일 진실 공급원(Single Source of Truth)에서 문서를 동기화합니다:

1. package.json의 scripts 섹션 읽기
   - scripts 참조 테이블 생성
   - 주석의 설명 포함

2. .env.example 읽기
   - 모든 환경 변수 추출
   - 용도 및 형식 문서화

3. docs/CONTRIB.md 생성, 포함 내용:
   - 개발 워크플로
   - 사용 가능한 scripts
   - 환경 설정
   - 테스트 절차

4. docs/RUNBOOK.md 생성, 포함 내용:
   - 배포 절차
   - 모니터링 및 알림
   - 일반적인 문제 및 수정
   - 롤백 절차

5. 오래된 문서 식별:
   - 90일 이상 수정되지 않은 문서 찾기
   - 수동 검토를 위해 목록 작성

6. 변경 요약 표시

단일 진실 공급원: package.json 및 .env.example
