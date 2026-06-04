#!/bin/sh
# Inject the API key from the environment variable into the HTML before serving
sed -i "s|__ANTHROPIC_API_KEY__|${ANTHROPIC_API_KEY}|g" /usr/share/nginx/html/index.html
exec nginx -g "daemon off;"
