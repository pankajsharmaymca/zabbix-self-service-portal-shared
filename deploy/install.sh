#!/usr/bin/env bash
# Install (or reconfigure) the Zabbix Self-Service Portal on a server.
#
# Needs only Java 21 on the target server: no Node, no Maven. Run from an
# unpacked release bundle (see deploy/make-release.sh), as root:
#
#   sudo ./install.sh                                   # asks for the Zabbix URL and the port
#   sudo ./install.sh --zabbix-url https://zbx.example.com/zabbix --yes   # no questions
#
# The only required setting is the Zabbix URL; the port defaults to 8081. The name,
# logo and colours are built into the portal, so nothing is asked about them.
# Everything else has a default and can be changed later in
# /etc/zabbix-portal/portal.env (then restart the service).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONF_DIR=/etc/zabbix-portal
ENV_FILE=$CONF_DIR/portal.env
APP_DIR=/opt/zabbix-portal
SERVICE=zabbix-portal
SVC_USER=zbxportal

# ------------------------------------------------------------------ options
ZABBIX_URL=${ZABBIX_URL:-}
PORT=${SERVER_PORT:-}
ADDRESS=${SERVER_ADDRESS:-}
HTTPS=${PORTAL_SECURE_COOKIE:-}
APP_TAG=${PORTAL_APP_TAG:-}
TITLE=${PORTAL_TITLE:-}
LOGO=${PORTAL_LOGO_FILE:-}
PRIMARY=${PORTAL_PRIMARY_COLOR:-}
ACCENT=${PORTAL_ACCENT_COLOR:-}
CA_FILE=${ZABBIX_CA_FILE:-}
ALLOWED_GROUPS=${PORTAL_ALLOWED_GROUPS:-}
ASSUME_YES=false
JAR=""

usage() {
  cat <<EOF
Usage: sudo $0 [options]

  --zabbix-url URL       Zabbix frontend or API URL (required), e.g. https://zabbix.example.com/zabbix
  --port N               Port the portal listens on (default 8081)

Asked for when missing: the Zabbix URL and the port. Everything below has a default
and is only needed when this server differs; it can also be changed later in portal.env.

  --listen ADDR          127.0.0.1 behind Apache/nginx, 0.0.0.0 to open the port directly
  --https true|false     Users reach the portal over HTTPS (secure session cookie)
  --app-tag TAG          Host tag that names the application (e.g. application)
  --title TEXT           Name shown in the header and browser tab
  --logo FILE            Logo (SVG, PNG or JPG, max 1 MB), copied to $CONF_DIR
  --primary-color HEX    e.g. '#16294A'  (buttons, sign-in panel)
  --accent-color HEX     e.g. '#0B7A85'  (links, selection, focus)
  --ca-file FILE         PEM with the CA of the Zabbix HTTPS certificate, copied to $CONF_DIR
  --allowed-groups LIST  Comma-separated Zabbix user groups allowed to sign in (empty = any)
  --jar FILE             Portal JAR to install (default: portal.jar next to this script)
  --yes                  Do not ask questions; use options, environment and defaults
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zabbix-url) ZABBIX_URL=$2; shift 2 ;;
    --port) PORT=$2; shift 2 ;;
    --listen) ADDRESS=$2; shift 2 ;;
    --https) HTTPS=$2; shift 2 ;;
    --app-tag) APP_TAG=$2; shift 2 ;;
    --title) TITLE=$2; shift 2 ;;
    --logo) LOGO=$2; shift 2 ;;
    --primary-color) PRIMARY=$2; shift 2 ;;
    --accent-color) ACCENT=$2; shift 2 ;;
    --ca-file) CA_FILE=$2; shift 2 ;;
    --allowed-groups) ALLOWED_GROUPS=$2; shift 2 ;;
    --jar) JAR=$2; shift 2 ;;
    --yes|-y) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

ask() { # ask VAR "question" default
  local var=$1 q=$2 def=${3:-} ans
  if [[ $ASSUME_YES == true ]]; then printf -v "$var" '%s' "${!var:-$def}"; return; fi
  local cur=${!var:-$def}
  read -r -p "$q${cur:+ [$cur]}: " ans || true
  printf -v "$var" '%s' "${ans:-$cur}"
}

hex_ok() { [[ -z $1 || $1 =~ ^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$ ]]; }

[[ $EUID -eq 0 ]] || die "run as root: sudo $0"

# ------------------------------------------------------------------ JAR
[[ -n $JAR ]] || JAR=$HERE/portal.jar
[[ -f $JAR ]] || JAR=$(ls "$HERE"/../backend/target/zabbix-self-service-portal-*.jar 2>/dev/null | head -1 || true)
[[ -n $JAR && -f $JAR ]] || die "portal.jar not found. Build a bundle with deploy/make-release.sh or pass --jar FILE"

