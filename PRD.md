# DCS 실시간 모니터링 대시보드 PRD

## 1. 프로젝트 개요

DCS(Distributed Control System) 센서 데이터를 실시간으로 모니터링하는 웹 대시보드입니다.
Cloudflare Workers를 통해 AWS Lambda와 통신하여 데이터를 조회하고 시각화합니다.

## 2. 기술 스택

### Backend
- Node.js + Express
- Cloudflare Workers (프록시)
- AWS Lambda (데이터 소스)

### Frontend
- Vanilla JavaScript (클래스 기반)
- Chart.js (데이터 시각화)
- 순수 HTML/CSS (Apple 디자인 스타일)

### 보안
- Helmet.js (CSP 설정 포함)
- express-rate-limit
- CORS

## 3. 환경 설정 (.env)

```env
PORT=3001
CLOUDFLARE_WORKER_URL=https://aws356.withie356.workers.dev
CLOUDFLARE_API_KEY=my-secret-9751
AUTO_REFRESH_INTERVAL=10000
MAX_DATA_POINTS=100
```

## 4. API 명세

### 4.1 메타데이터 조회
```
GET /api/meta

Response:
{
  "success": true,
  "message": "ok",
  "data": [
    {
      "tag_name": "kepco_power_01",
      "description": "전력"
    }
  ]
}
```

### 4.2 데이터 조회
```
POST /api/data

Request:
{
  "exec_from_dt": "2025-01-14",
  "exec_to_dt": "2025-01-17",
  "tag_names": ["kepco_power_01", "posco_temp_01"]
}

Response:
{
  "success": true,
  "message": "ok",
  "data": [
    {
      "tag_name": "kepco_power_01",
      "tag_val": 123.45,
      "dtm": "2025-01-17T10:00:00Z"
    }
  ]
}
```

### 4.3 헬스 체크
```
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:00:00Z",
  "environment": "development",
  "cloudflare_worker": "https://aws356.withie356.workers.dev"
}
```

## 5. 주요 기능 요구사항

### 5.1 인증
- 간단한 로그인 화면
- 아이디: `admin`, 비밀번호: `admin`
- 로그인 성공 시 메인 대시보드로 전환

### 5.2 태그 선택
- 모달 방식으로 태그 선택
- KEPCO/POSCO로 그룹화하여 표시
- 검색 기능 제공
- 전체 선택/해제 기능
- 선택된 태그 개수 표시

### 5.3 데이터 시각화
- 선택된 각 태그별로 위젯 생성
- 위젯에는 최신 값 + 미니 차트 표시
- 위젯 클릭 시 상세 차트 모달 표시
- 각 위젯에서 개별 삭제 가능

### 5.4 날짜 범위 선택
- 기본값: 오늘 기준 **최근 3일** (오늘 포함)
- 최대 범위: 30일
- date input 사용

### 5.5 데이터 새로고침
- 수동 새로고침 버튼
- 로딩 상태 표시 (버튼 opacity 변경)
- 새로고침 성공/실패 알림 표시

### 5.6 시간 표시
- 최신 데이터의 시간을 "N시 Data" 형식으로 표시
- 연결 실패 시 "연결실패" 표시 + 빨간색 스타일

## 6. UI/UX 요구사항 (매우 중요)

### 6.1 헤더 레이아웃 (절대 준수)

```
┌─────────────────────────────────────────────────────────┐
│ [DCS 실시간 모니터링] [2025-01-14 - 2025-01-17]        │  ← 첫 번째 줄
│ [⚙ 계기 선택] [🔄 새로고침] [● N시 Data]               │  ← 두 번째 줄
└─────────────────────────────────────────────────────────┘
```

**핵심 요구사항:**
1. 제목과 날짜 선택기는 **반드시 같은 줄**에 배치
2. 날짜 선택기는 제목 **바로 우측**에 위치
3. **절대로 줄바꿈이 일어나면 안됨** (`white-space: nowrap` 적용)
4. 계기 선택, 새로고침, 시간 표시는 두 번째 줄에 배치

