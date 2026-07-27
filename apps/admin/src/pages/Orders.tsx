import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { StatusBadge, money, time } from '../ui';

interface Order {
  id: string;
  status: string;
  vehicleCategory: string;
  driverId: string | null;
  finalPrice: number | null;
  createdAt: string;
  completedAt: string | null;
}

const TERMINAL = new Set([
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_DRIVER',
  'CUSTOMER_NO_SHOW',
  'NO_DRIVER',
  'CLOSED_BY_OPERATOR',
]);
type Tab = 'all' | 'active' | 'done' | 'cancelled';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'active', label: 'Joriy' },
  { key: 'done', label: 'Bajarilgan' },
  { key: 'cancelled', label: 'Bekor/Topilmadi' },
];

export function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const load = () => api<Order[]>('GET', '/ops/orders/history').then(setRows).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((o) => {
      if (tab === 'all') return true;
      if (tab === 'active') return !TERMINAL.has(o.status);
      if (tab === 'done') return o.status === 'COMPLETED';
      return TERMINAL.has(o.status) && o.status !== 'COMPLETED';
    });
  }, [rows, tab]);

  return (
    <>
      <div className="topbar"><h1>Zakazlar</h1></div>
      <div className="card">
        <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className={tab === tb.key ? 'primary' : ''}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
            </button>
          ))}
          <div className="lbl" style={{ marginLeft: 'auto' }}>Ko‘rsatilmoqda: {filtered.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Holat</th>
              <th>Toifa</th>
              <th>Narx</th>
              <th>Yaratilgan</th>
              <th>Tugagan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className={o.status === 'NO_DRIVER' ? 'row-red' : ''}>
                <td><StatusBadge status={o.status} /></td>
                <td>{o.vehicleCategory}</td>
                <td>{money(o.finalPrice)}</td>
                <td>{time(o.createdAt)}</td>
                <td>{o.completedAt ? time(o.completedAt) : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="lbl">Zakaz yo‘q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
