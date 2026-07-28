import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { auth } from './api';
import { useI18n } from './i18n';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Drivers } from './pages/Drivers';
import { Settings } from './pages/Settings';
import { Scheduled } from './pages/Scheduled';
import { Customers } from './pages/Customers';
import { Orders } from './pages/Orders';

function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const { t, lang, setLang } = useI18n();
  const role = auth.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Toy TaxY <small>{role}</small>
        </div>
        <nav className="nav">
          <NavLink to="/" end>{t('nav_dashboard')}</NavLink>
          <NavLink to="/orders">{t('nav_orders')}</NavLink>
          <NavLink to="/customers">{t('nav_customers')}</NavLink>
          <NavLink to="/scheduled">{t('nav_scheduled')}</NavLink>
          {isAdmin && <NavLink to="/drivers">{t('nav_drivers')}</NavLink>}
          {isAdmin && <NavLink to="/settings">{t('nav_settings')}</NavLink>}
        </nav>
        <div className="spacer" style={{ flex: 1 }} />
        <button onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')} style={{ marginBottom: 8 }}>
          {t('lang_switch')}
        </button>
        <button
          onClick={() => {
            auth.clear();
            nav('/login');
          }}
        >
          {t('logout')}
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  if (!auth.token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/orders" element={<Protected><Orders /></Protected>} />
      <Route path="/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/scheduled" element={<Protected><Scheduled /></Protected>} />
      <Route path="/drivers" element={<Protected><Drivers /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
