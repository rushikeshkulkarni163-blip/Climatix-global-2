const { chromium } = require('playwright');

(async () => {
  const token = require('fs').readFileSync('/tmp/dev_jwt.txt', 'utf8').trim();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addCookies([{
    name: 'cx_access',
    value: token,
    domain: 'localhost',
    path: '/',
  }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/dashboard-full.png', fullPage: true });
  console.log('Saved full dashboard screenshot');
  console.log('Console/page errors:', JSON.stringify(errors, null, 2));

  await page.goto('http://localhost:3000/dashboard/companies/acme-industrial', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/dashboard-company.png', fullPage: true });
  console.log('Saved company profile screenshot');

  await browser.close();
})();
