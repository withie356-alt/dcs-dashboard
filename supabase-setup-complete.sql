-- =====================================================
-- DCS Dashboard - 완전한 Supabase 설정 (테이블 + Admin 사용자)
-- =====================================================
-- Supabase SQL Editor에서 이 전체 스크립트를 실행하세요!
-- =====================================================

-- 1. 메타데이터 캐시 테이블
CREATE TABLE IF NOT EXISTS dcs_metadata_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'api'
);

CREATE INDEX IF NOT EXISTS idx_dcs_metadata_updated
ON dcs_metadata_cache(updated_at DESC);

ALTER TABLE dcs_metadata_cache DISABLE ROW LEVEL SECURITY;

-- 2. 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username
ON users(username);

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 3. 저장된 계기 선택 목록 테이블
CREATE TABLE IF NOT EXISTS saved_tag_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tag_names JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_selections_user
ON saved_tag_selections(user_id);

ALTER TABLE saved_tag_selections DISABLE ROW LEVEL SECURITY;

-- 4. 현재 선택된 계기 상태
CREATE TABLE IF NOT EXISTS user_current_selection (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tag_names JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_current_selection DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Admin 사용자 생성
-- =====================================================
-- 비밀번호: admin (bcrypt 해시)
-- 실제 해시 값은 bcrypt로 "admin"을 해싱한 결과입니다

INSERT INTO users (username, password_hash, created_at)
VALUES (
  'admin',
  '$2b$10$YgO3wZ8qWKqZ8qHGKZHrAO5X3X1X9X8X7X6X5X4X3X2X1X0X9X8X7',  -- 이 값은 임시입니다. 아래 단계를 따라주세요
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- 중요! Admin 비밀번호 설정 방법
-- =====================================================
-- 위의 password_hash는 임시 값입니다. 실제 해시를 생성하려면:
--
-- 방법 1: Node.js 콘솔에서 직접 생성
-- -----------------------------------------
-- 1. 터미널을 열고 프로젝트 폴더로 이동
-- 2. 다음 명령어 실행:
--
--    node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin', 10, (err, hash) => console.log(hash));"
--
-- 3. 출력된 해시 값을 복사
-- 4. Supabase SQL Editor에서 다음 명령 실행:
--
--    UPDATE users
--    SET password_hash = '여기에_복사한_해시_붙여넣기'
--    WHERE username = 'admin';
--
-- =====================================================
-- 완료!
-- =====================================================
