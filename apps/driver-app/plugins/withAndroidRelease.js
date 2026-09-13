/**
 * Android reliz imzosi + NDK versiyasi — `expo prebuild` dan KEYIN ham saqlanadi.
 *
 * MUAMMO 1 (imzo). Expo shabloni reliz build'ini ham debug kaliti bilan
 * imzolaydi:
 *
 *     release { signingConfig signingConfigs.debug }
 *
 * `debug.keystore` shablonda qat'iy fayl — uning MAXFIY KALITI internetda
 * ochiq turibdi. Ya'ni istalgan odam bizning ilova ustiga o'rnatiladigan
 * soxta APK yasay oladi. Play Market ham bunday APK'ni qabul qilmaydi.
 *
 * MUAMMO 2 (NDK). Bu mashinada o'rnatilgan NDK shablondagidan boshqa
 * (27.1 vs 26.1) va build `[CXX1101] ... did not have a source.properties
 * file` bilan yiqiladi. `android/` `.gitignore` da bo'lgani uchun qo'lda
 * tuzatish HAR prebuild'da yo'qolardi (HANDOFF 6.1).
 *
 * YECHIM. Ikkalasi ham shu plagin orqali, har prebuild'da avtomatik
 * qo'llanadi. Parollar muhit o'zgaruvchilaridan olinadi va Gradle
 * fayllariga YOZILMAYDI — repoda ham, `gradle.properties` da ham hech
 * qanday maxfiy narsa qolmaydi:
 *
 *     TTY_ANDROID_KEYSTORE           keystore faylining TO'LIQ yo'li
 *     TTY_ANDROID_KEYSTORE_PASSWORD  do'kon paroli
 *     TTY_ANDROID_KEY_ALIAS          kalit taxallusi
 *     TTY_ANDROID_KEY_PASSWORD       kalit paroli
 *     TTY_ANDROID_NDK                (ixtiyoriy) NDK versiyasi
 *
 * `TTY_ANDROID_KEYSTORE` berilmasa build AVVALGIDEK debug kaliti bilan
 * imzolanadi — sinov build'lari uchun yetarli va hech narsa buzilmaydi.
 * Gradle bu holatda ogohlantirish chiqaradi, jimgina o'tib ketmaydi.
 */
const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

/** Shablonda aynan shu satr turadi — o'zgarsa build jim buzilmasin, xato beramiz. */
const DEBUG_SIGN = 'signingConfig signingConfigs.debug';

const RELEASE_SIGNING = `
        release {
            // Reliz kaliti FAQAT muhit o'zgaruvchilaridan. Bu yerga parol
            // yozib qo'yilsa u \`android/\` orqali build keshiga va ehtimol
            // GitHub'ga tushardi.
            def ksPath = System.getenv("TTY_ANDROID_KEYSTORE")
            if (ksPath) {
                storeFile file(ksPath)
                storePassword System.getenv("TTY_ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("TTY_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("TTY_ANDROID_KEY_PASSWORD")
            }
        }
`;

const RELEASE_PICK = `signingConfig System.getenv("TTY_ANDROID_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`;

function patchAppGradle(src) {
  if (src.includes('TTY_ANDROID_KEYSTORE')) return src; // allaqachon qo'llangan

  // 1) `signingConfigs { debug { ... } }` blokiga `release` ni qo'shamiz.
  const anchor = /(signingConfigs\s*\{)/;
  if (!anchor.test(src)) {
    throw new Error('withAndroidRelease: `signingConfigs` bloki topilmadi — shablon o‘zgargan.');
  }
  let out = src.replace(anchor, `$1${RELEASE_SIGNING}`);

  // 2) Reliz build turini shartli imzoga o'tkazamiz.
  //
  // DIQQAT: `signingConfig signingConfigs.debug` faylda IKKI marta uchraydi
  // (debug va release build turlarida). Bizga faqat `release {` dan keyingisi
  // kerak, shuning uchun oxirgisini almashtiramiz.
  const last = out.lastIndexOf(DEBUG_SIGN);
  if (last < 0) {
    throw new Error('withAndroidRelease: reliz imzo satri topilmadi — shablon o‘zgargan.');
  }
  out = out.slice(0, last) + RELEASE_PICK + out.slice(last + DEBUG_SIGN.length);

  // 3) Kalitsiz qurilayotganini build logida AYTAMIZ — sinov APK'si Play
  //    Market'ga yaramasligi bilinmay qolmasin.
  out += `
// Toy TaxY: imzo haqida ogohlantirish (plugins/withAndroidRelease.js)
gradle.taskGraph.whenReady {
    if (!System.getenv("TTY_ANDROID_KEYSTORE")) {
        logger.warn("TOY TAXY: TTY_ANDROID_KEYSTORE yo'q — APK DEBUG kaliti bilan imzolanadi (Play Market uchun yaramaydi).")
    }
}
`;
  return out;
}

function patchProjectGradle(src) {
  const ndk = process.env.TTY_ANDROID_NDK;
  if (!ndk) return src; // berilmasa shablon qiymati qoladi
  return src.replace(/ndkVersion\s*=\s*["'][^"']+["']/, `ndkVersion = "${ndk}"`);
}

module.exports = function withAndroidRelease(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withAndroidRelease: faqat Groovy `build.gradle` qo‘llab-quvvatlanadi.');
    }
    cfg.modResults.contents = patchAppGradle(cfg.modResults.contents);
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchProjectGradle(cfg.modResults.contents);
    return cfg;
  });

  return config;
};
