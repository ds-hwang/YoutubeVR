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
    var embeddedPlayer = document.getElementById("movie_player");
    var fullScreenPlayer = document.getElementById("video-player-flash");
    if(document.getElementById("movie_player") != null && document.getElementById("movie_player").getElementsByTagName("video").length > 0){
	return null;
    }
    if(embeddedPlayer != null){
	return embeddedPlayer;
    }
    if(fullScreenPlayer != null){
	return fullScreenPlayer;
    }
    return null;
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
    if(position == null) return;
    // wait at least x second before trying to pause video
    var intervalID2 = setInterval( function () {
	    clearInterval(intervalID2);
    }, 5000);

    player = getPlayer();
    if(player == null) return;
    if(player.getPlayerState() == 1){
	// video is playing so we can seek to beginning and pause it.
	player.seekTo(position,false);
	player.pauseVideo();
    }else if(player.getPlayerState() == 3){
	// video is buffering so need to wait
	// Note, player.addEventListener DOES NOT WORK
	// so we are required to go through the wait loops instead.
	var num_tries = 0;
	var intervalID = setInterval( function () {
	    var stop_once = 0;
	    var max_tries = 50;
	    num_tries += 1;
	    player = getPlayer();
	    if(player == null) return;
	    if(player.getPlayerState() == 1){
		player.seekTo(position,false);
		player.pauseVideo();
		clearInterval(intervalID);
	    }else  if(num_tries == max_tries){
		// just fail
		clearInterval(intervalID);
	    }
	}, 500);
    }
}

/**
 * Returns the quality name that youtube expects.
 * @param name the name received from the options
 * Valid values: 240p, 360p, 480p, hd720, hd1080
 * @return the resoltion expected by YouTube.
 **/
function getResolutionValue(name){
    if(name == "240p"){
	return "small";
    }else if(name == "360p"){
	return "medium";
    }else if(name == "480p"){
	return "large";
    }else if(name == "720p"){
	return "hd720";
    }else if(name == "1080p"){
	return "hd1080"
    }
    return "large";
}

/**
 * The compare method for sorting the array from lowest to highest resolution.
 **/
function orderLowestToHighest(a, b){
    //possible values: hd1080, hd720, large, medium,small
    if( a == "small"){
	if(b == "medium" || b == "large" || b == "hd720" || b == "hd1080"){
	    return -1;
	}
    }else if(a == "medium"){
	if(b == "small"){
	    return 1;
	}else if(b == "large" || b == "hd720" || b == "hd1080"){
	    return -1;
	}
    }else if (a == "large"){
	if(b == "small" || b == "medium"){
	    return 1;
	}else if(b == "hd720" || b == "hd1080"){
	    return -1;
	}
    }else if(a == "hd720"){
	if(b == "small" || b == "medium" || b == "large"){
	    return 1;
	}else if(b == "1080"){
	    return -1;
	}
    }else if(a == "hd1080"){
	if(b == "small" || b == "medium" || b == "large" || b == "hd720"){
	    return 1;
	}
    }else if (a == b){
	return 0;
    }
}

/**
 * Returns the next highest resolution to use based on the quality.
 * @param quality the specified quality level.
 * @param resolution_list the list that contains the resolutions.
 **/
function getNextHighestResolution(quality,resolution_list){
    // sort the list based on lowest to highest
    resolution_list.sort(orderLowestToHighest);
    var i = 0;
    var res = "";
    // special case since if the quality is small or medium
    // then the loweset res is small
    if(quality == "small" || quality == "medium"){
	return quality;
    }else if(quality == "large"){
	for(i = resolution_list.length -1; i >= 0; i--){
	    if(resolution_list[i] == "medium"){
		res = "medium";
	    }else if(resolution_list[i] == "small" && res == ""){
		res = "small";
	    }
	}
    }else if(quality == "hd720"){
	for(i = resolution_list.length -1; i >= 0; i--){
	    if(resolution_list[i] == "large"){
		res = "large";
	    }else if(resolution_list[i] == "medium" && res == ""){
		res = "medium";
	    }else if(resolution_list[i] == "small" && res == ""){
		res = "small";
	    }
	}
    }else if(quality == "hd1080"){
	for(i = resolution_list.length -1; i >= 0; i--){
	    if(resolution_list[i] == "hd720"){
		res = "hd720";
	    }else if(resolution_list[i] == "large" && res == ""){
		res = "large";
	    }else if(resolution_list[i] == "medium" && res == ""){
		res = "medium";
	    }else if(resolution_list[i] == "small" && res == ""){
		res = "small";
	    }
	}
    }
    return res;
}

