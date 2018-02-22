// Copyright (c) 2018, Dongseong Hwang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

!function() {
  const VR_STATUS = {Disabled : 1, Normal : 2, VR : 3}

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
    constructor(canVR) {
      this.canvas_ = document.createElement('canvas');
      this.onResize(100, 50);
      this.canvas_.style.display = "none";
      document.body.appendChild(this.canvas_);

      this.gl_ = this.canvas_.getContext('webgl2', {antialias : true});
      const isWebGL2 = !!this.gl_;
      if (!isWebGL2) {
        console.log('WebGL 2 is not available.');
        return;
      }

      if (!canVR) {
        console.log('WebVR is not available.');
        return;
      }

      this.util = getUtil();
      this.initProgram();
      this.setVertexArray();
      this.initTexture();
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

      this.vr_.display.requestPresent([ {source : this.canvas_} ]).catch(e => {
        console.error(`Unable to init VR: ${e}`);
      });

      this.vr_.display.requestAnimationFrame(this.render_);
    }

    deactivateVR() {
      if (!this.vr_.display)
        return;
      if (!this.vr_.display.isPresenting)
        return;

      this.vr_.display.exitPresent();
    }

    getDisplays() {
      return navigator.getVRDisplays().then(displays => {
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
        this.createPresentationButton();
      });
    }

    onResize(width, height) {
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
      const videoElement_ = this.getVideo();
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
      this.gl_.texImage2D(this.gl_.TEXTURE_2D, 0, this.gl_.RGB, this.gl_.RGB,
                          this.gl_.UNSIGNED_BYTE, videoElement_);
    }

    getVideo() { return document.getElementsByTagName("video")[0]; }

    updateTexture() {
      const videoElement_ = this.getVideo();
      this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture_);
      this.gl_.pixelStorei(this.gl_.UNPACK_FLIP_Y_WEBGL, false);
      this.gl_.texSubImage2D(this.gl_.TEXTURE_2D, 0, videoElement_.width,
                             videoElement_.height, this.gl_.RGB,
                             this.gl_.UNSIGNED_BYTE, videoElement_);
    };

    isVrMode() {
      return this.vr_ && this.vr_.display && this.vr_.display.isPresenting;
    }

    render() {
      if (!this.isVrMode())
        return;

      this.updateTexture();
      this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);

      const EYE_WIDTH = this.width_ * 0.5;
      const EYE_HEIGHT = this.height_;

      // Get all the latest data from the VR headset and dump it into frameData.
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

      // Use the VR display's in-built rAF (which can be a diff refresh rate to
      // the default browser one).
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
      this.vrStatus_ = VR_STATUS.Disabled;
      const status = this.canVR() ? VR_STATUS.Normal : VR_STATUS.Disabled;
      this.updateStatus(status);
      if (status == VR_STATUS.Disabled)
        return;

      this.renderer_ = new Renderer(this.canVR());
      chrome.extension.onMessage.addListener(
        (request, sender, sendResponse) => {
          if (request.message == "toggleVR") {
            this.toggleVR(request.action);
            sendResponse({success : true});
          }
        });
    }

    // Video element itself
    getVideo() { return document.getElementsByTagName("video")[0]; }

    canVR() {
      if (typeof VRFrameData === 'undefined')
        return false;
      return !!document.getElementsByClassName("webgl")[0];
    }

    toggleVR(status) {
      this.vrStatus_ = status;
      if (this.vrStatus_ == VR_STATUS.VR) {
        console.log("toogleVR: VR");
        this.getVideo().focus();
        this.getVideo().addEventListener("ended", _ => {
          if (this.vrStatus_ == VR_STATUS.VR)
            this.toggleVR(VR_STATUS.Normal);
        }, {capture : false, once : true});
        this.renderer_.activateVR();
      } else if (this.vrStatus_ == VR_STATUS.Normal) {
        console.log("toogleVR: Normal");
        this.renderer_.deactivateVR();
      }
      this.updateStatus(this.vrStatus_);
    }

    updateStatus(status) {
      chrome.extension.sendMessage({message : "stateChanged", action : status});
    }
  }

  new WebVR();
}();