"use strict";

const siteAddress = "https://plex.aleph0.com";
const apiAddress = `${siteAddress}/chjones/admin/proxy.cgi`;
const debugMode = true;
const dbs = {
	shows: null,
	movies: null,
	downloads: null,
};
const processes = {
	shows: null,
	movies: null,
	downloads: null,
};

addDynamicContent();
enableFooter();
loadShows();
loadMovies();
// loadDownloads();

// proxied response is of the form {
//   response: responseobject("" or possibly other if there is an error),
//   error: errorstring (or "" if no error),
//   debug: debugobject (property only present if "debug" parameter in request)
// }

/**
 * Builds and submits a Fetch request for data. Parameters used will be URI-encoded by requestData
 * and should not yet be when the function is called.
 * @param {string} appName app from which to request data
 * @param {string} apiPath path of the API call
 * @param {string} query query string for the API call
 * @returns {Promise<Response>} Promise that resolves to a Fetch API response
 */
async function requestData(appName, apiPath, query = "") {
	if (!appName || !apiPath) {
		throw Error("request requires appName and apiPath");
	}
	appName = encodeURIComponent(appName);
	apiPath = encodeURIComponent(apiPath);
	let uri = apiAddress + "?appName=" + appName + "&apiPath=" + apiPath;
	if (query) {
		query = encodeURIComponent(query);
		uri += "&query=" + query;
	}
	if (debugMode) {
		uri += "&debug";
		console.debug("Requesting " + uri);
	}
	return fetch(uri, {
		credentials: "include",
	});
}

/**
 * Processes the response from a Fetch API request
 * @param {Response} response Response from a Fetch API request
 * @returns {Promise<object>} A Promise to process the response that resolves with an object representing the response
 */
async function processResponse(response) {
	if (!response.ok) {
		throw new Error("Error downloading");
	}

	let responseText = await response.text();
	let json = null;
	try {
		json = JSON.parse(responseText);
		if (debugMode) {
			console.log(`Received JSON:`);
			console.log(json);
		}
	} catch (error) {
		console.error("Unable to parse JSON");
		console.error("Response text: " + responseText);
		console.error("Error text: " + error);
		throw new Error("Unable to parse JSON.	See console for more info.");
	}
	if (json.error) {
		console.error("Request resulted in an error: " + json.error);
		if (debugMode) {
			if (json.debug) {
				console.debug("Debug info:");
				console.debug(json.debug);
			}
			console.debug("Full response:");
			console.debug(responseText);
		}
		throw new Error("Error from request. See console for more info.");
	}
	if (!json.response) {
		console.error("No error but no response from server.");
		console.error("Response object: " + json);
		throw new Error("Invalid response from; see console for more info.");
	}
	return { json: json, response: response, time: Date.now() };
}
/**
 * Downloads the requested database of shows, movies, or downloads and saves it for cached requests.
 * @param {string} dbName The name of the database to obtain and save: "shows", "movies", or "downloads"
 * @returns {Promise<object>} A promise to load the appropriate database that resolves with the database.
 */
async function loadDb(dbName) {
	let appName,
		apiPath,
		query,
		db = null;
	switch (dbName) {
		case "shows":
			appName = "sonarr";
			apiPath = "/api/v3/series";
			break;
		case "movies":
			appName = "radarr";
			apiPath = "/api/v3/movie";
			break;
		case "downloads":
			throw new Error("Not yet implemented.");
			break;
		default:
			throw new Error("No database '" + dbName + "' to load.");
			break;
	}
	return requestData(appName, apiPath, query)
		.then(processResponse)
		.then((response) => {
			response.json.response.sort(arrSort);
			return response;
		})
		.then((db) => (dbs[dbName] = db));
}
/**
 * Obtains the requested database of movies, TV shows, or downloads. Uses the cached version if one
 * is available, or downloads and saves a new copy if not.
 * @param {string} dbName The name of the database to obtain and save: "shows", "movies", or "downloads"
 * @returns {object} The database object
 */
async function getDb(dbName) {
	if (dbs[dbName]) return dbs[dbName];
	else return await loadDb(dbName);
}

