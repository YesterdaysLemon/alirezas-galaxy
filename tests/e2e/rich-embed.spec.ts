import { expect, test } from '@playwright/test';

test('compact galaxy visits a real project in the same scene and keeps its full-site address', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/embed');
  const canvas = page.locator('canvas[data-galaxy-canvas]');
  await expect(canvas).toBeVisible();
  const original = await canvas.elementHandle();
  await expect(
    page.getByRole('button', { name: 'Resume motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByLabel('Choose a star system')
    .selectOption('patterns-and-life');
  await expect(page.getByLabel('Choose a world')).toBeEnabled({
    timeout: 15_000,
  });
  await page.getByLabel('Choose a world').selectOption({ label: 'Aquarium' });
  await expect(
    page.getByRole('link', { name: 'Visit Aquarium', exact: true }),
  ).toHaveAttribute('href', 'https://fish.alirezaafshan.com');
  await expect(
    page.getByRole('link', { name: 'Open full galaxy' }),
  ).toHaveAttribute('href', /\/#system\/patterns-and-life\/aquarium$/);
  expect(
    await canvas.evaluate(
      (element, previous) => element === previous,
      original,
    ),
  ).toBe(true);
  await expect(canvas).toHaveCount(1);
  await page.getByRole('button', { name: 'Return to the galaxy' }).click();
  await expect(page.getByLabel('Choose a star system')).toBeEnabled({
    timeout: 10_000,
  });
  await expect(
    page.getByRole('button', { name: 'Resume motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('compact controls fit small cards and retain useful targets', async ({
  page,
}) => {
  await page.goto('/embed');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toBeVisible();
  for (const [width, height] of [
    [640, 480],
    [320, 240],
    [320, 320],
    [390, 650],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      boxes: [
        ...document.querySelectorAll(
          '.galaxy-embed-header button,.galaxy-embed-header a,.galaxy-embed-actions button,.galaxy-embed-actions select',
        ),
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        };
      }),
    }));
    expect(layout.width).toBe(width);
    expect(layout.height).toBe(height);
    for (const box of layout.boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.bottom).toBeLessThanOrEqual(height);
    }
  }
});

test('compact route remains a useful catalog without WebGL', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // oxlint-disable-next-line typescript/unbound-method -- Reapplied below to the receiving canvas.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      name: string,
      ...args: unknown[]
    ) {
      if (name.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [name, ...args]);
    } as typeof original;
  });
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto('/embed');
  const catalog = page.locator('div > .noscript-catalog');
  await expect(catalog).toBeVisible();
  await expect(
    catalog.getByRole('link', { name: 'Aquarium', exact: true }),
  ).toHaveAttribute('href', 'https://fish.alirezaafshan.com');
  await expect(page.getByLabel('Choose a star system')).toBeDisabled();
  await expect(
    page.getByRole('link', { name: 'Open full galaxy' }),
  ).toBeVisible();
});
