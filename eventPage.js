// Copyright (c) 2018, Dongseong Hwang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

!function() {
  // The tab being operated on.
  let currentTab = null;
  const VR_STATUS = {Disabled : 1, Normal : 2, VR : 3};
  let vrStatus_ = VR_STATUS.Disabled;

  function onUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status == "loading") {
      updateIcon(tab, VR_STATUS.Disabled);
      return;
    } else if (changeInfo.status == "complete") {
      currentTab = tab;
      chrome.tabs.executeScript(tabId, {file : "seek.js", runAt: "document_end"});
    }
  }

  function updateIcon(tab, status) {
    if (tab.url.indexOf("youtube.com") > 0) {
      switch (status) {
      case VR_STATUS.Disabled:
        localStorage["icon"] = "images/icon25_disabled.png";
        break;
      case VR_STATUS.Normal:
        localStorage["icon"] = "images/icon25.png";
        break;
      case VR_STATUS.VR:
        localStorage["icon"] = "images/icon25_back.png";
        break;
      }
      vrStatus_ = status;
      chrome.pageAction.setIcon(
          {"tabId" : tab.id, "path" : localStorage["icon"]});
      chrome.pageAction.show(tab.id);
    }
  }

  function nextAction() {
    if (vrStatus_ == VR_STATUS.Normal) {
      return VR_STATUS.VR;
    } else if (vrStatus_ == VR_STATUS.VR) {
      return VR_STATUS.Normal;
    }

    return VR_STATUS.Disabled;
  }

  // Called when user clicks on browser action
  chrome.pageAction.onClicked.addListener(function(tab) {
    if (vrStatus_ == VR_STATUS.Disabled) {
      // Need to try again?
      chrome.tabs.executeScript(currentTab.id, {file : "seek.js"});
      return;
    }

    chrome.tabs.sendMessage(currentTab.id,
                            {message : "toggleVR", action : nextAction()},
                            (response) => {
                              if (!response.success) {
                                console.log("Something wrong happens.");
                              }
                            });
  });

  // Setup a listener for handling requests from resolution.js.
  chrome.extension.onMessage.addListener(function(request, sender,
                                                  sendResponse) {
    if (request.message == "stateChanged") {
      updateIcon(currentTab, request.action);
    }
  });

  // wait for a tab to open with a youtube url.
  chrome.tabs.onUpdated.addListener(onUpdated);
}();
