'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type {
  Order, OrderFormData, OrderItemFormData, OrderItemType,
  OrderStatus, PaginatedOrders, Supplier,
} from '@/types';

const STATUSES: OrderStatus[] = ['Draft', 'Submitted', 'Approved', 'Ordered', 'Received', 'Cancelled'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Ordered: 'bg-amber-100 text-amber-700',
  Received: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
};

const ORDER_ITEM_TYPES: OrderItemType[] = ['Chemical', 'Glassware', 'Consumable', 'Equipment', 'Instrument'];

const ENDPOINTS: Record<OrderItemType, string> = {
  Chemical: '/chemicals?limit=500',
  Glassware: '/glassware?limit=500',
  Consumable: '/consumables?limit=500',
  Equipment: '/equipment?limit=500',
  Instrument: '/instruments?limit=500',
};

type InventoryItem = { id: number; name: string; unit?: string | null };

const UNITS_BY_TYPE: Record<OrderItemType, string[]> = {
  Chemical:   ['ml', 'L', 'μL', 'mg', 'g', 'kg', 'mol', 'mmol', 'bottle', 'vial', 'pack'],
  Glassware:  ['pcs', 'set', 'pair', 'box', 'pack'],
  Consumable: ['box', 'pack', 'pcs', 'pair', 'roll', 'bag', 'sheet', 'set'],
  Equipment:  ['unit', 'pcs', 'set'],
  Instrument: ['unit', 'pcs', 'set'],
};

const emptyOrderItem = (): OrderItemFormData => ({
  item_type: 'Chemical', item_id: '', quantity: '', unit: '', unit_price: '', notes: '',
});

