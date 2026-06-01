# build-manifest.ps1
# 扫描 music/ 目录，生成 music-manifest.js
# 使用方法：在 final_product 目录下运行  .\build-manifest.ps1

$root   = Join-Path $PSScriptRoot "music"
$outFile= Join-Path $PSScriptRoot "music-manifest.js"

function ToLabel($name) {
    # 去掉 .ogg，下划线转空格，每词首字母大写
    $s = [System.IO.Path]::GetFileNameWithoutExtension($name)
    ($s -replace '_', ' ' -split ' ' | ForEach-Object {
        if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } else { $_ }
    }) -join ' '
}

function BuildNode($dir, $relBase) {
    $lines = @()
    $items = Get-ChildItem -Path $dir | Sort-Object { $_.PSIsContainer }, Name
    foreach ($item in $items) {
        $key = $item.Name -replace '\.ogg$', ''
        $label = ToLabel($item.Name)
        if ($item.PSIsContainer) {
            $relPath = if ($relBase) { "$relBase/$($item.Name)" } else { $item.Name }
            $inner = BuildNode $item.FullName $relPath
            $lines += "      `"$key`": { type: `"folder`", label: `"$label`", children: {"
            $lines += $inner
            $lines += "      }},"
        } else {
            $relPath = if ($relBase) { "music/$relBase/$($item.Name)" } else { "music/$($item.Name)" }
            $lines += "      `"$key`": { type: `"track`", path: `"$relPath`", label: `"$label`" },"
        }
    }
    return $lines
}

$date  = Get-Date -Format "yyyy-MM-dd"
$lines = @()
$lines += "// music-manifest.js — 自动生成，请勿手动编辑"
$lines += "// 用 build-manifest.ps1 重新生成（添加/删除音乐文件后执行一次）"
$lines += "// 生成时间: $date"
$lines += ""
$lines += "var MUSIC_MANIFEST = {"

foreach ($topDir in (Get-ChildItem -Path $root -Directory | Sort-Object Name)) {
    $key   = $topDir.Name
    $label = ToLabel($topDir.Name)
    $lines += "  `"$key`": { type: `"folder`", label: `"$label`", children: {"
    $lines += BuildNode $topDir.FullName $key
    $lines += "  }},"
}

$lines += "};"

$lines | Set-Content -Path $outFile -Encoding UTF8
Write-Host "✓ 已生成 music-manifest.js（$(($lines | Where-Object { $_ -match 'type.*track' }).Count) 首曲目）"
