import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { S, C } from '../theme';
import { Lang, makeT } from '../i18n';

type Tab = 'balance' | 'trips' | 'stats';

interface BalanceInfo {
  balance: number;
  billingMode: string;
  billingConfig: { percent?: number };
}
interface Txn {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}
interface Trip {
  id: string;
  status: string;
  vehicleCategory: string;
  finalPrice: number | null;
  distanceM: number | null;
  commissionAmount: number | null;
  completedAt: string | null;
  createdAt: string;
}
interface Stats {
  ratingAvg: number;
  acceptanceRate: number;
  cancelRate: number;
  completionRate: number;
  totalTrips: number;
  earnedTotal: number;
}

const som = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('ru-RU') + ' ';

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export function CabinetScreen({
  lang,
  token,
  onClose,
}: {
  lang: Lang;
  token: string;
  onClose: () => void;
}) {
  const t = makeT(lang);
  const [tab, setTab] = useState<Tab>('balance');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, tx, tr, st] = await Promise.all([
        api<BalanceInfo>('GET', '/drivers/me/balance', undefined, token),
        api<Txn[]>('GET', '/drivers/me/transactions', undefined, token),
        api<Trip[]>('GET', '/drivers/me/trips', undefined, token),
        api<Stats>('GET', '/drivers/me/stats', undefined, token),
      ]);
      setBalance(b);
      setTxns(tx);
      setTrips(tr);
      setStats(st);
    } catch (e) {
      Alert.alert(t('error'), (e as Error).message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <TouchableOpacity
      style={[
        S.btn,
        { flex: 1, paddingVertical: 10, backgroundColor: tab === id ? C.accent : C.panel2 },
      ]}
      onPress={() => setTab(id)}
    >
      <Text style={{ color: tab === id ? '#fff' : C.text, fontWeight: '700', textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Row = ({ left, right, sub }: { left: string; right: string; sub?: string }) => (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, flex: 1 }}>{left}</Text>
        <Text style={{ color: C.text, fontWeight: '700' }}>{right}</Text>
      </View>
      {sub ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );

  return (
    <View style={S.screen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[S.title, { flex: 1 }]}>{t('cabinet')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '700' }}>{t('close')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TabBtn id="balance" label={t('tab_balance')} />
        <TabBtn id="trips" label={t('tab_trips')} />
        <TabBtn id="stats" label={t('tab_stats')} />
      </View>

      {loading ? (
        <View style={[S.center, { flex: 1 }]}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.accent} />}
        >
          {tab === 'balance' && balance && (
            <>
              <View style={[S.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: C.muted }}>{t('balance')}</Text>
                <Text
                  style={{
                    // Manfiy balans — haydovchi ofisda to'ldirishi kerak.
                    color: balance.balance < 0 ? C.danger : C.ok,
                    fontSize: 34,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  {som(balance.balance)}
                  {t('som')}
                </Text>
                <Text style={{ color: C.muted, marginTop: 6 }}>
                  {t('billing_mode')}: {balance.billingMode}
                  {balance.billingConfig?.percent ? ` (${balance.billingConfig.percent}%)` : ''}
                </Text>
                {balance.balance < 0 && (
                  <Text style={{ color: C.danger, marginTop: 10, textAlign: 'center' }}>
                    {t('balance_negative')}
                  </Text>
                )}
              </View>

              <Text style={[S.subtitle, { marginTop: 8 }]}>{t('transactions')}</Text>
              {txns.length === 0 && <Text style={{ color: C.muted }}>{t('no_transactions')}</Text>}
              {txns.map((x) => (
                <Row
                  key={x.id}
                  left={t('txn_' + x.type) || x.type}
                  right={`${x.amount > 0 ? '+' : ''}${som(x.amount)}`}
                  sub={`${shortDate(x.createdAt)} · ${t('balance')}: ${som(x.balanceAfter)}`}
                />
              ))}
            </>
          )}

          {tab === 'trips' && (
            <>
              {trips.length === 0 && <Text style={{ color: C.muted }}>{t('no_trips')}</Text>}
              {trips.map((tr) => (
                <Row
                  key={tr.id}
                  left={`${t('status_' + tr.status) || tr.status}`}
                  right={som(tr.finalPrice) + ' ' + t('som')}
                  sub={
                    `${shortDate(tr.completedAt ?? tr.createdAt)}` +
                    (tr.distanceM != null ? ` · ${(tr.distanceM / 1000).toFixed(1)} km` : '') +
                    (tr.commissionAmount ? ` · ${t('commission')}: ${som(tr.commissionAmount)}` : '')
                  }
                />
              ))}
            </>
          )}

          {tab === 'stats' && stats && (
            <>
              <View style={[S.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: C.muted }}>{t('rating')}</Text>
                <Text style={{ color: C.accent, fontSize: 40, fontWeight: '800' }}>
                  {stats.ratingAvg ? stats.ratingAvg.toFixed(2) : '—'}
                </Text>
              </View>
              <Row left={t('total_trips')} right={String(stats.totalTrips)} />
              <Row left={t('earned_total')} right={som(stats.earnedTotal) + ' ' + t('som')} />
              <Row left={t('acceptance_rate')} right={`${Number(stats.acceptanceRate).toFixed(0)}%`} />
              <Row left={t('completion_rate')} right={`${Number(stats.completionRate).toFixed(0)}%`} />
              <Row left={t('cancel_rate')} right={`${Number(stats.cancelRate).toFixed(0)}%`} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
