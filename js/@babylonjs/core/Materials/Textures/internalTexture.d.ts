import { Observable } from "../../Misc/observable";
import type { Nullable, int } from "../../types";
import type { ICanvas, ICanvasRenderingContext } from "../../Engines/ICanvas";
import type { HardwareTextureWrapper } from "./hardwareTextureWrapper";
import { TextureSampler } from "./textureSampler";
import type { ThinEngine } from "../../Engines/thinEngine";
import type { BaseTexture } from "../../Materials/Textures/baseTexture";
import type { SphericalPolynomial } from "../../Maths/sphericalPolynomial";
/**
 * Defines the source of the internal texture
 */
export declare enum InternalTextureSource {
    /**
     * The source of the texture data is unknown
     */
    Unknown = 0,
    /**
     * Texture data comes from an URL
     */
    Url = 1,
    /**
     * Texture data is only used for temporary storage
     */
    Temp = 2,
    /**
     * Texture data comes from raw data (ArrayBuffer)
     */
    Raw = 3,
    /**
     * Texture content is dynamic (video or dynamic texture)
     */
    Dynamic = 4,
    /**
     * Texture content is generated by rendering to it
     */
    RenderTarget = 5,
    /**
     * Texture content is part of a multi render target process
     */
    MultiRenderTarget = 6,
    /**
     * Texture data comes from a cube data file
     */
    Cube = 7,
    /**
     * Texture data comes from a raw cube data
     */
    CubeRaw = 8,
    /**
     * Texture data come from a prefiltered cube data file
     */
    CubePrefiltered = 9,
    /**
     * Texture content is raw 3D data
     */
    Raw3D = 10,
    /**
     * Texture content is raw 2D array data
     */
    Raw2DArray = 11,
    /**
     * Texture content is a depth/stencil texture
     */
    DepthStencil = 12,
    /**
     * Texture data comes from a raw cube data encoded with RGBD
     */
    CubeRawRGBD = 13,
    /**
     * Texture content is a depth texture
     */
    Depth = 14
}
/**
 * Class used to store data associated with WebGL texture data for the engine
 * This class should not be used directly
 */
