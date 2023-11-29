#!/bin/sh

set -e
set -u

SECRETS_FILE=/home/chjones/.config/plex-admin/admin-secrets.sh
CURL="/usr/bin/curl"

if [ -r "$SECRETS_FILE" ]; then
	# shellcheck source=./admin-secrets.sh # during development
	. "$SECRETS_FILE"
else
	echo "Error: secrets file '$SECRETS_FILE' not found" >&2
	exit 1
fi

call_api() { # call_api appname apipath query
	if [ "$#" -ne 3 ]; then
		echo Error: call_api "$@" has "$#" arguments rather than 3 >&2
		return 1
	fi
	if [ -z "$2" ]; then
		echo Error: call_api requires an api path >&2
		return 1
	fi
	path="$2"
	case "$1" in
		"radarr")
			host="$RADARR_API_HOST"
			port="$RADARR_API_PORT"
			key="$RADARR_API_KEY"
			;;
		"sonarr")
			host="$SONARR_API_HOST"
			port="$SONARR_API_PORT"
			key="$SONARR_API_KEY"
			;;
		"plex")
			host="$PLEX_API_HOST"
			port="$PLEX_API_PORT"
			key="$PLEX_API_KEY"
			;;
		*)
			echo "{ error: \"Unknown service '$2'; call_api requires service"
			echo "       'radarr', 'sonarr', or 'plex'.\" }"
			;;
	esac

	"$CURL" -s -i "http://$host:$port$path?apiKey=$key&$3"
}

# process the query string

PROXY_APPNAME=
PROXY_APIPATH=
PROXY_QUERY=
PROXY_ERROR=

while [ -n "$QUERY_STRING" ]; do
	param="${QUERY_STRING##*&}"
	param_name=""
	param_val=""
	QUERY_STRING="${QUERY_STRING%"$param"}"
	QUERY_STRING="${QUERY_STRING%&}"
	if [ -n "$param" ]; then
		param_name="${param%%=*}"
		if [ "$param_name" != "$param" ]; then # there's a value
			param_val="${param#"$param_name"=}"
			if [ "$param_val" -ne "${param_val#*%}" ]; then
				param_val="$(/usr/binphp -r "echo urldecode('$1')")"
			fi
		fi
		case "$param_name" in
			"appName")
				PROXY_APPNAME="$param_val"
				;;
			"apiPath")
				PROXY_APIPATH="$param_val"
				;;
			"query")
				PROXY_QUERY="$param_val"
				;;
			*)
				PROXY_ERROR="Unsupported proxy component '$param_name'"
				;;
		esac
	fi
done

# output content
echo "Content-type: application/json"
echo
if [ -n "$PROXY_ERROR" ]; then
	echo "{ error: \"$PROXY_ERROR\" }"
	exit
fi
call_api "$PROXY_APPNAME" "$PROXY_APIPATH" "$PROXY_QUERY"
