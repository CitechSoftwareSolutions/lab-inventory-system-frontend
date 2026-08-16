'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import type { Consumable, ConsumableFormData, PaginatedConsumables, Supplier, Category } from '@/types';

const UNITS = ['box', 'pack', 'roll', 'pcs', 'pair', 'set', 'bag', 'sheet'];

const emptyForm = (): ConsumableFormData => ({
  name: '', barcode: '', brand: '', category_id: '', batch_number: '', quantity: '',
  min_quantity: 0, unit: 'box', pack_size: '', expiry_date: '',
  location: '', supplier_id: '', price: '', notes: '',
});

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(date: string | null): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function ConsumableForm({ initial, suppliers, categories, onSubmit, loading }: {
  initial: Consumable | null; suppliers: Supplier[]; categories: Category[];
  onSubmit: (form: ConsumableFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<ConsumableFormData>(
    initial ? {
      name: initial.name, barcode: initial.barcode ?? '', brand: initial.brand ?? '',
      category_id: initial.category_id ?? '',
      batch_number: initial.batch_number ?? '', quantity: initial.quantity,
      min_quantity: initial.min_quantity, unit: initial.unit,
      pack_size: initial.pack_size ?? '', expiry_date: initial.expiry_date ?? '',
      location: initial.location ?? '', supplier_id: initial.supplier_id ?? '',
      price: initial.price ?? '', notes: initial.notes ?? '',
    } : emptyForm()
  );
  const set = <K extends keyof ConsumableFormData>(k: K, v: ConsumableFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name as string} onChange={(e) => set('name', e.target.value)} required placeholder="e.g., Nitrile Gloves Size M" />
        </div>
        <div className="col-span-2">
          <label className="label">Barcode</label>
          <input className="input" value={form.barcode as string} onChange={(e) => set('barcode', e.target.value)} placeholder="Scan or type barcode (optional)" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category_id as string} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ` : ''}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Brand</label>
          <input className="input" value={form.brand as string} onChange={(e) => set('brand', e.target.value)} placeholder="e.g., Kimberly-Clark" />
        </div>
        <div>
          <label className="label">Batch / Lot Number</label>
          <input className="input" value={form.batch_number as string} onChange={(e) => set('batch_number', e.target.value)} placeholder="e.g., LOT-2024-001" />
        </div>
        <div>
          <label className="label">Expiry Date</label>
          <input type="date" className="input" value={form.expiry_date as string} onChange={(e) => set('expiry_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" step="0.01" min="0" className="input" value={form.quantity as string}
            onChange={(e) => set('quantity', e.target.value)} required disabled={!!initial} />
          {initial && <p className="text-xs text-gray-400 mt-1">Use Stock Movements to adjust quantity</p>}
        </div>
        <div>
          <label className="label">Min Quantity (Alert)</label>
          <input type="number" step="0.01" min="0" className="input" value={form.min_quantity as string}
            onChange={(e) => set('min_quantity', e.target.value)} />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={form.unit as string} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Pack Size (items per unit)</label>
          <input type="number" step="1" min="1" className="input" value={form.pack_size as string}
            onChange={(e) => set('pack_size', e.target.value)} placeholder="e.g., 100" />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location as string} onChange={(e) => set('location', e.target.value)} placeholder="e.g., Store Room A" />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Price (per unit)</label>
          <input type="number" step="0.01" min="0" className="input" value={form.price as string}
            onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes as string} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update' : 'Add Consumable'}
        </button>
      </div>
    </form>
  );
}

export default function ConsumablesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Consumable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Consumable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Consumable | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (supplierFilter) params.set('supplier_id', supplierFilter);
      if (expiryFilter) params.set('expiry_filter', expiryFilter);
      if (lowStock) params.set('low_stock', 'true');
      const r = await api.get<PaginatedConsumables>(`/consumables?${params}`);
      setItems(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [search, categoryFilter, supplierFilter, expiryFilter, lowStock, page]);

  useEffect(() => {
    fetchItems();
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
    api.get<Category[]>('/categories?type=Consumables').then((r) => setCategories(r.data ?? []));
  }, [fetchItems]);

  const handleSave = async (form: ConsumableFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/consumables/${editItem.id}`, form); toast.success('Consumable updated'); }
      else { await api.post('/consumables', form); toast.success('Consumable added'); }
      setFormModal(false); setEditItem(null); fetchItems();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/consumables/${deleteTarget.id}`); toast.success('Consumable deleted'); setDeleteTarget(null); fetchItems(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const expiredCount = items.filter((i) => isExpired(i.expiry_date)).length;
  const expiringSoonCount = items.filter((i) => isExpiringSoon(i.expiry_date)).length;
  const lowStockCount = items.filter((i) => i.quantity <= i.min_quantity).length;

  return (
    <AppLayout title="Consumables">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card py-3 px-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
            <div><p className="text-xs text-gray-500">Expired</p><p className="text-lg font-bold text-gray-900">{expiredCount}</p></div>
          </div>
          <div className="card py-3 px-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
            <div><p className="text-xs text-gray-500">Expiring Soon (30d)</p><p className="text-lg font-bold text-gray-900">{expiringSoonCount}</p></div>
          </div>
          <div className="card py-3 px-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
            <div><p className="text-xs text-gray-500">Low Stock</p><p className="text-lg font-bold text-gray-900">{lowStockCount}</p></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search name, brand, batch, barcode…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[180px]" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input max-w-[160px]" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input max-w-[160px]" value={expiryFilter} onChange={(e) => { setExpiryFilter(e.target.value); setPage(1); }}>
              <option value="">All Expiry</option>
              <option value="expired">Expired</option>
              <option value="expiring_soon">Expiring Soon (30d)</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} className="rounded" />
              Low Stock
            </label>
          </div>
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add Consumable</button>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Brand</th>
                  <th className="table-header">Batch #</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Expiry</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No consumables found</td></tr>
                ) : items.map((item) => {
                  const expired = isExpired(item.expiry_date);
                  const soon = isExpiringSoon(item.expiry_date);
                  const isLow = item.quantity <= item.min_quantity;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{item.name}</td>
                      <td className="table-cell">
                        {item.category_name ? (
                          <span className="badge bg-purple-50 text-purple-700">{item.category_name}</span>
                        ) : '—'}
                      </td>
                      <td className="table-cell text-gray-500">{item.brand ?? '—'}</td>
                      <td className="table-cell text-gray-500 text-xs">{item.batch_number ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity} {item.unit}</span>
                          {isLow && <span className="badge bg-red-50 text-red-600 text-xs">Low</span>}
                        </div>
                        {item.pack_size && <p className="text-xs text-gray-400">{item.pack_size} per {item.unit}</p>}
                      </td>
                      <td className="table-cell text-xs">
                        {item.expiry_date ? (
                          <span className={`font-medium ${expired ? 'text-red-600' : soon ? 'text-yellow-600' : 'text-gray-700'}`}>
                            {format(new Date(item.expiry_date), 'dd MMM yyyy')}
                            {expired && ' (Expired)'}
                            {!expired && soon && ' (Soon)'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-cell text-gray-500">{item.location ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {canEdit && <button onClick={() => { setEditItem(item); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>}
                          {canDelete && <button onClick={() => setDeleteTarget(item)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-400">{total} records</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button className="btn-secondary py-1 px-3 text-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button className="btn-secondary py-1 px-3 text-sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Consumable' : 'Add Consumable'} size="lg">
        <ConsumableForm initial={editItem} suppliers={suppliers} categories={categories} onSubmit={handleSave} loading={saving} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Consumable" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} loading={saving} />
    </AppLayout>
  );
}
