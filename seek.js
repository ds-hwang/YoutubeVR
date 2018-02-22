// Copyright (c) 2018, Dongseong Hwang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

!function() {
  const VR_STATUS = {Disabled : 1, Normal : 2, VR : 3}

  class WebVR {
    constructor() {
      this.vrStatus_ = VR_STATUS.Disabled;

      chrome.extension.onMessage.addListener(
          (request, sender, sendResponse) => {
            if (request.message == "toggleVR") {
              this.toggleVR(request.action);
              sendResponse({success : true});
            }
          });

      // ready to process
      this.updateStatus();
    }

    // Video element itself
    getVideo() { return document.getElementsByTagName("video")[0]; }

    canVR() {
      // if (typeof VRFrameData === 'undefined')
      //   return false;
      return !!document.getElementsByClassName("webgl")[0];
    }

    toggleVR(status) {
      this.vrStatus_ = status;
      if (this.vrStatus_ == VR_STATUS.VR) {
        console.log("toogleVR: VR");
        // player_style.position = "absolute";
        // getMoviePlayer().classList.remove("html5-video-player");
        // getMoviePlayer().classList.add("ytp-big-mode");

        this.getVideo().focus();
        this.getVideo().addEventListener("ended", _ => { this.videoDone(); },
                                         {capture : false, once : true});
      } else if (this.vrStatus_ == VR_STATUS.Normal) {
        console.log("toogleVR: Normal");
      }
      chrome.extension.sendMessage(
          {message : "stateChanged", action : this.vrStatus_});
    }

    videoDone() {
      if (this.vrStatus_ == VR_STATUS.Normal) {
        this.toggleVR(VR_STATUS.VR);
      }
    }

    updateStatus() {
      const status = this.canVR() ? VR_STATUS.Normal : VR_STATUS.Disabled;
      chrome.extension.sendMessage({message : "stateChanged", action : status});
    }
  }

  new WebVR();
}();