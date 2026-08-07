'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/Layout/AppLayout';
import Modal from '@/components/common/Modal';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { PendingApprovals, Order, Invoice, SupplyTransaction } from '@/types';
import { SUPPLY_TX_LABELS } from '@/types';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PendingApprovals | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ type: 'order' | 'invoice' | 'transaction'; id: number; label: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isManager = user?.role === 'super_admin' || user?.role === 'branch_manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<PendingApprovals>('/approvals/pending');
      setData(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isManager) { router.replace('/dashboard'); return; }
    fetchData();
  }, [isManager, fetchData, router]);

  const handleApprove = async (type: 'order' | 'invoice' | 'transaction', id: number) => {
    const key = `${type}-${id}`;
    setActionLoading(key);
    try {
      if (type === 'order') {
        await api.put(`/orders/${id}/status`, { status: 'Approved' });
      } else if (type === 'invoice') {
        await api.put(`/invoices/${id}/approve`);
      } else {
        await api.put(`/transactions/${id}/approve`);
      }
      toast.success('Approved');
      fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setSaving(true);
    try {
      const { type, id } = rejectModal;
      if (type === 'order') {
        await api.put(`/orders/${id}/status`, { status: 'Rejected', rejection_reason: rejectReason.trim() });
      } else if (type === 'invoice') {
        await api.put(`/invoices/${id}/reject`, { reason: rejectReason.trim() });
      } else {
        await api.put(`/transactions/${id}/reject`, { reason: rejectReason.trim() });
      }
      toast.success('Rejected');
      setRejectModal(null); setRejectReason(''); fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  if (!isManager) return null;

  return (
    <AppLayout title="Approvals">
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : data?.total === 0 ? (
          <div className="card text-center py-16">
            <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No items pending approval.</p>
          </div>
        ) : (
          <>
            {/* Submitted Orders */}
            {(data?.orders?.length ?? 0) > 0 && (
              <Section title="Submitted Orders" count={data!.orders.length} accent="blue">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Order #</th>
                      <th className="table-header">Supplier</th>
                      <th className="table-header">Branch</th>
                      <th className="table-header">Items</th>
                      <th className="table-header">Expected</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data!.orders.map((o: Order) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="table-cell font-mono font-medium text-sm">{o.order_number}</td>
                        <td className="table-cell">{o.supplier_name ?? '—'}</td>
                        <td className="table-cell text-gray-500 text-sm">{o.branch_name ?? '—'}</td>
                        <td className="table-cell text-gray-500 text-sm">{o.item_count ?? 0}</td>
                        <td className="table-cell text-gray-500 text-sm">
                          {o.expected_delivery ? new Date(o.expected_delivery).toLocaleDateString() : '—'}
                        </td>
                        <td className="table-cell">
                          <ApproveRejectButtons
                            onApprove={() => handleApprove('order', o.id)}
                            onReject={() => { setRejectModal({ type: 'order', id: o.id, label: o.order_number }); setRejectReason(''); }}
                            loading={actionLoading === `order-${o.id}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Pending Invoices */}
            {(data?.invoices?.length ?? 0) > 0 && (
              <Section title="Pending Invoices" count={data!.invoices.length} accent="yellow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Invoice #</th>
                      <th className="table-header">Supplier</th>
                      <th className="table-header">Branch</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Total</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data!.invoices.map((inv: Invoice) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="table-cell font-mono font-medium text-sm">{inv.invoice_number}</td>
                        <td className="table-cell">{inv.supplier_name ?? '—'}</td>
                        <td className="table-cell text-gray-500 text-sm">{inv.branch_name ?? '—'}</td>
                        <td className="table-cell text-gray-500 text-sm">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td className="table-cell text-gray-700 text-sm font-medium">
                          {inv.total_amount != null ? `Rs. ${Number(inv.total_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="table-cell">
                          <ApproveRejectButtons
                            onApprove={() => handleApprove('invoice', inv.id)}
                            onReject={() => { setRejectModal({ type: 'invoice', id: inv.id, label: inv.invoice_number }); setRejectReason(''); }}
                            loading={actionLoading === `invoice-${inv.id}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Pending Transactions */}
            {(data?.transactions?.length ?? 0) > 0 && (
              <Section title="Pending Transactions" count={data!.transactions.length} accent="amber">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Type</th>
                      <th className="table-header">Item</th>
                      <th className="table-header">Qty</th>
                      <th className="table-header">Supplier / Branch</th>
                      <th className="table-header">Requested By</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data!.transactions.map((tx: SupplyTransaction) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="table-cell text-sm">{SUPPLY_TX_LABELS[tx.type]}</td>
                        <td className="table-cell">
                          <p className="font-medium text-sm">{tx.item_name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{tx.item_type}</p>
                        </td>
                        <td className="table-cell font-semibold text-sm">{tx.quantity} {tx.unit ?? ''}</td>
                        <td className="table-cell text-gray-500 text-sm">{tx.supplier_name ?? tx.related_branch_name ?? '—'}</td>
                        <td className="table-cell text-gray-400 text-xs">{tx.performed_by_name ?? '—'}</td>
                        <td className="table-cell">
                          <ApproveRejectButtons
                            onApprove={() => handleApprove('transaction', tx.id)}
                            onReject={() => {
                              setRejectModal({ type: 'transaction', id: tx.id, label: `${SUPPLY_TX_LABELS[tx.type]} of ${tx.quantity} ${tx.unit ?? ''} ${tx.item_name ?? ''}` });
                              setRejectReason('');
                            }}
                            loading={actionLoading === `transaction-${tx.id}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </>
        )}
      </div>

      {/* Reject modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting: <span className="font-semibold">{rejectModal?.label}</span>. Please provide a reason.
          </p>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea className="input" rows={3} value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain the reason for rejection..." />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button className="btn-secondary" onClick={() => setRejectModal(null)} disabled={saving}>Cancel</button>
            <button className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 flex items-center gap-2"
              onClick={handleReject} disabled={saving || !rejectReason.trim()}>
              {saving && <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

function Section({ title, count, accent, children }: {
  title: string; count: number; accent: string; children: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    blue: 'border-blue-400 text-blue-700 bg-blue-50',
    yellow: 'border-yellow-400 text-yellow-700 bg-yellow-50',
    amber: 'border-amber-400 text-amber-700 bg-amber-50',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-3 border-l-4 ${accentMap[accent]?.split(' ').slice(0, 1).join(' ') ?? 'border-gray-400'} border-b border-gray-100`}>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accentMap[accent] ?? 'bg-gray-100 text-gray-600'}`}>{count}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function ApproveRejectButtons({ onApprove, onReject, loading }: { onApprove: () => void; onReject: () => void; loading?: boolean }) {
  return (
    <div className="flex gap-1.5">
      <button onClick={onApprove} disabled={loading} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1 px-2.5 font-medium disabled:opacity-60 flex items-center gap-1">
        {loading && <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
        Approve
      </button>
      <button onClick={onReject} disabled={loading} className="text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg py-1 px-2.5 font-medium disabled:opacity-60">Reject</button>
    </div>
  );
}
