'use client';
import { useEffect, useState, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Item, Category, Supplier, ItemFormData, TransactionFormData, TransactionType } from '@/types';

const UNITS = ['pcs', 'ml', 'L', 'mg', 'g', 'kg', 'box', 'pack', 'roll', 'pair', 'set', 'vial', 'bottle'];
const TX_TYPES: TransactionType[] = ['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'DISPOSAL'];

const TX_TYPE_COLOR: Record<TransactionType, string> = {
  IN: 'bg-green-100 text-green-700',
  OUT: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-blue-100 text-blue-700',
  RETURN: 'bg-purple-100 text-purple-700',
  DISPOSAL: 'bg-orange-100 text-orange-700',
};

function generateSKU(name: string): string {
  if (!name.trim()) return '';
  return (
    'CHM-' +
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 28)
  );
}

const emptyForm = (): ItemFormData => ({
  name: '', description: '', sku: '', barcode: '', category_id: '', supplier_id: '',
  quantity: '', min_quantity: 0, max_quantity: '', unit: 'pcs',
  location: '', price: '', expiry_date: '', notes: '',
});

// ─── Searchable Category Select ───────────────────────────────────────────────
interface SearchableSelectProps {
  options: { value: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function SearchableSelect({ options, value, onChange, placeholder = 'Search...' }: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left gap-2"
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? (
            <span>{selected.sublabel ? <span className="text-gray-400 text-xs">{selected.sublabel} › </span> : null}{selected.label}</span>
          ) : '-- None --'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto scrollbar-hide">
            <li
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className="px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
            >
              — None —
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 italic">No categories found</li>
            ) : filtered.map((o) => (
              <li
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  value === o.value
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.sublabel && <span className="text-gray-400 text-xs">{o.sublabel} › </span>}
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Item Form ────────────────────────────────────────────────────────────────
interface ItemFormProps {
  initial: Item | null;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: (form: ItemFormData) => void;
  loading: boolean;
}

function ItemForm({ initial, categories, suppliers, onSubmit, loading }: ItemFormProps) {
  const [form, setForm] = useState<ItemFormData>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          sku: initial.sku ?? '',
          barcode: initial.barcode ?? '',
          category_id: initial.category_id ?? '',
          supplier_id: initial.supplier_id ?? '',
          quantity: initial.quantity,
          min_quantity: initial.min_quantity,
          max_quantity: initial.max_quantity ?? '',
          unit: initial.unit,
          location: '',
          price: initial.price ?? '',
          expiry_date: initial.expiry_date ?? '',
          notes: initial.notes ?? '',
        }
      : emptyForm()
  );
  const [skuManual, setSkuManual] = useState(!!initial?.sku);

  const set = <K extends keyof ItemFormData>(k: K, v: ItemFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleNameChange = (name: string) => {
    set('name', name);
    if (!skuManual) set('sku', generateSKU(name));
  };

  const handleSkuChange = (sku: string) => {
    set('sku', sku);
    setSkuManual(!!sku.trim());
  };

  const catOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
    sublabel: c.parent_name ?? undefined,
  }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Name */}
        <div className="col-span-2">
          <label className="label">Item Name *</label>
          <input
            className="input"
            value={form.name as string}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="e.g., Sodium Chloride"
          />
        </div>

        {/* SKU */}
        <div>
          <label className="label">
            SKU / Code
            {!skuManual && form.name && (
              <span className="ml-2 text-xs text-blue-500 font-normal">auto-generated</span>
            )}
          </label>
          <input
            className="input font-mono text-sm"
            value={form.sku as string}
            onChange={(e) => handleSkuChange(e.target.value)}
            placeholder="CHM-..."
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="label">Barcode <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
          <input
            className="input font-mono text-sm"
            value={form.barcode as string}
            onChange={(e) => set('barcode', e.target.value)}
            placeholder="Scan or enter barcode"
          />
        </div>

        {/* Category — searchable, Chemicals only */}
        <div>
          <label className="label">Category <span className="text-xs text-orange-500 font-normal">(Chemicals)</span></label>
          <SearchableSelect
            options={catOptions}
            value={form.category_id as string}
            onChange={(v) => set('category_id', v)}
            placeholder="Search chemical category..."
          />
        </div>

        {/* Supplier */}
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={form.supplier_id as string} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">-- None --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="label">Unit</label>
          <select className="input" value={form.unit as string} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Quantity (add only) */}
        {!initial && (
          <div>
            <label className="label">Initial Quantity *</label>
            <input type="number" step="0.01" min="0" className="input" value={form.quantity as string} onChange={(e) => set('quantity', e.target.value)} required />
          </div>
        )}

        {/* Min Qty */}
        <div>
          <label className="label">Min Quantity (Alert)</label>
          <input type="number" step="0.01" min="0" className="input" value={form.min_quantity as string} onChange={(e) => set('min_quantity', e.target.value)} />
        </div>

        {/* Price */}
        <div>
          <label className="label">Price (per unit)</label>
          <input type="number" step="0.01" min="0" className="input" value={form.price as string} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
        </div>

        {/* Expiry */}
        <div>
          <label className="label">Expiry Date</label>
          <input type="date" className="input" value={form.expiry_date as string} onChange={(e) => set('expiry_date', e.target.value)} />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description as string} onChange={(e) => set('description', e.target.value)} />
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes as string} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
interface TransactionModalProps {
  item: Item | null;
  onClose: () => void;
  onDone: () => void;
}

