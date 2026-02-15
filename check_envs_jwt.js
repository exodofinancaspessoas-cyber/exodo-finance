
const DEV_URL = 'https://mozbwnrikotnrtrfifqn.supabase.co';
const DEV_JWT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODQ3NzcsImV4cCI6MjA4NjM2MDc3N30.FVWNOmyfcQ3HX77Uggwt45nRO9N9pox6gA4rzx8Hwqc';

async function checkConnection(name, url, key) {
    console.log(`\n--- Checking ${name} (JWT Key) ---`);
    try {
        const response = await fetch(`${url}/rest/v1/profiles?select=count`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            console.log(`✅ ${name} is accessible! Status: ${response.status}`);
        } else {
            console.log(`❌ ${name} returned error. Status: ${response.status}`);
            const body = await response.text();
            console.log(`Error body: ${body}`);
        }
    } catch (e) {
        console.log(`❌ ${name} fetch failed: ${e.message}`);
    }
}

checkConnection('DESENVOLVIMENTO', DEV_URL, DEV_JWT_KEY);
