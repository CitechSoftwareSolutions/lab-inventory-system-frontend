'use client';
import { useEffect, useState, useCallback, FormEvent, useRef } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type {
  Transaction, MovementType, StockItemType, StockMovementFormData,
  PaginatedTransactions, Chemical, Glassware, Consumable,
} from '@/types';
import { MOVEMENT_LABELS, MOVEMENT_DIRECTION } from '@/types';

const ALL_TYPES: MovementType[] = [
  'PURCHASE', 'USAGE', 'BRANCH_TRANSFER', 'BRANCH_RECEIPT',
  'EXPIRY_DISPOSAL', 'SUPPLIER_RETURN', 'ADJUSTMENT',
];

const TYPE_COLORS: Record<MovementType, string> = {
  PURCHASE: 'bg-green-100 text-green-700',
  USAGE: 'bg-blue-100 text-blue-700',
  BRANCH_TRANSFER: 'bg-orange-100 text-orange-700',
  BRANCH_RECEIPT: 'bg-teal-100 text-teal-700',
  EXPIRY_DISPOSAL: 'bg-red-100 text-red-700',
  SUPPLIER_RETURN: 'bg-purple-100 text-purple-700',
  ADJUSTMENT: 'bg-gray-100 text-gray-700',
};

const DIR_COLORS = {
  IN: 'text-green-600 font-semibold',
  OUT: 'text-red-600 font-semibold',
  ADJUST: 'text-gray-600 font-semibold',
};

type InventoryItem = { id: number; name: string; unit?: string | null; quantity?: number | null };