function TransactionModal({ item, onClose, onDone }: TransactionModalProps) {
  const [form, setForm] = useState<TransactionFormData>({ type: 'IN', quantity: '', notes: '', reference_number: '' });
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof TransactionFormData>(k: K, v: TransactionFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/transactions', { item_id: item!.id, ...form });
      toast.success('Transaction recorded');
      onDone();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!item} onClose={onClose} title={`Stock Movement — ${item?.name}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Transaction Type</label>
          <div className="flex flex-wrap gap-2">
            {TX_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.type === t
                    ? `${TX_TYPE_COLOR[t]} border-transparent`
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input type="number" step="0.01" min="0.01" className="input" value={form.quantity as string} onChange={(e) => set('quantity', e.target.value)} required />
          <p className="text-xs text-gray-400 mt-1">Current stock: <span className="font-medium text-gray-600">{item?.quantity} {item?.unit}</span></p>
        </div>
        <div>
          <label className="label">Reference #</label>
          <input className="input" value={form.reference_number} onChange={(e) => set('reference_number', e.target.value)} placeholder="PO / Invoice number" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Record'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [txItem, setTxItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role !== 'viewer';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (catFilter) params.set('category_id', catFilter);
      if (lowStock) params.set('low_stock', 'true');
      const res = await api.get<{ items: Item[]; pages: number; total: number }>(`/items?${params}`);
      setItems(res.data?.items ?? []);
      setTotalPages(res.data?.pages ?? 1);
      setTotal(res.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, lowStock, page]);

  useEffect(() => {
    fetchItems();
    // Only fetch Chemical categories
    api.get<Category[]>('/categories?type=Chemicals').then((r) => setCategories(r.data ?? []));
    api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data ?? []));
  }, [fetchItems]);

  const handleSave = async (form: ItemFormData) => {
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/items/${editItem.id}`, form);
        toast.success('Item updated');
      } else {
        await api.post('/items', form);
        toast.success('Item added');
      }
      setFormModal(false);
      setEditItem(null);
      fetchItems();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/items/${deleteTarget.id}`);
      toast.success('Item deactivated');
      setDeleteTarget(null);
      fetchItems();
    } catch {
      toast.error('Failed to deactivate item');
    } finally {
      setSaving(false);
    }
  };

  const catOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
    sublabel: c.parent_name ?? undefined,
  }));

  return (
    <AppLayout title="Items">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1 items-center">
            <input
              className="input max-w-xs"
              placeholder="Search items..."
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            />
            <select
              className="input max-w-[180px]"
              value={catFilter}
              onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_name ? `${c.parent_name} › ` : ''}{c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(e) => { setLowStock(e.target.checked); setPage(1); }}
                className="rounded"
              />
              Low Stock Only
            </label>
          </div>
          {canEdit && (
            <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>
              + Add Item
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Item</th>
                  <th className="table-header">SKU / Barcode</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Stock</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Expiry</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No items found</td></tr>
                ) : items.map((item) => {
                  const isLow = Number(item.quantity) <= Number(item.min_quantity);
                  const expired = item.expiry_date && new Date(item.expiry_date) < new Date();
                  const expiringSoon = item.expiry_date && !expired && (new Date(item.expiry_date).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-400 truncate max-w-xs">{item.description}</p>}
                      </td>
                      <td className="table-cell">
                        {item.sku && <p className="font-mono text-xs text-gray-600">{item.sku}</p>}
                        {item.barcode && <p className="font-mono text-xs text-gray-400">{item.barcode}</p>}
                        {!item.sku && !item.barcode && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell">
                        {item.category_name ? (
                          <span
                            className="badge"
                            style={{
                              background: (item.category_color ?? '#f97316') + '20',
                              color: item.category_color ?? '#f97316',
                            }}
                          >
                            {item.category_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.quantity}
                          </span>
                          <span className="text-gray-400 text-xs">{item.unit}</span>
                          {isLow && <span className="badge bg-red-50 text-red-600 text-xs">Low</span>}
                        </div>
                        <p className="text-xs text-gray-400">Min: {item.min_quantity}</p>
                      </td>
                      <td className="table-cell text-gray-500 text-sm">
                        {item.price != null ? `$${item.price}` : '—'}
                      </td>
                      <td className="table-cell">
                        {item.expiry_date ? (
                          <span className={`badge text-xs ${expired ? 'bg-red-100 text-red-700' : expiringSoon ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {expired ? '⚠ ' : expiringSoon ? '⏰ ' : ''}{new Date(item.expiry_date).toLocaleDateString()}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {canEdit && (
                            <button onClick={() => setTxItem(item)} className="text-xs btn-secondary py-1 px-2">
                              Stock
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => { setEditItem(item); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">
                              Edit
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button onClick={() => setDeleteTarget(item)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-400">{total} items</span>
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

      <Modal
        open={formModal}
        onClose={() => { setFormModal(false); setEditItem(null); }}
        title={editItem ? 'Edit Item' : 'Add New Item'}
        size="lg"
      >
        <ItemForm
          initial={editItem}
          categories={categories}
          suppliers={suppliers}
          onSubmit={handleSave}
          loading={saving}
        />
      </Modal>

      <TransactionModal
        item={txItem}
        onClose={() => setTxItem(null)}
        onDone={() => { setTxItem(null); fetchItems(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Item"
        message={`Are you sure you want to deactivate "${deleteTarget?.name}"?`}
        loading={saving}
      />
    </AppLayout>
  );
}
