| name | description |
|------|-------------|
| cloud-infrastructure-security | Use this skill when deploying to cloud platforms, configuring infrastructure, managing IAM policies, setting up logging/monitoring, or implementing CI/CD pipelines. Provides cloud security checklist aligned with best practices. |

# 클라우드 및 인프라 보안 스킬

이 스킬은 클라우드 인프라, CI/CD 파이프라인 및 배포 설정이 보안 모범 사례를 따르고 업계 표준을 준수하도록 보장합니다.

## 활성화 시점

- 클라우드 플랫폼(AWS, Vercel, Railway, Cloudflare)에 애플리케이션 배포 시
- IAM 역할 및 권한 설정 시
- CI/CD 파이프라인 구성 시
- Infrastructure as Code(Terraform, CloudFormation) 구현 시
- 로깅 및 모니터링 설정 시
- 클라우드 환경에서 시크릿 관리 시
- CDN 및 엣지 보안 설정 시
- 재해 복구 및 백업 전략 구현 시

## 클라우드 보안 체크리스트

### 1. IAM 및 접근 제어

#### 최소 권한 원칙

```yaml
# 올바른 방법: 최소 권한
iam_role:
  permissions:
    - s3:GetObject  # 읽기 접근만
    - s3:ListBucket
  resources:
    - arn:aws:s3:::my-bucket/*  # 특정 bucket만

# 잘못된 방법: 과도하게 넓은 권한
iam_role:
  permissions:
    - s3:*  # 모든 S3 액션
  resources:
    - "*"  # 모든 리소스
```

#### 다중 인증(MFA)

```bash
# root/admin 계정에는 항상 MFA 활성화
aws iam enable-mfa-device \
  --user-name admin \
  --serial-number arn:aws:iam::123456789:mfa/admin \
  --authentication-code1 123456 \
  --authentication-code2 789012
```

#### 검증 단계

- [ ] 프로덕션 환경에서 root 계정 사용하지 않음
- [ ] 모든 권한 있는 계정에 MFA 활성화
- [ ] 서비스 계정은 장기 자격 증명이 아닌 역할 사용
- [ ] IAM 정책이 최소 권한 준수
- [ ] 정기적인 접근 권한 검토 수행
- [ ] 사용하지 않는 자격 증명 교체 또는 제거됨

### 2. 시크릿 관리

#### 클라우드 시크릿 매니저

```typescript
// 올바른 방법: 클라우드 시크릿 매니저 사용
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({ SecretId: 'prod/api-key' });
const apiKey = JSON.parse(secret.SecretString).key;

// 잘못된 방법: 하드코딩 또는 환경 변수만 사용
const apiKey = process.env.API_KEY; // 교체 안 됨, 감사 안 됨
```

#### 시크릿 교체

```bash
# 데이터베이스 자격 증명 자동 교체 설정
aws secretsmanager rotate-secret \
  --secret-id prod/db-password \
  --rotation-lambda-arn arn:aws:lambda:region:account:function:rotate \
  --rotation-rules AutomaticallyAfterDays=30
```

#### 검증 단계

- [ ] 모든 시크릿이 클라우드 시크릿 매니저(AWS Secrets Manager, Vercel Secrets)에 저장됨
- [ ] 데이터베이스 자격 증명에 자동 교체 활성화
- [ ] API 키는 최소 분기별로 교체
- [ ] 코드, 로그, 에러 메시지에 시크릿 없음
- [ ] 시크릿 접근에 감사 로그 활성화

### 3. 네트워크 보안

#### VPC 및 방화벽 설정

```terraform
# 올바른 방법: 제한된 보안 그룹
resource "aws_security_group" "app" {
  name = "app-sg"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # 내부 VPC만
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # HTTPS 아웃바운드만
  }
}

# 잘못된 방법: 인터넷에 개방
resource "aws_security_group" "bad" {
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # 모든 포트, 모든 IP!
  }
}
```

#### 검증 단계

- [ ] 데이터베이스가 공개 접근 불가
- [ ] SSH/RDP 포트가 VPN/배스천 호스트로 제한됨
- [ ] 보안 그룹이 최소 권한 준수
- [ ] 네트워크 ACL 설정됨
- [ ] VPC 흐름 로그 활성화됨

### 4. 로깅 및 모니터링

#### CloudWatch/로그 설정

```typescript
// 올바른 방법: 포괄적인 로깅
import { CloudWatchLogsClient, CreateLogStreamCommand } from '@aws-sdk/client-cloudwatch-logs';

const logSecurityEvent = async (event: SecurityEvent) => {
  await cloudwatch.putLogEvents({
    logGroupName: '/aws/security/events',
    logStreamName: 'authentication',
    logEvents: [{
      timestamp: Date.now(),
      message: JSON.stringify({
        type: event.type,
        userId: event.userId,
        ip: event.ip,
        result: event.result,
        // 민감한 데이터는 절대 로깅하지 않음
      })
    }]
  });
};
```

#### 검증 단계

- [ ] 모든 서비스에 CloudWatch/로깅 활성화
- [ ] 실패한 인증 시도가 기록됨
- [ ] 관리자 작업이 감사됨
- [ ] 로그 보존 기간 설정됨 (컴플라이언스 시 90일 이상)
- [ ] 의심스러운 활동에 대한 알림 설정
- [ ] 로그가 중앙화되어 있고 변조 방지됨

