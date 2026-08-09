'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import type { User, UserFormData, UserRole, Branch } from '@/types';

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin:    'bg-rose-100 text-rose-700',
  branch_manager: 'bg-sky-100 text-sky-700',
  lab_technician: 'bg-emerald-100 text-emerald-700',
  stock_keeper:   'bg-amber-100 text-amber-700',
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:    'Super Admin',
  branch_manager: 'Branch Manager',
  lab_technician: 'Lab Technician',
  stock_keeper:   'Stock Keeper',
};

interface UserFormProps {
  initial: User | null;
  branches: Branch[];
  currentUserRole: UserRole;
  onSubmit: (form: UserFormData) => void;
  loading: boolean;
}

function UserForm({ initial, branches, currentUserRole, onSubmit, loading }: UserFormProps) {
  const [form, setForm] = useState<UserFormData>(
    initial
      ? {
          username: initial.username,
          email: initial.email,
          password: '',
          full_name: initial.full_name ?? '',
          role: initial.role,
          branch_id: initial.branch_id ?? '',
          is_active: initial.is_active,
        }
      : {
          username: '', email: '', password: '', full_name: '',
          role: 'lab_technician', branch_id: '',
        }
  );
  const set = <K extends keyof UserFormData>(k: K, v: UserFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Available roles depend on who is creating
  const availableRoles: UserRole[] = currentUserRole === 'super_admin'
    ? ['super_admin', 'branch_manager', 'stock_keeper', 'lab_technician']
    : ['branch_manager', 'stock_keeper', 'lab_technician'];

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Username *</label>
          <input className="input" value={form.username} onChange={(e) => set('username', e.target.value)} required disabled={!!initial} />
        </div>
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={form.role} onChange={(e) => set('role', e.target.value as UserRole)}>
            {availableRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Branch *</label>
          <select
            className="input"
            value={form.branch_id as string}
            onChange={(e) => set('branch_id', e.target.value)}
            required={form.role !== 'super_admin'}
          >
            <option value="">
              {form.role === 'super_admin' ? '— All Branches (Super Admin) —' : '— Select Branch —'}
            </option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>)}
          </select>
          {form.role === 'super_admin' && (
            <p className="text-xs text-gray-400 mt-1">Super Admins have access to all branches — branch assignment is optional.</p>
          )}
        </div>
        {!initial && (
          <div className="col-span-2">
            <label className="label">Password *</label>
            <input type="password" className="input" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />
          </div>
        )}
        {initial && (
          <div className="col-span-2">
            <label className="label">New Password <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span></label>
            <input type="password" className="input" value={form.password} onChange={(e) => set('password', e.target.value)} minLength={6} placeholder="Enter to change password" />
          </div>
        )}
        {initial && (
          <div className="col-span-2 flex items-center gap-2">
            <input id="is_active" type="checkbox" checked={form.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active account</label>
          </div>
        )}
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = me?.role === 'super_admin' || me?.role === 'branch_manager';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<User[]>('/users');
      setUsers(r.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    api.get<Branch[]>('/branches').then((r) => setBranches(r.data ?? []));
  }, [fetchUsers]);

  const handleSave = async (form: UserFormData) => {
    setSaving(true);
    try {
      const payload = { ...form, branch_id: form.branch_id === '' ? null : Number(form.branch_id) };
      if (editItem) {
        await api.put(`/users/${editItem.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      setFormModal(false); setEditItem(null); fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { msg: string }[] } } };
      toast.error(e.response?.data?.error ?? e.response?.data?.errors?.[0]?.msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('User deleted');
      setDeleteTarget(null); fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <AppLayout title="Users">
      <div className="space-y-4">
        <div className="flex justify-end">
          {canEdit && <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>+ Add User</button>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">User</th>
                  <th className="table-header">Username</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Branch</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                          {(u.full_name ?? u.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 font-mono text-xs">{u.username}</td>
                    <td className="table-cell">
                      <span className={`badge ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-sm">{u.branch_name ?? <span className="text-gray-300">All Branches</span>}</td>
                    <td className="table-cell">
                      <span className={`badge ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400 text-xs">
                      {u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {canEdit && <button onClick={() => { setEditItem(u); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>}
                        {canEdit && u.id !== me?.id && (
                          <button onClick={() => setDeleteTarget(u)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>
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

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit User' : 'Create User'} size="md">
        <UserForm
          initial={editItem}
          branches={branches}
          currentUserRole={me?.role ?? 'branch_manager'}
          onSubmit={handleSave}
          loading={saving}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete user "${deleteTarget?.username}"? This cannot be undone.`}
        loading={saving}
      />
    </AppLayout>
  );
}
