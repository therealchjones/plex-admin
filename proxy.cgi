#!/bin/sh

set -e
set -u

PROXY_DEBUG="${PROXY_DEBUG:-}"
SECRETS_FILE=/home/chjones/.config/plex-admin/admin-secrets.sh
CURL="/usr/bin/curl"
PROXY_ERROR=
QUERY_STRING="${QUERY_STRING:-}"

if [ -r "$SECRETS_FILE" ]; then
	# shellcheck source=./admin-secrets.sh # during development
	. "$SECRETS_FILE"
else
	PROXY_ERROR="secrets file '$SECRETS_FILE' not found"
fi

call_api() { # call_api appname apipath query
	if [ "$#" -ne 3 ]; then
		PROXY_ERROR="call_api '$*' has '$#' arguments rather than 3"
		return 1
	fi
	if [ -z "$2" ]; then
		PROXY_ERROR="call_api requires an api path"
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
			PROXY_ERROR="Unknown service '$2'; call_api requires appname 'radarr', 'sonarr', or 'plex'."
			return 1
			;;
	esac
	# captures any stderr from curl in ERROR_RESPONSE but still sends stdout from curl to stdout
	if ! ERROR_RESPONSE="$("$CURL" -s -i "http://$host:$port$path?apiKey=$key&$3" 3>&2 2>&1 1>&3)" 3>&1; then
		PROXY_ERROR="curl error: $ERROR_RESPONSE"
		return 1
	fi
}

print_debug() {
	echo "{"
	# Variables must be names, so should be everything up to the first =
	# This uses the assumption that quoted values begin and end with '; this is not required by POSIX
	# but works in practice
	set \
		| sed -e ':a' \
			-e "/^[^=]*='.*[^']$/{N; ba
			}" \
			-e 's/\(["\\]\)/\\\1/g' \
			-e 's/^\([^=]*\)=\(.*\)$/"\1": "\2",/' \
			-e 's/\n/\\n/g' \
			-e 's/	/\\t/g'

	echo "\"\$0\": \"$0\" }"
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
			"debug")
				if [ -z "$param_val" ]; then
					PROXY_DEBUG=y
				else
					PROXY_DEBUG="$param_val"
				fi
				;;
			*)
				PROXY_ERROR="Unsupported proxy component '$param_name'"
				;;
		esac
	fi
done

# Deal with invalid (or empty) requests
if [ -z "$PROXY_APPNAME" ] || [ -z "$PROXY_APIPATH" ]; then
	PROXY_ERROR="Both appName and apiPath are required."
fi

# output content
echo "Content-type: application/json"
echo
if [ -n "$PROXY_ERROR" ]; then
	echo "{ \"error\": \"$PROXY_ERROR\" "
	if [ -n "$PROXY_DEBUG" ]; then
		echo ", \"debug\": "
		print_debug
	fi
	echo "}"
	exit
fi
if [ -n "$PROXY_DEBUG" ]; then
	echo "{ \"debug\": "
	print_debug
	echo ", \"response\": "
fi
call_api "$PROXY_APPNAME" "$PROXY_APIPATH" "$PROXY_QUERY" \
	|| echo "{ \"error\": \"$PROXY_ERROR\" }"
if [ -n "$PROXY_DEBUG" ]; then
	echo "}"
fi
