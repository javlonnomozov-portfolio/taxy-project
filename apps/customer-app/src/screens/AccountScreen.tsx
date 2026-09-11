import { useState } from 'react';
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HistoryScreen } from './HistoryScreen';
import { ProfileScreen } from './ProfileScreen';
import { C, F, L, SP } from '../theme';
import { Lang, makeT } from '../i18n';

export type AccountTab = 'history' | 'profile';

/** Android'da `SafeAreaView` hech narsa qilmaydi (faqat iOS) — qo'lda beriladi. */
const STATUS_PAD = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 44;

/**
 * Kabinet — maketdagi "Buyurtmalar" va "Profil" ekranlari.
 *
 * Ikkalasi ham BITTA sarlavha ostida turadi (maketda ham shunday): chapda
 * xaritaga qaytaruvchi tugma, o'ngda ikki bo'lakli tanlagich. Shu sabab
 * pastki tab paneli olib tashlandi — maketda u umuman yo'q.
 *
 * Tanlangan bo'lak maketda MATN KENGLIGIDA (teng emas), shuning uchun
 * `flex: 1` emas, `space-between` ishlatiladi.
 */
export function AccountScreen({
  lang,
  token,
  initial,
  onClose,
  onLangChange,
  onLogout,
}: {
  lang: Lang;
  token: string;
  initial: AccountTab;
  onClose: () => void;
  onLangChange: (l: Lang) => void;
  onLogout: () => void;
}) {
  const t = makeT(lang);
  const [tab, setTab] = useState<AccountTab>(initial);

  const tabs: { key: AccountTab; label: string }[] = [
    { key: 'history', label: t('tab_history') },
    { key: 'profile', label: t('tab_profile') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.screen, paddingTop: STATUS_PAD }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingHorizontal: SP.lg,
          paddingTop: SP.md,
          paddingBottom: SP.md,
        }}
      >
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('to_map')}
          style={{
            width: L.navBtn.size,
            height: L.navBtn.size,
            borderRadius: L.navBtn.radius,
            backgroundColor: C.cardBg,
            borderColor: C.text,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="map-marker" size={30} color={C.text} />
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: L.headerPill.height,
            borderRadius: L.headerPill.radius,
            backgroundColor: C.bg,
            borderColor: C.hairline,
            borderWidth: 1,
            padding: 4,
          }}
        >
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <TouchableOpacity
                key={tb.key}
                onPress={() => setTab(tb.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  height: '100%',
                  paddingHorizontal: SP.lg,
                  borderRadius: L.headerPill.radius,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? C.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: active ? C.onPrimary : C.text,
                    fontSize: F.tab,
                  }}
                >
                  {tb.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {tab === 'history' ? (
        <HistoryScreen lang={lang} token={token} />
      ) : (
        <ProfileScreen lang={lang} token={token} onLangChange={onLangChange} onLogout={onLogout} />
      )}
    </View>
  );
}
