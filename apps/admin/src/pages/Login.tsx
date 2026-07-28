import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api';
import { useI18n } from '../i18n';

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
          Toy TaxY <small>{t('brand_sub')}</small>
        </div>
        <input placeholder={t('login')} value={login} onChange={(e) => setLogin(e.target.value)} />
        <input
          placeholder={t('password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="err">{err}</div>}
        <button className="primary" style={{ width: '100%' }} type="submit">
          {t('sign_in')}
        </button>
        <button
          type="button"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
        >
          {t('lang_switch')}
        </button>
      </form>
    </div>
  );
}
