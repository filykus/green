import { cn } from '@/lib/utils';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T extends { id?: number | string; telegramId?: number }>({
  data,
  columns,
  onRowClick,
  className,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const getRowKey = (row: T, index: number): string => {
    if ('id' in row && row.id !== undefined) return String(row.id);
    if ('telegramId' in row && row.telegramId !== undefined) return String(row.telegramId);
    return String(index);
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-card-border bg-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-card-border bg-muted/30">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={getRowKey(row, rowIdx)}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/20'
                  )}
                  onClick={() => onRowClick?.(row)}
                  data-testid={`row-table-${getRowKey(row, rowIdx)}`}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={cn('px-4 py-3 text-sm', col.className)}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