/**
 * Obtains the list of all available TV series and loads the UI with the information
 * @returns a Promise to load the list of TV shows into the page's Shows list
 */
async function loadShows() {
	return Promise.resolve(getDb("shows"))
		.then((showsDb) => {
			let list = document.getElementById("shows-list");
			if (!showsDb.json || showsDb.json.response === undefined)
				throw new Error("No list of shows in database");
			showsDb.json.response.forEach((element) => {
				let end = "";
				let previousAiring = element.previousAiring;
				let nextAiring = "";
				if (element.ended) {
					if (element.lastAired) end = element.lastAired;
					else if (previousAiring) end = previousAiring;
				} else {
					if (element.nextAiring) nextAiring = element.nextAiring;
				}
				let start = element.firstAired ? element.firstAired : element.year;
				let title = element.title;
				if (start) {
					start = new Date(start).getFullYear();
					// remove a date from the title if present
					if (/ \((19|20)..\)$/.test(title)) title = title.slice(0, -7);
				}
				if (end) end = new Date(end).getFullYear();
				let itemId = "show-item-" + element.titleSlug;
				let sonarrId = element.id;
				let entry = `<li class="row list-group-item list-group-item-action py-2 lh-sm d-flex" id=${itemId}>
					<div class="item-title col-7 pe-0">${title}`;
				if (start)
					entry += ` <span class="item-years">(${start}-${end})</span></div>`;
				entry += `<div class="item-airings col text-end ps-0">`;
				if (!element.ended) {
					if (previousAiring) {
						previousAiring = new Date(previousAiring);

						entry += `
						<div class="item-previous-airing p-0">Newest: ${getDateString(previousAiring)}
						<span class="pending spinner-grow d-inline-block text-warning"></span>
						<span class="confirmed d-none text-success"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" class="bi bi-check confirmed" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg></span>
						<span class="disconfirmed d-none text-danger"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg></span></div>`;
						// identify if we already have this episode and update list and db
						checkEpisode(sonarrId, previousAiring).then((result) => {
							let checks =
								document.getElementById(itemId).children[1].children[0]
									.children;
							checks[0].classList.remove("d-inline-box");
							checks[0].classList.add("d-none");
							if (result) {
								checks[1].classList.remove("d-none");
								checks[1].classList.add("d-inline-block");
							} else {
								checks[2].classList.remove("d-none");
								checks[2].classList.add("d-inline-block");
							}
						});
					}
					entry += `<div class="item-next-airing p-0">Next: `;
					if (nextAiring) {
						nextAiring = new Date(nextAiring);
						entry += `${getDateString(nextAiring)}`;
					} else {
						entry += "unknown";
					}
					entry += "</div></div>";
				}
				entry += "</li>";
				list.innerHTML += entry;
			});
			return list;
		})
		.then((list) => {
			let loading = document.getElementById("loading-shows");
			loading.classList.remove("d-block");
			loading.classList.add("d-none");
			list.classList.remove("d-none");
			list.classList.add("d-flex");
			return list;
		});
}
/**
 * Obtains the list of all availableMovies and loads the UI with the information (not yet implemented)
 * @returns a Promise to load the list of movies into the page's Movies list
 */
async function loadMovies() {
	return Promise.resolve(getDb("movies"))
		.then((moviesDb) => {
			let list = document.getElementById("movies-list");
			if (!moviesDb.json || moviesDb.json.response === undefined)
				throw new Error("No list of movies in database");
			moviesDb.json.response.forEach((element) => {
				list.innerHTML += `<li class="list-group-item list-group-item-action py-3 lh-sm">${element.title}</li>`;
			});
			return list;
		})
		.then((list) => {
			let loading = document.getElementById("loading-movies");
			list = list.parentElement;
			loading.classList.remove("d-block");
			loading.classList.add("d-none");
			list.classList.remove("d-none");
			list.classList.add("d-flex");
			return list;
		});
}
/**
 * Obtains the list of all downloads and loads the UI with the information (not yet implemented)
 * @returns a Promise to load the list of downloads into the page's Downloads list
 */
