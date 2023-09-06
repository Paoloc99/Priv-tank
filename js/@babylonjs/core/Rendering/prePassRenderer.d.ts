import { PrePassRenderTarget } from "../Materials/Textures/prePassRenderTarget";
import type { Scene } from "../scene";
import type { Effect } from "../Materials/effect";
import type { Nullable } from "../types";
import type { AbstractMesh } from "../Meshes/abstractMesh";
import type { Camera } from "../Cameras/camera";
import { Material } from "../Materials/material";
import type { SubMesh } from "../Meshes/subMesh";
import type { PrePassEffectConfiguration } from "./prePassEffectConfiguration";
import type { RenderTargetTexture } from "../Materials/Textures/renderTargetTexture";
/**
 * Renders a pre pass of the scene
 * This means every mesh in the scene will be rendered to a render target texture
 * And then this texture will be composited to the rendering canvas with post processes
 * It is necessary for effects like subsurface scattering or deferred shading
 */
export declare class PrePassRenderer {
    /**
     * @internal
     */
    static _SceneComponentInitialization: (scene: Scene) => void;
    /**
     * To save performance, we can excluded skinned meshes from the prepass
     */
    excludedSkinnedMesh: AbstractMesh[];
    /**
     * Force material to be excluded from the prepass
     * Can be useful when `useGeometryBufferFallback` is set to `true`
     * and you don't want a material to show in the effect.
     */
    excludedMaterials: Material[];
    private _scene;
    private _engine;
    /**
     * Number of textures in the multi render target texture where the scene is directly rendered
     */
    mrtCount: number;
    private _mrtTypes;
    private _mrtFormats;
    private _mrtLayout;
    private _mrtNames;
    private _textureIndices;
    private _multiRenderAttachments;
    private _defaultAttachments;
    private _clearAttachments;
    private _clearDepthAttachments;
    /**
     * Returns the index of a texture in the multi render target texture array.
     * @param type Texture type
     * @returns The index
     */
    getIndex(type: number): number;
    /**
     * How many samples are used for MSAA of the scene render target
     */
    get samples(): number;
    set samples(n: number);
    private _useSpecificClearForDepthTexture;
    /**
     * If set to true (default: false), the depth texture will be cleared with the depth value corresponding to the far plane (1 in normal mode, 0 in reverse depth buffer mode)
     * If set to false, the depth texture is always cleared with 0.
     */
    get useSpecificClearForDepthTexture(): boolean;
    set useSpecificClearForDepthTexture(value: boolean);
    /**
     * Describes the types and formats of the textures used by the pre-pass renderer
     */
    static TextureFormats: {
        purpose: number;
        type: number;
        format: number;
        name: string;
    }[];
    private _isDirty;
    /**
     * The render target where the scene is directly rendered
     */
    defaultRT: PrePassRenderTarget;
    /**
     * Configuration for prepass effects
     */
    private _effectConfigurations;
    /**
     * @returns the prepass render target for the rendering pass.
     * If we are currently rendering a render target, it returns the PrePassRenderTarget
     * associated with that render target. Otherwise, it returns the scene default PrePassRenderTarget
     */
    getRenderTarget(): PrePassRenderTarget;
    /**
     * @internal
     * Managed by the scene component
     * @param prePassRenderTarget
     */
    _setRenderTarget(prePassRenderTarget: Nullable<PrePassRenderTarget>): void;
    /**
     * Returns true if the currently rendered prePassRenderTarget is the one
     * associated with the scene.
     */
    get currentRTisSceneRT(): boolean;
    private _geometryBuffer;
    /**
     * Prevents the PrePassRenderer from using the GeometryBufferRenderer as a fallback
     */
    doNotUseGeometryRendererFallback: boolean;
    private _refreshGeometryBufferRendererLink;
    private _currentTarget;
    /**
     * All the render targets generated by prepass
     */
    renderTargets: PrePassRenderTarget[];
    private readonly _clearColor;
    private readonly _clearDepthColor;
    private _enabled;
    private _needsCompositionForThisPass;
    private _postProcessesSourceForThisPass;
    /**
     * Indicates if the prepass is enabled
     */
    get enabled(): boolean;
    /**
     * Set to true to disable gamma transform in PrePass.
     * Can be useful in case you already proceed to gamma transform on a material level
     * and your post processes don't need to be in linear color space.
     */
    disableGammaTransform: boolean;
    /**
     * Instantiates a prepass renderer
     * @param scene The scene
     */
    constructor(scene: Scene);
    /**
     * Creates a new PrePassRenderTarget
     * This should be the only way to instantiate a `PrePassRenderTarget`
     * @param name Name of the `PrePassRenderTarget`
     * @param renderTargetTexture RenderTarget the `PrePassRenderTarget` will be attached to.
     * Can be `null` if the created `PrePassRenderTarget` is attached to the scene (default framebuffer).
     * @internal
     */
    _createRenderTarget(name: string, renderTargetTexture: Nullable<RenderTargetTexture>): PrePassRenderTarget;
    /**
     * Indicates if rendering a prepass is supported
     */
    get isSupported(): boolean;
    /**
     * Sets the proper output textures to draw in the engine.
     * @param effect The effect that is drawn. It can be or not be compatible with drawing to several output textures.
     * @param subMesh Submesh on which the effect is applied
     */
    bindAttachmentsForEffect(effect: Effect, subMesh: SubMesh): void;
    private _reinitializeAttachments;
    private _resetLayout;
    private _updateGeometryBufferLayout;
    /**
     * Restores attachments for single texture draw.
     */
    restoreAttachments(): void;
    /**
     * @internal
     */
    _beforeDraw(camera?: Camera, faceIndex?: number, layer?: number): void;
    private _prepareFrame;
    /**
     * Sets an intermediary texture between prepass and postprocesses. This texture
     * will be used as input for post processes
     * @param rt
     * @returns true if there are postprocesses that will use this texture,
     * false if there is no postprocesses - and the function has no effect
     */
    setCustomOutput(rt: RenderTargetTexture): boolean;
    private _renderPostProcesses;
    /**
     * @internal
     */
    _afterDraw(faceIndex?: number, layer?: number): void;
    /**
     * Clears the current prepass render target (in the sense of settings pixels to the scene clear color value)
     * @internal
     */
    _clear(): void;
    private _bindFrameBuffer;
    private _setEnabled;
    private _setRenderTargetEnabled;
    /**
     * Adds an effect configuration to the prepass render target.
     * If an effect has already been added, it won't add it twice and will return the configuration
     * already present.
     * @param cfg the effect configuration
     * @returns the effect configuration now used by the prepass
     */
    addEffectConfiguration(cfg: PrePassEffectConfiguration): PrePassEffectConfiguration;
    /**
     * Retrieves an effect configuration by name
     * @param name
     * @returns the effect configuration, or null if not present
     */
    getEffectConfiguration(name: string): Nullable<PrePassEffectConfiguration>;
    private _enable;
    private _disable;
    private _getPostProcessesSource;
    private _setupOutputForThisPass;
    private _linkInternalTexture;
    /**
     * @internal
     */
    _unlinkInternalTexture(prePassRenderTarget: PrePassRenderTarget): void;
    private _needsImageProcessing;
    private _hasImageProcessing;
    /**
     * Internal, gets the first post proces.
     * @param postProcesses
     * @returns the first post process to be run on this camera.
     */
    private _getFirstPostProcess;
    /**
     * Marks the prepass renderer as dirty, triggering a check if the prepass is necessary for the next rendering.
     */
    markAsDirty(): void;
    /**
     * Enables a texture on the MultiRenderTarget for prepass
     * @param types
     */
    private _enableTextures;
    /**
     * Makes sure that the prepass renderer is up to date if it has been dirtified.
     */
    update(): void;
    private _update;
    private _markAllMaterialsAsPrePassDirty;
    /**
     * Disposes the prepass renderer.
     */
    dispose(): void;
}
