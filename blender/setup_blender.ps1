param()
$ErrorActionPreference = 'Stop'
$version = '4.5.15'
$expectedSha256 = '52dd02fd74877fa08e74b67d7854cf32468a232c02aaa19b6844c91285574f8d'
$toolsDir = Join-Path $PSScriptRoot '.tools'
$archive = Join-Path $toolsDir "blender-$version-windows-x64.zip"
$binary = Join-Path $toolsDir "blender-$version-windows-x64/blender.exe"
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $archive)) {
    & curl.exe --fail --location --silent --show-error "https://download.blender.org/release/Blender4.5/blender-$version-windows-x64.zip" --output $archive
    if ($LASTEXITCODE -ne 0) { throw 'Blender download failed' }
}
$actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expectedSha256) { throw "Blender SHA256 mismatch: $actual" }
if (-not (Test-Path -LiteralPath $binary)) {
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsDir -Force
}
Write-Output "Verified Blender: $binary"
