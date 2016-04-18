var saveButton;

/**
 * Initialize the settings.
 **/
function init() {
    qualityPulldown = document.getElementById("quality");
    expandedModeOnlyPulldown = document.getElementById("expandedModeOnly");
    autoPausePulldown = document.getElementById("autoPause");
    autoExpandPulldown = document.getElementById("autoExpand");
    saveButton = document.getElementById("save-button");

    qualityPulldown.value = localStorage.quality || "None";
    expandedModeOnlyPulldown.value = localStorage.expandedModeOnly || "Yes";
    autoPausePulldown.value = localStorage.autoPause || "No";
    autoExpandPulldown.value = localStorage.autoExpand || "No";

    // add event listenes
    document.querySelector('#save-button').addEventListener('click', save);
    document.querySelector('#cancel-button').addEventListener('click', init);
}

function refresh_page() {
    var data = '\
<html>\
<head>\
<title>Window Expander For YouTube - Options</title>\
<style>\
body {\
  font-family:helvetica, arial, sans-serif;\
  font-size:80%;\
  margin:10px;\
}\
\
#header {\
  padding-bottom:1.5em;\
  padding-top:1.5em;\
}\
\
#header h1 {\
  font-size: 156%;\
  display:inline;\
  padding-bottom:43px;\
  padding-left:75px;\
  padding-top:40px;\
  background:url(YouTubeWindowExpander_128x128.png) no-repeat;\
  background-size:67px;\
  background-position:1px 18px;\
}\
\
.section-header {\
  background:#ebeff9;\
  border-top:1px solid #b5c7de;\
  font-size:99%;\
  padding:3px 0 2px 5px;\
  font-weight:bold;\
  margin-bottom:1em;\
  margin-top:4em;\
}\
\
.section-header.first {\
  margin-top:1em;\
}\
\
#custom-domain {\
  width:300px;\
  margin-left:2px;\
}\
\
#footer {\
  margin-top:4em;\
}\
</style>\
</head>\
<body>\
\
<div id="header"><h1>Window Expander For YouTube Options</h1></div>\
\
<p>\
<h3>Saved</h3>\
</p>\
<div class="section-header first">Quality Settings</div>\
<p>\
Quality Level: <b>'+localStorage.quality+'</b>\
<br>\
Quality Only In Expanded Mode: <b>'+localStorage.expandedModeOnly+'</b>\
<br>\
Auto Pause: <b>'+localStorage.autoPause+'</b>\
<br>\
Auto Expand: <b>'+localStorage.autoExpand+'</b>\
<br>\
</p>\
</body>\
</html>';
    document.write(data);
}

/**
 * Save the settings.
 * TODO should check if in incognito mode
 * and not save localy if it is.
 **/
function save() {
    localStorage["quality"] = qualityPulldown.value;
    localStorage["expandedModeOnly"] = expandedModeOnly.value;
    localStorage["autoPause"] = autoPause.value;
    localStorage["autoExpand"] = autoExpand.value;
    //chrome.extension.getBackgroundPage().init();

    // Update status to let user know options were saved.
     var status = document.getElementById("status");
     status.innerHTML = "Options Saved.";
     setTimeout(function() {
	status.innerHTML = "";
     }, 750);
    // Update status to inform user options were saved
    //document.open();
    //refresh_page();
    //document.close();
}

function markDirty() {
  saveButton.disabled = false;
}

function markClean() {
  saveButton.disabled = true;
}

//init();
document.addEventListener('DOMContentLoaded', init);