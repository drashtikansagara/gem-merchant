# MongoDB backups

## Managed MongoDB

Use the provider's automated backups (Atlas, etc.). Confirm retention covers at least 7 days. VPS snapshots alone are not enough.

## Self-hosted MongoDB on the VPS

Dump (run daily from cron, store outside the app directory):

```bash
mkdir -p /var/backups/splendor
mongodump --uri="$MONGODB_URI" --out="/var/backups/splendor/$(date +%F)"
```

Retention: keep 7 daily dumps, delete older folders.

Restore:

```bash
mongorestore --uri="$MONGODB_URI" --drop /var/backups/splendor/YYYY-MM-DD
```

Then restart the WebSocket process so it reloads active rooms:

```bash
docker compose restart ws
```

Do not restore over a live tournament without taking the app down first.
