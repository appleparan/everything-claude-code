# 보안 가이드라인

## 필수 보안 점검

커밋 전 반드시 확인:
- [ ] 하드코딩된 시크릿 없음 (API 키, 비밀번호, 토큰)
- [ ] 모든 사용자 입력 검증 완료
- [ ] SQL 인젝션 방지 (매개변수화된 쿼리)
- [ ] XSS 방지 (새니타이징된 HTML)
- [ ] CSRF 보호 활성화
- [ ] 인증/인가 검증 완료
- [ ] 모든 엔드포인트에 속도 제한 적용
- [ ] 오류 메시지에 민감한 정보가 노출되지 않음

## 시크릿 관리

```typescript
// 절대 금지: 하드코딩된 시크릿
const apiKey = "sk-proj-xxxxx"

// 항상: 환경 변수 사용
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

## 보안 대응 프로토콜

보안 이슈 발견 시:
1. 즉시 중단
2. **security-reviewer** Agent 사용
3. 계속 진행하기 전에 치명적 이슈 수정
4. 노출된 시크릿 로테이션
5. 전체 코드베이스에서 유사한 이슈 점검