export declare class InternalTexture extends TextureSampler {
    /**
     * Defines if the texture is ready
     */
    isReady: boolean;
    /**
     * Defines if the texture is a cube texture
     */
    isCube: boolean;
    /**
     * Defines if the texture contains 3D data
     */
    is3D: boolean;
    /**
     * Defines if the texture contains 2D array data
     */
    is2DArray: boolean;
    /**
     * Defines if the texture contains multiview data
     */
    isMultiview: boolean;
    /**
     * Gets the URL used to load this texture
     */
    url: string;
    /** @internal */
    _originalUrl: string;
    /**
     * Gets a boolean indicating if the texture needs mipmaps generation
     */
    generateMipMaps: boolean;
    /**
     * Gets a boolean indicating if the texture uses mipmaps
     * TODO implements useMipMaps as a separate setting from generateMipMaps
     */
    get useMipMaps(): boolean;
    set useMipMaps(value: boolean);
    /**
     * Gets the number of samples used by the texture (WebGL2+ only)
     */
    samples: number;
    /**
     * Gets the type of the texture (int, float...)
     */
    type: number;
    /**
     * Gets the format of the texture (RGB, RGBA...)
     */
    format: number;
    /**
     * Observable called when the texture is loaded
     */
    onLoadedObservable: Observable<InternalTexture>;
    /**
     * Observable called when the texture load is raising an error
     */
    onErrorObservable: Observable<Partial<{
        message: string;
        exception: any;
    }>>;
    /**
     * If this callback is defined it will be called instead of the default _rebuild function
     */
    onRebuildCallback: Nullable<(internalTexture: InternalTexture) => {
        proxy: Nullable<InternalTexture | Promise<InternalTexture>>;
        isReady: boolean;
        isAsync: boolean;
    }>;
    /**
     * Gets the width of the texture
     */
    width: number;
    /**
     * Gets the height of the texture
     */
    height: number;
    /**
     * Gets the depth of the texture
     */
    depth: number;
    /**
     * Gets the initial width of the texture (It could be rescaled if the current system does not support non power of two textures)
     */
    baseWidth: number;
    /**
     * Gets the initial height of the texture (It could be rescaled if the current system does not support non power of two textures)
     */
    baseHeight: number;
    /**
     * Gets the initial depth of the texture (It could be rescaled if the current system does not support non power of two textures)
     */
    baseDepth: number;
    /**
     * Gets a boolean indicating if the texture is inverted on Y axis
     */
    invertY: boolean;
    /**
     * Used for debugging purpose only
     */
    label?: string;
    /** @internal */
    _invertVScale: boolean;
    /** @internal */
    _associatedChannel: number;
    /** @internal */
    _source: InternalTextureSource;
    /** @internal */
    _buffer: Nullable<string | ArrayBuffer | ArrayBufferView | HTMLImageElement | Blob | ImageBitmap>;
    /** @internal */
    _bufferView: Nullable<ArrayBufferView>;
    /** @internal */
    _bufferViewArray: Nullable<ArrayBufferView[]>;
    /** @internal */
    _bufferViewArrayArray: Nullable<ArrayBufferView[][]>;
    /** @internal */
    _size: number;
    /** @internal */
    _extension: string;
    /** @internal */
    _files: Nullable<string[]>;
    /** @internal */
    _workingCanvas: Nullable<ICanvas>;
    /** @internal */
    _workingContext: Nullable<ICanvasRenderingContext>;
    /** @internal */
    _cachedCoordinatesMode: Nullable<number>;
    /** @internal */
    _isDisabled: boolean;
    /** @internal */
    _compression: Nullable<string>;
    /** @internal */
    _sphericalPolynomial: Nullable<SphericalPolynomial>;
    /** @internal */
    _sphericalPolynomialPromise: Nullable<Promise<SphericalPolynomial>>;
    /** @internal */
    _sphericalPolynomialComputed: boolean;
    /** @internal */
    _lodGenerationScale: number;
    /** @internal */
    _lodGenerationOffset: number;
    /** @internal */
    _useSRGBBuffer: boolean;
    /** @internal */
    _lodTextureHigh: Nullable<BaseTexture>;
    /** @internal */
    _lodTextureMid: Nullable<BaseTexture>;
    /** @internal */
    _lodTextureLow: Nullable<BaseTexture>;
    /** @internal */
    _isRGBD: boolean;
    /** @internal */
    _linearSpecularLOD: boolean;
    /** @internal */
    _irradianceTexture: Nullable<BaseTexture>;
    /** @internal */
    _hardwareTexture: Nullable<HardwareTextureWrapper>;
    /** @internal */
    _maxLodLevel: Nullable<number>;
    /** @internal */
    _references: number;
    /** @internal */
    _gammaSpace: Nullable<boolean>;
    private _engine;
    private _uniqueId;
    /** @internal */
    static _Counter: number;
    /** Gets the unique id of the internal texture */
    get uniqueId(): number;
    /** @internal */
    _setUniqueId(id: number): void;
    /**
     * Gets the Engine the texture belongs to.
     * @returns The babylon engine
     */
    getEngine(): ThinEngine;
    /**
     * Gets the data source type of the texture
     */
    get source(): InternalTextureSource;
    /**
     * Creates a new InternalTexture
     * @param engine defines the engine to use
     * @param source defines the type of data that will be used
     * @param delayAllocation if the texture allocation should be delayed (default: false)
     */
    constructor(engine: ThinEngine, source: InternalTextureSource, delayAllocation?: boolean);
    /**
     * Increments the number of references (ie. the number of Texture that point to it)
     */
    incrementReferences(): void;
    /**
     * Change the size of the texture (not the size of the content)
     * @param width defines the new width
     * @param height defines the new height
     * @param depth defines the new depth (1 by default)
     */
    updateSize(width: int, height: int, depth?: int): void;
    /** @internal */
    _rebuild(): void;
    /**
     * @internal
     */
    _swapAndDie(target: InternalTexture, swapAll?: boolean): void;
    /**
     * Dispose the current allocated resources
     */
    dispose(): void;
}
