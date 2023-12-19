#!/bin/sh

# shellcheck disable=SC2034  # This file is sourced externally

# This file contains "secrets" and should not be publicly accessible.
# The recommended file mode is 0600 in a directory with mode 0700,
# not in a hierarchy to be served to external sources. Use a properly
# secured CGI or similar script to obtain and use data from this file.

API_HOST="127.0.0.1"
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
