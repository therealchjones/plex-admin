#!/bin/sh

set -u
set -e

# SSH server with username if needed but no path,
# 'www.example.com' or 'user@ssh.example.org'
DEPLOY_SERVER='<ssh_server_name>'
# All directories are filesystem paths, not URLs. They can be
# relative to the login (home) directory on the SSH server.
DEPLOY_WEB_DIR='<main_web_directory_on_server>'
DEPLOY_CONTENT_DIR="$DEPLOY_WEB_DIR"/html/
DEPLOY_CGI_PATH="$DEPLOY_WEB_DIR"/api/index.cgi
DEPLOY_SECRETS_PATH=".config/plex-admin/admin-secrets.sh"

DEPLOY_SCRIPT_LOCAL=deploy_local.sh
DEPLOY_SECRETS=admin-secrets.sh
DEPLOY_SECRETS_LOCAL=admin-secrets_local.sh

if [ -r "$DEPLOY_SCRIPT_LOCAL" ]; then
	this_script="$(stat -L -f %i "$0")"
	local_script="$(stat -L -f %i "$DEPLOY_SCRIPT_LOCAL")"
	if [ "$local_script" != "$this_script" ]; then
		echo "File '$DEPLOY_SCRIPT_LOCAL' is defined as the local version" >&2
		echo "of this script. Run 'sh \"$DEPLOY_SCRIPT_LOCAL\"' instead," >&2
		echo "remove that file, or edit this script ($0)." >&2
		exit 1
	fi
fi

scp index.html script.js style.css "$DEPLOY_SERVER":"$DEPLOY_WEB_DIR"
scp html/content.html "$DEPLOY_SERVER":"$DEPLOY_CONTENT_DIR"
scp api/index.cgi "$DEPLOY_SERVER":"$DEPLOY_CGI_PATH"

if [ -r "$DEPLOY_SECRETS_LOCAL" ]; then
	DEPLOY_SECRETS="$DEPLOY_SECRETS_LOCAL"
fi
scp "$DEPLOY_SECRETS" "$DEPLOY_SERVER":"$DEPLOY_SECRETS_PATH"
