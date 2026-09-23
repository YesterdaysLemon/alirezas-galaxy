import { expect, test } from '@playwright/test';
import { galaxyDestinations } from '../../data/galaxies';
import { solarSystems } from '../../data/solar-systems';

async function openHydratedGalaxy(page: import('@playwright/test').Page) {
  await page.goto('/#galaxy');
  await expect(page.locator('#galaxy canvas')).toBeVisible();
}

for (const star of galaxyDestinations.filter((world) => world.systemId)) {
  test(`${star.name} and its project worlds are keyboard-selectable`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHydratedGalaxy(page);
    const navigation = page.getByRole('navigation', { name: 'Website worlds' });
    await expect(navigation.getByRole('button')).toHaveCount(
      galaxyDestinations.length,
    );
    const entry = navigation.locator(`[data-world-id="${star.id}"]`);
    await entry.focus();
    await entry.press('Enter');
    const system = solarSystems.find((system) => system.id === star.systemId)!;
    for (const planet of system.planets.filter((planet) => planet.projectId)) {
      const control = page.getByRole('button', {
        name: `Explore ${planet.name}`,
        exact: true,
      });
      await expect(control).toBeEnabled();
      await control.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('article', { name: `Planet: ${planet.name}` }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: `Visit ${planet.name}`, exact: true }),
      ).toHaveAttribute('href', planet.url!);
    }
    await page.getByRole('button', { name: 'Return to the galaxy' }).click();
    await expect(navigation).toBeAttached();
    await expect(page.locator('[data-galaxy-stage]')).toHaveAttribute(
      'data-solar-phase',
      'galaxy',
    );
  });
}

