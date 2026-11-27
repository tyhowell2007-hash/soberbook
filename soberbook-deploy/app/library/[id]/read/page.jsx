import { notFound } from 'next/navigation';
import { BOOKS, byId } from '../../books';
import Reader from '../../Reader';

/* /library/<id>/read — the in-app reader, hosted books only. */
export function generateStaticParams() { return BOOKS.filter((b) => b.kind === 'hosted').map((b) => ({ id: b.id })); }
export function generateMetadata({ params }) {
  const b = byId(params.id);
  return { title: b ? `Reading ${b.title}` : 'The Library' };
}
export default function ReadPage({ params }) {
  const b = byId(params.id);
  if (!b || b.kind !== 'hosted') notFound();
  return <Reader id={b.id} title={b.title} />;
}
