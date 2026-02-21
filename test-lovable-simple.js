const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 720 });

    console.log('Loading Lovable UI...');
    await page.goto('http://192.168.1.42:8080/ui/gtn750xi-react/', {
        waitUntil: 'networkidle0',
        timeout: 30000
    });

    console.log('Waiting for React to mount...');
    await page.waitForSelector('#root', { timeout: 10000 });

    console.log('Taking screenshot...');
    await page.screenshot({ path: './lovable-test.png', fullPage: true });

    console.log('Checking for content...');
    const bodyText = await page.evaluate(() => document.body.textContent);
    console.log('Body has content:', bodyText.length > 100 ? '✅' : '❌ Blank');
    console.log('First 200 chars:', bodyText.substring(0, 200));

    await browser.close();
    console.log('\n✅ Screenshot saved: lovable-test.png');
})();
