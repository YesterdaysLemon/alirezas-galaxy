import { expect, test } from '@playwright/test';

// Entering a system is a deliberate ~3.3 s cinematic (dive, then haze), plus
// terrain preparation on a cold load; allow for it where tests wait to arrive.
const ARRIVAL = { timeout: 10_000 };

test('galaxy to system to planet and back keeps one canvas and working project links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#galaxy');
  const entry = page
    .getByRole('navigation', { name: 'Website worlds' })
    .locator('[data-world-id="patterns-and-life"]');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toBeVisible();
  await entry.focus();
  await entry.press('Enter');
  const stage = page.locator('[data-galaxy-stage]');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system', ARRIVAL);
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
  // The outermost lane is a real project too; scenic placeholders retired.
  await page
    .getByRole('button', { name: 'Explore Openwater', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Visit Openwater', exact: true }),
  ).toHaveAttribute('href', 'https://openwater.alirezaafshan.com');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
  await expect(entry).toBeFocused();
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
  const entry = page
    .getByRole('navigation', { name: 'Website worlds' })
    .locator('[data-world-id="patterns-and-life"]');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toBeVisible();
  await entry.focus();
  await entry.press('Enter');
  const stage = page.locator('[data-galaxy-stage]');
  await expect(stage).toHaveAttribute('data-solar-phase', 'system', ARRIVAL);
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
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.goForward();
  await expect(inspector).toBeVisible();
  await page.reload();
  await expect(inspector).toBeVisible();
  await page.getByRole('button', { name: 'Return to the galaxy' }).click();
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
});

test('planet addresses and browser history switch systems without losing the galaxy', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#system/patterns-and-life/plato');
  await expect(
    page.getByRole('article', { name: 'Planet: Plato' }),
  ).toBeVisible();
  const canvas = page.locator('canvas[data-galaxy-canvas]');
  const original = await canvas.elementHandle();
  await page.evaluate(() => {
    location.hash = '#system/tools-and-infrastructure/valet';
  });
  await expect(
    page.getByRole('article', { name: 'Planet: Valet' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Visit Valet', exact: true }),
  ).toHaveAttribute('href', 'https://valet.alirezaafshan.com');
  await page.goBack();
  await expect(
    page.getByRole('article', { name: 'Planet: Plato' }),
  ).toBeVisible();
  expect(
    await original!.evaluate(
      (element) =>
        element === document.querySelector('canvas[data-galaxy-canvas]'),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    location.hash = '#system/not-a-system';
  });
  await expect(page.locator('[data-galaxy-stage]')).toHaveAttribute(
    'data-solar-phase',
    'galaxy',
  );
  await expect(
    page.getByRole('button', { name: 'about', exact: true }),
  ).toBeVisible();
});

test('planet hover cards identify a world without navigating and remain clickable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#system/patterns-and-life');
  await expect(
    page.getByRole('button', { name: 'Explore Plato', exact: true }),
  ).toBeEnabled(ARRIVAL);
  // Worlds carry no standing labels; the card records where its world is.
  const worldPoint = async () => {
    await page
      .getByRole('button', { name: 'Explore Plato', exact: true })
      .hover();
    const preview = page.locator('[data-solar-preview]');
    await expect(preview).toHaveAttribute('data-anchor', /^\d+ \d+$/);
    const [x, y] = (await preview.getAttribute('data-anchor'))!
      .split(' ')
      .map(Number);
    const canvas = (await page
      .locator('canvas[data-galaxy-canvas]')
      .boundingBox())!;
    return { x: canvas.x + x, y: canvas.y + y };
  };
  const from = await worldPoint();
  await page.mouse.move(from.x, from.y);
  const card = page.locator('[data-solar-preview]').getByRole('button');
  await expect(card).toBeVisible();
  await expect(card).toContainText('plato.alirezaafshan.com');
  await expect(page).toHaveURL(/#system\/patterns-and-life$/);
  const previewBounds = (await page
    .locator('[data-solar-preview]')
    .boundingBox())!;
  const to = {
    x: Math.max(
      previewBounds.x + 2,
      Math.min(from.x, previewBounds.x + previewBounds.width - 2),
    ),
    y: Math.max(
      previewBounds.y + 2,
      Math.min(from.y, previewBounds.y + previewBounds.height - 2),
    ),
  };
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 5);
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps,
    );
    await expect(card).toBeVisible();
  }
  await card.hover();
  await expect(card).toBeVisible();
  await card.click();
  await expect(
    page.getByRole('article', { name: 'Planet: Plato' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Visit Plato', exact: true }),
  ).toHaveAttribute('href', 'https://plato.alirezaafshan.com');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 667, height: 375 });
  const landscapeWorld = await worldPoint();
  await page.mouse.move(landscapeWorld.x, landscapeWorld.y);
  await expect(card).toBeVisible();
  const landscapeCard = (await card.boundingBox())!;
  const inspector = (await page
    .getByRole('article', { name: 'Planet: Plato' })
    .boundingBox())!;
  expect(
    landscapeCard.x < inspector.x + inspector.width &&
      landscapeCard.x + landscapeCard.width > inspector.x &&
      landscapeCard.y < inspector.y + inspector.height &&
      landscapeCard.y + landscapeCard.height > inspector.y,
  ).toBe(false);
});

