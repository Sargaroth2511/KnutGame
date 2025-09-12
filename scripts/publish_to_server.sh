#!/bin/bash

# Default values
HOST=""
PORT="22"
USER=""
BUILD=true
SKIP_REMOTE_SETUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --user)
      USER="$2"
      shift 2
      ;;
    --build)
      BUILD=true
      shift
      ;;
    --skip-remote-setup)
      SKIP_REMOTE_SETUP=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check required arguments
if [ -z "$HOST" ] || [ -z "$USER" ]; then
  echo "Usage: $0 --host <host> --user <user> [--port <port>] [--build] [--skip-remote-setup]"
  exit 1
fi

echo "Publishing to $USER@$HOST:$PORT"

# Build client if requested
if [ "$BUILD" = true ]; then
  echo "Building client..."
  cd src/KnutGame.Client
  npm run build
  if [ $? -ne 0 ]; then
    echo "Client build failed"
    exit 1
  fi
  cd ../..
fi

# Build server if requested
if [ "$BUILD" = true ]; then
  echo "Building server..."
  # Clean previous publish directory
  rm -rf src/KnutGame.Server/publish
  dotnet publish src/KnutGame.Server/KnutGame.csproj -c Release -o src/KnutGame.Server/publish
  if [ $? -ne 0 ]; then
    echo "Server build failed"
    exit 1
  fi
fi

# Copy files to server
echo "Copying files to server..."

# Create directory structure on server first
echo "Creating directory structure..."
ssh -p $PORT -i ~/.ssh/id_ed25519 $USER@$HOST "mkdir -p /home/johannes/KnutGame/wwwroot/game /home/johannes/KnutGame/publish"

# Copy client build to production wwwroot
echo "Copying client files..."
rsync -avz --no-owner --no-group --no-times --chmod=ugo=rwX --temp-dir=/tmp -e "ssh -p $PORT -i ~/.ssh/id_ed25519" src/KnutGame.Server/wwwroot/game/* $USER@$HOST:/home/johannes/KnutGame/wwwroot/game/

# Copy server publish to production directory
echo "Copying server binaries..."
rsync -avz --no-owner --no-group --no-times --chmod=ugo=rwX --temp-dir=/tmp -e "ssh -p $PORT -i ~/.ssh/id_ed25519" src/KnutGame.Server/publish/* $USER@$HOST:/home/johannes/KnutGame/publish/

# Copy database if exists
if [ -f src/KnutGame.Server/knutgame.db ]; then
  echo "Copying database..."
  rsync -avz --no-owner --no-group --no-times --chmod=ugo=rwX --temp-dir=/tmp -e "ssh -p $PORT -i ~/.ssh/id_ed25519" src/KnutGame.Server/knutgame.db $USER@$HOST:/home/johannes/KnutGame/publish/knutgame.db
fi

if [ "$SKIP_REMOTE_SETUP" = false ]; then
  echo "Setting up remote server..."
  # SSH commands to set up on server
  ssh -p $PORT -i ~/.ssh/id_ed25519 $USER@$HOST << 'EOF'
    # Stop existing service if running
    sudo systemctl stop knutgame.service || true
    
    # Files are already in the correct production location
    # Just restart the service
    sudo systemctl start knutgame.service
    sudo systemctl enable knutgame.service
    
    echo "Service restarted successfully"
EOF
fi

echo "Deployment complete."
