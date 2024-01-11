#!/bin/sh

# outputs a JSON-formatted object:
# {
#	"response": <response output from proxied app, usually "" if there is an error>,
#	"debug": <dictionary of environment variables>,
#	"error": <error output from proxied app, "" if no error>
# }
# The "debug" property is present iff the request includes the "debug" param (with any or no value)
# In case of an error the "response" property value may be empty, may be JSON output, or may
# be non-JSON output; it's what is given on STDOUT when the proxied app experiences the error

set -e
set -u

PROXY_DEBUG="${PROXY_DEBUG:-}"
SECRETS_FILE=/home/chjones/.config/plex-admin/admin-secrets.sh
PROXY_CURL="/usr/bin/curl"
PROXY_TARGET=
PROXY_ERROR=
QUERY_STRING="${QUERY_STRING:-}"

check_secrets() { # ensure the needed secrets file exists
	if [ -r "$SECRETS_FILE" ]; then
		# shellcheck source=../admin-secrets.sh # during development
		. "$SECRETS_FILE"
	else
		PROXY_ERROR="secrets file '$SECRETS_FILE' not found"
	fi
}

call_api() { # call_api appname apipath query
	if [ "$#" -ne 3 ]; then
		PROXY_ERROR="call_api '$*' has '$#' arguments rather than 3"
		return 1
	fi
	if [ -z "$2" ]; then
		PROXY_ERROR="call_api requires an api path"
	fi
	case "$1" in
		"radarr")
			host="$RADARR_API_HOST"
			port="$RADARR_API_PORT"
			key="$RADARR_API_KEY"
			path="$RADARR_API_PATH$2"
			;;
		"sonarr")
			host="$SONARR_API_HOST"
			port="$SONARR_API_PORT"
			key="$SONARR_API_KEY"
			path="$SONARR_API_PATH$2"
			;;
		"plex")
			host="$PLEX_API_HOST"
			port="$PLEX_API_PORT"
			key="$PLEX_API_KEY"
			path="$PLEX_API_PATH$2"
			;;
		*)
			PROXY_ERROR="Unknown service '$2'; call_api requires appname 'radarr', 'sonarr', or 'plex'."
			return 1
			;;
	esac
	# captures any stderr from curl in PROXY_ERROR_RESPONSE but still sends stdout from curl to stdout
	PROXY_TARGET="http://$host:$port$path?apiKey=$key$3"
	if ! { PROXY_ERROR_RESPONSE="$("${PROXY_CURL}" -Ss "$PROXY_TARGET" 3>&2 2>&1 1>&3)"; } 2>&1; then
		PROXY_ERROR="curl error: $PROXY_ERROR_RESPONSE"
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

exit_with_error() {
	# FD 2 will print to apache errors-other.log (not the cgi.log) but receives no further formatting; we
	# try to make it look more like other error.log output here
	echo "[$(date +"%a %b %d %H:%M:%S.%N %Y")] -/- [cgid:error] [${PPID:-"-"}/-] $0: exit 1: $PROXY_ERROR" >&2
	exit 1
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
			param_val="$(/usr/bin/php -r "echo urldecode('$param_val');")"
		fi
		case "$param_name" in
			"appName")
				PROXY_APPNAME="$param_val"
				;;
			"apiPath")
				PROXY_APIPATH="$param_val"
				;;
			"query")
				PROXY_QUERY="&$param_val"
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
check_secrets
# output content
# should sanitize/json-escape PROXY_ERROR
echo "Content-type: application/json"
echo
# We always package the proxied data, for consistency in case there's
# debug data or an error.
echo "{"
# We check PROXY_ERROR twice since we don't want to run call_api
# if it's already errored out
if [ -n "$PROXY_ERROR" ]; then
	echo "\"error\": \"$PROXY_ERROR\""
	if [ -n "$PROXY_DEBUG" ]; then
		echo ", \"debug\": "
		print_debug
	fi
	echo "}"
	exit_with_error
fi
echo "\"response\": "
call_api "$PROXY_APPNAME" "$PROXY_APIPATH" "$PROXY_QUERY" \
	|| {
		echo "\"\","
		echo "\"error\": \"$PROXY_ERROR\""
	}
if [ -n "$PROXY_DEBUG" ]; then
	echo ", \"debug\": "
	print_debug
fi
echo "}"
if [ -n "$PROXY_ERROR" ]; then
	exit_with_error
fi
