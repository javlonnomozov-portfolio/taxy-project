import { useEffect, useState } from 'react';
import { api } from '../api';
import { Page } from '../ui';
import { useI18n } from '../i18n';

interface Config {
  surgeMultiplier: number;
  surgeActive: boolean;
  freeCancelSec: number;
  perOrderFee: number;
}
/** Namuna hisobdagi safar — operator tarifni "his qilishi" uchun. */
const SAMPLE_KM = 5;
const SAMPLE_WAIT_MIN = 5;

/**
 * Tarif jadvalining ustunlari — sarlavha, izoh va kiritish turi bir joyda.
 *
 * Avval ustunlar ikki joyda (sarlavha qatori va `map`) qo'lda yozilgan edi;
 * yangi maydon qo'shilganda ular bir-biriga mos kelmay qolardi.
 */
/** Bitta ustunning ta'rifi. `as const` emas — aks holda ixtiyoriy
 *  maydonlar (`step`, `min`, `max`) birlashma tipida yo'qoladi. */
interface TariffCol {
  field: 'baseFare' | 'perKm' | 'waitingPerMin' | 'freeWaitMin' | 'nightFrom' | 'nightTo' | 'nightMultiplier' | 'surgeMultiplier';
  head: string;
  hint: string;
  type: 'number' | 'time';
  step?: number;
  min?: number;
  max?: number;
}

const COLS: TariffCol[] = [
  { field: 'baseFare', head: 'th_base', hint: 'hint_base', type: 'number', step: 100, min: 0 },
  { field: 'perKm', head: 'th_per_km', hint: 'hint_per_km', type: 'number', step: 100, min: 0 },
  { field: 'waitingPerMin', head: 'th_wait_min', hint: 'hint_wait_min', type: 'number', step: 100, min: 0 },
  { field: 'freeWaitMin', head: 'th_free_wait', hint: 'hint_free_wait', type: 'number', step: 1, min: 0, max: 120 },
  { field: 'nightFrom', head: 'th_night_from', hint: 'hint_night_from', type: 'time' },
  { field: 'nightTo', head: 'th_night_to', hint: 'hint_night_to', type: 'time' },
  { field: 'nightMultiplier', head: 'th_night', hint: 'hint_night', type: 'number', step: 0.1, min: 1, max: 5 },
  { field: 'surgeMultiplier', head: 'th_surge', hint: 'hint_surge', type: 'number', step: 0.1, min: 1, max: 5 },
];

interface Tariff {
  category: string;
  baseFare: number;
  perKm: number;
  waitingPerMin: number;
  freeWaitMin: number;
  // Postgres `time` ustuni matn sifatida keladi: "22:00:00".
  nightFrom: string;
  nightTo: string;
  nightMultiplier: number;
  surgeMultiplier: number;
}

