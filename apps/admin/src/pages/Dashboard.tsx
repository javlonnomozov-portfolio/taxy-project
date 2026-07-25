import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { api } from '../api';
import { connectOps } from '../socket';
import { StatusBadge, money, time } from '../ui';

interface Order {
  id: string;
  status: string;
  vehicleCategory: string;
  customerId: string;
  driverId: string | null;
  pickupPoint: { coordinates: [number, number] };
  finalPrice: number | null;
  createdAt: string;
}
interface DriverPos { driverId: string; lat: number; lng: number; status: string; category: string }
interface Alert { type: string; orderId?: string; message: string; at: number }

const CENTER: [number, number] = [41.311, 69.24];

export function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Record<string, DriverPos>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function load() {
    try {
      setOrders(await api<Order[]>('GET', '/ops/orders'));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const s = connectOps();
    s.on('order:update', () => load());
    s.on('driver:update', (d: DriverPos) =>
      setDrivers((prev) => ({ ...prev, [d.driverId]: d })),
    );
    s.on('alert', (a: Omit<Alert, 'at'>) =>
      setAlerts((prev) => [{ ...a, at: Date.now() }, ...prev].slice(0, 50)),
    );
    const iv = setInterval(load, 10000);
    return () => {
      s.close();
      clearInterval(iv);
    };
  }, []);

  const onlineDrivers = useMemo(
    () => Object.values(drivers).filter((d) => d.status !== 'OFFLINE'),
    [drivers],
  );

  async function assign(o: Order) {
    const driverId = prompt('Haydovchi ID (qo‘lda biriktirish):');
    if (!driverId) return;
    try {
      await api('POST', `/ops/orders/${o.id}/assign`, { driverId });
      load();
    } catch (e) {
      alert('Xato: ' + (e as Error).message);
    }
  }
  async function close(o: Order) {
    if (!confirm('Buyurtmani yopish?')) return;
    await api('POST', `/ops/orders/${o.id}/close`, { reason: 'operator' });
    load();
  }

  return (
    <>
      <div className="topbar">
        <h1>Boshqaruv paneli</h1>
      </div>

      <div className="stat" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="big">{orders.length}</div>
          <div className="lbl">Faol buyurtmalar</div>
        </div>
        <div className="card">
          <div className="big">{onlineDrivers.length}</div>
          <div className="lbl">Onlayn haydovchilar</div>
        </div>
        <div className="card">
          <div className="big" style={{ color: alerts.length ? 'var(--danger)' : undefined }}>
            {alerts.length}
          </div>
          <div className="lbl">Ogohlantirishlar</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 380 }}>
          <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            {onlineDrivers.map((d) => (
              <CircleMarker
                key={d.driverId}
                center={[d.lat, d.lng]}
                radius={7}
                pathOptions={{ color: '#3ddc84', fillColor: '#3ddc84', fillOpacity: 0.8 }}
              >
                <Popup>Haydovchi {d.driverId.slice(0, 8)} · {d.status}</Popup>
              </CircleMarker>
            ))}
            {orders.map((o) => {
              const [lng, lat] = o.pickupPoint?.coordinates ?? [];
              if (lat == null) return null;
              return (
                <CircleMarker
                  key={o.id}
                  center={[lat, lng]}
                  radius={6}
                  pathOptions={{ color: '#4c8dff', fillColor: '#4c8dff', fillOpacity: 0.7 }}
                >
                  <Popup>Buyurtma · {o.status}</Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div className="card">
          <h2>Ogohlantirishlar</h2>
          <div className="alerts">
            {alerts.length === 0 && <div className="lbl">Hozircha yo‘q</div>}
            {alerts.map((a, i) => (
              <div key={i} className={`alert ${a.type}`}>
                <b>{a.type}</b> — {a.message}
                <div className="lbl">{new Date(a.at).toLocaleTimeString('uz-UZ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Faol buyurtmalar</h2>
        <table>
          <thead>
            <tr>
              <th>Holat</th>
              <th>Toifa</th>
              <th>Narx</th>
              <th>Yaratilgan</th>
              <th>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={o.status === 'NO_DRIVER' ? 'row-red' : ''}>
                <td><StatusBadge status={o.status} /></td>
                <td>{o.vehicleCategory}</td>
                <td>{money(o.finalPrice)}</td>
                <td>{time(o.createdAt)}</td>
                <td className="flex">
                  {o.status === 'NO_DRIVER' && (
                    <button className="primary" onClick={() => assign(o)}>Biriktirish</button>
                  )}
                  <button className="danger" onClick={() => close(o)}>Yopish</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="lbl">Faol buyurtma yo‘q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
