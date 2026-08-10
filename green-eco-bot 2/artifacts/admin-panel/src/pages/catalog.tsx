import { useState } from 'react';
import {
  useListCatalogItems,
  getListCatalogItemsQueryKey,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from '@workspace/api-client-react';
import type { CatalogItem } from '@workspace/api-client-react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function Catalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useListCatalogItems({
    query: { queryKey: getListCatalogItemsQueryKey() },
  });

  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);

  const [formData, setFormData] = useState({
    botNetwork: '',
    name: '',
    description: '',
    price: '',
    category: '',
    emoji: '',
    isAvailable: true,
  });

  const resetForm = () => {
    setFormData({
      botNetwork: '',
      name: '',
      description: '',
      price: '',
      category: '',
      emoji: '',
      isAvailable: true,
    });
    setEditingItem(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setFormData({
      botNetwork: item.botNetwork,
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: item.category,
      emoji: item.emoji,
      isAvailable: item.isAvailable,
    });
    setDialogOpen(true);
  };

  const handleDelete = (item: CatalogItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = () => {
    const price = Number(formData.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: 'Invalid price',
        description: 'Please enter a valid price',
        variant: 'destructive',
      });
      return;
    }

    if (editingItem) {
      updateItem.mutate(
        {
          id: editingItem.id,
          data: {
            name: formData.name,
            description: formData.description,
            price,
            category: formData.category,
            emoji: formData.emoji,
            isAvailable: formData.isAvailable,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() });
            setDialogOpen(false);
            resetForm();
            toast({ title: 'Item updated successfully' });
          },
          onError: () => {
            toast({ title: 'Failed to update item', variant: 'destructive' });
          },
        }
      );
    } else {
      createItem.mutate(
        {
          data: {
            botNetwork: formData.botNetwork,
            name: formData.name,
            description: formData.description,
            price,
            category: formData.category,
            emoji: formData.emoji,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() });
            setDialogOpen(false);
            resetForm();
            toast({ title: 'Item created successfully' });
          },
          onError: () => {
            toast({ title: 'Failed to create item', variant: 'destructive' });
          },
        }
      );
    }
  };

  const confirmDelete = () => {
    if (!deletingItem) return;

    deleteItem.mutate(
      { id: deletingItem.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() });
          setDeleteDialogOpen(false);
          setDeletingItem(null);
          toast({ title: 'Item deleted successfully' });
        },
        onError: () => {
          toast({ title: 'Failed to delete item', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage items available for purchase</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-item">
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-card border border-card-border" />
      ) : (
        <DataTable
          data={items}
          columns={[
            {
              header: 'Network',
              accessor: 'botNetwork',
              className: 'font-mono text-xs',
            },
            {
              header: 'Item',
              accessor: (row) => (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{row.emoji}</span>
                  <span className="font-medium">{row.name}</span>
                </div>
              ),
            },
            {
              header: 'Description',
              accessor: 'description',
              className: 'text-muted-foreground text-sm max-w-md truncate',
            },
            {
              header: 'Category',
              accessor: (row) => (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {row.category}
                </span>
              ),
            },
            {
              header: 'Price',
              accessor: (row) => (
                <span className="font-mono-tabular font-semibold text-primary">
                  ${row.price.toLocaleString()}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Status',
              accessor: (row) => (
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    row.isAvailable
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {row.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              ),
            },
            {
              header: 'Actions',
              accessor: (row) => (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(row);
                    }}
                    data-testid={`button-edit-${row.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row);
                    }}
                    data-testid={`button-delete-${row.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl" data-testid="dialog-item-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Create Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingItem && (
              <div className="grid gap-2">
                <Label htmlFor="botNetwork">Bot Network</Label>
                <Input
                  id="botNetwork"
                  value={formData.botNetwork}
                  onChange={(e) => setFormData({ ...formData, botNetwork: e.target.value })}
                  placeholder="e.g., green-eco-main"
                  data-testid="input-botNetwork"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="font-mono-tabular"
                  data-testid="input-price"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emoji">Emoji</Label>
                <Input
                  id="emoji"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="e.g., 🌱"
                  data-testid="input-emoji"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                data-testid="input-category"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isAvailable">Available for Purchase</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle to control item visibility
                </p>
              </div>
              <Switch
                id="isAvailable"
                checked={formData.isAvailable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isAvailable: checked })
                }
                data-testid="switch-isAvailable"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-form">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createItem.isPending || updateItem.isPending}
              data-testid="button-save-item"
            >
              {createItem.isPending || updateItem.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteItem.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteItem.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
