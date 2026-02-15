
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uojwlihxeyvrwhfiwypt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvandsaWh4ZXl2cndoZml3eXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTc3NzcsImV4cCI6MjA4MzAzMzc3N30.e6sFYpah6eA5QD6He_qBZ2aNwUBGv1nwnULQ4fJi9MI';

console.log('Testing with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'brunobjd05@gmail.com',
            password: 'incorrect_password'
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
