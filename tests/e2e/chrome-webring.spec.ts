import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

test('a quiet star has a finger-sized hit target on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const orbit = page.locator('.world-preview-orbit');
  await expect(orbit).toBeVisible();
  await expect(page.locator('.world-preview')).toHaveCSS('opacity', '1');
  const box = (await orbit.boundingBox())!;
  // Hide only the preview chrome so this tap exercises the canvas picker.
  // A 22 px offset is well beyond the tiny core of a distant star.
  await page.addStyleTag({
    content: '.world-preview { visibility: hidden !important; }',
  });
  await page.touchscreen.tap(
    box.x + box.width / 2,
    box.y + box.height / 2 + 22,
  );
  await expect(
    page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`transparent chrome passes clicks through at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const canvas = page.locator('[data-galaxy-canvas]');
    await expect(canvas).toBeVisible();
    await canvas.evaluate((element) => {
      element.addEventListener('pointerdown', () => {
        element.setAttribute('data-received-pointer', 'yes');
      });
    });
    // This lies inside the large corner rectangle, below its actual buttons.
    const corner = await page.locator('.spore-corner').boundingBox();
    const x = corner!.x + corner!.width - 16;
    const y = corner!.y + corner!.height - 16;
    await expect
      .poll(() =>
        page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.hasAttribute('data-galaxy-canvas'),
          { x, y },
        ),
      )
      .toBe(true);
    await page.mouse.click(x, y);
    await expect(canvas).toHaveAttribute('data-received-pointer', 'yes');

    // The empty region of the footer rectangle should also pass through.
    const dock = await page.locator('.spore-dock').boundingBox();
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.hasAttribute('data-galaxy-canvas'),
        { x: dock!.x + 100, y: dock!.y + 1 },
      ),
    ).toBe(true);

    await page.getByRole('button', { name: 'about', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
    ).toBeVisible();
    const close = page.getByRole('button', { name: 'Close world details' });
    await expect(close).toBeVisible();
    await page.locator('.world-detail').evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    const closeBox = (await close.boundingBox())!;
    await page.mouse.move(
      closeBox.x + closeBox.width / 2,
      closeBox.y + closeBox.height / 2,
    );
    await close.click();
    await expect(
      page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
    ).not.toBeAttached();
    if (viewport.width <= 720 || viewport.height <= 500) {
      for (const control of [
        page.getByRole('button', { name: 'random world', exact: true }),
        page.getByRole('button', { name: 'Show next footer transmission' }),
      ]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(
          44,
        );
      }
      expect(
        await page
          .locator('#galaxy')
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBe(viewport.height);
    }
  });

  test(`web ring opens, distinguishes neighbors, and returns focus at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('[data-galaxy-canvas]')).toBeVisible();
    const portal = page.getByRole('button', { name: 'Explore the web ring' });
    await portal.locator('.webring-portal-label').click();
    await expect(portal).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('dialog', { name: 'a little web ring' });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('link', { name: /Learn2Design/ }),
    ).toHaveAttribute('href', 'https://www.learn2design2026.com/');
    await expect(
      panel.getByRole('link', { name: /Learn2Design/ }),
    ).toHaveAttribute('target', '_blank');
    await expect(
      page
        .getByRole('navigation', { name: 'Website worlds' })
        .getByRole('button', { name: /Learn2Design/ }),
    ).toHaveCount(0);
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height - 70);
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeAttached();
    await expect(portal).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Close web ring' }).click();
    await expect(portal).toBeFocused();
  });
}
