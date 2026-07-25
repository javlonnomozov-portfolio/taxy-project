import { useEffect, useState } from 'react';
import { api, auth } from '../api';
import { money } from '../ui';

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
      setFormErr((e as Error).message || 'Xato');
    }
  }

  async function act(id: string, path: string, body?: unknown) {
    try {
      await api('POST', `/ops/drivers/${id}/${path}`, body);
      load();
    } catch (e) {
      alert('Xato: ' + (e as Error).message);
    }
  }
  async function topup(id: string) {
    const amount = Number(prompt('To‘ldirish summasi (so‘m):'));
    if (!amount) return;
    await act(id, 'topup', { amount });
  }
  async function billing(id: string) {
    const mode = prompt('Billing rejimi: subscription / percent / hybrid', 'percent');
    if (!mode) return;
    const percent = mode !== 'subscription' ? Number(prompt('Foiz %:', '10')) : undefined;
    try {
      await api('PUT', `/ops/drivers/${id}/billing`, {
        mode,
        config: percent ? { percent } : {},
      });
      load();
    } catch (e) {
      alert('Xato: ' + (e as Error).message);
    }
  }

  // reyting past / bekor yuqori → flag
  const flagged = (d: Driver) =>
    Number(d.ratingAvg) > 0 && (Number(d.ratingAvg) < 3.5 || Number(d.cancelRate) > 30);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="topbar">
        <h1>Haydovchilar</h1>
        {isSuperAdmin && (
          <button className="primary" onClick={() => { setShowForm((s) => !s); setCreated(null); }}>
            {showForm ? 'Yopish' : '+ Haydovchi qo‘shish'}
          </button>
        )}
      </div>

      {created && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--ok)' }}>
          <h2>✅ Haydovchi qo‘shildi — bir martalik parol</h2>
          <p>Haydovchiga bu ma’lumotlarni bering (parol faqat bir marta ko‘rsatiladi):</p>
          <div className="flex" style={{ gap: 24 }}>
            <div><div className="lbl">Telefon</div><b>{created.phone}</b></div>
            <div><div className="lbl">Vaqtinchalik parol</div><b style={{ fontSize: 18, letterSpacing: 1 }}>{created.tempPassword}</b></div>
          </div>
          <p className="lbl" style={{ marginBottom: 0 }}>Haydovchi birinchi kirishda parolni almashtiradi.</p>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Yangi haydovchi (ofis KYC)</h2>
          <form onSubmit={submitNew}>
            <div className="flex" style={{ flexWrap: 'wrap', gap: 10 }}>
              <input placeholder="Telefon +99890..." value={form.phone} onChange={(e) => set('phone', e.target.value)} required style={{ minWidth: 160 }} />
              <input placeholder="Ism" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              <input placeholder="Familiya" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              <input placeholder="Marka" value={form.make} onChange={(e) => set('make', e.target.value)} />
              <input placeholder="Model" value={form.model} onChange={(e) => set('model', e.target.value)} />
              <input placeholder="Rang" value={form.color} onChange={(e) => set('color', e.target.value)} />
              <input placeholder="Davlat raqami" value={form.plate} onChange={(e) => set('plate', e.target.value)} />
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="standard">Oddiy</option>
                <option value="comfort">Komfort</option>
                <option value="cargo">Yukli</option>
              </select>
              <button className="primary" type="submit">Qo‘shish</button>
            </div>
            {formErr && <div className="err">{formErr}</div>}
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Ism</th>
              <th>Telefon</th>
              <th>Holat</th>
              <th>KYC</th>
              <th>Billing</th>
              <th>Reyting</th>
              <th>Bekor %</th>
              <th>Balans</th>
              <th>Amallar</th>
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
                    <button className="ok" onClick={() => act(d.id, 'approve')}>Tasdiqlash</button>
                  )}
                  {d.approvalStatus !== 'blocked' && (
                    <button className="danger" onClick={() => act(d.id, 'block')}>Bloklash</button>
                  )}
                  <button onClick={() => billing(d.id)}>Billing</button>
                  <button onClick={() => topup(d.id)}>To‘ldirish</button>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={9} className="lbl">Haydovchi yo‘q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
