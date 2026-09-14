# Generate short WAV clips with Windows SAPI.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root "..\public\audio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$clipsPath = Join-Path $root "audio-clips.json"
$clips = Get-Content -Raw -Encoding UTF8 $clipsPath | ConvertFrom-Json

function Find-VoiceName([string]$cultureName) {
  $probe = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $prefix = $cultureName.Substring(0, 2).ToLower()
    foreach ($installed in $probe.GetInstalledVoices()) {
      $info = $installed.VoiceInfo
      if ($info.Culture.Name -eq $cultureName) { return $info.Name }
      if ($info.Culture.TwoLetterISOLanguageName.ToLower() -eq $prefix) { return $info.Name }
    }
  } finally {
    $probe.Dispose()
  }
  return $null
}

foreach ($clip in $clips) {
  $voiceName = Find-VoiceName $clip.culture
  if (-not $voiceName) {
    Write-Host "SKIP $($clip.file): no installed voice for $($clip.culture)"
    continue
  }
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice($voiceName)
  $path = Join-Path $outDir $clip.file
  $synth.SetOutputToWaveFile($path)
  $synth.Rate = -1
  $synth.Speak($clip.text)
  $synth.Dispose()
  Write-Host "Wrote $path ($voiceName)"
}
