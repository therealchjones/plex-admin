"use strict";

const siteAddress = "https://plex.aleph0.com";
const apiAddress = `${siteAddress}/chjones/admin/api/index.cgi`;
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

const loadDynamicContent = getDynamicContent("html/content.html")
	.then(styleDynamicContent)
	.then(addDynamicContent)
	.catch((reason) => {
		throwFatalError(
			"An error occurred. Page content could not be loaded. Console output may include more information.",
			reason
		);
	});

Promise.all([loadDynamicContent, hasAuth()]).then(
	([dynamicContent, loggedIn]) => {
		if (debugMode) console.debug("displaying dynamic content");
		let loadingContent = document.getElementById("loading-content");
		loadingContent.classList.remove("d-flex");
		loadingContent.classList.add("d-none");
		dynamicContent.classList.remove("d-none");
		return setLogin(loggedIn);
	}
);
async function throwFatalError(message = "", error = null) {
	if (debugMode)
		console.debug(
			`Throwing fatal error. Message: ${message}. Error: ${error}.`
		);
	if (message.length === 0)
		message = "An unrecoverable error occurred. Halting.";
	await showErrorDialog(message);
	if (error === null) throw new Error(message);
	else throw new Error(message, { cause: error });
}
/**
 * Display an error dialog with an optional custom message. If no message
 * is given, the text "An error occurred. Console output may include more
 * information." is used.
 * @param {string} message Message to display in the dialog
 */
async function showErrorDialog(message = "") {
	let modal = document.getElementById("error-dialog");
	console.debug(modal);
	if (modal === null) modal = await buildErrorDialog();
	if (message.length === 0)
		message = "An error occurred. Console output may include more information.";
	modal.getElementsByClassName("modal-body")[0].innerText = message;
	const bsModal = new bootstrap.Modal(modal);
	console.debug("Modal modalized:");
	console.debug(bsModal);
	bsModal.show();
}
async function buildErrorDialog() {
	// because this may run even in the absence of the content template,
	// we create the dialog from scratch here
	const modal = document.createElement("div");
	modal.innerHTML = `<div class="modal-dialog modal-dialog-centered" role="document">
			<div class="modal-content">
				<div class="modal-body"></div>
			</div>
		</div>`;
	modal.classList.add("modal", "fade");
	modal.id = "error-dialog";
	modal.setAttribute("aria-labelledby", "Error");
	modal.setAttribute("role", "dialog");
	modal.setAttribute("aria-hidden", "true");
	modal.setAttribute("data-bs-backdrop", "static");
	console.debug("Modal created:");
	console.debug(modal);
	document.body.appendChild(modal);
	console.debug("Modal added:");
	console.debug(modal);
	return modal;
}

async function getDynamicContent(url) {
	return fetch(url)
		.then((response) => {
			if (!response.ok) throw new Error("Unable to download dynamic content.");
			else return response.text();
		})
		.then((htmlString) => {
			let parser = new DOMParser();
			return parser.parseFromString(htmlString, "text/html");
		});
}
async function styleDynamicContent(content) {
	await hideRequires(content);
	await hideTemplates(content);
	content.getElementById("tab-content").classList.add("tab-content");
	return content;
}
async function addDynamicContent(content) {
	const modals = content.getElementById("modal-dialogs");
	document.body.append(modals);
	const dynamicContent = content.getElementById("tab-content");
	dynamicContent.classList.add("d-none");
	document.getElementsByTagName("main")[0].appendChild(dynamicContent);
	await enableNavbar();
	return dynamicContent;
}
async function enableNavbar() {
	const navButtons = document
		.getElementById("footer-bar")
		.getElementsByClassName("nav-link");
	for (const element of navButtons) {
		element.removeAttribute("disabled");
	}
}
/**
 * Using television show data and a template element, returns a new element containing information about the show
 * @param {object} showData An object describing a show
 * @param {HTMLLIElement} template A template element on which to base the new element
 * @returns {Promise<HTMLLIElement>}
 */
