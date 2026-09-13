import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { shortId, CategoryLabel, Page, StatusBadge, money, time } from '../ui';

interface Order {
  id: string;
  status: string;
  vehicleCategory: string;
  driverId: string | null;
  finalPrice: number | null;
  fareAdjustment: number;
  fareAdjustmentReason: string | null;
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
  // Narx tuzatish oynasi ochilgan zakaz (bittadan ortiq ochilmasin).
  const [fareFor, setFareFor] = useState<Order | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api<Order[]>('GET', '/ops/orders/history').then(setRows).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  function openFare(o: Order) {
    setFareFor(o);
    setAmount(String(o.fareAdjustment || ''));
    setReason(o.fareAdjustmentReason ?? '');
    setMsg('');
  }

  /**
   * Taksometrdan tashqari summa (yuk, uzoq kutish va h.k.).
   *
   * Xatoni KO'RSATAMIZ: server sabab uzunligini va chegaralarni tekshiradi,
   * jimgina yutilsa operator "kiritdim" deb o'ylab yuraverardi.
   */
  async function saveFare() {
    if (!fareFor) return;
    try {
      await api('POST', `/ops/orders/${fareFor.id}/fare`, {
        amount: Number(amount) || 0,
        reason: reason.trim(),
      });
      setFareFor(null);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter((o) => {
      if (tab === 'all') return true;
      if (tab === 'active') return !TERMINAL.has(o.status);
      if (tab === 'done') return o.status === 'COMPLETED';
      return TERMINAL.has(o.status) && o.status !== 'COMPLETED';
    });
  }, [rows, tab]);

  return (
    <Page title={t('orders_title')}>

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
              <th>{t('th_id')}</th>
              <th>{t('th_category')}</th>
              <th>{t('th_price')}</th>
              <th>{t('th_adjustment')}</th>
              <th>{t('th_created')}</th>
              <th>{t('th_finished')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className={o.status === 'NO_DRIVER' ? 'row-red' : ''}>
                <td><StatusBadge status={o.status} /></td>
                <td className="mono">{shortId(o.id)}</td>
                <td><CategoryLabel category={o.vehicleCategory} /></td>
                <td className="num">{money(o.finalPrice)}</td>
                <td className="num" title={o.fareAdjustmentReason ?? ''}>
                  {o.fareAdjustment ? (
                    <span>
                      {o.fareAdjustment > 0 ? '+' : ''}
                      {money(o.fareAdjustment)}
                      {o.fareAdjustmentReason ? (
                        <div className="lbl">{o.fareAdjustmentReason}</div>
                      ) : null}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="num">{time(o.createdAt)}</td>
                <td className="num">{o.completedAt ? time(o.completedAt) : '—'}</td>
                <td>
                  {/* Faqat FAOL zakazda: yakunlangan safarning narxi mijozga
                      aytilgan va komissiya yechilgan — server ham buni rad etadi. */}
                  {!TERMINAL.has(o.status) ? (
                    <button onClick={() => openFare(o)}>{t('adjust_fare')}</button>
                  ) : null}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="empty">{t('no_orders')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Narx tuzatish oynasi */}
      {fareFor ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{t('adjust_fare')} — {shortId(fareFor.id)}</h2>
          <div className="lbl" style={{ marginBottom: 8 }}>{t('adjust_fare_hint')}</div>
          <div className="flex" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label className="flex">
              {t('adjust_amount')}
              <input
                type="number"
                step={1000}
                style={{ width: 120 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="flex" style={{ flex: 1, minWidth: 220 }}>
              {t('adjust_reason')}
              <input
                style={{ flex: 1 }}
                placeholder={t('adjust_reason_ph')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className="primary" onClick={saveFare}>{t('save')}</button>
            <button onClick={() => setFareFor(null)}>{t('cancel')}</button>
          </div>
          {msg ? <div className="lbl" style={{ marginTop: 8, color: '#D92D20' }}>{msg}</div> : null}
        </div>
      ) : null}
    </Page>
  );
}
