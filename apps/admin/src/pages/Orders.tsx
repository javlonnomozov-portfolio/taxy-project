import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
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
const TAB_KEYS: { key: Tab; i18n: string }[] = [
  { key: 'all', i18n: 'tab_all' },
  { key: 'active', i18n: 'tab_active' },
  { key: 'done', i18n: 'tab_done' },
  { key: 'cancelled', i18n: 'tab_cancelled' },
];

export function Orders() {
  const { t } = useI18n();
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
      <div className="topbar"><h1>{t('orders_title')}</h1></div>
      <div className="card">
        <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
          {TAB_KEYS.map((tb) => (
            <button
              key={tb.key}
              className={tab === tb.key ? 'primary' : ''}
              onClick={() => setTab(tb.key)}
            >
              {t(tb.i18n)}
            </button>
          ))}
          <div className="lbl" style={{ marginLeft: 'auto' }}>{t('showing')}: {filtered.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t('th_status')}</th>
              <th>{t('th_category')}</th>
              <th>{t('th_price')}</th>
              <th>{t('th_created')}</th>
              <th>{t('th_finished')}</th>
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
              <tr><td colSpan={5} className="lbl">{t('no_orders')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
