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

function getPlayerHolder() {
    return document.getElementById("placeholder-player");
}

function toggleFullscreen(fullscreen) {
    var player = getPlayer();
    var player_style = player.style;
    var holder_style = getPlayerHolder().style;
    if (fullscreen) {
        document.body.style.overflow = "hidden"

        player_style.position = "absolute";
        var rect = player.getBoundingClientRect();
        var transform_scalew = window.innerWidth / rect.width;
        var transform_scaleh = window.innerHeight / rect.height;
        var transform_scale = Math.min(transform_scalew, transform_scaleh);
        player_style.transform = "scale(" + transform_scale + ", " + transform_scale +")";
        rect = player.getBoundingClientRect();
        var target_x = (window.innerWidth - rect.width) / 2;
        var target_y = (window.innerHeight - rect.height) / 2;
        //player_style.left = (target_x - rect.left) + "px";
        player_style.transform = "translate(" + (target_x - rect.left) + "px , " +
            (target_y - rect.top) + "px) scale(" + transform_scale + ", " + transform_scale +")";
        player_style.zIndex = "2000000001";

        holder_style.position = "absolute";
        holder_style.transform = "translate(" + (target_x - rect.left) + "px , " +
            (target_y - rect.top) + "px) scale(" + transform_scalew + ", " + transform_scaleh +")";
        holder_style.zIndex = "2000000000";
    } else {
        document.body.style.overflow = ""

        player_style.transform = "";
        player_style.zIndex = "";
        player_style.position = "";

        holder_style.position = "";
        holder_style.transform = "";
        holder_style.zIndex = "";
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