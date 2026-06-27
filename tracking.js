import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

async function clearCookieOverlay(page) {
  const acceptButtons = [
    page.getByRole('button', { name: /allow all/i }),
    page.getByRole('button', { name: /accept all/i }),
    page.getByRole('button', { name: /^accept$/i }),
    page.getByText('Allow all', { exact: true }),
    page.getByText('Accept all', { exact: true }),
    page.locator('#coiPage-1 button').filter({ hasText: /allow|accept/i }).first(),
    page.locator('#coiOverlay button').filter({ hasText: /allow|accept/i }).first(),
    page.locator('button').filter({ hasText: /allow all|accept all|accept/i }).last()
  ];

  for (const button of acceptButtons) {
    try {
      await button.click({ timeout: 3000, force: true });
      await page.locator('#coiOverlay').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      console.error('Cookies accepted');
      return;
    } catch {
      // Try the next consent button shape.
    }
  }

  const removedOverlay = await page.evaluate(() => {
    const selectors = [
      '#coiOverlay',
      '#cookie-information-template-wrapper',
      '[id*="cookie" i]',
      '[class*="cookie" i]'
    ];

    let removed = false;
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        element.remove();
        removed = true;
      }
    }

    document.body.style.overflow = 'auto';
    return removed;
  });

  console.error(removedOverlay ? 'Cookie overlay removed' : 'Cookie popup not found');
}

async function clickTrackButton(page) {
  const trackButton = page.getByRole('button', { name: /^track$/i });

  try {
    await trackButton.click({ timeout: 10000 });
  } catch (error) {
    if (!String(error.message).includes('intercepts pointer events')) {
      throw error;
    }

    console.error('Cookie overlay blocked Track button; clearing and retrying');
    await clearCookieOverlay(page);
    await trackButton.click({ timeout: 10000 });
  }
}

export async function trackShipment(trackingNo, options = {}) {
  const headless = process.env.HEADLESS !== 'false';
  const useSystemChrome = process.env.USE_SYSTEM_CHROME === '1';
  const debug = options.debug || process.env.SCRAPER_DEBUG === '1';

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

    await clearCookieOverlay(page);

    await page.getByRole('textbox').first().fill(trackingNo);
    await clearCookieOverlay(page);
    await clickTrackButton(page);

    await page.waitForFunction(
      (expectedTrackingNo) => {
        const text = document.body.innerText;
        return (
          text.includes(`Bill of Lading number\n${expectedTrackingNo}`) ||
          text.includes(`Bill of Lading number ${expectedTrackingNo}`) ||
          text.includes("We couldn't find any Bills of Lading or containers")
        );
      },
      trackingNo,
      { timeout: 60000 }
    );

    await page.waitForTimeout(5000);

    const result = await page.evaluate((includeDebug) => {
      const text = document.body.innerText;
      const noResults = /No results found/i.test(text);
      const latestEvent =
        text.match(/Latest event\s+([^\n]+)/)?.[1] ||
        text.match(/Last updated:\s*[^\n]+\s+([^.\n]+?•[^\n]+?)\s+Note:/)?.[1]?.trim() ||
        null;
      const eta =
        text.match(/Estimated arrival date\s+([\s\S]*?)Latest event/)?.[1]?.trim() ||
        [...text.matchAll(/Vessel arrival[^\n]*?\s+(\d{2}\s+[A-Z][a-z]{2}\s+\d{4}\s+\d{2}:\d{2})/g)]
          .at(-1)?.[1] ||
        null;
      const data = {
        found: !noResults,
        billOfLading: text.match(/Bill of Lading number\s+(\d+)/)?.[1] || null,
        from: text.match(/From\s+([A-Z]+)/)?.[1] || null,
        to: text.match(/To\s+([A-Z]+)/)?.[1] || null,
        container: text.match(/([A-Z]{4}\d{7})\s+\|\s+([^\n]+)/)?.[1] || null,
        containerType: text.match(/[A-Z]{4}\d{7}\s+\|\s+([^\n]+)/)?.[1] || null,
        eta,
        latestEvent,
        lastUpdated: text.match(/Last updated:\s*([^\n]+)/)?.[1] || null,
        message: noResults
          ? "Maersk returned no public tracking results for this reference."
          : null
      };

      if (!includeDebug) {
        return data;
      }

      return {
        ...data,
        debug: {
          title: document.title,
          url: location.href,
          textSample: text.replace(/\s+/g, ' ').trim().slice(0, 2500)
        }
      };
    }, debug);

    return result;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const trackingNo = process.argv[2] || process.env.TRACKING_NO || '269868197';
  const data = await trackShipment(trackingNo);
  console.log(JSON.stringify(data, null, 2));
}
