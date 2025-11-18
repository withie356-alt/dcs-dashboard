# Vercel 배포 가이드

## 1. Vercel 환경변수 설정

Vercel 대시보드에서 다음 환경변수를 설정하세요:

### 필수 환경변수

```
CLOUDFLARE_WORKER_URL=https://aws356.withie356.workers.dev
CLOUDFLARE_API_KEY=my-secret-9751
SUPABASE_URL=https://cvadrvebtnwlhunlsgqq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YWRydmVidG53bGh1bmxzZ3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MTI1MzEsImV4cCI6MjA3ODk4ODUzMX0.qAKXcRl37oDquwHyUg2NexwlKaMWCqaDWAcpELL_F2c
```

### 선택 환경변수

```
PORT=3001
NODE_ENV=production
AUTO_REFRESH_INTERVAL=10000
MAX_DATA_POINTS=100
DATA_RETENTION_HOURS=24
```

## 2. 환경변수 설정 방법

1. Vercel 프로젝트 대시보드로 이동
2. **Settings** 탭 클릭
3. **Environment Variables** 메뉴 선택
4. 위의 환경변수들을 하나씩 추가

## 3. 배포 후 확인사항

- ✅ API 엔드포인트가 `/api/*`로 접근 가능한지 확인
- ✅ 로그인 기능 테스트 (admin/admin)
- ✅ Supabase 연결 확인
- ✅ DCS 데이터 조회 테스트

## 4. 로컬 개발 vs Vercel 배포

### 로컬 개발
- API URL: `http://localhost:3001/api`
- 서버 실행: `npm start`

### Vercel 배포
- API URL: 자동으로 같은 origin의 `/api` 사용
- Serverless Functions로 자동 배포

## 5. 문제 해결

### CORS 오류
- 서버의 CORS 설정이 Vercel origin을 허용하도록 설정되어 있음
- `server.js`에서 자동으로 `.vercel.app` 도메인 허용

### API 연결 실패
- Vercel 환경변수가 올바르게 설정되었는지 확인
- Vercel 빌드 로그 확인

### 로그인 실패
- Supabase에 users 테이블이 생성되었는지 확인
- Admin 사용자가 등록되었는지 확인
