import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { unzipSync } from 'fflate';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
let currentPage;
try {
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    currentPage = page;
    await page.goto(process.env.IMAGE_DESK_URL || 'http://127.0.0.1:5175/');
    await page.getByRole('button', { name: 'Load sample', exact: true }).click();
    await page.getByRole('button', { name: 'Process images', exact: true }).click();
    await expect(page.locator('.stage-caption')).toContainText('1600 × 1067');
    await expect(page.locator('.stage-caption')).toContainText('Processed');
    expect(
      await page.locator('.image-details').evaluate((e) => e.scrollHeight <= e.clientHeight),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
    const files = unzipSync(await readFile(await (await pending).path()));
    expect(Object.keys(files)).toEqual(['01-sample-landscape-web.webp']);
    const image = files['01-sample-landscape-web.webp'];
    expect(new TextDecoder().decode(image.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(image.slice(8, 12))).toBe('WEBP');
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    if (width === 1280) {
      await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 24;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'pasted.png', { type: 'image/png' }));
        window.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: transfer, cancelable: true }),
        );
      });
      await expect(page.locator('.image-card')).toHaveCount(2);
      await page.getByRole('button', { name: 'Process images', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Download pasted.png', exact: true }),
      ).toBeVisible();
    }
    console.log(
      `PASS Image Desk ${width}×${height}: real Canvas conversion, dimensions, ZIP and accessibility.`,
    );
    await context.close();
  }
} catch (error) {
  await mkdir('test-results', { recursive: true });
  await currentPage?.screenshot({ path: 'test-results/workspace.png' });
  throw error;
} finally {
  await browser.close();
}
