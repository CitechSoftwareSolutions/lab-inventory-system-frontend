'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Chemical, ChemicalFormData, HazardClass, PhysicalState, PaginatedChemicals, Category, Supplier } from '@/types';

const HAZARD_CLASSES: HazardClass[] = [
  'Flammable', 'Corrosive', 'Toxic', 'Oxidizer', 'Explosive',
  'Irritant', 'Carcinogen', 'Environmental Hazard', 'Non-Hazardous',
];

const PHYSICAL_STATES: PhysicalState[] = ['Solid', 'Liquid', 'Gas', 'Solution'];

const HAZARD_COLORS: Record<HazardClass, string> = {
  Flammable: 'bg-orange-100 text-orange-700',
  Corrosive: 'bg-gray-100 text-gray-700',
  Toxic: 'bg-purple-100 text-purple-700',
  Oxidizer: 'bg-yellow-100 text-yellow-700',
  Explosive: 'bg-red-100 text-red-700',
  Irritant: 'bg-yellow-50 text-yellow-600',
  Carcinogen: 'bg-pink-100 text-pink-700',
  'Environmental Hazard': 'bg-green-100 text-green-700',
  'Non-Hazardous': 'bg-blue-50 text-blue-600',
};

const UNITS = ['g', 'kg', 'mg', 'ml', 'L', 'mol', 'mmol', 'µg', 'µl', 'pcs'];

function isExpired(date: string | null) { return !!date && new Date(date).getTime() < Date.now(); }
function isExpiringSoon(date: string | null) {
  if (!date) return false;
  const d = new Date(date).getTime() - Date.now();
  return d > 0 && d < 30 * 24 * 60 * 60 * 1000;
}

const emptyForm = (): ChemicalFormData => ({
  name: '', barcode: '', cas_number: '', molecular_formula: '', category_id: '',
  hazard_class: '', physical_state: '', concentration: '', quantity: '',
  min_quantity: 0, unit: 'ml', location: '', storage_temp: '',
  supplier_id: '', expiry_date: '', notes: '',
});

interface ChemFormProps {
  initial: Chemical | null;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: (f: ChemicalFormData) => void;
  loading: boolean;
}

