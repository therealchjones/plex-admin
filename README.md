# plex-admin

A system to manage a media center ecosystem

## Capabilities

- When was the most recent episode, and do we have it?
- When is the next episode?

## Requirements

Working web server that allows:

- CGI access
- authentication and authorization (strongly recommended)
- SSH access to a UNIX-like shell environment with `/bin/sh` and common
  utilities

NB: Web server configuration is complex and not described in this project.
However, information regarding recommended settings that may be applicable is
included in the related
[seedhost-apache](https://github.com/therealchjones/seedhost-apache) repository.

## Installation

1. `git clone https://github.com/therealchjones/plex-admin` into a temporary
   directory of your choice
2. Enable the web server authorization and authentication method of your choice
3. Protect the path api/index.cgi via authentication and/or authorization on the
   server
4. Configure the web server to run api/index.cgi as a CGI script rather than to
   serve the file contents
5. Choose a directory _not_ accessible to any web server visitors but accessible
   to api/index.cgi that will house admin-secrets.sh
6. Edit variables in admin-secrets.sh and deploy.sh as needed
7. Run deploy.sh to move files to the server

## Development

1. `git clone https://github.com/therealchjones/plex-admin` into a development
   directory of your choice
2. Configure web server as desired
3. Copy admin-secrets.sh to admin-secrets_local.sh and deploy.sh to
   deploy_local.sh
4. Edit variables in admin-secrets_local.sh and deploy_local.sh as needed
5. Run deploy_local.sh to move files to the server
6. Add appropriate Node.js modules (`npm install`) and VS Code extensions as desired
7. Edit source files in the `plex-admin/` directory hierarchy as desired
8. Repeat steps 5-6 as desired
9. Submit pull request as desired

## Development Notes

- Comments are important and plentiful. Read them. Write more.
- Neither Node.js/npm nor Visual Studio Code and its recommended extensions are
  required for development. However, using them can improve code quality and
  style standardization for this project. Configuration files are included.

## Copyright

[CC0](LICENSE)
