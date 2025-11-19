# 태그 설정 기능 설치 가이드

이 기능을 사용하려면 Supabase에 새로운 테이블을 생성해야 합니다.

## 설치 방법

1. **Supabase Dashboard 접속**
   - https://supabase.com 에 로그인
   - 프로젝트 선택: `cvadrvebtnwlhunlsgqq`

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 `SQL Editor` 클릭
   - `New query` 버튼 클릭

3. **SQL 실행**
   - 아래 SQL을 복사해서 붙여넣기
   - `Run` 버튼 클릭

```sql
-- 단위(Unit) 테이블 생성
CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 단위 추가
INSERT INTO units (unit_name) VALUES
    ('°C'), ('°F'), ('bar'), ('psi'), ('kPa'), ('MPa'),
    ('L/min'), ('m³/h'), ('kg/h'), ('rpm'), ('%'),
    ('kW'), ('MW'), ('A'), ('V')
ON CONFLICT (unit_name) DO NOTHING;

-- 태그 설정 테이블 생성
CREATE TABLE IF NOT EXISTS tag_settings (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(255) NOT NULL UNIQUE,
    custom_name VARCHAR(255),
    multiplier DECIMAL(10, 4) DEFAULT 1.0,
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tag_settings_tag_name ON tag_settings(tag_name);
CREATE INDEX IF NOT EXISTS idx_units_unit_name ON units(unit_name);

-- updated_at 자동 업데이트를 위한 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS update_tag_settings_updated_at ON tag_settings;
CREATE TRIGGER update_tag_settings_updated_at
    BEFORE UPDATE ON tag_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

4. **확인**
   - 왼쪽 메뉴에서 `Table Editor` 클릭
   - `units`와 `tag_settings` 테이블이 생성되었는지 확인

## 테이블 설명

### units 테이블
- 사용 가능한 단위 목록 저장
- 기본 단위: °C, bar, kPa, rpm, % 등 15개 포함
- 사용자가 추가 단위를 등록 가능

### tag_settings 테이블
- 태그별 커스텀 설정 저장
- `tag_name`: 태그 이름 (고유값)
- `custom_name`: 사용자 지정 표시 이름
- `multiplier`: 값 가중치 (예: 2.0 = 2배)
- `unit`: 표시 단위

## 문제 해결

테이블 생성이 실패하면:
1. 이미 테이블이 존재하는지 확인
2. Supabase 프로젝트 권한 확인
3. SQL Editor에서 에러 메시지 확인
