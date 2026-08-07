'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { Category, CategoryFormData, CategoryType } from '@/types';

const CATEGORY_TYPES: CategoryType[] = ['General', 'Glassware', 'Consumables', 'Chemicals', 'Equipment', 'Instruments'];

const TYPE_COLORS: Record<CategoryType, string> = {
  General: 'bg-gray-100 text-gray-700',
  Glassware: 'bg-blue-100 text-blue-700',
  Consumables: 'bg-green-100 text-green-700',
  Chemicals: 'bg-orange-100 text-orange-700',
  Equipment: 'bg-purple-100 text-purple-700',
  Instruments: 'bg-teal-100 text-teal-700',
};

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

const emptyForm = (): CategoryFormData => ({
  name: '', description: '', color: '#3B82F6', type: 'General', parent_id: '',
});

interface CategoryFormProps {
  initial: Category | null;
  parents: Category[];
  onSubmit: (form: CategoryFormData) => void;
  loading: boolean;
}

function CategoryForm({ initial, parents, onSubmit, loading }: CategoryFormProps) {
  const [form, setForm] = useState<CategoryFormData>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          color: initial.color,
          type: initial.type,
          parent_id: initial.parent_id ?? '',
        }
      : emptyForm()
  );

  const set = <K extends keyof CategoryFormData>(k: K, v: CategoryFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const filteredParents = parents.filter(
    (p) => p.type === form.type && p.parent_id === null && p.id !== initial?.id
  );

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Category name" />
        </div>

        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={(e) => { set('type', e.target.value as CategoryType); set('parent_id', ''); }}>
            {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Parent Category</label>
          <select className="input" value={form.parent_id as string} onChange={(e) => set('parent_id', e.target.value)}>
            <option value="">-- Top-level (no parent) --</option>
            {filteredParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Optional — creates a subcategory</p>
        </div>

        <div className="col-span-2">
          <label className="label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              className="w-7 h-7 rounded cursor-pointer border border-gray-300"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              title="Custom color"
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {loading ? 'Saving...' : initial ? 'Update' : 'Add Category'}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CategoryType | 'All'>('All');
  const [formModal, setFormModal] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_manager';
  const canDelete = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Category[]>('/categories');
      setCategories(r.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSave = async (form: CategoryFormData) => {
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id === '' ? null : Number(form.parent_id) };
      if (editItem) {
        await api.put(`/categories/${editItem.id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/categories', payload);
        toast.success('Category added');
      }
      setFormModal(false);
      setEditItem(null);
      fetchCategories();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      toast.success('Category deleted');
      setDeleteTarget(null);
      fetchCategories();
    } catch {
      toast.error('Cannot delete — category may be in use');
    } finally {
      setSaving(false);
    }
  };

  const filtered = typeFilter === 'All' ? categories : categories.filter((c) => c.type === typeFilter);
  const parents = filtered.filter((c) => c.parent_id === null);
  const children = filtered.filter((c) => c.parent_id !== null);

  const typeCounts = CATEGORY_TYPES.reduce<Record<CategoryType, number>>((acc, t) => {
    acc[t] = categories.filter((c) => c.type === t).length;
    return acc;
  }, {} as Record<CategoryType, number>);

  return (
    <AppLayout title="Categories">
      <div className="space-y-4">
        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('All')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === 'All' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All ({categories.length})
          </button>
          {CATEGORY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === t ? 'bg-gray-800 text-white' : `${TYPE_COLORS[t]} hover:opacity-80`}`}
            >
              {t} ({typeCounts[t]})
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          {canEdit && (
            <button className="btn-primary" onClick={() => { setEditItem(null); setFormModal(true); }}>
              + Add Category
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No categories found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Parent</th>
                    <th className="table-header">Color</th>
                    <th className="table-header">Description</th>
                    {canEdit && <th className="table-header">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parents.map((parent) => {
                    const subs = children.filter((c) => c.parent_id === parent.id);
                    return [
                      <tr key={`p-${parent.id}`} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
                            {parent.name}
                          </div>
                        </td>
                        <td className="table-cell"><span className={`badge ${TYPE_COLORS[parent.type]}`}>{parent.type}</span></td>
                        <td className="table-cell text-gray-400 text-xs">—</td>
                        <td className="table-cell"><span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: parent.color }} /></td>
                        <td className="table-cell text-gray-500 text-sm max-w-xs truncate">{parent.description ?? '—'}</td>
                        {canEdit && (
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => { setEditItem(parent); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>
                              {canDelete && <button onClick={() => setDeleteTarget(parent)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
                            </div>
                          </td>
                        )}
                      </tr>,
                      ...subs.map((sub) => (
                        <tr key={`s-${sub.id}`} className="hover:bg-gray-50 bg-gray-50/30">
                          <td className="table-cell">
                            <div className="flex items-center gap-2 pl-5">
                              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                              <span className="text-gray-700">{sub.name}</span>
                            </div>
                          </td>
                          <td className="table-cell"><span className={`badge ${TYPE_COLORS[sub.type]}`}>{sub.type}</span></td>
                          <td className="table-cell text-xs text-gray-500">{parent.name}</td>
                          <td className="table-cell"><span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: sub.color }} /></td>
                          <td className="table-cell text-gray-500 text-sm max-w-xs truncate">{sub.description ?? '—'}</td>
                          {canEdit && (
                            <td className="table-cell">
                              <div className="flex gap-2">
                                <button onClick={() => { setEditItem(sub); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>
                                {canDelete && <button onClick={() => setDeleteTarget(sub)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      )),
                    ];
                  })}
                  {children.filter((c) => !parents.find((p) => p.id === c.parent_id)).map((orphan) => (
                    <tr key={`o-${orphan.id}`} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: orphan.color }} />
                          {orphan.name}
                        </div>
                      </td>
                      <td className="table-cell"><span className={`badge ${TYPE_COLORS[orphan.type]}`}>{orphan.type}</span></td>
                      <td className="table-cell text-xs text-gray-500">{orphan.parent_name ?? `#${orphan.parent_id}`}</td>
                      <td className="table-cell"><span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: orphan.color }} /></td>
                      <td className="table-cell text-gray-500 text-sm max-w-xs truncate">{orphan.description ?? '—'}</td>
                      {canEdit && (
                        <td className="table-cell">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditItem(orphan); setFormModal(true); }} className="text-xs btn-secondary py-1 px-2">Edit</button>
                            {canDelete && <button onClick={() => setDeleteTarget(orphan)} className="text-xs text-red-600 hover:text-red-700 py-1 px-2">Delete</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={formModal} onClose={() => { setFormModal(false); setEditItem(null); }} title={editItem ? 'Edit Category' : 'Add Category'} size="md">
        <CategoryForm initial={editItem} parents={categories} onSubmit={handleSave} loading={saving} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? Items using this category will become uncategorised.`}
        loading={saving}
      />
    </AppLayout>
  );
}
