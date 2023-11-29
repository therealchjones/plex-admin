# plex-admin

A system to manage a media center ecosystem

## Installation

1. Enable the web server authorization and authentication method of your choice
1. Configure the web server to run proxy.cgi as a cgi script rather than serve the file
1. Place index.html and proxy.cgi in appropriate filesystem areas to be served by the web server
1. Ensure the permissions of proxy.cgi allow execution
1. Place admin-secrets.sh in a directory _not_ accessible by the web server, but accessible to proxy.cgi
1. Edit the files to include configurable information
