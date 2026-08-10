import { useGetAdminActivity, getGetAdminActivityQueryKey } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap } from 'lucide-react';

export default function ActivityPage() {
  const { data: activities = [], isLoading } = useGetAdminActivity(
    { limit: 100 },
    {
      query: {
        queryKey: getGetAdminActivityQueryKey({ limit: 100 }),
      },
    }
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'shift_confirmed':
        return '💼';
      case 'mission_completed':
        return '🎯';
      case 'harvest':
        return '🌾';
      case 'purchase':
        return '🛒';
      default:
        return '📌';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-card border border-card-border"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-muted-foreground mt-1">Live stream of recent bot events</p>
      </div>

      {activities.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activities.length}</span> recent events
        </div>
      )}

      <div className="space-y-2">
        {activities.length === 0 ? (
          <div className="rounded-lg border border-card-border bg-card p-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No activity yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Bot events will appear here as they happen
            </p>
          </div>
        ) : (
          activities.map((activity, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 rounded-lg border border-card-border bg-card p-4 transition-colors hover:bg-muted/10"
              data-testid={`activity-${idx}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {activity.username && <span>@{activity.username}</span>}
                      <span className="font-mono-tabular">ID: {activity.userId}</span>
                      {activity.amount !== null && activity.amount !== undefined && (
                        <span className="font-mono-tabular font-semibold text-primary">
                          ${activity.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.happenedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-card-border bg-card p-4 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          Real-time monitoring active
        </div>
      )}
    </div>
  );
}
