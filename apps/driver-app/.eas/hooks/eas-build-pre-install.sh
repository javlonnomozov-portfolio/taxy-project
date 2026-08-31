#!/usr/bin/env bash
set -euo pipefail

# `google-services.json` .gitignore'da (Firebase kaliti) — EAS cloud build
# faqat git bilan kuzatilgan fayllarni yuklaydi, shuning uchun build ichida
# yo'q bo'lib chiqadi. Fayl EAS file-type environment variable sifatida
# saqlangan (`GOOGLE_SERVICES_JSON`, preview environment) — build vaqtida
# EAS uni diskka yozadi va shu o'zgaruvchida YO'LINI beradi; biz shu yo'ldan
# kutilgan joyga nusxalaymiz.
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
  echo "google-services.json EAS env var'dan nusxalandi"
fi
