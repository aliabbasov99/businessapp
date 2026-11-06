#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project_dir="$PWD"
mkdir -p .local dist

# Avoid two native builds fighting for the same RAM and Gradle outputs.
exec 9>.local/apk-build.lock
if ! flock -n 9; then
  echo 'Başqa lokal APK build-i artıq işləyir.' >&2
  exit 1
fi

if ! command -v javac >/dev/null 2>&1; then
  echo 'JDK 17 tapılmadı. JAVA_HOME dəyişənini JDK 17 qovluğuna yönəldin.' >&2
  exit 1
fi
if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" && -d "${HOME}/Android/Sdk" ]]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi
sdk_dir="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk_dir" || ! -d "$sdk_dir" ]]; then
  echo 'Android SDK tapılmadı. ANDROID_HOME təyin edin.' >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo 'Asılılıqlar tapılmadı. Əvvəlcə npm ci işlədin.' >&2
  exit 1
fi

free_kb=$(df -Pk "$project_dir" | awk 'NR==2 {print $4}')
if (( free_kb < 2 * 1024 * 1024 )); then
  echo 'Build üçün ən azı 2 GB boş disk sahəsi lazımdır.' >&2
  exit 1
fi

export DASHBOARD_LOCAL_APK=1
export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${APK_NODE_HEAP_MB:-1024}"
export APK_METRO_WORKERS="${APK_METRO_WORKERS:-1}"
export APK_NATIVE_JOBS="${APK_NATIVE_JOBS:-1}"
export CMAKE_BUILD_PARALLEL_LEVEL="$APK_NATIVE_JOBS"
export EXPO_NO_TELEMETRY=1
export EXPO_NO_DEPLOY=1
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-$(node --env-file-if-exists=.env.local -e 'process.stdout.write(process.env.EXPO_PUBLIC_API_URL || "")')}"
if [[ -z "$EXPO_PUBLIC_API_URL" ]]; then
  local_ip=$(ip -4 -j route get 1.1.1.1 | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s)[0]?.prefsrc || ""))')
  if [[ -z "$local_ip" ]]; then
    echo 'Kompüterin lokal IP-si tapılmadı. EXPO_PUBLIC_API_URL təyin edin.' >&2
    exit 1
  fi
  export EXPO_PUBLIC_API_URL="http://${local_ip}:8081"
fi
node -e 'const u=new URL(process.env.EXPO_PUBLIC_API_URL); if(!["http:","https:"].includes(u.protocol)||u.username||u.password) throw Error("EXPO_PUBLIC_API_URL must be an HTTP(S) API origin without credentials")'

architectures="${APK_ARCHITECTURES:-arm64-v8a}"
case "$architectures" in
  *[!a-zA-Z0-9_,\-]*) echo 'Yanlış APK_ARCHITECTURES' >&2; exit 1 ;;
esac
log_file="$project_dir/.local/apk-build.log"
exec > >(tee "$log_file") 2>&1
trap 'echo "Build tamamlanmadı. Loq: $log_file" >&2' ERR
printf 'Lokal APK: %s | Gradle: 1 worker | Metro: %s worker | C++: %s job\n' "$architectures" "$APK_METRO_WORKERS" "$APK_NATIVE_JOBS"
printf 'API: %s\n' "$EXPO_PUBLIC_API_URL"

# Re-run CNG when native inputs or the build mode changed, not on every JS edit.
fingerprint=$(node - <<'JS'
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=crypto.createHash('sha256');
for(const file of ['app.json','app.config.js','plugins/with-local-apk.cjs','package.json','package-lock.json']) hash.update(fs.readFileSync(file));
hash.update('local-apk-v1:'+process.env.EXPO_PUBLIC_API_URL);
process.stdout.write(hash.digest('hex'));
JS
)
previous=$(cat .local/apk-native-fingerprint 2>/dev/null || true)
if [[ ! -f android/gradlew || "$fingerprint" != "$previous" ]] || ! rg -q 'expo.modules.updates.ENABLED" android:value="false"' android/app/src/main/AndroidManifest.xml; then
  npx expo prebuild --platform android --no-install
  printf '%s' "$fingerprint" > .local/apk-native-fingerprint
fi

# One JVM handles Kotlin too. No parallel projects/ABIs or leftover memory-heavy daemon.
# Gradle's disk cache and incremental outputs remain available for the next build.
started=$SECONDS
(cd android && nice -n 10 ./gradlew :app:assembleRelease \
  --no-daemon --no-parallel --max-workers=1 --build-cache --console=plain \
  -I "$project_dir/scripts/android-low-memory.gradle" \
  "-Dorg.gradle.jvmargs=-Xmx${APK_GRADLE_HEAP_MB:-1536}m -XX:MaxMetaspaceSize=512m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -Dfile.encoding=UTF-8" \
  -Dorg.gradle.vfs.watch=false \
  -Pkotlin.compiler.execution.strategy=in-process \
  "-PreactNativeArchitectures=$architectures" \
  -Pandroid.enableMinifyInReleaseBuilds=false \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=false \
  -Pandroid.enablePngCrunchInReleaseBuilds=false "$@")

apk_source=android/app/build/outputs/apk/release/app-release.apk
if [[ ! -s "$apk_source" ]]; then
  echo 'Gradle bitdi, amma release APK tapılmadı.' >&2
  exit 1
fi
cp "$apk_source" dist/dashboard-app-local.apk.tmp
mv dist/dashboard-app-local.apk.tmp dist/dashboard-app-local.apk
sha256sum dist/dashboard-app-local.apk > dist/dashboard-app-local.apk.sha256
printf '\nAPK hazırdır: %s/dist/dashboard-app-local.apk\nBuild müddəti: %s saniyə\n' "$project_dir" "$((SECONDS-started))"
