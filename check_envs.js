
const DEV_URL = 'https://mozbwnrikotnrtrfifqn.supabase.co';
const DEV_KEY = 'sb_publishable_vJZLBOSWlrxe24AMv3svaA_LtK7URtT';

const PROD_URL = 'https://teuqygdmogjqpsdrtcow.supabase.co';
const PROD_KEY = 'sb_publishable_UlkcY1OMqDOlTnovgRGwlg_Jyxrayde';

async function checkConnection(name, url, key) {
    console.log(`\n--- Checking ${name} ---`);
    console.log(`URL: ${url}`);
    try {
        const response = await fetch(`${url}/rest/v1/?apikey=${key}`, {
            headers: { 'Authorization': `Bearer ${key}` }
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

async function run() {
    await checkConnection('DESENVOLVIMENTO', DEV_URL, DEV_KEY);
    await checkConnection('PRODUÇÃO', PROD_URL, PROD_KEY);
}

run();
