import { worldCatalog } from '@/data/worlds';
import { webring } from '@/data/webring';

/**
 * Every public world as plain links: inside <noscript>, or shown outright
 * when WebGL is unavailable.
 */
export function WorldCatalog({ visible }: { visible: boolean }) {
  const Container = visible ? 'div' : 'noscript';
  return (
    <Container>
      <section className="noscript-catalog" aria-label="Website worlds">
        <h1>Alireza&apos;s Galaxy</h1>
        <p>
          Everything I build becomes a planet. Here they all are, no rocket
          required.
        </p>
        <ul>
          {worldCatalog.map((destination) => (
            <li key={destination.id}>
              <a
                href={destination.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {destination.name}
              </a>
              <span>{destination.description}</span>
            </li>
          ))}
        </ul>
        <h2>Web ring</h2>
        <ul>
          {webring.map((neighbor) => (
            <li key={neighbor.id}>
              <a href={neighbor.url} target="_blank" rel="noopener noreferrer">
                {neighbor.name}
              </a>
              <span>{neighbor.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
