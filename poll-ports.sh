#!/bin/sh
# Polls the Docker Engine API over the socket mounted into this container
# for currently published host ports, so the builder can warn about
# conflicts with already-running containers, not just newly selected ones.
#
# Writes a plain JSON file into nginx's document root; the frontend fetches
# it directly as a static file. If the socket isn't mounted (or curl/jq
# fails for any reason), this just keeps trying quietly — the frontend
# treats a missing/unreachable file as "no host-port info available" and
# falls back to today's selected-services-only conflict check.

OUT=/usr/share/nginx/html/live-ports.json
TMP=/tmp/live-ports.json.tmp

# `unique` collapses the duplicate entries Docker returns when a port is
# published on both an IPv4 and IPv6 host address — same port, same
# container, we only care once.
JQ_FILTER='[.[] as $c | ($c.Names[0] // "unknown" | ltrimstr("/")) as $name | ($c.Ports // [])[] | select(.PublicPort != null) | {host: .PublicPort, protocol: (.Type // "tcp"), container: $name}] | unique'

while true; do
  if curl -s --max-time 3 --unix-socket /var/run/docker.sock http://localhost/containers/json 2>/dev/null \
      | jq -c "$JQ_FILTER" > "$TMP" 2>/dev/null; then
    mv "$TMP" "$OUT"
  fi
  sleep 5
done
