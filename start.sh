#!/bin/sh
# Starts the port-polling loop in the background, then hands off to nginx's
# own official entrypoint so its normal startup behavior (config
# templating, etc.) still runs exactly as it would without this wrapper.
set -e

/usr/local/bin/poll-ports.sh &

exec /docker-entrypoint.sh "$@"
