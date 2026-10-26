#!/bin/sh
# Waits until the deployed stack answers: the web app on its published port, and each
# backend's /health from inside the compose network (they publish no ports). Exits 1 with
# the failing services' last logs after 2 minutes. Runs on the Pi at the end of deploy-pi
# (POST_DEPLOY in .deploy.env), from the repo root.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
compose() { docker compose --env-file "$root/.env" -f "$root/docker/docker-compose.yml" "$@"; }
version=$(cat "$root/VERSION" 2>/dev/null || echo dev)

web_port=$(sed -n 's/^WEB_PORT=//p' "$root/.env" 2>/dev/null)
web_port=${web_port:-8080}

failed=
check() {
  failed=
  curl -fs -o /dev/null "http://localhost:$web_port/" || failed="$failed web"
  for target in gateway:3000 auth-service:3001 core-service:3002; do
    compose exec -T web wget -qO /dev/null "http://$target/health" 2>/dev/null \
      || failed="$failed ${target%%:*}"
  done
  [ -z "$failed" ]
}

echo "Waiting for v$version to come up..."
deadline=$(($(date +%s) + 120))
until check; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "v$version FAILED: no response from:$failed" >&2
    compose ps >&2
    for service in $failed; do
      echo "--- last logs of $service" >&2
      compose logs --tail 20 "$service" >&2
    done
    exit 1
  fi
  sleep 3
done
echo "v$version is up: web and all backend services are healthy."