### 6.2 날짜 선택기 상세 스펙

```css
.date-selector {
  gap: 2px;                    /* 최소 간격 */
  padding: 4px 8px;            /* 최소 여백 */
  font-size: 12px;             /* 작은 폰트 */
  white-space: nowrap;         /* 줄바꿈 금지 */
}

.date-selector input {
  width: 85px;                 /* 고정 폭 */
  font-size: 12px;
}

/* 달력 아이콘 완전 제거 */
input::-webkit-calendar-picker-indicator {
  display: none;
}

.date-separator {
  font-size: 10px;             /* 구분자는 더 작게 */
  margin: 0;                   /* 여백 제거 */
}
```

### 6.3 버튼 스펙

```css
.btn {
  height: 40px;                /* 고정 높이 */
  min-height: 40px;
  max-height: 40px;
  line-height: 1;              /* 이모지 높이 문제 방지 */
  transition: background-color 0.2s, box-shadow 0.2s, transform 0.1s;
  /* transition: all 사용 금지 - 버튼이 커지는 문제 발생 */
}

.btn.loading {
  opacity: 0.6;
  pointer-events: none;
}
```

**중요:** `transition: all` 사용 시 버튼 크기가 변하는 버그가 발생하므로 절대 사용 금지

### 6.4 시간 표시 스펙

```css
.time-display {
  height: 40px;                /* 버튼과 같은 높이 */
  padding: 10px 16px;
  border-radius: 20px;         /* 캡슐 모양 */
}

.time-display.error {
  background: rgba(255, 59, 48, 0.12);
  color: #FF3B30;
}
```

### 6.5 색상 팔레트 (Apple 스타일)

```css
--primary: #007AFF;          /* 파란색 */
--primary-dark: #0051D5;
--secondary: #34C759;        /* 초록색 */
--danger: #FF3B30;           /* 빨간색 */
--bg: #F5F5F7;               /* 밝은 회색 배경 */
--bg-card: #ffffff;          /* 카드 배경 */
--text: #1D1D1F;             /* 검은색 텍스트 */
--text-secondary: #86868B;   /* 회색 텍스트 */
```

### 6.6 위젯 그리드

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);  /* 2열 */
  gap: 16px;
}

@media (max-width: 768px) {
  grid-template-columns: 1fr;  /* 모바일은 1열 */
}
```

## 7. 파일 구조

```
dcs-dashboard/
├── .env                    # 환경 변수
├── package.json
├── server.js              # Express 서버
└── public/
    ├── index.html         # 단일 HTML 파일
    └── dashboard.js       # Dashboard 클래스
```

## 8. JavaScript 클래스 구조

```javascript
class Dashboard {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3001/api';
    this.state = {
      dateFrom: new Date(Date.now() - 3 * 24 * 3600000),  // 3일 전
      dateTo: new Date(),
      selectedTags: [],
      availableTagsData: [],
      chartData: new Map(),
      charts: new Map()
    };
  }

  // 핵심 메서드
  async init()                          // 초기화
  login()                               // 로그인
  async loadMetadata()                  // 메타데이터 로드
  openTagSelector()                     // 태그 선택 모달
  displayAvailableTags()                // 태그 목록 표시
  toggleTag(tagName)                    // 태그 토글
  applySelectedTags()                   // 선택 적용
  renderWidgets()                       // 위젯 렌더링
  createMiniChart(tagName)              // 미니 차트 생성
  async refreshData()                   // 데이터 새로고침
  updateCharts(data)                    // 차트 업데이트
  updateLastTime(timestamp)             // "N시 Data" 업데이트
  showConnectionError()                 // 연결 실패 표시
  openChartModal(tagName)               // 상세 차트 모달
  closeModal(modalId)                   // 모달 닫기
  showNotification(message, type)       // 알림 표시
}
```

## 9. 서버 CSP 설정

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
```

