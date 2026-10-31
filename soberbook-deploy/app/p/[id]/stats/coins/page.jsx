import StatsView from '../StatsView';
import { loadStats } from '../load';

export const dynamic = 'force-dynamic';

/* The same page, opened at the coins — where a coin notification lands. */
export default async function PostCoinsPage({ params }) {
  const { id, stats } = await loadStats(params);
  return <StatsView id={id} s={stats} focus="coins" />;
}
