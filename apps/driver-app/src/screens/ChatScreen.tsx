import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Socket } from 'socket.io-client';
import { api } from '../api';
import { dismissChatNotifications } from '../push';
import { API_URL } from '../config';
import { makeT, Lang } from '../i18n';
import { C, F, R, S, SP } from '../theme';

interface Msg {
  id: string;
  sender: 'driver' | 'ops';
  kind: 'text' | 'voice' | 'image';
  body: string | null;
  mediaId: string | null;
  durationSec: number | null;
  authorLogin: string | null;
  createdAt: string;
}

/** Ilova tomonidagi chegara; server 90 s gacha qabul qiladi (zaxira). */
const MAX_VOICE_SEC = 60;

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Multipart yuklash. `api()` JSON sarlavhasini qo'yadi, shuning uchun alohida.
 * `Content-Type` ATAYLAB berilmaydi — RN chegarani (boundary) o'zi qo'shadi.
 */
async function upload(
  token: string,
  file: { uri: string; name: string; type: string },
  kind: 'voice' | 'image',
  durationSec?: number,
): Promise<Msg> {
  const form = new FormData();
  // RN FormData fayl uchun { uri, name, type } obyektini qabul qiladi.
  form.append('file', file as unknown as Blob);
  form.append('kind', kind);
  if (durationSec) form.append('durationSec', String(durationSec));
  const res = await fetch(`${API_URL}/chat/media`, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* matn bo'lib qoladi */
    }
    throw new Error(msg);
  }
  return JSON.parse(text) as Msg;
}

/** Ovozli xabar pleyeri — fayl Bearer bilan oqimlanadi (havolaga token yozilmaydi). */
function VoiceBubble({ msg, token, tint }: { msg: Msg; token: string; tint: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => void sound?.unloadAsync(), [sound]);

  async function toggle() {
    try {
      if (sound) {
        const st = await sound.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          await sound.replayAsync();
          setPlaying(true);
        }
        return;
      }
      setLoading(true);
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: `${API_URL}/chat/media/${msg.mediaId}`, headers: { Authorization: 'Bearer ' + token } },
        { shouldPlay: true },
      );
      s.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) setPlaying(false);
      });
      setSound(s);
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity onPress={toggle} style={[S.row, { gap: SP.sm, minWidth: 140 }]}>
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <MaterialIcons name={playing ? 'pause-circle-filled' : 'play-circle-filled'} size={34} color={tint} />
      )}
      <MaterialIcons name="graphic-eq" size={22} color={tint} />
      <Text style={{ color: C.text, fontSize: F.label }}>{msg.durationSec ? `${msg.durationSec} s` : ''}</Text>
    </TouchableOpacity>
  );
}

/**
 * Admin bilan chat — matn, rasm (kamera yoki galereya) va ovozli xabar.
 *
 * Yangi xabarlar HomeScreen'dagi mavjud soket orqali keladi (`chat:message`);
 * soket uzilgan bo'lsa ham ekran ochilganda tarix serverdan tortiladi.
 */
