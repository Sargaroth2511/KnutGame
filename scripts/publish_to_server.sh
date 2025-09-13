#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

trap 'echo "[ERROR] Failed at line $LINENO" >&2' ERR

# Resolve script and repo root paths to allow running from any CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Defaults
HOST=""
PORT="22"
USER=""
IDENTITY_FILE=""         # optional; let SSH config handle it by default
BUILD=true                # default: build both client and server
SKIP_REMOTE_SETUP=false
# Use shell-tilde so rsync/ssh expand it on remote
REMOTE_DIR_DEFAULT='~/KnutGame'
REMOTE_DIR="$REMOTE_DIR_DEFAULT"

# DB copy policy: by default DO NOT copy DB to avoid overwriting prod data
COPY_DB=false             # --copy-db enables copy if remote DB does not exist
REPLACE_DB=false          # --replace-db backs up remote and replaces it (opt-in)
DRY_RUN=false             # --dry-run prevents remote changes and uses rsync -n

print_usage() {
  cat <<USAGE
Usage: $0 --host <host> --user <user> [options]

Required:
  --host <host>                Remote host
  --user <user>                Remote user

Optional:
  --port <port>                SSH port (default: 22)
  --identity-file <path>       SSH identity file (default: use ssh config)
  --remote-dir <path>          Remote base dir (default: \$HOME/KnutGame on remote)
  --skip-build                 Skip building client and server
  --build                      Force build (default already builds)
  --skip-remote-setup          Skip remote systemctl restart step
  --copy-db                    Copy local DB only if remote DB does not exist
  --replace-db                 Backup remote DB then replace with local (implies --copy-db)
  --dry-run                    Show what would change; no remote changes and skip builds
  --help                       Show this help
USAGE
}

require_value() {
  # Ensure next arg exists for options that take a value
  local opt="$1"
  if [[ $# -lt 2 ]] || [[ -z ${2:-} ]]; then
    echo "Missing value for ${opt}" >&2
    exit 2
  fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      require_value "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    --port)
      require_value "$1" "${2:-}"; PORT="$2"; shift 2 ;;
    --user)
      require_value "$1" "${2:-}"; USER="$2"; shift 2 ;;
    --identity-file)
      require_value "$1" "${2:-}"; IDENTITY_FILE="$2"; shift 2 ;;
    --remote-dir)
      require_value "$1" "${2:-}"; REMOTE_DIR="$2"; shift 2 ;;
    --skip-build)
      BUILD=false; shift ;;
    --build)
      BUILD=true; shift ;;
    --skip-remote-setup)
      SKIP_REMOTE_SETUP=true; shift ;;
    --copy-db)
      COPY_DB=true; shift ;;
    --replace-db)
      COPY_DB=true; REPLACE_DB=true; shift ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    --help|-h)
      print_usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage
      exit 1 ;;
  esac
done

# Validate required args
if [[ -z "$HOST" || -z "$USER" ]]; then
  echo "--host and --user are required" >&2
  print_usage
  exit 1
fi

echo "Publishing to ${USER}@${HOST}:${PORT}"
echo "Remote base: ${REMOTE_DIR}"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN] No remote changes will be made. Builds skipped."
fi

# Common SSH options
SSH_OPTS=( -p "$PORT" )
if [[ -n "$IDENTITY_FILE" ]]; then
  SSH_OPTS+=( -i "$IDENTITY_FILE" )
fi

# rsync remote shell: pass as a single string to avoid IFS/newline issues
RSYNC_RSH="ssh -p ${PORT}"
if [[ -n "$IDENTITY_FILE" ]]; then
  RSYNC_RSH="${RSYNC_RSH} -i ${IDENTITY_FILE}"
fi

RSYNC_DRY=( )
if [[ "$DRY_RUN" == true ]]; then
  RSYNC_DRY=( -n )
fi

# Build client if requested
if [[ "$BUILD" == true && "$DRY_RUN" == false ]]; then
  echo "Building client..."
  pushd "${ROOT_DIR}/src/KnutGame.Client" >/dev/null
  npm run build
  popd >/dev/null
fi

# Build server if requested
if [[ "$BUILD" == true && "$DRY_RUN" == false ]]; then
  echo "Building server..."
  rm -rf "${ROOT_DIR}/src/KnutGame.Server/publish"
  dotnet publish "${ROOT_DIR}/src/KnutGame.Server/KnutGame.csproj" -c Release -o "${ROOT_DIR}/src/KnutGame.Server/publish"