### 5. CI/CD 파이프라인 보안

#### 안전한 파이프라인 설정

```yaml
# 올바른 방법: 안전한 GitHub Actions 워크플로우
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # 최소 권한

    steps:
      - uses: actions/checkout@v4

      # 시크릿 스캔
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main

      # 의존성 감사
      - name: Audit dependencies
        run: npm audit --audit-level=high

      # 장기 tokens 대신 OIDC 사용
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
          aws-region: us-east-1
```

#### 공급망 보안

```json
// package.json - lock 파일과 무결성 검사 사용
{
  "scripts": {
    "install": "npm ci",  // 재현 가능한 빌드를 위해 ci 사용
    "audit": "npm audit --audit-level=moderate",
    "check": "npm outdated"
  }
}
```

#### 검증 단계

- [ ] 장기 자격 증명 대신 OIDC 사용
- [ ] 파이프라인에서 시크릿 스캔
- [ ] 의존성 취약점 스캔
- [ ] 컨테이너 이미지 스캔 (해당 시)
- [ ] 브랜치 보호 규칙 적용
- [ ] 병합 전 코드 리뷰 필수
- [ ] 서명된 commits 강제 적용

### 6. Cloudflare 및 CDN 보안

#### Cloudflare 보안 설정

```typescript
// 올바른 방법: 보안 헤더가 있는 Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    const response = await fetch(request);

    // 보안 헤더 추가
    const headers = new Headers(response.headers);
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'geolocation=(), microphone=()');

    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};
```

#### WAF 규칙

```bash
# Cloudflare WAF 관리형 규칙 활성화
# - OWASP 핵심 규칙 세트
# - Cloudflare 관리형 규칙 세트
# - 속도 제한 규칙
# - Bot 보호
```

#### 검증 단계

- [ ] OWASP 규칙으로 WAF 활성화됨
- [ ] 속도 제한 설정됨
- [ ] Bot 보호 활성화됨
- [ ] DDoS 보호 활성화됨
- [ ] 보안 헤더 설정됨
- [ ] SSL/TLS 엄격 모드 활성화됨

### 7. 백업 및 재해 복구

#### 자동 백업

```terraform
# 올바른 방법: 자동 RDS 백업
resource "aws_db_instance" "main" {
  allocated_storage     = 20
  engine               = "postgres"

  backup_retention_period = 30  # 30일 보존
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  deletion_protection = true  # 실수로 삭제 방지
}
```

#### 검증 단계

- [ ] 자동 일일 백업 설정됨
- [ ] 백업 보존이 컴플라이언스 요구 사항 충족
- [ ] 특정 시점 복구 활성화됨
- [ ] 분기별 백업 테스트 수행
- [ ] 재해 복구 계획 문서화됨
- [ ] RPO 및 RTO 정의 및 테스트됨

## 배포 전 클라우드 보안 체크리스트

모든 프로덕션 클라우드 배포 전:

- [ ] **IAM**: root 계정 미사용, MFA 활성화, 최소 권한 정책
- [ ] **시크릿**: 모든 시크릿이 클라우드 시크릿 매니저에 있고 교체됨
- [ ] **네트워크**: 보안 그룹 제한됨, 공개 데이터베이스 없음
- [ ] **로깅**: CloudWatch/로깅 활성화 및 보존 설정
- [ ] **모니터링**: 이상에 대한 알림 설정
- [ ] **CI/CD**: OIDC 인증, 시크릿 스캔, 의존성 감사
- [ ] **CDN/WAF**: Cloudflare WAF에 OWASP 규칙 활성화
- [ ] **암호화**: 저장 시 및 전송 시 데이터 암호화
- [ ] **백업**: 자동 백업 및 복구 테스트 완료
- [ ] **컴플라이언스**: GDPR/HIPAA 요구 사항 충족 (해당 시)
- [ ] **문서**: 인프라 문서화, 운영 매뉴얼 작성됨
- [ ] **인시던트 대응**: 보안 인시던트 계획 수립됨

## 일반적인 클라우드 보안 잘못된 설정

### S3 Bucket 노출

```bash
# 잘못된 방법: 공개 bucket
aws s3api put-bucket-acl --bucket my-bucket --acl public-read

# 올바른 방법: 비공개 bucket과 특정 접근
aws s3api put-bucket-acl --bucket my-bucket --acl private
aws s3api put-bucket-policy --bucket my-bucket --policy file://policy.json
```

### RDS 공개 접근

```terraform
# 잘못된 방법
resource "aws_db_instance" "bad" {
  publicly_accessible = true  # 절대 이렇게 하지 마세요!
}

# 올바른 방법
resource "aws_db_instance" "good" {
  publicly_accessible = false
  vpc_security_group_ids = [aws_security_group.db.id]
}
```

## 리소스

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [Cloudflare Security Documentation](https://developers.cloudflare.com/security/)
- [OWASP Cloud Security](https://owasp.org/www-project-cloud-security/)
- [Terraform Security Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/)

**기억하세요**: 클라우드 잘못된 설정은 데이터 유출의 주요 원인입니다. 단 하나의 노출된 S3 bucket이나 과도하게 넓은 IAM 정책이 전체 인프라를 위험에 빠뜨릴 수 있습니다. 항상 최소 권한 원칙과 심층 방어를 따르세요.
