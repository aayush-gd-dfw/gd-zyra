#!/bin/sh
# Use Railway's PORT or default to 80
export PORT=${PORT:-80}
echo "Starting nginx on port $PORT"
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
