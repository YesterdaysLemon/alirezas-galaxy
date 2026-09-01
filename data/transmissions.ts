export type QuoteTransmission = {
  text: string;
  author: string;
  sourceUrl: string;
};

// Temporary seed data from public-domain works and historical correspondence.
// Replacing or extending this list is enough to grow the daily rotation.
export const quoteCorpus: QuoteTransmission[] = [
  {
    text: 'Brevity is the soul of wit.',
    author: 'William Shakespeare',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/16732/pg16732-images.html',
  },
  {
    text: 'Hitch your wagon to a star.',
    author: 'Ralph Waldo Emerson',
    sourceUrl: 'https://www.gutenberg.org/files/69258/old/69258-h/69258-h.htm',
  },
  {
    text: 'I frame no hypotheses.',
    author: 'Isaac Newton',
    sourceUrl: 'https://en.wikiquote.org/wiki/Isaac_Newton',
  },
  {
    text: 'The engine might compose elaborate and scientific pieces of music.',
    author: 'Ada Lovelace',
    sourceUrl: 'https://www.gutenberg.org/files/75107/75107-h/75107-h.htm',
  },
  {
    text: 'To err is human, to forgive divine.',
    author: 'Alexander Pope',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/10631/pg10631-images.html',
  },
  {
    text: 'The mind is its own place.',
    author: 'John Milton',
    sourceUrl: 'https://www.gutenberg.org/files/26/26-h/26-h.htm',
  },
  {
    text: 'Knowledge itself is power.',
    author: 'Francis Bacon',
    sourceUrl: 'https://www.gutenberg.org/ebooks/27889',
  },
];

export const quotationCollection = {
  label: "Bartlett's Familiar Quotations",
  url: 'https://www.gutenberg.org/ebooks/27889',
};

export function getQuoteOfTheDay(date = new Date()) {
  const utcDay = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
  return quoteCorpus[utcDay % quoteCorpus.length];
}
