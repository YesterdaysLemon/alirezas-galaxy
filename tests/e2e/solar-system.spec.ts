import { expect, test } from '@playwright/test';

test('galaxy to system to planet and back keeps one canvas and working project links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#galaxy');
  const entry = page.getByRole('button', {
    name: 'Enter Patterns and Life solar system',
  });
  await expect(entry).toBeEnabled();
  await entry.click();
  const stage = page.locator('[data-galaxy-stage]');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Explore Plato', exact: true })
    .click();
  await expect(stage).toHaveAttribute('data-solar-phase', 'planet');
  await expect(
    page.getByRole('article', { name: 'Planet: Plato' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visit Plato' })).toHaveAttribute(
    'href',
    'https://plato.alirezaafshan.com',
  );
  await expect(page.getByRole('link', { name: 'Visit Plato' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('article', { name: 'Planet: Proof Bonsai' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Explore Nacre', exact: true })
    .click();
  await expect(
    page.getByRole('article', { name: 'Planet: Nacre' }),
  ).toContainText('Uninhabited');
  await expect(
    page.getByRole('article', { name: 'Planet: Nacre' }).getByRole('link'),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
  await expect(entry).toBeVisible();
  await expect(page.locator('canvas[data-galaxy-canvas]')).toHaveCount(1);
  await page.getByRole('button', { name: 'about', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('deep links, history, narrow controls, and reduced motion complete the same journey', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#galaxy');
  await page
    .getByRole('button', { name: 'Enter Patterns and Life solar system' })
    .click();
  const stage = page.locator('[data-galaxy-stage]');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page
    .getByRole('button', { name: 'Explore Aquarium', exact: true })
    .click();
  const inspector = page.getByRole('article', { name: 'Planet: Aquarium' });
  await expect(inspector).toBeVisible();
  const bounds = await inspector.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.goBack();
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
  await page.goForward();
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.reload();
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.getByRole('button', { name: 'Return to the galaxy' }).click();
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
});
