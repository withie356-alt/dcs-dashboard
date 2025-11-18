-- =====================================================
-- DCS Dashboard - Supabase Schema
-- =====================================================

-- 1. 메타데이터 캐시 테이블 (이미 생성되어 있으면 건너뜀)
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

-- 기본 admin 사용자 추가 (비밀번호: admin)
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$10$YourHashHere')  -- 실제 해시로 교체 필요
ON CONFLICT (username) DO NOTHING;

-- 3. 저장된 계기 선택 목록 테이블
CREATE TABLE IF NOT EXISTS saved_tag_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- 저장 목록 이름 (예: "메인 계기들", "온도 센서만")
  tag_names JSONB NOT NULL,  -- 선택된 태그 배열
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_selections_user
ON saved_tag_selections(user_id);

ALTER TABLE saved_tag_selections DISABLE ROW LEVEL SECURITY;

-- 4. 현재 선택된 계기 상태 (사용자별로 마지막 선택 기억)
CREATE TABLE IF NOT EXISTS user_current_selection (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tag_names JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_current_selection DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 완료!
-- =====================================================
