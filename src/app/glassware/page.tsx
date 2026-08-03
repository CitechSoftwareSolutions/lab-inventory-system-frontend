'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Glassware, GlasswareFormData, GlasswareCondition, PaginatedGlassware, Category, Supplier } from '@/types';

const MATERIALS = ['Borosilicate Glass', 'Soda-Lime Glass', 'Quartz Glass', 'Plastic', 'Porcelain'];
const CAPACITY_UNITS = ['ml', 'L', 'μL'];

const CONDITION_COLORS: Record<GlasswareCondition, string> = {
  Good: 'bg-green-100 text-green-700',
  Fair: 'bg-yellow-100 text-yellow-700',
  Poor: 'bg-orange-100 text-orange-700',
  Broken: 'bg-red-100 text-red-700',
};

const CONDITIONS: GlasswareCondition[] = ['Good', 'Fair', 'Poor', 'Broken'];

const emptyForm = (): GlasswareFormData => ({
  name: '', category_id: '', capacity: '', capacity_unit: 'ml', material: 'Borosilicate Glass',
  quantity: '', min_quantity: 0, condition: 'Good', location: '', supplier_id: '', purchase_date: '', notes: '',
});

function GlasswareForm({ initial, categories, suppliers, onSubmit, loading }: {
  initial: Glassware | null; categories: Category[]; suppliers: Supplier[];
  onSubmit: (form: GlasswareFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<GlasswareFormData>(
    initial ? {
      name: initial.name, category_id: initial.category_id ?? '',
      capacity: initial.capacity ?? '', capacity_unit: initial.capacity_unit || 'ml',
      material: initial.material ?? 'Borosilicate Glass', quantity: initial.quantity,
      min_quantity: initial.min_quantity, condition: initial.condition,
      location: initial.location ?? '', supplier_id: initial.supplier_id ?? '',
      purchase_date: initial.purchase_date ?? '', notes: initial.notes ?? '',
    } : emptyForm()
  );
  const set = <K extends keyof GlasswareFormData>(k: K, v: GlasswareFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name as string} onChange={(e) => set('name', e.target.value)} required placeholder="e.g., 250ml Beaker" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category_id as string} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ` : ''}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Material</label>
          <select className="input" value={form.material as string} onChange={(e) => set('material', e.target.value)}>
            {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Capacity</label>
          <input type="number" step="0.01" min="0" className="input" value={form.capacity as string}
            onChange={(e) => set('capacity', e.target.value)} placeholder="e.g., 250" />
        </div>
        <div>
          <label className="label">Capacity Unit</label>
          <select className="input" value={form.capacity_unit as string} onChange={(e) => set('capacity_unit', e.target.value)}>
            {CAPACITY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" step="1" min="0" className="input" value={form.quantity as string}
            onChange={(e) => set('quantity', e.target.value)} required disabled={!!initial} />
          {initial && <p className="text-xs text-gray-400 mt-1">Use Stock Movements to adjust quantity</p>}
        </div>
        <div>
          <label className="label">Min Quantity (Alert)</label>
          <input type="number" step="1" min="0" className="input" value={form.min_quantity as string}
            onChange={(e) => set('min_quantity', e.target.value)} />
        </div>
        <div>
          <label className="label">Condition</label>
          <select className="input" value={form.condition as string} onChange={(e) => set('condition', e.target.value)}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location as string} onChange={(e) => set('location', e.target.value)} placeholder="e.g., Cabinet B-2" />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Purchase Date</label>
          <input type="date" className="input" value={form.purchase_date as string} onChange={(e) => set('purchase_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes as string} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : initial ? 'Update' : 'Add Glassware'}</button>
      </div>
    </form>
  );
}

export default function GlasswarePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Glassware[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Glassware | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Glassware | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role !== 'lab_technician';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (conditionFilter) params.set('condition', conditionFilter);
      const r = await api.get<PaginatedGlassware>(`/glassware?${params}`);
      setItems(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [search, categoryFilter, conditionFilter, page]);

  useEffect(() => {
    fetchItems();
    api.get<Category[]>('/categories?type=Glassware').then((r) => setCategories(r.data ?? []));
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
  }, [fetchItems]);

  const handleSave = async (form: GlasswareFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/glassware/${editItem.id}`, form); toast.success('Glassware updated'); }
      else { await api.post('/glassware', form); toast.success('Glassware added'); }
      setFormModal(false); setEditItem(null); fetchItems();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/glassware/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchItems(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title="Glassware">
      <div className="space-y-4">
        {/* Condition summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CONDITIONS.map((c) => {
            const count = items.filter((i) => i.condition === c).length;
            return (
              <div key={c} className="card py-3 px-4 flex items-center gap-3">
                <span className={`badge ${CONDITION_COLORS[c]}`}>{c}</span>
                <span className="text-lg font-bold text-gray-800">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search glassware..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[200px]" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input max-w-[160px]" value={conditionFilter} onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}>
              <option value="">All Conditions</option>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add Glassware</button>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Capacity</th>
                  <th className="table-header">Material</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Condition</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No glassware found</td></tr>
                ) : items.map((item) => {
                  const isLow = item.quantity <= item.min_quantity;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{item.name}</td>
                      <td className="table-cell text-gray-500 text-sm">{item.category_name ?? '—'}</td>
                      <td className="table-cell text-gray-500">
                        {item.capacity ? `${item.capacity} ${item.capacity_unit}` : '—'}
                      </td>
                      <td className="table-cell text-gray-500 text-xs">{item.material ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity}</span>
                          {isLow && <span className="badge bg-red-50 text-red-600 text-xs">Low</span>}
                        </div>
                        <p className="text-xs text-gray-400">Min: {item.min_quantity}</p>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${CONDITION_COLORS[item.condition as GlasswareCondition] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.condition}
                        </span>
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Glassware' : 'Add Glassware'} size="lg">
        <GlasswareForm initial={editItem} categories={categories} suppliers={suppliers} onSubmit={handleSave} loading={saving} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Glassware" message={`Delete "${deleteTarget?.name}"?`} loading={saving} />
    </AppLayout>
  );
}
