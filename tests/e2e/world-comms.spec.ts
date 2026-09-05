import { expect, test } from '@playwright/test';

test('hover identifies a project; selecting opens its message and verified replies', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-galaxy-canvas]')).toBeVisible();
  const preview = page.getByRole('button', { name: 'Inspect Alireza Afshan' });
  await expect(preview).toHaveCSS('opacity', '1');
  await expect(preview.locator('.world-preview-address')).toHaveText(
    'portfolio.alirezaafshan.com',
  );
  await expect(page.locator('.world-replies')).toHaveCount(0);
  // The hover console deliberately follows an orbiting star. Aim and click
  // like a person instead of waiting for an animated target to stop moving.
  const target = (await preview
    .locator('.world-preview-screen')
    .boundingBox())!;
  await page.mouse.click(
    target.x + target.width / 2,
    target.y + target.height / 2,
  );
  const panel = page.getByRole('region', {
    name: 'Selected world: Alireza Afshan',
  });
  await expect(
    panel.getByText('Hi, I’m Alireza.', { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByRole('link', { name: 'Launch Alireza Afshan' }),
  ).toHaveAttribute('href', 'https://portfolio.alirezaafshan.com');
  await expect(
    panel.getByRole('link', { name: /View source for Alireza Afshan/ }),
  ).toHaveAttribute('href', 'https://github.com/YesterdaysLemon/website');
  await expect(
    panel.getByRole('link', { name: /View source/ }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Close world details' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
});

test('projects with private repositories do not advertise a source reply', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-galaxy-canvas]')).toBeVisible();
  const world = page
    .getByRole('navigation', { name: 'Website worlds' })
    .getByRole('button', { name: /^Android Hell:/ });
  await world.focus();
  await world.press('Enter');
  const panel = page.getByRole('region', {
    name: 'Selected world: Android Hell',
  });
  await expect(panel.locator('.world-replies a')).toHaveCount(1);
  await expect(panel.getByRole('link', { name: /View source/ })).toHaveCount(0);
  await expect(
    panel.getByRole('link', { name: 'Launch Android Hell' }),
  ).toBeVisible();
});
