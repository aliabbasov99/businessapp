<#
  Lokal APK build skripti (Windows).

  Nə edir:
    1) Layihə mənbələrini C:\a qovluğuna kopyalayır (qısa yol -> Windows yol-uzunluğu problemi olmur).
    2) C:\a-da asılılıqları qurur (react-native-reanimated daxil) və APK-ni build edir.
       Nəticə: C:\a\android\app\build\outputs\apk\release\app-release.apk
    3) Hazır APK-ni həm C:\a qovluğuna, həm də əsas layihə qovluğuna kopyalayır.

  İstifadə:  powershell -ExecutionPolicy Bypass -File .\buildsh.ps1
#>

$ErrorActionPreference = "Stop"

$src = "C:\ali\projects\businessapp"
$dst = "C:\a"
$cxx = "C:/b"

# --- Lokal test APK konfiqurasiyası -------------------------------------------
# app.config.js: DASHBOARD_LOCAL_APK=1 -> OTA update sönrür (JS APK-nin içində qalır).
# plugins/with-local-apk.cjs: http API üçün cleartext trafikə icazə verilir.
$env:DASHBOARD_LOCAL_APK = "1"
$env:NODE_ENV = "production"
$env:EXPO_NO_TELEMETRY = "1"

if (-not $env:EXPO_PUBLIC_API_URL) {
  $envFile = Join-Path $src ".env.local"
  if (Test-Path $envFile) {
    $line = Select-String -Path $envFile -Pattern '^\s*EXPO_PUBLIC_API_URL\s*=' | Select-Object -First 1
    if ($line) {
      $env:EXPO_PUBLIC_API_URL = ($line.Line -replace '^\s*EXPO_PUBLIC_API_URL\s*=\s*', '').Trim().Trim('"', "'")
    }
  }
}
if (-not $env:EXPO_PUBLIC_API_URL) { throw "EXPO_PUBLIC_API_URL tapilmadi (.env.local faylini yoxlayin)." }
Write-Host ">> API: $env:EXPO_PUBLIC_API_URL" -ForegroundColor DarkGray

# --- 1) Mənbəni C:\a-ya köçür ------------------------------------------------
Write-Host ">> Kopyalanir: $src -> $dst" -ForegroundColor Cyan
robocopy $src $dst /E /XD node_modules .git .expo .cxx "$src\android\build" "$src\android\app\build" "$src\android\.gradle" /XF *.ps1 *.apk /NFL /NDL /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy xeta verdi (kod: $LASTEXITCODE)" }

Push-Location $dst
try {
  # --- 2) Asılılıqlar ----------------------------------------------------------
  Write-Host ">> npm install" -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install alinmadi" }

  $raPkg = Join-Path $dst "node_modules\react-native-reanimated\package.json"
  if (-not (Test-Path $raPkg)) { throw "react-native-reanimated qurulmadi - build dayandirildi." }
  $raVer = (Get-Content $raPkg -Raw | ConvertFrom-Json).version
  Write-Host ">> react-native-reanimated v$raVer hazirdir" -ForegroundColor DarkGray

  # --- 3) android qovluğu (yalnız yoxdursa yarat) -----------------------------
  if (-not (Test-Path "$dst\android")) {
    Write-Host ">> expo prebuild" -ForegroundColor Cyan
    npx expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) { throw "expo prebuild alinmadi" }
  }

  # --- 3b) CMake çıxışını qısa yola yönəlt (yol uzunluğu problemi) -----------
  $gradle = "$dst\android\app\build.gradle"
  $content = Get-Content $gradle -Raw
  if ($content -notmatch "buildStagingDirectory") {
    $m = [regex]::Match($content, '(?m)^android\s*\{')
    if (-not $m.Success) { throw "build.gradle icinde 'android {' tapilmadi" }
    $inject = @"

    externalNativeBuild {
        cmake {
            buildStagingDirectory file("$cxx")
        }
    }
"@
    $content = $content.Insert($m.Index + $m.Length, $inject)
    [System.IO.File]::WriteAllText($gradle, $content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ">> build.gradle yenilendi (buildStagingDirectory = $cxx)" -ForegroundColor Yellow
  }

  # köhnə CMake cache-lərini təmizlə
  if (Test-Path "$dst\android\app\.cxx") { Remove-Item "$dst\android\app\.cxx" -Recurse -Force }
  if (Test-Path "C:\b") { Remove-Item "C:\b" -Recurse -Force }

  # --- 4) Build ----------------------------------------------------------------
  Write-Host ">> Gradle assembleRelease" -ForegroundColor Cyan
  Push-Location "$dst\android"
  try {
    .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
    if ($LASTEXITCODE -ne 0) { throw "Gradle build alinmadi" }
  } finally { Pop-Location }

  $apk = Get-ChildItem "$dst\android\app\build\outputs\apk\release\*.apk" | Select-Object -First 1
  if (-not $apk) { throw "APK tapilmadi" }

  # --- 5) APK-ni kopyala: C:\a kökü + əsas layihə qovluğu ---------------------
  $stamp = Get-Date -Format "yyyyMMdd-HHmm"
  $name = "businessapp-$stamp.apk"

  $toDst = Join-Path $dst $name
  $toSrc = Join-Path $src $name
  Copy-Item $apk.FullName $toDst -Force
  Copy-Item $apk.FullName $toSrc -Force

  Write-Host ">> APK (C:\a)   : $toDst" -ForegroundColor Green
  Write-Host ">> APK (layihə) : $toSrc" -ForegroundColor Green
  Write-Host ">> Build hazirdir ($([math]::Round($apk.Length / 1MB, 1)) MB)" -ForegroundColor Green
} finally { Pop-Location }