export function Settings() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [saved, setSaved] = useState('');

  async function load() {
    setCfg(await api<Config>('GET', '/ops/settings'));
    setTariffs(await api<Tariff[]>('GET', '/ops/tariffs'));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function saveCfg() {
    if (!cfg) return;
    await api('PUT', '/ops/settings', cfg);
    setSaved(t('settings_saved'));
    setTimeout(() => setSaved(''), 2000);
  }
  async function saveTariff(tf: Tariff) {
    // Server endi tekshiradi (manfiy narx, 40 barobar surge va h.k. rad
    // etiladi). Xatoni YUTMAYMIZ — aks holda operator "saqlandi" deb o'ylab,
    // eski narx bilan ishlab yuraverardi.
    try {
      await api('PUT', `/ops/tariffs/${tf.category}`, {
        baseFare: Number(tf.baseFare),
        perKm: Number(tf.perKm),
        waitingPerMin: Number(tf.waitingPerMin),
        freeWaitMin: Number(tf.freeWaitMin),
        nightFrom: String(tf.nightFrom).slice(0, 5),
        nightTo: String(tf.nightTo).slice(0, 5),
        nightMultiplier: Number(tf.nightMultiplier),
        surgeMultiplier: Number(tf.surgeMultiplier),
      });
      setSaved(`${tf.category} ${t('tariff_saved')}`);
    } catch (e) {
      setSaved(`${t('tariff_invalid')}: ${(e as Error).message}`);
    }
    setTimeout(() => setSaved(''), 4000);
  }

  /**
   * Namuna hisob — maydonlarni tushuntirishning eng qisqa yo'li.
   *
   * Operator "Kutish/daq" nimaligini o'qib emas, SONNI ko'rib tushunadi:
   * qiymatni o'zgartirsa, pastdagi summa darhol o'zgaradi.
   */
  function sampleTotal(tf: Tariff): number {
    const base = Number(tf.baseFare) || 0;
    const dist = (Number(tf.perKm) || 0) * SAMPLE_KM;
    const billableWait = Math.max(0, SAMPLE_WAIT_MIN - (Number(tf.freeWaitMin) || 0));
    const wait = billableWait * (Number(tf.waitingPerMin) || 0);
    return Math.round(base + dist + wait);
  }

  if (!cfg) return <div className="lbl">{t('loading')}</div>;

  return (
    <Page title={t('settings_title')} actions={saved ? <span className="badge ok">{saved}</span> : null}>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{t('surge_section')}</h2>
        <div className="flex" style={{ flexWrap: 'wrap', gap: 16 }}>
          <label className="flex">
            <input
              type="checkbox"
              checked={cfg.surgeActive}
              onChange={(e) => setCfg({ ...cfg, surgeActive: e.target.checked })}
            />
            {t('surge_active')}
          </label>
          <label className="flex">
            {t('surge_coef')}
            <input
              type="number"
              step="0.1"
              min={1}
              max={5}
              style={{ width: 80 }}
              value={cfg.surgeMultiplier}
              onChange={(e) => setCfg({ ...cfg, surgeMultiplier: Number(e.target.value) })}
            />
          </label>
          <label className="flex">
            {t('free_cancel')}
            <input
              type="number"
              style={{ width: 90 }}
              value={cfg.freeCancelSec}
              onChange={(e) => setCfg({ ...cfg, freeCancelSec: Number(e.target.value) })}
            />
          </label>
          <button className="primary" onClick={saveCfg}>{t('save')}</button>
        </div>
        {/* Ikki izoh SHART: "Surge faol" va "Koeffitsient" bir-biriga o'xshab
            ko'rinadi, lekin biri BOSH KALIT, ikkinchisi esa endi amaldagi
            narxga umuman ta'sir qilmaydi (u tarif jadvaliga ko'chdi). */}
        <div className="lbl" style={{ marginTop: 8 }}>{t('surge_master_hint')}</div>
        <div className="lbl" style={{ marginTop: 4 }}>{t('surge_default_hint')}</div>
      </div>

      {/* `per_order` billing rejimidagi haydovchidan har yakunlangan zakaz uchun
          olinadigan summa. Haydovchi darajasida ustidan yozish mumkin
          (Haydovchilar → Billing → config.perOrder). */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{t('per_order_section')}</h2>
        <div className="flex" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <label className="flex">
            {t('per_order_fee')}
            <input
              type="number"
              min={0}
              step={100}
              style={{ width: 120 }}
              value={cfg.perOrderFee ?? 0}
              onChange={(e) => setCfg({ ...cfg, perOrderFee: Number(e.target.value) })}
            />
          </label>
          <button className="primary" onClick={saveCfg}>{t('save')}</button>
        </div>
        <div className="lbl" style={{ marginTop: 8 }}>{t('per_order_hint')}</div>
      </div>

      <div className="card">
        <h2>{t('tariffs_section')}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('th_category')}</th>
                {/* Har sarlavha ostida bir qatorli izoh — operator maydon
                    nimaligini taxmin qilmasin. Izohsiz "Kutish/daq" va
                    "Bepul kutish" bir-biriga o'xshab ketardi. */}
                {COLS.map((c) => (
                  <th key={c.field}>
                    <div>{t(c.head)}</div>
                    <div className="lbl" style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>
                      {t(c.hint)}
                    </div>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((tf, i) => (
                <tr key={tf.category}>
                  <td>{tf.category}</td>
                  {COLS.map((c) => (
                    <td key={c.field}>
                      <input
                        type={c.type}
                        step={c.step}
                        min={c.min}
                        max={c.max}
                        style={{ width: c.type === 'time' ? 96 : 80 }}
                        value={
                          c.type === 'time'
                            ? String(tf[c.field] ?? '').slice(0, 5)
                            : String(tf[c.field] ?? '')
                        }
                        onChange={(e) => {
                          const next = [...tariffs];
                          next[i] = { ...tf, [c.field]: e.target.value } as Tariff;
                          setTariffs(next);
                        }}
                      />
                    </td>
                  ))}
                  <td><button className="primary" onClick={() => saveTariff(tf)}>{t('save')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Jonli namuna: qiymat o'zgarganda summa darhol qayta hisoblanadi. */}
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 4px' }}>{t('example_title')}</h3>
          <div className="lbl">
            {t('example_body').replace('{km}', String(SAMPLE_KM)).replace('{wait}', String(SAMPLE_WAIT_MIN))}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {tariffs.map((tf) => (
              <li key={tf.category}>
                <b>{tf.category}</b>: {sampleTotal(tf).toLocaleString('ru-RU')} so‘m
              </li>
            ))}
          </ul>
          <div className="lbl" style={{ marginTop: 6 }}>{t('example_note')}</div>
        </div>
      </div>
    </Page>
  );
}
