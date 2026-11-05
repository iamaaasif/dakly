#!/bin/sh
# A stand-in for IPCallBD's SIP server, used only by the voice tests. Runs in the same Asterisk
# image as Dakly's. It wants digest auth (user dakly / FAKE_PASS), accepts registration, and
# plays "customers" by the number dialed:
#   8801700000001  answers, listens 4 s, presses 1     (interested)
#   8801700000002  answers, presses nothing             (delivered)
#   8801700000003  busy                                 (failed)
#   8801700000004  rings and never answers              (failed)
# Any source address is the "dakly" account, but every call still needs the password.
# Every answered call is recorded to /rec/<number>.wav so the test can check speech arrived.
set -e
C=/etc/asterisk
PORT=${FAKE_PORT:-5070}
cat > $C/asterisk.conf <<A
[directories]
astmoddir => /usr/lib/asterisk/modules
astrundir => /var/run/asterisk-fake
astvarlibdir => /var/lib/asterisk
astspooldir => /var/spool/asterisk
astlogdir => /var/log/asterisk
astdbdir => /tmp
[options]
nofork = yes
A
mkdir -p /var/run/asterisk-fake /rec
cat > $C/modules.conf <<'A'
[modules]
autoload = yes
noload = chan_iax2.so
noload = chan_sip.so
noload = res_ari.so
noload = res_http_websocket.so
noload = res_prometheus.so
noload = res_xmpp.so
noload = chan_motif.so
A
printf '[general]\nenabled = no\n' > $C/http.conf
printf '[general]\nrtpstart = 20000\nrtpend = 20099\n' > $C/rtp.conf
printf '[general]\n[logfiles]\nconsole => notice,warning,error,verbose(3)\n' > $C/logger.conf
cat > $C/pjsip.conf <<A
[global]
type = global
endpoint_identifier_order = ip,username
[udp]
type = transport
protocol = udp
bind = 0.0.0.0:${PORT}
[dakly-auth]
type = auth
auth_type = userpass
username = dakly
password = ${FAKE_PASS:-fake-pass}
[dakly]
type = aor
max_contacts = 2
remove_existing = yes
[dakly]
type = endpoint
context = carrier
disallow = all
allow = alaw
dtmf_mode = rfc4733
auth = dakly-auth
aors = dakly
[dakly]
type = identify
endpoint = dakly
match = 0.0.0.0/0
A
cat > $C/extensions.conf <<'A'
[carrier]
exten => 8801700000001,1,Answer()
 same => n,MixMonitor(/rec/${EXTEN}.wav)
 same => n,Wait(4)
 same => n,SendDTMF(1,250)
 same => n,Wait(8)
 same => n,Hangup()
exten => 8801700000002,1,Answer()
 same => n,MixMonitor(/rec/${EXTEN}.wav)
 same => n,Wait(30)
 same => n,Hangup()
exten => 8801700000003,1,Busy(5)
exten => 8801700000004,1,Ringing()
 same => n,Wait(120)
exten => _X.,1,Congestion(5)
A
exec asterisk -f -vvv
