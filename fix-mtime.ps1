$ErrorActionPreference = 'SilentlyContinue'
$now = Get-Date
$targets = @('node_modules', 'android', 'src', '.expo', 'assets')
$fileCount = 0
$dirCount = 0

foreach ($t in $targets) {
    if (-not (Test-Path $t)) { continue }
    Get-ChildItem $t -Recurse -File -Force | ForEach-Object {
        if ($_.LastWriteTime -gt $now) {
            try { $_.LastWriteTime = $now; $script:fileCount++ } catch {}
        }
    }
    Get-ChildItem $t -Recurse -Directory -Force | ForEach-Object {
        if ($_.LastWriteTime -gt $now) {
            try { $_.LastWriteTime = $now; $script:dirCount++ } catch {}
        }
    }
}

# root-level files (package.json, build.gradle disarida kalanlar vs.)
Get-ChildItem -File -Force | ForEach-Object {
    if ($_.LastWriteTime -gt $now) {
        try { $_.LastWriteTime = $now; $script:fileCount++ } catch {}
    }
}

Write-Output "duzeltilen dosya=$fileCount  dizin=$dirCount"