async function buildShowEntry(showData, template) {
	let end = "";
	let previousAiring = showData.previousAiring;
	let nextAiring = "";
	if (showData.ended) {
		if (showData.lastAired) end = showData.lastAired;
		else if (previousAiring) end = previousAiring;
	} else {
		if (showData.nextAiring) nextAiring = showData.nextAiring;
	}
	let start = showData.firstAired ? showData.firstAired : showData.year;
	let title = showData.title;
	if (start) {
		start = new Date(start).getFullYear();
		// remove a date from the title if present
		if (/ \((19|20)..\)$/.test(title)) title = title.slice(0, -7);
	}
	if (end) end = new Date(end).getFullYear();
	let itemId = "show-item-" + showData.titleSlug;
	let sonarrId = showData.id;
	let entry = template.cloneNode(true);
	entry.classList.remove("template");
	entry.classList.remove("d-none");
	if (debugMode) console.debug(entry);
	entry.id = itemId;
	let templateString = entry.getElementsByClassName("item-title")[0].innerHTML;
	entry.getElementsByClassName("item-title")[0].innerHTML =
		templateString.replace(/itemTitle/, title);
	if (start)
		entry.getElementsByClassName(
			"item-years"
		)[0].innerHTML = `(${start}-${end})`;
	else entry.getElementsByClassName("item-years")[0].remove();
	if (showData.ended) entry.getElementsByClassName("item-airings")[0].remove();
	else {
		if (previousAiring) {
			previousAiring = new Date(previousAiring);
			templateString = entry.getElementsByClassName("item-previous-airing")[0]
				.innerHTML;
			entry.getElementsByClassName("item-previous-airing")[0].innerHTML =
				templateString.replace(/previousAiring/, getDateString(previousAiring));
			let confirmed = entry.getElementsByClassName("confirmed")[0];
			confirmed.classList.remove("d-inline-block");
			confirmed.classList.add("d-none");
			let disconfirmed = entry.getElementsByClassName("disconfirmed")[0];
			disconfirmed.classList.remove("d-inline-block");
			disconfirmed.classList.add("d-none");
			checkEpisode(sonarrId, previousAiring)
				.then((result) => {
					let pending = entry.getElementsByClassName("pending")[0];
					pending.classList.remove("d-inline-box");
					pending.classList.add("d-none");
					if (result) {
						confirmed.classList.remove("d-none");
						confirmed.classList.add("d-inline-block");
					} else {
						disconfirmed.classList.remove("d-none");
						disconfirmed.classList.add("d-inline-block");
					}
				})
				.catch((reason) => {
					console.error(
						`Unable to determine status of most recent episode of '${title}: ${reason}`
					);
				});
		} else {
			entry.getElementsByClassName("item-previous-airing").remove();
		}
		if (nextAiring) {
			nextAiring = new Date(nextAiring);
			nextAiring = getDateString(nextAiring);
		} else {
			nextAiring = "unknown";
		}
		templateString =
			entry.getElementsByClassName("item-next-airing")[0].innerHTML;
		entry.getElementsByClassName("item-next-airing")[0].innerHTML =
			templateString.replace(/nextAiring/, nextAiring);
	}
	return entry;
}

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
	}).catch((reason) => {
		console.log(`Rejected. ${reason}`);
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
	const showsDb = await getDb("shows");
	if (!showsDb.json || showsDb.json.response === undefined)
		throw new Error("No list of shows in database");
	let list = document.getElementById("shows-list");
	let template = document.getElementById("show-item-aps-template");
	let rowPromises = [];
	showsDb.json.response.forEach((element) => {
		rowPromises.push(buildShowEntry(element, template));
	});
	template.remove();
	await Promise.all(rowPromises)
		.then((results) => {
			results.forEach((element) => list.append(element));
		})
		.catch((reason) => {
			throw new Error(`One or more shows could not be added: ${reason}`);
		});
	let loading = document.getElementById("loading-shows");
	loading.classList.remove("d-block");
	loading.classList.add("d-none");
	list.classList.remove("d-none");
	list.classList.add("d-flex");
	return list;
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
	if (debugMode) {
		console.debug(
			"Attempting to request a secure resource to check authorization. A forthcoming 401 error is not unexpected and will be handled if necessary."
		);
	}
	let response = await requestData("sonarr", "/ping");
	if (!response.ok) {
		if (debugMode) {
			console.debug(`Response code ${response.status}`);
			console.debug("Full response: ");
			console.debug(response);
			console.debug("The app is not authorized.");
		}
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
function enableFooter() {
	let buttons = document
		.getElementById("footer-bar")
		.getElementsByClassName("nav-link");
	for (let index = 0; index < buttons.length; index++) {
		const element = buttons[index];
		const elementName = element.id.replace(/-.*$/, "");
		element.setAttribute("aria-controls", `${elementName}-content`);
		element.setAttribute("data-bs-target", `#${elementName}-content`);
	}
}
async function setLogin(loggedIn) {
	if (loggedIn) {
		return login();
	} else {
		return logout();
	}
}
/**
 * The login() function does not actually log a user in, but it updates the interface to be
 * appropriate for a logged in user. This is useful for testing, but server-side functions
 * requiring login will still not work if the user is not actually logged in.
 *
 * @returns a Promise that fulfills with "true" if data from the server requiring login is returned successfully
 */
async function login() {
	hideRequiresNotLoggedIn(document);
	showRequiresLoggedIn(document);
	enableFooter();
	return Promise.all([loadShows(), loadMovies()])
		.then(() => true)
		.catch((reason) => {
			throw new Error(`Unable to load remote content. Reason: ${reason}`);
		});
}
async function logout() {
	hideRequiresLoggedIn(document);
	document
		.getElementById("login-message")
		.getElementsByTagName("a")[0].href = `/oauth/login?return=${encodeURI(
		document.location.href
	)}`;
	showRequiresNotLoggedIn(document);
	return false;
}
function hideRequires(htmlDocument) {
	hideRequiresLoggedIn(htmlDocument);
	hideRequiresNotLoggedIn(htmlDocument);
	return htmlDocument;
}
function hideRequiresLoggedIn(htmlDocument) {
	Array.from(htmlDocument.getElementsByClassName("requires-logged-in")).forEach(
		(element) => {
			element.classList.add("d-none");
		}
	);
	return htmlDocument;
}
function hideRequiresNotLoggedIn(htmlDocument) {
	Array.from(
		htmlDocument.getElementsByClassName("requires-not-logged-in")
	).forEach((element) => {
		element.classList.add("d-none");
	});
	return htmlDocument;
}
function showRequiresLoggedIn(htmlDocument) {
	Array.from(htmlDocument.getElementsByClassName("requires-logged-in")).forEach(
		(element) => {
			element.classList.remove("d-none");
		}
	);
	return htmlDocument;
}

function showRequiresNotLoggedIn(htmlDocument) {
	Array.from(
		htmlDocument.getElementsByClassName("requires-not-logged-in")
	).forEach((element) => {
		element.classList.remove("d-none");
	});
	return htmlDocument;
}
function hideTemplates(htmlDocument) {
	Array.from(htmlDocument.getElementsByClassName("template")).forEach(
		(element) => element.classList.add("d-none")
	);
}
