'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type {
  Invoice, InvoiceFormData, InvoiceItemFormData, InvoiceStatus,
  OrderItemType, PaginatedInvoices, Supplier, Order, ApprovalStatus,
} from '@/types';

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
  Pending:  'bg-yellow-100 text-yellow-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Rejected: 'bg-red-100 text-red-700',
};

const INVOICE_STATUSES: InvoiceStatus[] = ['Unpaid', 'Paid', 'Cancelled'];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Unpaid:    'bg-yellow-100 text-yellow-700',
  Paid:      'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
};

const ORDER_ITEM_TYPES: OrderItemType[] = ['Chemical', 'Glassware', 'Consumable', 'Equipment', 'Instrument'];

const ENDPOINTS: Record<OrderItemType, string> = {
  Chemical:   '/chemicals?limit=500',
  Glassware:  '/glassware?limit=500',
  Consumable: '/consumables?limit=500',
  Equipment:  '/equipment?limit=500',
  Instrument: '/instruments?limit=500',
};

const UNITS_BY_TYPE: Record<OrderItemType, string[]> = {
  Chemical:   ['ml', 'L', 'μL', 'mg', 'g', 'kg', 'mol', 'mmol', 'bottle', 'vial', 'pack'],
  Glassware:  ['pcs', 'set', 'pair', 'box', 'pack'],
  Consumable: ['box', 'pack', 'pcs', 'pair', 'roll', 'bag', 'sheet', 'set'],
  Equipment:  ['unit', 'pcs', 'set'],
  Instrument: ['unit', 'pcs', 'set'],
};

type InventoryItem = { id: number; name: string; unit?: string | null };

const emptyItem = (): InvoiceItemFormData => ({
  item_type: 'Chemical', item_id: '', quantity: '', unit: '', unit_price: '', notes: '',
});

const emptyForm = (): InvoiceFormData => ({
  invoice_number: '', supplier_id: '', order_id: '', invoice_date: '',
  discount: '', notes: '', items: [emptyItem()],
});

// ─── Line-item row ─────────────────────────────────────────────────────────────

