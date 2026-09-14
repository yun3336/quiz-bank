$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  $root = 'C:\Users\2100611\quiz-bank'
}
$vendor = Join-Path $root 'vendor-tgz'
$nm = Join-Path $root 'node_modules'
$registry = 'https://registry.npmmirror.com'
New-Item -ItemType Directory -Force -Path $vendor | Out-Null
New-Item -ItemType Directory -Force -Path $nm | Out-Null

$skip = @('fsevents', 'sharp')
$resolved = @{}
$queue = New-Object System.Collections.Generic.Queue[object]

function Enqueue([string]$name, [string]$range) {
  if ([string]::IsNullOrWhiteSpace($name)) { return }
  if ($skip -contains $name) { return }
  if ($name -match '^@next/swc-' -and $name -ne '@next/swc-win32-x64-msvc') { return }
  if ($name -match 'darwin|linux|wasm32|android|freebsd' -and $name -notmatch 'win32') { return }
  $queue.Enqueue([pscustomobject]@{ Name = $name; Range = $range })
}

function Get-Meta([string]$name, [string]$range) {
  $encoded = $name.Replace('/', '%2f')
  $versionPath = 'latest'
  if ($range -match '^\^?~?v?(\d+\.\d+\.\d+[^\s]*)') {
    $versionPath = $Matches[1]
  }
  $url = "$registry/$encoded/$versionPath"
  return Invoke-RestMethod -Uri $url -TimeoutSec 60
}

function Install-Package([string]$name, [string]$ver, $verMeta) {
  $safe = ($name -replace '[/\\]', '-') + '-' + ($ver -replace '[/\\]', '-') + '.tgz'
  $tgz = Join-Path $vendor $safe
  if (-not (Test-Path $tgz)) {
    $tarball = [string]$verMeta.dist.tarball
    Write-Host "DOWNLOAD $name@$ver"
    Invoke-WebRequest -Uri $tarball -OutFile $tgz -TimeoutSec 180
  } else {
    Write-Host "CACHE $name@$ver"
  }

  if ($name.StartsWith('@')) {
    $parts = $name.Split('/')
    $target = Join-Path (Join-Path $nm $parts[0]) $parts[1]
  } else {
    $target = Join-Path $nm $name
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  if (Test-Path $target) { Remove-Item $target -Recurse -Force }

  $tmp = Join-Path $vendor ('tmp-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  tar -xzf $tgz -C $tmp
  $pkgDir = Join-Path $tmp 'package'
  if (-not (Test-Path $pkgDir)) {
    $dirs = @(Get-ChildItem $tmp -Directory)
    if ($dirs.Count -ne 1) { throw "Unexpected tarball layout for $name@$ver" }
    $pkgDir = $dirs[0].FullName
  }
  Move-Item $pkgDir $target
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$pkgJson = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
foreach ($p in $pkgJson.dependencies.PSObject.Properties) { Enqueue $p.Name $p.Value }
foreach ($p in $pkgJson.devDependencies.PSObject.Properties) { Enqueue $p.Name $p.Value }
Enqueue '@next/swc-win32-x64-msvc' '16.3.0'

while ($queue.Count -gt 0) {
  $item = $queue.Dequeue()
  $name = [string]$item.Name
  $range = [string]$item.Range
  if ($resolved.ContainsKey($name)) { continue }

  Write-Host "RESOLVE $name ($range)"
  $meta = Get-Meta $name $range
  $ver = [string]$meta.version
  $resolved[$name] = $ver
  Install-Package $name $ver $meta

  if ($meta.dependencies) {
    foreach ($d in $meta.dependencies.PSObject.Properties) {
      Enqueue $d.Name ([string]$d.Value)
    }
  }
  if ($meta.optionalDependencies) {
    foreach ($d in $meta.optionalDependencies.PSObject.Properties) {
      if ($d.Name -match 'win32-x64' -or $d.Name -match 'win32_x64' -or $d.Name -eq '@next/swc-win32-x64-msvc') {
        Enqueue $d.Name ([string]$d.Value)
      }
    }
  }
  if ($meta.peerDependencies -and ($name -eq 'next' -or $name -eq 'react-dom')) {
    foreach ($d in $meta.peerDependencies.PSObject.Properties) {
      if ($d.Name -eq 'react' -or $d.Name -eq 'react-dom') {
        Enqueue $d.Name ([string]$d.Value)
      }
    }
  }
}

$bin = Join-Path $nm '.bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$nextCmd = @"
@echo off
node "%~dp0\..\next\dist\bin\next" %*
"@
Set-Content -Path (Join-Path $bin 'next.cmd') -Value $nextCmd -Encoding ASCII

Write-Host "Installed $($resolved.Count) packages"
$resolved.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)@$($_.Value)" } |
  Set-Content (Join-Path $vendor 'resolved.txt')
