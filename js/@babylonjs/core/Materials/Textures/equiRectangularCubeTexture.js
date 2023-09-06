import { PanoramaToCubeMapTools } from "../../Misc/HighDynamicRange/panoramaToCubemap.js";
import { BaseTexture } from "./baseTexture.js";
import { Texture } from "./texture.js";
import { Tools } from "../../Misc/tools.js";
import "../../Engines/Extensions/engine.rawTexture.js";

import { LoadImage } from "../../Misc/fileTools.js";
/**
 * This represents a texture coming from an equirectangular image supported by the web browser canvas.
 */
export class EquiRectangularCubeTexture extends BaseTexture {
    /**
     * Instantiates an EquiRectangularCubeTexture from the following parameters.
     * @param url The location of the image
     * @param scene The scene the texture will be used in
     * @param size The cubemap desired size (the more it increases the longer the generation will be)
     * @param noMipmap Forces to not generate the mipmap if true
     * @param gammaSpace Specifies if the texture will be used in gamma or linear space
     * (the PBR material requires those textures in linear space, but the standard material would require them in Gamma space)
     * @param onLoad — defines a callback called when texture is loaded
     * @param onError — defines a callback called if there is an error
     */
    constructor(url, scene, size, noMipmap = false, gammaSpace = true, onLoad = null, onError = null, supersample = false) {
        super(scene);
        this._onLoad = null;
        this._onError = null;
        if (!url) {
            throw new Error("Image url is not set");
        }
        this._coordinatesMode = Texture.CUBIC_MODE;
        this.name = url;
        this.url = url;
        this._size = size;
        this._supersample = supersample;
        this._noMipmap = noMipmap;
        this.gammaSpace = gammaSpace;
        this._onLoad = onLoad;
        this._onError = onError;
        this.hasAlpha = false;
        this.isCube = true;
        this._texture = this._getFromCache(url, this._noMipmap, undefined, undefined, undefined, this.isCube);
        if (!this._texture) {
            if (!scene.useDelayedTextureLoading) {
                this._loadImage(this._loadTexture.bind(this), this._onError);
            }
            else {
                this.delayLoadState = 4;
            }
        }
        else if (onLoad) {
            if (this._texture.isReady) {
                Tools.SetImmediate(() => onLoad());
            }
            else {
                this._texture.onLoadedObservable.add(onLoad);
            }
        }
    }
    /**
     * Load the image data, by putting the image on a canvas and extracting its buffer.
     * @param loadTextureCallback
     * @param onError
     */
    _loadImage(loadTextureCallback, onError) {
        const canvas = document.createElement("canvas");
        LoadImage(this.url, (image) => {
            this._width = image.width;
            this._height = image.height;
            canvas.width = this._width;
            canvas.height = this._height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const imageData = ctx.getImageData(0, 0, image.width, image.height);
            this._buffer = imageData.data.buffer;
            canvas.remove();
            loadTextureCallback();
        }, (_, e) => {
            if (onError) {
                onError(`${this.getClassName()} could not be loaded`, e);
            }
        }, null);
    }
    /**
     * Convert the image buffer into a cubemap and create a CubeTexture.
     */
    _loadTexture() {
        const scene = this.getScene();
        const callback = () => {
            const imageData = this._getFloat32ArrayFromArrayBuffer(this._buffer);
            // Extract the raw linear data.
            const data = PanoramaToCubeMapTools.ConvertPanoramaToCubemap(imageData, this._width, this._height, this._size, this._supersample);
            const results = [];
            // Push each faces.
            for (let i = 0; i < 6; i++) {
                const dataFace = data[EquiRectangularCubeTexture._FacesMapping[i]];
                results.push(dataFace);
            }
            return results;
        };
        if (!scene) {
            return;
        }
        this._texture = scene
            .getEngine()
            .createRawCubeTextureFromUrl(this.url, scene, this._size, 4, scene.getEngine().getCaps().textureFloat ? 1 : 7, this._noMipmap, callback, null, this._onLoad, this._onError);
    }
    /**
     * Convert the ArrayBuffer into a Float32Array and drop the transparency channel.
     * @param buffer The ArrayBuffer that should be converted.
     * @returns The buffer as Float32Array.
     */
    _getFloat32ArrayFromArrayBuffer(buffer) {
        const dataView = new DataView(buffer);
        const floatImageData = new Float32Array((buffer.byteLength * 3) / 4);
        let k = 0;
        for (let i = 0; i < buffer.byteLength; i++) {
            // We drop the transparency channel, because we do not need/want it
            if ((i + 1) % 4 !== 0) {
                floatImageData[k++] = dataView.getUint8(i) / 255;
            }
        }
        return floatImageData;
    }
    /**
     * Get the current class name of the texture useful for serialization or dynamic coding.
     * @returns "EquiRectangularCubeTexture"
     */
    getClassName() {
        return "EquiRectangularCubeTexture";
    }
    /**
     * Create a clone of the current EquiRectangularCubeTexture and return it.
     * @returns A clone of the current EquiRectangularCubeTexture.
     */
    clone() {
        const scene = this.getScene();
        if (!scene) {
            return this;
        }
        const newTexture = new EquiRectangularCubeTexture(this.url, scene, this._size, this._noMipmap, this.gammaSpace);
        // Base texture
        newTexture.level = this.level;
        newTexture.wrapU = this.wrapU;
        newTexture.wrapV = this.wrapV;
        newTexture.coordinatesIndex = this.coordinatesIndex;
        newTexture.coordinatesMode = this.coordinatesMode;
        return newTexture;
    }
}
/** The six faces of the cube. */
EquiRectangularCubeTexture._FacesMapping = ["right", "left", "up", "down", "front", "back"];
//# sourceMappingURL=equiRectangularCubeTexture.js.map