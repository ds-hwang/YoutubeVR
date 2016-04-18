/**
 * GPL V3
 **/

/**
 * Returns the youtube player object.
 * @return the player and null if doens't exist.
 */
function getPlayer() {
    return document.getElementById("player-api");
}

function toggleFullscreen(fullscreen) {
    var player = getPlayer();
    var player_style = player.style;
    if (fullscreen) {
        player_style.position = "absolute";
        var rect = player.getBoundingClientRect();
        var transform_scalew = window.innerWidth / rect.width;
        var transform_scaleh = window.innerHeight / rect.height;
        player_style.transform = "scale(" + transform_scalew + ", " + transform_scaleh +")";
        rect = player.getBoundingClientRect();
        var target_x = (window.innerWidth - rect.width) / 2;
        var target_y = (window.innerHeight - rect.height) / 2;
        //player_style.left = (target_x - rect.left) + "px";
        player_style.transform = "translate(" + (target_x - rect.left) + "px , " +
            (target_y - rect.top) + "px) scale(" + transform_scalew + ", " + transform_scaleh +")";
        player_style.zIndex = "19999999999999999999999";
        document.body.style.overflow = "hidden"
    } else {
        player_style.transform = "";
        player_style.zIndex = "";
        player_style.position = "";
        document.body.style.overflow = ""
    }
}

// send the response from finding a seek
chrome.extension.sendMessage({message: "ready"});

chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
	if (request.message == "toggleFullscreen") {
        toggleFullscreen(request.action);
	    sendResponse({success: true});
	}
    }
);