import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="lost-signal">
      <p>signal lost</p>
      <h1>This world isn&apos;t mapped.</h1>
      <Link href="/#galaxy">Return to the galaxy</Link>
    </main>
  );
}