function OrderItemRow({
  idx, item, itemsCache, onChangeType, onChangeField, onRemove, canRemove,
}: {
  idx: number;
  item: OrderItemFormData;
  itemsCache: Record<OrderItemType, InventoryItem[]>;
  onChangeType: (type: OrderItemType) => void;
  onChangeField: (k: keyof OrderItemFormData, v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const options = itemsCache[item.item_type] ?? [];
  const selected = options.find((o) => o.id === Number(item.item_id));
  const listId = `units-${idx}`;

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosenItem = options.find((o) => o.id === Number(e.target.value));
    onChangeField('item_id', e.target.value);
    if (chosenItem?.unit) onChangeField('unit', chosenItem.unit);
  };

  return (
    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg items-start">
      <div className="col-span-3">
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
      <div className="col-span-2">
        <input type="number" step="1" min="1" className="input text-sm" value={item.quantity as string}
          onChange={(e) => onChangeField('quantity', e.target.value)} placeholder="Qty" required />
      </div>
      <div className="col-span-2">
        <input className="input text-sm" list={listId} value={item.unit}
          onChange={(e) => onChangeField('unit', e.target.value)}
          placeholder={selected?.unit ?? 'Search unit...'} />
        <datalist id={listId}>
          {UNITS_BY_TYPE[item.item_type].map((u) => <option key={u} value={u} />)}
        </datalist>
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

function OrderForm({
  initial, suppliers, onSubmit, loading,
}: {
  initial: Order | null; suppliers: Supplier[];
  onSubmit: (f: OrderFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<OrderFormData>(
    initial
      ? {
          supplier_id: initial.supplier_id ?? '',
          expected_delivery: initial.expected_delivery ?? '',
          notes: initial.notes ?? '',
          items: initial.items?.map((i) => ({
            item_type: i.item_type, item_id: i.item_id,
            quantity: i.quantity, unit: i.unit ?? '',
            unit_price: i.unit_price ?? '', notes: i.notes ?? '',
          })) ?? [emptyOrderItem()],
        }
      : { supplier_id: '', expected_delivery: '', notes: '', items: [emptyOrderItem()] }
  );

  const [itemsCache, setItemsCache] = useState<Record<OrderItemType, InventoryItem[]>>({
    Chemical: [], Glassware: [], Consumable: [], Equipment: [], Instrument: [],
  });

  // Load all item types once
  useEffect(() => {
    ORDER_ITEM_TYPES.forEach((t) => {
      api.get<{ items: InventoryItem[] }>(ENDPOINTS[t])
        .then((r) => setItemsCache((c) => ({ ...c, [t]: r.data?.items ?? [] })))
        .catch(() => {});
    });
  }, []);

  const setTop = <K extends keyof Omit<OrderFormData, 'items'>>(k: K, v: OrderFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setItemField = (idx: number, k: keyof OrderItemFormData, v: string) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));

  const setItemType = (idx: number, type: OrderItemType) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, item_type: type, item_id: '' } : it) }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyOrderItem()] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => setTop('supplier_id', e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expected Delivery</label>
          <input type="date" className="input" value={form.expected_delivery} onChange={(e) => setTop('expected_delivery', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setTop('notes', e.target.value)} placeholder="Order instructions..." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Order Items *</label>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
        </div>
        <div className="grid grid-cols-12 gap-2 px-3 py-1 text-xs font-medium text-gray-400 uppercase">
          <div className="col-span-3">Type</div>
          <div className="col-span-4">Item</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Unit</div>
          <div className="col-span-1"></div>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-hide pr-1">
          {form.items.map((item, idx) => (
            <OrderItemRow
              key={idx}
              idx={idx}
              item={item}
              itemsCache={itemsCache}
              onChangeType={(type) => setItemType(idx, type)}
              onChangeField={(k, v) => setItemField(idx, k, v)}
              onRemove={() => removeItem(idx)}
              canRemove={form.items.length > 1}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Update Order' : 'Create Order'}
        </button>
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
      const payload = {
        ...form,
        supplier_id: form.supplier_id || undefined,
        expected_delivery: form.expected_delivery || undefined,
        items: form.items.map((i) => ({
          item_type: i.item_type,
          item_id: Number(i.item_id),
          quantity: Number(i.quantity),
          unit: i.unit || undefined,
          unit_price: i.unit_price !== '' ? Number(i.unit_price) : undefined,
          notes: i.notes || undefined,
        })),
      };
      if (editItem) { await api.put(`/orders/${editItem.id}`, payload); toast.success('Order updated'); }
      else { await api.post('/orders', payload); toast.success('Order created'); }
      setFormModal(false); setEditItem(null); fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus, applyStock = false) => {
    try {
      await api.put(`/orders/${order.id}/status`, { status: newStatus, apply_stock_update: applyStock });
      toast.success(`Order ${newStatus.toLowerCase()}`);
      fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await api.delete(`/orders/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); fetchOrders(); }
    catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleViewOrder = async (order: Order) => {
    try {
      const r = await api.get<Order>(`/orders/${order.id}`);
      setViewOrder(r.data);
    } catch { setViewOrder(order); }
  };

  const FORWARD: Partial<Record<OrderStatus, OrderStatus>> = {
    Draft: 'Submitted', Submitted: 'Approved', Approved: 'Ordered', Ordered: 'Received',
  };

  return (
    <AppLayout title="Orders">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
              {s} <span className="font-bold">({orders.filter((o) => o.status === s).length})</span>
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
                    <td className="table-cell text-gray-500 text-sm">{order.item_count ?? 0}</td>
                    <td className="table-cell text-gray-700 text-sm">
                      {order.total_amount != null ? `$${Number(order.total_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : '—'}
                    </td>
                    <td className="table-cell"><span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => handleViewOrder(order)} className="text-xs btn-secondary py-1 px-2">View</button>
                        {canCreate && FORWARD[order.status] && order.status !== 'Ordered' && (
                          <button onClick={() => handleStatusChange(order, FORWARD[order.status]!)}
                            className="text-xs btn-primary py-1 px-2">→ {FORWARD[order.status]}</button>
                        )}
                        {canCreate && order.status === 'Ordered' && (
                          <button onClick={() => handleStatusChange(order, 'Received', true)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg py-1 px-2">
                            → Received + Stock
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }}
        title={editItem ? 'Edit Order' : 'New Purchase Order'} size="xl">
        <OrderForm initial={editItem} suppliers={suppliers} onSubmit={handleSave} loading={saving} />
      </Modal>

      {/* View order detail modal */}
      <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order ${viewOrder?.order_number}`} size="lg">
        {viewOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs mb-0.5">Supplier</p><p className="font-medium">{viewOrder.supplier_name ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Status</p><span className={`badge ${STATUS_COLORS[viewOrder.status]}`}>{viewOrder.status}</span></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Branch</p><p>{viewOrder.branch_name ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Expected Delivery</p>
                <p>{viewOrder.expected_delivery ? new Date(viewOrder.expected_delivery).toLocaleDateString() : '—'}</p></div>
              {viewOrder.notes && <div className="col-span-2"><p className="text-gray-400 text-xs mb-0.5">Notes</p><p>{viewOrder.notes}</p></div>}
            </div>
            {viewOrder.items && viewOrder.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Item</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Qty</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Unit</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewOrder.items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-gray-400">{it.item_type}</td>
                        <td className="px-3 py-2 font-medium">{it.item_name}</td>
                        <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{it.unit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Order" message={`Delete order "${deleteTarget?.order_number}"? This cannot be undone.`} loading={saving} />
    </AppLayout>
  );
}