test('the close control does not jump on hover', async ({ page }) => {
  await openHydratedGalaxy(page);
  await page.getByRole('button', { name: 'about', exact: true }).click();

  const close = page.getByRole('button', { name: 'Close world details' });
  const detail = page.getByRole('region', {
    name: 'Selected world: Alireza Afshan',
  });
  await expect(close).toBeVisible();
  await detail.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const positionInDetail = (element: HTMLElement | SVGElement) => {
    const bounds = element.getBoundingClientRect();
    const parent = element.closest('.world-detail')!.getBoundingClientRect();
    return { x: bounds.x - parent.x, y: bounds.y - parent.y };
  };
  const relativeBefore = await close.evaluate(positionInDetail);
  const before = await close.boundingBox();
  await page.mouse.move(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2,
  );
  await expect
    .poll(() => close.evaluate((element) => element.matches(':hover')))
    .toBe(true);
  await page.waitForTimeout(150);
  const relativeAfter = await close.evaluate(positionInDetail);
  expect(Math.abs(relativeAfter.x - relativeBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(relativeAfter.y - relativeBefore.y)).toBeLessThan(0.5);
});

test('the utility dock keeps its controls distinct and functional', async ({
  page,
}) => {
  await openHydratedGalaxy(page);
  const console = page.locator('.dock-console');
  const galaxyOrb = page.getByRole('button', {
    name: 'Spin the galaxy faster',
  });
  const tuner = page.getByRole('button', {
    name: 'Show next footer transmission',
  });
  await expect(
    page.getByRole('dialog', { name: 'Galaxy settings' }),
  ).toHaveCount(0);
  const stage = page.locator('[data-galaxy-stage]');
  const spiral = galaxyOrb.locator('img');
  const initialTransform = await spiral.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  for (let press = 0; press < 7; press += 1) {
    await galaxyOrb.click();
  }
  await expect(stage).toHaveAttribute('data-portrait-bursts', '1');
  await expect
    .poll(() =>
      spiral.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(initialTransform);
  await expect(page.getByText('© alireza afshan · 2026')).toBeVisible();

  await tuner.click();
  await expect(console).toHaveAttribute('data-mode', 'quote');
  await expect(page.locator('output#dock-transmission')).toContainText('—');
  await tuner.click();
  await expect(console).toHaveAttribute('data-mode', 'source');
  await expect(
    page.getByRole('link', { name: /Open Bartlett's Familiar Quotations/i }),
  ).toHaveAttribute('href', 'https://www.gutenberg.org/ebooks/27889');
  await tuner.click();
  await expect(console).toHaveAttribute('data-mode', 'contact');
  await expect(
    page.getByRole('link', { name: 'Contact me by email' }),
  ).toHaveAttribute('href', 'mailto:mail@alirezaafshan.com');
});

test('primary controls discover a world, introduce Alireza, and link to GitHub', async ({
  page,
}) => {
  await openHydratedGalaxy(page);

  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: 'github' })).toHaveAttribute(
    'href',
    'https://github.com/YesterdaysLemon',
  );
  await primary.getByRole('button', { name: 'random world' }).click();
  await expect(page.getByRole('article', { name: /^Planet:/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Visit / })).not.toHaveAttribute(
    'href',
    'https://portfolio.alirezaafshan.com',
  );
  await page.getByRole('button', { name: 'Return to the galaxy' }).click();

  await primary.getByRole('button', { name: 'about' }).click();
  await expect(
    page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
  ).toBeAttached();
  await page
    .getByRole('button', { name: 'Alireza Afshan — return home' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
  ).not.toBeAttached();
  await expect(
    page.getByRole('button', { name: 'Inspect Alireza Afshan' }),
  ).toBeAttached();
});

test('mobile chrome keeps its controls legible, tappable, and separated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHydratedGalaxy(page);

  const randomBox = await page
    .getByRole('button', { name: 'random world', exact: true })
    .boundingBox();
  const aboutBox = await page
    .getByRole('button', { name: 'about', exact: true })
    .boundingBox();
  const githubBox = await page
    .getByRole('link', { name: 'github' })
    .boundingBox();
  const footerBox = await page.locator('.spore-dock').boundingBox();

  expect(randomBox).not.toBeNull();
  expect(aboutBox).not.toBeNull();
  expect(githubBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(randomBox!.height).toBeGreaterThanOrEqual(42);
  expect(aboutBox!.height).toBeGreaterThanOrEqual(42);
  expect(githubBox!.height).toBeGreaterThanOrEqual(42);
  expect(footerBox!.x).toBeGreaterThanOrEqual(0);
  expect(footerBox!.x + footerBox!.width).toBeLessThanOrEqual(390);

  const tuner = page.getByRole('button', {
    name: 'Show next footer transmission',
  });
  await tuner.click();
  await tuner.click();
  await tuner.click();
  const contactBox = await page
    .getByRole('link', { name: 'Contact me by email' })
    .boundingBox();
  expect(contactBox).not.toBeNull();
  expect(contactBox!.height).toBeGreaterThanOrEqual(42);
  expect(contactBox!.x + contactBox!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test('world overlays stay inside the viewport after a live resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await openHydratedGalaxy(page);

  const preview = page.getByRole('button', {
    name: 'Inspect Alireza Afshan',
  });
  await expect(preview).toBeVisible();
  await preview.click({ force: true });

  const detail = page.getByRole('region', {
    name: 'Selected world: Alireza Afshan',
  });
  await expect(detail).toBeVisible();

  const expectInsideViewport = async (
    locator: import('@playwright/test').Locator,
  ) => {
    await expect
      .poll(async () => {
        const box = await locator.boundingBox();
        const viewport = page.viewportSize();
        return Boolean(
          box &&
          viewport &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height,
        );
      })
      .toBe(true);
  };

  await expectInsideViewport(detail);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectInsideViewport(detail);

  const favicon = detail.locator('.world-face img');
  await expect(favicon).toHaveAttribute(
    'src',
    'https://portfolio.alirezaafshan.com/apple-touch-icon.png',
  );
  await expect
    .poll(() =>
      favicon.evaluate((image) =>
        image instanceof HTMLImageElement ? image.naturalWidth : 0,
      ),
    )
    .toBeGreaterThan(0);

  await page
    .getByRole('button', { name: 'Close world details' })
    .click({ force: true });
  await expect(preview).toBeVisible();
  await expectInsideViewport(preview);
});

test('footer copy is centered and contact lives in its transmission sequence', async ({
  page,
}) => {
  await openHydratedGalaxy(page);

  const centers = async (containerSelector: string, copySelector: string) => {
    const container = page.locator(containerSelector);
    return container.evaluate((element, selector) => {
      const copy = element.querySelector(selector);
      if (!(copy instanceof HTMLElement)) {
        throw new Error(`Missing footer copy: ${selector}`);
      }
      const containerBox = element.getBoundingClientRect();
      const copyBox = copy.getBoundingClientRect();
      return {
        container: containerBox.x + containerBox.width / 2,
        copy: copyBox.x + copyBox.width / 2,
      };
    }, copySelector);
  };

  const footer = await centers('.dock-console', '.dock-message');
  expect(Math.abs(footer.copy - footer.container)).toBeLessThan(1);

  const tuner = page.getByRole('button', {
    name: 'Show next footer transmission',
  });
  await tuner.click();
  await tuner.click();
  await tuner.click();
  const contact = page.getByRole('link', { name: 'Contact me by email' });
  await expect(contact).toBeVisible();
  const contactCenters = await centers('.dock-console', '.dock-message');
  expect(Math.abs(contactCenters.copy - contactCenters.container)).toBeLessThan(
    1,
  );
});
