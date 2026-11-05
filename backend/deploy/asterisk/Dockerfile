# Asterisk for Dakly's AI voice calls over a SIP trunk (IPCallBD in Bangladesh).
# All settings come from environment variables; entrypoint.sh writes the config at start.
ARG BASE=alpine:3.22
FROM ${BASE}
RUN apk add --no-cache asterisk asterisk-curl tini \
 && rm -rf /etc/asterisk/* \
 && mkdir -p /var/spool/asterisk /var/lib/asterisk /var/log/asterisk /var/run/asterisk \
 && chown -R asterisk:asterisk /etc/asterisk /var/spool/asterisk /var/lib/asterisk /var/log/asterisk /var/run/asterisk
COPY extensions.conf /usr/share/dakly/extensions.conf
COPY entrypoint.sh /usr/local/bin/dakly-asterisk
RUN chmod 755 /usr/local/bin/dakly-asterisk
EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD asterisk -rx "core show uptime" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/dakly-asterisk"]
