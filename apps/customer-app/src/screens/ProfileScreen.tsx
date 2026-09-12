import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { C, F, L, S, SP, elev } from '../theme';
import { Lang, makeT } from '../i18n';

interface Profile {
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  ratingAvg: number;
  language: string;
}

/** Tahrirlanadigan matn maydonlari — til alohida (u yozilmaydi, almashadi). */
type TextField = 'firstName' | 'lastName' | 'phone';

const EMPTY: Profile = {
  phone: null,
  firstName: null,
  lastName: null,
  ratingAvg: 0,
  language: 'uz',
};

/**
 * Kabinet — maketdagi "Profil" ekrani: ism, familiya, telefon, til.
 *
 * Maketda har maydon yonida qalam belgisi bor, ya'ni ular TAHRIRLANADI —
 * lekin serverda bunday endpoint yo'q edi. Shu sabab `PUT /customer/profile`
 * qo'shildi (ilova va API BIRGA yangilanishi kerak, HANDOFF §2).
 *
 * Maketda "Chiqish" tugmasi CHIZILMAGAN — bu maketning kamchiligi:
 * hisobdan chiqishning boshqa yo'li yo'q. Shuning uchun u qoldirildi.
 */
export function ProfileScreen({
  lang,
  token,
  onLangChange,
  onLogout,
}: {
  lang: Lang;
  token: string;
  onLangChange: (l: Lang) => void;
  onLogout: () => void;
}) {
  const t = makeT(lang);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<TextField | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>('GET', '/customer/profile', undefined, token)
      .then(setProfile)
      .catch(() => setProfile(EMPTY));
  }, [token]);

  async function save(patch: Partial<Record<TextField | 'language', string>>) {
    setSaving(true);
    try {
      // Server yangilangan profilni QAYTARADI — ikkinchi so'rov shart emas va
      // normallashtirilgan telefon darhol ko'rinadi.
      const p = await api<Profile>('PUT', '/customer/profile', patch, token);
      setProfile(p);
      setEditing(null);
    } catch (e) {
      Alert.alert(t('err'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(key: TextField, current: string | null) {
    setDraft(current ?? '');
    setEditing(key);
  }

  function toggleLang() {
    const next: Lang = lang === 'uz' ? 'ru' : 'uz';
    // Til qurilmada DARHOL o'zgaradi — serverga yozish kechiksa ham interfeys
    // kutib turmasin. Server nusxasi bot xabarlari uchun kerak.
    onLangChange(next);
    void save({ language: next });
  }

  function confirmLogout() {
    Alert.alert(t('logout'), t('logout_confirm'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: onLogout },
    ]);
  }

  if (profile === null) {
    return (
      <View style={[S.center, { alignItems: 'center' }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const fields: { key: TextField; label: string; value: string | null; numeric?: boolean }[] = [
    { key: 'firstName', label: t('profile_first'), value: profile.firstName },
    { key: 'lastName', label: t('profile_last'), value: profile.lastName },
    { key: 'phone', label: t('profile_phone'), value: profile.phone, numeric: true },
  ];

  /** Maketdagi maydon qutisi — fon ekran foni bilan BIR XIL, faqat chegara ajratadi. */
  const box = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: L.field.height,
    borderRadius: L.field.radius,
    backgroundColor: C.screen,
    borderWidth: 1,
    paddingLeft: 11,
    paddingRight: SP.md,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar: och yashil doira + to'q sariq halqa (maket: Group 19). */}
        <View style={{ alignItems: 'center', marginTop: SP.sm, marginBottom: SP.xl }}>
          <View
            style={[
              elev.card,
              {
                width: L.avatar,
                height: L.avatar,
                borderRadius: L.avatar / 2,
                borderWidth: 3,
                borderColor: C.avatarRing,
                backgroundColor: C.avatarFill,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <MaterialIcons name="person" size={Math.round(L.avatar * 0.55)} color="#FEFEFE" />
          </View>
          {profile.ratingAvg > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.sm }}>
              <MaterialIcons name="star" size={16} color={C.gold} />
              <Text style={{ color: C.muted }}>{profile.ratingAvg.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        {fields.map((f) => {
          const isEditing = editing === f.key;
          return (
            <View key={f.key} style={{ marginBottom: SP.md }}>
              <Text style={{ color: C.text, fontSize: F.field, marginBottom: 6 }}>{f.label}:</Text>
              <View style={[box, { borderColor: isEditing ? C.primary : C.border }]}>
                {isEditing ? (
                  <TextInput
                    style={{ flex: 1, color: C.text, fontSize: F.field, padding: 0 }}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    keyboardType={f.numeric ? 'phone-pad' : 'default'}
                    placeholder={f.numeric ? t('phone_ph') : ''}
                    placeholderTextColor={C.muted}
                    onSubmitEditing={() => void save({ [f.key]: draft })}
                    returnKeyType="done"
                  />
                ) : (
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: f.value ? C.text : C.muted, fontSize: F.field }}
                  >
                    {f.value || t('not_set')}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() =>
                    isEditing ? void save({ [f.key]: draft }) : beginEdit(f.key, f.value)
                  }
                  disabled={saving}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={isEditing ? t('save') : f.label}
                >
                  {saving && isEditing ? (
                    <ActivityIndicator color={C.primary} size="small" />
                  ) : (
                    <MaterialIcons
                      name={isEditing ? 'check' : 'edit'}
                      size={20}
                      color={isEditing ? C.primary : C.text}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={{ marginBottom: SP.md }}>
          <Text style={{ color: C.text, fontSize: F.field, marginBottom: 6 }}>
            {t('profile_lang')}:
          </Text>
          <TouchableOpacity onPress={toggleLang} style={[box, { borderColor: C.border }]}>
            <Text style={{ flex: 1, color: C.text, fontSize: F.field }}>
              {t(lang === 'uz' ? 'lang_uz' : 'lang_ru')}
            </Text>
            <MaterialIcons name="edit" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Maketda yo'q — lekin hisobdan chiqishning boshqa yo'li yo'q. */}
        <TouchableOpacity
          onPress={confirmLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SP.sm,
            height: L.field.height,
            borderRadius: L.field.radius,
            borderColor: C.danger,
            borderWidth: 1,
            marginTop: SP.lg,
          }}
        >
          <MaterialIcons name="logout" size={20} color={C.danger} />
          <Text style={{ color: C.danger, fontSize: F.label, fontWeight: '700' }}>
            {t('logout')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