export function ChatScreen({
  lang,
  token,
  socket,
  onClose,
}: {
  lang: Lang;
  token: string;
  socket: Socket | null;
  onClose: () => void;
}) {
  const t = makeT(lang);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recSec, setRecSec] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const add = (m: Msg) => setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));

  useEffect(() => {
    let alive = true;
    api<Msg[]>('GET', '/chat/messages', undefined, token)
      .then((list) => alive && setMsgs(list))
      .catch(() => {});
    void api('POST', '/chat/read', undefined, token).catch(() => {});
    // Xabarlar ko'rildi — shtorkadagi chat bildirishnomalari endi keraksiz.
    void dismissChatNotifications();

    const onMessage = (m: Msg) => {
      add(m);
      if (m.sender === 'ops') {
        void api('POST', '/chat/read', undefined, token).catch(() => {});
        void dismissChatNotifications();
      }
    };
    socket?.on('chat:message', onMessage);
    return () => {
      alive = false;
      socket?.off('chat:message', onMessage);
    };
  }, [socket, token]);

  // Ekrandan chiqib ketilsa yozuv yarim yo'lda qolmasin.
  useEffect(
    () => () => {
      if (recTimer.current) clearInterval(recTimer.current);
    },
    [],
  );

  const fail = (e: unknown) => Alert.alert(t('chat_error'), (e as Error).message || t('err_network'));

  async function sendText() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      add(await api<Msg>('POST', '/chat/messages', { body }, token));
      setText('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('chat_error'), t('chat_perm_photo'));

    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (picked.canceled || !picked.assets?.[0]) return;

    setBusy(true);
    try {
      // Server 2 MB gacha qabul qiladi; telefon rasmi 4-8 MB bo'ladi. 1280 px
      // va 0.6 sifat bilan ~200-400 KB — hujjat/g'ildirak rasmi uchun yetarli.
      const small = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      add(await upload(token, { uri: small.uri, name: 'rasm.jpg', type: 'image/jpeg' }, 'image'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (recording || busy) return;
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('chat_error'), t('chat_perm_mic'));
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      // Android'da HIGH_QUALITY — MPEG-4/AAC (.m4a); server uni "ftyp" dan taniydi.
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setRecSec(0);
      recTimer.current = setInterval(() => {
        setRecSec((s) => {
          if (s + 1 >= MAX_VOICE_SEC) void stopRecording(rec, true);
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      fail(e);
    }
  }

  async function stopRecording(rec = recording, send = true) {
    if (!rec) return;
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = null;
    setRecording(null);
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const status = await rec.getStatusAsync();
      const uri = rec.getURI();
      const sec = Math.max(1, Math.round((status.durationMillis ?? recSec * 1000) / 1000));
      // Bir soniyadan qisqa — tasodifiy bosilish, yubormaymiz.
      if (!send || !uri || (status.durationMillis ?? 0) < 800) return;
      setBusy(true);
      add(await upload(token, { uri, name: 'ovoz.m4a', type: 'audio/mp4' }, 'voice', Math.min(sec, MAX_VOICE_SEC)));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const renderItem = ({ item: m }: { item: Msg }) => {
    const mine = m.sender === 'driver';
    const tint = mine ? C.onOk : C.accent;
    return (
      <View
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          backgroundColor: mine ? C.ok : C.panel,
          borderColor: C.border,
          borderWidth: mine ? 0 : 1,
          borderRadius: R.lg,
          paddingHorizontal: SP.md,
          paddingVertical: SP.sm,
          marginBottom: SP.sm,
        }}
      >
        {!mine ? (
          <Text style={{ color: C.accent, fontSize: F.tiny, fontWeight: '700', marginBottom: 2 }}>
            {m.authorLogin || t('chat_admin')}
          </Text>
        ) : null}
        {m.kind === 'text' ? (
          <Text style={{ color: mine ? C.onOk : C.text, fontSize: F.body }}>{m.body}</Text>
        ) : m.kind === 'image' ? (
          <Pressable onPress={() => setPreview(m.mediaId)}>
            <Image
              source={{ uri: `${API_URL}/chat/media/${m.mediaId}`, headers: { Authorization: 'Bearer ' + token } }}
              style={{ width: 200, height: 200, borderRadius: R.md, backgroundColor: C.panel2 }}
              resizeMode="cover"
            />
          </Pressable>
        ) : (
          <VoiceBubble msg={m} token={token} tint={tint} />
        )}
        <Text style={{ color: mine ? C.onOk : C.muted, fontSize: F.tiny, alignSelf: 'flex-end', marginTop: 2 }}>
          {clock(m.createdAt)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <MaterialIcons name="support-agent" size={22} color={C.accent} />
          <Text style={S.brand}>{t('chat_title')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={{ color: C.accent, fontSize: 15, fontWeight: '700' }}>{t('close')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SP.lg, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xxl }}>
            <MaterialIcons name="chat-bubble-outline" size={40} color={C.muted} />
            <Text style={{ color: C.muted, fontSize: F.body, textAlign: 'center', marginTop: SP.sm }}>
              {t('chat_empty')}
            </Text>
          </View>
        }
      />

      {recording ? (
        // Yozish paytida butun pastki panel bitta holatga aylanadi — haydovchi
        // nima bo'layotganini aniq ko'rsin va bir bosishda yuborsin/bekor qilsin.
        <View style={[S.row, { padding: SP.md, gap: SP.md, backgroundColor: C.dangerSoft }]}>
          <MaterialIcons name="fiber-manual-record" size={18} color={C.danger} />
          <Text style={{ flex: 1, color: C.text, fontSize: F.body, fontWeight: '700' }}>
            {t('chat_recording')} {recSec}/{MAX_VOICE_SEC} s
          </Text>
          <TouchableOpacity onPress={() => void stopRecording(recording, false)} hitSlop={10}>
            <MaterialIcons name="delete-outline" size={28} color={C.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void stopRecording(recording, true)} hitSlop={10}>
            <MaterialIcons name="send" size={28} color={C.ok} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[S.row, { padding: SP.sm, gap: SP.xs, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.panel }]}>
          <TouchableOpacity onPress={() => void sendPhoto(true)} disabled={busy} hitSlop={6} style={{ padding: SP.xs }}>
            <MaterialIcons name="photo-camera" size={26} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void sendPhoto(false)} disabled={busy} hitSlop={6} style={{ padding: SP.xs }}>
            <MaterialIcons name="image" size={26} color={C.muted} />
          </TouchableOpacity>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: C.panel2,
              borderRadius: R.pill,
              paddingHorizontal: SP.lg,
              paddingVertical: SP.sm,
              fontSize: F.body,
              color: C.text,
              maxHeight: 110,
            }}
            placeholder={t('chat_placeholder')}
            placeholderTextColor={C.muted}
            value={text}
            onChangeText={setText}
            maxLength={2000}
            multiline
          />
          {busy ? (
            <ActivityIndicator color={C.accent} style={{ padding: SP.xs }} />
          ) : text.trim() ? (
            <TouchableOpacity onPress={() => void sendText()} hitSlop={6} style={{ padding: SP.xs }}>
              <MaterialIcons name="send" size={28} color={C.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => void startRecording()} hitSlop={6} style={{ padding: SP.xs }}>
              <MaterialIcons name="mic" size={28} color={C.accent} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setPreview(null)}
        >
          {preview ? (
            <Image
              source={{ uri: `${API_URL}/chat/media/${preview}`, headers: { Authorization: 'Bearer ' + token } }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
