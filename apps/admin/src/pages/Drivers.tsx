import { useEffect, useState } from 'react';
import { api, auth } from '../api';
import { Page, BillingLabel, money } from '../ui';
import { useI18n } from '../i18n';
import { Modal } from '../Modal';

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
  /** Mashinalar — o'rinlar soni 5+ yo'lovchi filtri uchun MUHIM. */
  vehicles?: { id: string; model: string | null; plate: string | null; seats: number }[];
}

/**
 * Mashina o'rinlari — joyida tahrirlanadi.
 *
 * Bu MAJBURIY, bezak emas: 5+ yo'lovchi filtri aynan shu qiymatga tayanadi.
 * Operator uni sozlay olmasa, Damas haydovchilari 4 o'rinli bo'lib qolib,
 * katta oilalar hech qachon taksi topolmasdi (CUSTOMER-APP-PLAN.md §4b.5).
 */
function SeatsCell({ driver, onSaved }: { driver: Driver; onSaved: () => void }) {
  const v = driver.vehicles?.[0];
  const [value, setValue] = useState(String(v?.seats ?? 4));
  const [busy, setBusy] = useState(false);
  if (!v) return <span className="lbl">—</span>;

  const dirty = String(v.seats) !== value;
  async function save() {
    setBusy(true);
    try {
      await api('PUT', `/ops/drivers/${driver.id}/vehicle`, { seats: Number(value) });
      onSaved();
    } catch {
      setValue(String(v?.seats ?? 4)); // qaytarib qo'yamiz — jim qolmasin
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex" style={{ gap: 4 }}>
      <input
        style={{ width: 48 }}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 1))}
      />
      {dirty && (
        <button className="primary" disabled={busy} onClick={save}>✓</button>
      )}
    </span>
  );
}

function approvalBadge(s: string) {
  const cls = s === 'approved' ? 'ok' : s === 'blocked' ? 'danger' : 'warn';
  return <span className={`badge ${cls}`}>{s}</span>;
}

