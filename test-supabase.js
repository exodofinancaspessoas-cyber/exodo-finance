
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mozbwnrikotnrtrfifqn.supabase.co';
const supabaseAnonKey = 'sb_publishable_vJZLBOSWlrXE24AMv3svaA_LtK7URtT';

console.log('Testing with URL:', supabaseUrl);
console.log('Testing with Key:', supabaseAnonKey?.substring(0, 15) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data, error } = await supabase.from('profiles').select('*').limit(1);
        if (error) {
            console.error('Connection failed:', error.message);
            console.error('Full error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Success! Connection established.');
        }
    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

test();
