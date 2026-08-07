'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { MaintenanceRecord, MaintenanceFormData, MaintenanceType, MaintenanceStatus, PaginatedMaintenance, Equipment } from '@/types';

const MAINT_TYPES: MaintenanceType[] = ['Preventive', 'Corrective', 'Calibration', 'Inspection'];
const MAINT_STATUSES: MaintenanceStatus[] = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

const TYPE_COLORS: Record<MaintenanceType, string> = {
  Preventive: 'bg-blue-100 text-blue-700',
  Corrective: 'bg-red-100 text-red-700',
  Calibration: 'bg-purple-100 text-purple-700',
  Inspection: 'bg-green-100 text-green-700',
};

const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  Scheduled: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
};

const emptyForm = (): MaintenanceFormData => ({
  equipment_id: '', type: 'Preventive', date: new Date().toISOString().slice(0, 10),
  performed_by: '', description: '', cost: '', status: 'Scheduled', next_date: '', notes: '',
});

interface MaintFormProps {
  initial: MaintenanceRecord | null;
  equipment: Equipment[];
  onSubmit: (f: MaintenanceFormData) => void;
  loading: boolean;
}

function MaintForm({ initial, equipment, onSubmit, loading }: MaintFormProps) {
  const [form, setForm] = useState<MaintenanceFormData>(
    initial ? {
      equipment_id: initial.equipment_id, type: initial.type, date: initial.date,
      performed_by: initial.performed_by ?? '', description: initial.description,
      cost: initial.cost ?? '', status: initial.status, next_date: initial.next_date ?? '',
      notes: initial.notes ?? '',
    } : emptyForm()
  );
  const set = <K extends keyof MaintenanceFormData>(k: K, v: MaintenanceFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Equipment *</label>
          <select className="input" value={form.equipment_id as string} onChange={(e) => set('equipment_id', e.target.value)} required>
            <option value="">-- Select Equipment --</option>
            {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}{eq.model ? ` (${eq.model})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as MaintenanceType)}>
            {MAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as MaintenanceStatus)}>
            {MAINT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Next Scheduled Date</label>
          <input type="date" className="input" value={form.next_date} onChange={(e) => set('next_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Performed By</label>
          <input className="input" value={form.performed_by} onChange={(e) => set('performed_by', e.target.value)} placeholder="Technician name" />
        </div>
        <div>
          <label className="label">Cost</label>
          <input type="number" step="0.01" min="0" className="input" value={form.cost as string} onChange={(e) => set('cost', e.target.value)} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          <label className="label">Description *</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} required placeholder="Describe the maintenance work..." />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update' : 'Add Record'}
        </button>
      </div>
    </form>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get<PaginatedMaintenance>(`/maintenance?${params}`);
      setRecords(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [search, typeFilter, statusFilter, page]);

  useEffect(() => {
    fetchRecords();
    api.get<{ items: Equipment[] }>('/equipment?limit=200').then((r) => setEquipment(r.data?.items ?? []));
  }, [fetchRecords]);

  const handleSave = async (form: MaintenanceFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/maintenance/${editItem.id}`, form); toast.success('Record updated'); }
      else { await api.post('/maintenance', form); toast.success('Record added'); }
      setFormModal(false); setEditItem(null); fetchRecords();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/maintenance/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchRecords(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const statusCounts = MAINT_STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: records.filter((r) => r.status === s).length }), {});

  return (
    <AppLayout title="Maintenance">
      <div className="space-y-4">
        {/* Status summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MAINT_STATUSES.map((s) => (
            <div key={s} className="card py-3 px-4 flex items-center gap-3">
              <span className={`badge ${STATUS_COLORS[s]}`}>{s}</span>
              <span className="text-lg font-bold text-gray-800">{statusCounts[s] ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search records..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[160px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {MAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {MAINT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add Record</button>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Equipment</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Performed By</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Cost</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Next Date</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No maintenance records found</td></tr>
                ) : records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{rec.equipment_name ?? `Equipment #${rec.equipment_id}`}</td>
                    <td className="table-cell"><span className={`badge ${TYPE_COLORS[rec.type as MaintenanceType] ?? 'bg-gray-100 text-gray-600'}`}>{rec.type}</span></td>
                    <td className="table-cell text-gray-600 text-sm">{new Date(rec.date).toLocaleDateString()}</td>
                    <td className="table-cell text-gray-500 text-sm">{rec.performed_by ?? '—'}</td>
                    <td className="table-cell text-gray-600 text-sm max-w-xs truncate">{rec.description}</td>
                    <td className="table-cell text-gray-500 text-sm">{rec.cost != null ? `Rs. ${Number(rec.cost).toFixed(2)}` : '—'}</td>
                    <td className="table-cell"><span className={`badge ${STATUS_COLORS[rec.status as MaintenanceStatus] ?? 'bg-gray-100 text-gray-600'}`}>{rec.status}</span></td>
                    <td className="table-cell text-gray-500 text-sm">{rec.next_date ? new Date(rec.next_date).toLocaleDateString() : '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {canEdit && <button onClick={() => { setEditItem(rec); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>}
                        {canDelete && <button onClick={() => setDeleteTarget(rec)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Record' : 'Add Maintenance Record'} size="lg">
        <MaintForm initial={editItem} equipment={equipment} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Record" message={`Delete this maintenance record?`} loading={saving} />
    </AppLayout>
  );
}
