import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { api } from '../api';
import { connectOps } from '../socket';
import { StatusBadge, money, time } from '../ui';

interface Order {
  id: string;
  status: string;
  vehicleCategory: string;
  customerId: string;
  driverId: string | null;
  pickupLat: number;
  pickupLng: number;
  finalPrice: number | null;
  createdAt: string;
}
interface DriverPos { driverId: string; lat: number; lng: number; status: string; category: string }
interface Alert { type: string; orderId?: string; message: string; at: number }

// Xizmat hududi markazi — Bulung'ur (Samarqand viloyati).
const CENTER: [number, number] = [39.7683, 67.2792];

// Ranglar — taksi va zakaz turlari bir-biridan farq qilib tursin.
const COLOR = {
  idle: '#3ddc84', // bo'sh taksi (yashil)
  onTrip: '#8b95a5', // safardagi taksi (kulrang)
  noDriver: '#ff4d4f', // qabul qilinmagan zakaz (qizil)
  dispatching: '#f59e0b', // taklif yuborilmoqda (to'q sariq)
  assigned: '#4c8dff', // biriktirilgan zakaz (ko'k)
};
function orderColor(status: string): string {
  if (status === 'NO_DRIVER') return COLOR.noDriver;
  if (status === 'DISPATCHING' || status === 'CREATED') return COLOR.dispatching;
  return COLOR.assigned;
}
const ASSIGNABLE = ['NO_DRIVER', 'DISPATCHING', 'CREATED'];

// Tanlangan zakazga xaritani uchiradi.
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, 14);
  }, [pos, map]);
  return null;
}

