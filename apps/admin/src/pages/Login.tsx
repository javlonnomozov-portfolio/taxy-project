import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api';

export function Login() {
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
    } catch {
      setErr('Login yoki parol noto‘g‘ri');
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          Toy TaxY <small>Operator / Admin panel</small>
        </div>
        <input placeholder="Login" value={login} onChange={(e) => setLogin(e.target.value)} />
        <input
          placeholder="Parol"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="err">{err}</div>}
        <button className="primary" style={{ width: '100%' }} type="submit">
          Kirish
        </button>
      </form>
    </div>
  );
}
