
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mozbwnrikotnrtrfifqn.supabase.co';
const supabaseAnonKey = 'sb_publishable_vJZLBOSWlrxe24AMv3svaA_LtK7URtT';

console.log('Testing with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'brunobjd05@gmail.com',
            password: 'password_placeholder'
        });

        if (error) {
            console.log('Auth result message:', error.message);
        } else {
            console.log('Success! Logged in.');
        }
    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

test();
