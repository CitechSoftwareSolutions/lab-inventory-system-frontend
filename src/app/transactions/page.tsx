'use client';
import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import type {
  SupplyTransaction, SupplyTxFormData, SupplyTxType, PaginatedSupplyTransactions,
  StockItemType, Supplier, Branch, ApprovalStatus,
} from '@/types';
import { SUPPLY_TX_LABELS, SUPPLY_TX_DIRECTION } from '@/types';

const ITEM_TYPES: StockItemType[] = ['Chemical', 'Glassware', 'Consumable'];
const TX_TYPES: SupplyTxType[] = ['SUPPLY_OUT', 'BRANCH_OUT', 'BRANCH_IN'];

const ENDPOINTS: Record<StockItemType, string> = {
  Chemical:   '/chemicals?limit=500',
  Glassware:  '/glassware?limit=500',
  Consumable: '/consumables?limit=500',
};

type InventoryItem = { id: number; name: string; unit?: string | null };

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
  Pending:  'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const emptyForm = (): SupplyTxFormData => ({
  item_type: 'Chemical', item_id: '', type: 'SUPPLY_OUT',
  quantity: '', supplier_id: '', related_branch_id: '', reference_number: '', notes: '',
});

// ─── Searchable select combobox ────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder, required }: {
  options: { id: number; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.id) === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: number) => {
    onChange(String(id));
    setSearch('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div
        className="input flex items-center gap-2 cursor-text"
        onClick={() => { setOpen(true); }}
      >
        <input
          className="flex-1 min-w-0 outline-none bg-transparent text-sm"
          placeholder={selected ? selected.label : placeholder}
          value={open ? search : (selected?.label ?? '')}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-2">No results</p>
          ) : filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(o.id)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                String(o.id) === value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {/* invisible input so HTML required validation works */}
      <input className="sr-only" tabIndex={-1} value={value} required={required} onChange={() => {}} />
    </div>
  );
}

// ─── Transaction form ──────────────────────────────────────────────────────────

