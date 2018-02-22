// Used for checking when to update the resolution.
var isResUpdated = false;

// The tab being operated on.
var currentTab = null;

// Sets the page icon for youtube.com and changes from max to min icons.
function setIconForYouTube(tabId, changeInfo, tab) {
	toggleIcon(tab , false);
}

function toggleIcon(tab, fullscreen) {
    if (tab.url.indexOf("youtube.com") > 0 ){
		if (fullscreen){
		    localStorage["icon"] = "images/icon25_back.png";
		    chrome.pageAction.setIcon({"tabId": tab.id, "path":localStorage["icon"]});
		    chrome.pageAction.show(tab.id);
		} else {
		    localStorage["icon"] = "images/icon25.png";
		    chrome.pageAction.setIcon({"tabId": tab.id, "path":localStorage["icon"]});
		    chrome.pageAction.show(tab.id);
		}
    }
}

// Called when user clicks on browser action
chrome.pageAction.onClicked.addListener(function(tab) {
    currentTab = tab;
    //get the seek-time of the video if available
    chrome.tabs.executeScript(tab.id, {file: "seek.js"});
});

/**
 * Setup a listener for handling requests from resolution.js.
 **/
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
	if(request.message == "ack") {
	    chrome.tabs.sendMessage(currentTab.id, {message: "toggleFullscreen"},
			function(response) {
				if (!response.success) {
					console.log("Something wrong happens.");
				}
			}
	    );
	} else if(request.message == "stateChanged") {
		toggleIcon(currentTab, request.action);
	} else if(request.message == "reset") {
	    isResUpdated = false;
	}
    }
);

// wait for a tab to open with a youtube url.
chrome.tabs.onUpdated.addListener(setIconForYouTube);