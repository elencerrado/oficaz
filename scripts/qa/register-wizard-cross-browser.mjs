import { chromium, firefox, webkit, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:5000';
const REGISTER_URL = `${BASE_URL}/register?token=qa-token&email=qa%40example.com`;

const browserMatrix = [
  { name: 'chromium-desktop', type: chromium, context: { viewport: { width: 1366, height: 900 } } },
  { name: 'firefox-desktop', type: firefox, context: { viewport: { width: 1366, height: 900 } } },
  { name: 'webkit-desktop', type: webkit, context: { viewport: { width: 1366, height: 900 } } },
  {
    name: 'chromium-mobile-iphone12',
    type: chromium,
    context: {
      ...devices['iPhone 12'],
      viewport: devices['iPhone 12'].viewport,
    },
  },
];

const report = [];

function todayStamp() {
  const now = new Date();
  const p = (n) => `${n}`.padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

async function ensureInteractable(page, locator, name) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ trial: true, timeout: 15000 });
  } catch {
    throw new Error(`${name} is not interactable`);
  }
}

async function dismissCookieBannerIfPresent(page) {
  const acceptAllButton = page.getByRole('button', { name: /Aceptar Todas/i });
  if (await acceptAllButton.isVisible().catch(() => false)) {
    await acceptAllButton.click();
    await page.waitForTimeout(300);
  }
}

async function checkNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });

  if (hasOverflow) {
    throw new Error('Detected horizontal overflow on page');
  }
}

async function runWizardChecks(page) {
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissCookieBannerIfPresent(page);

  const startButton = page.getByTestId('button-start-wizard').or(page.getByRole('button', { name: /^Avanzar$/i }));
  await ensureInteractable(page, startButton, 'Start wizard button');
  await startButton.click();

  const step1Continue = page.getByTestId('button-step1-continue');
  await ensureInteractable(page, step1Continue, 'Step 1 continue');
  await checkNoHorizontalOverflow(page);

  await step1Continue.click();

  const step2Continue = page.getByTestId('button-step2-continue');
  await ensureInteractable(page, step2Continue, 'Step 2 continue');
  await page.getByText('OficazIA').first().waitFor({ state: 'visible', timeout: 10000 });
  await checkNoHorizontalOverflow(page);

  await step2Continue.click();

  await page.locator('#companyName').fill('QA Empresa Cross Browser SL');
  await page.locator('#cif').fill('B12345678');
  await page.locator('#companyEmail').fill('qa.cross.browser@example.com');
  await page.locator('#companyAlias').fill(`qa-cross-${Date.now().toString().slice(-6)}`);

  const provinceSelect = page.locator('form [role="combobox"]').first();
  await ensureInteractable(page, provinceSelect, 'Province selector');
  await provinceSelect.click();
  await page.getByRole('option', { name: 'Madrid' }).click();

  const step3Continue = page.getByTestId('button-step3-continue');
  await ensureInteractable(page, step3Continue, 'Step 3 continue');
  await checkNoHorizontalOverflow(page);
  await step3Continue.click();

  await page.locator('#adminFullName').fill('QA Admin');
  await page.locator('#adminDni').fill(`1234567${Math.floor(Math.random() * 10)}A`);
  await page.locator('#adminEmail').fill(`qa.admin.${Date.now()}@example.com`);
  await page.locator('#adminPhone').fill('666777888');
  await page.locator('#password').fill('Qa123456!');
  await page.locator('#confirmPassword').fill('Qa123456!');

  const sameAsAdminCheckbox = page.locator('#sameAsAdmin');
  await sameAsAdminCheckbox.uncheck();

  const contactName = page.locator('#contactName');
  const contactPhone = page.locator('#contactPhone');
  const contactEmail = page.locator('#contactEmail');

  await ensureInteractable(page, contactName, 'Contact name field');
  await ensureInteractable(page, contactPhone, 'Contact phone field');
  await ensureInteractable(page, contactEmail, 'Contact email field');

  await contactName.fill('Contacto QA');
  await contactPhone.fill('611222333');
  await contactEmail.fill(`qa.contact.${Date.now()}@example.com`);

  const step4Continue = page.getByTestId('button-step4-continue');
  await ensureInteractable(page, step4Continue, 'Step 4 continue');
  await checkNoHorizontalOverflow(page);
  await step4Continue.click();

  await page.getByText('Este es tu plan perfecto', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });

  const promoField = page.locator('#promotionalCode');
  await ensureInteractable(page, promoField, 'Promotional code field');

  const acceptTerms = page.locator('#acceptTerms');
  await ensureInteractable(page, acceptTerms, 'Accept terms checkbox');

  await checkNoHorizontalOverflow(page);
}

async function run() {
  const outDir = path.join(process.cwd(), 'test-results', 'wizard-cross-browser');
  await fs.mkdir(outDir, { recursive: true });

  for (const config of browserMatrix) {
    const entry = { browser: config.name, ok: false, error: null, screenshot: null };

    let browser;
    try {
      browser = await config.type.launch({ headless: true });
      const context = await browser.newContext(config.context);
      const page = await context.newPage();

      await runWizardChecks(page);

      const screenshotPath = path.join(outDir, `${config.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      entry.ok = true;
      entry.screenshot = screenshotPath;

      await context.close();
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      try {
        if (browser) {
          const context = browser.contexts()[0];
          const page = context?.pages?.()[0];
          if (page) {
            const screenshotPath = path.join(outDir, `${config.name}-failed.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            entry.screenshot = screenshotPath;
          }
        }
      } catch {
        // Ignore screenshot failures in failure handler
      }
    } finally {
      if (browser) {
        await browser.close();
      }
      report.push(entry);
    }
  }

  const stamp = todayStamp();
  const reportPath = path.join(outDir, `report-${stamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ baseUrl: BASE_URL, registerUrl: REGISTER_URL, report }, null, 2), 'utf8');

  console.log(`Report written to ${reportPath}`);

  const failed = report.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('Some browser checks failed:');
    for (const f of failed) {
      console.error(`- ${f.browser}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log('All browser checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
