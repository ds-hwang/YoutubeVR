// Copyright (c) 2018, Dongseong Hwang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// --------- NOTE: THIS FUNCTION IS INJECTED INTO THE PAGE DIRECTLY ---------
// It's because exmerimental API like VRFrameData doesn't work in content
// script. :(
function youtubeVrMain() {
  const VR_STATUS = {
    Normal : 1,
    VR : 2
  }

  // Youtube addes padding at the discontinuities
  const EPSILON = 0.0012;

  function getUtil() {
    function createShader(gl, source, type) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
      var program = gl.createProgram();
      var vshader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
      var fshader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
      gl.attachShader(program, vshader);
      gl.deleteShader(vshader);
      gl.attachShader(program, fshader);
      gl.deleteShader(fshader);
      gl.linkProgram(program);

      var log = gl.getProgramInfoLog(program);
      if (log) {
        console.log(log);
      }

      log = gl.getShaderInfoLog(vshader);
      if (log) {
        console.log(log);
      }

      log = gl.getShaderInfoLog(fshader);
      if (log) {
        console.log(log);
      }

      return program;
    };

    return {createProgram};
  }

  class Renderer {
    constructor() {
      this.canvas_ = document.createElement('canvas');
      this.onResize(100, 50);
      this.canvas_.style.display = "none";
      document.body.appendChild(this.canvas_);

      this.gl_ =
          this.canvas_.getContext('webgl2', {antialias : false, alpha : true});
      const isWebGL2 = !!this.gl_;
      if (!isWebGL2) {
        console.warn('WebGL 2 is not available.');
        return;
      }

      this.util = getUtil();
      this.initProgram();
      this.setVertexArray();
      this.vr_ = {display : null, frameData : new VRFrameData()};

      this.addVREventListeners();
      this.getDisplays();

      this.render_ = this.render.bind(this);
    }

    addVREventListeners() {
      window.addEventListener('vrdisplayactivate', _ => { this.activateVR(); });
      window.addEventListener('vrdisplaydeactivate',
                              _ => { this.deactivateVR(); });
    }

    activateVR() {
      if (!this.vr_.display)
        return;
      if (this.vr_.display.isPresenting)
        return;
      this.vr_.display.requestPresent([ {source : this.canvas_} ]).then(() => {
        this.vr_.display.requestAnimationFrame(this.render_);
      }).catch(e => {
        console.error(`Unable to init VR: ${e}`);
      });
    }

    deactivateVR() {
      if (!this.vr_.display)
        return;
      if (!this.vr_.display.isPresenting)
        return;

      this.vr_.display.exitPresent();
    }

    getDisplays() {
      return navigator.getVRDisplays().then((displays) => {
        // Filter down to devices that can present.
        displays = displays.filter(display => display.capabilities.canPresent);

        // If there are no devices available, quit out.
        if (displays.length === 0) {
          console.warn('No devices available able to present.');
          return;
        }

        // Store the first display we find. A more production-ready version
        // should allow the user to choose from their available displays.
        this.vr_.display = displays[0];

        const leftEye = this.vr_.display.getEyeParameters('left');
        const rightEye = this.vr_.display.getEyeParameters('right');
        const width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
        const height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
        this.onResize(width, height);
      })
      .catch((reason) => { console.error("WebVR is not supported: " + reason); });
    }

    onResize(width, height) {
      if (this.width_ == width && this.height_ == height)
        return;

      this.width_ = width;
      this.height_ = height;
      this.canvas_.width = this.width_;
      this.canvas_.height = this.height_;
    }

    initProgram() {
      this.program_ = this.util.createProgram(
          this.gl_, this.getVSShaderSource(), this.getFSShaderSource());
      this.mvMatrixLocation_ =
          this.gl_.getUniformLocation(this.program_, 'mvMatrix');
      this.pMatrixLocation_ =
          this.gl_.getUniformLocation(this.program_, 'pMatrix');
      this.textureLocation_ =
          this.gl_.getUniformLocation(this.program_, 'sTexture');
      this.texScaleLocation_ =
          this.gl_.getUniformLocation(this.program_, 'uTexScale');

      this.gl_.clearColor(0.0, 0.0, 0.0, 0.0);
      this.gl_.enable(this.gl_.DEPTH_TEST);
      this.gl_.enable(this.gl_.CULL_FACE);
      this.gl_.cullFace(this.gl_.BACK);
    }

    getVSShaderSource() {
      return "\
      #version 300 es \n\
      #define POSITION_LOCATION 0 \n\
      #define TEXCOORD_LOCATION 1 \n\
      #define TEX_OFFSET_LOCATION 2 \n\
      \n\
      precision highp float; \n\
      precision highp int; \n\
      \n\
      uniform mat4 mvMatrix; \n\
      uniform mat4 pMatrix; \n\
      \n\
      layout(location = POSITION_LOCATION) in vec3 position; \n\
      layout(location = TEXCOORD_LOCATION) in vec2 texcoord; \n\
      layout(location = TEX_OFFSET_LOCATION) in vec2 texOffset; \n\
      \n\
      out vec2 vUv; \n\
      out vec2 vTexOffset; \n\
      out vec3 vPosition; \n\
      \n\
      void main() { \n\
        vUv = texcoord; \n\
        vTexOffset = texOffset; \n\
        vPosition = vec3(mvMatrix * vec4(position, 1.0)); \n\
        gl_Position = pMatrix * mvMatrix * vec4(position, 1.0); \n\
      }";
    }

    getFSShaderSource() {
      return "\
      #version 300 es \n\
      #define INV_PI_2 0.636619772 \n\
      #define EPSILON 0.0005 \n\
      precision highp float; \n\
      precision highp int; \n\
      precision highp sampler2D; \n\
      \n\
      uniform sampler2D sTexture; \n\
      uniform vec2 uTexScale; \n\
      \n\
      in vec2 vUv; \n\
      in vec2 vTexOffset; \n\
      in vec3 vPosition; \n\
      \n\
      out vec4 color; \n\
      \n\
      void main() { \n\
        vec2 homogeneouseUv = (vUv * 2.) - 1.; \n\
        // Get UV on the EAC projection \n\
        vec2 eacUv = (INV_PI_2 * atan(homogeneouseUv)) + 0.5; \n\
        vec2 uvFor6Faces = (eacUv * uTexScale) + vTexOffset; \n\
        color = texture(sTexture, uvFor6Faces); \n\
      }";
    }

    setVertexArray() {
      /* clang-format off */
      // -- Init buffers
      const positions = new Float32Array([
        // Front face
        -1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        1.0, 1.0, -1.0,
        -1.0, 1.0, -1.0,

        // Back face
        1.0, -1.0, 1.0,
        -1.0, -1.0, 1.0,
        -1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,

        // Top face
        -1.0, 1.0, -1.0,
        1.0, 1.0, -1.0,
        1.0, 1.0, 1.0,
        -1.0, 1.0, 1.0,

        // Bottom face
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0,
        1.0, -1.0, -1.0,
        -1.0, -1.0, -1.0,

        // Right face
        1.0, -1.0, -1.0,
        1.0, -1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, -1.0,

        // Left face
        -1.0, -1.0, 1.0,
        -1.0, -1.0, -1.0,
        -1.0, 1.0, -1.0,
        -1.0, 1.0, 1.0
      ]);
      /* clang-format on */
      this.vertexPosBuffer_ = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexPosBuffer_);
      this.gl_.bufferData(this.gl_.ARRAY_BUFFER, positions,
                          this.gl_.STATIC_DRAW);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      /* clang-format off */
      const texCoords = new Float32Array([
        // Front face
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,

        // Back face
        0.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,

        // Top face
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,
        0.0, 1.0,

        // Bottom face
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,
        0.0, 1.0,

        // Right face
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,

        // Left face
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,
      ]);
      /* clang-format on */
      this.vertexTexBuffer_ = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexTexBuffer_);
      this.gl_.bufferData(this.gl_.ARRAY_BUFFER, texCoords,
                          this.gl_.STATIC_DRAW);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      /* clang-format off */
      const texOffsetCoords = new Float32Array([
        // Front face
        1 / 3, EPSILON,
        1 / 3, EPSILON,
        1 / 3, EPSILON,
        1 / 3, EPSILON,

        // Back face
        1 / 3, (1 / 2) + EPSILON,
        1 / 3, (1 / 2) + EPSILON,
        1 / 3, (1 / 2) + EPSILON,
        1 / 3, (1 / 2) + EPSILON,

        // Top face
        2 / 3, (1 / 2) + EPSILON,
        2 / 3, (1 / 2) + EPSILON,
        2 / 3, (1 / 2) + EPSILON,
        2 / 3, (1 / 2) + EPSILON,

        // Bottom face
        0, (1 / 2) + EPSILON,
        0, (1 / 2) + EPSILON,
        0, (1 / 2) + EPSILON,
        0, (1 / 2) + EPSILON,

        // Right face
        2 / 3, EPSILON,
        2 / 3, EPSILON,
        2 / 3, EPSILON,
        2 / 3, EPSILON,

        // Left face
        0, EPSILON,
        0, EPSILON,
        0, EPSILON,
        0, EPSILON,
      ]);
      /* clang-format on */
      this.vertexTexOffsetBuffer_ = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexTexOffsetBuffer_);
      this.gl_.bufferData(this.gl_.ARRAY_BUFFER, texOffsetCoords,
                          this.gl_.STATIC_DRAW);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      // Element buffer
      this.indexBuffer_ = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, this.indexBuffer_);

      const cubeVertexIndices = [
        0,  1,  2,  0,  2,  3,  // front
        4,  5,  6,  4,  6,  7,  // back
        8,  9,  10, 8,  10, 11, // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23  // left
      ];

      // Now send the element array to GL
      this.gl_.bufferData(this.gl_.ELEMENT_ARRAY_BUFFER,
                          new Uint16Array(cubeVertexIndices),
                          this.gl_.STATIC_DRAW);

      // -- Init VertexArray
      this.vertexArray_ = this.gl_.createVertexArray();
      this.gl_.bindVertexArray(this.vertexArray_);

      // set with GLSL layout qualifier
      const vertexPosLocation = 0;
      const vertexTexLocation = 1;
      const vertexTexOffsetLocation = 2;

      this.gl_.enableVertexAttribArray(vertexPosLocation);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexPosBuffer_);
      this.gl_.vertexAttribPointer(vertexPosLocation, 3, this.gl_.FLOAT, false,
                                   0, 0);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      this.gl_.enableVertexAttribArray(vertexTexLocation);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexTexBuffer_);
      this.gl_.vertexAttribPointer(vertexTexLocation, 2, this.gl_.FLOAT, false,
                                   0, 0);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      this.gl_.enableVertexAttribArray(vertexTexOffsetLocation);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, this.vertexTexOffsetBuffer_);
      this.gl_.vertexAttribPointer(vertexTexOffsetLocation, 2, this.gl_.FLOAT,
                                   false, 0, 0);
      this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, null);

      this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, this.indexBuffer_);

      this.gl_.bindVertexArray(null);
    }

    initTexture() {
      // TODO(dshwang): handle the case in which video isn't loaded yet.
      const videoElement = this.getVideo();

      if (this.texture_) {
        this.gl_.deleteTexture(this.texture_);
        this.texture_ = 0;
      }

      // -- Init 2D Texture
      this.texture_ = this.gl_.createTexture();
      this.gl_.activeTexture(this.gl_.TEXTURE0);
      this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture_);
      this.gl_.pixelStorei(this.gl_.UNPACK_FLIP_Y_WEBGL, false);
      this.gl_.texParameteri(this.gl_.TEXTURE_2D, this.gl_.TEXTURE_MAG_FILTER,
                             this.gl_.LINEAR);
      this.gl_.texParameteri(this.gl_.TEXTURE_2D, this.gl_.TEXTURE_MIN_FILTER,
                             this.gl_.LINEAR);
      this.gl_.texParameteri(this.gl_.TEXTURE_2D, this.gl_.TEXTURE_WRAP_S,
                             this.gl_.CLAMP_TO_EDGE);
      this.gl_.texParameteri(this.gl_.TEXTURE_2D, this.gl_.TEXTURE_WRAP_T,
                             this.gl_.CLAMP_TO_EDGE);

      // -- Allocate storage for the texture
      this.gl_.texImage2D(this.gl_.TEXTURE_2D, 0, this.gl_.RGBA,
                          videoElement.videoWidth, videoElement.videoHeight, 0,
                          this.gl_.RGBA, this.gl_.UNSIGNED_BYTE, videoElement);
      this.texture_.width_ = videoElement.videoWidth;
      this.texture_.height_ = videoElement.videoHeight;
      this.texture_.currentTime_ = videoElement.currentTime;
    }

    getVideo() { return document.getElementsByTagName("video")[0]; }

    updateTexture() {
      const videoElement = this.getVideo();
      if (this.texture_.currentTime_ == videoElement.currentTime)
        return;
      this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture_);
      this.gl_.pixelStorei(this.gl_.UNPACK_FLIP_Y_WEBGL, false);
      this.gl_.texSubImage2D(this.gl_.TEXTURE_2D, 0, 0, 0,
                             videoElement.videoWidth, videoElement.videoHeight,
                             this.gl_.RGBA, this.gl_.UNSIGNED_BYTE,
                             videoElement);
      this.texture_.currentTime_ = videoElement.currentTime;
    };

    needInitTexture() {
      if (!this.texture_)
        return true;

      const videoElement = this.getVideo();
      if (this.texture_.width_ != videoElement.videoWidth ||
          this.texture_.height_ != videoElement.videoHeight)
        return true;

      return false;
    }

    isVrMode() {
      return this.vr_ && this.vr_.display && this.vr_.display.isPresenting;
    }

    render() {
      if (!this.isVrMode())
        return;

      if (this.needInitTexture()) {
        this.initTexture();
      } else {
        this.updateTexture();
      }
      this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);

      const EYE_WIDTH = this.width_ * 0.5;
      const EYE_HEIGHT = this.height_;

      // Get all the latest data from the VR headset and dump it into
      // frameData.
      this.vr_.display.getFrameData(this.vr_.frameData);

      // Left eye.
      this.renderEye({x : 0, y : 0, w : EYE_WIDTH, h : EYE_HEIGHT},
                     this.vr_.frameData.leftViewMatrix,
                     this.vr_.frameData.leftProjectionMatrix);

      // Right eye.
      this.renderEye({x : EYE_WIDTH, y : 0, w : EYE_WIDTH, h : EYE_HEIGHT},
                     this.vr_.frameData.rightViewMatrix,
                     this.vr_.frameData.rightProjectionMatrix);

      // Call submitFrame to ensure that the device renders the latest image
      // from the WebGL context.
      this.vr_.display.submitFrame();

      // Use the VR display's in-built rAF (which can be a diff refresh rate
      // to the default browser one).
      this.vr_.display.requestAnimationFrame(this.render_);
    }

    renderEye(viewport, mvMatrix, projectionMatrix) {
      this.gl_.viewport(viewport.x, viewport.y, viewport.w, viewport.h);

      this.gl_.bindVertexArray(this.vertexArray_);
      this.gl_.useProgram(this.program_);
      this.gl_.uniformMatrix4fv(this.mvMatrixLocation_, false, mvMatrix);
      this.gl_.uniformMatrix4fv(this.pMatrixLocation_, false, projectionMatrix);
      this.gl_.uniform1i(this.textureLocation_, 0);
      const scale = {x : 1 / 3, y : (1 / 2) - (2 * EPSILON)};
      this.gl_.uniform2f(this.texScaleLocation_, scale.x, scale.y);

      this.gl_.activeTexture(this.gl_.TEXTURE0);
      this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture_);

      this.gl_.drawElementsInstanced(this.gl_.TRIANGLES, 36,
                                     this.gl_.UNSIGNED_SHORT, 0, 1);
    }

    destructuring() {
      this.gl_.deleteBuffer(this.vertexPosBuffer_);
      this.gl_.deleteBuffer(this.vertexTexBuffer_);
      this.gl_.deleteBuffer(this.vertexTexOffsetBuffer_);
      this.gl_.deleteBuffer(this.indexBuffer_);
      this.gl_.deleteTexture(this.texture_);
      this.gl_.deleteProgram(this.program_);
      this.gl_.deleteVertexArray(this.vertexArray_);
      document.body.removeChild(this.canvas_);
      this.vr_ = null;
      this.gl_ = null;
      canvas_ = null;
    }
  }

  class WebVR {
    constructor() {
      if (!this.canVR()) {
        console.log("WebVR isn't supported");
        return;
      }
      this.vrStatus_ = VR_STATUS.Normal;
      this.renderer_ = new Renderer();
      this.createPresentationButton();
      this.readyToPlay_ = true;
      this.addEventListeners();
    }

    // Video element itself
    getVideo() { return document.getElementsByTagName("video")[0]; }

    getControlContainer() {
      return document.getElementsByClassName("ytp-right-controls")[0];
    }

    hasVrVideo() { return !!document.getElementsByClassName("webgl")[0]; }

    canVR() { return !(typeof VRFrameData === 'undefined'); }

    createPresentationButton() {
      this.button_ = document.createElement('button');
      this.button_.classList.add('ytp-button');
      this.img_ = document.createElement("img");
      this.img_.src = this.vrOnImage();
      this.button_.appendChild(this.img_);
      this.button_.addEventListener('click',
                                    _ => { this.toggleVR(this.nextAction()); });

      // youtube.com doesn't have control, so need to wait for VR video to add
      // the button.
      this.button_.needToAdd_ = true;
    }

    ShowButton() {
      this.button_.style.visibility = "visible";

      if (this.button_.needToAdd_) {
        var parentElement = this.getControlContainer();
        var theFirstButton = parentElement.firstChild;
        parentElement.insertBefore(this.button_, theFirstButton);
        this.button_.needToAdd_ = false;
      }
    }

    HideButton() { this.button_.style.visibility = "hidden"; }

    addEventListeners() {
      // https://developers.google.com/youtube/iframe_api_reference
      const YT_STATE = {
        UNSTARTED : -1,
        ENDED : 0,
        PLAYING : 1,
        PAUSED : 2,
        BUFFERING : 3,
        VIDEO_CUED : 5
      };
      window.addEventListener('YoutubePlayerOnStateChange', (event) => {
        if (event.detail == YT_STATE.ENDED) {
          this.toggleVR(VR_STATUS.Normal);
        } else if (event.detail == YT_STATE.UNSTARTED) {
          this.toggleVR(VR_STATUS.Normal);
          this.HideButton();
          this.readyToPlay_ = true;
        } else if (this.readyToPlay_ && event.detail == YT_STATE.PLAYING) {
          // come to here once video is ready. only once per video.
          this.readyToPlay_ = false;
          if (this.hasVrVideo())
            this.ShowButton();
        }
      }, false);
    }

    vrOnImage() {
      return 'data:image/png;base64,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';
    }

    vrOffImage() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAABmJLR0QAAAAAAAD5Q7t/AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gMCByggGY06lQAAAWBJREFUWMPtmDFLw0AYhp+vplS6iNipIA7u4uSk4OZa3fwLgqOL4CKu4uC/ERT8Aw6OgoOTYJ1ELNamr8sFrrFKE5tE5F44yHck5Ml7ucu9gaAMklQ5gyUgZoakTeAYWAEaBd/7HbgFjszsOmHw3dlRdeqkHWoCXaDp+mOg6PGruZYoMrM4csW6B/MArAH9goEi4A6Yd/UecJ4ArXonXgBPI+NZ3CQ6AU5duUzKskT9MmCcPsaN459SAApAASgABaAA9F+A/M97vcS9dfRdx43XtwUsSnotGKYJHHr1PYA5N9Jb2CpUN7NBzcwwszdgt0KYjpkNvuQxSRuSLiX1JA0lxRO0oZceslzTk3Tlotf4TJjnZZa07wGdTXXa59xLz3rHjdLWoR/c66XSaGm5f0lSN0cq7UpqF7FSHwCtHM/SArYz/WyY0KEF4DmnwW0ze5wqkIOaAeYywryMrDFBv9Qni1uNy2IcSs8AAAAASUVORK5CYII=';
    }

    toggleVR(vrStatus) {
      this.vrStatus_ = vrStatus;
      if (this.vrStatus_ == VR_STATUS.VR) {
        this.img_.src = this.vrOffImage();
        this.getVideo().focus();
        this.renderer_.activateVR();
      } else if (this.vrStatus_ == VR_STATUS.Normal) {
        this.img_.src = this.vrOnImage();
        this.renderer_.deactivateVR();
      }
    }

    nextAction() {
      switch (this.vrStatus_) {
      case VR_STATUS.Normal:
        return VR_STATUS.VR;
      case VR_STATUS.VR:
        return VR_STATUS.Normal;
      }
    }
  }

  new WebVR();
}

function onYouTubePlayerReady(player) {
  player.addEventListener("onStateChange", (newState) => {
    window.dispatchEvent(
        new CustomEvent('YoutubePlayerOnStateChange', {detail : newState}));
  });
}

!function() {
  class WebVRContentScript {
    constructor() { this.injectYoutubeVrMain(); }

    injectYoutubeVrMain() {
      this.script_ = document.createElement('script');
      this.script_.appendChild(document.createTextNode(
          onYouTubePlayerReady.toString() + ';(' + youtubeVrMain + ')();'));
      document.documentElement.appendChild(this.script_);
    }
  }

  new WebVRContentScript();
}();