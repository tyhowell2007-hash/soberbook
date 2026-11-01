import StatsView from './StatsView';
import { loadStats } from './load';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ripple · Sober Book' };

/* "How it's doing" for one of your own posts (0196). See load.js. */
export default async function PostStatsPage({ params }) {
  const { id, stats } = await loadStats(params);
  return <StatsView id={id} s={stats} focus={null} />;
}
