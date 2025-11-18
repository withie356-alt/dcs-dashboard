// Supabase admin 사용자 생성 스크립트
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createAdminUser() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ .env 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해주세요.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 기본 admin 계정 정보
    const username = 'admin';
    const password = 'admin';  // 실제 환경에서는 더 강력한 비밀번호 사용 권장

    try {
        // 비밀번호 해시 생성
        console.log('🔐 비밀번호 해시 생성 중...');
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // 기존 admin 사용자 확인
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (existingUser) {
            console.log('⚠️ admin 사용자가 이미 존재합니다.');
            console.log('비밀번호를 업데이트하시겠습니까? (Y/N)');

            // 업데이트 로직 (선택사항)
            const { error: updateError } = await supabase
                .from('users')
                .update({ password_hash })
                .eq('username', username);

            if (updateError) {
                console.error('❌ 업데이트 실패:', updateError.message);
                process.exit(1);
            }

            console.log('✅ admin 사용자 비밀번호가 업데이트되었습니다.');
        } else {
            // 새 admin 사용자 생성
            const { data, error } = await supabase
                .from('users')
                .insert({
                    username,
                    password_hash,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('❌ 사용자 생성 실패:', error.message);
                process.exit(1);
            }

            console.log('✅ admin 사용자가 생성되었습니다!');
            console.log('📋 사용자 정보:');
            console.log('   - 아이디: admin');
            console.log('   - 비밀번호: admin');
            console.log('   - User ID:', data.id);
        }

        console.log('\n⚠️ 보안 권장사항:');
        console.log('   1. 첫 로그인 후 비밀번호를 변경하세요.');
        console.log('   2. 운영 환경에서는 강력한 비밀번호를 사용하세요.');
        console.log('   3. 필요 없는 계정은 삭제하세요.');

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

createAdminUser();
