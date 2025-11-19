-- 단위(Unit) 테이블 생성
CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 단위 추가
INSERT INTO units (unit_name) VALUES
    ('°C'),
    ('°F'),
    ('bar'),
    ('psi'),
    ('kPa'),
    ('MPa'),
    ('L/min'),
    ('m³/h'),
    ('kg/h'),
    ('rpm'),
    ('%'),
    ('kW'),
    ('MW'),
    ('A'),
    ('V')
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
