import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

interface Config { surgeMultiplier: number; surgeActive: boolean; freeCancelSec: number }
interface Tariff {
  category: string;
  baseFare: number;
  perKm: number;
  waitingPerMin: number;
  freeWaitMin: number;
  nightMultiplier: number;
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
    await api('PUT', `/ops/tariffs/${tf.category}`, {
      baseFare: Number(tf.baseFare),
      perKm: Number(tf.perKm),
      waitingPerMin: Number(tf.waitingPerMin),
      freeWaitMin: Number(tf.freeWaitMin),
      nightMultiplier: Number(tf.nightMultiplier),
    });
    setSaved(`${tf.category} ${t('tariff_saved')}`);
    setTimeout(() => setSaved(''), 2000);
  }

  if (!cfg) return <div className="lbl">{t('loading')}</div>;

  return (
    <>
      <div className="topbar">
        <h1>{t('settings_title')}</h1>
        {saved && <span className="badge ok">{saved}</span>}
      </div>

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
      </div>

      <div className="card">
        <h2>{t('tariffs_section')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('th_category')}</th><th>{t('th_base')}</th><th>{t('th_per_km')}</th><th>{t('th_wait_min')}</th><th>{t('th_free_wait')}</th><th>{t('th_night')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {tariffs.map((tf, i) => (
              <tr key={tf.category}>
                <td>{tf.category}</td>
                {(['baseFare', 'perKm', 'waitingPerMin', 'freeWaitMin', 'nightMultiplier'] as const).map((f) => (
                  <td key={f}>
                    <input
                      style={{ width: 80 }}
                      value={tf[f]}
                      onChange={(e) => {
                        const next = [...tariffs];
                        next[i] = { ...tf, [f]: e.target.value } as Tariff;
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
    </>
  );
}