export function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Record<string, DriverPos>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    try {
      setOrders(await api<Order[]>('GET', '/ops/orders'));
    } catch { /* ignore */ }
  }

  // Boshlang'ich onlayn/safardagi taksilar (socket yangilanishlarigacha xarita bo'sh qolmasin).
  async function loadDrivers() {
    try {
      const list = await api<DriverPos[]>('GET', '/ops/drivers/online');
      setDrivers(Object.fromEntries(list.map((d) => [d.driverId, d])));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    loadDrivers();
    const s = connectOps();
    s.on('order:update', () => load());
    s.on('driver:update', (d: DriverPos) =>
      setDrivers((prev) => ({ ...prev, [d.driverId]: d })),
    );
    s.on('alert', (a: Omit<Alert, 'at'>) =>
      setAlerts((prev) => [{ ...a, at: Date.now() }, ...prev].slice(0, 50)),
    );
    const iv = setInterval(() => {
      load();
      loadDrivers();
    }, 10000);
    return () => {
      s.close();
      clearInterval(iv);
    };
  }, []);

  const activeDrivers = useMemo(
    () => Object.values(drivers).filter((d) => d.status !== 'OFFLINE'),
    [drivers],
  );
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );
  // Tanlangan zakaz uchun taklif yuborish rejimi (faqat biriktirilmagan zakazlar).
  const dispatchMode = !!selectedOrder && ASSIGNABLE.includes(selectedOrder.status);
  // Xaritada ko'rsatiladigan zakazlar: tanlangan bo'lsa faqat o'sha.
  const visibleOrders = selectedOrder ? [selectedOrder] : orders;

  async function sendOffer(driverId: string) {
    if (!selectedOrder) return;
    if (!confirm('Bu taksiga so‘rov yuborilsinmi?')) return;
    try {
      await api('POST', `/ops/orders/${selectedOrder.id}/offer`, { driverId });
      setSelectedId(null);
      load();
      alert('✅ So‘rov yuborildi — haydovchi qabul qilishini kuting.');
    } catch (e) {
      alert('Xato: ' + (e as Error).message);
    }
  }

  async function close(o: Order) {
    if (!confirm('Buyurtmani yopish?')) return;
    await api('POST', `/ops/orders/${o.id}/close`, { reason: 'operator' });
    if (selectedId === o.id) setSelectedId(null);
    load();
  }

  const selectedPos: [number, number] | null =
    selectedOrder && selectedOrder.pickupLat != null
      ? [selectedOrder.pickupLat, selectedOrder.pickupLng]
      : null;

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
          <div className="big">{activeDrivers.length}</div>
          <div className="lbl">Onlayn haydovchilar</div>
        </div>
        <div className="card">
          <div className="big" style={{ color: alerts.length ? 'var(--danger)' : undefined }}>
            {alerts.length}
          </div>
          <div className="lbl">Ogohlantirishlar</div>
        </div>
      </div>

      {/* Taklif yuborish rejimi — banner */}
      {dispatchMode && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderColor: COLOR.dispatching,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            🚕 <b>Buyurtma uchun</b> xaritadan yoki quyidagi ro‘yxatdan bo‘sh taksini tanlang va
            <b> so‘rov yuboring</b>.
          </span>
          <button className="danger" onClick={() => setSelectedId(null)}>
            Bekor qilish
          </button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 380, position: 'relative' }}>
          <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            <FlyTo pos={selectedPos} />

            {activeDrivers.map((d) => {
              const idle = d.status === 'ONLINE_IDLE';
              const canOffer = dispatchMode && idle;
              return (
                <CircleMarker
                  key={d.driverId}
                  center={[d.lat, d.lng]}
                  radius={canOffer ? 9 : 7}
                  pathOptions={{
                    color: idle ? COLOR.idle : COLOR.onTrip,
                    fillColor: idle ? COLOR.idle : COLOR.onTrip,
                    fillOpacity: 0.85,
                    weight: canOffer ? 3 : 1,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 150 }}>
                      <b>Taksi {d.driverId.slice(0, 8)}</b>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {idle ? 'Bo‘sh (onlayn)' : 'Safarda'} · {d.category}
                      </div>
                      {canOffer && (
                        <button
                          className="primary"
                          style={{ marginTop: 8, width: '100%' }}
                          onClick={() => sendOffer(d.driverId)}
                        >
                          📨 So‘rov yuborish
                        </button>
                      )}
                      {dispatchMode && !idle && (
                        <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
                          Safarda — so‘rov yuborib bo‘lmaydi
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {visibleOrders.map((o) => {
              if (o.pickupLat == null) return null;
              const sel = o.id === selectedId;
              return (
                <CircleMarker
                  key={o.id}
                  center={[o.pickupLat, o.pickupLng]}
                  radius={sel ? 10 : 6}
                  pathOptions={{
                    color: orderColor(o.status),
                    fillColor: orderColor(o.status),
                    fillOpacity: sel ? 0.9 : 0.6,
                    weight: sel ? 3 : 1,
                  }}
                >
                  <Popup>Buyurtma · {o.status}</Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Ranglar izohi */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              zIndex: 1000,
              background: 'rgba(20,24,34,0.85)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              lineHeight: 1.6,
              color: '#cdd3df',
            }}
          >
            <div><span style={{ color: COLOR.idle }}>●</span> Bo‘sh taksi</div>
            <div><span style={{ color: COLOR.onTrip }}>●</span> Safardagi taksi</div>
            <div><span style={{ color: COLOR.noDriver }}>●</span> Haydovchisiz zakaz</div>
            <div><span style={{ color: COLOR.assigned }}>●</span> Biriktirilgan zakaz</div>
          </div>
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
            {orders.map((o) => {
              const assignable = ASSIGNABLE.includes(o.status);
              const sel = o.id === selectedId;
              return (
                <tr
                  key={o.id}
                  onClick={() => assignable && setSelectedId(sel ? null : o.id)}
                  className={o.status === 'NO_DRIVER' ? 'row-red' : ''}
                  style={{
                    cursor: assignable ? 'pointer' : 'default',
                    outline: sel ? `2px solid ${COLOR.dispatching}` : undefined,
                  }}
                >
                  <td><StatusBadge status={o.status} /></td>
                  <td>{o.vehicleCategory}</td>
                  <td>{money(o.finalPrice)}</td>
                  <td>{time(o.createdAt)}</td>
                  <td className="flex" onClick={(e) => e.stopPropagation()}>
                    {assignable && (
                      <button className="primary" onClick={() => setSelectedId(sel ? null : o.id)}>
                        {sel ? 'Tanlangan ✓' : 'Taksi tanlash'}
                      </button>
                    )}
                    <button className="danger" onClick={() => close(o)}>Yopish</button>
                  </td>
                </tr>
              );
            })}
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
