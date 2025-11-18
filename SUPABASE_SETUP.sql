-- =====================================================
-- DCS Dashboard - Supabase 설정 (한 번에 실행하세요!)
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
-- Admin 사용자 생성 (아이디: admin, 비밀번호: admin)
-- =====================================================

INSERT INTO users (username, password_hash, created_at)
VALUES (
  'admin',
  '$2b$10$sbxd138a6GlUblj0mesnR.0Iuz3A3nxWxxTnv/5wb15j7n3Gx5AbG',
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- 완료! 이제 로그인할 수 있습니다.
-- 아이디: admin
-- 비밀번호: admin
-- =====================================================
