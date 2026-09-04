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

  test(`travel swaps galaxies and their selectable stars at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const shell = page.locator('#galaxy');
    const canvas = page.locator('[data-galaxy-canvas]');
    await expect(canvas).toBeVisible();
    await canvas.evaluate((element) =>
      element.setAttribute('data-scene-instance', 'original'),
    );
    await expect(shell).toHaveAttribute('data-arms', '5');
    const portal = page.getByRole('button', { name: 'Travel to the web ring' });
    // A tap on the pulsing star itself starts the journey.
    await portal.locator('.galaxy-signal').click();
    await expect(shell).toHaveAttribute('data-travelling', 'true');
    await expect(shell).toHaveAttribute('data-galaxy', 'webring');
    await expect(shell).toHaveAttribute('data-travelling', 'false');
    await expect(shell).toHaveAttribute('data-arms', '3');
    await expect(
      page.getByRole('button', { name: 'Return to my galaxy' }),
    ).toBeFocused();
    await expect(canvas).toHaveAttribute('data-scene-instance', 'original');
    const worlds = page.getByRole('navigation', { name: 'Website worlds' });
    await expect(
      worlds.getByRole('button', { name: /Alireza Afshan/ }),
    ).toHaveCount(0);
    const neighbor = worlds.getByRole('button', { name: /Learn2Design/ });
    await neighbor.focus();
    await neighbor.press('Enter');
    await expect(
      page.getByRole('region', { name: 'Selected world: Learn2Design' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Launch Learn2Design' }),
    ).toHaveAttribute('href', 'https://www.learn2design2026.com/');
    await expect(
      page.getByRole('link', { name: 'Launch Learn2Design' }),
    ).toHaveAttribute('target', '_blank');
    // Return works even with a neighbor's details open.
    await page
      .getByRole('button', { name: 'Return to my galaxy' })
      .locator('.webring-portal-label')
      .click();
    await expect(shell).toHaveAttribute('data-galaxy', 'home');
    await expect(shell).toHaveAttribute('data-travelling', 'false');
    await expect(shell).toHaveAttribute('data-arms', '5');
    await expect(
      page.getByRole('button', { name: 'Travel to the web ring' }),
    ).toBeFocused();
    await expect(
      worlds.getByRole('button', { name: /Alireza Afshan/ }),
    ).toHaveCount(1);
    await expect(
      worlds.getByRole('button', { name: /Learn2Design/ }),
    ).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-scene-instance', 'original');
  });
}

test('browser Back and direct links navigate the galaxies', async ({
  page,
}) => {
  await page.goto('/#webring');
  const shell = page.locator('#galaxy');
  await expect(shell).toHaveAttribute('data-galaxy', 'webring');
  await expect(shell).toHaveAttribute('data-travelling', 'false');
  await page
    .getByRole('button', { name: 'Return to my galaxy' })
    .locator('.webring-portal-label')
    .click();
  await expect(shell).toHaveAttribute('data-travelling', 'false');
  await expect(shell).toHaveAttribute('data-galaxy', 'home');
  await page.goBack();
  await expect(shell).toHaveAttribute('data-galaxy', 'webring');
  await expect(shell).toHaveAttribute('data-travelling', 'false');
  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-galaxy', 'home');
  await expect(shell).toHaveAttribute('data-travelling', 'false');
});

test('pinch zoom does not accidentally select a world or switch galaxies', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const stage = page.locator('[data-galaxy-stage]');
  await expect(stage).toHaveAttribute('data-camera-distance', /\d/);
  const before = Number(await stage.getAttribute('data-camera-distance'));
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 120, y: 410, id: 0 },
      { x: 220, y: 410, id: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 70, y: 410, id: 0 },
      { x: 270, y: 410, id: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(async () => Number(await stage.getAttribute('data-camera-distance')))
    .toBeLessThan(before - 2);
  await expect(page.locator('#galaxy')).toHaveAttribute('data-galaxy', 'home');
  await expect(page.locator('.world-detail')).toHaveCount(0);
  await session.detach();
});
