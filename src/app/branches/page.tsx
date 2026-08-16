'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Branch, BranchFormData } from '@/types';

const emptyForm = (): BranchFormData => ({
  name: '', code: '', address: '', phone: '', email: '', is_head: false,
});

function BranchForm({ initial, onSubmit, loading }: {
  initial: Branch | null; onSubmit: (f: BranchFormData) => void; loading: boolean;
}) {
  const [form, setForm] = useState<BranchFormData>(
    initial
      ? { name: initial.name, code: initial.code ?? '', address: initial.address ?? '',
          phone: initial.phone ?? '', email: initial.email ?? '', is_head: initial.is_head }
      : emptyForm()
  );
  const set = <K extends keyof BranchFormData>(k: K, v: BranchFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Branch Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)}
            required placeholder="e.g., Main Laboratory" />
        </div>
        <div>
          <label className="label">Branch Code</label>
          <input className="input" value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="e.g., HQ, BR01" maxLength={10} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)}
            placeholder="+94 11 234 5678" />
        </div>
        <div className="col-span-2">
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email}
            onChange={(e) => set('email', e.target.value)} placeholder="branch@lab.com" />
        </div>
        <div className="col-span-2">
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address}
            onChange={(e) => set('address', e.target.value)} placeholder="Full address" />
        </div>

        {/* Head branch toggle */}
        <div className="col-span-2">
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              form.is_head ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
            onClick={() => set('is_head', !form.is_head)}
          >
            <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-colors ${
              form.is_head ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
            }`}>
              {form.is_head && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Head Branch</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Users in this branch can view inventory and data from ALL sub-branches. Sub-branches only see their own data.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update Branch' : 'Add Branch'}
        </button>
      </div>
    </form>
  );
}

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';

  const fetchBranches = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const r = await api.get<Branch[]>('/branches');
      setBranches(r.data ?? []);
    } finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  if (!isSuperAdmin) {
    return (
      <AppLayout title="Branches">
        <div className="card text-center py-16 text-gray-400">Access restricted to Super Admin.</div>
      </AppLayout>
    );
  }

  const handleSave = async (form: BranchFormData) => {
    setSaving(true);
    try {
      if (editItem) { await api.put(`/branches/${editItem.id}`, form); toast.success('Branch updated'); }
      else { await api.post('/branches', form); toast.success('Branch added'); }
      setFormModal(false); setEditItem(null); fetchBranches();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/branches/${deleteTarget.id}`);
      toast.success('Branch deleted'); setDeleteTarget(null); fetchBranches();
    } catch { toast.error('Cannot delete — branch may have active users'); }
    finally { setSaving(false); }
  };

  const headBranches = branches.filter((b) => b.is_head);
  const subBranches = branches.filter((b) => !b.is_head);

  const BranchCard = ({ b }: { b: Branch }) => (
    <div key={b.id} className={`card p-5 flex flex-col gap-3 ${b.is_head ? 'ring-2 ring-indigo-200' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: b.is_head ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}
          >
            {b.code ? b.code.slice(0, 2) : b.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{b.name}</h3>
              {b.is_head && (
                <span className="badge bg-indigo-100 text-indigo-700 text-xs">Head</span>
              )}
            </div>
            {b.code && <p className="text-xs text-gray-400 font-mono">{b.code}</p>}
          </div>
        </div>
        <span className={`badge ${b.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {b.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="space-y-1 text-sm text-gray-500">
        {b.email && (
          <p className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {b.email}
          </p>
        )}
        {b.phone && (
          <p className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            {b.phone}
          </p>
        )}
        {b.address && (
          <p className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {b.address}
          </p>
        )}
      </div>

      {b.is_head && (
        <p className="text-xs text-indigo-600 bg-indigo-50 rounded px-2 py-1">
          Users in this branch see all sub-branch data
        </p>
      )}

      {b.user_count != null && (
        <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
          {b.user_count} user{b.user_count !== 1 ? 's' : ''}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={() => { setEditItem(b); setFormModal(true); }} className="btn-secondary text-xs py-1 px-3">Edit</button>
        <button onClick={() => setDeleteTarget(b)} className="text-xs text-red-600 hover:text-red-700 py-1 px-3">Delete</button>
      </div>
    </div>
  );

  return (
    <AppLayout title="Branches">
      <div className="space-y-6">
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>
            + Add Branch
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-12">Loading...</p>
        ) : branches.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No branches yet</p>
        ) : (
          <>
            {headBranches.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Head Branch{headBranches.length > 1 ? 'es' : ''}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {headBranches.map((b) => <BranchCard key={b.id} b={b} />)}
                </div>
              </div>
            )}

            {subBranches.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sub-Branches</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subBranches.map((b) => <BranchCard key={b.id} b={b} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }}
        title={editItem ? 'Edit Branch' : 'Add Branch'} size="md">
        <BranchForm initial={editItem} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Branch"
        message={`Delete branch "${deleteTarget?.name}"? All associated users must be reassigned first.`}
        loading={saving}
      />
    </AppLayout>
  );
}
