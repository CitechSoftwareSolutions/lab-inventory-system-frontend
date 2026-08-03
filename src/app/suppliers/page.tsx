'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Supplier, SupplierFormData } from '@/types';

interface SupplierFormProps {
  initial: Supplier | null;
  onSubmit: (form: SupplierFormData) => void;
  loading: boolean;
}

function SupplierForm({ initial, onSubmit, loading }: SupplierFormProps) {
  const [form, setForm] = useState<SupplierFormData>(
    initial
      ? {
          name: initial.name,
          contact_person: initial.contact_person ?? '',
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          notes: initial.notes ?? '',
        }
      : { name: '', contact_person: '', email: '', phone: '', address: '', notes: '' }
  );
  const set = <K extends keyof SupplierFormData>(k: K, v: SupplierFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Supplier Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Contact Person</label>
          <input className="input" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input type="tel" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Update Supplier' : 'Add Supplier'}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role !== 'viewer';

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const r = await api.get<Supplier[]>(`/suppliers?${params}`);
      setSuppliers(r.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleSave = async (form: SupplierFormData) => {
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/suppliers/${editItem.id}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier added');
      }
      setFormModal(false);
      setEditItem(null);
      fetchSuppliers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/suppliers/${deleteTarget.id}`);
      toast.success('Supplier deleted');
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Suppliers">
      <div className="space-y-4">
        <div className="flex gap-3 items-center justify-between">
          <input
            className="input max-w-xs"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canEdit && (
            <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>
              + Add Supplier
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Items</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No suppliers found</td></tr>
                ) : suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{s.name}</td>
                    <td className="table-cell text-gray-500">{s.contact_person ?? '—'}</td>
                    <td className="table-cell text-gray-500">{s.email ?? '—'}</td>
                    <td className="table-cell text-gray-500">{s.phone ?? '—'}</td>
                    <td className="table-cell">
                      <span className="badge bg-blue-50 text-blue-700">{s.item_count ?? 0} items</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {canEdit && (
                          <button
                            onClick={() => { setEditItem(s); setFormModal(true); }}
                            className="text-xs btn-secondary py-1 px-2"
                          >
                            Edit
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="text-xs text-red-600 hover:text-red-700 py-1 px-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={formModal}
        onClose={() => { setFormModal(false); setEditItem(null); }}
        title={editItem ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <SupplierForm initial={editItem} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={saving}
      />
    </AppLayout>
  );
}
