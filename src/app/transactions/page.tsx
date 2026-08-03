'use client';
import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import api from '@/lib/api';
import { format } from 'date-fns';
import type { Transaction, TransactionType, PaginatedTransactions } from '@/types';

const TYPE_COLORS: Record<TransactionType, string> = {
  IN: 'bg-green-100 text-green-700',
  OUT: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-blue-100 text-blue-700',
  RETURN: 'bg-purple-100 text-purple-700',
  DISPOSAL: 'bg-orange-100 text-orange-700',
};

const TX_TYPES: TransactionType[] = ['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'DISPOSAL'];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (typeFilter) params.set('type', typeFilter);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      const r = await api.get<PaginatedTransactions>(`/transactions?${params}`);
      setTransactions(r.data.transactions);
      setTotalPages(r.data.pages);
      setTotal(r.data.total);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, fromDate, toDate, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const clearFilters = () => {
    setTypeFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <AppLayout title="Transactions">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="input max-w-[160px]"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            {TX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From</label>
            <input
              type="date"
              className="input w-36"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To</label>
            <input
              type="date"
              className="input w-36"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>
          {(typeFilter || fromDate || toDate) && (
            <button className="text-sm text-blue-600 hover:underline" onClick={clearFilters}>
              Clear
            </button>
          )}
          <span className="ml-auto text-sm text-gray-400">{total} records</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Date / Time</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Before → After</th>
                  <th className="table-header">Reference</th>
                  <th className="table-header">By</th>
                  <th className="table-header">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No transactions found</td></tr>
                ) : transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                      {format(new Date(tx.created_at), 'dd MMM yyyy')}
                      <br />
                      <span className="text-gray-400">{format(new Date(tx.created_at), 'HH:mm')}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${TYPE_COLORS[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="table-cell font-medium">{tx.item_name}</td>
                    <td className="table-cell font-semibold">{tx.quantity} {tx.unit}</td>
                    <td className="table-cell text-gray-500 text-xs">
                      {tx.quantity_before} → <span className="font-medium text-gray-900">{tx.quantity_after}</span>
                    </td>
                    <td className="table-cell text-gray-500 text-xs">{tx.reference_number ?? '—'}</td>
                    <td className="table-cell text-gray-500 text-xs">{tx.performed_by_name ?? '—'}</td>
                    <td className="table-cell text-gray-400 text-xs max-w-[160px] truncate">{tx.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <button
                className="btn-secondary py-1 px-3 text-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                className="btn-secondary py-1 px-3 text-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
