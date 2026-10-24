#!/usr/bin/env bash
set -euo pipefail

# Backup harian biner ERP (gambar, PDF, media WA) dari volume VPS.
# Jalankan sebagai user aplikasi agar file tetap bisa dibaca proses PM2.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

read_env() {
  local key="$1" file="$ROOT/.env" line
  [ -f "$file" ] || return 0
  line="$(grep -E "^${key}=" "$file" | tail -n 1)" || return 0
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

SRC="${ERP_STORAGE_DIR:-$(read_env ERP_STORAGE_DIR)}"
SRC="${SRC:-/var/lib/askonveksi/storage}"
DEST="${ERP_STORAGE_BACKUP_DIR:-$(read_env ERP_STORAGE_BACKUP_DIR)}"
DEST="${DEST:-/var/backups/askonveksi}"
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP="${ERP_STORAGE_BACKUP_KEEP:-14}"

if [ ! -d "$SRC" ]; then
  echo "[storage-backup] folder sumber tidak ada: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"
umask 077

TARGET="$DEST/erp-storage-$STAMP.tar.gz"
tar -C "$(dirname "$SRC")" -czf "$TARGET" "$(basename "$SRC")"
echo "[storage-backup] dibuat: $TARGET ($(du -h "$TARGET" | cut -f1))"

# Rotasi: simpan $KEEP arsip terbaru.
ls -1t "$DEST"/erp-storage-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f --
