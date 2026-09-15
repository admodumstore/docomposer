#!/bin/sh
# Starts the port-polling loop and the deploy backend in the background,
# then hands off to nginx's own official entrypoint so its normal startup
# behavior (config templating, etc.) still runs exactly as it would
# without this wrapper.
set -e

/usr/local/bin/poll-ports.sh &
python3 /usr/local/bin/deploy-server.py &

exec /docker-entrypoint.sh "$@"
