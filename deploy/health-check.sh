#!/usr/bin/env bash
# Optional: cron every 5 min to check backend health.
# Add to crontab: */5 * * * * /opt/boarding/repo/deploy/health-check.sh >> /var/log/boarding/health-check.log 2>&1

url="${HEALTH_URL:-https://boarding.path2ai.tech/health}"
if curl -sSf --max-time 10 "$url" > /dev/null; then
  echo "$(date -Iseconds) OK"
else
  echo "$(date -Iseconds) FAIL $url"
fi
