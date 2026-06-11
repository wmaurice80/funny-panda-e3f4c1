#!/bin/bash
# release-apk.sh — Prépare une release APK CalSnap
# Usage : ./scripts/release-apk.sh v1.2.0
#
# Ce script :
#  1. Met à jour APP_VERSION dans MigrationAPK.jsx
#  2. Met à jour versionCode + versionName dans build.gradle
#  3. npm run build + cap sync android
#  4. Rappelle les étapes manuelles restantes

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Usage : ./scripts/release-apk.sh v1.2.0"
  exit 1
fi

# Vérifier le format vX.Y.Z
if ! echo "$VERSION" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "❌ Format invalide. Utilise vX.Y.Z (ex: v1.2.0)"
  exit 1
fi

# Extraire X.Y pour versionName et incrémenter versionCode auto
CURRENT_CODE=$(grep 'versionCode' android/app/build.gradle | grep -v '//' | grep -oE '[0-9]+' | head -1)
NEW_CODE=$((CURRENT_CODE + 1))
VERSION_NAME="${VERSION#v}"  # retire le "v" → "1.2.0"

echo "🚀 Préparation release CalSnap $VERSION"
echo "   versionCode : $CURRENT_CODE → $NEW_CODE"
echo "   versionName : $VERSION_NAME"
echo ""

# 1. Mettre à jour APP_VERSION dans MigrationAPK.jsx
sed -i '' "s/export const APP_VERSION = '.*'/export const APP_VERSION = '$VERSION'/" \
  src/components/MigrationAPK.jsx
echo "✅ APP_VERSION mis à jour → $VERSION"

# 2. Mettre à jour versionCode dans build.gradle
sed -i '' "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" \
  android/app/build.gradle
echo "✅ versionCode mis à jour → $NEW_CODE"

# 3. Mettre à jour versionName dans build.gradle
sed -i '' "s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" \
  android/app/build.gradle
echo "✅ versionName mis à jour → $VERSION_NAME"

# 4. Build web + sync Android
echo ""
echo "📦 Build web..."
npm run build

echo "📱 Sync Capacitor Android..."
export PATH="/opt/homebrew/bin:$PATH"
source ~/.nvm/nvm.sh 2>/dev/null && nvm use 22 2>/dev/null
npx cap sync android

# 5. Commit
echo ""
echo "💾 Commit..."
git add src/components/MigrationAPK.jsx android/app/build.gradle
git commit -m "chore: release $VERSION"
git push

echo ""
echo "✅ Préparation terminée !"
echo ""
echo "👉 Étapes manuelles restantes :"
echo "   1. Android Studio → Build → Generate Signed APK → Release"
echo "      APK : android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "   2. Publier sur GitHub Releases :"
echo "      cp android/app/build/outputs/apk/release/app-release.apk calsnap.apk"
echo "      gh release create $VERSION calsnap.apk#calsnap.apk \\"
echo "        --title \"CalSnap $VERSION\" \\"
echo "        --notes \"Nouveautés : ...\""
echo "      rm calsnap.apk"
echo ""
echo "   → Les utilisateurs verront le bandeau de mise à jour au prochain démarrage de l'APK."
