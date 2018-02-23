// Copyright (c) 2018, Dongseong Hwang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

!function() {
  // The tab being operated on.
  let currentTab_ = null;
  const VR_VIDEO = {NonExist : 1, Exist : 2};
  let didInjected_ = false;

  function updateIcon(tab, hasVrVideo) {
    if (tab && tab.url && tab.url.indexOf("youtube.com") > 0) {
      switch (hasVrVideo) {
      case VR_VIDEO.NonExist:
        localStorage["icon"] = "images/icon25_disabled.png";
        break;
      case VR_VIDEO.Exist:
        localStorage["icon"] = "images/icon25.png";
        didInjected_ = true;
        break;
      }
      chrome.pageAction.setIcon(
          {"tabId" : tab.id, "path" : localStorage["icon"]});
      chrome.pageAction.show(tab.id);
    }
  }

  // Setup a listener for handling requests from resolution.js.
  chrome.extension.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == "stateChanged") {
      updateIcon(currentTab_, request.action);
    }
  });

  // wait for a tab to open with a youtube url.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status == "loading") {
      updateIcon(tab, VR_VIDEO.NonExist);
      return;
    } else if (changeInfo.status == "complete") {
      currentTab_ = tab;
      // next video after the first VR video.
      if (didInjected_)
        chrome.tabs.sendMessage(currentTab_.id, {message : "queryStatus"});
    }
  });
}();
