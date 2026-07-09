import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("assets/images/cases/previews");

const JOBS = [
  {
    id: "w4d",
    pages: [
      { name: "01-home", url: "https://whts4dinner.com/" },
      { name: "02-search", url: "https://whts4dinner.com/" },
      { name: "03-mobile", url: "https://whts4dinner.com/", mobile: true },
    ],
  },
  {
    id: "quote",
    pages: [
      { name: "01-home", url: "https://quote-pilot-ai.vercel.app/" },
      { name: "02-features", url: "https://quote-pilot-ai.vercel.app/features" },
      { name: "03-pricing", url: "https://quote-pilot-ai.vercel.app/pricing" },
    ],
  },
  {
    id: "forge",
    pages: [
      { name: "01-home", url: "https://forgequest-ai-web.vercel.app/" },
      { name: "02-scroll", url: "https://forgequest-ai-web.vercel.app/", scroll: 700 },
      { name: "03-mobile", url: "https://forgequest-ai-web.vercel.app/", mobile: true },
    ],
  },
  {
    id: "storiq",
    pages: [
      { name: "01-home", url: "https://storiq-location-seo-builder.vercel.app/" },
      { name: "02-scroll", url: "https://storiq-location-seo-builder.vercel.app/", scroll: 600 },
      { name: "03-mobile", url: "https://storiq-location-seo-builder.vercel.app/", mobile: true },
    ],
  },
  {
    id: "canteen",
    pages: [
      { name: "01-home", url: "https://mini-sme-elizes-canteen.vercel.app/" },
      { name: "02-scroll", url: "https://mini-sme-elizes-canteen.vercel.app/", scroll: 500 },
      { name: "03-mobile", url: "https://mini-sme-elizes-canteen.vercel.app/", mobile: true },
    ],
  },
  {
    id: "will",
    pages: [
      { name: "01-home", url: "https://mvp-tool-will-form-generator.vercel.app/" },
      { name: "02-scroll", url: "https://mvp-tool-will-form-generator.vercel.app/", scroll: 500 },
      { name: "03-mobile", url: "https://mvp-tool-will-form-generator.vercel.app/", mobile: true },
    ],
  },
];

async function shot(browser, jobId, pageCfg) {
  const context = await browser.newContext(
    pageCfg.mobile
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        }
      : {
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        }
  );
  const page = await context.newPage();
  const outDir = path.join(OUT, jobId);
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${pageCfg.name}.jpg`);

  try {
    await page.goto(pageCfg.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
    if (pageCfg.scroll) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), pageCfg.scroll);
      await page.waitForTimeout(600);
    }
    // Dismiss common cookie/consent banners if present
    for (const sel of [
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("I agree")',
      '[aria-label="Close"]',
    ]) {
      const btn = page.locator(sel).first();
      if (await btn.count()) {
        try { await btn.click({ timeout: 800 }); } catch {}
      }
    }
    await page.screenshot({ path: file, type: "jpeg", quality: 82, fullPage: false });
    console.log("OK", file);
  } catch (err) {
    console.error("FAIL", jobId, pageCfg.name, err.message);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const job of JOBS) {
    for (const pageCfg of job.pages) {
      await shot(browser, job.id, pageCfg);
    }
  }
} finally {
  await browser.close();
}
console.log("Done.");
