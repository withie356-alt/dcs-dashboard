const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');

// 환경변수 로드
dotenv.config();

// Supabase 클라이언트 초기화
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// URL이 유효한 형식인지 확인
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http') && supabaseUrl.includes('supabase');

if (isValidUrl && supabaseKey && supabaseKey !== 'your_supabase_anon_key_here') {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized');
    } catch (error) {
        console.log('⚠️ Supabase initialization failed:', error.message);
    }
} else {
    console.log('⚠️ Supabase credentials not configured, caching disabled');
    console.log('   To enable caching, set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
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
app.listen(PORT, () => {
    console.log(`\n✅ DCS Dashboard Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Cloudflare Worker: ${process.env.CLOUDFLARE_WORKER_URL}`);
    console.log(`\n🚀 Open http://localhost:${PORT} in your browser\n`);
});