# ------------------------------------------------------------------ Java 21
step "Checking Java"
JAVA_BIN=""
for c in /usr/lib/jvm/java-21*/bin/java /usr/lib/jvm/jre-21*/bin/java "$(command -v java 2>/dev/null || true)"; do
  [[ -x $c ]] || continue
  v=$("$c" -XX:+IgnoreUnrecognizedVMOptions -version 2>&1 | awk -F'"' '/version/ {print $2; exit}')
  if [[ ${v%%.*} -ge 21 ]]; then JAVA_BIN=$(readlink -f "$c"); break; fi
done
if [[ -z $JAVA_BIN ]]; then
  if command -v dnf >/dev/null; then
    echo "Java 21 not found, installing java-21-openjdk-headless"
    dnf install -y java-21-openjdk-headless
  elif command -v apt-get >/dev/null; then
    echo "Java 21 not found, installing openjdk-21-jre-headless"
    apt-get update -q && apt-get install -y openjdk-21-jre-headless
  else
    die "Java 21 is required; install it and run this again"
  fi
  JAVA_BIN=$(readlink -f "$(ls /usr/lib/jvm/*21*/bin/java | head -1)")
fi
echo "Java: $JAVA_BIN"

# ------------------------------------------------------------------ settings
# Re-running on an installed server keeps its current values as defaults.
if [[ -f $ENV_FILE ]]; then
  current() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }
  : "${ZABBIX_URL:=$(current ZABBIX_URL)}"
  : "${PORT:=$(current SERVER_PORT)}"
  : "${ADDRESS:=$(current SERVER_ADDRESS)}"
  : "${HTTPS:=$(current PORTAL_SECURE_COOKIE)}"
  : "${APP_TAG:=$(current PORTAL_APP_TAG)}"
  : "${TITLE:=$(current PORTAL_TITLE)}"
  : "${LOGO:=$(current PORTAL_LOGO_FILE)}"
  : "${PRIMARY:=$(current PORTAL_PRIMARY_COLOR)}"
  : "${ACCENT:=$(current PORTAL_ACCENT_COLOR)}"
  : "${CA_FILE:=$(current ZABBIX_CA_FILE)}"
  : "${ALLOWED_GROUPS:=$(current PORTAL_ALLOWED_GROUPS)}"
  echo "Existing configuration found in $ENV_FILE; its values are the defaults below."
fi

step "Settings"
echo "Only two answers are needed: where Zabbix is, and which port the portal listens on."
echo "Everything else (name, logo, colours) is built in. Run with --help to see the rest."
echo

while :; do
  ask ZABBIX_URL "Zabbix URL (frontend or api_jsonrpc.php)" "http://localhost/zabbix"
  [[ -n $ZABBIX_URL ]] && break
  [[ $ASSUME_YES == true ]] && die "--zabbix-url is required"
done
API_URL=$ZABBIX_URL
[[ $API_URL == *api_jsonrpc.php ]] || API_URL="${API_URL%/}/api_jsonrpc.php"

