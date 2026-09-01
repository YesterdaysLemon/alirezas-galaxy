import { destinations } from './worlds';

export const siteIdentity = {
  name: "Alireza's Galaxy",
  owner: 'Alireza Afshan',
  origin: 'https://alirezaafshan.com',
  description:
    'A tactile orbital index of Alireza Afshan’s websites and experiments.',
  email: 'mail@alirezaafshan.com',
  github: 'https://github.com/YesterdaysLemon',
} as const;

export const publicWorlds = destinations.filter(
  (destination) => destination.status !== 'archived',
);

export function serializeWorlds() {
  return publicWorlds.map(
    ({ id, name, kind, url, description, relationship, hosting, status }) => ({
      id,
      name,
      kind,
      url,
      description,
      relationship,
      hosting,
      status,
    }),
  );
}

export function renderLlmsText() {
  const owned = publicWorlds.filter(
    (destination) => destination.relationship === 'owned',
  );
  const collaborations = publicWorlds.filter(
    (destination) => destination.relationship === 'collaboration',
  );
  const renderLink = (destination: (typeof publicWorlds)[number]) =>
    `- [${destination.name}](${destination.url}): ${destination.description}`;

  return [
    `# ${siteIdentity.name}`,
    '',
    `> ${siteIdentity.description}`,
    '',
    'This is the machine-readable orientation for the interactive galaxy menu. Each world is a website or public project associated with Alireza Afshan. User-facing navigation lives at the site root.',
    '',
    '## Primary',
    '',
    `- [Galaxy](${siteIdentity.origin}/): Interactive visual index`,
    `- [GitHub](${siteIdentity.github}): Public software and research repositories`,
    `- [Email](mailto:${siteIdentity.email}): Contact Alireza Afshan`,
    '',
    '## Owned worlds',
    '',
    ...owned.map(renderLink),
    ...(collaborations.length
      ? ['', '## Collaborations', '', ...collaborations.map(renderLink)]
      : []),
    '',
    '## Machine-readable',
    '',
    `- [World catalog](${siteIdentity.origin}/sites.json): Structured ownership, hosting, and status metadata`,
    `- [Sitemap](${siteIdentity.origin}/sitemap.xml): Indexable pages on this origin`,
    '',
  ].join('\n');
}

export function buildStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${siteIdentity.origin}/#person`,
        name: siteIdentity.owner,
        url: siteIdentity.origin,
        sameAs: [siteIdentity.github],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteIdentity.origin}/#website`,
        name: siteIdentity.name,
        url: siteIdentity.origin,
        description: siteIdentity.description,
        author: { '@id': `${siteIdentity.origin}/#person` },
        hasPart: { '@id': `${siteIdentity.origin}/#worlds` },
      },
      {
        '@type': 'ItemList',
        '@id': `${siteIdentity.origin}/#worlds`,
        name: 'Website worlds',
        numberOfItems: publicWorlds.length,
        itemListElement: publicWorlds.map((destination, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: destination.name,
          url: destination.url,
          description: destination.description,
        })),
      },
    ],
  };
}
