/**
 * GPL V3
 **/

/**
 * Parses the Youtube url and puts it into popup mode in the same tab
 * adds a listener to chrome.tabs.onUpdated.addListener(setIconForYouTube);
 **/

/**
 * Used for checking when to update the resolution.
 **/
var isResUpdated = false;

/**
 * Used for checking if the autoexpand has been used.
 **/
var currentURLName = null;

/**
 * Contains the seek position of the video.
 */
var seek = 0;

/**
 * The tab being operated on.
 */
var currentTab = null;

/**
 * Returns true if should auto expand and false otherwise.
 * @param url the current full path URL of the tab.
 **/
function isAutoExpand(url){
    if (localStorage["autoExpand"] == "Yes"){
	var newName = getURLVideoName(url);
	if(currentURLName == null){
	    currentURLName = newName;
	    return true;
	}
	// if url's don't match then we must do an autoexpand
	if (currentURLName != newName){
	    currentURLName = newName;
	    return true;
	}
    }
    return false;
}

/**
 * Returns true if the window is maximized and false otherwise.
 **/
function isMaximized(tab){
    if (tab.url.indexOf("watch_popup") > 0){
	return true;
    } else {
	return false;
    }
}

/**
 * Calls a javascript file that changes the resolution to the preferred resolution.
 * Only sets resolution if the window is expanded or if the expandedModeOnly option 
 * is set to No.
 **/
function setResolution(tabId, changeInfo, tab){
    // complete should mean that the page is done loading;
    // however, it seems that the different frames in this tab
    // also respond so must make sure that we only respond once
    if(changeInfo.status == "complete" && !isResUpdated){
	isResUpdated = true;
	if (isMaximized(tab) || localStorage["expandedModeOnly"] == "No"){
	    chrome.tabs.executeScript(tab.id, {file: "resolution.js"});
	}

	// wait to make sure page is fully loaded
	// before allowing the resolution.js script from being run.
	// prevents resolution from being called multiple times
	// for the same video
	var intervalID = setInterval( function () {
	    isResUpdated = false;
	    clearInterval(intervalID);
	}, 5000);
    }
}

/**
 * Sets the page icon for youtube.com and changes from max to min icons.
 **/
function setIconForYouTube(tabId, changeInfo, tab) {
    isResUpdated = false;
    var addListener = true;
    if (tab.url.indexOf("youtube.com") > 0 ){
	if (isMaximized(tab)){
	    localStorage["icon"] = "YouTubeWindowExpander_min_25x25.png";
	    chrome.pageAction.setIcon({"tabId": tabId, "path":localStorage["icon"]});
	    chrome.pageAction.show(tabId);
	} else {
	    localStorage["icon"] = "YouTubeWindowExpander_25x25.png";
	    chrome.pageAction.setIcon({"tabId": tabId, "path":localStorage["icon"]});
	    chrome.pageAction.show(tabId);
	    // for the auto expand option
	    if (isAutoExpand(tab.url)){
		addListener = false;
		maximizeYouTubeWindow(tab,tab.url);
	    }
	}
	if (addListener){
	    // set the resolution
	    chrome.tabs.onUpdated.addListener(setResolution);
	}
    }
}

/**
 * Returns the name of the video.
 * Indicated by the URL without any http, youtube.com, and slashes.
 * @param url the URL of the tab.
 **/
function getURLVideoName(url){
    var index = url.indexOf("watch_popup");
    if (index > 0){
	return url.substring(index + 14);
    } 
    index = url.indexOf("watch");
    if (index > 0){
	return url.substring(index + 8);
    }
	// must be a channel, so lets write out a popup
    // taking care of channel case
    var url_split = url.split('#');
    if (url_split.length == 2) {
	var url_last = url_split[1];
	var url_slash = url_last.split('/');
	if (url_slash.length >= 4 ){
	    return  url_slash[url_slash.length-1];
	}
    }
    return null;
}

