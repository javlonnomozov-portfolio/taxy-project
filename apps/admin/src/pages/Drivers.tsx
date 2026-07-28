import { useEffect, useState } from 'react';
import { api, auth } from '../api';
import { money } from '../ui';
import { useI18n } from '../i18n';

interface Driver {
  id: string;
  firstName: string | null;
  phone: string;
  status: string;
  approvalStatus: string;
  billingMode: string;
  ratingAvg: number;
  cancelRate: number;
  balance: number;
}

function approvalBadge(s: string) {
  const cls = s === 'approved' ? 'ok' : s === 'blocked' ? 'danger' : 'warn';
  return <span className={`badge ${cls}`}>{s}</span>;
}

const EMPTY_FORM = { phone: '', firstName: '', lastName: '', make: '', model: '', color: '', plate: '', category: 'standard' };

export function Drivers() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [created, setCreated] = useState<{ phone: string; tempPassword: string } | null>(null);
  const [formErr, setFormErr] = useState('');
  const isSuperAdmin = auth.role === 'super_admin';

  const load = () => api<Driver[]>('GET', '/ops/drivers').then(setDrivers).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    try {
      const res = await api<{ driver: { id: string }; tempPassword: string }>('POST', '/ops/drivers', {
        phone: form.phone,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        vehicle: {
          make: form.make || undefined,
          model: form.model || undefined,
          color: form.color || undefined,
          plate: form.plate || undefined,
          category: form.category,
        },
      });
      setCreated({ phone: form.phone, tempPassword: res.tempPassword });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (e) {
      setFormErr((e as Error).message || t('error'));
    }
  }

  async function act(id: string, path: string, body?: unknown) {
    try {
      await api('POST', `/ops/drivers/${id}/${path}`, body);
      load();
    } catch (e) {
      alert(t('error') + ': ' + (e as Error).message);
    }
  }
  async function topup(id: string) {
    const amount = Number(prompt(t('topup_q')));
    if (!amount) return;
    await act(id, 'topup', { amount });
  }
  async function billing(id: string) {
    const mode = prompt(t('billing_q'), 'percent');
    if (!mode) return;
    const percent = mode !== 'subscription' ? Number(prompt(t('percent_q'), '10')) : undefined;
    try {
      await api('PUT', `/ops/drivers/${id}/billing`, {
        mode,
        config: percent ? { percent } : {},
      });
      load();
    } catch (e) {
      alert(t('error') + ': ' + (e as Error).message);
    }
  }

  // reyting past / bekor yuqori → flag
  const flagged = (d: Driver) =>
    Number(d.ratingAvg) > 0 && (Number(d.ratingAvg) < 3.5 || Number(d.cancelRate) > 30);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="topbar">
        <h1>{t('drivers_title')}</h1>
        {isSuperAdmin && (
          <button className="primary" onClick={() => { setShowForm((s) => !s); setCreated(null); }}>
            {showForm ? t('close') : t('add_driver')}
          </button>
        )}
      </div>

      {created && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--ok)' }}>
          <h2>{t('driver_added')}</h2>
          <p>{t('driver_added_hint')}</p>
          <div className="flex" style={{ gap: 24 }}>
            <div><div className="lbl">{t('th_phone')}</div><b>{created.phone}</b></div>
            <div><div className="lbl">{t('temp_password')}</div><b style={{ fontSize: 18, letterSpacing: 1 }}>{created.tempPassword}</b></div>
          </div>
          <p className="lbl" style={{ marginBottom: 0 }}>{t('temp_password_hint')}</p>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{t('new_driver')}</h2>
          <form onSubmit={submitNew}>
            <div className="flex" style={{ flexWrap: 'wrap', gap: 10 }}>
              <input placeholder={t('ph_phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} required style={{ minWidth: 160 }} />
              <input placeholder={t('ph_first')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              <input placeholder={t('ph_last')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              <input placeholder={t('ph_make')} value={form.make} onChange={(e) => set('make', e.target.value)} />
              <input placeholder={t('ph_model')} value={form.model} onChange={(e) => set('model', e.target.value)} />
              <input placeholder={t('ph_color')} value={form.color} onChange={(e) => set('color', e.target.value)} />
              <input placeholder={t('ph_plate')} value={form.plate} onChange={(e) => set('plate', e.target.value)} />
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="standard">{t('cat_standard')}</option>
                <option value="comfort">{t('cat_comfort')}</option>
                <option value="cargo">{t('cat_cargo')}</option>
              </select>
              <button className="primary" type="submit">{t('add')}</button>
            </div>
            {formErr && <div className="err">{formErr}</div>}
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('th_name')}</th>
              <th>{t('th_phone')}</th>
              <th>{t('th_status')}</th>
              <th>{t('th_kyc')}</th>
              <th>{t('th_billing')}</th>
              <th>{t('th_rating')}</th>
              <th>{t('th_cancel_rate')}</th>
              <th>{t('th_balance')}</th>
              <th>{t('th_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className={flagged(d) ? 'row-red' : ''}>
                <td>{d.firstName || '—'} {flagged(d) && <span className="badge danger">flag</span>}</td>
                <td>{d.phone}</td>
                <td><span className="badge muted">{d.status}</span></td>
                <td>{approvalBadge(d.approvalStatus)}</td>
                <td>{d.billingMode}</td>
                <td>{Number(d.ratingAvg).toFixed(2)}</td>
                <td>{Number(d.cancelRate).toFixed(0)}%</td>
                <td style={{ color: Number(d.balance) < 0 ? 'var(--danger)' : undefined }}>{money(d.balance)}</td>
                <td className="flex">
                  {d.approvalStatus !== 'approved' && (
                    <button className="ok" onClick={() => act(d.id, 'approve')}>{t('approve')}</button>
                  )}
                  {d.approvalStatus !== 'blocked' && (
                    <button className="danger" onClick={() => act(d.id, 'block')}>{t('block')}</button>
                  )}
                  <button onClick={() => billing(d.id)}>{t('th_billing')}</button>
                  <button onClick={() => topup(d.id)}>{t('topup')}</button>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={9} className="lbl">{t('no_drivers')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
