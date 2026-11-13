#!/usr/bin/env bash
# Build the Windows installer from Linux (same route as MB ToolBook / MB Set-up Sheet):
#   dist/MBSine-<version>/MB Sine_<version>_x64-setup.exe   (per-user, no admin; bundles the offline WebView2 installer)
# Needs Rust with the x86_64-pc-windows-msvc target, cargo-xwin, LLVM/lld, NSIS. On Matt's laptop:
# NSIS 3.13-2 breaks Tauri's installer ("Plugin not found ... SemverCompare"); use the saved 3.13-1:
#   D=~/.local/opt/nsis-3.13-1; RUSTUP_TOOLCHAIN=1.99.1 PATH=$D/usr/bin:$PATH \
#     bwrap --dev-bind / / --ro-bind $D/usr/share/nsis /usr/share/nsis tools/release-windows.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z $(git status --porcelain) ]] || echo "WARNING: uncommitted changes" >&2

echo "== tests"
npm run check

version=$(node -p "require('./package.json').version")
echo "== building Sine $version"
npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc

out=dist/MBSine-$version
mkdir -p "$out"
cp "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Sine_${version}_x64-setup.exe" "$out/MB Sine_${version}_x64-setup.exe"
(cd "$out" && sha256sum *.exe > SHA256SUMS.txt)
echo "== done: $out"
ls -la "$out"
