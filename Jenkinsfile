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
        echo "FE :${env.FRONTEND_PORT}  BE :${env.BACKEND_PORT}  net: ${env.NETWORK_NAME}"
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

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  echo "Missing backend env credential file (ID: vix-leads-backend-env): $BACKEND_ENV_FILE"
  exit 1
fi
if [ ! -f "$FRONTEND_ENV_FILE" ]; then
  echo "Missing frontend env credential file (ID: vix-leads-frontend-env): $FRONTEND_ENV_FILE"
  exit 1
fi

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
  --add-host=host.docker.internal:host-gateway \
  --env-file "$BACKEND_ENV_FILE" \
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
API_URL="$(grep -E '^[[:space:]]*NEXT_PUBLIC_API_URL=' "$FRONTEND_ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\\r' | sed 's/^["'\\'']//;s/["'\\'']$//')"
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

echo "=== Fullstack deploy complete — FE :${FRONTEND_PORT} BE :${BACKEND_PORT} ==="
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
