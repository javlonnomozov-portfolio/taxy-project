import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Page, time } from '../ui';

interface Customer {
  id: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
  isBlocked: boolean;
  ratingAvg: number;
  noShowCount: number;
  createdAt: string;
}

export function Customers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const load = () => api<Customer[]>('GET', '/ops/customers').then(setRows).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);

  const filtered = rows.filter((c) => {
    if (!q) return true;
    const s = (c.phone || '') + ' ' + (c.firstName || '') + ' ' + (c.lastName || '');
    return s.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <Page title={t('customers_title')}>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="lbl">{t('total')}: {rows.length}</div>
          <input
            placeholder={t('search_customer')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('th_name')}</th>
              <th>{t('th_phone')}</th>
              <th>{t('th_lang')}</th>
              <th>{t('th_rating')}</th>
              <th>{t('th_noshow')}</th>
              <th>{t('th_status')}</th>
              <th>{t('th_registered')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td className="mono">{c.phone || '—'}</td>
                <td>{c.language}</td>
                <td>{c.ratingAvg ?? 0}</td>
                <td>{c.noShowCount ?? 0}</td>
                <td><span className={'badge ' + (c.isBlocked ? 'danger' : 'ok')}>{c.isBlocked ? t('blocked') : t('active')}</span></td>
                <td>{time(c.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="empty">{t('no_customers')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
