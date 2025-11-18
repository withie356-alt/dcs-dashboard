# DCS 실시간 모니터링 대시보드

DCS(Distributed Control System) 센서 데이터를 실시간으로 모니터링하는 웹 대시보드입니다.

## 주요 기능

- ✅ 실시간 센서 데이터 모니터링
- ✅ Chart.js 기반 데이터 시각화
- ✅ Supabase를 활용한 메타데이터 캐싱
- ✅ 계기 선택 저장/불러오기
- ✅ Apple 디자인 스타일 UI
- ✅ 반응형 레이아웃

## 기술 스택

### Backend
- Node.js + Express
- Cloudflare Workers (프록시)
- AWS Lambda (데이터 소스)

### Frontend
- Vanilla JavaScript (ES6 Class)
- Chart.js
- HTML/CSS

### Database
- Supabase (PostgreSQL)

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/dcs-dashboard.git
cd dcs-dashboard
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 설정

`.env.example`을 복사해서 `.env` 파일 생성:

```bash
copy .env.example .env  # Windows
# 또는
cp .env.example .env    # Mac/Linux
```

`.env` 파일을 열어서 다음 값들을 설정:

```env
PORT=3001

# Cloudflare Workers 설정
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
CLOUDFLARE_API_KEY=your-api-key-here

# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Supabase 데이터베이스 설정

1. [Supabase](https://supabase.com) 계정 생성 및 프로젝트 생성
2. SQL Editor에서 `supabase-schema.sql` 파일 내용 실행
3. Project Settings → API에서 URL과 anon key 복사
4. `.env` 파일에 값 입력

### 5. 서버 실행

```bash
npm start
```

브라우저에서 http://localhost:3001 접속

## 기본 로그인 정보

- **아이디**: admin
- **비밀번호**: admin

## 프로젝트 구조

```
dcs-dashboard/
├── .env                    # 환경 변수 (gitignore)
├── .env.example            # 환경 변수 템플릿
├── package.json
├── server.js              # Express 서버
├── supabase-schema.sql    # Supabase 테이블 스키마
├── PRD.md                 # 프로젝트 요구사항 문서
└── public/
    ├── index.html         # 메인 HTML
    └── dashboard.js       # Dashboard 클래스
```

## 사용 방법

### 계기 선택

1. "계기 선택" 버튼 클릭
2. WIE/INTECO 그룹에서 원하는 계기 선택
3. "적용" 버튼 클릭

### 데이터 조회

1. 날짜 범위 선택 (최대 30일)
2. "새로고침" 버튼 클릭
3. 위젯에 최신 데이터 표시

### 상세 차트 보기

- 위젯 클릭 → 상세 차트 모달 (최소/평균/최대값 표시)

## 환경변수 관리

**중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

이미 `.gitignore`에 추가되어 있으므로 자동으로 제외됩니다.

### 배포 시 환경변수 설정

각 배포 플랫폼에서 환경변수를 직접 설정하세요:

- **Vercel**: Project Settings → Environment Variables
- **Heroku**: Settings → Config Vars
- **Render**: Environment → Add Environment Variable

## 라이선스

MIT

## 문의

이슈가 있으시면 GitHub Issues에 등록해주세요.
