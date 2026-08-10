import { useState } from 'react';
import { useListAdminUsers, getListAdminUsersQueryKey } from '@workspace/api-client-react';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

export default function Users() {
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<string>('');
  const [, setLocation] = useLocation();

  const { data, isLoading } = useListAdminUsers(
    {
      search: search || undefined,
      job: jobFilter || undefined,
    },
    {
      query: {
        queryKey: getListAdminUsersQueryKey({
          search: search || undefined,
          job: jobFilter || undefined,
        }),
      },
    }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        <p className="text-muted-foreground mt-1">All registered users in Green Eco</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username or Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-job-filter">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Jobs</SelectItem>
            <SelectItem value="unemployed">Unemployed</SelectItem>
            <SelectItem value="farmer">Farmer</SelectItem>
            <SelectItem value="miner">Miner</SelectItem>
            <SelectItem value="builder">Builder</SelectItem>
            <SelectItem value="merchant">Merchant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {data && (
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{data.users.length}</span> of{' '}
          <span className="font-semibold text-foreground">{data.total}</span> players
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-card border border-card-border" />
      ) : data ? (
        <DataTable
          data={data.users}
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
              header: 'Job',
              accessor: (row) => (
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {row.currentJob || 'None'}
                </span>
              ),
            },
            {
              header: 'Balance',
              accessor: (row) => (
                <span className="font-mono-tabular font-semibold">
                  ${row.balance.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Lawfulness',
              accessor: (row) => {
                const lawful = row.lawfulness >= 0;
                return (
                  <span
                    className={`font-mono-tabular font-semibold ${
                      lawful ? 'text-primary' : 'text-destructive'
                    }`}
                  >
                    {row.lawfulness > 0 ? '+' : ''}
                    {row.lawfulness}
                  </span>
                );
              },
              className: 'text-right',
            },
            {
              header: 'Joined',
              accessor: (row) => formatDistanceToNow(new Date(row.createdAt), { addSuffix: true }),
              className: 'text-muted-foreground text-xs',
            },
          ]}
          onRowClick={(row) => setLocation(`/users/${row.telegramId}`)}
        />
      ) : null}
    </div>
  );
}