test('changing destination during entry keeps the latest route and restores galaxy focus', async ({
  page,
}) => {
  await page.goto('/#galaxy');
  const navigation = page.getByRole('navigation', { name: 'Website worlds' });
  const entry = navigation.locator('[data-world-id="patterns-and-life"]');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toBeVisible();
  await entry.focus();
  await entry.press('Enter');
  await page.evaluate(() => {
    location.hash = '#system/tools-and-infrastructure/valet';
  });
  await expect(
    page.getByRole('article', { name: 'Planet: Valet' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#system\/tools-and-infrastructure\/valet$/);
  await page.getByRole('button', { name: 'Return to the galaxy' }).click();
  await expect(
    navigation.locator('[data-world-id="tools-and-infrastructure"]'),
  ).toBeFocused();
  await expect(page).toHaveURL(/#galaxy$/);
  await navigation
    .locator('[data-world-id="curiosity-and-play"]')
    .press('Enter');
  await expect(
    page.getByRole('button', { name: 'Explore Herald', exact: true }),
  ).toBeEnabled(ARRIVAL);
  await expect(page).toHaveURL(/#system\/curiosity-and-play$/);
});

test('scrolling dives into a family star and back out to the galaxy', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#galaxy');
  const stage = page.locator('[data-galaxy-stage]');
  await expect(page.locator('canvas[data-galaxy-canvas]')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Website worlds' })
    .locator('[data-world-id="patterns-and-life"]')
    .focus();
  // The hover card's portrait sits on its star; scrolling there still steers.
  const star = page.locator(
    '.world-preview[data-world-id="patterns-and-life"] .world-preview-orbit',
  );
  await expect(star).toBeVisible();
  const box = (await star.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < 5; step++) await page.mouse.wheel(0, -100);
  await expect(stage).toHaveAttribute('data-solar-phase', 'system', ARRIVAL);
  await expect(page).toHaveURL(/#system\/patterns-and-life$/);
  await page.mouse.move(640, 300);
  for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 120);
  // Momentum that reaches the widest view stops there; scrolling on once the
  // view has settled leaves for the galaxy.
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.waitForTimeout(500);
  for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 120);
  await expect(stage).toHaveAttribute('data-solar-phase', 'galaxy');
  await expect(page).toHaveURL(/#galaxy$/);
});

test('the ship HUD keeps the top clear and runs the menu, zoom and pause', async ({
  page,
}) => {
  await page.goto('/#system/patterns-and-life');
  const stage = page.locator('[data-galaxy-stage]');
  await expect(
    page.getByRole('button', { name: 'Explore Plato', exact: true }),
  ).toBeEnabled(ARRIVAL);
  // The galaxy canopy steps aside; nothing of the HUD sits in the top half.
  await expect(page.locator('.spore-corner')).toBeHidden();
  const viewport = page.viewportSize()!;
  for (const part of ['.solar-helm', '.solar-deck']) {
    const bounds = (await page.locator(part).boundingBox())!;
    expect(bounds.y).toBeGreaterThan(viewport.height / 2);
  }
  const menu = page.getByRole('button', { name: 'Ship menu' });
  await menu.click();
  await expect(
    page.getByRole('button', { name: 'Enter Curiosity & Play', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'random world' }).focus();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Enter Curiosity & Play', exact: true }),
  ).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
  await page.getByRole('button', { name: 'Pause orbital motion' }).click();
  await expect(
    page.getByRole('button', { name: 'Resume orbital motion' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
});

test('zooming glides onto the world under the pointer and back out', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#system/patterns-and-life');
  const stage = page.locator('[data-galaxy-stage]');
  await page
    .getByRole('button', { name: 'Explore Plato', exact: true })
    .hover();
  const preview = page.locator('[data-solar-preview]');
  await expect(preview).toHaveAttribute('data-anchor', /^\d+ \d+$/);
  const [x, y] = (await preview.getAttribute('data-anchor'))!
    .split(' ')
    .map(Number);
  const canvas = (await page
    .locator('canvas[data-galaxy-canvas]')
    .boundingBox())!;
  await page.mouse.move(canvas.x + x, canvas.y + y);
  // Hovering holds the orbits, so the world stays under the pointer.
  for (let step = 0; step < 16; step++) {
    await page.mouse.wheel(0, -120);
    if ((await stage.getAttribute('data-solar-phase')) === 'planet') break;
  }
  await expect(stage).toHaveAttribute('data-solar-phase', 'planet');
  await expect(page).toHaveURL(/#system\/patterns-and-life\/plato$/);
  // Back out: past its close-up the world releases to the system view.
  for (let step = 0; step < 8; step++) await page.mouse.wheel(0, 120);
  await expect(stage).toHaveAttribute('data-solar-phase', 'system');
});
