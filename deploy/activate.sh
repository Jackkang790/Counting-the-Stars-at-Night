#!/usr/bin/env bash
set -Eeuo pipefail

archive=${1:?archive path required}
expected=${2:?archive SHA256 required}
root=/home/ubuntu/ar-docker
test "$(realpath "$root")" = /home/ubuntu/ar-docker
case "$archive" in /home/ubuntu/unified-*.zip) ;; *) exit 2 ;; esac
test "$(sha256sum "$archive" | cut -d ' ' -f 1)" = "$expected"
test "$(df --output=avail -k / | tail -1)" -gt 250000
test -f "$root/performer-service/deploy/compose.override.yml"

release_name=$(python3 - "$archive" <<'PY'
import json,re,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    name=json.loads(z.read('release.json'))['release']
assert re.fullmatch(r'unified-[0-9a-f]{7}-[0-9a-f]{12}',name)
print(name)
PY
)
release="$root/releases/$release_name"
test ! -e "$release"
mkdir -p "$release"
python3 - "$archive" "$release" <<'PY'
import hashlib,json,pathlib,sys,zipfile
destination=pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as z:
    manifest=json.loads(z.read('release.json'))
    assert set(z.namelist()) == set(manifest['files'])|{'release.json'}
    for name,info in manifest['files'].items():
        target=destination/name
        assert not pathlib.PurePosixPath(name).is_absolute() and '\\' not in name
        assert target.resolve().is_relative_to(destination)
        data=z.read(name)
        assert len(data)==info['bytes'] and hashlib.sha256(data).hexdigest()==info['sha256'],name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
    (destination/'release.json').write_bytes(z.read('release.json'))
print('Release archive and every file hash verified')
PY

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$root/backups/$release_name-$stamp"
mkdir -p "$backup"
chmod 700 "$backup"
cp "$root/nginx.conf" "$root/docker-compose.yml" "$backup/"
had_previous=false
if test -f "$root/unified.env"; then
    had_previous=true
    cp "$root/unified.env" "$backup/unified.env"
    cp "$root/deploy/compose.unified.yml" "$backup/compose.unified.yml"
fi
if ! test -f "$root/tour-data/starry-night.sqlite3"; then
    mkdir -p "$root/tour-data"
    sudo docker cp stars-backend:/opt/Counting-the-Stars-at-Night/backend/data/. "$root/tour-data/"
fi
sudo python3 - "$root/tour-data/starry-night.sqlite3" "$backup/database.sqlite3" <<'PY'
import sqlite3,sys
source=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)
assert source.execute('PRAGMA quick_check').fetchone()[0]=='ok'
with sqlite3.connect(sys.argv[2]) as target: source.backup(target)
print('Existing database backed up before migrations')
PY
sudo chown -R 10001:10001 "$root/tour-data"
sudo chmod 700 "$root/tour-data"

image="stars-tour-api:$release_name"
sudo docker build --pull=false -t "$image" -f "$release/deploy/Dockerfile.api" "$release"
printf 'TOUR_RELEASE=%s\nTOUR_RELEASE_DIR=%s\n' "$release_name" "$release" > "$release/unified.env"
compose=(sudo docker compose --project-directory "$root" -p ar-docker --env-file "$release/unified.env" -f "$root/docker-compose.yml" -f "$root/performer-service/deploy/compose.override.yml" -f "$release/deploy/compose.unified.yml")
"${compose[@]}" config -q
ar_changed=false
rollback() {
    trap - ERR
    echo 'Deployment failed; restoring the previous web service' >&2
    if test "$had_previous" = true; then
        previous=(sudo docker compose --project-directory "$root" -p ar-docker --env-file "$backup/unified.env" -f "$root/docker-compose.yml" -f "$root/performer-service/deploy/compose.override.yml" -f "$backup/compose.unified.yml")
        "${previous[@]}" up -d --no-deps --no-build tour-api
        if test "$ar_changed" = true; then "${previous[@]}" up -d --no-deps --no-build --force-recreate ar; fi
    else
        if test "$ar_changed" = true; then
            sudo docker compose --project-directory "$root" -p ar-docker -f "$root/docker-compose.yml" -f "$root/performer-service/deploy/compose.override.yml" up -d --no-deps --no-build --force-recreate ar
        fi
        sudo docker stop stars-tour-api || true
    fi
    echo "Database backup retained at $backup/database.sqlite3" >&2
    exit 1
}
trap rollback ERR
"${compose[@]}" up -d --no-deps --no-build tour-api
healthy=false
for attempt in $(seq 1 30); do
    if curl --max-time 3 -fsS http://127.0.0.1:8001/api/v1/health >/dev/null; then healthy=true; break; fi
    sleep 2
done
test "$healthy" = true

sudo docker run --rm --network ar-docker_default \
    --mount "type=bind,src=$release/www,dst=/usr/share/nginx/html,readonly" \
    --mount "type=bind,src=$release/deploy/nginx.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
    ar-site:latest nginx -t
ar_changed=true
"${compose[@]}" up -d --no-deps --no-build --force-recreate ar
healthy=false
for attempt in $(seq 1 20); do
    if curl --max-time 3 -fsS http://127.0.0.1:8080/index.html | cmp -s - "$release/www/index.html" \
        && curl --max-time 3 -fsS http://127.0.0.1:8080/api/v1/health >/dev/null \
        && curl --max-time 3 -fsS http://127.0.0.1:8080/api/studio/health >/dev/null \
        && curl --max-time 3 -fsS http://127.0.0.1:8080/ar/api/ar/v1/catalog.json >/dev/null; then healthy=true; break; fi
    sleep 2
done
test "$healthy" = true

mkdir -p "$root/deploy"
cp "$release/deploy/compose.unified.yml" "$root/deploy/compose.unified.yml"
cp "$release/unified.env" "$root/unified.env"
ln -sfn "$release" "$root/current-tour"
cat > "$root/manage-tour.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
root=/home/ubuntu/ar-docker
exec sudo docker compose --project-directory "$root" -p ar-docker --env-file "$root/unified.env" -f "$root/docker-compose.yml" -f "$root/performer-service/deploy/compose.override.yml" -f "$root/deploy/compose.unified.yml" "$@"
SH
chmod 750 "$root/manage-tour.sh"
trap - ERR
printf 'DEPLOYED=%s\nIMAGE=%s\nBACKUP=%s\nURL=https://ar.lobodoc.com/\n' "$release_name" "$image" "$backup"
df -h /
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
