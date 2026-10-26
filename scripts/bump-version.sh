#!/bin/sh
# Bumps the repo-root VERSION (shown in the web app's top bar) by one patch step.
# Each part runs 0-99 and carries into the next: 1.0.99 -> 1.1.0, 1.99.99 -> 2.0.0.
# No VERSION file yet -> 1.0.0. Run by deploy-pi on the Mac before every deploy
# (PRE_DEPLOY in .deploy.env), so each deploy shows a new version.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
file="$root/VERSION"

if [ -f "$file" ]; then
  current=$(tr -d '[:space:]' < "$file")
  if ! echo "$current" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "VERSION must look like 1.2.3, got \"$current\"" >&2
    exit 1
  fi
  IFS=. read -r major minor patch <<VERSION_EOF
$current
VERSION_EOF
  patch=$((patch + 1))
  if [ "$patch" -gt 99 ]; then patch=0; minor=$((minor + 1)); fi
  if [ "$minor" -gt 99 ]; then minor=0; major=$((major + 1)); fi
  next="$major.$minor.$patch"
else
  next=1.0.0
fi

echo "$next" > "$file"
echo "Version $next"
