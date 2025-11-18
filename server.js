const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// 환경변수 로드
dotenv.config();

// Supabase 클라이언트 초기화
// 환경변수 우선, 없으면 기본값 사용
const supabaseUrl = process.env.SUPABASE_URL || 'https://cvadrvebtnwlhunlsgqq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YWRydmVidG53bGh1bmxzZ3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MTI1MzEsImV4cCI6MjA3ODk4ODUzMX0.qAKXcRl37oDquwHyUg2NexwlKaMWCqaDWAcpELL_F2c';

let supabase = null;
try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
} catch (error) {
    console.log('⚠️ Supabase initialization failed:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 보안 미들웨어 설정
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

// CORS 설정
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3001',
        /vercel\.app$/,  // 모든 Vercel 배포 허용
        /localhost:\d+/   // 모든 localhost 포트 허용
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// 설정 검증
function validateConfig() {
    const required = ['CLOUDFLARE_WORKER_URL', 'CLOUDFLARE_API_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log('✅ Configuration validated');
}

// 로그인 API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log(`🔐 로그인 시도: ${username}`);

        if (!username || !password) {
            console.log('❌ 로그인 실패: 아이디/비밀번호 미입력');
            return res.status(400).json({
                success: false,
                message: '아이디와 비밀번호를 입력해주세요.'
            });
        }

        if (!supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않음');
            console.error('   - SUPABASE_URL:', process.env.SUPABASE_URL ? '설정됨' : '❌ 미설정');
            console.error('   - SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '설정됨' : '❌ 미설정');
            return res.status(500).json({
                success: false,
                message: 'Supabase가 설정되지 않았습니다.',
                debug: process.env.NODE_ENV === 'development' ? {
                    supabase_url_exists: !!process.env.SUPABASE_URL,
                    supabase_key_exists: !!process.env.SUPABASE_ANON_KEY
                } : undefined
            });
        }

        // Supabase에서 사용자 조회
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) {
            console.error('❌ Supabase 쿼리 에러:', error.message);
            console.error('   - 에러 코드:', error.code);
            console.error('   - 에러 상세:', error.details);
            if (error.code === 'PGRST116') {
                console.error('   → users 테이블에 해당 사용자가 없습니다.');
                console.error('   → SUPABASE_SETUP.sql을 실행했는지 확인하세요.');
            }
        }

        if (error || !user) {
            console.log(`❌ 로그인 실패: 사용자를 찾을 수 없음 (${username})`);
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        console.log(`✅ 사용자 발견: ${username} (ID: ${user.id})`);

        // 비밀번호 확인
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            console.log('❌ 로그인 실패: 비밀번호 불일치');
            console.log('   - 입력한 비밀번호:', password);
            console.log('   - 저장된 해시:', user.password_hash.substring(0, 20) + '...');
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 마지막 로그인 시간 업데이트
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        console.log(`✅ 로그인 성공: ${username}`);

        res.json({
            success: true,
            message: '로그인 성공',
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error.message);
        console.error('   스택 트레이스:', error.stack);
        res.status(500).json({
            success: false,
            message: '로그인 처리 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 메타데이터 API
app.get('/api/meta', async (req, res) => {
    try {
        const forceRefresh = req.query.force_refresh === 'true';

        // Supabase에서 캐시된 데이터 확인 (force_refresh가 아닌 경우만)
        if (supabase && !forceRefresh) {
            const { data: cachedData, error: cacheError } = await supabase
                .from('dcs_metadata_cache')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (!cacheError && cachedData && cachedData.data) {
                console.log('✅ 메타데이터를 Supabase 캐시에서 로드');
                return res.json({
                    success: true,
                    message: 'ok (from cache)',
                    data: cachedData.data,
                    cached: true,
                    updated_at: cachedData.updated_at
                });
            }
        }

        // Supabase에 없거나 force_refresh인 경우 Lambda에서 가져오기
        console.log('📡 Lambda에서 메타데이터 가져오는 중...');
        const response = await axios({
            url: `${process.env.CLOUDFLARE_WORKER_URL}/meta`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.CLOUDFLARE_API_KEY
            },
            data: {}
        });

        const result = response.data;
        const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;

        // Supabase에 저장
        if (supabase && data && data.length > 0) {
            const { error: upsertError } = await supabase
                .from('dcs_metadata_cache')
                .upsert({
                    data: data,
                    updated_at: new Date().toISOString(),
                    source: 'api'
                });

            if (upsertError) {
                console.error('⚠️ Supabase 저장 실패:', upsertError.message);
            } else {
                console.log('✅ 메타데이터를 Supabase에 저장 완료');
            }
        }

        res.json({
            success: true,
            message: result.msg || 'ok',
            data: data,
            cached: false
        });
    } catch (error) {
        console.error('Meta fetch error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch metadata',
            error: error.message
        });
    }
});

// 데이터 조회 API
app.post('/api/data', async (req, res) => {
    try {
        const { exec_from_dt, exec_to_dt, tag_names } = req.body;

        if (!exec_from_dt || !exec_to_dt) {
            return res.status(400).json({
                success: false,
                message: 'exec_from_dt and exec_to_dt are required'
            });
        }

        const fromDate = new Date(exec_from_dt);
        const toDate = new Date(exec_to_dt);
        const maxRange = 30 * 24 * 60 * 60 * 1000;

        if (toDate - fromDate > maxRange) {
            return res.status(400).json({
                success: false,
                message: 'Date range cannot exceed 30 days'
            });
        }

        const payload = {
            exec_from_dt,
            exec_to_dt
        };

        if (tag_names && tag_names.length > 0) {
            payload.tag_names = tag_names;
        }

        console.log('📤 요청 payload:', JSON.stringify(payload, null, 2));

        const response = await axios({
            url: `${process.env.CLOUDFLARE_WORKER_URL}/dcs-hourly`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.CLOUDFLARE_API_KEY
            },
            data: payload
        });

        const result = response.data;
        const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;

        // 디버깅: 첫 번째 데이터 항목 로그
        if (data && data.length > 0) {
            console.log('📊 API 응답 데이터 개수:', data.length);
            console.log('📊 첫 번째 항목:', JSON.stringify(data[0], null, 2));
            console.log('📊 첫 번째 항목의 키들:', Object.keys(data[0]));
        } else {
            console.log('⚠️ 응답 데이터가 비어있거나 배열이 아닙니다:', data);
        }

        res.json({
            success: true,
            message: result.msg || 'ok',
            data: data
        });
    } catch (error) {
        console.error('Data fetch error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch data',
            error: error.message
        });
    }
});

// ==================== 계기 선택 저장/불러오기 API ====================

// 저장된 선택 목록 조회
app.get('/api/saved-selections', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, message: 'Supabase 미설정' });
        }

        const { data, error } = await supabase
            .from('saved_tag_selections')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: data });
    } catch (error) {
        console.error('저장된 선택 조회 실패:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 특정 선택 조회
app.get('/api/saved-selections/:id', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, message: 'Supabase 미설정' });
        }

        const { data, error } = await supabase
            .from('saved_tag_selections')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json({ success: true, data: data });
    } catch (error) {
        console.error('선택 조회 실패:', error);
        res.status(404).json({ success: false, message: error.message });
    }
});

