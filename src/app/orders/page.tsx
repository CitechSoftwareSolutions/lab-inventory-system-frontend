'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Order, OrderFormData, OrderItemFormData, OrderStatus, PaginatedOrders, Supplier } from '@/types';

const STATUSES: OrderStatus[] = ['Draft', 'Submitted', 'Approved', 'Ordered', 'Received', 'Cancelled'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Ordered: 'bg-amber-100 text-amber-700',
  Received: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
};

const UNITS = ['pcs', 'ml', 'L', 'mg', 'g', 'kg', 'box', 'pack', 'bottle', 'vial', 'roll', 'set'];

const emptyItem = (): OrderItemFormData => ({ item_name: '', quantity: '', unit: 'pcs', unit_price: '', notes: '' });

function OrderForm({ initial, suppliers, onSubmit, loading }: {
  initial: Order | null; suppliers: Supplier[];
  onSubmit: (f: OrderFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<OrderFormData>(
    initial
      ? {
          supplier_id: initial.supplier_id,
          expected_delivery: initial.expected_delivery ?? '',
          notes: initial.notes ?? '',
          items: initial.items?.map((i) => ({
            item_name: i.item_name, quantity: i.quantity, unit: i.unit,
            unit_price: i.unit_price ?? '', notes: i.notes ?? '',
          })) ?? [emptyItem()],
        }
      : { supplier_id: '', expected_delivery: '', notes: '', items: [emptyItem()] }
  );

  const setTop = <K extends keyof Omit<OrderFormData, 'items'>>(k: K, v: OrderFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setItem = (idx: number, k: keyof OrderItemFormData, v: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const total = form.items.reduce((sum, i) => {
    const q = Number(i.quantity) || 0;
    const p = Number(i.unit_price) || 0;
    return sum + q * p;
  }, 0);

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Supplier *</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => setTop('supplier_id', e.target.value)} required>
            <option value="">-- Select Supplier --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expected Delivery</label>
          <input type="date" className="input" value={form.expected_delivery} onChange={(e) => setTop('expected_delivery', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setTop('notes', e.target.value)} placeholder="Order instructions, delivery notes..." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Order Items *</label>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide pr-1">
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="col-span-4">
                <input className="input text-sm" value={item.item_name} onChange={(e) => setItem(idx, 'item_name', e.target.value)} placeholder="Item / Chemical name" required />
              </div>
              <div className="col-span-2">
                <input type="number" step="0.001" min="0" className="input text-sm" value={item.quantity as string} onChange={(e) => setItem(idx, 'quantity', e.target.value)} placeholder="Qty" required />
              </div>
              <div className="col-span-2">
                <select className="input text-sm" value={item.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <input type="number" step="0.01" min="0" className="input text-sm" value={item.unit_price as string} onChange={(e) => setItem(idx, 'unit_price', e.target.value)} placeholder="Unit price" />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <span className="text-xs text-gray-500">${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}</span>
              </div>
              <div className="col-span-1 flex items-center justify-center">
                {form.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-2">
          <p className="text-sm font-semibold text-gray-700">Estimated Total: <span className="text-blue-600">${total.toFixed(2)}</span></p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : initial ? 'Update Order' : 'Create Order'}</button>
      </div>
    </form>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const canCreate = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get<PaginatedOrders>(`/orders?${params}`);
      setOrders(r.data?.items ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchOrders();
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
  }, [fetchOrders]);

  const handleSave = async (form: OrderFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/orders/${editItem.id}`, form); toast.success('Order updated'); }
      else { await api.post('/orders', form); toast.success('Order created'); }
      setFormModal(false); setEditItem(null); fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    try {
      await api.put(`/orders/${order.id}/status`, { status: newStatus });
      toast.success(`Order ${newStatus.toLowerCase()}`);
      fetchOrders();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/orders/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchOrders(); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const statusCounts = STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: orders.filter((o) => o.status === s).length }), {});

  const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
    Draft: 'Submitted', Submitted: 'Approved', Approved: 'Ordered', Ordered: 'Received',
  };

  return (
    <AppLayout title="Orders">
      <div className="space-y-4">
        {/* Status counts */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.slice(0, 5).map((s) => (
            <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
              {s} <span className="font-bold">({statusCounts[s] ?? 0})</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {canCreate && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ New Order</button>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Order #</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Branch</th>
                  <th className="table-header">Items</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Expected</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-sm font-medium text-gray-800">{order.order_number}</td>
                    <td className="table-cell font-medium">{order.supplier_name ?? '—'}</td>
                    <td className="table-cell text-gray-500 text-sm">{order.branch_name ?? '—'}</td>
                    <td className="table-cell text-gray-500 text-sm">{order.item_count ?? 0} item(s)</td>
                    <td className="table-cell text-gray-700 text-sm">{order.total_amount != null ? `$${Number(order.total_amount).toFixed(2)}` : '—'}</td>
                    <td className="table-cell text-gray-500 text-sm">{order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : '—'}</td>
                    <td className="table-cell"><span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setViewOrder(order)} className="text-xs btn-secondary py-1 px-2">View</button>
                        {canCreate && nextStatus[order.status] && (
                          <button onClick={() => handleStatusChange(order, nextStatus[order.status]!)} className="text-xs btn-primary py-1 px-2">
                            → {nextStatus[order.status]}
                          </button>
                        )}
                        {canCreate && order.status === 'Draft' && (
                          <button onClick={() => { setEditItem(order); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>
                        )}
                        {user?.role === 'super_admin' && order.status === 'Draft' && (
                          <button onClick={() => setDeleteTarget(order)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-400">{total} orders</span>
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Order' : 'New Purchase Order'} size="xl">
        <OrderForm initial={editItem} suppliers={suppliers} onSubmit={handleSave} loading={saving} />
      </Modal>

      {/* View order detail */}
      <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order ${viewOrder?.order_number}`} size="lg">
        {viewOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs mb-0.5">Supplier</p><p className="font-medium">{viewOrder.supplier_name}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Status</p><span className={`badge ${STATUS_COLORS[viewOrder.status]}`}>{viewOrder.status}</span></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Branch</p><p>{viewOrder.branch_name ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Expected Delivery</p><p>{viewOrder.expected_delivery ? new Date(viewOrder.expected_delivery).toLocaleDateString() : '—'}</p></div>
              {viewOrder.notes && <div className="col-span-2"><p className="text-gray-400 text-xs mb-0.5">Notes</p><p>{viewOrder.notes}</p></div>}
            </div>
            {viewOrder.items && viewOrder.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 text-xs text-gray-500">Item</th><th className="text-right px-3 py-2 text-xs text-gray-500">Qty</th><th className="text-right px-3 py-2 text-xs text-gray-500">Unit Price</th><th className="text-right px-3 py-2 text-xs text-gray-500">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewOrder.items.map((it, i) => (
                      <tr key={i}><td className="px-3 py-2">{it.item_name}</td><td className="px-3 py-2 text-right">{it.quantity} {it.unit}</td><td className="px-3 py-2 text-right">{it.unit_price != null ? `$${it.unit_price}` : '—'}</td><td className="px-3 py-2 text-right font-medium">{it.total_price != null ? `$${Number(it.total_price).toFixed(2)}` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
                {viewOrder.total_amount != null && (
                  <div className="flex justify-end mt-2 font-semibold text-gray-700">Total: ${Number(viewOrder.total_amount).toFixed(2)}</div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Order" message={`Delete order "${deleteTarget?.order_number}"?`} loading={saving} />
    </AppLayout>
  );
}
