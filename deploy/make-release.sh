#!/usr/bin/env bash
# Build the portal and pack it for someone else to install.
#
#   ./deploy/make-release.sh
#
# produces two files, both holding no settings of your own:
#
#   zabbix-portal-<version>.tar.gz          unpack, then run ./install.sh
#   zabbix-portal-<version>-install.sh      one file: run it, nothing to unpack
#
# The single file is the one to hand to someone who should not have to think
# about it. On a RHEL/AlmaLinux/Rocky 9 or 10 server:
#
#   sudo ./zabbix-portal-<version>-install.sh --zabbix-url https://zabbix.example.com/zabbix --yes
#
# It installs Java if the server has none, creates the service user, writes
# /etc/zabbix-portal/portal.env, installs and starts the systemd service, opens
# the port in firewalld, and checks the portal answers.
#
# Options:
#   --jar FILE   pack this JAR instead of building one (no Node or Maven needed)
#   --skip-build same as --jar with the JAR already in backend/target
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR=""
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --jar) JAR=$2; SKIP_BUILD=true; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

VERSION=$(sed -n 's:.*<version>\(.*\)</version>.*:\1:p' "$ROOT/backend/pom.xml" | sed -n 2p)
VERSION=${VERSION:-1.0.0}
NAME=zabbix-portal-$VERSION
TARBALL="$ROOT/$NAME.tar.gz"
ONEFILE="$ROOT/$NAME-install.sh"

[[ $EUID -ne 0 ]] || { echo "Run as a normal user, not root." >&2; exit 1; }

if [[ $SKIP_BUILD != true ]]; then
  if [[ ! -f "$ROOT/frontend/public/logo.svg" ]]; then
    echo "NOTE: frontend/public/logo.svg is missing, so the portal will show its plain icon."
    echo "      Put the official logo there and build again to have it inside the JAR."
  fi
  echo "==> Building frontend"
  cd "$ROOT/frontend"
  npm ci --no-audit --no-fund
  npm run build:spring

  echo "==> Building backend"
  cd "$ROOT/backend"
  mvn -q clean package -DskipTests
fi
[[ -n $JAR ]] || JAR=$(ls "$ROOT"/backend/target/zabbix-self-service-portal-*.jar 2>/dev/null | grep -v original | head -1 || true)
[[ -n $JAR && -f $JAR ]] || { echo "No JAR found; build first or pass --jar FILE" >&2; exit 1; }
if command -v unzip >/dev/null; then
  unzip -l "$JAR" | grep -q 'static/index.html' || echo "WARNING: this JAR has no web pages in it (frontend not built in)." >&2
  unzip -l "$JAR" | grep -q 'static/logo' && echo "The logo is inside the JAR, so no server needs to be told about it."
fi

echo "==> Packing $TARBALL"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/$NAME"
cp "$JAR" "$STAGE/$NAME/portal.jar"
cp "$ROOT/deploy/install.sh" "$ROOT/deploy/zabbix-portal.service" "$ROOT/deploy/portal.env.example" "$STAGE/$NAME/"
cp -r "$ROOT/deploy/apache" "$STAGE/$NAME/apache"
cp "$ROOT/README.md" "$ROOT/SECURITY.md" "$STAGE/$NAME/"
chmod +x "$STAGE/$NAME/install.sh"
tar -C "$STAGE" -czf "$TARBALL" "$NAME"

echo "==> Packing $ONEFILE"
# A shell header followed by the same tarball: running the file unpacks it to a
# temporary folder and runs install.sh there with whatever arguments were given.
cat > "$ONEFILE" <<HEADER
#!/usr/bin/env bash
# Zabbix Self-Service Portal $VERSION - installer.
#
#   sudo ./$(basename "$ONEFILE")                                              asks for the Zabbix URL and the port
#   sudo ./$(basename "$ONEFILE") --zabbix-url https://zabbix.example.com/zabbix --yes
#
# Needs a systemd Linux server (RHEL, AlmaLinux, Rocky 9/10, or Debian/Ubuntu)
# and network access to your Zabbix frontend. Java 21 is installed if missing.
set -euo pipefail

if [[ \${EUID:-\$(id -u)} -ne 0 ]]; then
  echo "Run this with sudo: sudo \$0 \$*" >&2
  exit 1
fi

WORK=\$(mktemp -d)
cleanup() { rm -rf "\$WORK"; }
trap cleanup EXIT

LINE=\$(awk '/^__PORTAL_ARCHIVE__\$/ { print NR + 1; exit 0; }' "\$0")
tail -n +"\$LINE" "\$0" | tar xz -C "\$WORK"
exec "\$WORK/$NAME/install.sh" "\$@"
__PORTAL_ARCHIVE__
HEADER
cat "$TARBALL" >> "$ONEFILE"
chmod +x "$ONEFILE"

echo
echo "Hand over one file:  $ONEFILE"
echo "  sudo ./$(basename "$ONEFILE") --zabbix-url https://zabbix.example.com/zabbix --yes"
echo "Or the tarball:      $TARBALL"
