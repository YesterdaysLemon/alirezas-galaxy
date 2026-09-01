import { expect, test } from '@playwright/test';

async function openHydratedGalaxy(page: import('@playwright/test').Page) {
  await page.goto('/#galaxy');
  await expect(page.locator('#galaxy canvas')).toBeVisible();
}

test('all confirmed worlds are keyboard-selectable', async ({ page }) => {
  await openHydratedGalaxy(page);

  const worldNavigation = page.getByRole('navigation', {
    name: 'Website worlds',
  });
  const worlds = worldNavigation.getByRole('button');
  await expect(worlds).toHaveCount(10);

  const androidHell = worlds.filter({ hasText: 'Android Hell:' });
  await androidHell.focus();
  await expect(
    page.getByRole('button', { name: 'Inspect Android Hell' }),
  ).toBeAttached();
  await androidHell.press('Enter');

  await expect(
    page.getByRole('region', { name: 'Selected world: Android Hell' }),
  ).toBeAttached();
  await expect(
    page.getByRole('link', { name: 'Launch Android Hell' }),
  ).toHaveAttribute('href', 'https://androidhell.alirezaafshan.com');

  const conspiracy = worlds.filter({ hasText: 'Conspiracy:' });
  await conspiracy.focus();
  await conspiracy.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Selected world: Conspiracy' }),
  ).toBeAttached();
});

test('the close control does not jump on hover', async ({ page }) => {
  await openHydratedGalaxy(page);
  await page.getByRole('button', { name: 'Open galaxy settings' }).click();
  await page.getByRole('button', { name: /galactic drift/i }).click();
  const proofBonsai = page
    .getByRole('navigation', { name: 'Website worlds' })
    .getByRole('button')
    .filter({ hasText: 'Proof Bonsai:' });
  await proofBonsai.focus();
  await proofBonsai.press('Enter');

  const close = page.getByRole('button', { name: 'Close world details' });
  const detail = page.getByRole('region', {
    name: 'Selected world: Proof Bonsai',
  });
  await expect(close).toBeVisible();
  await page.waitForTimeout(2_000);
  const before = await close.boundingBox();
  const detailBefore = await detail.boundingBox();
  await page.mouse.move(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2,
  );
  await expect
    .poll(() => close.evaluate((element) => element.matches(':hover')))
    .toBe(true);
  await page.waitForTimeout(150);
  const after = await close.boundingBox();
  const detailAfter = await detail.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(detailBefore).not.toBeNull();
  expect(detailAfter).not.toBeNull();
  expect(
    Math.abs(after!.x - detailAfter!.x - (before!.x - detailBefore!.x)),
  ).toBeLessThan(0.5);
  expect(
    Math.abs(after!.y - detailAfter!.y - (before!.y - detailBefore!.y)),
  ).toBeLessThan(0.5);
});

test('the utility dock keeps its controls distinct and functional', async ({
  page,
}) => {
  await openHydratedGalaxy(page);
  await page.getByRole('button', { name: 'Open galaxy settings' }).click();

  const slider = page.getByRole('slider', { name: 'Galaxy core exposure' });
  await expect(slider).toHaveValue('0.92');

  const drift = page.getByRole('button', { name: /galactic drift/i });
  await expect(drift).toHaveAttribute('aria-pressed', 'true');
  await drift.click();
  await expect(drift).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Close galaxy settings' }).click();
  await expect(page.getByText('© Alireza Afshan · 2026')).toBeVisible();

  const transmissionControl = page.getByRole('button', {
    name: 'Show next footer transmission',
  });
  await transmissionControl.click();
  await expect(page.locator('output#dock-transmission')).toContainText('—');
  await transmissionControl.click();
  await expect(
    page.getByRole('link', { name: /Open Bartlett's Familiar Quotations/i }),
  ).toHaveAttribute('href', 'https://www.gutenberg.org/ebooks/27889');
});

test('the active menu item connects to the sidebar with a gold rail', async ({
  page,
}) => {
  await openHydratedGalaxy(page);
  const portfolio = page.getByRole('link', { name: 'Portfolio' });
  await portfolio.hover();
  await expect(portfolio).toHaveClass(/is-active/);

  const rail = await portfolio.evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return {
      left: Number.parseFloat(style.left),
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      background: style.backgroundImage,
    };
  });

  expect(rail.left).toBeLessThan(0);
  expect(rail.width).toBeGreaterThanOrEqual(7);
  expect(rail.height).toBeLessThanOrEqual(2);
  expect(rail.background).toContain('linear-gradient');

  const inactiveEdge = await page
    .getByRole('link', { name: 'Workshop' })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        topRight: style.borderTopRightRadius,
        bottomRight: style.borderBottomRightRadius,
      };
    });
  expect(inactiveEdge).toEqual({ topRight: '0px', bottomRight: '0px' });
});
