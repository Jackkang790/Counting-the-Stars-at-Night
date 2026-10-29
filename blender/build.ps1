param(
    [string]$BlenderExe = '',
    [switch]$SkipRenders
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
if (-not $BlenderExe) {
    $localBlender = Join-Path $PSScriptRoot '.tools/blender-4.5.15-windows-x64/blender.exe'
    if (Test-Path -LiteralPath $localBlender) { $BlenderExe = $localBlender }
    else {
        $found = Get-Command blender -ErrorAction SilentlyContinue
        if ($found) { $BlenderExe = $found.Source }
        else { throw 'Run ./blender/setup_blender.ps1 or supply -BlenderExe first.' }
    }
}
$previousResources = $env:BLENDER_USER_RESOURCES
$env:BLENDER_USER_RESOURCES = Join-Path $PSScriptRoot '.tools/user'
try {
    $renderArgs = @()
    if ($SkipRenders) { $renderArgs = @('--', '--skip-renders') }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/build_starseed.py') @renderArgs
    if ($LASTEXITCODE -ne 0) { throw 'Asset build failed' }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/validate_starseed.py') @renderArgs
    if ($LASTEXITCODE -ne 0) { throw 'Asset validation failed' }
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.tools/qa/node_modules/gltf-validator')) -or -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.tools/qa/node_modules/three'))) {
        & npm.cmd install --prefix (Join-Path $PSScriptRoot '.tools/qa') --cache (Join-Path $PSScriptRoot '.tools/npm-cache') --no-audit --no-fund gltf-validator@2.0.0-dev.3.10 three@0.186.1
        if ($LASTEXITCODE -ne 0) { throw 'Khronos validator setup failed' }
    }
    & node (Join-Path $PSScriptRoot 'scripts/validate_khronos.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Khronos validator reported an issue' }
    & node (Join-Path $PSScriptRoot 'scripts/validate_three.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Three.js compatibility check failed' }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/finalize_manifest.py')
    if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed' }
} finally {
    $env:BLENDER_USER_RESOURCES = $previousResources
}
