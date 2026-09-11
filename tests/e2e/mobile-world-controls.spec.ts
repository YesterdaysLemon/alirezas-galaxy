import { expect, test } from '@playwright/test';
import { destinations } from '../../data/worlds';
import { webring } from '../../data/webring';

async function settleDetail(page: import('@playwright/test').Page) {
  await expect
    .poll(() =>
      page
        .locator('.world-detail:not([data-phase="leaving"])')
        .evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter(
                (animation) =>
                  animation.playState === 'running' &&
                  animation.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
    )
    .toBe(0);
}

test.use({
  viewport: { width: 430, height: 760 },
  hasTouch: true,
  isMobile: true,
});

test('the dock advances through inspected worlds and resumes spinning when closed', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-galaxy-canvas]')).toBeVisible();
  const dock = page.locator('.dock-orb');
  await expect(dock).toHaveAttribute('data-action', 'spin');
  await page.getByRole('button', { name: 'about', exact: true }).tap();
  await expect(dock).toHaveAttribute('data-action', 'next');
  await expect(dock.locator('[data-icon="next-world"]')).toBeVisible();
  await expect(page.locator('.world-detail')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: `output/playwright/iphone-world-card-${browserName}.png`,
  });
  for (let index = 1; index <= destinations.length; index += 1) {
    await dock.tap();
    await expect(
      page.locator('.world-detail:not([data-phase="leaving"])'),
    ).toHaveAttribute(
      'data-world-id',
      destinations[index % destinations.length].id,
    );
  }
  await expect(page.locator('[data-galaxy-stage]')).toHaveAttribute(
    'data-portrait-bursts',
    '0',
  );
  await page.getByRole('button', { name: 'Close world details' }).tap();
  await expect(dock).toHaveAttribute('data-action', 'spin');
  await expect(dock).toHaveAttribute('aria-label', 'Spin the galaxy faster');
  await expect(dock.locator('img')).toBeVisible();
  for (let press = 0; press < 7; press += 1) await dock.tap();
  await expect(page.locator('[data-galaxy-stage]')).toHaveAttribute(
    'data-portrait-bursts',
    '1',
  );
});

test('the two-neighbor web ring offers a working next-world action', async ({
  page,
}) => {
  await page.goto('/#webring');
  await expect(page.locator('#galaxy')).toHaveAttribute(
    'data-galaxy',
    'webring',
  );
  await expect(page.locator('#galaxy')).toHaveAttribute(
    'data-travelling',
    'false',
  );
  await page
    .getByRole('button', { name: 'random neighbor', exact: true })
    .tap();
  const detail = page.locator('.world-detail:not([data-phase="leaving"])');
  const currentId = await detail.getAttribute('data-world-id');
  const next =
    webring[
      (webring.findIndex((world) => world.id === currentId) + 1) %
        webring.length
    ];
  await expect(page.locator('.dock-orb')).toBeEnabled();
  await expect(page.locator('.dock-orb')).toHaveAttribute(
    'aria-label',
    `Next world: ${next.name}`,
  );
  await page.locator('.dock-orb').tap();
  await expect(detail).toHaveAttribute('data-world-id', next.id);
  await page.getByRole('button', { name: 'Close world details' }).tap();
  await expect(page.locator('.dock-orb')).toBeEnabled();
  await expect(page.locator('.dock-orb')).toHaveAttribute(
    'data-action',
    'spin',
  );
});

test('mobile details fit their content above the toolbar as the viewport changes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-galaxy-canvas]')).toBeVisible();
  await page.getByRole('button', { name: 'about', exact: true }).tap();
  const detail = page.locator('.world-detail');
  await expect(detail).toHaveCSS('opacity', '1');
  await settleDetail(page);
  // Keep the portrait/message compact independently of the reply count.
  const repliesHeight = (await detail.locator('.world-replies').boundingBox())!
    .height;
  expect(
    (await detail.boundingBox())!.height - repliesHeight,
  ).toBeLessThanOrEqual(150);
  for (const viewport of [
    { width: 430, height: 760 },
    { width: 430, height: 630 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const box = await detail.boundingBox();
        const dock = await page.locator('.spore-dock').boundingBox();
        return (
          !!box &&
          !!dock &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= dock.y
        );
      })
      .toBe(true);
    const launch = detail.getByRole('link', { name: 'Launch Alireza Afshan' });
    expect((await launch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      (await detail
        .getByRole('button', { name: 'Close world details' })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    // Decorative casing extends over the border; the actual text must fit
    // inside the screen without clipping.
    expect(
      await detail.locator('.world-detail-wing').evaluate((element) => {
        const screen = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll('p, .world-address')).every(
          (text) => {
            const box = text.getBoundingClientRect();
            return (
              box.left >= screen.left &&
              box.right <= screen.right &&
              box.top >= screen.top &&
              box.bottom <= screen.bottom
            );
          },
        );
      }),
    ).toBe(true);
  }
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#06101f',
  );
});