async function loadDownloads() {
	throw new Error("Not yet implemented");
}

async function getMovieCalendar() {
	let response = await requestData(
		"radarr",
		"/api/v3/calendar",
		"&start=2023-01-01&end=2023-12-01"
	);
	if (response.ok) {
		response.text().then(console.log);
	}
}
/**
 * Sorts array entries returned by the APIs of sonarr, radarr, and other "arr" programs; sorts by the first property that exists in both items from the list sortTitle, cleanTitle, titleSlug, and title; falls back to default sort otherwise.
 * @param {object} a an array entry from sonarr, radarr, or similar apps
 * @param {object} b another array entry
 * @returns a negative number if the appropriate sort order has a < b, a positive number if a > b, 0 if a=b
 */
function arrSort(a, b) {
	if (typeof a === "object" && typeof b === "object") {
		for (const property of ["sortTitle", "cleanTitle", "titleSlug", "title"]) {
			if (a[property] && b[property]) {
				return a[property].toString().localeCompare(b[property]);
			}
		}
	}
	let array1 = [a, b];
	if (array1.sort()[0] === b) return 1;
	let array2 = [b, a];
	if (array2.sort()[0] === a) return -1;
	return 0;
}

function getDateString(date) {
	if (date.getFullYear() === new Date(Date.now()).getFullYear()) {
		return date.toLocaleString("default", {
			month: "short",
			day: "numeric",
		});
	} else {
		return date.toLocaleString("default", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}
}
/**
 *
 * @param {Number} seriesId The sonarr series id of the show
 * @param {Date} airDate The date the requested episode aired
 * @returns A Promise for a boolean value reporting if all episodes of the given show from the given date are owned
 */
async function checkEpisode(seriesId, airDate) {
	// check if all episodes are downloaded
	// download episodes
	// save episodes in database
	// look for given airdate
	return requestData(
		"sonarr",
		"/api/v3/calendar",
		`start=${airDate.toJSON()}&end=${airDate.toJSON()}`
	)
		.then(processResponse)
		.then((response) => {
			response.json.response.forEach((episode) => {
				if (episode.seriesId === seriesId && !episode.hasFile) return false;
			});
			return true;
		});
}

async function checkAuth() {
	if (!(await hasAuth())) {
		let warning = document.createElement("div");
		warning.innerHTML =
			"<h1>Not Authorized<span class='visually hidden'>: </p></h1>";
		if (
			window.location.origin === "https://plex.aleph0.com" ||
			window.location.origin === "https://plex.aleph0.com:443"
		) {
			warning.innerHTML += `<p>The origin (${window.location.origin}) is correct, `;
			warning.innerHTML +=
				"So your authorization probably just needs to be refreshed. ";
			warning.innerHTML +=
				'Try refreshing the page or returning to <a href="https://plex.aleph0.com">https://plex.aleph0.com</a>.</p>';
		} else {
			warning.innerHTML += `<p>The origin (${window.location.origin}) is not 'https://plex.aleph0.com/. `;
			if (window.location.origin === "http://127.0.0.1:3000") {
				warning.innerHTML +=
					"Even though the web application allows them for testing from 127.0.01:3000, ";
				warning.innerHTML +=
					"this browser may be refusing third-party cookies, or your authorization may need to be refreshed. </p>";
				warning.innerHTML +=
					"<p>Try refreshing the page or visiting <a href='https://plex.aleph0.com/'>https://plex.aleph0.com</a> before returning here, ";
				warning.innerHTML +=
					"and consider allowing third-party cookies in your browser.</p>";
			} else {
				warning.innerHTML +=
					'You probably need to directly visit <a href="https://plex.aleph0.com">https://plex.aleph0.com</a>.</p>';
			}
		}
		console.warn(warning.innerText);
		return false;
	}
	return true;
}
async function hasAuth() {
	let response = await requestData("sonarr", "/ping");
	if (!response.ok) {
		if (debugMode) {
			console.debug(`Response code ${response.status}`);
			console.debug("Full response: ");
			console.debug(response);
		}
		console.warn("The app is not authorized.");
		return false;
	}
	try {
		let text = await response.text();
		if (debugMode) {
			console.debug("Response:");
			console.debug(text);
		}
		let json = JSON.parse(text);
		if (
			json.response &&
			json.response.status &&
			json.response.status === "OK"
		) {
			if (debugMode) console.debug("Response OK");
			return true;
		} else throw new Error("Unable to access API.");
	} catch (error) {
		console.warn(error);
		return false;
	}
}
function addDynamicContent() {
	let content = `
				<div
					class="tab-pane active show"
					id="home-content"
					role="tabpanel"
					aria-labelledby="home-tab"
				>
					<div class="container d-block text-center">
						<p>home</p>
					</div>
				</div>
				<div
					class="tab-pane"
					id="shows-content"
					role="tabpanel"
					aria-labelledby="shows-tab"
				>
					<div class="container d-block text-center" id="loading-shows">
						<p>Loading shows...</p>
						<div class="spinner-border" role="status" aria-hidden="true"></div>
					</div>
					<ul
						id="shows-list"
						class="d-none container list-group list-group-flush"
					></ul>
				</div>
				<div
					class="tab-pane"
					id="movies-content"
					role="tabpanel"
					aria-labelledby="movies-tab"
				>
					<div class="container d-block text-center" id="loading-movies">
						<p>Loading movies...</p>
						<div class="spinner-border" role="status" aria-hidden="true"></div>
					</div>
					<button
						type="button"
						class="btn btn-primary"
						id="button-movie-calendar"
						onclick="getMovieCalendar();"
					>
						Get Movie Calendar
					</button>
					<button type="button" class="btn btn-primary">
						Available movies
					</button>
					<button type="button" class="btn btn-primary">Wanted movies</button>
					<div class="container d-none overflow-auto" id="current-movies">
						<ul
							id="movies-list"
							class="container list-group list-group-flush"
						></ul>
					</div>
					<div class="container d-none" id="wanted-movies"></div>
				</div>
				<div
					class="tab-pane"
					id="downloads-content"
					role="tabpanel"
					aria-labelledby="downloads-tab"
				>
					<div class="container d-block text-center" id="loading-downloads">
						<p>Loading downloads...</p>
						<div class="spinner-border" role="status" aria-hidden="true"></div>
					</div>
				</div>
				<div
					class="tab-pane"
					id="advanced-content"
					role="tabpanel"
					aria-labelledby="advanced-tab"
				>
					<div class="container-fluid">
						<p>
							Any of the below may require logging into the Seedhost client
							area. These will <em>not</em> ask for confirmation. Results (or a
							login request) will open in the Seedhost client area in a new
							window.
						</p>

						<ul class="list-group">
							<li>
								<a
									name="restart-webserver"
									id="restart-webserver-button"
									class="btn btn-primary"
									href="https://www.seedhost.eu/whmcs/clientarea.php?action=productdetails&id=105973&modop=custom&a=reboot&opt=www"
									role="button"
									>Restart Webserver</a
								>
							</li>
							<li>
								<a
									href="https://www.seedhost.eu/whmcs/clientarea.php?action=productdetails&id=105973&modop=custom&a=reboot&opt=upgradePlexDediServer#tab11"
									>upgrade Plex</a
								>
							</li>
							<li>remove old torrents</li>
							<li>remove dead torrents</li>
							<li>restart all programs</li>
							<li>upgrade all programs</li>
							<li>hard reboot server</li>
						</ul>
					</div>
				</div>
`;
	let dynamicContent = document.createElement("div");
	dynamicContent.classList.add(
		"tab-content",
		"`container-fluid",
		"overflow-auto"
	);
	dynamicContent.id = "tab-content";
	dynamicContent.innerHTML = content;
	document.getElementsByTagName("main")[0].appendChild(dynamicContent);
}
function enableFooter() {
	let buttons = document
		.getElementById("footer-bar")
		.getElementsByClassName("nav-link");
	for (let index = 0; index < buttons.length; index++) {
		const element = buttons[index];
		element.removeAttribute("disabled");
	}
}