/**
 * Handles the autopause of the video.
 **/
function setAutoPause(){
    var player = getPlayer();
    // wait at least x second before trying to pause video
    var intervalID2 = setInterval( function () {
	    clearInterval(intervalID2);
    }, 5000);

    player = getPlayer();
    if(player == null) return;
    if(player.getPlayerState() == 1){
	// video is playing so we can seek to beginning and pause it.
	player.seekTo(0,0);
	player.pauseVideo();
    }else if(player.getPlayerState() == 3){
	// video is buffering so need to wait
	// Note, player.addEventListener DOES NOT WORK
	// so we are required to go through the wait loops instead.
	var num_tries = 0;
	var intervalID = setInterval( function () {
	    var stop_once = 0;
	    var max_tries = 50;
	    num_tries += 1;
	    player = getPlayer();
	    if(player == null) return;
	    if(player.getPlayerState() == 1){
		player.seekTo(0,0);
		player.pauseVideo();
		clearInterval(intervalID);
	    }else  if(num_tries == max_tries){
		// just fail
		clearInterval(intervalID);
	    }
	}, 500);
    }
}

/**
 * Sets the resolution of the video by selecting the highest resolution available that matches the specified quality.
 * @param quality the quality to set.
 * @param force true if the resolution should be forced regardles if the player "exists".
 * @param autoPause Yes if the video should be automatically paused on startup and No otherwise.
 * @param seek the time in seconds of the position in the video to seek to.
 * @return true if the resolution was set and false otherwise.
**/
function setResolutionBySettings(quality,force, autoPause, seek){
    var player = getPlayer();
    var realQuality = getResolutionValue(quality);
    if(player != null){
	var resolution_list = player.getAvailableQualityLevels();
	var i = 0;
	if(resolution_list.length != null) {
	    for(i = 0; i < resolution_list.length; i++){
		if(resolution_list[i] == realQuality){
		    player.setPlaybackQuality(realQuality);
		    //ToDo fix seek to position.
		    //setSeekPosition(seek);
		    // check for autopause
		    if(autoPause == "Yes"){
			setAutoPause();
		    }
		    return true;
		}
	    }
	    // need to find the closest resolution
	    realQuality = getNextHighestResolution(realQuality,resolution_list);
	    player.setPlaybackQuality(realQuality);
	    //setSeekPosition(seek);
	    return true;
	}else if(force){
	    player.setPlaybackQuality(realQuality);
	    //setSeekPosition(seek);
	    if(autoPause == "Yes"){
		setAutoPause();
	    }
	    return true;
	}
    }
    return false;
}


/**
 * Sets the resolution of the video waiting for the video to buffer first before setting the resolution.
 **/
function setResolution(quality,autoPause,seek){
    var num_tries = 0;

    // pause 1 second before video starts to ensure the resolution gets changed
    var intervalID2 = setInterval( function () {
	    clearInterval(intervalID2);
    }, 1000);

    var intervalID = setInterval( function () {
	var player = getPlayer();
	if(player == null) return;
	var stop_once = 0;
	var max_tries = 10;
	num_tries += 1;
	if(player.getPlayerState() == 1){
	    if(!setResolutionBySettings(quality,false,autoPause,seek)){
		setResolutionBySettings(quality,true,autoPause,seek);
	    }
	    clearInterval(intervalID);
	}else if(num_tries == max_tries){
	    setResolutionBySettings(quality,true,autoPause,seek);
	    clearInterval(intervalID);
	}
    }, 500);
}

// Send a Request to get the resolution and auto pause options.
// Then sent a message indicating that the background can reset updates.
chrome.extension.sendMessage({message: "quality"}, 
    function(response) {
	var localQuality = response.optionsArray[0];
	var autoPause = response.optionsArray[1];
	var seek = response.optionsArray[2];
	if (localQuality != "None") {
	    document.addEventListener('DOMContentLoaded', setResolution(localQuality,autoPause,seek));
	    chrome.extension.sendMessage({message: "reset"});
	}
    }
);