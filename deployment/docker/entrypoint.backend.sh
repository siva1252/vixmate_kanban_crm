#!/bin/sh
set -e

echo "=== migrate ==="
python manage.py migrate --noinput

echo "=== collectstatic ==="
python manage.py collectstatic --noinput

# Idempotent: stages/sources/services + 5 CRM admins (gunwant@… / Viximate@high5).
# Set SEED_ON_STARTUP=0 in the Jenkins secret after go-live if you do not want
# passwords reset on every container restart.
SEED_ON_STARTUP="${SEED_ON_STARTUP:-1}"
if [ "$SEED_ON_STARTUP" = "1" ] || [ "$SEED_ON_STARTUP" = "true" ] || [ "$SEED_ON_STARTUP" = "yes" ]; then
  echo "=== seed_configuration ==="
  python manage.py seed_configuration
  echo "=== seed_demo_users ==="
  python manage.py seed_demo_users
else
  echo "=== seed skipped (SEED_ON_STARTUP=${SEED_ON_STARTUP}) ==="
fi

# Daphne ASGI so HTTP + WebSockets share one process (live CRM sync for all open browsers).
exec daphne -b 0.0.0.0 -p 8000 --proxy-headers config.asgi:application
