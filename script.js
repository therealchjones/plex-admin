"use strict";

const apiAddress = "https://plex.aleph0.com/chjones/admin/proxy.cgi";
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

/*
loadShows();
loadMovies();
loadDownloads();
*/

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
 * @returns {Promise<object>} A Promise to proces the response that resolves with an object representing the response
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
	json.response.sort(arrSort);
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
				list.innerHTML += `<li class="list-group-item list-group-item-action py-3 lh-sm">${element.title}</li>`;
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
	throw new Error("Not yet implemented");
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