function MovementForm({ onSubmit, loading }: { onSubmit: (f: StockMovementFormData) => void; loading: boolean }) {
  const [form, setForm] = useState<StockMovementFormData>({
    item_type: 'Chemical', item_id: '', type: 'USAGE', quantity: '', reference_number: '', notes: '',
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const set = <K extends keyof StockMovementFormData>(k: K, v: StockMovementFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const ENDPOINTS: Record<StockItemType, string> = {
    Chemical: '/chemicals?limit=200',
    Glassware: '/glassware?limit=200',
    Consumable: '/consumables?limit=200',
  };

  useEffect(() => {
    setForm((f) => ({ ...f, item_id: '' }));
    setItemsLoading(true);
    api.get<{ items: InventoryItem[] }>(ENDPOINTS[form.item_type])
      .then((r) => setItems(r.data?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setItemsLoading(false));
  }, [form.item_type]);

  const selectedItem = items.find((i) => i.id === Number(form.item_id));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Item Type *</label>
          <select className="input" value={form.item_type} onChange={(e) => set('item_type', e.target.value as StockItemType)}>
            <option value="Chemical">Chemical</option>
            <option value="Glassware">Glassware</option>
            <option value="Consumable">Consumable</option>
          </select>
        </div>
        <div>
          <label className="label">Movement Type *</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as MovementType)}>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Item *</label>
          <select className="input" value={form.item_id as string} onChange={(e) => set('item_id', e.target.value)} required disabled={itemsLoading}>
            <option value="">{itemsLoading ? 'Loading...' : '— Select Item —'}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}{i.quantity != null ? ` (stock: ${i.quantity} ${i.unit ?? ''})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" step="0.001" min="0.001" className="input" value={form.quantity as string}
            onChange={(e) => set('quantity', e.target.value)} required placeholder="e.g., 50" />
          {selectedItem?.unit && <p className="text-xs text-gray-400 mt-1">Unit: {selectedItem.unit}</p>}
        </div>
        <div>
          <label className="label">Reference #</label>
          <input className="input" value={form.reference_number} onChange={(e) => set('reference_number', e.target.value)} placeholder="e.g., ORD-001, LAB-EXP-023" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Reason, destination, experiment name..." />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
        Direction: <strong>{MOVEMENT_DIRECTION[form.type]}</strong> — {MOVEMENT_LABELS[form.type]}
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Recording...' : 'Record Movement'}</button>
      </div>
    </form>
  );
}

export default function StockMovementsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (typeFilter) params.set('type', typeFilter);
      if (itemTypeFilter) params.set('item_type', itemTypeFilter);
      if (search) params.set('search', search);
      const r = await api.get<PaginatedTransactions>(`/stock-movements?${params}`);
      setRecords(r.data?.transactions ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [typeFilter, itemTypeFilter, search, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleCreate = async (form: StockMovementFormData) => {
    setSaving(true);
    try {
      await api.post('/stock-movements', {
        item_type: form.item_type,
        item_id: Number(form.item_id),
        type: form.type,
        quantity: Number(form.quantity),
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Movement recorded');
      setFormModal(false);
      fetchRecords();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const inCount = records.filter((r) => MOVEMENT_DIRECTION[r.type as MovementType] === 'IN').length;
  const outCount = records.filter((r) => MOVEMENT_DIRECTION[r.type as MovementType] === 'OUT').length;

  return (
    <AppLayout title="Stock Movements">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card py-3 px-4 border-l-4 border-green-400">
            <p className="text-xs text-gray-500">Stock In (page)</p>
            <p className="text-xl font-bold text-green-600">{inCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-red-400">
            <p className="text-xs text-gray-500">Stock Out (page)</p>
            <p className="text-xl font-bold text-red-600">{outCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-gray-400">
            <p className="text-xs text-gray-500">Total Records</p>
            <p className="text-xl font-bold text-gray-700">{total}</p>
          </div>
        </div>

        {/* Filters + Record button */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input className="input max-w-xs" placeholder="Search by item name..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="input max-w-[160px]" value={itemTypeFilter} onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Item Types</option>
              <option value="Chemical">Chemical</option>
              <option value="Glassware">Glassware</option>
              <option value="Consumable">Consumable</option>
            </select>
            <select className="input max-w-[220px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Movement Types</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={() => setFormModal(true)}>+ Record Movement</button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Movement</th>
                  <th className="table-header">Dir</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Before → After</th>
                  <th className="table-header">Reference</th>
                  <th className="table-header">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No records found</td></tr>
                ) : records.map((rec) => {
                  const mvType = rec.type as MovementType;
                  const dir = MOVEMENT_DIRECTION[mvType] ?? 'ADJUST';
                  return (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                        {new Date(rec.created_at).toLocaleString()}
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-gray-900">{rec.item_name ?? `#${rec.item_id}`}</p>
                        {rec.item_type && <p className="text-xs text-gray-400">{rec.item_type}</p>}
                      </td>
                      <td className="table-cell text-xs text-gray-500">{rec.item_type}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${TYPE_COLORS[mvType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {MOVEMENT_LABELS[mvType] ?? rec.type}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={DIR_COLORS[dir]}>
                          {dir === 'IN' ? '↑' : dir === 'OUT' ? '↓' : '↕'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold ${dir === 'IN' ? 'text-green-600' : dir === 'OUT' ? 'text-red-600' : 'text-gray-700'}`}>
                          {dir === 'IN' ? '+' : dir === 'OUT' ? '-' : '±'}{rec.quantity}
                          {rec.unit && <span className="text-xs text-gray-400 ml-1">{rec.unit}</span>}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-gray-500 font-mono">
                        {rec.quantity_before ?? '?'} → {rec.quantity_after ?? '?'}
                      </td>
                      <td className="table-cell text-xs text-gray-500">{rec.reference_number ?? '—'}</td>
                      <td className="table-cell text-xs text-gray-500">{rec.performed_by_name ?? '—'}</td>
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

      <Modal open={formModal} onClose={() => setFormModal(false)} title="Record Stock Movement" size="md">
        <MovementForm onSubmit={handleCreate} loading={saving} />
      </Modal>
    </AppLayout>
  );
}
