import { ReactNode, useEffect, useRef, useState } from 'react';
import { API_URL, api, auth, errorMessage } from '../api';
import { connectOps } from '../socket';
import { useI18n } from '../i18n';
import { CategoryLabel, money, shortId, time } from '../ui';

interface Summary {
  driverId: string;
  name: string;
  phone: string;
  status: string;
  lastSeenAt: string | null;
  ratingAvg: number;
  cancelRate: number;
  acceptanceRate: number;
  completionRate: number;
  balance: number;
  vehicle: { category: string; car: string; plate: string; seats: number } | null;
  tripsToday: number;
  earnedToday: number;
  activeOrder: { id: string; status: string; category: string } | null;
  unread: number;
}

interface Msg {
  id: string;
  driverId: string;
  sender: 'driver' | 'ops';
  kind: 'text' | 'voice' | 'image';
  body: string | null;
  mediaId: string | null;
  durationSec: number | null;
  authorLogin: string | null;
  createdAt: string;
}

interface Conversation {
  driverId: string;
  name: string;
  lastKind: Msg['kind'];
  lastBody: string | null;
  lastSender: Msg['sender'];
  lastAt: string;
  unread: number;
}

/** Stavka 0..1 yoki 0..100 bo'lib kelishi mumkin — ikkalasini ham foizga keltiramiz. */
const pct = (v: number) => `${Math.round(v <= 1 ? v * 100 : v)}%`;

/**
 * Fayl Bearer token bilan olinadi va blob-havolaga aylantiriladi.
 *
 * NEGA `<img src=API>` EMAS: brauzer `src` so'roviga Authorization sarlavhasini
 * qo'shmaydi, tokenni havolaga yozish esa uni brauzer tarixi va proksi
 * loglariga chiqarib yuboradi.
 */
function MediaView({ msg }: { msg: Msg }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.mediaId) return;
    let alive = true;
    let objectUrl: string | null = null;
    fetch(`${API_URL}/ops/chat/media/${msg.mediaId}`, {
      headers: auth.token ? { authorization: 'Bearer ' + auth.token } : {},
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        objectUrl = URL.createObjectURL(b);
        if (alive) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [msg.mediaId]);

  if (!url) return <span className="lbl">…</span>;
  if (msg.kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block' }} />
      </a>
    );
  }
  return <audio controls src={url} style={{ width: '100%', height: 36 }} />;
}

/**
 * Xaritada haydovchi bosilganda ochiladigan oyna: holat, reyting, mashina,
 * bugungi ish va SHU haydovchi bilan chat. Oflayn haydovchi uchun ham ishlaydi
 * (xabarlar ro'yxatidan ochilganda).
 */
