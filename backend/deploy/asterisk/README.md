# AI voice calls in Bangladesh over IPCallBD

Dakly's AI calls to Bangladesh numbers go through a small Asterisk container on your own server.
Asterisk connects to IPCallBD (a BTRC-licensed IPTSP) over a SIP trunk. Calls to every other
country still go through Twilio, and a shop that enters its own Twilio account in Settings keeps
using it.

```
Dakly app ──ARI (inside Docker)──▶ Asterisk ──SIP + RTP (UDP)──▶ IPCallBD ──▶ customer's phone
    ▲                                  │
    └── speech files + call results ───┘   http://app:3000 inside Docker
```

What happens on a call:

1. Dakly makes the speech for the message with OpenAI (raw 24 kHz audio, `.sln24`), then asks
   Asterisk over ARI to call the number. At most `SIP_MAX_CALLS` calls run at once; the rest wait
   for the next round.
2. Asterisk dials through IPCallBD with your caller ID (`SIP_CALLER_ID`).
3. When the customer answers, Asterisk plays the message and waits `SIP_KEY_WAIT_SECONDS` for a key.
   Pressing 1 plays "thank you" and marks them **interested**. No key plays "goodbye" and marks
   the call **delivered**. Busy, no answer and network failures are marked **failed** with the reason.
4. Asterisk reports each step to `/api/webhooks/asterisk` with a signature only Dakly can make.

The dialplan is in `extensions.conf`; everything else is written from environment variables by
`entrypoint.sh` when the container starts.

## Ask IPCallBD before you start

Send them these questions and keep the answers. The ones marked ★ decide whether this works at all.

1. ★ **SIP trunk for an application.** Can we connect our own Asterisk server to your SIP trunk for
   outbound calls to all Bangladesh operators (GP, Robi, Banglalink, Teletalk, landlines)? Is that
   part of the ৳250/month bulk voice package or a different plan?
2. ★ **Key presses (DTMF).** Our calls ask the customer to press 1. Do you pass DTMF from the
   customer's phone back to us, and how: RFC 2833 / RFC 4733 (preferred), SIP INFO, or in-band?
3. ★ **Login details.** SIP server address and port, transport (UDP, TCP or TLS), SIP username,
   auth username (if different) and password. Do we **register**, or do you authenticate us by IP?
