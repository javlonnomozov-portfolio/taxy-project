import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api';
import { useI18n } from '../i18n';
import { IconTaxi, IconWarn } from '../icons';

export function Login() {
  const { t, lang, setLang } = useI18n();
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const res = await api<{ token: string; role: string }>('POST', '/auth/admin/login', {
        login,
        password,
      });
      auth.set(res.token, res.role);
      nav('/');
    } catch (e) {
      // API endi tushunarli xabar qaytaradi (masalan 429 — juda ko'p urinish),
      // shuning uchun uni ko'rsatamiz; bo'lmasa umumiy matn.
      setErr((e as Error).message || t('login_err'));
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <IconTaxi size={22} />
          <span>Toy TaxY</span>
        </div>
        {/* Xato POPUP emas — kartada qoladi (masalan 429 "juda ko'p urinish"). */}
        {err && (
          <div className="err">
            <IconWarn size={15} />
            <span>{err}</span>
          </div>
        )}
        <input placeholder={t('login')} value={login} onChange={(e) => setLogin(e.target.value)} />
        <input
          placeholder={t('password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary" type="submit">
          {t('sign_in')}
        </button>
        <button
          type="button"
          style={{ marginTop: 8 }}
          onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
        >
          {t('lang_switch')}
        </button>
      </form>
    </div>
  );
}
