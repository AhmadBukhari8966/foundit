#!/bin/sh
set -eu
# Fresh provider-managed disks can be root-owned. Fix ownership before dropping
# privileges; the API and model inference never run as root.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${FOUNDIT_DATA_DIR:-/data}"
  chown -R appuser:appuser "${FOUNDIT_DATA_DIR:-/data}"
  exec gosu appuser "$@"
fi
exec "$@"
