import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Modal } from '../Modal';
import { CategoryLabel, Page, time } from '../ui';

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

  // Tasdiqlash dispatch'ni ISHGA TUSHIRADI — tasodifan bosilmasin.
  // Avval `window.confirm()` edi (dizayndan chetda, brauzer bloklashi mumkin).
  const [confirmFor, setConfirmFor] = useState<Order | null>(null);

  async function doConfirm() {
    if (!confirmFor) return;
    await api('POST', `/ops/orders/${confirmFor.id}/confirm-scheduled`, {});
    setConfirmFor(null);
    load();
  }

  return (
    <Page title={t('scheduled_title')}>

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
                <td><CategoryLabel category={o.vehicleCategory} /></td>
                <td><b>{time(o.scheduledAt)}</b></td>
                <td>{o.note || '—'}</td>
                <td>{time(o.createdAt)}</td>
                <td><button className="primary" onClick={() => setConfirmFor(o)}>{t('confirm')}</button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="empty">{t('no_scheduled')}</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmFor && (
        <Modal
          title={t('confirm')}
          onClose={() => setConfirmFor(null)}
          footer={
            <>
              <button onClick={() => setConfirmFor(null)}>{t('cancel')}</button>
              <button className="primary" onClick={doConfirm}>{t('confirm')}</button>
            </>
          }
        >
          <div className="hint">{t('scheduled_confirm_q')}</div>
          <div className="hint">
            <b><CategoryLabel category={confirmFor.vehicleCategory} /></b>
            {' · '}
            {time(confirmFor.scheduledAt)}
            {confirmFor.note ? ` · ${confirmFor.note}` : ''}
          </div>
        </Modal>
      )}
    </Page>
  );
}
