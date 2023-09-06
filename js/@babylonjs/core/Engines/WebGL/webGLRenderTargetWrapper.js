import { RenderTargetWrapper } from "../renderTargetWrapper.js";
/** @internal */
export class WebGLRenderTargetWrapper extends RenderTargetWrapper {
    constructor(isMulti, isCube, size, engine, context) {
        super(isMulti, isCube, size, engine);
        /**
         * @internal
         */
        this._framebuffer = null;
        /**
         * @internal
         */
        this._depthStencilBuffer = null;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        /**
         * @internal
         */
        this._MSAAFramebuffer = null;
        // Multiview
        /**
         * @internal
         */
        this._colorTextureArray = null;
        /**
         * @internal
         */
        this._depthStencilTextureArray = null;
        /**
         * @internal
         */
        this._disposeOnlyFramebuffers = false;
        this._context = context;
    }
    _cloneRenderTargetWrapper() {
        let rtw = null;
        if (this._colorTextureArray && this._depthStencilTextureArray) {
            rtw = this._engine.createMultiviewRenderTargetTexture(this.width, this.height);
            rtw.texture.isReady = true;
        }
        else {
            rtw = super._cloneRenderTargetWrapper();
        }
        return rtw;
    }
    _swapRenderTargetWrapper(target) {
        super._swapRenderTargetWrapper(target);
        target._framebuffer = this._framebuffer;
        target._depthStencilBuffer = this._depthStencilBuffer;
        target._MSAAFramebuffer = this._MSAAFramebuffer;
        target._colorTextureArray = this._colorTextureArray;
        target._depthStencilTextureArray = this._depthStencilTextureArray;
        this._framebuffer = this._depthStencilBuffer = this._MSAAFramebuffer = this._colorTextureArray = this._depthStencilTextureArray = null;
    }
    /**
     * Shares the depth buffer of this render target with another render target.
     * @internal
     * @param renderTarget Destination renderTarget
     */
    _shareDepth(renderTarget) {
        super._shareDepth(renderTarget);
        const gl = this._context;
        const depthbuffer = this._depthStencilBuffer;
        const framebuffer = renderTarget._MSAAFramebuffer || renderTarget._framebuffer;
        if (renderTarget._depthStencilBuffer && renderTarget._depthStencilBuffer !== depthbuffer) {
            gl.deleteRenderbuffer(renderTarget._depthStencilBuffer);
        }
        renderTarget._depthStencilBuffer = depthbuffer;
        const attachment = renderTarget._generateStencilBuffer ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
        this._engine._bindUnboundFramebuffer(framebuffer);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, depthbuffer);
        this._engine._bindUnboundFramebuffer(null);
    }
    /**
     * Binds a texture to this render target on a specific attachment
     * @param texture The texture to bind to the framebuffer
     * @param attachmentIndex Index of the attachment
     * @param faceIndexOrLayer The face or layer of the texture to render to in case of cube texture or array texture
     * @param lodLevel defines the lod level to bind to the frame buffer
     */
    _bindTextureRenderTarget(texture, attachmentIndex = 0, faceIndexOrLayer, lodLevel = 0) {
        var _a, _b, _c, _d;
        if (!texture._hardwareTexture) {
            return;
        }
        const framebuffer = this._framebuffer;
        const currentFB = this._engine._currentFramebuffer;
        this._engine._bindUnboundFramebuffer(framebuffer);
        if (this._engine.webGLVersion > 1) {
            const gl = this._context;
            const attachment = gl["COLOR_ATTACHMENT" + attachmentIndex];
            if (texture.is2DArray || texture.is3D) {
                faceIndexOrLayer = (_b = faceIndexOrLayer !== null && faceIndexOrLayer !== void 0 ? faceIndexOrLayer : (_a = this.layerIndices) === null || _a === void 0 ? void 0 : _a[attachmentIndex]) !== null && _b !== void 0 ? _b : 0;
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, attachment, texture._hardwareTexture.underlyingResource, lodLevel, faceIndexOrLayer);
            }
            else if (texture.isCube) {
                // if face index is not specified, try to query it from faceIndices
                // default is face 0
                faceIndexOrLayer = (_d = faceIndexOrLayer !== null && faceIndexOrLayer !== void 0 ? faceIndexOrLayer : (_c = this.faceIndices) === null || _c === void 0 ? void 0 : _c[attachmentIndex]) !== null && _d !== void 0 ? _d : 0;
                gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_CUBE_MAP_POSITIVE_X + faceIndexOrLayer, texture._hardwareTexture.underlyingResource, lodLevel);
            }
            else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture._hardwareTexture.underlyingResource, lodLevel);
            }
        }
        else {
            // Default behavior (WebGL)
            const gl = this._context;
            const attachment = gl["COLOR_ATTACHMENT" + attachmentIndex + "_WEBGL"];
            const target = faceIndexOrLayer !== undefined ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + faceIndexOrLayer : gl.TEXTURE_2D;
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, target, texture._hardwareTexture.underlyingResource, lodLevel);
        }
        this._engine._bindUnboundFramebuffer(currentFB);
    }
    /**
     * Set a texture in the textures array
     * @param texture the texture to set
     * @param index the index in the textures array to set
     * @param disposePrevious If this function should dispose the previous texture
     */
    setTexture(texture, index = 0, disposePrevious = true) {
        super.setTexture(texture, index, disposePrevious);
        this._bindTextureRenderTarget(texture, index);
    }
    /**
     * Sets the layer and face indices of every render target texture
     * @param layers The layer of the texture to be set (make negative to not modify)
     * @param faces The face of the texture to be set (make negative to not modify)
     */
    setLayerAndFaceIndices(layers, faces) {
        var _a, _b;
        super.setLayerAndFaceIndices(layers, faces);
        if (!this.textures || !this.layerIndices || !this.faceIndices) {
            return;
        }
        // the length of this._attachments is the right one as it does not count the depth texture, in case we generated it
        const textureCount = (_b = (_a = this._attachments) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : this.textures.length;
        for (let index = 0; index < textureCount; index++) {
            const texture = this.textures[index];
            if (!texture) {
                // The target type was probably -1 at creation time and setTexture has not been called yet for this index
                continue;
            }
            if (texture.is2DArray || texture.is3D) {
                this._bindTextureRenderTarget(texture, index, this.layerIndices[index]);
            }
            else if (texture.isCube) {
                this._bindTextureRenderTarget(texture, index, this.faceIndices[index]);
            }
            else {
                this._bindTextureRenderTarget(texture, index);
            }
        }
    }
    /**
     * Set the face and layer indices of a texture in the textures array
     * @param index The index of the texture in the textures array to modify
     * @param layer The layer of the texture to be set
     * @param face The face of the texture to be set
     */
    setLayerAndFaceIndex(index = 0, layer, face) {
        super.setLayerAndFaceIndex(index, layer, face);
        if (!this.textures || !this.layerIndices || !this.faceIndices) {
            return;
        }
        const texture = this.textures[index];
        if (texture.is2DArray || texture.is3D) {
            this._bindTextureRenderTarget(this.textures[index], index, this.layerIndices[index]);
        }
        else if (texture.isCube) {
            this._bindTextureRenderTarget(this.textures[index], index, this.faceIndices[index]);
        }
    }
    dispose(disposeOnlyFramebuffers = this._disposeOnlyFramebuffers) {
        const gl = this._context;
        if (!disposeOnlyFramebuffers) {
            if (this._colorTextureArray) {
                this._context.deleteTexture(this._colorTextureArray);
                this._colorTextureArray = null;
            }
            if (this._depthStencilTextureArray) {
                this._context.deleteTexture(this._depthStencilTextureArray);
                this._depthStencilTextureArray = null;
            }
        }
        if (this._framebuffer) {
            gl.deleteFramebuffer(this._framebuffer);
            this._framebuffer = null;
        }
        if (this._depthStencilBuffer) {
            gl.deleteRenderbuffer(this._depthStencilBuffer);
            this._depthStencilBuffer = null;
        }
        if (this._MSAAFramebuffer) {
            gl.deleteFramebuffer(this._MSAAFramebuffer);
            this._MSAAFramebuffer = null;
        }
        super.dispose(disposeOnlyFramebuffers);
    }
}
//# sourceMappingURL=webGLRenderTargetWrapper.js.map