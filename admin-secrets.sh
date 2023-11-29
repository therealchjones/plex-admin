#!/bin/sh

# shellcheck disable=SC2034  # This file is sourced externally

# configuration variables including "secrets" like local API keys
# these should not need to be exported for other programs if this
# file is appropriately sourced by the proxy.cgi script which will
# then use the variables in commands

API_HOST=127.0.0.1
SONARR_API_HOST="$API_HOST"
RADARR_API_HOST="$API_HOST"
PLEX_API_HOST="$API_HOST"

# These should be the ports accessible from the shell, *not* within any
# Docker containers where these apps may be running. E.g., these may not
# match the ports in the "Settings" of each app.
SONARR_API_PORT=
RADARR_API_PORT=
PLEX_API_PORT=

SONARR_API_KEY=
RADARR_API_KEY=
PLEX_API_KEY=

SONARR_API_PATH=
RADARR_API_PATH=
PLEX_API_PATH=
