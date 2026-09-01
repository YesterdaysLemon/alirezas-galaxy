import { expect, test } from '@playwright/test';

test('the standalone icon laboratory compares and marks four families', async ({
  page,
}) => {
  await page.goto('/icon-lab.html');

  await expect(page).toHaveTitle('Afshan Icon Laboratory');
  await expect(page.locator('[data-family]')).toHaveCount(4);
  await expect(
    page.getByRole('link', { name: /return to the galaxy/i }),
  ).toHaveAttribute('href', '/#galaxy');

  const bioCard = page.locator('[data-family="Bio Signals — Little Crew"]');
  const portfolio = bioCard.getByRole('button', { name: 'Portfolio' });
  await portfolio.hover();
  await expect(portfolio).toHaveClass(/is-active/);

  const chooseBio = page.getByRole('button', {
    name: 'Choose Bio Signals — Little Crew',
  });
  await chooseBio.click();
  await expect(chooseBio).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText(
    'Marked for feedback: Bio Signals — Little Crew',
  );
});