/**
 * Handles maximizing the YouTube Window.
 * @param tab the tab that will be modified.
 * @param url the URL of the tab.
 **/
function maximizeYouTubeWindow(tab, url){
    // check for https or http
    var offset = 5;
    var channelString = "http://www.youtube.com/watch_popup?v=";
    if(url.indexOf("https") == 0){
	channelString = "https://www.youtube.com/watch_popup?v=";
    }
    var index = url.indexOf("watch");
    if (index > 0){
	//example
	//http://www.youtube.com/watch?v=tlZXhhbGGXo
	// Note, this is how to get access to YouTube API
	//http://www.youtube.com/v/VIDEO_ID?enablejsapi=1&version=3
	var newURL = url.substring(0,index) + "watch_popup" + url.substring(index + offset);
	chrome.tabs.update(tab.id,{"url":newURL});
    } else {
	// must be a channel, so lets write out a popup
	// examples
	//http://www.youtube.com/user/x#p/u/1/tlZXhhbGGXo
	//http://www.youtube.com/user/x
	//http://www.youtube.com/user/x#p/u

	// taking care of channel case
	var url_split = url.split('#');
	if (url_split.length == 2) {
	    var url_last = url_split[1];
	    var url_slash = url_last.split('/');
	    if (url_slash.length >= 4 ){
		var newURL = channelString + url_slash[url_slash.length-1];
		chrome.tabs.update(tab.id,{"url":newURL});
	    }
	}
    }
}

/**
 * Minimizes YouTube Window.
 * @param tab the tab to be effected.
 * @param url the full url of the tab's address.
 * @param watch_popup_index the index in the url of 'watch_popup' string.
 **/
function minimizeYouTubeWindow(tab, url, watch_popup_index){
    var newURL = url.substring(0,watch_popup_index) + "watch" + url.substring(watch_popup_index + 11);
    chrome.tabs.update(tab.id,{"url":newURL});
}

function handleClickedRequest(){
    var tab = currentTab;
    var url = tab.url;
    var do_maximize = true;
    // check if watch_popup or watch is in url
    var watch_popup_index = url.indexOf("watch_popup");
    if (watch_popup_index > 0) {
	do_maximize = false;
    }

    if (do_maximize){
	maximizeYouTubeWindow(tab,url);
    } else {
	minimizeYouTubeWindow(tab,url,watch_popup_index);
    }
}
// Called when user clicks on browser action
chrome.pageAction.onClicked.addListener(function(tab) {
    currentTab = tab;
    //get the seek-time of the video if available
    chrome.tabs.executeScript(tab.id, {file: "seek.js"});
    //console.error("[eventPage.js:onClicked] seek = "+seek);
    /*
    var url = tab.url;
    var do_maximize = true;
    // check if watch_popup or watch is in url
    var watch_popup_index = url.indexOf("watch_popup");
    if (watch_popup_index > 0) {
	do_maximize = false;
    }

    if (do_maximize){
	maximizeYouTubeWindow(tab,url);
    } else {
	minimizeYouTubeWindow(tab,url,watch_popup_index);
    }
    */
});

/**
 * Setup a listener for handling requests from resolution.js.
 **/
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
	if (request.message == "quality"){
	    var optionsArray = [];
	    optionsArray[0] = localStorage["quality"];
	    optionsArray[1] = localStorage["autoPause"];
	    optionsArray[2] = seek;
	    sendResponse({optionsArray: optionsArray});
	}else if(request.message == "reset"){
	    isResUpdated = false;
	}else if(request.message == "seekReady"){
	    chrome.tabs.sendMessage(currentTab.id,{message: "getSeek"}, 
		function(response) {
		    seek = response.optionsArray[0];
		    handleClickedRequest();
		}
	    );
	}
    }
);

// wait for a tab to open with a youtube url.
chrome.tabs.onUpdated.addListener(setIconForYouTube);