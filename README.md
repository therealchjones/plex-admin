# plex-admin

a system to centrally manage a media center ecosystem

## Capabilities

- When was the most recent episode, and do we have it?
- When is the next episode?

## Installation

### via git repository

### via release package

1. Enable the web server authorization and authentication method of your choice
1. Configure the web server to run proxy.cgi as a cgi script rather than serve the file
1. Place index.html and proxy.cgi in appropriate filesystem areas to be served by the web server
1. Ensure the permissions of proxy.cgi allow execution
1. Place admin-secrets.sh in a directory _not_ accessible by the web server, but accessible to proxy.cgi
1. Edit the files to specify configurable information

## Development

- Comments are important and plentiful. Read them.
- If testing on a local machine while the API proxy is on a remote server and requires authentication,
  you may need to allow "third-party cookies" in your browser to access the scripts (in addition to properly setting up the remote server)