function ChemForm({ initial, categories, suppliers, onSubmit, loading }: ChemFormProps) {
  const [form, setForm] = useState<ChemicalFormData>(
    initial ? {
      name: initial.name, barcode: initial.barcode ?? '', cas_number: initial.cas_number ?? '',
      molecular_formula: initial.molecular_formula ?? '', category_id: initial.category_id ?? '',
      hazard_class: initial.hazard_class ?? '', physical_state: initial.physical_state ?? '',
      concentration: initial.concentration ?? '', quantity: initial.quantity,
      min_quantity: initial.min_quantity, unit: initial.unit, location: initial.location ?? '',
      storage_temp: initial.storage_temp ?? '', supplier_id: initial.supplier_id ?? '',
      expiry_date: initial.expiry_date ?? '', notes: initial.notes ?? '',
    } : emptyForm()
  );
  const set = <K extends keyof ChemicalFormData>(k: K, v: ChemicalFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const chemCategories = categories.filter((c) => c.type === 'Chemicals');

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g., Hydrochloric Acid" />
        </div>
        <div>
          <label className="label">CAS Number</label>
          <input className="input" value={form.cas_number} onChange={(e) => set('cas_number', e.target.value)} placeholder="e.g., 7647-01-0" />
        </div>
        <div>
          <label className="label">Molecular Formula</label>
          <input className="input" value={form.molecular_formula} onChange={(e) => set('molecular_formula', e.target.value)} placeholder="e.g., HCl" />
        </div>
        <div className="col-span-2">
          <label className="label">Barcode</label>
          <input className="input" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Scan or type barcode (optional)" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category_id as string} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">-- None --</option>
            {chemCategories.map((c) => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ` : ''}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Hazard Class</label>
          <select className="input" value={form.hazard_class} onChange={(e) => set('hazard_class', e.target.value)}>
            <option value="">-- Select --</option>
            {HAZARD_CLASSES.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Physical State</label>
          <select className="input" value={form.physical_state} onChange={(e) => set('physical_state', e.target.value)}>
            <option value="">-- Select --</option>
            {PHYSICAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Concentration</label>
          <input className="input" value={form.concentration} onChange={(e) => set('concentration', e.target.value)} placeholder="e.g., 37%, 1M, Anhydrous" />
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" step="0.001" min="0" className="input" value={form.quantity as string} onChange={(e) => set('quantity', e.target.value)} required disabled={!!initial} />
          {initial && <p className="text-xs text-gray-400 mt-1">Use Transactions to adjust quantity</p>}
        </div>
        <div>
          <label className="label">Min Quantity (Alert)</label>
          <input type="number" step="0.001" min="0" className="input" value={form.min_quantity as string} onChange={(e) => set('min_quantity', e.target.value)} />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g., Flammable Cabinet A" />
        </div>
        <div>
          <label className="label">Storage Temp</label>
          <input className="input" value={form.storage_temp} onChange={(e) => set('storage_temp', e.target.value)} placeholder="e.g., 2–8°C, Room temp" />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">-- None --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expiry Date</label>
          <input type="date" className="input" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update' : 'Add Chemical'}
        </button>
      </div>
    </form>
  );
}

export default function ChemicalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Chemical[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hazardFilter, setHazardFilter] = useState('');
  const [physStateFilter, setPhysStateFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Chemical | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chemical | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canCreate = canEdit || user?.role === 'stock_keeper';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (hazardFilter) params.set('hazard_class', hazardFilter);
      if (physStateFilter) params.set('physical_state', physStateFilter);
      if (supplierFilter) params.set('supplier_id', supplierFilter);
      if (expiryFilter) params.set('expiry_filter', expiryFilter);
      const r = await api.get<PaginatedChemicals>(`/chemicals?${params}`);
      setItems(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [search, hazardFilter, physStateFilter, supplierFilter, expiryFilter, page]);

  useEffect(() => {
    fetchItems();
    api.get<Category[]>('/categories').then((r) => setCategories(r.data ?? []));
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
  }, [fetchItems]);

  const handleSave = async (form: ChemicalFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/chemicals/${editItem.id}`, form); toast.success('Chemical updated'); }
      else { await api.post('/chemicals', form); toast.success('Chemical added'); }
      setFormModal(false); setEditItem(null); fetchItems();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/chemicals/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchItems(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const expiredCount = items.filter((i) => isExpired(i.expiry_date)).length;
  const expiringSoonCount = items.filter((i) => isExpiringSoon(i.expiry_date)).length;
  const hazardousCount = items.filter((i) => i.hazard_class && i.hazard_class !== 'Non-Hazardous').length;
  const lowStockCount = items.filter((i) => i.quantity <= i.min_quantity).length;

  return (
    <AppLayout title="Chemicals">
      <div className="space-y-4">
        {/* Alert strip */}
        {(expiredCount > 0 || expiringSoonCount > 0 || lowStockCount > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {expiredCount > 0 && <div className="card py-3 px-4 border-l-4 border-red-500"><p className="text-xs text-gray-500">Expired</p><p className="text-xl font-bold text-red-600">{expiredCount}</p></div>}
            {expiringSoonCount > 0 && <div className="card py-3 px-4 border-l-4 border-yellow-500"><p className="text-xs text-gray-500">Expiring Soon</p><p className="text-xl font-bold text-yellow-600">{expiringSoonCount}</p></div>}
            {lowStockCount > 0 && <div className="card py-3 px-4 border-l-4 border-orange-500"><p className="text-xs text-gray-500">Low Stock</p><p className="text-xl font-bold text-orange-600">{lowStockCount}</p></div>}
            <div className="card py-3 px-4 border-l-4 border-purple-400"><p className="text-xs text-gray-500">Hazardous</p><p className="text-xl font-bold text-purple-700">{hazardousCount}</p></div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search name, CAS, formula, barcode…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[170px]" value={hazardFilter} onChange={(e) => { setHazardFilter(e.target.value); setPage(1); }}>
              <option value="">All Hazard Classes</option>
              {HAZARD_CLASSES.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <select className="input max-w-[150px]" value={physStateFilter} onChange={(e) => { setPhysStateFilter(e.target.value); setPage(1); }}>
              <option value="">All States</option>
              {PHYSICAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
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
          </div>
          {canCreate && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add Chemical</button>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">CAS / Formula</th>
                  <th className="table-header">Hazard</th>
                  <th className="table-header">State</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Expiry</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No chemicals found</td></tr>
                ) : items.map((item) => {
                  const expired = isExpired(item.expiry_date);
                  const soon = isExpiringSoon(item.expiry_date);
                  const low = item.quantity <= item.min_quantity;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${expired ? 'bg-red-50/30' : ''}`}>
                      <td className="table-cell font-medium">
                        {item.name}
                        {item.category_name && <p className="text-xs text-gray-400">{item.category_name}</p>}
                      </td>
                      <td className="table-cell text-xs text-gray-500">
                        {item.cas_number && <p>CAS: {item.cas_number}</p>}
                        {item.molecular_formula && <p className="font-mono">{item.molecular_formula}</p>}
                        {!item.cas_number && !item.molecular_formula && '—'}
                      </td>
                      <td className="table-cell">
                        {item.hazard_class
                          ? <span className={`badge ${HAZARD_COLORS[item.hazard_class as HazardClass] ?? 'bg-gray-100 text-gray-600'}`}>{item.hazard_class}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{item.physical_state ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <span className={`font-semibold ${low ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity}</span>
                          <span className="text-gray-400 text-xs">{item.unit}</span>
                          {low && <span className="badge bg-red-50 text-red-600 text-xs">Low</span>}
                        </div>
                        {item.concentration && <p className="text-xs text-gray-400">{item.concentration}</p>}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{item.location ?? '—'}</td>
                      <td className="table-cell">
                        {item.expiry_date ? (
                          <span className={`badge text-xs ${expired ? 'bg-red-100 text-red-700' : soon ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {expired ? '⚠ ' : soon ? '⏰ ' : ''}{new Date(item.expiry_date).toLocaleDateString()}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Chemical' : 'Add Chemical'} size="xl">
        <ChemForm initial={editItem} categories={categories} suppliers={suppliers} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Chemical" message={`Delete "${deleteTarget?.name}"?`} loading={saving} />
    </AppLayout>
  );
}
