YUI.add('query-executor', function (Y) {
	YUI.namespace('com.imaginea.mongoV');
	var MV = YUI.com.imaginea.mongoV;
	var successHandler, failureHandler;

	MV.loadQueryBox = function(keysUrl, dataUrl, sHandler, fHandler) {

		successHandler = sHandler;
		failureHandler = fHandler;
		/**
		 * Create XHR data source to fetch the documents/files.
		 * This dataSource will be used to populate JSON/Treeble views
		 */
		MV.dataSource = new YAHOO.util.XHRDataSource(dataUrl, {
			responseType: YAHOO.util.XHRDataSource.TYPE_JSON,
			responseSchema: {
				resultsList: "response.result"
			}
		});

		/**
		 * It sends request to get the keys from first 10 records only. Updates all key with another request.
		 */
		Y.io(keysUrl, {
			method: "GET",
			data : 'allKeys=false',
			on: {
				success: function(ioId, responseObject) {
					populateQueryBox(ioId, responseObject);
					executeQuery(null);
					// Now sending request to fetch all keys
					populateAllKeys();
				},
				failure: function(ioId, responseObject) {
					MV.hideLoadingPanel();
					MV.showAlertMessage("Unexpected Error: Could not load the query Box", MV.warnIcon);
					Y.log("Could not send the request to get the keys in the collection. Response Status: [0]".format(responseObject.statusText), "error");
				}
			}
		});

		function populateAllKeys() {
			Y.io(keysUrl, {
				method: "GET",
				data : 'allKeys=true',
				on: {
					success: function(ioId, responseObject) {
						var parsedResponse = Y.JSON.parse(responseObject.responseText);
						var keys = parsedResponse.response.result.keys;
						if (keys !== undefined) {
							var innerHTML = formatKeys(keys);
							Y.one('#fields').set('innerHTML', innerHTML);
						}
					},
					failure: function(ioId, responseObject) {
						MV.hideLoadingPanel();
						MV.showAlertMessage("Unexpected Error: Could not load the query Box", MV.warnIcon);
						Y.log("Could not send the request to get the keys in the collection. Response Status: [0]".format(responseObject.statusText), "error");
					}
				}
			});
		}
	};

	/**
	 *The function is success handler for the request of getting all the keys in a collections.
	 *It parses the response, gets the keys and makes the query box. It also sends the request to load the
	 *documents after the query box has been populated,
	 * @param {Number} e Id
	 * @param {Object} The response Object
	 */
	function populateQueryBox(ioId, responseObject) {
		var parsedResponse, keys, count, queryForm, error;
		Y.log("Preparing to show QueryBox", "info");
		try {
			parsedResponse = Y.JSON.parse(responseObject.responseText);
			keys = parsedResponse.response.result.keys;
			count = parsedResponse.response.result.count;
			if (keys !== undefined || count !== undefined) {
				document.getElementById('queryExecutor').style.display = 'block';
				queryForm = Y.one('#queryForm');
				queryForm.addClass('form-cont');
				MV.header.set("innerHTML", "");
				MV.mainBody.empty(true);
				queryForm.set("innerHTML", getForm(keys, count));
				initListeners(Y);
				Y.log("QueryBox loaded", "info");
			} else {
				error = parsedResponse.response.error;
				Y.log("Could not get keys. Message: [0]".format(error.message), "error");
				MV.showAlertMessage("Could not load the query Box! [0]".format(MV.errorCodeMap(error.code)), MV.warnIcon);
			}
		} catch (e) {
			Y.log("Could not parse the JSON response to get the keys", "error");
			Y.log("Response received: [0]".format(responseObject.responseText), "error");
			MV.showAlertMessage("Cannot parse Response to get keys!", MV.warnIcon);
		}
	}

	/**
	 *The function is an event handler for the execute query button. It gets the query parameters
	 *and sends a request to get the documents
	 * @param {Object} event The event object
	 */
	function executeQuery(event) {
		var queryParams = getQueryParameters();
		if (queryParams !== undefined) {
			MV.showLoadingPanel("Loading Documents...")
			MV.dataSource.sendRequest(queryParams, {
				success: function(request, response) {
					updateAnchors(response.results[0].count);
					successHandler(response);
				},
				failure: failureHandler
			});
		}
	}

	function initListeners() {
		Y.on("click", executeQuery, "#execQueryButton");
		Y.on("click", handleSelect, "#selectAll");
		Y.on("click", handleSelect, "#unselectAll");
		Y.on("click", handlePagination, "#first");
		Y.on("click", handlePagination, "#prev");
		Y.on("click", handlePagination, "#next");
		Y.on("click", handlePagination, "#last");
		Y.on("keyup", function(eventObject) {
			// insert a ctrl + enter listener for query evaluation
			if (eventObject.ctrlKey && eventObject.keyCode === 13) {
				Y.one('#execQueryButton').simulate('click');
			}
		}, "#queryBox");
		Y.on("keyup", function(eventObject) {
			// insert a ctrl + enter listener for query evaluation on skip field
			if (eventObject.ctrlKey && eventObject.keyCode === 13) {
				Y.one('#execQueryButton').simulate('click');
			}
		}, "#skip");
		Y.on("keyup", function(eventObject) {
			// insert a ctrl + enter listener for query evaluation on limit field
			if (eventObject.ctrlKey && eventObject.keyCode === 13) {
				Y.one('#execQueryButton').simulate('click');
			}
		}, "#limit");
	}

	var getForm = function(keys, count) {
		var checkList = "", selectTemplate = "";
		if (keys !== undefined) {
			selectTemplate = [
				"<a id='selectAll' class='navigationRight' href='javascript:void(0)'>Select All</a>",
				"<label> / </label>",
				"<a id='unselectAll' href='javascript:void(0)'>Unselect All</a>"
			].join('\n');
			checkList = "<label for='fields' ></label><ul id='fields' class='checklist'>";
			checkList += formatKeys(keys);
			checkList += "</ul>";
		}
        return upperPartTemplate.format(MV.StateManager.currentColl()) + checkList + lowerPartTemplate +
            selectTemplate + paginatorTemplate.format(count < 25 ? count : 25, count);
	};

	function formatKeys(keys) {
		var checkList = "";
		for (var index = 0; index < keys.length; index++) {
			checkList += checkListTemplate.format(keys[index], keys[index], keys[index], keys[index]);
		}
		return checkList;
	}

    var upperPartTemplate = [
        "<textarea id='queryBox' name='queryBox' class='queryBox'>",
        "db.[0].find({\r\r})",
        "</textarea>"
    ].join('\n');

	var checkListTemplate = "<li><label for='[0]'><input id='[1]' name='[2]' type='checkbox' checked=true />[3]</label></li>";

	var lowerPartTemplate = [
		"<br/>",
		"<label for='skip'> Skip: </label><input id='skip' type='text' name='skip' value='0'/>",
		"<label for='limit'> Limit: </label><span><select id='limit' name='limit'><option value='10'>10</option><option value='25'>25</option><option value='50'>50</option></select></span>",
		"<button id='execQueryButton' class='bttn'>Execute Query</button>"
	].join('\n');

	var paginatorTemplate = [
		"</br></br>",
		"<a id='first' href='javascript:void(0)'>&laquo; First</a>",
		"<a id='prev'  href='javascript:void(0)'>&lsaquo; Previous</a>",
		"<a id='next' href='javascript:void(0)'>Next &rsaquo;</a>",
		"<a id='last' href='javascript:void(0)'>Last &raquo;</a>",
		"<label>Showing</label>","<label id='startLabel'> 1 </label>","<label> - </label>",
		"<label id='endLabel'> [0] </label>", "<label> of </label>","<label id='countLabel'> [1] </label>"
	].join('\n');


	MV.hideQueryForm = function () {
		var queryForm = Y.one('#queryForm');
		queryForm.removeClass('form-cont');
		queryForm.set("innerHTML", "");
		document.getElementById('queryExecutor').style.display = 'none';
	};

	function handleSelect(event) {
		var id = event.currentTarget.get("id");
		var elements = Y.Selector.query('ul[id=fields] input');
		if (id === "selectAll") {
			Y.Array.each(elements, function(element) {
				element.checked = true;
			});
		} else {
			Y.Array.each(elements, function(element) {
				element.checked = false;
			});
		}
	}

	function handlePagination(event) {
		var href = event.currentTarget.get("href");
		if (href == null || href == undefined || href == "")
			return;
		var id = event.currentTarget.get("id");
		var skip = Y.one('#skip'), limit = Y.one('#limit'), count = Y.one('#countLabel');
		var skipValue = parseInt(skip.get('value')), limitValue = parseInt(limit.get('value')), countValue = parseInt(count.get('text'));
		if (id === "first") {
			skip.set('value', 0);
		} else if (id === "prev") {
			skip.set('value', (skipValue - limitValue) < 0 ? 0 : (skipValue - limitValue));
		} else if (id === "next") {
			skip.set('value', skipValue + limitValue);
		} else if (id === "last") {
			skip.set('value', countValue - limitValue);
		}
		Y.one('#execQueryButton').simulate('click');
		updateAnchors(countValue);
	}

	function updateAnchors(count) {
		var first = Y.one('#first'), prev = Y.one('#prev'), next = Y.one('#next'), last = Y.one('#last');
		var start = Y.one('#startLabel'), end = Y.one('#endLabel'), countLabel = Y.one('#countLabel');
		var skip = parseInt(Y.one('#skip').get('value')), limit = parseInt(Y.one('#limit').get('value'));
		if (skip == 0) disableAnchor(first);
		else enableAnchor(first);
		if (skip + limit <= limit) disableAnchor(prev);
		else enableAnchor(prev);
		if (skip >= count - limit) disableAnchor(next);
		else enableAnchor(next);
		if (skip + limit >= count) disableAnchor(last);
		else enableAnchor(last);
		start.set('text', count != 0 ? skip + 1 : 0);
		end.set('text', count < skip + limit ? count : skip + limit);
		countLabel.set('text', count);

	}

	function enableAnchor(obj) {
		obj.setAttribute('href', 'javascript:void(0)');
		obj.setStyle('color', '#39C');
	}

	function disableAnchor(obj) {
		obj.removeAttribute('href');
		obj.setStyle('color', 'grey');
	}

	/**
	 * This function gets the query parameters from the query box. It takes the
	 * query string, the limit value, skip value and the fields selected and return a
	 * query parameter string which will be added to the request URL
	 * @returns {String} Query prameter string
	 *
	 */
	function getQueryParameters() {
		var parsedQuery, query = Y.one('#queryBox').get("value").trim(),
				limit = Y.one('#limit').get("value"),
				skip = Y.one('#skip').get("value").trim(),
				fields = Y.all('#fields input'),
				index = 0,
				checkedFields = [],
				item;

		if (query === "") {
			query = "{}";
		}

		//replace the single quotes (') in the query string by double quotes (")
		query = query.replace(/'/g, '"');
		query = query.replace(/\r/g, '');
		query = query.replace(/\n/g, '');

		try {
			for (index = 0; index < fields.size(); index++) {
				item = fields.item(index);
				if (item.get("checked")) {
					checkedFields.push(item.get("name"));
				}
			}
			return ("&limit=[0]&skip=[1]&fields=[2]&query=[3]".format(limit, skip, checkedFields, query));
		} catch (error) {
			Y.log("Could not parse query. Reason: [0]".format(error), "error");
			MV.showAlertMessage("Failed:Could not parse query. [0]".format(error), MV.warnIcon);
		}
	}

}, '3.3.0', {
	requires : ["json-parse", "node-event-simulate"]
});