# Check the Zabbix API answers before going further
CURL_TLS=()
[[ -n $CA_FILE ]] && CURL_TLS=(--cacert "$CA_FILE")
if out=$(curl -sS -m 10 ${CURL_TLS[@]+"${CURL_TLS[@]}"} -H 'Content-Type: application/json-rpc' \
    -d '{"jsonrpc":"2.0","method":"apiinfo.version","params":[],"id":1}' "$API_URL" 2>&1) \
    && [[ $out == *'"result"'* ]]; then
  echo "Zabbix API OK at $API_URL (version $(sed -E 's/.*"result" *: *"([^"]+)".*/\1/' <<<"$out"))"
else
  echo "WARNING: no Zabbix API answer at $API_URL"
  echo "         $out" | head -3
  if [[ $out == *"certificate"* && -z $CA_FILE ]]; then
    echo "         For a company or self-signed certificate, run again with --ca-file /path/to/ca.pem"
  fi
  if [[ $ASSUME_YES != true ]]; then
    read -r -p "Continue anyway? [y/N]: " yn || true
    [[ $yn =~ ^[Yy] ]] || die "stopped; check the URL (it usually ends in /zabbix or /zabbix/api_jsonrpc.php)"
  fi
fi

ask PORT "Portal port" "8081"
[[ $PORT =~ ^[0-9]+$ && $PORT -ge 1 && $PORT -le 65535 ]] || die "port must be a number between 1 and 65535"

# Not asked: sensible defaults, each one still settable with an option or in portal.env
ADDRESS=${ADDRESS:-0.0.0.0}
if [[ -z $HTTPS ]]; then
  if [[ $ADDRESS == 127.0.0.1 ]]; then HTTPS=true; else HTTPS=false; fi
fi
[[ $HTTPS == true || $HTTPS == false ]] || die "--https takes true or false"
hex_ok "$PRIMARY" || die "primary colour must look like #16294A"
hex_ok "$ACCENT" || die "accent colour must look like #0B7A85"

# ------------------------------------------------------------------ install
step "Service user and folders"
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin "$SVC_USER"
install -d -o root -g "$SVC_USER" -m 750 "$CONF_DIR"
install -d -o root -g root -m 755 "$APP_DIR"

# Logo / CA are copied into the config folder: the service cannot read /home or /root.
copy_in() { # copy_in SRC NAME -> prints destination
  local src=$1 name=$2
  [[ -z $src ]] && return 0
  if [[ $(readlink -f "$src") == $CONF_DIR/* ]]; then echo "$src"; return 0; fi
  [[ -f $src ]] || die "file not found: $src"
  install -o root -g "$SVC_USER" -m 640 "$src" "$CONF_DIR/$name"
  echo "$CONF_DIR/$name"
}
if [[ -n $LOGO ]]; then
  ext=${LOGO##*.}; ext=${ext,,}
  [[ $ext =~ ^(svg|png|jpg|jpeg)$ ]] || die "logo must be .svg, .png or .jpg"
  [[ $(stat -c %s "$LOGO") -le 1048576 ]] || die "logo is larger than 1 MB"
  LOGO=$(copy_in "$LOGO" "logo.$ext")
fi
[[ -n $CA_FILE ]] && CA_FILE=$(copy_in "$CA_FILE" "zabbix-ca.pem")

step "Writing $ENV_FILE"
[[ -f $ENV_FILE ]] && cp -p "$ENV_FILE" "$ENV_FILE.$(date +%Y%m%d%H%M%S).bak"
umask 027
cat > "$ENV_FILE" <<EOF
# Zabbix Self-Service Portal configuration. Edit, then: sudo systemctl restart $SERVICE
# Written by install.sh on $(date -Iseconds)

# --- Zabbix (the only required setting) ---
ZABBIX_URL=$ZABBIX_URL
ZABBIX_CA_FILE=$CA_FILE
ZABBIX_INSECURE_SSL=false

# --- Network ---
SERVER_ADDRESS=$ADDRESS
SERVER_PORT=$PORT
PORTAL_SECURE_COOKIE=$HTTPS
PORTAL_CORS_ORIGINS=

# --- Look ---
# Empty means the name, logo and colours built into the portal are used.
# Set these only to override them on this server.
PORTAL_TITLE=$TITLE
PORTAL_LOGO_FILE=$LOGO
PORTAL_PRIMARY_COLOR=$PRIMARY
PORTAL_ACCENT_COLOR=$ACCENT

# Host tag that names the application (optional); the search also matches it
PORTAL_APP_TAG=$APP_TAG

# --- Access ---
PORTAL_ALLOWED_GROUPS=$ALLOWED_GROUPS
PORTAL_SESSION_TIMEOUT=30m
PORTAL_LOGIN_MAX_FAILURES=10
PORTAL_LOGIN_WINDOW=15m
EOF
chown root:"$SVC_USER" "$ENV_FILE"; chmod 640 "$ENV_FILE"

step "Installing the portal"
[[ -f $APP_DIR/portal.jar ]] && cp -p "$APP_DIR/portal.jar" "$APP_DIR/portal.jar.previous"
install -o root -g root -m 644 "$JAR" "$APP_DIR/portal.jar"

UNIT_SRC=$HERE/zabbix-portal.service
[[ -f $UNIT_SRC ]] || UNIT_SRC=$HERE/deploy/zabbix-portal.service
[[ -f $UNIT_SRC ]] || die "zabbix-portal.service not found next to install.sh"
sed -e "s#^ExecStart=.*#ExecStart=$JAVA_BIN -Xmx256m -jar $APP_DIR/portal.jar#" \
    -e "s#^User=.*#User=$SVC_USER#" -e "s#^Group=.*#Group=$SVC_USER#" \
    "$UNIT_SRC" > /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"

if [[ $ADDRESS != 127.0.0.1 ]]; then
  if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd -q --permanent --add-port="$PORT/tcp" && firewall-cmd -q --reload && echo "Firewall: opened $PORT/tcp"
  fi
fi

step "Checking the portal"
for _ in $(seq 1 45); do
  if out=$(curl -fs "http://127.0.0.1:$PORT/api/info" 2>/dev/null); then
    echo "Portal is running on port $PORT. $out"
    [[ $out == *'"reachable":true'* ]] || echo "WARNING: the portal cannot reach Zabbix; see: journalctl -u $SERVICE | grep 'Zabbix API'"
    echo
    if [[ $ADDRESS == 127.0.0.1 ]]; then
      echo "Listening on 127.0.0.1:$PORT; point your Apache/nginx proxy at it (see the apache/ folder)."
    else
      echo "Open: http://$(hostname -f 2>/dev/null || hostname):$PORT/"
    fi
    echo "Settings: $ENV_FILE   (after a change: systemctl restart $SERVICE)"
    exit 0
  fi
  sleep 2
done
echo "The portal did not start. Last log lines:" >&2
journalctl -u "$SERVICE" -n 40 --no-pager >&2
exit 1