function InvoiceItemRow({ idx, item, itemsCache, onChangeType, onChangeField, onRemove, canRemove }: {
  idx: number; item: InvoiceItemFormData;
  itemsCache: Record<OrderItemType, InventoryItem[]>;
  onChangeType: (t: OrderItemType) => void;
  onChangeField: (k: keyof InvoiceItemFormData, v: string) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const options = itemsCache[item.item_type] ?? [];
  const listId = `inv-units-${idx}`;

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosen = options.find((o) => o.id === Number(e.target.value));
    onChangeField('item_id', e.target.value);
    if (chosen?.unit) onChangeField('unit', chosen.unit);
  };

  return (
    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg items-start">
      <div className="col-span-2">
        <select className="input text-sm" value={item.item_type} onChange={(e) => onChangeType(e.target.value as OrderItemType)}>
          {ORDER_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="col-span-4">
        <select className="input text-sm" value={item.item_id as string} onChange={handleItemChange} required>
          <option value="">{options.length ? '— Select —' : 'Loading...'}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div className="col-span-1">
        <input type="number" step="1" min="1" className="input text-sm" value={item.quantity as string}
          onChange={(e) => onChangeField('quantity', e.target.value)} placeholder="Qty" required />
      </div>
      <div className="col-span-2">
        <input className="input text-sm" list={listId} value={item.unit}
          onChange={(e) => onChangeField('unit', e.target.value)} placeholder="Unit" />
        <datalist id={listId}>
          {UNITS_BY_TYPE[item.item_type].map((u) => <option key={u} value={u} />)}
        </datalist>
      </div>
      <div className="col-span-2">
        <input type="number" step="0.01" min="0" className="input text-sm" value={item.unit_price as string}
          onChange={(e) => onChangeField('unit_price', e.target.value)} placeholder="Unit price" />
      </div>
      <div className="col-span-1 flex items-center justify-center pt-1">
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Invoice form ─────────────────────────────────────────────────────────────

function InvoiceForm({ initial, suppliers, orders, onSubmit, loading }: {
  initial: Invoice | null; suppliers: Supplier[]; orders: Order[];
  onSubmit: (f: InvoiceFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<InvoiceFormData>(
    initial ? {
      invoice_number: initial.invoice_number,
      supplier_id: initial.supplier_id,
      order_id: initial.order_id ?? '',
      invoice_date: initial.invoice_date?.slice(0, 10) ?? '',
      discount: initial.discount ?? '',
      notes: initial.notes ?? '',
      items: initial.items?.map((i) => ({
        item_type: i.item_type, item_id: i.item_id,
        quantity: i.quantity, unit: i.unit ?? '',
        unit_price: i.unit_price ?? '', notes: i.notes ?? '',
      })) ?? [emptyItem()],
    } : emptyForm()
  );

  const [itemsCache, setItemsCache] = useState<Record<OrderItemType, InventoryItem[]>>({
    Chemical: [], Glassware: [], Consumable: [], Equipment: [], Instrument: [],
  });

  useEffect(() => {
    ORDER_ITEM_TYPES.forEach((t) => {
      api.get<{ items: InventoryItem[] }>(ENDPOINTS[t])
        .then((r) => setItemsCache((c) => ({ ...c, [t]: r.data?.items ?? [] })))
        .catch(() => {});
    });
  }, []);

  const setTop = <K extends keyof Omit<InvoiceFormData, 'items'>>(k: K, v: InvoiceFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setItemField = (idx: number, k: keyof InvoiceItemFormData, v: string) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));

  const setItemType = (idx: number, type: OrderItemType) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, item_type: type, item_id: '' } : it) }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const subtotal = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const total = subtotal - (Number(form.discount) || 0);

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Invoice Number *</label>
          <input className="input" value={form.invoice_number} onChange={(e) => setTop('invoice_number', e.target.value)}
            required placeholder="e.g. INV-2026-001" />
        </div>
        <div>
          <label className="label">Invoice Date *</label>
          <input type="date" className="input" value={form.invoice_date} onChange={(e) => setTop('invoice_date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Supplier *</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => setTop('supplier_id', e.target.value)} required>
            <option value="">— Select Supplier —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Linked Order <span className="text-gray-400 font-normal text-xs">(Ordered — awaiting delivery)</span></label>
          <select className="input" value={form.order_id as string} onChange={(e) => setTop('order_id', e.target.value)}>
            <option value="">— None (standalone invoice) —</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name ?? 'No supplier'}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Header Discount</label>
          <input type="number" step="0.01" min="0" className="input" value={form.discount as string}
            onChange={(e) => setTop('discount', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={(e) => setTop('notes', e.target.value)} placeholder="Optional notes..." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Invoice Items *</label>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
        </div>
        <div className="grid grid-cols-12 gap-2 px-3 py-1 text-xs font-medium text-gray-400 uppercase">
          <div className="col-span-2">Type</div>
          <div className="col-span-4">Item</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-2">Unit</div>
          <div className="col-span-2">Unit Price</div>
          <div className="col-span-1"></div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide pr-1">
          {form.items.map((item, idx) => (
            <InvoiceItemRow key={idx} idx={idx} item={item} itemsCache={itemsCache}
              onChangeType={(t) => setItemType(idx, t)}
              onChangeField={(k, v) => setItemField(idx, k, v)}
              onRemove={() => removeItem(idx)}
              canRemove={form.items.length > 1} />
          ))}
        </div>
        {subtotal > 0 && (
          <div className="text-right text-sm mt-2 space-y-0.5">
            <p className="text-gray-500">Subtotal: <span className="font-semibold text-gray-700">Rs. {subtotal.toFixed(2)}</span></p>
            {Number(form.discount) > 0 && <p className="text-gray-500">Discount: <span className="text-red-600">-Rs. {Number(form.discount).toFixed(2)}</span></p>}
            <p className="font-bold text-gray-800">Total: Rs. {total.toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [closedFilter, setClosedFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [closeTarget, setCloseTarget] = useState<Invoice | null>(null);
  const [rejectInvoiceTarget, setRejectInvoiceTarget] = useState<Invoice | null>(null);
  const [invoiceRejectReason, setInvoiceRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; run: () => void } | null>(null);
  const isManager = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (closedFilter !== '') params.set('is_closed', closedFilter);
      if (approvalFilter) params.set('approval_status', approvalFilter);
      const r = await api.get<PaginatedInvoices>(`/invoices?${params}`);
      setInvoices(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [statusFilter, closedFilter, approvalFilter, page]);

  useEffect(() => {
    fetchInvoices();
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
    api.get<{ items: Order[] }>('/orders?limit=200&status=Ordered').then((r) => setOrders(r.data?.items ?? []));
  }, [fetchInvoices]);

  const handleSave = async (form: InvoiceFormData) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        supplier_id: Number(form.supplier_id),
        order_id: form.order_id ? Number(form.order_id) : undefined,
        discount: form.discount !== '' ? Number(form.discount) : undefined,
        items: form.items.map((i) => ({
          item_type: i.item_type, item_id: Number(i.item_id),
          quantity: Number(i.quantity), unit: i.unit || undefined,
          unit_price: i.unit_price !== '' ? Number(i.unit_price) : undefined,
          notes: i.notes || undefined,
        })),
      };
      if (editItem) { await api.put(`/invoices/${editItem.id}`, payload); toast.success('Invoice updated'); }
      else { await api.post('/invoices', payload); toast.success('Invoice created'); }
      setFormModal(false); setEditItem(null); fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (invoice: Invoice, status: InvoiceStatus) => {
    setActionLoading(`${invoice.id}-${status.toLowerCase()}`);
    try {
      await api.put(`/invoices/${invoice.id}/status`, { status });
      toast.success(`Marked as ${status}`);
      fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setActionLoading(null); }
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    setSaving(true);
    try {
      await api.put(`/invoices/${closeTarget.id}/close`);
      toast.success('Invoice closed — stock updated');
      setCloseTarget(null); fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed to close invoice');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/invoices/${deleteTarget.id}`);
      toast.success('Deleted'); setDeleteTarget(null); fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleView = async (invoice: Invoice) => {
    try {
      const r = await api.get<Invoice>(`/invoices/${invoice.id}`);
      setViewInvoice(r.data);
    } catch { setViewInvoice(invoice); }
  };

  const handleApproveInvoice = async (invoice: Invoice) => {
    setActionLoading(`${invoice.id}-approve`);
    try {
      await api.put(`/invoices/${invoice.id}/approve`);
      toast.success('Invoice approved');
      fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setActionLoading(null); }
  };

  const handleRejectInvoice = async () => {
    if (!rejectInvoiceTarget || !invoiceRejectReason.trim()) return;
    setSaving(true);
    try {
      await api.put(`/invoices/${rejectInvoiceTarget.id}/reject`, { reason: invoiceRejectReason.trim() });
      toast.success('Invoice rejected');
      setRejectInvoiceTarget(null); setInvoiceRejectReason(''); fetchInvoices();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const openCount = invoices.filter((i) => !i.is_closed).length;
  const closedCount = invoices.filter((i) => i.is_closed).length;
  const unpaidCount = invoices.filter((i) => i.status === 'Unpaid' && !i.is_closed).length;

  return (
    <AppLayout title="Invoices">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card py-3 px-4 border-l-4 border-yellow-400">
            <p className="text-xs text-gray-500">Unpaid (open)</p>
            <p className="text-xl font-bold text-yellow-600">{unpaidCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-blue-400">
            <p className="text-xs text-gray-500">Open (not in inventory)</p>
            <p className="text-xl font-bold text-blue-600">{openCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-green-400">
            <p className="text-xs text-gray-500">Closed (in inventory)</p>
            <p className="text-xl font-bold text-green-600">{closedCount}</p>
          </div>
        </div>

        {/* Filters + New button */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input max-w-[200px]" value={closedFilter} onChange={(e) => { setClosedFilter(e.target.value); setPage(1); }}>
              <option value="">All Invoices</option>
              <option value="false">Not yet in inventory</option>
              <option value="true">Added to inventory</option>
            </select>
            <select className="input max-w-[160px]" value={approvalFilter} onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}>
              <option value="">All Approvals</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ New Invoice</button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Order</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Items</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Payment</th>
                  <th className="table-header">Approval</th>
                  <th className="table-header">Inventory</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">No invoices found</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-sm font-medium text-gray-800">{inv.invoice_number}</td>
                    <td className="table-cell font-medium">{inv.supplier_name ?? '—'}</td>
                    <td className="table-cell text-gray-500 text-sm font-mono">{inv.order_number ?? '—'}</td>
                    <td className="table-cell text-gray-500 text-sm">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                    <td className="table-cell text-gray-500 text-sm">{inv.item_count ?? 0}</td>
                    <td className="table-cell text-gray-700 text-sm font-medium">
                      {inv.total_amount != null ? `Rs. ${Number(inv.total_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${APPROVAL_COLORS[inv.approval_status]}`}>{inv.approval_status}</span>
                    </td>
                    <td className="table-cell">
                      {inv.is_closed ? (
                        <span className="badge bg-gray-700 text-white text-xs">Closed</span>
                      ) : (
                        <span className="badge bg-blue-100 text-blue-700 text-xs">Open</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => handleView(inv)} className="text-xs btn-secondary py-1 px-2">View</button>
                        {/* Manager: Approve / Reject pending invoices */}
                        {isManager && inv.approval_status === 'Pending' && !inv.is_closed && (
                          <>
                            <button
                              onClick={() => setConfirmState({ title: 'Approve Invoice', message: `Approve invoice ${inv.invoice_number}? It can then be closed to add its items to stock.`, run: () => handleApproveInvoice(inv) })}
                              disabled={actionLoading === `${inv.id}-approve`}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1 px-2 flex items-center gap-1">
                              {actionLoading === `${inv.id}-approve` && <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                              Approve
                            </button>
                            <button onClick={() => { setRejectInvoiceTarget(inv); setInvoiceRejectReason(''); }}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg py-1 px-2">Reject</button>
                          </>
                        )}
                        {/* Add to Inventory: only when approved and not yet closed */}
                        {!inv.is_closed && inv.status !== 'Cancelled' && inv.approval_status === 'Approved' && (
                          <button onClick={() => setCloseTarget(inv)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1 px-2 font-medium">
                            Add to Inventory
                          </button>
                        )}
                        {/* Mark Paid: visible even after closing — payment comes later */}
                        {inv.status === 'Unpaid' && (
                          <button
                            onClick={() => setConfirmState({ title: 'Mark Invoice Paid', message: `Mark invoice ${inv.invoice_number} as paid?`, run: () => handleStatusChange(inv, 'Paid') })}
                            disabled={actionLoading === `${inv.id}-paid`}
                            className="text-xs text-green-600 hover:text-green-700 py-1 px-2 font-medium flex items-center gap-1">
                            {actionLoading === `${inv.id}-paid` && <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                            Mark Paid
                          </button>
                        )}
                        {!inv.is_closed && inv.approval_status !== 'Rejected' && (
                          <>
                            <button onClick={() => { setEditItem(inv); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>
                            {inv.status !== 'Cancelled' && (
                              <button onClick={() => setDeleteTarget(inv)} className="text-xs text-red-500 hover:text-red-700 py-1 px-2">Delete</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-400">{total} invoices</span>
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

      {/* Create / Edit Modal */}
      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }}
        title={editItem ? `Edit Invoice ${editItem.invoice_number}` : 'New Invoice'} size="xl">
        <InvoiceForm initial={editItem} suppliers={suppliers} orders={orders} onSubmit={handleSave} loading={saving} />
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice?.invoice_number}`} size="lg">
        {viewInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs mb-0.5">Supplier</p><p className="font-medium">{viewInvoice.supplier_name ?? '—'}</p></div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Status</p>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className={`badge ${STATUS_COLORS[viewInvoice.status]}`}>{viewInvoice.status}</span>
                  <span className={`badge ${APPROVAL_COLORS[viewInvoice.approval_status]}`}>{viewInvoice.approval_status}</span>
                  {viewInvoice.is_closed && <span className="badge bg-gray-700 text-white text-xs">Closed</span>}
                </div>
              </div>
              {viewInvoice.approval_notes && (
                <div className="col-span-2 bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-red-500 text-xs font-semibold mb-0.5">Rejection Reason</p>
                  <p className="text-red-700 text-sm">{viewInvoice.approval_notes}</p>
                </div>
              )}
              <div><p className="text-gray-400 text-xs mb-0.5">Invoice Date</p><p>{new Date(viewInvoice.invoice_date).toLocaleDateString()}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Linked Order</p><p className="font-mono">{viewInvoice.order_number ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Branch</p><p>{viewInvoice.branch_name ?? '—'}</p></div>
              {viewInvoice.is_closed && (
                <div><p className="text-gray-400 text-xs mb-0.5">Closed by</p><p>{viewInvoice.closed_by_name ?? '—'}</p></div>
              )}
              {viewInvoice.notes && <div className="col-span-2"><p className="text-gray-400 text-xs mb-0.5">Notes</p><p>{viewInvoice.notes}</p></div>}
            </div>

            {viewInvoice.items && viewInvoice.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Item</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Qty</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Unit</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewInvoice.items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-gray-400">{it.item_type}</td>
                        <td className="px-3 py-2 font-medium">{it.item_name}</td>
                        <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{it.unit ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{it.unit_price != null ? `Rs. ${Number(it.unit_price).toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2 text-right font-medium">{it.total_price != null ? `Rs. ${Number(it.total_price).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right mt-2 space-y-0.5 text-sm">
                  {viewInvoice.subtotal != null && <p className="text-gray-500">Subtotal: Rs. {Number(viewInvoice.subtotal).toFixed(2)}</p>}
                  {viewInvoice.discount != null && <p className="text-gray-500">Discount: -Rs. {Number(viewInvoice.discount).toFixed(2)}</p>}
                  {viewInvoice.total_amount != null && <p className="font-bold text-gray-800">Total: Rs. {Number(viewInvoice.total_amount).toFixed(2)}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Close (Add to Inventory) Confirm */}
      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleClose}
        title="Add to Inventory"
        message={`Close invoice "${closeTarget?.invoice_number}"? This will add all stock-linked items to inventory. This action cannot be undone.`}
        loading={saving}
        confirmLabel="Yes, Add to Inventory"
        confirmClass="bg-emerald-600 hover:bg-emerald-700 text-white"
      />

      {/* Delete Confirm */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Invoice" message={`Delete invoice "${deleteTarget?.invoice_number}"? This cannot be undone.`} loading={saving} />

      <ConfirmDialog
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={() => { confirmState?.run(); setConfirmState(null); }}
        title={confirmState?.title}
        message={confirmState?.message ?? ''}
        confirmLabel="Confirm"
        confirmClass="btn-primary"
      />

      {/* Reject Invoice Modal */}
      <Modal open={!!rejectInvoiceTarget} onClose={() => setRejectInvoiceTarget(null)} title="Reject Invoice" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting <span className="font-semibold">{rejectInvoiceTarget?.invoice_number}</span>. Please provide a reason.
          </p>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea className="input" rows={3} value={invoiceRejectReason}
              onChange={(e) => setInvoiceRejectReason(e.target.value)}
              placeholder="Explain why this invoice is being rejected..." />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button className="btn-secondary" onClick={() => setRejectInvoiceTarget(null)} disabled={saving}>Cancel</button>
            <button className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 flex items-center gap-2"
              onClick={handleRejectInvoice} disabled={saving || !invoiceRejectReason.trim()}>
              {saving && <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Rejecting...' : 'Reject Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
