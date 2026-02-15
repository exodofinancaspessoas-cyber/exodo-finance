
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mozbwnrikotnrtrfifqn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODQ3NzcsImV4cCI6MjA4NjM2MDc3N30.FVWNOmyfcQ3HX77Uggwt45nRO9N9pox6gA4rzx8Hwqc';

console.log('Testing with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'brunobjd05@gmail.com',
            password: 'password_placeholder' // I don't know the password, but the error message will be telling
        });

        if (error) {
            console.log('Auth result message:', error.message);
            console.log('Auth result status:', error.status);
        } else {
            console.log('Success! Logged in.');
        }
    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

test();
