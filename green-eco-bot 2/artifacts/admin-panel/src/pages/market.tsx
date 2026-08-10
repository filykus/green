import { useState } from 'react';
import {
  useListMarketListings,
  getListMarketListingsQueryKey,
  useDeactivateMarketListing,
} from '@workspace/api-client-react';
import type { MarketListingItem } from '@workspace/api-client-react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function Market() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listings = [], isLoading } = useListMarketListings({
    query: { queryKey: getListMarketListingsQueryKey() },
  });

  const deactivate = useDeactivateMarketListing();

  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketListingItem | null>(null);

  const handleDeactivate = (listing: MarketListingItem) => {
    setSelectedListing(listing);
    setDeactivateDialogOpen(true);
  };

  const confirmDeactivate = () => {
    if (!selectedListing) return;

    deactivate.mutate(
      { id: selectedListing.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarketListingsQueryKey() });
          setDeactivateDialogOpen(false);
          setSelectedListing(null);
          toast({ title: 'Listing deactivated successfully' });
        },
        onError: () => {
          toast({ title: 'Failed to deactivate listing', variant: 'destructive' });
        },
      }
    );
  };

  const getClassBadge = (substanceClass: string) => {
    const colors: Record<string, string> = {
      A: 'bg-destructive/10 text-destructive',
      B: 'bg-orange-500/10 text-orange-500',
      C: 'bg-yellow-500/10 text-yellow-500',
      D: 'bg-muted text-muted-foreground',
    };

    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold font-mono ${
          colors[substanceClass] || colors.D
        }`}
      >
        Class {substanceClass}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Drug Market</h1>
        <p className="text-muted-foreground mt-1">Active peer-to-peer substance listings</p>
      </div>

      {listings.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{listings.length}</span> active listings
        </div>
      )}

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-card border border-card-border" />
      ) : (
        <DataTable
          data={listings}
          columns={[
            {
              header: 'Listing ID',
              accessor: 'id',
              className: 'font-mono-tabular text-xs',
            },
            {
              header: 'Seller',
              accessor: (row) => (
                <div>
                  <div className="font-medium">
                    {row.sellerUsername ? `@${row.sellerUsername}` : 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono-tabular">
                    {row.sellerTelegramId}
                  </div>
                </div>
              ),
            },
            {
              header: 'Substance',
              accessor: (row) => (
                <div>
                  <div className="font-medium">{row.substanceName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {row.substanceKey}
                  </div>
                </div>
              ),
            },
            {
              header: 'Class',
              accessor: (row) => getClassBadge(row.substanceClass),
            },
            {
              header: 'Quantity',
              accessor: (row) => (
                <span className="font-mono-tabular font-semibold">
                  {row.quantity.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Price/Unit',
              accessor: (row) => (
                <span className="font-mono-tabular">
                  ${row.pricePerUnit.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Total Value',
              accessor: (row) => (
                <span className="font-mono-tabular font-semibold text-primary">
                  ${row.totalValue.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Listed',
              accessor: (row) =>
                formatDistanceToNow(new Date(row.listedAt), { addSuffix: true }),
              className: 'text-muted-foreground text-xs',
            },
            {
              header: 'Actions',
              accessor: (row) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeactivate(row);
                  }}
                  data-testid={`button-deactivate-${row.id}`}
                >
                  <XCircle className="h-3.5 w-3.5 text-destructive mr-1.5" />
                  Deactivate
                </Button>
              ),
            },
          ]}
          emptyMessage="No active market listings"
        />
      )}

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent data-testid="dialog-deactivate-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this listing for{' '}
              <span className="font-semibold">{selectedListing?.substanceName}</span>? The seller
              will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-deactivate">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={deactivate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-deactivate"
            >
              {deactivate.isPending ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
