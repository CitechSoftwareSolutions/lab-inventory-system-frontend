'use client';
import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Transaction, MovementType, PaginatedTransactions } from '@/types';
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

export default function StockMovementsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      const r = await api.get<PaginatedTransactions>(`/transactions?${params}`);
      setRecords(r.data?.transactions ?? []);
      setTotalPages(r.data?.pages ?? 1);
      setTotal(r.data?.total ?? 0);
    } finally { setLoading(false); }
  }, [typeFilter, search, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Summary counts for this page
  const inCount = records.filter((r) => MOVEMENT_DIRECTION[r.type as MovementType] === 'IN').length;
  const outCount = records.filter((r) => MOVEMENT_DIRECTION[r.type as MovementType] === 'OUT').length;

  return (
    <AppLayout title="Stock Movements">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card py-3 px-4 border-l-4 border-green-400">
            <p className="text-xs text-gray-500">Stock In (this view)</p>
            <p className="text-xl font-bold text-green-600">{inCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-red-400">
            <p className="text-xs text-gray-500">Stock Out (this view)</p>
            <p className="text-xl font-bold text-red-600">{outCount}</p>
          </div>
          <div className="card py-3 px-4 border-l-4 border-gray-400">
            <p className="text-xs text-gray-500">Total Records</p>
            <p className="text-xl font-bold text-gray-700">{total}</p>
          </div>
        </div>

        {/* Movement type info banner */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Movement Types</p>
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map((t) => {
              const dir = MOVEMENT_DIRECTION[t];
              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span className={`badge ${TYPE_COLORS[t]}`}>{MOVEMENT_LABELS[t]}</span>
                  <span className={`text-xs ${dir === 'IN' ? 'text-green-500' : dir === 'OUT' ? 'text-red-500' : 'text-gray-400'}`}>
                    ({dir})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input className="input max-w-xs" placeholder="Search by item name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="input max-w-[220px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Movement Types</option>
            {ALL_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Movement</th>
                  <th className="table-header">Direction</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Before → After</th>
                  <th className="table-header">Reference</th>
                  <th className="table-header">By</th>
                  <th className="table-header">Notes</th>
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
                      <td className="table-cell font-medium text-gray-900">
                        {rec.item_name ?? `Item #${rec.item_id}`}
                        {rec.unit && <span className="text-xs text-gray-400 ml-1">({rec.unit})</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${TYPE_COLORS[mvType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {MOVEMENT_LABELS[mvType] ?? rec.type}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={DIR_COLORS[dir]}>
                          {dir === 'IN' ? '↑ IN' : dir === 'OUT' ? '↓ OUT' : '↕ ADJ'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`font-semibold ${dir === 'IN' ? 'text-green-600' : dir === 'OUT' ? 'text-red-600' : 'text-gray-700'}`}>
                          {dir === 'IN' ? '+' : dir === 'OUT' ? '-' : '±'}{rec.quantity}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-gray-500 font-mono">
                        {rec.quantity_before} → {rec.quantity_after}
                      </td>
                      <td className="table-cell text-xs text-gray-500">{rec.reference_number ?? '—'}</td>
                      <td className="table-cell text-xs text-gray-500">{rec.performed_by_name ?? '—'}</td>
                      <td className="table-cell text-xs text-gray-400 max-w-xs truncate">{rec.notes ?? '—'}</td>
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
    </AppLayout>
  );
}
