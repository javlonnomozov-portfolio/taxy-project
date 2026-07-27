import { useEffect, useState } from 'react';
import { api } from '../api';
import { time } from '../ui';

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
    <>
      <div className="topbar"><h1>Foydalanuvchilar</h1></div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="lbl">Jami: {rows.length}</div>
          <input
            placeholder="Qidirish (ism yoki telefon)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Ism</th>
              <th>Telefon</th>
              <th>Til</th>
              <th>Reyting</th>
              <th>No-show</th>
              <th>Holat</th>
              <th>Ro‘yxatdan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.language}</td>
                <td>{c.ratingAvg ?? 0}</td>
                <td>{c.noShowCount ?? 0}</td>
                <td>{c.isBlocked ? '🚫 Bloklangan' : '✅ Faol'}</td>
                <td>{time(c.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="lbl">Foydalanuvchi topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