// 새 선택 저장
app.post('/api/saved-selections', async (req, res) => {
    try {
        const { name, tag_names } = req.body;

        if (!name || !tag_names || !Array.isArray(tag_names)) {
            return res.status(400).json({
                success: false,
                message: 'name과 tag_names(배열) 필요'
            });
        }

        if (!supabase) {
            return res.status(500).json({ success: false, message: 'Supabase 미설정' });
        }

        const { data, error } = await supabase
            .from('saved_tag_selections')
            .insert([{
                name: name,
                tag_names: tag_names,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        console.log(`✅ 선택 저장: ${name} (${tag_names.length}개)`);

        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('선택 저장 실패:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 선택 삭제
app.delete('/api/saved-selections/:id', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, message: 'Supabase 미설정' });
        }

        const { data, error } = await supabase
            .from('saved_tag_selections')
            .delete()
            .eq('id', req.params.id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: '레이아웃을 찾을 수 없습니다' });
        }

        console.log(`🗑️ 레이아웃 삭제: ${data[0].name}`);

        res.json({ success: true, message: '레이아웃이 삭제되었습니다' });
    } catch (error) {
        console.error('레이아웃 삭제 실패:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cloudflare_worker: process.env.CLOUDFLARE_WORKER_URL
    });
});

// 서버 시작
validateConfig();

// Vercel에서는 app을 export하고, 로컬에서는 listen
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n✅ DCS Dashboard Server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Cloudflare Worker: ${process.env.CLOUDFLARE_WORKER_URL}`);
        console.log(`\n🚀 Open http://localhost:${PORT} in your browser\n`);
    });
}

// Vercel serverless function을 위한 export
module.exports = app;
