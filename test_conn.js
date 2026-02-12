
const url = 'https://mozbwnrikotnrtrfifqn.supabase.co/rest/v1/';
const key = 'sb_publishable_vJZLBOSWlrxe24AMv3svaA_LtK7URtT';

async function test() {
    console.log('Testing connection to Supabase...');
    try {
        const response = await fetch(url + 'profiles?select=*&limit=1', {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        console.log('Status:', response.status);
        if (response.status === 401) {
            const body = await response.text();
            console.log('Error Body:', body);
        } else {
            console.log('Connection successful or different error.');
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

test();
