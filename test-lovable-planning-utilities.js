const puppeteer = require('puppeteer');
const fs = require('fs');

const LOVABLE_URL = 'http://192.168.1.42:8080/ui/gtn750xi-react/';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 720 });

    console.log('🧪 Testing Lovable Planning Utilities\n');

    await page.goto(LOVABLE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#root');

    const utilities = ['VCALC', 'TRIP', 'DALT', 'FUEL', 'CHKL'];

    for (const util of utilities) {
        console.log(`\nTesting ${util}...`);

        const clicked = await page.evaluate((tabName) => {
            const tabs = Array.from(document.querySelectorAll('button'));
            const tab = tabs.find(t => t.textContent?.includes(tabName));
            if (tab) {
                tab.click();
                return true;
            }
            return false;
        }, util);

        if (!clicked) {
            console.log(`  ❌ Tab not found: ${util}`);
            continue;
        }

        await new Promise(r => setTimeout(r, 1000));

        const screenshot = `lovable-screenshots/util-${util.toLowerCase()}.png`;
        await page.screenshot({ path: screenshot });
        console.log(`  ✅ Screenshot: ${screenshot}`);

        const content = await page.evaluate(() => document.body.textContent);
        console.log(`  Content preview: ${content.substring(0, 150)}...`);
    }

    await browser.close();
    console.log('\n✅ All Planning utility screenshots captured!');
    console.log('Check ./lovable-screenshots/ for results.');
})();
