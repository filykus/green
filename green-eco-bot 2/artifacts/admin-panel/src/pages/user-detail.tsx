import { useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useGetAdminUser,
  getGetAdminUserQueryKey,
  useUpdateAdminUser,
} from '@workspace/api-client-react';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, DollarSign, Scale, Shield, Leaf, Package, ShoppingBag, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function UserDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const telegramId = params.telegramId ? Number(params.telegramId) : 0;

  const { data, isLoading } = useGetAdminUser(telegramId, {
    query: {
      enabled: !!telegramId,
      queryKey: getGetAdminUserQueryKey(telegramId),
    },
  });

  const updateUser = useUpdateAdminUser();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editField, setEditField] = useState<'balance' | 'lawfulness'>('balance');
  const [editValue, setEditValue] = useState('');

  const handleEdit = (field: 'balance' | 'lawfulness') => {
    if (!data) return;
    setEditField(field);
    setEditValue(String(data.user[field]));
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    const numValue = Number(editValue);
    if (isNaN(numValue)) {
      toast({
        title: 'Invalid value',
        description: 'Please enter a valid number',
        variant: 'destructive',
      });
      return;
    }

    updateUser.mutate(
      {
        telegramId,
        data: { [editField]: numValue },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(telegramId) });
          setEditDialogOpen(false);
          toast({
            title: 'Updated',
            description: `User ${editField} updated successfully`,
          });
        },
        onError: () => {
          toast({
            title: 'Error',
            description: `Failed to update ${editField}`,
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded bg-card" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card border border-card-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">User not found</h2>
          <p className="text-muted-foreground mt-2">The requested user does not exist</p>
          <Button onClick={() => setLocation('/users')} className="mt-4">
            Back to Players
          </Button>
        </div>
      </div>
    );
  }

  const { user, policeData, dealerData, inventoryValue, purchasedItems } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/users')}
          data-testid="button-back-to-users"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.firstName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {user.username && <span>@{user.username}</span>}
            <span className="font-mono-tabular">ID: {user.telegramId}</span>
            <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <span
            className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
              user.policeUnlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Police {user.policeUnlocked ? 'Active' : 'Locked'}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
              user.dealerUnlocked ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Leaf className="mr-1.5 h-3.5 w-3.5" />
            Dealer {user.dealerUnlocked ? 'Active' : 'Locked'}
          </span>
        </div>
      </div>

      {/* Core Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <StatCard label="Balance" value={`$${user.balance.toLocaleString()}`} icon={DollarSign} />
          <Button
            size="sm"
            variant="outline"
            className="absolute top-3 right-3"
            onClick={() => handleEdit('balance')}
            data-testid="button-edit-balance"
          >
            Edit
          </Button>
        </div>
        <div className="relative">
          <StatCard
            label="Lawfulness"
            value={user.lawfulness > 0 ? `+${user.lawfulness}` : user.lawfulness}
            icon={Scale}
          />
          <Button
            size="sm"
            variant="outline"
            className="absolute top-3 right-3"
            onClick={() => handleEdit('lawfulness')}
            data-testid="button-edit-lawfulness"
          >
            Edit
          </Button>
        </div>
        <StatCard label="Inventory Value" value={`$${inventoryValue.toLocaleString()}`} icon={Package} />
        <StatCard label="Items Purchased" value={purchasedItems} icon={ShoppingBag} />
      </div>

      {/* Police Stats */}
      {user.policeUnlocked && (
        <div className="rounded-lg border border-card-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Police Career
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Rank</p>
              <p className="mt-2 text-2xl font-bold capitalize">
                {policeData.rank || 'Recruit'}
              </p>
            </div>
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Missions Completed</p>
              <p className="mt-2 text-2xl font-bold font-mono-tabular">
                {policeData.missionsCompleted} / {policeData.totalMissions}
              </p>
            </div>
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Station Level</p>
              <p className="mt-2 text-2xl font-bold font-mono-tabular">
                {policeData.stationLevel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dealer Stats */}
      {user.dealerUnlocked && (
        <div className="rounded-lg border border-card-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-accent" />
            Dealer Operations
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Farm Level</p>
              <p className="mt-2 text-2xl font-bold font-mono-tabular">
                {dealerData.farmLevel}
              </p>
            </div>
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Workers</p>
              <p className="mt-2 text-2xl font-bold font-mono-tabular">
                {dealerData.workersCount}
              </p>
            </div>
            <div className="rounded-md border border-card-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Last Harvest</p>
              <p className="mt-2 text-lg font-medium">
                {dealerData.lastHarvest
                  ? formatDistanceToNow(new Date(dealerData.lastHarvest), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Edit {editField === 'balance' ? 'Balance' : 'Lawfulness'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">
                {editField === 'balance' ? 'New Balance ($)' : 'New Lawfulness'}
              </Label>
              <Input
                id="edit-value"
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono-tabular"
                data-testid="input-edit-value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateUser.isPending} data-testid="button-save-edit">
              {updateUser.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
