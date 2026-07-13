#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
export GATEWAY_VERBOSE="${GATEWAY_VERBOSE:-1}"
exec python server.py
