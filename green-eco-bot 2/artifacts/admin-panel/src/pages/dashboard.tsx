import { useGetAdminStats, getGetAdminStatsQueryKey } from '@workspace/api-client-react';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/ui/data-table';
import { Users, DollarSign, Scale, Briefcase, Shield, Leaf, Clock, Target } from 'lucide-react';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card border border-card-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Real-time overview of Green Eco operations</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Players" value={stats.totalUsers.toLocaleString()} icon={Users} />
        <StatCard label="Active Workers" value={stats.activeWorkers.toLocaleString()} icon={Briefcase} />
        <StatCard
          label="Total Balance"
          value={`$${stats.totalBalance.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          label="Avg Lawfulness"
          value={(stats.totalLawfulness / Math.max(stats.totalUsers, 1)).toFixed(1)}
          icon={Scale}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Police Unlocked" value={stats.unlockedPolice.toLocaleString()} icon={Shield} />
        <StatCard label="Dealers Unlocked" value={stats.unlockedDealers.toLocaleString()} icon={Leaf} />
        <StatCard label="Pending Shifts" value={stats.pendingShifts.toLocaleString()} icon={Clock} />
        <StatCard label="Pending Missions" value={stats.pendingMissions.toLocaleString()} icon={Target} />
      </div>

      {/* Job Distribution */}
      <div className="rounded-lg border border-card-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Job Distribution</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.jobBreakdown.map((item) => (
            <div
              key={item.job}
              className="flex items-center justify-between rounded-md border border-card-border bg-muted/20 px-4 py-3"
              data-testid={`card-job-${item.job}`}
            >
              <span className="text-sm font-medium capitalize">{item.job || 'Unemployed'}</span>
              <span className="font-mono-tabular text-lg font-semibold text-primary" data-testid={`text-count-${item.job}`}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Earners */}
      <div className="rounded-lg border border-card-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Top Earners</h2>
        <DataTable
          data={stats.topEarners}
          columns={[
            {
              header: 'Telegram ID',
              accessor: 'telegramId',
              className: 'font-mono-tabular',
            },
            {
              header: 'Username',
              accessor: (row) => row.username ? `@${row.username}` : '—',
            },
            {
              header: 'First Name',
              accessor: 'firstName',
            },
            {
              header: 'Balance',
              accessor: (row) => (
                <span className="font-mono-tabular font-semibold text-primary">
                  ${row.balance.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
          ]}
          onRowClick={(row) => setLocation(`/users/${row.telegramId}`)}
        />
      </div>
    </div>
  );
}
