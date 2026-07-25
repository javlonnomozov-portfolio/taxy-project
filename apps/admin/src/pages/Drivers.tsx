import { useEffect, useState } from 'react';
import { api } from '../api';
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

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const load = () => api<Driver[]>('GET', '/ops/drivers').then(setDrivers).catch(() => {});
  useEffect(() => {
    load();
  }, []);

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

  return (
    <>
      <div className="topbar"><h1>Haydovchilar</h1></div>
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