const EMPTY_FORM = { phone: '', firstName: '', lastName: '', make: '', model: '', color: '', plate: '', category: 'standard', seats: '4' };

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
          seats: Number(form.seats) || 4,
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
      setActErr('');
      load();
    } catch (e) {
      // Avval `alert()` edi — dizayndan chetda ko'rinardi va brauzer bloklashi
      // mumkin. Endi xato sahifada qoladi.
      setActErr((e as Error).message || t('error'));
    }
  }

  async function saveBilling() {
    if (!billingFor) return;
    // `per_order` da haydovchi bilan alohida kelishuv bo'lsa — tizim
    // sozlamasidan ustun turadigan summa.
    const config: Record<string, number> = {};
    if (bMode === 'percent' || bMode === 'hybrid') config.percent = Number(bPercent) || 0;
    if (bMode === 'per_order' && bPerOrder !== '') config.perOrder = Number(bPerOrder) || 0;
    try {
      await api('PUT', `/ops/drivers/${billingFor.id}/billing`, { mode: bMode, config });
      setBillingFor(null);
      setActErr('');
      load();
    } catch (e) {
      setActErr((e as Error).message || t('error'));
    }
  }

  async function saveTopup() {
    if (!topupFor) return;
    const amount = Number(tAmount);
    if (!amount) return;
    await act(topupFor.id, 'topup', { amount, note: tNote || undefined });
    setTopupFor(null);
  }

  // reyting past / bekor yuqori → flag
  const flagged = (d: Driver) =>
    Number(d.ratingAvg) > 0 && (Number(d.ratingAvg) < 3.5 || Number(d.cancelRate) > 30);

  // Modal holatlari (brauzer prompt() o'rniga)
  const [billingFor, setBillingFor] = useState<Driver | null>(null);
  const [bMode, setBMode] = useState('percent');
  const [bPercent, setBPercent] = useState('10');
  const [bPerOrder, setBPerOrder] = useState('');
  const [topupFor, setTopupFor] = useState<Driver | null>(null);
  const [tAmount, setTAmount] = useState('');
  const [tNote, setTNote] = useState('');
  const [actErr, setActErr] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Page
      title={t('drivers_title')}
      actions={
        isSuperAdmin && (
          <button className="primary" onClick={() => { setShowForm((s) => !s); setCreated(null); }}>
            {showForm ? t('close') : t('add_driver')}
          </button>
        )
      }
    >

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
              <input
                style={{ width: 90 }}
                placeholder={t('ph_seats')}
                value={form.seats}
                onChange={(e) => set('seats', e.target.value.replace(/[^0-9]/g, '').slice(0, 1))}
              />
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
              <th>{t('th_seats')}</th>
              <th>{t('th_balance')}</th>
              <th>{t('th_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className={flagged(d) ? 'row-red' : ''}>
                <td>{d.firstName || '—'} {flagged(d) && <span className="badge danger">flag</span>}</td>
                <td className="mono">{d.phone}</td>
                <td><span className={'badge ' + (d.status === 'OFFLINE' ? 'muted' : 'ok')}>{d.status}</span></td>
                <td>{approvalBadge(d.approvalStatus)}</td>
                <td><BillingLabel mode={d.billingMode} /></td>
                <td>{Number(d.ratingAvg).toFixed(2)}</td>
                <td>{Number(d.cancelRate).toFixed(0)}%</td>
                <td><SeatsCell driver={d} onSaved={load} /></td>
                <td className={Number(d.balance) < 0 ? 'num neg' : 'num'}>{money(d.balance)}</td>
                <td><div className="cell-actions">
                  {d.approvalStatus !== 'approved' && (
                    <button className="ok" onClick={() => act(d.id, 'approve')}>{t('approve')}</button>
                  )}
                  {d.approvalStatus !== 'blocked' && (
                    <button className="danger" onClick={() => act(d.id, 'block')}>{t('block')}</button>
                  )}
                  <button
                    onClick={() => {
                      setBillingFor(d);
                      setBMode(d.billingMode || 'percent');
                      setBPercent('10');
                      setBPerOrder('');
                    }}
                  >
                    {t('th_billing')}
                  </button>
                  <button onClick={() => { setTopupFor(d); setTAmount(''); setTNote(''); }}>
                    {t('topup')}
                  </button>
                  </div></td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={9} className="empty">{t('no_drivers')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {actErr && <div className="toast err">{actErr}</div>}

      {/* Billing rejimi — RO'YXATDAN tanlanadi. Avval `prompt()` da qo'lda
          yozish kerak edi: xato terilsa server 500 berardi (ENUM turi). */}
      {billingFor && (
        <Modal
          title={`${t('th_billing')} — ${billingFor.firstName || billingFor.phone}`}
          onClose={() => setBillingFor(null)}
          footer={
            <>
              <button onClick={() => setBillingFor(null)}>{t('cancel')}</button>
              <button className="primary" onClick={saveBilling}>{t('save')}</button>
            </>
          }
        >
          <label className="field">
            <span>{t('billing_mode_label')}</span>
            <select value={bMode} onChange={(e) => setBMode(e.target.value)}>
              <option value="subscription">{t('bm_subscription')}</option>
              <option value="percent">{t('bm_percent')}</option>
              <option value="hybrid">{t('bm_hybrid')}</option>
              <option value="per_order">{t('bm_per_order')}</option>
            </select>
          </label>

          {(bMode === 'percent' || bMode === 'hybrid') && (
            <label className="field">
              <span>{t('percent_label')}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={bPercent}
                onChange={(e) => setBPercent(e.target.value)}
              />
            </label>
          )}

          {bMode === 'per_order' && (
            <label className="field">
              <span>{t('per_order_label')}</span>
              <input
                type="number"
                min={0}
                step={100}
                placeholder={t('per_order_placeholder')}
                value={bPerOrder}
                onChange={(e) => setBPerOrder(e.target.value)}
              />
              <span className="hint">{t('per_order_hint_driver')}</span>
            </label>
          )}

          {bMode === 'subscription' && <div className="hint">{t('bm_subscription_hint')}</div>}
        </Modal>
      )}

      {/* Balansni to'ldirish */}
      {topupFor && (
        <Modal
          title={`${t('topup')} — ${topupFor.firstName || topupFor.phone}`}
          onClose={() => setTopupFor(null)}
          footer={
            <>
              <button onClick={() => setTopupFor(null)}>{t('cancel')}</button>
              <button className="primary" onClick={saveTopup} disabled={!Number(tAmount)}>
                {t('save')}
              </button>
            </>
          }
        >
          <div className="hint">
            {t('th_balance')}: <b>{money(topupFor.balance)}</b>
          </div>
          <label className="field">
            <span>{t('topup_amount_label')}</span>
            <input
              type="number"
              min={0}
              step={1000}
              autoFocus
              value={tAmount}
              onChange={(e) => setTAmount(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('topup_note_label')}</span>
            <input value={tNote} onChange={(e) => setTNote(e.target.value)} />
          </label>
        </Modal>
      )}
    </Page>
  );
}
