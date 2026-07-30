import { Component, ErrorInfo, ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, F, R, SP } from './theme';

/**
 * Xatoni EKRANDA ko'rsatadi — ilova jimgina yopilib ketmasin.
 *
 * NEGA: haydovchi "Toy TaxY Haydovchi keeps stopping" degan tizim oynasini
 * ko'rardi, sabab esa hech qayerda ko'rinmasdi — telefonga ulanmasdan
 * diagnostika qilish imkonsiz edi. Endi xato matni va stack ekranda qoladi,
 * haydovchi uni skrinshot qilib yuborishi kifoya.
 *
 * Bu sessiyaning eng qimmat saboqi: JIMGINA YUTILGAN XATOLAR eng ko'p vaqt
 * oladi (`connect_error`, CORS 500, baholanmagan ack — hammasi shu sababdan).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null; info: string }> {
  state = { err: null as Error | null, info: '' };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    this.setState({ err, info: info.componentStack ?? '' });
    console.error('[ErrorBoundary]', err?.message, info.componentStack);
  }

  render() {
    const { err, info } = this.state;
    if (!err) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: SP.xl }}>
        <Text style={{ color: C.danger, fontSize: F.h2, fontWeight: '800', marginTop: SP.xxl }}>
          Ilovada xatolik
        </Text>
        <Text style={{ color: C.muted, fontSize: F.label, marginTop: SP.sm }}>
          Bu ekranni skrinshot qilib yuboring — xato sababi shu yerda yozilgan.
        </Text>

        <ScrollView
          style={{
            marginTop: SP.lg,
            backgroundColor: C.panel,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: R.md,
            padding: SP.md,
            maxHeight: '60%',
          }}
        >
          <Text selectable style={{ color: C.text, fontSize: 12 }}>
            {String(err?.message ?? err)}
          </Text>
          {!!err?.stack && (
            <Text selectable style={{ color: C.muted, fontSize: 10, marginTop: SP.md }}>
              {err.stack}
            </Text>
          )}
          {!!info && (
            <Text selectable style={{ color: C.muted, fontSize: 10, marginTop: SP.md }}>
              {info}
            </Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={{
            marginTop: SP.xl,
            backgroundColor: C.accent,
            borderRadius: R.md,
            paddingVertical: 15,
            alignItems: 'center',
          }}
          onPress={() => this.setState({ err: null, info: '' })}
        >
          <Text style={{ color: '#fff', fontSize: F.body, fontWeight: '700' }}>
            Qayta urinish
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}
