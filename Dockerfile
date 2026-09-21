# Static site, so we just need something to serve the files —
# nginx's alpine image is ~40MB and needs zero configuration for this.
FROM nginx:alpine

# curl (with unix-socket support) + jq let the port poller talk to the
# Docker Engine API over the socket, without needing the full docker CLI.
# docker-cli + docker-cli-compose + python3 are only for the optional
# "Deploy" button (see deploy-server.py) — it shells out to a real
# `docker compose up`, using the same mounted socket, rather than
# reimplementing compose's own logic.
RUN apk add --no-cache curl jq docker-cli docker-cli-compose python3

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the app in
COPY index.html guide.html dashboard.html favicon.svg dockge-demo.gif portainer.gif dashboard-screenshot.png style.css app.js services.js theme.js nav.js dashboard.js /usr/share/nginx/html/

# Custom server block — adds the /api/ proxy to deploy-server.py on top of
# nginx:alpine's normal static-file defaults.
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

# Background poller that publishes currently-used host ports as a static
# JSON file — see poll-ports.sh. Only does anything useful once the socket
# is actually mounted in (see docker-compose.yml).
COPY poll-ports.sh /usr/local/bin/poll-ports.sh
COPY deploy-server.py /usr/local/bin/deploy-server.py
COPY start.sh /start.sh
RUN chmod +x /usr/local/bin/poll-ports.sh /usr/local/bin/deploy-server.py /start.sh

EXPOSE 80
ENTRYPOINT ["/start.sh"]
CMD ["nginx", "-g", "daemon off;"]
