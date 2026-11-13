pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 60, unit: 'MINUTES')
    skipDefaultCheckout()
  }

  environment {
    DOCKER_BUILDKIT = '1'
    NETWORK_NAME = 'vix-leads-net'
    // Single fullstack pipeline — ports from docs/domains.md
    FRONTEND_PORT = '6018'
    BACKEND_PORT = '6019'
    FRONTEND_ENV_CREDENTIAL_ID = 'vix-leads-frontend-env'
    BACKEND_ENV_CREDENTIAL_ID = 'vix-leads-backend-env'
    FRONTEND_IMAGE = 'vix-leads-frontend'
    BACKEND_IMAGE = 'vix-leads-backend'
    FRONTEND_CONTAINER = 'vix-leads-frontend'
    BACKEND_CONTAINER = 'vix-leads-backend'
    DB_CONTAINER = 'vix-leads-db'
    DB_IMAGE = 'postgres:16-alpine'
    DB_VOLUME = 'vix-leads-postgres'
  }

  stages {
    stage('Prepare Workspace') {
      steps {
        sh '''
          set -e
          docker run --rm -v "$PWD":/w -w /w alpine:3.20 \
            chown -R "$(id -u):$(id -g)" /w 2>/dev/null || true
        '''
        script {
          try {
            cleanWs(deleteDirs: true, disableDeferredWipeout: true, notFailBuild: false)
          } catch (err) {
            echo "cleanWs unavailable or failed; falling back to shell wipe: ${err}"
            sh '''
              set -e
              find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
            '''
          }
        }
        checkout scm
        script {
          env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Fullstack deploy — Branch: ${env.BRANCH_NAME} @ ${env.GIT_SHORT_SHA}"
        echo "FE :${env.FRONTEND_PORT}  BE :${env.BACKEND_PORT}  DB:docker  net: ${env.NETWORK_NAME}"
      }
    }

    stage('Ensure Network') {
      steps {
        sh '''
          docker network create "$NETWORK_NAME" || true
        '''
      }
    }

    // Quality gates run in Husky — Jenkins is one fullstack build + deploy only.

    stage('Build & Deploy Fullstack') {
      steps {
        withCredentials([
          file(credentialsId: env.BACKEND_ENV_CREDENTIAL_ID, variable: 'BACKEND_ENV_FILE'),
          file(credentialsId: env.FRONTEND_ENV_CREDENTIAL_ID, variable: 'FRONTEND_ENV_FILE'),
        ]) {
          sh '''#!/bin/bash
set -euo pipefail

# Literal KEY=value extract — never source secret files under set -u
env_get() {
  local key="$1" file="$2"
  grep -E "^[[:space:]]*${key}=" "$file" | head -n1 | cut -d= -f2- | tr -d '\\r' | sed "s/^[\\"']//;s/[\\"']$//"
}

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  echo "Missing backend env credential file (ID: vix-leads-backend-env): $BACKEND_ENV_FILE"
  exit 1
fi
if [ ! -f "$FRONTEND_ENV_FILE" ]; then
  echo "Missing frontend env credential file (ID: vix-leads-frontend-env): $FRONTEND_ENV_FILE"
  exit 1
fi

POSTGRES_DB="$(env_get POSTGRES_DB "$BACKEND_ENV_FILE")"
POSTGRES_USER="$(env_get POSTGRES_USER "$BACKEND_ENV_FILE")"
POSTGRES_PASSWORD="$(env_get POSTGRES_PASSWORD "$BACKEND_ENV_FILE")"
POSTGRES_DB="${POSTGRES_DB:-vix_kanban}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
if [ -z "${POSTGRES_PASSWORD}" ]; then
  echo "POSTGRES_PASSWORD is required in vix-leads-backend-env"
  exit 1
fi

# --- Postgres (in Docker on the app network) ---
# Uses backend --env-file so passwords with $ / special chars are not shell-expanded.
echo "=== Ensuring Postgres (${DB_CONTAINER}) ==="
docker volume create "$DB_VOLUME" >/dev/null
docker rm -f "$DB_CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK_NAME" \
  --network-alias db \
  --restart unless-stopped \
  --env-file "$BACKEND_ENV_FILE" \
  -v "${DB_VOLUME}:/var/lib/postgresql/data" \
  "$DB_IMAGE"

echo "=== Waiting for Postgres ready ==="
for i in $(seq 1 45); do
  if docker exec "$DB_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    echo "Postgres ready"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "Postgres failed to become ready"
    docker logs --tail 100 "$DB_CONTAINER" || true
    exit 1
  fi
  sleep 2
done

# --- Backend ---
echo "=== Building backend ==="
docker build \
  -f deployment/docker/Dockerfile.backend \
  -t "${BACKEND_IMAGE}:${BUILD_NUMBER}" \
  -t "${BACKEND_IMAGE}:latest" \
  .

docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$BACKEND_CONTAINER" \
  --network "$NETWORK_NAME" \
  --network-alias backend \
  --restart unless-stopped \
  --env-file "$BACKEND_ENV_FILE" \
  -e POSTGRES_HOST=db \
  -e POSTGRES_PORT=5432 \
  -v vix-leads-media:/app/media \
  -p "${BACKEND_PORT}:8000" \
  "${BACKEND_IMAGE}:latest"

echo "=== Waiting for backend health :${BACKEND_PORT} ==="
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health/" >/dev/null; then
    echo "Backend smoke OK"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Backend smoke failed"
    docker logs --tail 200 "$BACKEND_CONTAINER" || true
    exit 1
  fi
  sleep 2
done

# --- Frontend ---
API_URL="$(env_get NEXT_PUBLIC_API_URL "$FRONTEND_ENV_FILE")"
if [ -z "${API_URL}" ]; then
  API_URL="http://127.0.0.1:6019"
fi
echo "=== Building frontend (NEXT_PUBLIC_API_URL=${API_URL}) ==="

docker build \
  -f deployment/docker/Dockerfile.frontend \
  --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
  -t "${FRONTEND_IMAGE}:${BUILD_NUMBER}" \
  -t "${FRONTEND_IMAGE}:latest" \
  .

docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$FRONTEND_CONTAINER" \
  --network "$NETWORK_NAME" \
  --network-alias frontend \
  --restart unless-stopped \
  --env-file "$FRONTEND_ENV_FILE" \
  -p "${FRONTEND_PORT}:3000" \
  "${FRONTEND_IMAGE}:latest"

echo "=== Waiting for frontend :${FRONTEND_PORT} ==="
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null; then
    echo "Frontend smoke OK"
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo "Frontend smoke failed"
    docker logs --tail 200 "$FRONTEND_CONTAINER" || true
    exit 1
  fi
  sleep 2
done

echo "=== Fullstack deploy complete — FE :${FRONTEND_PORT} BE :${BACKEND_PORT} DB:db@${NETWORK_NAME} ==="
'''
        }
      }
    }
  }

  post {
    always {
      sh '''
        docker run --rm -v "$PWD":/w -w /w alpine:3.20 \
          chown -R "$(id -u):$(id -g)" /w 2>/dev/null || true
      '''
      script {
        try {
          cleanWs(deleteDirs: true, disableDeferredWipeout: true, notFailBuild: true)
        } catch (err) {
          echo "post cleanWs skipped: ${err}"
          sh 'find . -mindepth 1 -maxdepth 1 -exec rm -rf {} + || true'
        }
      }
    }
    failure {
      echo 'Fullstack pipeline failed. Check Build & Deploy Fullstack logs.'
    }
    success {
      echo "Fullstack OK — ${env.BRANCH_NAME} @ ${env.GIT_SHORT_SHA} — FE :${env.FRONTEND_PORT} BE :${env.BACKEND_PORT}"
    }
  }
}
