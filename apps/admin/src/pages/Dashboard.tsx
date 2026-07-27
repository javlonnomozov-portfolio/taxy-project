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
interface DriverPos {
  driverId: string;
  lat: number;
  lng: number;
  status: string;
  category: string;
  name?: string;
  phone?: string;
  plate?: string;
  car?: string;
  ratingAvg?: number;
}
interface Alert { type: string; orderId?: string; message: string; at: number }
type Toast = { text: string; kind: 'ok' | 'err' } | null;
interface Metrics {
  windowHours: number;
  total: number;
  noDriverRate: number;
  completionRate: number;
  avgAcceptSec: number | null;
  avgFare: number | null;
}

// Xizmat hududi markazi — Bulung'ur (Samarqand viloyati).
const CENTER: [number, number] = [39.7683, 67.2792];

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
  const [selectedId, setSelectedId] = useState<string | null>(null); // tanlangan zakaz
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null); // tanlangan taksi
  const [toast, setToast] = useState<Toast>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  function flash(text: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    try {
      setOrders(await api<Order[]>('GET', '/ops/orders'));
    } catch { /* ignore */ }
  }
  async function loadDrivers() {
    try {
      const list = await api<DriverPos[]>('GET', '/ops/drivers/online');
      // To'liq ma'lumot (ism/mashina) — socket yangilanishlari faqat lat/lng/status beradi.
      setDrivers((prev) => {
        const next: Record<string, DriverPos> = {};
        for (const d of list) next[d.driverId] = { ...prev[d.driverId], ...d };
        return next;
      });
    } catch { /* ignore */ }
  }
  async function loadMetrics() {
    try {
      setMetrics(await api<Metrics>('GET', '/ops/metrics?hours=24'));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    loadDrivers();
    loadMetrics();
    const s = connectOps();
    s.on('order:update', () => load());
    // Jonli yangilanish — mavjud ism/mashina ma'lumotini saqlab, joylashuvni yangilaymiz.
    s.on('driver:update', (d: DriverPos) =>
      setDrivers((prev) => ({ ...prev, [d.driverId]: { ...prev[d.driverId], ...d } })),
    );
    s.on('alert', (a: Omit<Alert, 'at'>) =>
      setAlerts((prev) => [{ ...a, at: Date.now() }, ...prev].slice(0, 50)),
    );
    const iv = setInterval(() => {
      load();
      loadDrivers();
    }, 10000);
    // Metrikalar sekin o'zgaradi — kamroq so'raymiz.
    const mIv = setInterval(loadMetrics, 60000);
    return () => {
      s.close();
      clearInterval(iv);
      clearInterval(mIv);
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
  const selectedDriver = selectedDriverId ? drivers[selectedDriverId] : null;
  const dispatchMode = !!selectedOrder && ASSIGNABLE.includes(selectedOrder.status);
  const visibleOrders = selectedOrder ? [selectedOrder] : orders;

  async function sendOffer(driverId: string) {
    if (!selectedOrder) {
      flash('Avval quyidan zakazni tanlang', 'err');
      return;
    }
    try {
      await api('POST', `/ops/orders/${selectedOrder.id}/offer`, { driverId });
      setSelectedId(null);
      setSelectedDriverId(null);
      load();
      flash('So‘rov yuborildi — haydovchi qabul qilishini kuting.');
    } catch (e) {
      flash('Xato: ' + (e as Error).message, 'err');
    }
  }

  async function doClose(o: Order) {
    try {
      await api('POST', `/ops/orders/${o.id}/close`, { reason: 'operator' });
      if (selectedId === o.id) setSelectedId(null);
      setConfirmCloseId(null);
      load();
      flash('Buyurtma yopildi.');
    } catch (e) {
      flash('Xato: ' + (e as Error).message, 'err');
    }
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

      {toast && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderColor: toast.kind === 'ok' ? COLOR.idle : COLOR.noDriver,
            color: toast.kind === 'ok' ? COLOR.idle : COLOR.noDriver,
          }}
        >
          {toast.kind === 'ok' ? '✅ ' : '⚠️ '}
          {toast.text}
        </div>
      )}

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

      {/* Oxirgi 24 soat ko'rsatkichlari — avval bu sonlar faqat loglarda edi. */}
      {metrics && (
        <div className="stat" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="big">{metrics.total}</div>
            <div className="lbl">Zakaz (24 soat)</div>
          </div>
          <div className="card">
            <div
              className="big"
              style={{ color: metrics.noDriverRate > 15 ? 'var(--danger)' : undefined }}
            >
              {metrics.noDriverRate}%
            </div>
            <div className="lbl">Taksi topilmadi</div>
          </div>
          <div className="card">
            <div className="big">{metrics.completionRate}%</div>
            <div className="lbl">Yakunlangan</div>
          </div>
          <div className="card">
            <div className="big">
              {metrics.avgAcceptSec != null ? `${metrics.avgAcceptSec}s` : '—'}
            </div>
            <div className="lbl">O‘rtacha qabul vaqti</div>
          </div>
          <div className="card">
            <div className="big">{metrics.avgFare != null ? money(metrics.avgFare) : '—'}</div>
            <div className="lbl">O‘rtacha safar narxi</div>
          </div>
        </div>
      )}

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
            🚕 <b>Buyurtma tanlandi.</b> Xaritadan yoki o‘ng paneldan bo‘sh taksini tanlab
            <b> so‘rov yuboring</b>.
          </span>
          <button className="danger" onClick={() => { setSelectedId(null); setSelectedDriverId(null); }}>
            Bekor qilish
          </button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 400, position: 'relative' }}>
          <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            <FlyTo pos={selectedPos} />

            {activeDrivers.map((d) => {
              const idle = d.status === 'ONLINE_IDLE';
              const sel = d.driverId === selectedDriverId;
              return (
                <CircleMarker
                  key={d.driverId}
                  center={[d.lat, d.lng]}
                  radius={sel ? 11 : dispatchMode && idle ? 9 : 7}
                  pathOptions={{
                    color: idle ? COLOR.idle : COLOR.onTrip,
                    fillColor: idle ? COLOR.idle : COLOR.onTrip,
                    fillOpacity: 0.9,
                    weight: sel ? 4 : dispatchMode && idle ? 3 : 1,
                  }}
                  eventHandlers={{ click: () => setSelectedDriverId(d.driverId) }}
                />
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
                  eventHandlers={{ click: () => ASSIGNABLE.includes(o.status) && setSelectedId(o.id) }}
                >
                  <Popup>Buyurtma · {o.status}</Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

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

        {/* O'ng panel: tanlangan taksi ma'lumoti yoki ogohlantirishlar */}
        <div className="card">
          {selectedDriver ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>🚖 Taksi</h2>
                <button className="danger" onClick={() => setSelectedDriverId(null)}>✕</button>
              </div>
              <div style={{ marginTop: 12, lineHeight: 1.9 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedDriver.name || 'Haydovchi'}</div>
                <div className="lbl">Holat: {selectedDriver.status === 'ONLINE_IDLE' ? '🟢 Bo‘sh' : '⚪ Safarda'}</div>
                <div>📞 {selectedDriver.phone || '—'}</div>
                <div>🚗 {selectedDriver.car || '—'}</div>
                <div>🔢 Davlat raqami: <b>{selectedDriver.plate || '—'}</b></div>
                <div>⭐ Reyting: {selectedDriver.ratingAvg ?? 0}</div>
                <div className="lbl">Toifa: {selectedDriver.category}</div>
              </div>
              {dispatchMode ? (
                selectedDriver.status === 'ONLINE_IDLE' ? (
                  <button
                    className="primary"
                    style={{ marginTop: 14, width: '100%' }}
                    onClick={() => sendOffer(selectedDriver.driverId)}
                  >
                    📨 Shu taksiga so‘rov yuborish
                  </button>
                ) : (
                  <div className="lbl" style={{ marginTop: 14 }}>Bu taksi safarda — so‘rov yuborib bo‘lmaydi.</div>
                )
              ) : (
                <div className="lbl" style={{ marginTop: 14 }}>
                  So‘rov yuborish uchun avval quyidan zakazni tanlang.
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
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
                    {confirmCloseId === o.id ? (
                      <>
                        <button className="danger" onClick={() => doClose(o)}>Tasdiqlash</button>
                        <button onClick={() => setConfirmCloseId(null)}>Yo‘q</button>
                      </>
                    ) : (
                      <button className="danger" onClick={() => setConfirmCloseId(o.id)}>Yopish</button>
                    )}
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
