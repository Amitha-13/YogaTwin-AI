#!/usr/bin/env bash
#
# setup.sh — Install the correction engine's dependencies.
#
# Why this script exists:
#   @tensorflow/tfjs-node ships a native shared library (libtensorflow.so).
#   On WSL, loading that .so from a Windows drive mount (/mnt/c/...) hangs
#   indefinitely due to drvfs/9p mmap semantics. To work around this we keep
#   the engine source on the project drive but place node_modules on the
#   native Linux filesystem and symlink it in.
#
#   On a normal Linux/macOS checkout (not under /mnt/), it just runs a plain
#   `npm install` in place.
#
# Usage:  ./setup.sh
set -euo pipefail

ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ENGINE_DIR"

if [[ "$ENGINE_DIR" == /mnt/* ]]; then
  echo "Detected a Windows-mounted path ($ENGINE_DIR)."
  echo "Placing node_modules on the native Linux filesystem for tfjs-node compatibility."
  NATIVE_DIR="${YOGATWIN_ENGINE_NATIVE_DIR:-$HOME/.yogatwin-correction-engine}"
  mkdir -p "$NATIVE_DIR"

  # Install into the native dir using this project's package.json/lock.
  cp -f package.json "$NATIVE_DIR/package.json"
  [[ -f package-lock.json ]] && cp -f package-lock.json "$NATIVE_DIR/package-lock.json" || true
  ( cd "$NATIVE_DIR" && npm install )

  # Symlink node_modules back into the project dir.
  rm -rf "$ENGINE_DIR/node_modules"
  ln -s "$NATIVE_DIR/node_modules" "$ENGINE_DIR/node_modules"
  echo "Linked $ENGINE_DIR/node_modules -> $NATIVE_DIR/node_modules"
else
  npm install
fi

echo "Correction engine dependencies installed."