fi

# (No deploy timestamp markers written)

echo "Creating remote directories..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN] ssh ${USER}@${HOST} mkdir -p ${REMOTE_DIR}/{wwwroot/game,publish,backups}"
else
  ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
    "mkdir -p ${REMOTE_DIR}/wwwroot/game ${REMOTE_DIR}/publish ${REMOTE_DIR}/backups"
fi

echo "Copying client files..."
# Sync directory contents (trailing slash) and delete stray files on remote
rsync "${RSYNC_DRY[@]}" -rlptDzv --no-owner --no-group --no-times --omit-dir-times --delete --chmod=ugo=rwX --temp-dir=/tmp \
  -e "$RSYNC_RSH" \
  "${ROOT_DIR}/src/KnutGame.Server/wwwroot/game/" "${USER}@${HOST}:${REMOTE_DIR}/wwwroot/game/"

echo "Copying server binaries..."
# Do NOT delete remote publish; avoid nuking runtime files (like DB). Just update binaries.
rsync "${RSYNC_DRY[@]}" -rlptDzv --no-owner --no-group --no-times --omit-dir-times --chmod=ugo=rwX --temp-dir=/tmp \
  -e "$RSYNC_RSH" \
  "${ROOT_DIR}/src/KnutGame.Server/publish/" "${USER}@${HOST}:${REMOTE_DIR}/publish/"

# Database handling: safe by default
LOCAL_DB="${ROOT_DIR}/src/KnutGame.Server/knutgame.db"
REMOTE_DB_PATH="${REMOTE_DIR}/publish/knutgame.db"
if [[ "$COPY_DB" == true && -f "$LOCAL_DB" ]]; then
  echo "DB copy requested. Verifying remote..."
  if [[ "$REPLACE_DB" == true ]]; then
    echo "Backing up and replacing remote DB..."
    # Backup existing DB (if present) then copy
    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY-RUN] ssh ${USER}@${HOST} backup and move ${REMOTE_DB_PATH} -> ${REMOTE_DIR}/backups/knutgame.db.<timestamp>"
      echo "[DRY-RUN] rsync DB ${LOCAL_DB} -> ${REMOTE_DB_PATH}"
    else
      ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
        "set -e; ts=\$(date +%Y%m%d_%H%M%S); if [ -f '${REMOTE_DB_PATH}' ]; then mv '${REMOTE_DB_PATH}' '${REMOTE_DIR}/backups/knutgame.db.$ts'; fi"
      rsync -rlptDzv --no-owner --no-group --no-times --omit-dir-times --chmod=ugo=rwX --temp-dir=/tmp \
        -e "$RSYNC_RSH" \
        "$LOCAL_DB" "${USER}@${HOST}:${REMOTE_DB_PATH}"
    fi
  else
    # Only copy if file does NOT exist on remote to prevent accidental overwrite
    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY-RUN] Would check for remote DB at ${REMOTE_DB_PATH} and copy if missing"
    elif ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "[ -f '${REMOTE_DB_PATH}' ]"; then
      echo "Remote DB exists. Skipping copy to avoid overwriting production data."
    else
      echo "Remote DB not found. Copying initial DB..."
      rsync -rlptDzv --no-owner --no-group --no-times --omit-dir-times --chmod=ugo=rwX --temp-dir=/tmp \
        -e "$RSYNC_RSH" \
        "$LOCAL_DB" "${USER}@${HOST}:${REMOTE_DB_PATH}"
    fi
  fi
else
  echo "Skipping DB copy (default). Use --copy-db to initialize or --replace-db to overwrite with backup."
fi

if [[ "$SKIP_REMOTE_SETUP" == false ]]; then
  echo "Restarting remote service..."
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] ssh ${USER}@${HOST} sudo systemctl restart knutgame.service"
  else
    # Try passwordless sudo; if not available, print instructions but do not fail the deploy
    ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
      "if sudo -n true 2>/dev/null; then \
         sudo systemctl restart knutgame.service && sudo systemctl is-active --quiet knutgame.service && echo 'Service restarted successfully'; \
       else \
         echo 'No passwordless sudo. Please run: sudo systemctl restart knutgame.service'; \
       fi"
  fi
else
  echo "Skipping remote service restart as requested."
fi

echo "Deployment complete."
