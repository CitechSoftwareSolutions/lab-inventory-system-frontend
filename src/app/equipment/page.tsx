'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Equipment, EquipmentFormData, EquipmentStatus, PaginatedEquipment, Category, Supplier } from '@/types';

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  Available: 'bg-green-100 text-green-700',
  'In Use': 'bg-blue-100 text-blue-700',
  'Under Maintenance': 'bg-orange-100 text-orange-700',
  Retired: 'bg-gray-100 text-gray-500',
};

const STATUSES: EquipmentStatus[] = ['Available', 'In Use', 'Under Maintenance', 'Retired'];

function isCalibrationOverdue(date: string | null) { return !!date && new Date(date).getTime() < Date.now(); }
function isCalibrationSoon(date: string | null) {
  if (!date) return false;
  const d = new Date(date).getTime() - Date.now();
  return d > 0 && d < 30 * 24 * 60 * 60 * 1000;
}

const emptyForm = (): EquipmentFormData => ({
  name: '', model: '', serial_number: '', manufacturer: '', category_id: '',
  status: 'Available', location: '', purchase_date: '', purchase_price: '',
  supplier_id: '', warranty_expiry: '', last_calibration: '', next_calibration: '', notes: '',
});

interface EqFormProps {
  initial: Equipment | null;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: (f: EquipmentFormData) => void;
  loading: boolean;
}

function EqForm({ initial, categories, suppliers, onSubmit, loading }: EqFormProps) {
  const [form, setForm] = useState<EquipmentFormData>(
    initial ? {
      name: initial.name, model: initial.model ?? '', serial_number: initial.serial_number ?? '',
      manufacturer: initial.manufacturer ?? '', category_id: initial.category_id ?? '',
      status: initial.status, location: initial.location ?? '', purchase_date: initial.purchase_date ?? '',
      purchase_price: initial.purchase_price ?? '', supplier_id: initial.supplier_id ?? '',
      warranty_expiry: initial.warranty_expiry ?? '', last_calibration: initial.last_calibration ?? '',
      next_calibration: initial.next_calibration ?? '', notes: initial.notes ?? '',
    } : emptyForm()
  );
  const set = <K extends keyof EquipmentFormData>(k: K, v: EquipmentFormData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const eqCategories = categories.filter((c) => c.type === 'Equipment');

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g., Analytical Balance" />
        </div>
        <div>
          <label className="label">Model</label>
          <input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g., XS205" />
        </div>
        <div>
          <label className="label">Serial Number</label>
          <input className="input" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Manufacturer</label>
          <input className="input" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="e.g., Mettler-Toledo" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category_id as string} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">-- None --</option>
            {eqCategories.map((c) => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ` : ''}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as EquipmentStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g., Lab Room 3" />
        </div>
        <div>
          <label className="label">Purchase Date</label>
          <input type="date" className="input" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Purchase Price</label>
          <input type="number" step="0.01" min="0" className="input" value={form.purchase_price as string} onChange={(e) => set('purchase_price', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">-- None --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Warranty Expiry</label>
          <input type="date" className="input" value={form.warranty_expiry} onChange={(e) => set('warranty_expiry', e.target.value)} />
        </div>
        <div>
          <label className="label">Last Calibration</label>
          <input type="date" className="input" value={form.last_calibration} onChange={(e) => set('last_calibration', e.target.value)} />
        </div>
        <div>
          <label className="label">Next Calibration Due</label>
          <input type="date" className="input" value={form.next_calibration} onChange={(e) => set('next_calibration', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : initial ? 'Update' : 'Add Equipment'}</button>
      </div>
    </form>
  );
}

export default function EquipmentPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role !== 'lab_technician';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get<PaginatedEquipment>(`/equipment?${params}`);
      setItems(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchItems();
    api.get<Category[]>('/categories').then((r) => setCategories(r.data ?? []));
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
  }, [fetchItems]);

  const handleSave = async (form: EquipmentFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/equipment/${editItem.id}`, form); toast.success('Equipment updated'); }
      else { await api.post('/equipment', form); toast.success('Equipment added'); }
      setFormModal(false); setEditItem(null); fetchItems();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/equipment/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchItems(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const statusCounts = STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: items.filter((i) => i.status === s).length }), {});
  const calibDue = items.filter((i) => isCalibrationOverdue(i.next_calibration)).length;
  const calibSoon = items.filter((i) => isCalibrationSoon(i.next_calibration)).length;

  return (
    <AppLayout title="Equipment">
      <div className="space-y-4">
        {/* Status summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUSES.map((s) => (
            <div key={s} className="card py-3 px-4 flex items-center gap-3">
              <span className={`badge ${STATUS_COLORS[s]}`}>{s}</span>
              <span className="text-lg font-bold text-gray-800">{statusCounts[s] ?? 0}</span>
            </div>
          ))}
        </div>

        {(calibDue > 0 || calibSoon > 0) && (
          <div className="flex gap-3">
            {calibDue > 0 && <div className="card py-2 px-4 border-l-4 border-red-500 flex items-center gap-2"><span className="text-red-600 font-semibold">{calibDue}</span><span className="text-sm text-gray-500">calibration(s) overdue</span></div>}
            {calibSoon > 0 && <div className="card py-2 px-4 border-l-4 border-yellow-500 flex items-center gap-2"><span className="text-yellow-600 font-semibold">{calibSoon}</span><span className="text-sm text-gray-500">calibration(s) due soon</span></div>}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search equipment..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add Equipment</button>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Model / Serial</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Next Calibration</th>
                  <th className="table-header">Warranty</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No equipment found</td></tr>
                ) : items.map((item) => {
                  const calibOverdue = isCalibrationOverdue(item.next_calibration);
                  const calibSoonFlag = isCalibrationSoon(item.next_calibration);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        {item.name}
                        {item.manufacturer && <p className="text-xs text-gray-400">{item.manufacturer}</p>}
                        {item.category_name && <p className="text-xs text-gray-400">{item.category_name}</p>}
                      </td>
                      <td className="table-cell text-xs text-gray-500">
                        {item.model && <p>{item.model}</p>}
                        {item.serial_number && <p className="font-mono">SN: {item.serial_number}</p>}
                        {!item.model && !item.serial_number && '—'}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${STATUS_COLORS[item.status as EquipmentStatus] ?? 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{item.location ?? '—'}</td>
                      <td className="table-cell">
                        {item.next_calibration ? (
                          <span className={`badge text-xs ${calibOverdue ? 'bg-red-100 text-red-700' : calibSoonFlag ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {calibOverdue ? '⚠ ' : calibSoonFlag ? '⏰ ' : ''}{new Date(item.next_calibration).toLocaleDateString()}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell text-xs text-gray-500">
                        {item.warranty_expiry ? new Date(item.warranty_expiry).toLocaleDateString() : '—'}
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Equipment' : 'Add Equipment'} size="xl">
        <EqForm initial={editItem} categories={categories} suppliers={suppliers} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Equipment" message={`Delete "${deleteTarget?.name}"?`} loading={saving} />
    </AppLayout>
  );
}
