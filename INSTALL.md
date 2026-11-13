# Installation and configuration

## 1. Requirements

- RHEL / AlmaLinux / Rocky 9 or 10, Debian or Ubuntu, with systemd
- Java 21 (installed by the installer if missing)
- Network access to the Zabbix frontend
- A free TCP port (default 8081)
- `root` (sudo)

## 2. Install

```bash
chmod +x zabbix-portal-1.0.0-install.sh
sudo ./zabbix-portal-1.0.0-install.sh
```

Two questions: Zabbix URL, portal port.

Without questions:

```bash
sudo ./zabbix-portal-1.0.0-install.sh --zabbix-url http://zabbix.example.com/zabbix --yes
```

The installer: installs Java, tests the Zabbix API, creates user `zbxportal`, writes
`/etc/zabbix-portal/portal.env`, installs and starts the service, opens the port in firewalld,
verifies the portal answers, prints the address.

Open the printed address. Sign in with a Zabbix account.

## 3. Zabbix prerequisites

Per person using the portal, in Zabbix:

1. **Users → Users**: a user, type **Admin** (not User, not Super admin).
2. **Users → User groups**: host group permissions — read-write on the host groups they may change.
3. **Users → User roles → API**: method list must allow:

```
host.get, host.update, hostgroup.get, template.get, template.update,
item.get, item.update, trigger.get, trigger.update,
httptest.get, httptest.update, problem.get,
usermacro.get, usermacro.update, usermacro.delete,
user.get, settings.get
```

An empty API list blocks everything in Zabbix 8.0.

Templates edited in the portal apply to every host linked to them. Give each team its own copy
of any template it may edit.

## 4. Settings

File: `/etc/zabbix-portal/portal.env`. After any change:

```bash
sudo systemctl restart zabbix-portal
```

| Setting | Default | Meaning |
|---|---|---|
| `ZABBIX_URL` | required | Zabbix frontend or API URL |
| `ZABBIX_CA_FILE` | empty | PEM of the CA signing the Zabbix certificate |
| `ZABBIX_INSECURE_SSL` | `false` | Skip certificate checks (testing only) |
| `SERVER_PORT` | `8081` | Portal port |
| `SERVER_ADDRESS` | `0.0.0.0` | `127.0.0.1` when behind Apache/nginx |
| `PORTAL_SECURE_COOKIE` | `false` | `true` when users reach the portal over HTTPS |
| `PORTAL_APP_TAG` | empty | Host tag naming the application |
| `PORTAL_ALLOWED_GROUPS` | empty | Zabbix user groups allowed to sign in |
| `PORTAL_SESSION_TIMEOUT` | `30m` | Sign out after inactivity |
| `PORTAL_LOGIN_MAX_FAILURES` / `PORTAL_LOGIN_WINDOW` | `10` / `15m` | Block an IP after failed sign-ins |
| `PORTAL_TITLE`, `PORTAL_LOGO_FILE`, `PORTAL_PRIMARY_COLOR`, `PORTAL_ACCENT_COLOR` | built in | Override name, logo, colours |

## 5. HTTPS: portal to Zabbix

Public CA certificate on Zabbix:

```bash
sudo sed -i 's|^ZABBIX_URL=.*|ZABBIX_URL=https://zabbix.example.com/zabbix|' /etc/zabbix-portal/portal.env
sudo systemctl restart zabbix-portal
```

Company CA or self-signed certificate on Zabbix:

```bash
sudo cp /path/to/ca.pem /etc/zabbix-portal/zabbix-ca.pem
sudo chown root:zbxportal /etc/zabbix-portal/zabbix-ca.pem
sudo chmod 640 /etc/zabbix-portal/zabbix-ca.pem
sudo sed -i 's|^ZABBIX_CA_FILE=.*|ZABBIX_CA_FILE=/etc/zabbix-portal/zabbix-ca.pem|' /etc/zabbix-portal/portal.env
sudo systemctl restart zabbix-portal
```

Verify:

```bash
curl -s localhost:8081/api/info            # {"reachable":true}
journalctl -u zabbix-portal | grep "Zabbix API"
```

