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
  const console = page.locator('.dock-console');
  const settingsOrb = page.getByRole('button', {
    name: 'Open galaxy settings',
  });
  const tuner = page.getByRole('button', {
    name: 'Show next footer transmission',
  });
  await expect(console).toHaveAttribute('data-mode', 'credit');
  await expect(console.locator('.dock-mode-lights i')).toHaveCount(4);
  await expect(settingsOrb.locator('svg')).toHaveAttribute(
    'data-icon',
    'spore-main-menu-spiral',
  );
  await expect(settingsOrb.locator('.spore-spiral-blade')).toHaveCount(3);
  await expect(settingsOrb.locator('circle')).toHaveCount(0);
  await expect(tuner.locator('svg')).toHaveAttribute(
    'data-icon',
    'advance-transmission',
  );
  await expect(tuner.locator('circle')).toHaveCount(0);
  await expect(tuner.locator('path')).toHaveCount(2);

  const [consoleBox, orbBox, tunerBox] = await Promise.all([
    console.boundingBox(),
    settingsOrb.boundingBox(),
    tuner.boundingBox(),
  ]);
  expect(consoleBox).not.toBeNull();
  expect(orbBox).not.toBeNull();
  expect(tunerBox).not.toBeNull();
  expect(orbBox!.x + orbBox!.width).toBeGreaterThan(consoleBox!.x);
  expect(tunerBox!.x).toBeGreaterThanOrEqual(consoleBox!.x);
  expect(tunerBox!.x + tunerBox!.width).toBeLessThanOrEqual(
    consoleBox!.x + consoleBox!.width,
  );
  expect(orbBox!.x).toBeLessThanOrEqual(6);

  await page.getByRole('button', { name: 'Open galaxy settings' }).click();

  const slider = page.getByRole('slider', { name: 'Galaxy core exposure' });
  await expect(slider).toHaveValue('0.92');

  const drift = page.getByRole('button', { name: /galactic drift/i });
  await expect(drift).toHaveAttribute('aria-pressed', 'true');
  await drift.click();
  await expect(drift).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Close galaxy settings' }).click();
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

test('the active menu keeps yellow contained inside the selected pill', async ({
  page,
}) => {
  await openHydratedGalaxy(page);
  const github = page.getByRole('link', { name: 'github' });
  await github.hover();
  await expect(github).toHaveClass(/is-active/);

  for (const label of ['random world', 'about', 'github']) {
    const control =
      label === 'github'
        ? page.getByRole('link', { name: label })
        : page.getByRole('button', { name: label });
    await expect(control.locator('svg.menu-icon')).toBeVisible();
  }

  const randomIcon = page
    .getByRole('button', { name: 'random world' })
    .locator('svg.menu-icon');
  await expect(randomIcon).toHaveAttribute('data-icon', 'soft-organic-star');
  await expect(randomIcon.locator('path')).toHaveCount(1);
  await expect(randomIcon.locator('circle')).toHaveCount(0);

  const activeDecoration = await github.evaluate((element) => {
    const rail = getComputedStyle(element, '::before');
    const gloss = getComputedStyle(element, '::after');
    const pill = getComputedStyle(element);
    return {
      railContent: rail.content,
      railBackground: rail.backgroundImage,
      railBoxShadow: rail.boxShadow,
      glossTop: Number.parseFloat(gloss.top),
      glossLeft: Number.parseFloat(gloss.left),
      pillOverflow: pill.overflow,
    };
  });

  expect(activeDecoration.railContent).toBe('none');
  expect(activeDecoration.railBackground).toBe('none');
  expect(activeDecoration.railBoxShadow).toBe('none');
  expect(activeDecoration.glossTop).toBeGreaterThanOrEqual(1);
  expect(activeDecoration.glossLeft).toBeGreaterThanOrEqual(9);
  expect(activeDecoration.pillOverflow).toBe('hidden');

  const inactiveEdge = await page
    .getByRole('button', { name: 'random world', exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        topRight: style.borderTopRightRadius,
        bottomRight: style.borderBottomRightRadius,
      };
    });
  expect(inactiveEdge).toEqual({ topRight: '0px', bottomRight: '0px' });
});

test('primary controls discover a world, introduce Alireza, and link to GitHub', async ({
  page,
}) => {
  await openHydratedGalaxy(page);

  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('button')).toHaveCount(2);
  await expect(primary.getByRole('link')).toHaveCount(1);
  await expect(primary.getByRole('link', { name: 'github' })).toHaveAttribute(
    'href',
    'https://github.com/YesterdaysLemon',
  );
  await primary.getByRole('button', { name: 'random world' }).click();
  const randomDetail = page.locator('.world-detail');
  await expect(randomDetail).toBeAttached();
  await expect(randomDetail).not.toHaveAttribute('data-world-id', 'portfolio');

  await primary.getByRole('button', { name: 'about' }).click();
  await expect(
    page.getByRole('region', { name: 'Selected world: Alireza Afshan' }),
  ).toBeAttached();
  await page
    .getByRole('link', { name: 'Alireza Afshan — return home' })
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

  const brandLines = page.locator('.sprawl-mark span');
  await expect(brandLines).toHaveCount(2);
  await expect(brandLines.nth(0)).toHaveText('alireza');
  await expect(brandLines.nth(1)).toHaveText('afshan');

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
  expect(footerBox!.x + footerBox!.width).toBeGreaterThanOrEqual(384);
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
