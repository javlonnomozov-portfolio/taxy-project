import { useEffect, useState } from 'react';
import { api } from '../api';

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
    setSaved('Sozlamalar saqlandi');
    setTimeout(() => setSaved(''), 2000);
  }
  async function saveTariff(t: Tariff) {
    await api('PUT', `/ops/tariffs/${t.category}`, {
      baseFare: Number(t.baseFare),
      perKm: Number(t.perKm),
      waitingPerMin: Number(t.waitingPerMin),
      freeWaitMin: Number(t.freeWaitMin),
      nightMultiplier: Number(t.nightMultiplier),
    });
    setSaved(`${t.category} tarifi saqlandi`);
    setTimeout(() => setSaved(''), 2000);
  }

  if (!cfg) return <div className="lbl">Yuklanmoqda…</div>;

  return (
    <>
      <div className="topbar">
        <h1>Sozlamalar</h1>
        {saved && <span className="badge ok">{saved}</span>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Surge va bekor qilish</h2>
        <div className="flex" style={{ flexWrap: 'wrap', gap: 16 }}>
          <label className="flex">
            <input
              type="checkbox"
              checked={cfg.surgeActive}
              onChange={(e) => setCfg({ ...cfg, surgeActive: e.target.checked })}
            />
            Surge faol
          </label>
          <label className="flex">
            Koeffitsient:
            <input
              type="number"
              step="0.1"
              style={{ width: 80 }}
              value={cfg.surgeMultiplier}
              onChange={(e) => setCfg({ ...cfg, surgeMultiplier: Number(e.target.value) })}
            />
          </label>
          <label className="flex">
            Jarimasiz bekor (sek):
            <input
              type="number"
              style={{ width: 90 }}
              value={cfg.freeCancelSec}
              onChange={(e) => setCfg({ ...cfg, freeCancelSec: Number(e.target.value) })}
            />
          </label>
          <button className="primary" onClick={saveCfg}>Saqlash</button>
        </div>
      </div>

      <div className="card">
        <h2>Tariflar (toifa bo‘yicha)</h2>
        <table>
          <thead>
            <tr>
              <th>Toifa</th><th>Baza</th><th>Km narx</th><th>Kutish/daq</th><th>Bepul kutish</th><th>Tungi ×</th><th></th>
            </tr>
          </thead>
          <tbody>
            {tariffs.map((t, i) => (
              <tr key={t.category}>
                <td>{t.category}</td>
                {(['baseFare', 'perKm', 'waitingPerMin', 'freeWaitMin', 'nightMultiplier'] as const).map((f) => (
                  <td key={f}>
                    <input
                      style={{ width: 80 }}
                      value={t[f]}
                      onChange={(e) => {
                        const next = [...tariffs];
                        next[i] = { ...t, [f]: e.target.value } as Tariff;
                        setTariffs(next);
                      }}
                    />
                  </td>
                ))}
                <td><button className="primary" onClick={() => saveTariff(t)}>Saqlash</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
