#!/bin/sh
# Writes Asterisk's config from environment variables, then runs Asterisk in the foreground.
# Required: SIP_TRUNK_HOST, SIP_TRUNK_USER, SIP_TRUNK_PASS, ASTERISK_ARI_PASSWORD
# See deploy/asterisk/README.md for every variable.
set -e

need() { eval "v=\${$1:-}"; [ -n "$v" ] || { echo "[asterisk] $1 is not set" >&2; exit 1; }; }
need SIP_TRUNK_HOST; need SIP_TRUNK_USER; need SIP_TRUNK_PASS; need ASTERISK_ARI_PASSWORD

SIP_TRUNK_PORT=${SIP_TRUNK_PORT:-5060}
SIP_AUTH_USER=${SIP_AUTH_USER:-$SIP_TRUNK_USER}
SIP_CALLER_ID=${SIP_CALLER_ID:-$SIP_TRUNK_USER}
SIP_FROM_USER=${SIP_FROM_USER:-$SIP_CALLER_ID}
SIP_FROM_DOMAIN=${SIP_FROM_DOMAIN:-$SIP_TRUNK_HOST}
SIP_REGISTER=${SIP_REGISTER:-yes}
SIP_CODECS=${SIP_CODECS:-alaw,ulaw}
SIP_DTMF_MODE=${SIP_DTMF_MODE:-rfc4733}
SIP_LOCAL_PORT=${SIP_LOCAL_PORT:-5060}
SIP_TRANSPORT=${SIP_TRANSPORT:-udp}
RTP_START=${ASTERISK_RTP_START:-10000}
RTP_END=${ASTERISK_RTP_END:-10099}
DAKLY_URL=${DAKLY_INTERNAL_URL:-http://app:3000}
RING_SECONDS=${SIP_RING_SECONDS:-40}
KEY_WAIT=${SIP_KEY_WAIT_SECONDS:-7}

case "$SIP_REGISTER" in yes|true|1) SIP_REGISTER=yes ;; *) SIP_REGISTER=no ;; esac

C=/etc/asterisk
umask 077

cat > $C/asterisk.conf <<EOF
[directories]
astetcdir => /etc/asterisk
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir => /var/lib/asterisk
astkeydir => /var/lib/asterisk
astdatadir => /var/lib/asterisk
astagidir => /var/lib/asterisk/agi-bin
astspooldir => /var/spool/asterisk
astrundir => /var/run/asterisk
astlogdir => /var/log/asterisk
[options]
runuser = asterisk
rungroup = asterisk
nofork = yes
EOF

cat > $C/modules.conf <<'EOF'
[modules]
autoload = yes
; Not needed for SIP trunk calls; keeps start-up quiet and small.
noload = chan_iax2.so
noload = chan_alsa.so
noload = chan_mgcp.so
noload = chan_skinny.so
noload = chan_unistim.so
noload = chan_dahdi.so
noload = chan_mobile.so
noload = chan_sip.so
noload = cdr_csv.so
noload = cel_custom.so
noload = res_phoneprov.so
noload = res_pjsip_phoneprov_provider.so
noload = pbx_dundi.so
noload = res_config_ldap.so
noload = res_config_pgsql.so
noload = res_config_odbc.so
noload = res_odbc.so
noload = cdr_pgsql.so
noload = cdr_odbc.so
noload = cel_pgsql.so
noload = cel_odbc.so
noload = res_hep.so
noload = res_hep_pjsip.so
noload = res_hep_rtcp.so
noload = res_prometheus.so
noload = res_smdi.so
noload = res_xmpp.so
noload = chan_motif.so
EOF

cat > $C/logger.conf <<'EOF'
[general]
dateformat = %F %T
[logfiles]
console => notice,warning,error,verbose(3)
EOF

cat > $C/http.conf <<'EOF'
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
EOF

cat > $C/ari.conf <<EOF
[general]
enabled = yes
[${ASTERISK_ARI_USER:-dakly}]
type = user
read_only = no
password = ${ASTERISK_ARI_PASSWORD}
EOF

cat > $C/rtp.conf <<EOF
[general]
rtpstart = ${RTP_START}
rtpend = ${RTP_END}
strictrtp = yes
EOF

ext=""
if [ -n "${ASTERISK_PUBLIC_IP:-}" ]; then
  ext="external_media_address = ${ASTERISK_PUBLIC_IP}
external_signaling_address = ${ASTERISK_PUBLIC_IP}"
fi

# Trunk: the provider (IPCallBD) is named "trunk" in the dialplan.
cat > $C/pjsip.conf <<EOF
[global]
type = global
user_agent = Dakly
endpoint_identifier_order = ip,username

[transport-main]
type = transport
protocol = ${SIP_TRANSPORT}
bind = 0.0.0.0:${SIP_LOCAL_PORT}
local_net = 10.0.0.0/8
local_net = 172.16.0.0/12
local_net = 192.168.0.0/16
local_net = 127.0.0.0/8
${ext}

[trunk-auth]
type = auth
auth_type = userpass
username = ${SIP_AUTH_USER}
password = ${SIP_TRUNK_PASS}

[trunk]
type = aor
contact = sip:${SIP_TRUNK_HOST}:${SIP_TRUNK_PORT}
qualify_frequency = 60

[trunk]
type = endpoint
transport = transport-main
context = dakly-inbound
disallow = all
allow = ${SIP_CODECS}
dtmf_mode = ${SIP_DTMF_MODE}
outbound_auth = trunk-auth
aors = trunk
from_user = ${SIP_FROM_USER}
from_domain = ${SIP_FROM_DOMAIN}
direct_media = no
rtp_symmetric = yes
force_rport = yes
rewrite_contact = yes
send_rpid = yes
trust_id_outbound = yes

[trunk]
type = identify
endpoint = trunk
match = ${SIP_TRUNK_HOST}
EOF

if [ "$SIP_REGISTER" = yes ]; then
cat >> $C/pjsip.conf <<EOF

[trunk]
type = registration
transport = transport-main
outbound_auth = trunk-auth
server_uri = sip:${SIP_TRUNK_HOST}:${SIP_TRUNK_PORT}
client_uri = sip:${SIP_TRUNK_USER}@${SIP_TRUNK_HOST}
contact_user = ${SIP_TRUNK_USER}
retry_interval = 60
forbidden_retry_interval = 300
max_retries = 100000
expiration = 300
line = yes
endpoint = trunk
EOF
fi

{
  echo "[general]"
  echo "static = yes"
  echo "writeprotect = yes"
  echo "[globals]"
  echo "DAKLY_URL = ${DAKLY_URL}"
  echo "CALLER_ID = ${SIP_CALLER_ID}"
  echo "RING_SECONDS = ${RING_SECONDS}"
  echo "KEY_WAIT = ${KEY_WAIT}"
  cat /usr/share/dakly/extensions.conf
} > $C/extensions.conf

chown -R asterisk:asterisk $C
echo "[asterisk] trunk ${SIP_TRUNK_HOST}:${SIP_TRUNK_PORT} user ${SIP_TRUNK_USER} register=${SIP_REGISTER} codecs=${SIP_CODECS} dtmf=${SIP_DTMF_MODE} rtp ${RTP_START}-${RTP_END} dakly=${DAKLY_URL}"
exec asterisk -f -U asterisk -G asterisk -vvv