function TransactionForm({ suppliers, branches, onSubmit, loading }: {
  suppliers: Supplier[]; branches: Branch[];
  onSubmit: (f: SupplyTxFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<SupplyTxFormData>(emptyForm());
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    setForm((f) => ({ ...f, item_id: '' }));
    api.get<{ items: InventoryItem[] }>(ENDPOINTS[form.item_type])
      .then((r) => setItems(r.data?.items ?? []))
      .catch(() => setItems([]));
  }, [form.item_type]);

  const set = <K extends keyof SupplyTxFormData>(k: K, v: SupplyTxFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const needsSupplier = form.type === 'SUPPLY_OUT';
  const needsBranch = form.type === 'BRANCH_OUT' || form.type === 'BRANCH_IN';

  const branchOptions = branches.map((b) => ({
    id: b.id,
    label: b.name + (b.code ? ` (${b.code})` : ''),
  }));

  const supplierOptions = suppliers.map((s) => ({ id: s.id, label: s.name }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Item Type *</label>
          <select className="input" value={form.item_type} onChange={(e) => set('item_type', e.target.value as StockItemType)}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Transaction Type *</label>
          <select className="input" value={form.type} onChange={(e) => { set('type', e.target.value as SupplyTxFormData['type']); set('supplier_id', ''); set('related_branch_id', ''); }}>
            {TX_TYPES.map((t) => <option key={t} value={t}>{SUPPLY_TX_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Item *</label>
          <select className="input" value={form.item_id as string} onChange={(e) => set('item_id', e.target.value)} required>
            <option value="">{items.length ? '— Select Item —' : 'Loading...'}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.unit ? ` (${i.unit})` : ''}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Quantity *</label>
          <input type="number" step="0.001" min="0.001" className="input" value={form.quantity as string}
            onChange={(e) => set('quantity', e.target.value)} placeholder="0" required />
        </div>
        {needsSupplier && (
          <div className="col-span-2">
            <label className="label">Supplier *</label>
            {supplierOptions.length > 0 ? (
              <SearchSelect
                options={supplierOptions}
                value={form.supplier_id as string}
                onChange={(v) => set('supplier_id', v)}
                placeholder="Search supplier..."
                required
              />
            ) : (
              <input type="number" className="input" value={form.supplier_id as string}
                onChange={(e) => set('supplier_id', e.target.value)}
                placeholder="Enter supplier ID" required />
            )}
          </div>
        )}
        {needsBranch && (
          <div className="col-span-2">
            <label className="label">
              {form.type === 'BRANCH_IN' ? 'Source Branch *' : 'Destination Branch *'}
            </label>
            {branchOptions.length > 0 ? (
              <SearchSelect
                options={branchOptions}
                value={form.related_branch_id as string}
                onChange={(v) => set('related_branch_id', v)}
                placeholder="Search branch..."
                required
              />
            ) : (
              <input type="number" className="input" value={form.related_branch_id as string}
                onChange={(e) => set('related_branch_id', e.target.value)}
                placeholder="Enter branch ID" required />
            )}
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional notes..." />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Submitting...' : 'Submit Transaction'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<SupplyTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SupplyTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; run: () => void } | null>(null);

  const isManager = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canCreate = isManager || user?.role === 'stock_keeper';

  const fetchTx = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (typeFilter) params.set('type', typeFilter);
      if (approvalFilter) params.set('approval_status', approvalFilter);
      const r = await api.get<PaginatedSupplyTransactions>(`/transactions?${params}`);
      setTransactions(r.data?.transactions ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [typeFilter, approvalFilter, page]);

  useEffect(() => {
    fetchTx();
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? [])).catch(() => {});
    api.get<Branch[]>('/branches').then((r) => setBranches(r.data ?? [])).catch(() => {});
  }, [fetchTx]);

  const handleCreate = async (form: SupplyTxFormData) => {
    setSaving(true);
    try {
      const payload = {
        item_type: form.item_type,
        item_id: Number(form.item_id),
        type: form.type,
        quantity: Number(form.quantity),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
        related_branch_id: form.related_branch_id ? Number(form.related_branch_id) : undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
      };
      await api.post('/transactions', payload);
      toast.success('Transaction submitted');
      setFormModal(false); fetchTx();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleApprove = async (tx: SupplyTransaction) => {
    setActionLoading(String(tx.id));
    try {
      await api.put(`/transactions/${tx.id}/approve`);
      toast.success('Transaction approved — stock updated');
      fetchTx();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectionReason.trim()) return;
    setSaving(true);
    try {
      await api.put(`/transactions/${rejectTarget.id}/reject`, { reason: rejectionReason.trim() });
      toast.success('Transaction rejected');
      setRejectTarget(null); setRejectionReason(''); fetchTx();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <AppLayout title="Transactions">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <select className="input max-w-[200px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {TX_TYPES.map((t) => <option key={t} value={t}>{SUPPLY_TX_LABELS[t]}</option>)}
            </select>
            <select className="input max-w-[180px]" value={approvalFilter} onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}>
              <option value="">All Approvals</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          {canCreate && (
            <button className="btn-primary" onClick={() => setFormModal(true)}>+ New Transaction</button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">Before</th>
                  <th className="table-header">After</th>
                  <th className="table-header">Supplier / Branch</th>
                  <th className="table-header">By</th>
                  <th className="table-header">Approval</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">No transactions found</td></tr>
                ) : transactions.map((tx) => {
                  const dir = SUPPLY_TX_DIRECTION[tx.type];
                  const isPending = tx.approval_status === 'Pending';
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                        {format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          dir === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {SUPPLY_TX_LABELS[tx.type]}
                        </span>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-sm">{tx.item_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{tx.item_type}</p>
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold text-sm ${dir === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                          {dir === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit ?? ''}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500 text-sm">
                        {isPending ? <span className="text-gray-300">—</span> : (tx.quantity_before ?? '—')}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">
                        {isPending ? <span className="text-gray-300">—</span> : (tx.quantity_after ?? '—')}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">
                        {tx.supplier_name ?? tx.related_branch_name ?? '—'}
                      </td>
                      <td className="table-cell text-gray-400 text-xs">{tx.performed_by_name ?? '—'}</td>
                      <td className="table-cell">
                        <span className={`badge ${APPROVAL_COLORS[tx.approval_status]}`}>{tx.approval_status}</span>
                      </td>
                      <td className="table-cell">
                        {isManager && tx.approval_status === 'Pending' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirmState({ title: 'Approve Transfer', message: `Approve this ${SUPPLY_TX_LABELS[tx.type]} of ${tx.quantity}? Stock will be updated immediately.`, run: () => handleApprove(tx) })}
                              disabled={actionLoading === String(tx.id)}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1 px-2 flex items-center gap-1">
                              {actionLoading === String(tx.id) && <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                              Approve</button>
                            <button onClick={() => { setRejectTarget(tx); setRejectionReason(''); }}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg py-1 px-2">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-400">{total} transactions</span>
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

      <Modal open={formModal} onClose={() => setFormModal(false)} title="New Transaction" size="md">
        <TransactionForm suppliers={suppliers} branches={branches} onSubmit={handleCreate} loading={saving} />
      </Modal>

      <ConfirmDialog
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={() => { confirmState?.run(); setConfirmState(null); }}
        title={confirmState?.title}
        message={confirmState?.message ?? ''}
        confirmLabel="Confirm"
        confirmClass="btn-primary"
      />

      {/* Reject modal */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Transaction" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting a <span className="font-semibold">{rejectTarget ? SUPPLY_TX_LABELS[rejectTarget.type] : ''}</span> of{' '}
            <span className="font-semibold">{rejectTarget?.quantity} {rejectTarget?.unit ?? ''}</span>{' '}
            {rejectTarget?.item_name}. Please provide a reason.
          </p>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea className="input" rows={3} value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this transaction is being rejected..." />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button className="btn-secondary" onClick={() => setRejectTarget(null)} disabled={saving}>Cancel</button>
            <button className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 flex items-center gap-2"
              onClick={handleReject} disabled={saving || !rejectionReason.trim()}>
              {saving && <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
