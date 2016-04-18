/**
 * GPL V3
 **/

/**
 * Returns the youtube player object.
 * Note, the id of the youtube player object is different for 
 * embedded than full screen.
 * TODO: handle html5 players.
 * @return the player and null if doens't exist.
 */
function getPlayer(){
    //console.dir(document.getElementById("movie_player").getElementsByTagName("video")[0]);
    // For now, detect that html5 video but since we are unable to get the player
    // return null
    if(document.getElementById("movie_player") != null && document.getElementById("movie_player").getElementsByTagName("video").length > 0){
	return null;
    }
    var embeddedPlayer = document.getElementById("movie_player");
    var fullScreenPlayer = document.getElementById("video-player-flash");
    if(embeddedPlayer != null){
	return embeddedPlayer;
    }
    if(fullScreenPlayer != null){
	return fullScreenPlayer;
    }
    return null;
}

/**
 * Returns the position in seconds of the youtube video.
 * @return the position in seconds.
 */
function getSeekPosition(){
    var player = getPlayer();
    if(player == null){ 
	return null;
    }
    return player.getCurrentTime();
}

/**
 * Sets the seek of the video.
 * @param position the position in seconds to set the video.
 */
function setSeekPosition(position){
    var player = getPlayer();
    if(player == null){ 
	return null;
    }
    player.seekTo(position,true);
}

// send the response from finding a seek
chrome.extension.sendMessage({message: "seekReady"});

chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
	if (request.message == "getSeek"){
	    var optionsArray = [];
	    optionsArray[0] = getSeekPosition();
	    sendResponse({optionsArray: optionsArray});
	}
    }
);