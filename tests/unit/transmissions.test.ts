import { describe, expect, it } from 'vitest';
import {
  getQuoteOfTheDay,
  quotationCollection,
  quoteCorpus,
} from '@/data/transmissions';

describe('dock transmissions', () => {
  it('ships a sourced placeholder quote corpus', () => {
    expect(quoteCorpus.length).toBeGreaterThanOrEqual(6);
    expect(new Set(quoteCorpus.map(({ text }) => text)).size).toBe(
      quoteCorpus.length,
    );

    for (const quote of quoteCorpus) {
      expect(quote.text.length).toBeGreaterThan(0);
      expect(quote.author.length).toBeGreaterThan(0);
      expect(() => new URL(quote.sourceUrl)).not.toThrow();
    }
  });

  it('selects one stable quote for each UTC day', () => {
    const morning = new Date('2026-09-01T00:01:00Z');
    const evening = new Date('2026-09-01T23:59:00Z');
    expect(getQuoteOfTheDay(morning)).toEqual(getQuoteOfTheDay(evening));
  });

  it('keeps the quotation collection as a real external link', () => {
    expect(new URL(quotationCollection.url).protocol).toBe('https:');
  });
});
