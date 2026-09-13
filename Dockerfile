# Static site, so we just need something to serve the files —
# nginx's alpine image is ~40MB and needs zero configuration for this.
FROM nginx:alpine

# curl (with unix-socket support) + jq let the port poller talk to the
# Docker Engine API over the socket, without needing the full docker CLI.
RUN apk add --no-cache curl jq

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the app in
COPY index.html guide.html dockge-demo.gif portainer.gif style.css app.js services.js theme.js /usr/share/nginx/html/

# Background poller that publishes currently-used host ports as a static
# JSON file — see poll-ports.sh. Only does anything useful once the socket
# is actually mounted in (see docker-compose.yml).
COPY poll-ports.sh /usr/local/bin/poll-ports.sh
COPY start.sh /start.sh
RUN chmod +x /usr/local/bin/poll-ports.sh /start.sh

EXPOSE 80
ENTRYPOINT ["/start.sh"]
CMD ["nginx", "-g", "daemon off;"]
