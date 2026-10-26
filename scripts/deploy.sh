#!/bin/sh
# Bumps the deploy version, rebuilds the stack and waits until it is healthy (exit 1 if
# not). Run on the Pi from anywhere in the repo:
#   sh scripts/deploy.sh            # whole stack
#   sh scripts/deploy.sh web        # only the listed services (frontend-only change)
# The version lives in the repo-root VERSION file and shows in the web app's top bar.
# Each part runs 0-99 and carries into the next: 1.0.99 -> 1.1.0, 1.99.99 -> 2.0.0.
# The first run (no VERSION file yet) writes 1.0.0. BUMP_ONLY=1 skips the rebuild.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
file="$root/VERSION"

if [ -f "$file" ]; then
  current=$(tr -d '[:space:]' < "$file")
  if ! echo "$current" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "VERSION must look like 1.2.3, got \"$current\"" >&2
    exit 1
  fi
  IFS=. read -r major minor patch <<EOF
$current
EOF
  patch=$((patch + 1))
  if [ "$patch" -gt 99 ]; then patch=0; minor=$((minor + 1)); fi
  if [ "$minor" -gt 99 ]; then minor=0; major=$((major + 1)); fi
  next="$major.$minor.$patch"
else
  next=1.0.0
fi

echo "$next" > "$file"
echo "Deploying v$next"

[ "${BUMP_ONLY:-}" = 1 ] && exit 0
compose() { docker compose --env-file "$root/.env" -f "$root/docker/docker-compose.yml" "$@"; }

# Build one image at a time: on the Pi's microSD, parallel builds that reinstall
# dependencies saturate the disk and can stall for over an hour. Cached builds are quick.
services=${*:-auth-service core-service gateway web}
for service in $services; do
  echo "Building $service..."
  compose build "$service"
done
compose up -d --no-build ${1:+--no-deps} "$@"

# Wait until the whole stack answers: the web app on its published port, and each
# backend's /health from inside the compose network (they publish no ports).
web_port=$(sed -n 's/^WEB_PORT=//p' "$root/.env" 2>/dev/null)
web_port=${web_port:-8080}
check() {
  failed=
  curl -fs -o /dev/null "http://localhost:$web_port/" || failed="$failed web"
  for target in gateway:3000 auth-service:3001 core-service:3002; do
    compose exec -T web wget -qO /dev/null "http://$target/health" 2>/dev/null \
      || failed="$failed ${target%%:*}"
  done
  [ -z "$failed" ]
}

echo "Waiting for the stack to come up..."
deadline=$(($(date +%s) + 120))
until check; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Deploy of v$next FAILED: no response from:$failed" >&2
    compose ps >&2
    for service in $failed; do
      echo "--- last logs of $service" >&2
      compose logs --tail 20 "$service" >&2
    done
    exit 1
  fi
  sleep 3
done
echo "v$next is up: web and all backend services are healthy."
