param(
  [Parameter(Mandatory = $true)][string]$InputVideo,
  [Parameter(Mandatory = $true)][string]$OutputVideo,
  [string]$MatteVideo
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $InputVideo).Path
$outputPath = [IO.Path]::GetFullPath($OutputVideo)
if ($sourcePath -eq $outputPath) { throw 'Input and output paths must differ.' }
if (Test-Path -LiteralPath $outputPath) { throw 'Output already exists. Choose another filename.' }
$ffmpegPath = (Get-Command ffmpeg -ErrorAction Stop).Source
if ($MatteVideo) {
  $mattePath = (Resolve-Path -LiteralPath $MatteVideo).Path
  # Both streams must have the same dimensions/duration/edits. White matte=opaque, black=transparent.
  & $ffmpegPath -hide_banner -nostdin -i $sourcePath -i $mattePath -filter_complex '[0:v]scale=-2:720,setsar=1[c];[1:v]scale=-2:720,setsar=1,format=gray[a];[c][a]hstack=inputs=2:shortest=1[v]' -map '[v]' -an -r 24 -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart $outputPath
} else {
  # Input must really contain alpha (for example ProRes 4444). Ordinary opaque MP4 is rejected by alphaextract.
  & $ffmpegPath -hide_banner -nostdin -i $sourcePath -filter_complex '[0:v]scale=-2:720,setsar=1,split=2[c][a];[c]format=rgb24[color];[a]alphaextract,format=gray[alpha];[color][alpha]hstack=inputs=2[v]' -map '[v]' -an -r 24 -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart $outputPath
}
if ($LASTEXITCODE -ne 0) { throw ('Conversion failed: exit=' + $LASTEXITCODE) }
Write-Output ('Done: ' + $outputPath + ' - select packed RGB/alpha mode in the musical viewer.')