4. ★ **IP allowlist.** Do you need our server's public IP on an allowlist? Must it be a static IP?
   (Check with your ISP whether your server's public IP is static.)
5. **Caller ID.** Which number will customers see (your 09612/096xx number)? Can we set it per call?
6. **Number format.** How should we send the dialled number: `8801711234567`, `01711234567` or
   `+8801711234567`?
7. **Codecs.** Which ones do you support? We default to G.711 A-law then µ-law. Do you need G.729?
8. **Call limits.** How many calls can run at the same time (channels), and how many new calls per
   second?
9. **NAT.** Our server is behind a router (NAT). Do you support symmetric RTP / NAT traversal?
   Which IP addresses and ports do you send voice (RTP) from, for our firewall?
10. **Price and billing.** Rate per minute to mobiles and landlines, billing pulse (per second?),
    VAT, and whether unanswered or busy calls cost anything.
11. **Rules for automated calls.** Any BTRC or IPCallBD rules for promotional/automated calls: allowed
    hours, a do-not-call list, content approval, or a registration we must do first?
12. **Test credit** for a few test calls, and where we can see call records and balance.

Then map the answers to `.env`:

| Answer | `.env` line |
|---|---|
| SIP server, port | `SIP_TRUNK_HOST`, `SIP_TRUNK_PORT` |
| Username, password | `SIP_TRUNK_USER`, `SIP_TRUNK_PASS` (and `SIP_AUTH_USER` if the auth name differs) |
| Register or IP auth | `SIP_REGISTER=yes` or `no` |
| Transport | `SIP_TRANSPORT=udp` (or `tcp`) |
| Caller ID | `SIP_CALLER_ID` (the From user defaults to it; override with `SIP_FROM_USER`) |
| Number format | `SIP_NUMBER_FORMAT=intl`, `local` or `e164` |
| Codecs | `SIP_CODECS=alaw,ulaw` (comma list, best first) |
| DTMF | `SIP_DTMF_MODE=rfc4733`, `info`, `inband` or `auto` |
| Channels | `SIP_MAX_CALLS` |

## Deploy on the Dakly server

These steps are for the shared production server (`/home/what/server/apps/dakly`). They add one
container and change nothing else. Do not run `docker compose down -v` or `git reset --hard`, and
keep `backend/.env` and the database volume as they are.

**1. Router and network.** The Cloudflare Tunnel only carries web traffic, not phone calls. Calls
use UDP straight from the server:

- Outgoing: the server must reach IPCallBD on UDP 5060 (or their port) and their RTP ports. Home
  routers allow this by default.
- Incoming voice: forward **UDP 10000-10099** on the router to the server (192.168.68.113), so the
  customer's voice reaches Asterisk. If IPCallBD authenticates by IP or sends calls to you, also
  forward **UDP 5060**.
- If IPCallBD needs an allowlisted static IP and your ISP gives a dynamic one, ask the ISP for a
  static IP first.

**2. Get the new code** onto the server the same way as other Dakly updates.

**3. Add the settings.** Append these lines to `backend/.env` with your values (keep everything
already there):

```sh
ASTERISK_ARI_URL="http://asterisk:8088"
ASTERISK_ARI_USER="dakly"
ASTERISK_ARI_PASSWORD="<openssl rand -hex 24>"
SIP_COUNTRIES="BD"
SIP_NUMBER_FORMAT="intl"
SIP_MAX_CALLS="5"
SIP_TRUNK_HOST="<from IPCallBD>"
SIP_TRUNK_PORT="5060"
SIP_TRUNK_USER="<from IPCallBD>"
SIP_TRUNK_PASS="<from IPCallBD>"
SIP_CALLER_ID="<your IPCallBD number>"
SIP_REGISTER="yes"
SIP_CODECS="alaw,ulaw"
SIP_DTMF_MODE="rfc4733"
ASTERISK_PUBLIC_IP="<your public IP, optional: set it if calls connect with no sound>"
```

`DAKLY_INTERNAL_URL` defaults to `http://app:3000`. If the Dakly service in `compose.server.yml`
is not called `app`, set `DAKLY_INTERNAL_URL="http://<that service name>:3000"`.

**4. Start Asterisk** (from `backend/`):

```sh
docker compose -f compose.server.yml -f compose.asterisk.yml up -d --build asterisk
docker compose -f compose.server.yml -f compose.asterisk.yml exec asterisk asterisk -rx "pjsip show registrations"
```

The second command should show `trunk/sip:...  Registered`. With `SIP_REGISTER=no` there is no
registration; check `pjsip show endpoints` shows `trunk` as `Avail` or `Not in use`.

**5. Restart Dakly** so it reads the new `.env` and applies the small database change for
"Call us on WhatsApp": `bash deploy-server.sh`. If `deploy-server.sh` runs `docker compose` with
`--remove-orphans`, add `-f compose.asterisk.yml` to its compose command, or it will stop Asterisk.

**6. Test with your own phone.** Make a sound-only test first, then a real Dakly call:

```sh
# Rings your phone and echoes back what you say: checks the line and audio both ways
docker compose -f compose.server.yml -f compose.asterisk.yml exec asterisk \
  asterisk -rx "channel originate PJSIP/8801XXXXXXXXX@trunk application Echo"
```

Then, in a shop on the Growth plan, add yourself as a customer and send a one-person AI Call
campaign. You should hear the message, press 1, hear "thank you", and see **Interested** on the
campaign. Watch the call with
`docker compose -f compose.server.yml -f compose.asterisk.yml logs -f asterisk`.

**7. Set the cost estimate** for the admin Usage page: `COST_VOICE_BDT` is the cost of one call.
A 30-second call over IPCallBD is about ৳0.25 plus the OpenAI speech, so about ৳1.5 is a fair
start (it was ৳12 for Twilio).

## Problems

| What you see | What to check |
|---|---|
| Not `Registered` | Host, port, username and password; `SIP_TRANSPORT`; IP allowlist at IPCallBD |
| Calls fail with "trunk unavailable" | Registration, or IPCallBD rejected the call: run `pjsip set logger on` in `asterisk -r` and look at the reply code (403 wrong caller ID or no credit, 404 number format) |
| Phone rings, no sound | Forward UDP 10000-10099 to the server and set `ASTERISK_PUBLIC_IP`; check `SIP_CODECS` |
| Customer hears the message but pressing 1 does nothing | `SIP_DTMF_MODE`: try `auto`, then `info` or `inband`, per IPCallBD's answer |
| Customer hears silence for a second first | Normal: Dakly makes the speech before dialling, so this is only network delay |

## Turn it off

Remove `ASTERISK_ARI_URL` from `.env` and restart Dakly: Bangladesh calls go back to Twilio (or
test mode). Then stop the container with
`docker compose -f compose.server.yml -f compose.asterisk.yml stop asterisk`.

## Test without IPCallBD

`sh test/voice-sip.sh` runs the real Dakly app and this Asterisk image against a fake IPCallBD
(another Asterisk, `test/asterisk/fake-ipcallbd.sh`) that needs a password, answers and presses 1,
answers and stays quiet, is busy, or never answers, and records what it hears.
