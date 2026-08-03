'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { BorrowRecord, BorrowFormData, BorrowItemType, BorrowStatus, PaginatedBorrows, Item, Glassware, Equipment } from '@/types';

const ITEM_TYPES: BorrowItemType[] = ['Item', 'Glassware', 'Equipment'];

const STATUS_COLORS: Record<BorrowStatus, string> = {
  Borrowed: 'bg-blue-100 text-blue-700',
  Returned: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
};

type SimpleItem = { id: number; name: string };

function computeStatus(rec: BorrowRecord): BorrowStatus {
  if (rec.actual_return) return 'Returned';
  if (rec.expected_return && new Date(rec.expected_return).getTime() < Date.now()) return 'Overdue';
  return 'Borrowed';
}

const emptyForm = (): BorrowFormData => ({
  item_type: 'Item', item_id: '', borrower_name: '', borrower_id: '', department: '',
  quantity: 1, borrow_date: new Date().toISOString().slice(0, 10), expected_return: '', notes: '',
});

interface BorrowFormProps {
  initial: BorrowRecord | null;
  onSubmit: (f: BorrowFormData) => void;
  loading: boolean;
}

function BorrowForm({ initial, onSubmit, loading }: BorrowFormProps) {
  const [form, setForm] = useState<BorrowFormData>(
    initial ? {
      item_type: initial.item_type, item_id: initial.item_id, borrower_name: initial.borrower_name,
      borrower_id: initial.borrower_id ?? '', department: initial.department ?? '',
      quantity: initial.quantity, borrow_date: initial.borrow_date,
      expected_return: initial.expected_return ?? '', notes: initial.notes ?? '',
    } : emptyForm()
  );
  const [availableItems, setAvailableItems] = useState<SimpleItem[]>([]);
  const set = <K extends keyof BorrowFormData>(k: K, v: BorrowFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const endpoint = form.item_type === 'Item' ? '/items?limit=200'
      : form.item_type === 'Glassware' ? '/glassware?limit=200'
      : '/equipment?limit=200';
    api.get<{ items: SimpleItem[] }>(endpoint).then((r) => setAvailableItems(r.data?.items ?? [])).catch(() => setAvailableItems([]));
  }, [form.item_type]);

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Item Type *</label>
          <select className="input" value={form.item_type} onChange={(e) => { set('item_type', e.target.value as BorrowItemType); set('item_id', ''); }}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Item *</label>
          <select className="input" value={form.item_id as string} onChange={(e) => set('item_id', e.target.value)} required>
            <option value="">-- Select {form.item_type} --</option>
            {availableItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Borrower Name *</label>
          <input className="input" value={form.borrower_name} onChange={(e) => set('borrower_name', e.target.value)} required placeholder="Full name" />
        </div>
        <div>
          <label className="label">Borrower ID / Staff No.</label>
          <input className="input" value={form.borrower_id} onChange={(e) => set('borrower_id', e.target.value)} placeholder="Optional ID" />
        </div>
        <div>
          <label className="label">Department</label>
          <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g., Chemistry Dept." />
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" min="1" step="1" className="input" value={form.quantity as string} onChange={(e) => set('quantity', e.target.value)} required />
        </div>
        <div>
          <label className="label">Borrow Date *</label>
          <input type="date" className="input" value={form.borrow_date} onChange={(e) => set('borrow_date', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label">Expected Return Date</label>
          <input type="date" className="input" value={form.expected_return} onChange={(e) => set('expected_return', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : initial ? 'Update' : 'Record Borrow'}</button>
      </div>
    </form>
  );
}

export default function BorrowingPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<BorrowRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BorrowRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role !== 'viewer';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (itemTypeFilter) params.set('item_type', itemTypeFilter);
      const r = await api.get<PaginatedBorrows>(`/borrowing?${params}`);
      setRecords(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [statusFilter, itemTypeFilter, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSave = async (form: BorrowFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/borrowing/${editItem.id}`, form); toast.success('Record updated'); }
      else { await api.post('/borrowing', form); toast.success('Borrow recorded'); }
      setFormModal(false); setEditItem(null); fetchRecords();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleReturn = async (rec: BorrowRecord) => {
    setSaving(true);
    try {
      await api.put(`/borrowing/${rec.id}/return`);
      toast.success('Marked as returned');
      fetchRecords();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/borrowing/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchRecords(); }
    catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const overdueCount = records.filter((r) => computeStatus(r) === 'Overdue').length;
  const borrowedCount = records.filter((r) => computeStatus(r) === 'Borrowed').length;

  return (
    <AppLayout title="Borrowing">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card py-3 px-4 flex items-center gap-3">
            <span className="badge bg-blue-100 text-blue-700">Borrowed</span>
            <span className="text-lg font-bold text-gray-800">{borrowedCount}</span>
          </div>
          <div className={`card py-3 px-4 flex items-center gap-3 ${overdueCount > 0 ? 'border-l-4 border-red-500' : ''}`}>
            <span className="badge bg-red-100 text-red-700">Overdue</span>
            <span className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{overdueCount}</span>
          </div>
          <div className="card py-3 px-4 flex items-center gap-3">
            <span className="badge bg-green-100 text-green-700">Total</span>
            <span className="text-lg font-bold text-gray-800">{total}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="Borrowed">Borrowed</option>
              <option value="Overdue">Overdue</option>
              <option value="Returned">Returned</option>
            </select>
            <select className="input max-w-[160px]" value={itemTypeFilter} onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Item Types</option>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Record Borrow</button>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Item</th>
                  <th className="table-header">Borrower</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Borrow Date</th>
                  <th className="table-header">Expected Return</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No borrowing records found</td></tr>
                ) : records.map((rec) => {
                  const status = computeStatus(rec);
                  return (
                    <tr key={rec.id} className={`hover:bg-gray-50 ${status === 'Overdue' ? 'bg-red-50/20' : ''}`}>
                      <td className="table-cell font-medium">
                        {rec.item_name ?? `${rec.item_type} #${rec.item_id}`}
                        <p className="text-xs text-gray-400">{rec.item_type}</p>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-gray-800">{rec.borrower_name}</p>
                        {rec.department && <p className="text-xs text-gray-400">{rec.department}</p>}
                        {rec.borrower_id && <p className="text-xs text-gray-400">ID: {rec.borrower_id}</p>}
                      </td>
                      <td className="table-cell text-gray-700">{rec.quantity}</td>
                      <td className="table-cell text-gray-500 text-sm">{new Date(rec.borrow_date).toLocaleDateString()}</td>
                      <td className="table-cell text-sm">
                        {rec.expected_return
                          ? <span className={status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-gray-500'}>{new Date(rec.expected_return).toLocaleDateString()}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${STATUS_COLORS[status]}`}>{status}</span>
                        {rec.actual_return && <p className="text-xs text-gray-400 mt-1">Returned: {new Date(rec.actual_return).toLocaleDateString()}</p>}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2 flex-wrap">
                          {canEdit && status !== 'Returned' && (
                            <button onClick={() => handleReturn(rec)} disabled={saving} className="text-xs btn-primary py-1 px-2">Return</button>
                          )}
                          {canEdit && <button onClick={() => { setEditItem(rec); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>}
                          {user?.role === 'admin' && <button onClick={() => setDeleteTarget(rec)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Record' : 'Record Borrow'} size="md">
        <BorrowForm initial={editItem} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Record" message="Delete this borrowing record?" loading={saving} />
    </AppLayout>
  );
}
