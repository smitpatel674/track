import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

export async function trackShipment(trackingNo) {
  const headless = process.env.HEADLESS !== 'false';
  const useSystemChrome = process.env.USE_SYSTEM_CHROME === '1';

  const browser = await chromium.launch({
    headless,
    ...(useSystemChrome ? { channel: 'chrome' } : {})
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    viewport: headless ? { width: 1440, height: 1000 } : null
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
  });

  try {
    await page.goto(`https://www.maersk.com/tracking/${trackingNo}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    try {
      const allowAllBtn = page.getByRole('button', { name: /allow all/i });
      await allowAllBtn.waitFor({ timeout: 8000 });
      await allowAllBtn.click();
      console.error('Cookies accepted');
    } catch {
      console.error('Cookie popup not found');
    }

    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Bill of Lading number') || text.includes('No results found');
      },
      { timeout: 60000 }
    );

    await page.waitForTimeout(5000);

    return await page.evaluate(() => {
      const text = document.body.innerText;

      return {
        billOfLading: text.match(/Bill of Lading number\s+(\d+)/)?.[1] || null,
        from: text.match(/From\s+([A-Z]+)/)?.[1] || null,
        to: text.match(/To\s+([A-Z]+)/)?.[1] || null,
        container: text.match(/([A-Z]{4}\d{7})\s+\|\s+([^\n]+)/)?.[1] || null,
        containerType: text.match(/[A-Z]{4}\d{7}\s+\|\s+([^\n]+)/)?.[1] || null,
        eta:
          text.match(/Estimated arrival date\s+([\s\S]*?)Latest event/)?.[1]?.trim() ||
          null,
        latestEvent: text.match(/Latest event\s+([^\n]+)/)?.[1] || null,
        lastUpdated: text.match(/Last updated:\s*([^\n]+)/)?.[1] || null
      };
    });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const trackingNo = process.argv[2] || process.env.TRACKING_NO || '269868197';
  const data = await trackShipment(trackingNo);
  console.log(JSON.stringify(data, null, 2));
}
