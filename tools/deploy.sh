#!/bin/bash
# Copy Friend Garden to the stuffs site (stuffs.tiresia.xyz/friend-garden/).
set -euo pipefail
cd "$(dirname "$0")/.."
rsync -a --delete app/ /srv/docker/stuffs/site/friend-garden/
echo "Live at https://stuffs.tiresia.xyz/friend-garden/"