export function DriverWindow({ driverId, actions }: { driverId: string; actions?: ReactNode }) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (m: Msg) => setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));

  useEffect(() => {
    let alive = true;
    setSummary(null);
    setMsgs([]);
    setErr('');
    const loadSummary = () =>
      api<Summary>('GET', `/ops/chat/drivers/${driverId}/summary`)
        .then((s) => alive && setSummary(s))
        .catch((e) => alive && setErr((e as Error).message));
    loadSummary();
    api<Msg[]>('GET', `/ops/chat/drivers/${driverId}/messages`)
      .then((list) => alive && setMsgs(list))
      .catch(() => {});
    // Oyna ochildi — haydovchi xabarlari o'qildi.
    api('POST', `/ops/chat/drivers/${driverId}/read`).catch(() => {});

    const s = connectOps();
    s.on('chat:message', (m: Msg) => {
      if (m.driverId !== driverId) return;
      add(m);
      if (m.sender === 'driver') api('POST', `/ops/chat/drivers/${driverId}/read`).catch(() => {});
    });
    // Holat va bugungi ish sekin o'zgaradi.
    const iv = setInterval(loadSummary, 15000);
    return () => {
      alive = false;
      s.close();
      clearInterval(iv);
    };
  }, [driverId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs.length]);

  async function sendText() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr('');
    try {
      add(await api<Msg>('POST', `/ops/chat/drivers/${driverId}/messages`, { body }));
      setText('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendImage(file: File) {
    setBusy(true);
    setErr('');
    try {
      const f = new FormData();
      f.append('file', file);
      f.append('kind', 'image');
      // `api()` JSON sarlavhasini qo'yadi — multipart uchun to'g'ridan fetch.
      const r = await fetch(`${API_URL}/ops/chat/drivers/${driverId}/media`, {
        method: 'POST',
        headers: auth.token ? { authorization: 'Bearer ' + auth.token } : {},
        body: f,
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(errorMessage(txt, r.status));
      add(JSON.parse(txt) as Msg);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const statusText = (st: string) =>
    st === 'ONLINE_IDLE' ? t('drv_status_idle') : st === 'ON_TRIP' ? t('drv_status_trip') : t('drv_status_offline');

  return (
    <div>
      {summary ? (
        <div style={{ marginTop: 12, lineHeight: 1.8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.name}</div>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge ${summary.status === 'OFFLINE' ? 'muted' : 'ok'}`}>{statusText(summary.status)}</span>
            {summary.vehicle ? <CategoryLabel category={summary.vehicle.category} /> : null}
            <span>⭐ {summary.ratingAvg.toFixed(1)}</span>
          </div>
          <div>📞 {summary.phone || '—'}</div>
          {summary.vehicle ? (
            <div>
              🚗 {summary.vehicle.car || '—'} · <b>{summary.vehicle.plate || '—'}</b> · {summary.vehicle.seats} o‘rin
            </div>
          ) : null}
          <div>
            {t('drv_today')}: <b>{summary.tripsToday}</b> {t('drv_trips')} · <b>{money(summary.earnedToday)}</b>
          </div>
          <div style={{ color: summary.balance < 0 ? '#D92D20' : undefined }}>
            {t('drv_balance')}: <b>{money(summary.balance)}</b>
          </div>
          <div className="lbl">
            {t('drv_rates')}: {pct(summary.acceptanceRate)} / {pct(summary.cancelRate)} / {pct(summary.completionRate)}
          </div>
          {summary.activeOrder ? (
            <div className="lbl">
              {t('drv_active_order')}: <span className="mono">{shortId(summary.activeOrder.id)}</span> · {summary.activeOrder.status}
            </div>
          ) : null}
          {summary.status === 'OFFLINE' && summary.lastSeenAt ? (
            <div className="lbl">{t('drv_last_seen')}: {time(summary.lastSeenAt)}</div>
          ) : null}
        </div>
      ) : (
        <div className="lbl" style={{ marginTop: 12 }}>{err || t('drv_loading')}</div>
      )}

      {actions ? <div style={{ marginTop: 12 }}>{actions}</div> : null}

      <h3 style={{ margin: '16px 0 8px' }}>{t('chat_title')}</h3>
      <div
        ref={listRef}
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
          background: 'var(--panel2)',
          borderRadius: 8,
        }}
      >
        {msgs.length === 0 ? <div className="lbl">{t('chat_empty')}</div> : null}
        {msgs.map((m) => {
          const mine = m.sender === 'ops';
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: mine ? 'var(--ok-soft)' : 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '6px 10px',
              }}
            >
              {m.kind === 'text' ? (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
              ) : (
                <MediaView msg={m} />
              )}
              <div className="lbl" style={{ textAlign: mine ? 'right' : 'left' }}>
                {mine && m.authorLogin ? `${m.authorLogin} · ` : ''}
                {m.kind === 'voice' && m.durationSec ? `${m.durationSec} s · ` : ''}
                {time(m.createdAt)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex" style={{ gap: 6, marginTop: 8 }}>
        <input
          style={{ flex: 1, minWidth: 0 }}
          placeholder={t('chat_placeholder')}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => e.target.files?.[0] && void sendImage(e.target.files[0])}
        />
        <button onClick={() => fileRef.current?.click()} disabled={busy} title={t('chat_photo')}>
          📷
        </button>
        <button className="primary" onClick={() => void sendText()} disabled={busy || !text.trim()}>
          {t('chat_send')}
        </button>
      </div>
      {err && summary ? <div className="lbl" style={{ color: '#D92D20', marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}

/**
 * Haydovchilardan kelgan suhbatlar — xaritada haydovchi tanlanmaganda ko'rinadi.
 * Oflayn haydovchi xaritada yo'q, shuning uchun unga faqat shu ro'yxatdan
 * yetib borish mumkin. Suhbat bo'lmasa hech narsa chizmaydi.
 */
export function ChatInbox({ onOpen }: { onOpen: (driverId: string) => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Conversation[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Conversation[]>('GET', '/ops/chat/conversations')
        .then((list) => alive && setRows(list))
        .catch(() => {});
    load();
    const s = connectOps();
    s.on('chat:message', load);
    s.on('chat:read', load);
    const iv = setInterval(load, 30000);
    return () => {
      alive = false;
      s.close();
      clearInterval(iv);
    };
  }, []);

  if (rows.length === 0) return null;
  const preview = (c: Conversation) =>
    c.lastKind === 'text' ? c.lastBody : c.lastKind === 'voice' ? `🎤 ${t('chat_voice')}` : `📷 ${t('chat_image')}`;

  return (
    <div style={{ marginBottom: 16 }}>
      <h2>{t('chat_inbox')}</h2>
      {rows.slice(0, 8).map((c) => (
        <div
          key={c.driverId}
          onClick={() => onOpen(c.driverId)}
          style={{ cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b>{c.name}</b>
            {c.unread > 0 ? <span className="badge warn">{c.unread}</span> : <span className="lbl">{time(c.lastAt)}</span>}
          </div>
          <div className="lbl" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.lastSender === 'ops' ? '↩ ' : ''}
            {preview(c)}
          </div>
        </div>
      ))}
    </div>
  );
}