Keep `ZABBIX_INSECURE_SSL=false`.

## 6. HTTPS: users to the portal

### 6.1 Apache

```bash
sudo dnf install -y httpd mod_ssl
sudo setsebool -P httpd_can_network_connect 1
sudo systemctl enable --now httpd
```

### 6.2 Certificate — with a DNS name

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-apache
sudo cp deploy/apache/zabbix-portal-domain.conf /etc/httpd/conf.d/zabbix-portal.conf
sudo sed -i 's/portal.example.com/YOUR.DOMAIN/' /etc/httpd/conf.d/zabbix-portal.conf
sudo certbot --apache -d YOUR.DOMAIN --redirect
```

### 6.2 Certificate — IP only, self-signed

```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout /etc/pki/tls/private/zabbix-portal.key \
  -out /etc/pki/tls/certs/zabbix-portal.crt \
  -subj "/CN=YOUR.SERVER.IP" -addext "subjectAltName=IP:YOUR.SERVER.IP"
sudo chmod 600 /etc/pki/tls/private/zabbix-portal.key
sudo cp deploy/apache/zabbix-portal-ip.conf /etc/httpd/conf.d/zabbix-portal.conf
sudo sed -i 's/YOUR.SERVER.IP/<your ip>/g' /etc/httpd/conf.d/zabbix-portal.conf
```

### 6.3 Put the portal behind Apache

```bash
sudo ./zabbix-portal-1.0.0-install.sh --zabbix-url <same URL as before> \
     --listen 127.0.0.1 --https true --yes
```

### 6.4 Apply and open the firewall

```bash
sudo apachectl configtest
sudo systemctl restart httpd
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --remove-port=8081/tcp
sudo firewall-cmd --reload
```

### 6.5 Verify

```bash
curl -kI https://YOUR.DOMAIN/              # portal
curl -kI https://YOUR.DOMAIN/zabbix/       # Zabbix, same Apache
ss -ltnp | grep 8081                       # must show 127.0.0.1:8081 only
```

## 7. Service

```bash
sudo systemctl status zabbix-portal
sudo systemctl restart zabbix-portal
sudo systemctl stop zabbix-portal
journalctl -u zabbix-portal -f
journalctl -u zabbix-portal | grep -iE "Zabbix API|Host health"
```

Paths:

```
/opt/zabbix-portal/portal.jar          application
/etc/zabbix-portal/portal.env          settings
/etc/systemd/system/zabbix-portal.service
```

## 8. Upgrade

```bash
sudo ./zabbix-portal-<new version>-install.sh --yes
```

Keeps the existing settings, backs up `portal.env`, keeps the previous jar as
`/opt/zabbix-portal/portal.jar.previous`.

Roll back:

```bash
sudo cp /opt/zabbix-portal/portal.jar.previous /opt/zabbix-portal/portal.jar
sudo systemctl restart zabbix-portal
```

## 9. Uninstall

```bash
sudo systemctl disable --now zabbix-portal
sudo rm -f /etc/systemd/system/zabbix-portal.service
sudo systemctl daemon-reload
sudo rm -rf /opt/zabbix-portal /etc/zabbix-portal
sudo userdel zbxportal
sudo firewall-cmd --permanent --remove-port=8081/tcp && sudo firewall-cmd --reload
```

## 10. If something fails

| Symptom | Action |
|---|---|
| `wrong version number` during install | Zabbix is on plain HTTP: use `http://` in `--zabbix-url` |
| `{"reachable":false}` | `journalctl -u zabbix-portal \| grep "Zabbix API"`; check `ZABBIX_URL`, `ZABBIX_CA_FILE`, firewall |
| Sign-in fails for a valid Zabbix user | User role → API access, and `PORTAL_ALLOWED_GROUPS` |
| Health column says "Unknown" | Add `problem.get` and `trigger.get` to the user role's API list |
| Apache returns 503 | `sudo setsebool -P httpd_can_network_connect 1`; check the portal is on 127.0.0.1:8081 |
| Port already in use | Reinstall with `--port <free port>` |

