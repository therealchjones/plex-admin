#!/bin/sh

set -e
set -u

if [ "$#" != 0 ]; then
	echo "$0 installs files for this web app into appropriate directories"
	echo "based upon the directory in which the file '$0' resides."
	echo "It assumes the files have been downloaded from a git repository"
	echo "and provides instructions for editing the necessary files in the"
	echo "resulting installation. Run without arguments to install."
fi

DEPLOY_SERVER=plex
DEPLOY_WEB_DIR=www/chjones.server1359.seedhost.eu/chjones/admin/
DEPLOY_CGI_PATH="$DEPLOY_WEB_DIR"/api/index.cgi
DEPLOY_SECRETS_PATH=.config/plex-admin/admin-secrets.sh

DEPLOY_SECRETS_FILE=admin-secrets.sh
DEPLOY_SECRETS_ALT_FILE=admin-secrets_local.sh

scp index.html script.js style.css "$DEPLOY_SERVER":"$DEPLOY_WEB_DIR"
scp api/index.cgi "$DEPLOY_SERVER":"$DEPLOY_CGI_PATH"

if [ -r "$DEPLOY_SECRETS_ALT_FILE" ]; then
	DEPLOY_SECRETS_FILE="$DEPLOY_SECRETS_ALT_FILE"
fi
scp "$DEPLOY_SECRETS_FILE" "$DEPLOY_SERVER":"$DEPLOY_SECRETS_PATH"
