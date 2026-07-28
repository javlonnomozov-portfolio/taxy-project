import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { time } from '../ui';

interface Order {
  id: string;
  vehicleCategory: string;
  scheduledAt: string | null;
  note: string | null;
  createdAt: string;
}

export function Scheduled() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const load = () => api<Order[]>('GET', '/ops/scheduled').then(setOrders).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  async function confirm(id: string) {
    if (!window.confirm(t('scheduled_confirm_q'))) return;
    await api('POST', `/ops/orders/${id}/confirm-scheduled`, {});
    load();
  }

  return (
    <>
      <div className="topbar"><h1>{t('scheduled_title')}</h1></div>
      <div className="card">
        <p className="lbl" style={{ marginTop: 0 }}>
          {t('scheduled_hint')}
        </p>
        <table>
          <thead>
            <tr><th>{t('th_category')}</th><th>{t('th_scheduled_at')}</th><th>{t('th_note')}</th><th>{t('th_created')}</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.vehicleCategory}</td>
                <td><b>{time(o.scheduledAt)}</b></td>
                <td>{o.note || '—'}</td>
                <td>{time(o.createdAt)}</td>
                <td><button className="primary" onClick={() => confirm(o.id)}>{t('confirm')}</button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="lbl">{t('no_scheduled')}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
