#!/bin/sh
# Makes a throwaway CA and one certificate for every faked provider host (test only).
set -e
D="$(dirname "$0")/certs"; mkdir -p "$D"; cd "$D"
[ -f server.crt ] && exit 0
HOSTS="api.openai.com graph.facebook.com www.facebook.com api.twilio.com bulksmsbd.net sandbox.sslcommerz.com securepay.sslcommerz.com api.stripe.com checkout.stripe.com teststore.myshopify.com woo.dakly-test.com"
SAN=$(for h in $HOSTS; do printf "DNS:%s," "$h"; done | sed 's/,$//')
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 3650 -subj "/CN=Dakly Test CA" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=dakly-mock" 2>/dev/null
printf "subjectAltName=%s\n" "$SAN" > ext.cnf
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650 -extfile ext.cnf 2>/dev/null
chmod 644 *.key
echo "certs ready in $D"
