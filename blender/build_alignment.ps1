param([string]$BlenderExe = '', [switch]$SkipRenders)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$branch = & git --no-optional-locks -C $repo branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch -ne 'feature/blender-assets') {
    throw 'Run this pipeline in the feature/blender-assets worktree.'
}
if (-not $BlenderExe) {
    $local = Join-Path $PSScriptRoot '.tools/blender-4.5.15-windows-x64/blender.exe'
    if (Test-Path -LiteralPath $local) { $BlenderExe = $local }
    else {
        $found = Get-Command blender -ErrorAction SilentlyContinue
        if ($found) { $BlenderExe = $found.Source }
        else { throw 'Supply -BlenderExe or run setup_blender.ps1 in this worktree.' }
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.tools/qa/node_modules/three')) -or
    -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.tools/qa/node_modules/gltf-validator'))) {
    & npm.cmd install --prefix (Join-Path $PSScriptRoot '.tools/qa') --cache (Join-Path $PSScriptRoot '.tools/npm-cache') --no-audit --no-fund three@0.186.1 gltf-validator@2.0.0-dev.3.10
    if ($LASTEXITCODE -ne 0) { throw 'QA dependency installation failed' }
}
$previousResources = $env:BLENDER_USER_RESOURCES
$env:BLENDER_USER_RESOURCES = Join-Path $PSScriptRoot '.tools/user'
try {
    $renderArgs = @()
    if ($SkipRenders) { $renderArgs = @('--','--skip-renders') }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/build_alignment_facade.py') @renderArgs
    if ($LASTEXITCODE -ne 0) { throw 'Alignment build failed' }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/validate_alignment_facade.py') @renderArgs
    if ($LASTEXITCODE -ne 0) { throw 'Blender/GLB validation failed' }
    & node (Join-Path $PSScriptRoot 'scripts/validate_alignment_three.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Three.js/Khronos validation failed' }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'scripts/finalize_alignment_manifest.py')
    if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed' }
} finally { $env:BLENDER_USER_RESOURCES = $previousResources }
