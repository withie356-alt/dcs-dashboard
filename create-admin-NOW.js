// Supabase에 admin 사용자를 바로 추가하는 스크립트
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ .env 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정하세요');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    console.log('🚀 admin 사용자 생성 시작...\n');

    // 비밀번호 해시 생성
    const password = 'admin356';
    const hash = bcrypt.hashSync(password, 10);

    console.log('1️⃣ 비밀번호 해시 생성 완료');
    console.log(`   해시: ${hash}\n`);

    // 기존 admin 삭제
    console.log('2️⃣ 기존 admin 사용자 삭제 중...');
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('username', 'admin');

    if (deleteError && deleteError.code !== 'PGRST116') {
        console.error('   ⚠️ 삭제 실패:', deleteError.message);
    } else {
        console.log('   ✅ 기존 사용자 삭제 완료\n');
    }

    // 새 admin 추가
    console.log('3️⃣ 새로운 admin 사용자 추가 중...');
    const { data, error } = await supabase
        .from('users')
        .insert([
            {
                username: 'admin',
                password_hash: hash,
                created_at: new Date().toISOString()
            }
        ])
        .select();

    if (error) {
        console.error('❌ admin 사용자 추가 실패:', error.message);
        console.error('   에러 코드:', error.code);
        console.error('   힌트:', error.hint);
        process.exit(1);
    }

    console.log('✅ admin 사용자 추가 성공!');
    console.log('   사용자 ID:', data[0].id);
    console.log('\n🎉 완료! 이제 로그인할 수 있습니다:');
    console.log('   아이디: admin');
    console.log('   비밀번호: admin356');
}

createAdmin();
