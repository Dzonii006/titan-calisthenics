#!/usr/bin/env bash
set -e

echo "🔨 Building Titan Calisthenics Standalone Android APK..."

ANDROID_JAR="/home/dzonii/Android/platforms/android-34/android.jar"
BUILD_TOOLS="/home/dzonii/Android/build-tools/34.0.0"
KEYSTORE="android/debug.keystore"
OUT_APK="TitanCalisthenics.apk"

# Clean build directory
rm -rf build
mkdir -p build/gen build/obj build/dex

# Sync latest assets
rm -rf android/app/src/main/assets/*
cp -r workout-app/* android/app/src/main/assets/

# 1. Compile resources with aapt2
echo "📦 Step 1: Compiling resources..."
$BUILD_TOOLS/aapt2 compile --dir android/app/src/main/res -o build/compiled_res.zip

# 2. Link resources, generate R.java and package assets
echo "🔗 Step 2: Linking APK package with assets..."
$BUILD_TOOLS/aapt2 link \
  -I "$ANDROID_JAR" \
  --manifest android/app/src/main/AndroidManifest.xml \
  --min-sdk-version 26 \
  --target-sdk-version 34 \
  --java build/gen \
  -A android/app/src/main/assets \
  -o build/app.unaligned.apk \
  build/compiled_res.zip

# 3. Compile Java source
echo "☕ Step 3: Compiling Java source..."
javac --release 8 \
  -d build/obj \
  -cp "$ANDROID_JAR" \
  build/gen/com/titan/workout/R.java \
  android/app/src/main/java/com/titan/workout/MainActivity.java

# 4. Dex bytecode with D8
echo "⚙️ Step 4: Converting to Dalvik Executable (classes.dex)..."
$BUILD_TOOLS/d8 \
  --lib "$ANDROID_JAR" \
  --output build/dex \
  build/obj/com/titan/workout/*.class

# 5. Add classes.dex to APK
echo "🗜️ Step 5: Adding DEX to APK..."
(cd build/dex && zip -u ../app.unaligned.apk classes.dex)

# 6. Zipalign APK
echo "📐 Step 6: 4-byte zip alignment..."
$BUILD_TOOLS/zipalign -v -p -f 4 build/app.unaligned.apk build/app.aligned.apk > /dev/null

# 7. Generate debug keystore if not present
if [ ! -f "$KEYSTORE" ]; then
  echo "🔑 Generating debug signing certificate..."
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -alias androiddebugkey \
    -storepass android \
    -keypass android \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Titan Calisthenics, O=Titan, C=US"
fi

# 8. Sign APK with apksigner
echo "✍️ Step 7: Signing APK with apksigner..."
$BUILD_TOOLS/apksigner sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --out "$OUT_APK" \
  build/app.aligned.apk

# 9. Verify signed APK
$BUILD_TOOLS/apksigner verify "$OUT_APK"

echo "✅ SUCCESS! Standalone APK created: $(pwd)/$OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
