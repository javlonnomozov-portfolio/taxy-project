import { useEffect, useState } from 'react';
import { api } from '../api';
import { time } from '../ui';

interface Order {
  id: string;
  vehicleCategory: string;
  scheduledAt: string | null;
  note: string | null;
  createdAt: string;
}

export function Scheduled() {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = () => api<Order[]>('GET', '/ops/scheduled').then(setOrders).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  async function confirm(id: string) {
    if (!window.confirm('Mijoz bilan tasdiqlandi — dispatch boshlansinmi?')) return;
    await api('POST', `/ops/orders/${id}/confirm-scheduled`, {});
    load();
  }

  return (
    <>
      <div className="topbar"><h1>Oldindan buyurtmalar</h1></div>
      <div className="card">
        <p className="lbl" style={{ marginTop: 0 }}>
          Operator ~2 soat oldin mijoz bilan bog‘lanib tasdiqlaydi; tasdiqdan keyin dispatch boshlanadi.
        </p>
        <table>
          <thead>
            <tr><th>Toifa</th><th>Belgilangan vaqt</th><th>Izoh</th><th>Yaratilgan</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.vehicleCategory}</td>
                <td><b>{time(o.scheduledAt)}</b></td>
                <td>{o.note || '—'}</td>
                <td>{time(o.createdAt)}</td>
                <td><button className="primary" onClick={() => confirm(o.id)}>Tasdiqlash</button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="lbl">Oldindan buyurtma yo‘q</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
