'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/Layout/AppLayout';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { DashboardStats, ActivityDay, MovementType } from '@/types';
import { MOVEMENT_LABELS, MOVEMENT_DIRECTION } from '@/types';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'red' | 'green' | 'purple';
  icon: string;
}

function StatCard({ label, value, sub, color = 'blue', icon }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const TX_TYPE_COLOR: Record<MovementType, string> = {
  PURCHASE: 'text-green-600 bg-green-50',
  BRANCH_RECEIPT: 'text-teal-600 bg-teal-50',
  USAGE: 'text-blue-600 bg-blue-50',
  BRANCH_TRANSFER: 'text-orange-600 bg-orange-50',
  EXPIRY_DISPOSAL: 'text-red-600 bg-red-50',
  SUPPLIER_RETURN: 'text-purple-600 bg-purple-50',
  ADJUSTMENT: 'text-gray-600 bg-gray-100',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<ActivityDay[]>('/dashboard/activity'),
    ])
      .then(([s, a]) => { setStats(s.data); setActivity(a.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Items"
              value={stats?.totals.items ?? 0}
              color="blue"
              icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
            <StatCard
              label="Low Stock Alerts"
              value={stats?.totals.low_stock ?? 0}
              color="red"
              sub="Items below minimum"
              icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
            <StatCard
              label="Categories"
              value={stats?.totals.categories ?? 0}
              color="purple"
              icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
            <StatCard
              label="Transactions (30d)"
              value={stats?.totals.recent_transactions ?? 0}
              color="green"
              icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Activity Chart */}
            <div className="card xl:col-span-2">
              <h3 className="font-semibold text-gray-800 mb-4">Stock Activity (Last 30 Days)</h3>
              {activity.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={activity}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => format(new Date(d), 'MMM d')}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(d: string) => format(new Date(d), 'MMM d, yyyy')} />
                    <Bar dataKey="stock_in" name="Stock In" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="stock_out" name="Stock Out" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
                  No transaction data yet
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Items by Category</h3>
              <div className="space-y-3">
                {stats?.category_breakdown?.slice(0, 6).map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-sm text-gray-600 flex-1 truncate">{c.name}</span>
                    <span className="text-sm font-medium text-gray-900">{c.item_count}</span>
                  </div>
                ))}
                {!stats?.category_breakdown?.length && (
                  <p className="text-sm text-gray-400">No data</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Low Stock */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Low Stock Items</h3>
              {stats?.low_stock_items?.length ? (
                <div className="space-y-2">
                  {stats.low_stock_items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.category_name}</p>
                      </div>
                      <div className="text-right">
                        <span className="badge bg-red-50 text-red-600">
                          {item.quantity} {item.unit}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">Min: {item.min_quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">All items are well stocked</p>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Recent Transactions</h3>
              {stats?.recent_transactions?.length ? (
                <div className="space-y-2">
                  {stats.recent_transactions.map((tx) => {
                    const mvType = tx.type as MovementType;
                    const dir = MOVEMENT_DIRECTION[mvType];
                    return (
                      <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <span className={`badge text-xs ${TX_TYPE_COLOR[mvType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {MOVEMENT_LABELS[mvType] ?? tx.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{tx.item_name ?? `#${tx.item_id}`}</p>
                          <p className="text-xs text-gray-400">{tx.performed_by_name}</p>
                        </div>
                        <span className={`text-sm font-medium ${dir === 'IN' ? 'text-green-600' : dir === 'OUT' ? 'text-red-600' : 'text-gray-600'}`}>
                          {dir === 'IN' ? '+' : dir === 'OUT' ? '-' : '±'}{tx.quantity} {tx.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No recent transactions</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
