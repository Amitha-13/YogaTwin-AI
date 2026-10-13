<#
.SYNOPSIS
  setup.ps1 - Install the Yoga Pose Correction engine's dependencies natively on Windows.

.DESCRIPTION
  Installs @tensorflow/tfjs-node and the rest of the engine's dependencies using
  the Windows Node.js / npm toolchain, producing Windows-native binaries
  (tfjs_binding.node + tensorflow.dll). This is the counterpart to setup.sh,
  which is only for a WSL/Linux checkout.

  tfjs-node 4.22 distributes its native addon as a prebuilt N-API binary
  (napi-v3..v8) downloaded from Google's binary host. Because N-API is
  ABI-stable, that prebuilt binary runs on newer Node versions (incl. Node 20/22/24)
  WITHOUT a local C++ compiler, PROVIDED the prebuilt download succeeds. If the
  download fails, npm falls back to compiling from source, which on Windows
  requires Visual Studio Build Tools + Python (node-gyp). This script detects
  and reports that situation instead of silently hanging.

  This script NEVER reuses Linux node_modules: if it finds a symlinked or
  Linux-oriented node_modules (left over from the WSL setup), it removes it and
  performs a clean Windows install in place.

.NOTES
  Run from Windows PowerShell (NOT from WSL):
      cd C:\Users\<you>\Desktop\YogaTwin-AI\correction-engine
      .\setup.ps1
#>

$ErrorActionPreference = 'Stop'
$EngineDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $EngineDir

Write-Host "== Yoga Pose Correction engine - Windows setup ==" -ForegroundColor Cyan
Write-Host "Engine dir: $EngineDir"

# --- 1. Toolchain checks ---------------------------------------------------
$nodeVersion = (& node --version) 2>$null
$npmVersion  = (& npm --version) 2>$null
if (-not $nodeVersion) {
  throw "Node.js not found on PATH. Install Node.js (LTS 20.x or 22.x recommended) from https://nodejs.org and re-run."
}
Write-Host "Node: $nodeVersion   npm: $npmVersion"

# tfjs-node 4.22 has prebuilt N-API binaries. Node 20.x / 22.x LTS are the
# best-tested. Node 24 generally works via the ABI-stable N-API binary, but is
# newer than this tfjs release, so we warn rather than block.
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -ge 23) {
  Write-Host "WARNING: Node $nodeVersion is newer than tfjs-node 4.22 was published for." -ForegroundColor Yellow
  Write-Host "         It should still work via the prebuilt N-API (napi-v8) binary." -ForegroundColor Yellow
  Write-Host "         If 'npm install' tries to COMPILE (node-gyp) and you have no" -ForegroundColor Yellow
  Write-Host "         Visual Studio Build Tools, install Node.js 22 LTS instead." -ForegroundColor Yellow
} elseif ($major -lt 18) {
  Write-Host "WARNING: Node $nodeVersion is quite old; Node 20.x/22.x LTS is recommended." -ForegroundColor Yellow
}

# --- 2. Remove any Linux/symlinked node_modules ----------------------------
$nm = Join-Path $EngineDir 'node_modules'
if (Test-Path $nm) {
  $item = Get-Item $nm -Force
  $isReparse = $item.Attributes -band [IO.FileAttributes]::ReparsePoint
  $hasLinuxBinding = Test-Path (Join-Path $nm '@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node')
  $hasWinDll = Test-Path (Join-Path $nm '@tensorflow\tfjs-node\deps\lib\tensorflow.dll')
  if ($isReparse -or ($hasLinuxBinding -and -not $hasWinDll)) {
    Write-Host "Removing stale/Linux node_modules (symlink or Linux-only binaries)..." -ForegroundColor Yellow
    cmd /c "rmdir /S /Q `"$nm`"" 2>$null
    if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
  }
}

# --- 3. Install -------------------------------------------------------------
Write-Host "Installing dependencies (prebuilt tfjs-node N-API binary expected)..." -ForegroundColor Cyan
& npm install
if ($LASTEXITCODE -ne 0) {
  throw "npm install failed. If the error mentions node-gyp/MSBuild/'cl.exe', either install Node.js 22 LTS (so the prebuilt binary is used) or install Visual Studio Build Tools + Python for a source build."
}

# --- 4. Verify the Windows native binary + real model load -----------------
$winBinding = Test-Path (Join-Path $nm '@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node')
$winDll     = Test-Path (Join-Path $nm '@tensorflow\tfjs-node\deps\lib\tensorflow.dll')
Write-Host ("tfjs_binding.node present: {0}" -f $winBinding)
Write-Host ("tensorflow.dll present:    {0}" -f $winDll)
if (-not $winBinding) {
  throw "tfjs-node native binding missing after install. See the npm output above."
}

Write-Host "Verifying the real model loads (74 classes expected)..." -ForegroundColor Cyan
$verify = @'
const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
(async () => {
  const model = await tf.loadLayersModel("file://./tfjs_model/model.json");
  const labels = JSON.parse(fs.readFileSync("./labels.json", "utf8"));
  const cfg = JSON.parse(fs.readFileSync("./model_config.json", "utf8"));
  console.log("MODEL_OK classes=" + labels.length + " features=" + cfg.totalFeatureSize);
  if (labels.length !== 74) process.exit(2);
})().catch(e => { console.error("MODEL_FAIL", e.message); process.exit(1); });
'@
$verify | & node -
if ($LASTEXITCODE -ne 0) {
  throw "Model verification failed. The native binding installed but the model did not load."
}

Write-Host ""
Write-Host "Setup complete. Start the engine with:" -ForegroundColor Green
Write-Host "    npm run dev        # or: node server.js   (listens on port 3002)"
