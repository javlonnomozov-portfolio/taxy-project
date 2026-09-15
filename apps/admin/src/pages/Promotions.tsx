import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Modal } from '../Modal';
import { Page, money } from '../ui';

interface Group {
  id: string;
  name: string;
  memberCount: number;
}

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
}

type PromoState = 'live' | 'scheduled' | 'ended' | 'off';

interface Promo {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  groupId: string | null;
  groupName: string | null;
  commissionDiscountPercent: number;
  bonusPerOrder: number;
  state: PromoState;
}

interface Form {
  id?: string;
  name: string;
  groupId: string;
  discount: string;
  bonus: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
}

const EMPTY: Form = { name: '', groupId: '', discount: '100', bonus: '300', active: true, startsAt: '', endsAt: '' };

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO -> `<input type="datetime-local">` qiymati (brauzer vaqti, ya'ni Toshkent). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const STATE_CLASS: Record<PromoState, string> = { live: 'ok', scheduled: 'warn', ended: 'muted', off: 'muted' };

/**
 * Aksiyalar va haydovchi guruhlari.
 *
 * Aksiya = to'lovdan chegirma (%) va/yoki har yakunlangan zakazga bonus (so'm),
 * barcha haydovchilarga yoki bitta guruhga, qo'lda yoqiladi va ixtiyoriy sana
 * oralig'ida O'ZI ishlab/to'xtaydi. Bir nechtasi to'g'ri kelsa qo'shilmaydi:
 * eng katta chegirma va eng katta bonus olinadi (server qoidasi).
 */
export function Promotions() {
  const { t } = useI18n();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [membersOf, setMembersOf] = useState<Group | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([api<Promo[]>('GET', '/ops/promotions'), api<Group[]>('GET', '/ops/driver-groups')]);
      setPromos(p);
      setGroups(g);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4000);
  };

  async function savePromo() {
    if (!form) return;
    setFormErr('');
    const body = {
      name: form.name.trim(),
      groupId: form.groupId || null,
      commissionDiscountPercent: Number(form.discount) || 0,
      bonusPerOrder: Number(form.bonus) || 0,
      active: form.active,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
    };
    try {
      if (form.id) await api('PUT', `/ops/promotions/${form.id}`, body);
      else await api('POST', '/ops/promotions', body);
      setForm(null);
      flash(true, t('dd_saved'));
      void load();
    } catch (e) {
      setFormErr((e as Error).message);
    }
  }

  async function toggle(p: Promo) {
    try {
      await api('PUT', `/ops/promotions/${p.id}`, { active: !p.active });
      void load();
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  async function removePromo(p: Promo) {
    if (!confirm(t('promo_delete_confirm'))) return;
    try {
      await api('DELETE', `/ops/promotions/${p.id}`);
      void load();
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  async function createGroup() {
    const name = newGroup.trim();
    if (!name) return;
    try {
      await api('POST', '/ops/driver-groups', { name });
      setNewGroup('');
      void load();
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  async function removeGroup(g: Group) {
    if (!confirm(t('group_delete_confirm'))) return;
    try {
      await api('DELETE', `/ops/driver-groups/${g.id}`);
      void load();
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  const edit = (p: Promo) =>
    setForm({
      id: p.id,
      name: p.name,
      groupId: p.groupId ?? '',
      discount: String(p.commissionDiscountPercent),
      bonus: String(Number(p.bonusPerOrder)),
      active: p.active,
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
    });

  return (
    <Page
      title={t('promo_title')}
      actions={
        <button
          className="primary"
          onClick={() => {
            setFormErr('');
            setForm({ ...EMPTY });
          }}
        >
          {t('promo_new')}
        </button>
      }
    >
      {msg ? <div className={`toast ${msg.ok ? '' : 'err'}`}>{msg.text}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{t('promo_title')}</h2>
        <div className="lbl" style={{ marginBottom: 8 }}>{t('promo_rule_hint')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('promo_name')}</th>
                <th>{t('th_target')}</th>
                <th>{t('promo_discount')}</th>
                <th>{t('promo_bonus')}</th>
                <th>{t('th_window')}</th>
                <th>{t('th_state')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td>{p.groupName ?? t('promo_all_drivers')}</td>
                  <td className="num">{p.commissionDiscountPercent}%</td>
                  <td className="num">{Number(p.bonusPerOrder) > 0 ? `+${money(p.bonusPerOrder)}` : '—'}</td>
                  <td className="num">
                    {when(p.startsAt)} → {when(p.endsAt)}
                  </td>
                  <td><span className={`badge ${STATE_CLASS[p.state]}`}>{t('promo_state_' + p.state)}</span></td>
                  <td>
                    <div className="cell-actions">
                      <button className={p.active ? '' : 'ok'} onClick={() => void toggle(p)}>
                        {p.active ? t('promo_turn_off') : t('promo_turn_on')}
                      </button>
                      <button onClick={() => edit(p)}>{t('promo_edit')}</button>
                      <button className="danger" onClick={() => void removePromo(p)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr><td colSpan={7} className="empty">{t('promo_none')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{t('groups_title')}</h2>
        <div className="flex" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder={t('group_new_ph')}
            value={newGroup}
            maxLength={60}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void createGroup()}
          />
          <button className="primary" onClick={() => void createGroup()} disabled={!newGroup.trim()}>
            {t('group_create')}
          </button>
        </div>
        <table>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td><b>{g.name}</b></td>
                <td className="lbl">{t('group_member_count')}: {g.memberCount}</td>
                <td>
                  <div className="cell-actions">
                    <button onClick={() => setMembersOf(g)}>{t('group_members')}</button>
                    <button className="danger" onClick={() => void removeGroup(g)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={3} className="empty">{t('group_none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form ? (
        <Modal
          title={form.id ? t('promo_edit') : t('promo_new')}
          onClose={() => setForm(null)}
          footer={
            <>
              <button onClick={() => setForm(null)}>{t('cancel')}</button>
              <button className="primary" onClick={() => void savePromo()}>{t('save')}</button>
            </>
          }
        >
          <label className="field">
            <span>{t('promo_name')}</span>
            <input value={form.name} maxLength={80} placeholder={t('promo_name_ph')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('th_target')}</span>
            <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">{t('promo_all_drivers')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('promo_discount')}</span>
            <input type="number" min={0} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            <span className="hint">{t('promo_discount_hint')}</span>
          </label>
          <label className="field">
            <span>{t('promo_bonus')}</span>
            <input type="number" min={0} step={100} value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
            <span className="hint">{t('promo_bonus_hint')}</span>
          </label>
          <label className="flex" style={{ gap: 6, margin: '8px 0' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            {t('promo_active')}
          </label>
          <label className="field">
            <span>{t('promo_starts')}</span>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('promo_ends')}</span>
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </label>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Tez tanlov: 1-yanvar 00:00 = 31-dekabr kun oxirigacha (tugash vaqti kirmaydi). */}
            <button
              onClick={() =>
                setForm({ ...form, endsAt: toLocalInput(new Date(new Date().getFullYear() + 1, 0, 1, 0, 0).toISOString()) })
              }
            >
              {t('promo_preset_newyear')}
            </button>
            <button onClick={() => setForm({ ...form, startsAt: '', endsAt: '' })}>{t('promo_preset_manual')}</button>
          </div>
          <div className="lbl" style={{ marginTop: 6 }}>{t('promo_window_hint')}</div>
          {formErr ? <div className="err" style={{ marginTop: 8 }}>{formErr}</div> : null}
        </Modal>
      ) : null}

      {membersOf ? (
        <GroupMembers
          group={membersOf}
          onClose={() => {
            setMembersOf(null);
            void load();
          }}
        />
      ) : null}
    </Page>
  );
}

/** Guruh a'zolari: ro'yxat + haydovchini qidirib qo'shish. */
function GroupMembers({ group, onClose }: { group: Group; onClose: () => void }) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Member[]>([]);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<Member[]>('GET', `/ops/driver-groups/${group.id}/members`).then(setMembers).catch((e) => setErr((e as Error).message));
  }, [group.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setFound([]);
      return;
    }
    const id = setTimeout(() => {
      api<{ items: Member[] }>('GET', `/ops/drivers/search?q=${encodeURIComponent(query)}&limit=8`)
        .then((r) => setFound(r.items))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const name = (m: Member) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.phone;
  const ids = new Set(members.map((m) => m.id));

  async function add(m: Member) {
    try {
      await api('POST', `/ops/driver-groups/${group.id}/members`, { driverId: m.id });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(m: Member) {
    try {
      await api('DELETE', `/ops/driver-groups/${group.id}/members/${m.id}`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Modal title={`${t('group_members')} — ${group.name}`} onClose={onClose}>
      <input
        style={{ width: '100%', marginBottom: 8 }}
        placeholder={t('group_add_ph')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {found.filter((m) => !ids.has(m.id)).map((m) => (
        <div key={m.id} className="flex" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <span>{name(m)} <span className="lbl">{m.phone}</span></span>
          <button className="ok" onClick={() => void add(m)}>{t('group_add')}</button>
        </div>
      ))}
      <h3 style={{ margin: '12px 0 6px' }}>{t('group_member_count')}: {members.length}</h3>
      {members.length === 0 ? <div className="lbl">{t('group_none_members')}</div> : null}
      {members.map((m) => (
        <div key={m.id} className="flex" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <span>{name(m)} <span className="lbl">{m.phone}</span></span>
          <button className="danger" onClick={() => void remove(m)}>{t('group_remove')}</button>
        </div>
      ))}
      {err ? <div className="err" style={{ marginTop: 8 }}>{err}</div> : null}
    </Modal>
  );
}
