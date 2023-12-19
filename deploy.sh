#!/bin/sh

set -u
set -e

DEPLOY_SERVER=plex
DEPLOY_WEB_PATH=www/chjones.server1359.seedhost.eu/chjones/admin/
DEPLOY_CGI_PATH="$DEPLOY_WEB_PATH"/api
DEPLOY_SECRETS_PATH=.config/plex-admin/

scp index.html script.js style.css "$DEPLOY_SERVER":"$DEPLOY_WEB_PATH"
scp admin-secrets.sh "$DEPLOY_SERVER":"$DEPLOY_SECRETS_PATH"
scp api/index.cgi "$DEPLOY_SERVER":"$DEPLOY_CGI_PATH"
