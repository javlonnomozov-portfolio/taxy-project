import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Modal } from '../Modal';
import { CategoryLabel, StatusBadge, money, time } from '../ui';
import { DriverWindow } from './DriverWindow';

interface VehicleRow {
  id: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  plate?: string | null;
  seats?: number;
  category?: string;
}

/** Ro'yxatdagi haydovchi qatori (`/ops/drivers/search` javobi). */
export interface DriverRow {
  id: string;
  firstName: string | null;
  lastName?: string | null;
  phone: string;
  vehicles?: VehicleRow[];
}

interface Tx {
  id: string;
  amount: number;
  type?: string;
  note?: string | null;
  createdAt: string;
}

interface Trip {
  id: string;
  status: string;
  category: string;
  finalPrice: number | null;
  distanceM: number | null;
  createdAt: string;
  completedAt: string | null;
}

type Tab = 'info' | 'edit' | 'balance' | 'trips';
const TABS: Tab[] = ['info', 'edit', 'balance', 'trips'];

/**
 * Haydovchilar sahifasida qator bosilganda ochiladigan oyna.
 *
 * "Ma'lumot va chat" — xaritadagi oyna bilan AYNAN bir komponent (`DriverWindow`):
 * holat, reyting, balans, bugungi ish va chat ikki joyda ikki xil bo'lib
 * ketmasin. Balans tarixi va safarlar faqat o'z yorlig'i ochilganda yuklanadi.
 */
export function DriverDetail({
  driver,
  onClose,
  onChanged,
}: {
  driver: DriverRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('info');
  const v = driver.vehicles?.[0];
  const [p, setP] = useState({
    firstName: driver.firstName ?? '',
    lastName: driver.lastName ?? '',
    phone: driver.phone,
  });
  const [veh, setVeh] = useState({
    make: v?.make ?? '',
    model: v?.model ?? '',
    color: v?.color ?? '',
    plate: v?.plate ?? '',
    seats: String(v?.seats ?? 4),
    category: v?.category ?? 'standard',
  });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    if (tab === 'balance' && txs === null) {
      api<Tx[]>('GET', `/ops/drivers/${driver.id}/transactions`).then(setTxs).catch(() => setTxs([]));
    }
    if (tab === 'trips' && trips === null) {
      api<Trip[]>('GET', `/ops/drivers/${driver.id}/trips`).then(setTrips).catch(() => setTrips([]));
    }
  }, [tab, driver.id, txs, trips]);

  const done = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    if (ok) onChanged();
  };

  async function saveProfile() {
    try {
      await api('PUT', `/ops/drivers/${driver.id}/profile`, {
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        phone: p.phone.trim(),
      });
      done(true, t('dd_saved'));
    } catch (e) {
      done(false, (e as Error).message);
    }
  }

  async function saveVehicle() {
    // Toifa dispatch'ni to'g'ridan o'zgartiradi — tasodifan tanlanib qolmasin.
    if (veh.category !== (v?.category ?? 'standard') && !confirm(t('dd_cat_confirm'))) return;
    try {
      await api('PUT', `/ops/drivers/${driver.id}/vehicle`, {
        make: veh.make.trim(),
        model: veh.model.trim(),
        color: veh.color.trim(),
        plate: veh.plate.trim(),
        seats: Number(veh.seats) || 4,
        category: veh.category,
      });
      done(true, t('dd_saved'));
    } catch (e) {
      done(false, (e as Error).message);
    }
  }

  const title = [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.phone;

  return (
    <Modal wide title={title} onClose={onClose}>
      <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map((k) => (
          <button
            key={k}
            className={tab === k ? 'primary' : ''}
            onClick={() => {
              setTab(k);
              setMsg(null);
            }}
          >
            {t('dd_tab_' + k)}
          </button>
        ))}
      </div>

      {msg ? (
        <div className="lbl" style={{ color: msg.ok ? 'var(--ok)' : 'var(--danger)', marginBottom: 8 }}>
          {msg.text}
        </div>
      ) : null}

      {tab === 'info' && <DriverWindow driverId={driver.id} />}

      {tab === 'edit' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div>
            <h3 style={{ marginTop: 0 }}>{t('dd_profile')}</h3>
            <label className="field">
              <span>{t('ph_first')}</span>
              <input value={p.firstName} maxLength={60} onChange={(e) => setP({ ...p, firstName: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('ph_last')}</span>
              <input value={p.lastName} maxLength={60} onChange={(e) => setP({ ...p, lastName: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('th_phone')}</span>
              <input value={p.phone} maxLength={20} onChange={(e) => setP({ ...p, phone: e.target.value })} />
            </label>
            <button className="primary" onClick={() => void saveProfile()}>{t('save')}</button>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>{t('dd_vehicle')}</h3>
            <label className="field">
              <span>{t('dd_category')}</span>
              <select value={veh.category} onChange={(e) => setVeh({ ...veh, category: e.target.value })}>
                <option value="standard">{t('cat_standard')}</option>
                <option value="comfort">{t('cat_comfort')}</option>
                <option value="cargo">{t('cat_cargo')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('ph_make')}</span>
              <input value={veh.make} onChange={(e) => setVeh({ ...veh, make: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('ph_model')}</span>
              <input value={veh.model} onChange={(e) => setVeh({ ...veh, model: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('ph_color')}</span>
              <input value={veh.color} onChange={(e) => setVeh({ ...veh, color: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('ph_plate')}</span>
              <input value={veh.plate} onChange={(e) => setVeh({ ...veh, plate: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('ph_seats')}</span>
              <input
                value={veh.seats}
                onChange={(e) => setVeh({ ...veh, seats: e.target.value.replace(/[^0-9]/g, '').slice(0, 1) })}
              />
            </label>
            <button className="primary" onClick={() => void saveVehicle()} disabled={!v}>{t('save')}</button>
          </div>
        </div>
      )}

      {tab === 'balance' && (
        <div style={{ overflowX: 'auto' }}>
          {txs === null ? (
            <div className="lbl">{t('drv_loading')}</div>
          ) : txs.length === 0 ? (
            <div className="lbl">{t('dd_no_tx')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('th_when')}</th>
                  <th>{t('th_type')}</th>
                  <th>{t('th_amount')}</th>
                  <th>{t('th_note')}</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((x) => (
                  <tr key={x.id}>
                    <td className="num">{time(x.createdAt)}</td>
                    <td>{x.type ?? '—'}</td>
                    <td className={Number(x.amount) < 0 ? 'num neg' : 'num'}>{money(x.amount)}</td>
                    <td>{x.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'trips' && (
        <div style={{ overflowX: 'auto' }}>
          {trips === null ? (
            <div className="lbl">{t('drv_loading')}</div>
          ) : trips.length === 0 ? (
            <div className="lbl">{t('dd_no_trips')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('th_when')}</th>
                  <th>{t('th_status')}</th>
                  <th>{t('th_category')}</th>
                  <th>{t('th_price')}</th>
                  <th>{t('th_distance')}</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((o) => (
                  <tr key={o.id}>
                    <td className="num">{time(o.completedAt ?? o.createdAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><CategoryLabel category={o.category} /></td>
                    <td className="num">{money(o.finalPrice)}</td>
                    <td className="num">{o.distanceM != null ? `${(o.distanceM / 1000).toFixed(1)} km` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}