**중요:** Google Fonts 사용을 위해 `fonts.googleapis.com`과 `fonts.gstatic.com` 허용 필요

## 10. 태그 설명 매핑

```javascript
const TAG_DESCRIPTIONS = {
  'kepco_power_': '전력',
  'kepco_voltage_': '전압',
  'kepco_current_': '전류',
  'kepco_frequency_': '주파수',
  'kepco_pf_': '역률',
  'posco_temp_': '온도',
  'posco_pressure_': '압력',
  'posco_flow_': '유량',
  'posco_level_': '레벨',
  'posco_speed_': '속도'
};

const TAG_UNITS = {
  'power': 'kW',
  'voltage': 'V',
  'current': 'A',
  'frequency': 'Hz',
  'temp': '°C',
  'pressure': 'MPa',
  'flow': 'm³/h',
  'level': 'm',
  'speed': 'rpm'
};
```

## 11. 알려진 이슈 및 해결 방법

### 이슈 1: 버튼이 로딩 시 커지는 문제
**원인:** `transition: all` 사용
**해결:** `transition: background-color 0.2s, box-shadow 0.2s, transform 0.1s` 사용

### 이슈 2: 이모지로 인한 버튼 높이 증가
**원인:** body의 `line-height: 1.47059`가 이모지에 적용됨
**해결:** 버튼에 `line-height: 1` 명시적 적용

### 이슈 3: Google Fonts 차단
**원인:** CSP에서 fonts.googleapis.com 미허용
**해결:** `styleSrc`와 `fontSrc`에 Google Fonts 도메인 추가

### 이슈 4: 브라우저 캐시 문제
**원인:** 브라우저가 HTML/CSS/JS를 공격적으로 캐싱
**해결:**
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

## 12. 테스트 시나리오

1. **로그인 테스트**
   - 잘못된 비밀번호 입력 → 오류 메시지 표시
   - 올바른 비밀번호 입력 → 대시보드 표시

2. **태그 선택 테스트**
   - 태그 검색 기능 동작 확인
   - 전체 선택/해제 동작 확인
   - 선택 개수 정확성 확인

3. **데이터 조회 테스트**
   - 날짜 범위 변경 후 데이터 조회
   - 30일 초과 시 오류 표시 확인

4. **레이아웃 테스트 (중요)**
   - 다양한 화면 크기에서 제목과 날짜가 **한 줄**에 있는지 확인
   - 버튼 높이가 40px로 고정되어 있는지 확인
   - 새로고침 시 버튼이 커지지 않는지 확인

5. **차트 테스트**
   - 위젯 클릭 시 상세 차트 모달 표시 확인
   - 차트 데이터 정확성 확인

## 13. 배포 전 체크리스트

- [ ] .env 파일에 실제 Cloudflare Workers URL 설정
- [ ] .env 파일에 실제 API 키 설정
- [ ] CSP 설정에 필요한 도메인 모두 허용
- [ ] 브라우저에서 Ctrl+Shift+R로 캐시 제거 후 테스트
- [ ] 모바일 반응형 레이아웃 확인
- [ ] 네트워크 오류 시 적절한 오류 메시지 표시 확인
- [ ] **헤더 레이아웃이 요구사항대로 구현되었는지 확인**

## 14. 실행 방법

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm start

# 브라우저에서 접속
http://localhost:3001
```

## 15. 중요 포인트 요약

🔴 **절대 지켜야 할 것:**
1. 제목과 날짜 선택기는 무조건 한 줄에 배치 (줄바꿈 금지)
2. 날짜 선택기는 최소한의 여백으로 간결하게
3. 버튼은 `transition: all` 사용 금지
4. 버튼 높이 40px 고정
5. 기본 날짜 범위는 3일

🟢 **권장 사항:**
1. Apple 디자인 가이드라인 준수
2. 깔끔하고 미니멀한 UI
3. 적절한 여백과 간격
4. 명확한 오류 메시지
5. 빠른 응답성
