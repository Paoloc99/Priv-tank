import { Observable } from "../Misc/observable.js";
import { Tools, AsyncLoop } from "../Misc/tools.js";
import { DeepCopier } from "../Misc/deepCopier.js";
import { Tags } from "../Misc/tags.js";
import { runCoroutineSync, runCoroutineAsync, createYieldingScheduler } from "../Misc/coroutine.js";
import { Camera } from "../Cameras/camera.js";
import { ScenePerformancePriority } from "../scene.js";
import { Quaternion, Matrix, Vector3, Vector2 } from "../Maths/math.vector.js";
import { Color3 } from "../Maths/math.color.js";
import { Node } from "../node.js";
import { VertexBuffer, Buffer } from "../Buffers/buffer.js";
import { VertexData } from "./mesh.vertexData.js";
import { Geometry } from "./geometry.js";
import { AbstractMesh } from "./abstractMesh.js";
import { SubMesh } from "./subMesh.js";
import { Material } from "../Materials/material.js";
import { MultiMaterial } from "../Materials/multiMaterial.js";
import { SceneLoaderFlags } from "../Loading/sceneLoaderFlags.js";

import { SerializationHelper } from "../Misc/decorators.js";
import { Logger } from "../Misc/logger.js";
import { GetClass, RegisterClass } from "../Misc/typeStore.js";
import { _WarnImport } from "../Misc/devTools.js";
import { SceneComponentConstants } from "../sceneComponent.js";
import { MeshLODLevel } from "./meshLODLevel.js";
/**
 * @internal
 **/
export class _CreationDataStorage {
}
/**
 * @internal
 **/
class _InstanceDataStorage {
    constructor() {
        this.visibleInstances = {};
        this.batchCache = new _InstancesBatch();
        this.batchCacheReplacementModeInFrozenMode = new _InstancesBatch();
        this.instancesBufferSize = 32 * 16 * 4; // let's start with a maximum of 32 instances
    }
}
/**
 * @internal
 **/
export class _InstancesBatch {
    constructor() {
        this.mustReturn = false;
        this.visibleInstances = new Array();
        this.renderSelf = new Array();
        this.hardwareInstancedRendering = new Array();
    }
}
/**
 * @internal
 **/
class _ThinInstanceDataStorage {
    constructor() {
        this.instancesCount = 0;
        this.matrixBuffer = null;
        this.previousMatrixBuffer = null;
        this.matrixBufferSize = 32 * 16; // let's start with a maximum of 32 thin instances
        this.matrixData = null;
        this.boundingVectors = [];
        this.worldMatrices = null;
    }
}
/**
 * @internal
 **/
class _InternalMeshDataInfo {
    constructor() {
        this._areNormalsFrozen = false; // Will be used by ribbons mainly
        // Will be used to save a source mesh reference, If any
        this._source = null;
        // Will be used to for fast cloned mesh lookup
        this.meshMap = null;
        this._preActivateId = -1;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        this._LODLevels = new Array();
        /** Alternative definition of LOD level, using screen coverage instead of distance */
        this._useLODScreenCoverage = false;
        this._effectiveMaterial = null;
        this._forcedInstanceCount = 0;
        this._overrideRenderingFillMode = null;
    }
}
/**
 * Class used to represent renderable models
 */
export class Mesh extends AbstractMesh {
    /**
     * Gets the default side orientation.
     * @param orientation the orientation to value to attempt to get
     * @returns the default orientation
     * @internal
     */
    static _GetDefaultSideOrientation(orientation) {
        return orientation || Mesh.FRONTSIDE; // works as Mesh.FRONTSIDE is 0
    }
    /**
     * Determines if the LOD levels are intended to be calculated using screen coverage (surface area ratio) instead of distance.
     */
    get useLODScreenCoverage() {
        return this._internalMeshDataInfo._useLODScreenCoverage;
    }
    set useLODScreenCoverage(value) {
        this._internalMeshDataInfo._useLODScreenCoverage = value;
        this._sortLODLevels();
    }
    get computeBonesUsingShaders() {
        return this._internalAbstractMeshDataInfo._computeBonesUsingShaders;
    }
    set computeBonesUsingShaders(value) {
        if (this._internalAbstractMeshDataInfo._computeBonesUsingShaders === value) {
            return;
        }
        if (value && this._internalMeshDataInfo._sourcePositions) {
            // switch from software to GPU computation: we need to reset the vertex and normal buffers that have been updated by the software process
            this.setVerticesData(VertexBuffer.PositionKind, this._internalMeshDataInfo._sourcePositions, true);
            if (this._internalMeshDataInfo._sourceNormals) {
                this.setVerticesData(VertexBuffer.NormalKind, this._internalMeshDataInfo._sourceNormals, true);
            }
            this._internalMeshDataInfo._sourcePositions = null;
            this._internalMeshDataInfo._sourceNormals = null;
        }
        this._internalAbstractMeshDataInfo._computeBonesUsingShaders = value;
        this._markSubMeshesAsAttributesDirty();
    }
    /**
     * An event triggered before rendering the mesh
     */
    get onBeforeRenderObservable() {
        if (!this._internalMeshDataInfo._onBeforeRenderObservable) {
            this._internalMeshDataInfo._onBeforeRenderObservable = new Observable();
        }
        return this._internalMeshDataInfo._onBeforeRenderObservable;
    }
    /**
     * An event triggered before binding the mesh
     */
    get onBeforeBindObservable() {
        if (!this._internalMeshDataInfo._onBeforeBindObservable) {
            this._internalMeshDataInfo._onBeforeBindObservable = new Observable();
        }
        return this._internalMeshDataInfo._onBeforeBindObservable;
    }
    /**
     * An event triggered after rendering the mesh
     */
    get onAfterRenderObservable() {
        if (!this._internalMeshDataInfo._onAfterRenderObservable) {
            this._internalMeshDataInfo._onAfterRenderObservable = new Observable();
        }
        return this._internalMeshDataInfo._onAfterRenderObservable;
    }
    /**
     * An event triggeredbetween rendering pass when using separateCullingPass = true
     */
    get onBetweenPassObservable() {
        if (!this._internalMeshDataInfo._onBetweenPassObservable) {
            this._internalMeshDataInfo._onBetweenPassObservable = new Observable();
        }
        return this._internalMeshDataInfo._onBetweenPassObservable;
    }
    /**
     * An event triggered before drawing the mesh
     */
    get onBeforeDrawObservable() {
        if (!this._internalMeshDataInfo._onBeforeDrawObservable) {
            this._internalMeshDataInfo._onBeforeDrawObservable = new Observable();
        }
        return this._internalMeshDataInfo._onBeforeDrawObservable;
    }
    /**
     * Sets a callback to call before drawing the mesh. It is recommended to use onBeforeDrawObservable instead
     */
    set onBeforeDraw(callback) {
        if (this._onBeforeDrawObserver) {
            this.onBeforeDrawObservable.remove(this._onBeforeDrawObserver);
        }
        this._onBeforeDrawObserver = this.onBeforeDrawObservable.add(callback);
    }
    get hasInstances() {
        return this.instances.length > 0;
    }
    get hasThinInstances() {
        var _a;
        return ((_a = this._thinInstanceDataStorage.instancesCount) !== null && _a !== void 0 ? _a : 0) > 0;
    }
    /**
     * Gets or sets the forced number of instances to display.
     * If 0 (default value), the number of instances is not forced and depends on the draw type
     * (regular / instance / thin instances mesh)
     */
    get forcedInstanceCount() {
        return this._internalMeshDataInfo._forcedInstanceCount;
    }
    set forcedInstanceCount(count) {
        this._internalMeshDataInfo._forcedInstanceCount = count;
    }
    /**
     * Use this property to override the Material's fillMode value
     */
    get overrideRenderingFillMode() {
        return this._internalMeshDataInfo._overrideRenderingFillMode;
    }
    set overrideRenderingFillMode(fillMode) {
        this._internalMeshDataInfo._overrideRenderingFillMode = fillMode;
    }
    /**
     * Gets the source mesh (the one used to clone this one from)
     */
    get source() {
        return this._internalMeshDataInfo._source;
    }
    /**
     * Gets the list of clones of this mesh
     * The scene must have been constructed with useClonedMeshMap=true for this to work!
     * Note that useClonedMeshMap=true is the default setting
     */
    get cloneMeshMap() {
        return this._internalMeshDataInfo.meshMap;
    }
    /**
     * Gets or sets a boolean indicating that this mesh does not use index buffer
     */
    get isUnIndexed() {
        return this._unIndexed;
    }
    set isUnIndexed(value) {
        if (this._unIndexed !== value) {
            this._unIndexed = value;
            this._markSubMeshesAsAttributesDirty();
        }
    }
    /** Gets the array buffer used to store the instanced buffer used for instances' world matrices */
    get worldMatrixInstancedBuffer() {
        return this._instanceDataStorage.instancesData;
    }
    /** Gets the array buffer used to store the instanced buffer used for instances' previous world matrices */
    get previousWorldMatrixInstancedBuffer() {
        return this._instanceDataStorage.instancesPreviousData;
    }
    /** Gets or sets a boolean indicating that the update of the instance buffer of the world matrices is manual */
    get manualUpdateOfWorldMatrixInstancedBuffer() {
        return this._instanceDataStorage.manualUpdate;
    }
    set manualUpdateOfWorldMatrixInstancedBuffer(value) {
        this._instanceDataStorage.manualUpdate = value;
    }
    /** Gets or sets a boolean indicating that the update of the instance buffer of the world matrices is manual */
    get manualUpdateOfPreviousWorldMatrixInstancedBuffer() {
        return this._instanceDataStorage.previousManualUpdate;
    }
    set manualUpdateOfPreviousWorldMatrixInstancedBuffer(value) {
        this._instanceDataStorage.previousManualUpdate = value;
    }
    /** Gets or sets a boolean indicating that the update of the instance buffer of the world matrices must be performed in all cases (and notably even in frozen mode) */
    get forceWorldMatrixInstancedBufferUpdate() {
        return this._instanceDataStorage.forceMatrixUpdates;
    }
    set forceWorldMatrixInstancedBufferUpdate(value) {
        this._instanceDataStorage.forceMatrixUpdates = value;
    }
    /**
     * @constructor
     * @param name The value used by scene.getMeshByName() to do a lookup.
     * @param scene The scene to add this mesh to.
     * @param parent The parent of this mesh, if it has one
     * @param source An optional Mesh from which geometry is shared, cloned.
     * @param doNotCloneChildren When cloning, skip cloning child meshes of source, default False.
     *                  When false, achieved by calling a clone(), also passing False.
     *                  This will make creation of children, recursive.
     * @param clonePhysicsImpostor When cloning, include cloning mesh physics impostor, default True.
     */
    constructor(name, scene = null, parent = null, source = null, doNotCloneChildren, clonePhysicsImpostor = true) {
        super(name, scene);
        // Internal data
        this._internalMeshDataInfo = new _InternalMeshDataInfo();
        // Members
        /**
         * Gets the delay loading state of the mesh (when delay loading is turned on)
         * @see https://doc.babylonjs.com/features/featuresDeepDive/importers/incrementalLoading
         */
        this.delayLoadState = 0;
        /**
         * Gets the list of instances created from this mesh
         * it is not supposed to be modified manually.
         * Note also that the order of the InstancedMesh wihin the array is not significant and might change.
         * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
         */
        this.instances = new Array();
        // Private
        /** @internal */
        this._creationDataStorage = null;
        /** @internal */
        this._geometry = null;
        /** @internal */
        this._instanceDataStorage = new _InstanceDataStorage();
        /** @internal */
        this._thinInstanceDataStorage = new _ThinInstanceDataStorage();
        /** @internal */
        this._shouldGenerateFlatShading = false;
        // Use by builder only to know what orientation were the mesh build in.
        /** @internal */
        this._originalBuilderSideOrientation = Mesh.DEFAULTSIDE;
        /**
         * Use this property to change the original side orientation defined at construction time
         */
        this.overrideMaterialSideOrientation = null;
        /**
         * Gets or sets a boolean indicating whether to render ignoring the active camera's max z setting. (false by default)
         * You should not mix meshes that have this property set to true with meshes that have it set to false if they all write
         * to the depth buffer, because the z-values are not comparable in the two cases and you will get rendering artifacts if you do.
         * You can set the property to true for meshes that do not write to the depth buffer, or set the same value (either false or true) otherwise.
         * Note this will reduce performance when set to true.
         */
        this.ignoreCameraMaxZ = false;
        scene = this.getScene();
        this._onBeforeDraw = (isInstance, world, effectiveMaterial) => {
            if (isInstance && effectiveMaterial) {
                if (this._uniformBuffer) {
                    this.transferToEffect(world);
                }
                else {
                    effectiveMaterial.bindOnlyWorldMatrix(world);
                }
            }
        };
        if (source) {
            // Geometry
            if (source._geometry) {
                source._geometry.applyToMesh(this);
            }
            // Deep copy
            DeepCopier.DeepCopy(source, this, [
                "name",
                "material",
                "skeleton",
                "instances",
                "parent",
                "uniqueId",
                "source",
                "metadata",
                "morphTargetManager",
                "hasInstances",
                "worldMatrixInstancedBuffer",
                "previousWorldMatrixInstancedBuffer",
                "hasLODLevels",
                "geometry",
                "isBlocked",
                "areNormalsFrozen",
                "facetNb",
                "isFacetDataEnabled",
                "lightSources",
                "useBones",
                "isAnInstance",
                "collider",
                "edgesRenderer",
                "forward",
                "up",
                "right",
                "absolutePosition",
                "absoluteScaling",
                "absoluteRotationQuaternion",
                "isWorldMatrixFrozen",
                "nonUniformScaling",
                "behaviors",
                "worldMatrixFromCache",
                "hasThinInstances",
                "cloneMeshMap",
                "hasBoundingInfo",
                "physicsBody",
                "physicsImpostor",
            ], ["_poseMatrix"]);
            // Source mesh
            this._internalMeshDataInfo._source = source;
            if (scene.useClonedMeshMap) {
                if (!source._internalMeshDataInfo.meshMap) {
                    source._internalMeshDataInfo.meshMap = {};
                }
                source._internalMeshDataInfo.meshMap[this.uniqueId] = this;
            }
            // Construction Params
            // Clone parameters allowing mesh to be updated in case of parametric shapes.
            this._originalBuilderSideOrientation = source._originalBuilderSideOrientation;
            this._creationDataStorage = source._creationDataStorage;
            // Animation ranges
            if (source._ranges) {
                const ranges = source._ranges;
                for (const name in ranges) {
                    if (!Object.prototype.hasOwnProperty.call(ranges, name)) {
                        continue;
                    }
                    if (!ranges[name]) {
                        continue;
                    }
                    this.createAnimationRange(name, ranges[name].from, ranges[name].to);
                }
            }
            // Metadata
            if (source.metadata && source.metadata.clone) {
                this.metadata = source.metadata.clone();
            }
            else {
                this.metadata = source.metadata;
            }
            this._internalMetadata = source._internalMetadata;
            // Tags
            if (Tags && Tags.HasTags(source)) {
                Tags.AddTagsTo(this, Tags.GetTags(source, true));
            }
            // Enabled. We shouldn't need to check the source's ancestors, as this mesh
            // will have the same ones.
            this.setEnabled(source.isEnabled(false));
            // Parent
            this.parent = source.parent;
            // Pivot
            this.setPivotMatrix(source.getPivotMatrix());
            this.id = name + "." + source.id;
            // Material
            this.material = source.material;
            if (!doNotCloneChildren) {
                // Children
                const directDescendants = source.getDescendants(true);
                for (let index = 0; index < directDescendants.length; index++) {
                    const child = directDescendants[index];
                    if (child.clone) {
                        child.clone(name + "." + child.name, this);
                    }
                }
            }
            // Morphs
            if (source.morphTargetManager) {
                this.morphTargetManager = source.morphTargetManager;
            }
            // Physics clone
            if (scene.getPhysicsEngine) {
                const physicsEngine = scene.getPhysicsEngine();
                if (clonePhysicsImpostor && physicsEngine) {
                    if (physicsEngine.getPluginVersion() === 1) {
                        const impostor = physicsEngine.getImpostorForPhysicsObject(source);
                        if (impostor) {
                            this.physicsImpostor = impostor.clone(this);
                        }
                    }
                    else if (physicsEngine.getPluginVersion() === 2) {
                        if (source.physicsBody) {
                            source.physicsBody.clone(this);
                        }
                    }
                }
            }
            // Particles
            for (let index = 0; index < scene.particleSystems.length; index++) {
                const system = scene.particleSystems[index];
                if (system.emitter === source) {
                    system.clone(system.name, this);
                }
            }
            // Skeleton
            this.skeleton = source.skeleton;
            this.refreshBoundingInfo(true, true);
            this.computeWorldMatrix(true);
        }
        // Parent
        if (parent !== null) {
            this.parent = parent;
        }
        this._instanceDataStorage.hardwareInstancedRendering = this.getEngine().getCaps().instancedArrays;
        this._internalMeshDataInfo._onMeshReadyObserverAdded = (observer) => {
            // only notify once! then unregister the observer
            observer.unregisterOnNextCall = true;
            if (this.isReady(true)) {
                this.onMeshReadyObservable.notifyObservers(this);
            }
            else {
                if (!this._internalMeshDataInfo._checkReadinessObserver) {
                    this._internalMeshDataInfo._checkReadinessObserver = this._scene.onBeforeRenderObservable.add(() => {
                        // check for complete readiness
                        if (this.isReady(true)) {
                            this._scene.onBeforeRenderObservable.remove(this._internalMeshDataInfo._checkReadinessObserver);
                            this._internalMeshDataInfo._checkReadinessObserver = null;
                            this.onMeshReadyObservable.notifyObservers(this);
                        }
                    });
                }
            }
        };
        this.onMeshReadyObservable = new Observable(this._internalMeshDataInfo._onMeshReadyObserverAdded);
        if (source) {
            source.onClonedObservable.notifyObservers(this);
        }
    }
    instantiateHierarchy(newParent = null, options, onNewNodeCreated) {
        const instance = this.getTotalVertices() === 0 || (options && options.doNotInstantiate && (options.doNotInstantiate === true || options.doNotInstantiate(this)))
            ? this.clone("Clone of " + (this.name || this.id), newParent || this.parent, true)
            : this.createInstance("instance of " + (this.name || this.id));
        instance.parent = newParent || this.parent;
        instance.position = this.position.clone();
        instance.scaling = this.scaling.clone();
        if (this.rotationQuaternion) {
            instance.rotationQuaternion = this.rotationQuaternion.clone();
        }
        else {
            instance.rotation = this.rotation.clone();
        }
        if (onNewNodeCreated) {
            onNewNodeCreated(this, instance);
        }
        for (const child of this.getChildTransformNodes(true)) {
            // instancedMesh should have a different sourced mesh
            if (child.getClassName() === "InstancedMesh" && instance.getClassName() === "Mesh" && child.sourceMesh === this) {
                child.instantiateHierarchy(instance, {
                    doNotInstantiate: (options && options.doNotInstantiate) || false,
                    newSourcedMesh: instance,
                }, onNewNodeCreated);
            }
            else {
                child.instantiateHierarchy(instance, options, onNewNodeCreated);
            }
        }
        return instance;
    }
    /**
     * Gets the class name
     * @returns the string "Mesh".
     */
    getClassName() {
        return "Mesh";
    }
    /** @internal */
    get _isMesh() {
        return true;
    }
    /**
     * Returns a description of this mesh
     * @param fullDetails define if full details about this mesh must be used
     * @returns a descriptive string representing this mesh
     */
    toString(fullDetails) {
        let ret = super.toString(fullDetails);
        ret += ", n vertices: " + this.getTotalVertices();
        ret += ", parent: " + (this._waitingParentId ? this._waitingParentId : this.parent ? this.parent.name : "NONE");
        if (this.animations) {
            for (let i = 0; i < this.animations.length; i++) {
                ret += ", animation[0]: " + this.animations[i].toString(fullDetails);
            }
        }
        if (fullDetails) {
            if (this._geometry) {
                const ib = this.getIndices();
                const vb = this.getVerticesData(VertexBuffer.PositionKind);
                if (vb && ib) {
                    ret += ", flat shading: " + (vb.length / 3 === ib.length ? "YES" : "NO");
                }
            }
            else {
                ret += ", flat shading: UNKNOWN";
            }
        }
        return ret;
    }
    /** @internal */
    _unBindEffect() {
        super._unBindEffect();
        for (const instance of this.instances) {
            instance._unBindEffect();
        }
    }
    /**
     * Gets a boolean indicating if this mesh has LOD
     */
    get hasLODLevels() {
        return this._internalMeshDataInfo._LODLevels.length > 0;
    }
    /**
     * Gets the list of MeshLODLevel associated with the current mesh
     * @returns an array of MeshLODLevel
     */
    getLODLevels() {
        return this._internalMeshDataInfo._LODLevels;
    }
    _sortLODLevels() {
        const sortingOrderFactor = this._internalMeshDataInfo._useLODScreenCoverage ? -1 : 1;
        this._internalMeshDataInfo._LODLevels.sort((a, b) => {
            if (a.distanceOrScreenCoverage < b.distanceOrScreenCoverage) {
                return sortingOrderFactor;
            }
            if (a.distanceOrScreenCoverage > b.distanceOrScreenCoverage) {
                return -sortingOrderFactor;
            }
            return 0;
        });
    }
    /**
     * Add a mesh as LOD level triggered at the given distance.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD
     * @param distanceOrScreenCoverage Either distance from the center of the object to show this level or the screen coverage if `useScreenCoverage` is set to `true`.
     * If screen coverage, value is a fraction of the screen's total surface, between 0 and 1.
     * Example Playground for distance https://playground.babylonjs.com/#QE7KM#197
     * Example Playground for screen coverage https://playground.babylonjs.com/#QE7KM#196
     * @param mesh The mesh to be added as LOD level (can be null)
     * @returns This mesh (for chaining)
     */
    addLODLevel(distanceOrScreenCoverage, mesh) {
        if (mesh && mesh._masterMesh) {
            Logger.Warn("You cannot use a mesh as LOD level twice");
            return this;
        }
        const level = new MeshLODLevel(distanceOrScreenCoverage, mesh);
        this._internalMeshDataInfo._LODLevels.push(level);
        if (mesh) {
            mesh._masterMesh = this;
        }
        this._sortLODLevels();
        return this;
    }
    /**
     * Returns the LOD level mesh at the passed distance or null if not found.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD
     * @param distance The distance from the center of the object to show this level
     * @returns a Mesh or `null`
     */
    getLODLevelAtDistance(distance) {
        const internalDataInfo = this._internalMeshDataInfo;
        for (let index = 0; index < internalDataInfo._LODLevels.length; index++) {
            const level = internalDataInfo._LODLevels[index];
            if (level.distanceOrScreenCoverage === distance) {
                return level.mesh;
            }
        }
        return null;
    }
    /**
     * Remove a mesh from the LOD array
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD
     * @param mesh defines the mesh to be removed
     * @returns This mesh (for chaining)
     */
    removeLODLevel(mesh) {
        const internalDataInfo = this._internalMeshDataInfo;
        for (let index = 0; index < internalDataInfo._LODLevels.length; index++) {
            if (internalDataInfo._LODLevels[index].mesh === mesh) {
                internalDataInfo._LODLevels.splice(index, 1);
                if (mesh) {
                    mesh._masterMesh = null;
                }
            }
        }
        this._sortLODLevels();
        return this;
    }
    /**
     * Returns the registered LOD mesh distant from the parameter `camera` position if any, else returns the current mesh.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD
     * @param camera defines the camera to use to compute distance
     * @param boundingSphere defines a custom bounding sphere to use instead of the one from this mesh
     * @returns This mesh (for chaining)
     */
    getLOD(camera, boundingSphere) {
        const internalDataInfo = this._internalMeshDataInfo;
        if (!internalDataInfo._LODLevels || internalDataInfo._LODLevels.length === 0) {
            return this;
        }
        const bSphere = boundingSphere || this.getBoundingInfo().boundingSphere;
        const distanceToCamera = camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? camera.minZ : bSphere.centerWorld.subtract(camera.globalPosition).length();
        let compareValue = distanceToCamera;
        let compareSign = 1;
        if (internalDataInfo._useLODScreenCoverage) {
            const screenArea = camera.screenArea;
            let meshArea = (bSphere.radiusWorld * camera.minZ) / distanceToCamera;
            meshArea = meshArea * meshArea * Math.PI;
            compareValue = meshArea / screenArea;
            compareSign = -1;
        }
        if (compareSign * internalDataInfo._LODLevels[internalDataInfo._LODLevels.length - 1].distanceOrScreenCoverage > compareSign * compareValue) {
            if (this.onLODLevelSelection) {
                this.onLODLevelSelection(compareValue, this, this);
            }
            return this;
        }
        for (let index = 0; index < internalDataInfo._LODLevels.length; index++) {
            const level = internalDataInfo._LODLevels[index];
            if (compareSign * level.distanceOrScreenCoverage < compareSign * compareValue) {
                if (level.mesh) {
                    if (level.mesh.delayLoadState === 4) {
                        level.mesh._checkDelayState();
                        return this;
                    }
                    if (level.mesh.delayLoadState === 2) {
                        return this;
                    }
                    level.mesh._preActivate();
                    level.mesh._updateSubMeshesBoundingInfo(this.worldMatrixFromCache);
                }
                if (this.onLODLevelSelection) {
                    this.onLODLevelSelection(compareValue, this, level.mesh);
                }
                return level.mesh;
            }
        }
        if (this.onLODLevelSelection) {
            this.onLODLevelSelection(compareValue, this, this);
        }
        return this;
    }
    /**
     * Gets the mesh internal Geometry object
     */
    get geometry() {
        return this._geometry;
    }
    /**
     * Returns the total number of vertices within the mesh geometry or zero if the mesh has no geometry.
     * @returns the total number of vertices
     */
    getTotalVertices() {
        if (this._geometry === null || this._geometry === undefined) {
            return 0;
        }
        return this._geometry.getTotalVertices();
    }
    /**
     * Returns the content of an associated vertex buffer
     * @param kind defines which buffer to read from (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param copyWhenShared defines a boolean indicating that if the mesh geometry is shared among some other meshes, the returned array is a copy of the internal one
     * @param forceCopy defines a boolean forcing the copy of the buffer no matter what the value of copyWhenShared is
     * @param bypassInstanceData defines a boolean indicating that the function should not take into account the instance data (applies only if the mesh has instances). Default: false
     * @returns a FloatArray or null if the mesh has no geometry or no vertex buffer for this kind.
     */
    getVerticesData(kind, copyWhenShared, forceCopy, bypassInstanceData) {
        var _a, _b;
        if (!this._geometry) {
            return null;
        }
        let data = bypassInstanceData
            ? undefined
            : (_b = (_a = this._userInstancedBuffersStorage) === null || _a === void 0 ? void 0 : _a.vertexBuffers[kind]) === null || _b === void 0 ? void 0 : _b.getFloatData(this.instances.length + 1, // +1 because the master mesh is not included in the instances array
            forceCopy || (copyWhenShared && this._geometry.meshes.length !== 1));
        if (!data) {
            data = this._geometry.getVerticesData(kind, copyWhenShared, forceCopy);
        }
        return data;
    }
    /**
     * Returns the mesh VertexBuffer object from the requested `kind`
     * @param kind defines which buffer to read from (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.NormalKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param bypassInstanceData defines a boolean indicating that the function should not take into account the instance data (applies only if the mesh has instances). Default: false
     * @returns a FloatArray or null if the mesh has no vertex buffer for this kind.
     */
    getVertexBuffer(kind, bypassInstanceData) {
        var _a, _b;
        if (!this._geometry) {
            return null;
        }
        return (_b = (bypassInstanceData ? undefined : (_a = this._userInstancedBuffersStorage) === null || _a === void 0 ? void 0 : _a.vertexBuffers[kind])) !== null && _b !== void 0 ? _b : this._geometry.getVertexBuffer(kind);
    }
    /**
     * Tests if a specific vertex buffer is associated with this mesh
     * @param kind defines which buffer to check (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.NormalKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param bypassInstanceData defines a boolean indicating that the function should not take into account the instance data (applies only if the mesh has instances). Default: false
     * @returns a boolean
     */
    isVerticesDataPresent(kind, bypassInstanceData) {
        var _a;
        if (!this._geometry) {
            if (this._delayInfo) {
                return this._delayInfo.indexOf(kind) !== -1;
            }
            return false;
        }
        return (!bypassInstanceData && ((_a = this._userInstancedBuffersStorage) === null || _a === void 0 ? void 0 : _a.vertexBuffers[kind]) !== undefined) || this._geometry.isVerticesDataPresent(kind);
    }
    /**
     * Returns a boolean defining if the vertex data for the requested `kind` is updatable.
     * @param kind defines which buffer to check (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param bypassInstanceData defines a boolean indicating that the function should not take into account the instance data (applies only if the mesh has instances). Default: false
     * @returns a boolean
     */
    isVertexBufferUpdatable(kind, bypassInstanceData) {
        var _a;
        if (!this._geometry) {
            if (this._delayInfo) {
                return this._delayInfo.indexOf(kind) !== -1;
            }
            return false;
        }
        if (!bypassInstanceData) {
            const buffer = (_a = this._userInstancedBuffersStorage) === null || _a === void 0 ? void 0 : _a.vertexBuffers[kind];
            if (buffer) {
                return buffer.isUpdatable();
            }
        }
        return this._geometry.isVertexBufferUpdatable(kind);
    }
    /**
     * Returns a string which contains the list of existing `kinds` of Vertex Data associated with this mesh.
     * @param bypassInstanceData defines a boolean indicating that the function should not take into account the instance data (applies only if the mesh has instances). Default: false
     * @returns an array of strings
     */
    getVerticesDataKinds(bypassInstanceData) {
        if (!this._geometry) {
            const result = new Array();
            if (this._delayInfo) {
                this._delayInfo.forEach(function (kind) {
                    result.push(kind);
                });
            }
            return result;
        }
        const kinds = this._geometry.getVerticesDataKinds();
        if (!bypassInstanceData && this._userInstancedBuffersStorage) {
            for (const kind in this._userInstancedBuffersStorage.vertexBuffers) {
                if (kinds.indexOf(kind) === -1) {
                    kinds.push(kind);
                }
            }
        }
        return kinds;
    }
    /**
     * Returns a positive integer : the total number of indices in this mesh geometry.
     * @returns the numner of indices or zero if the mesh has no geometry.
     */
    getTotalIndices() {
        if (!this._geometry) {
            return 0;
        }
        return this._geometry.getTotalIndices();
    }
    /**
     * Returns an array of integers or a typed array (Int32Array, Uint32Array, Uint16Array) populated with the mesh indices.
     * @param copyWhenShared If true (default false) and and if the mesh geometry is shared among some other meshes, the returned array is a copy of the internal one.
     * @param forceCopy defines a boolean indicating that the returned array must be cloned upon returning it
     * @returns the indices array or an empty array if the mesh has no geometry
     */
    getIndices(copyWhenShared, forceCopy) {
        if (!this._geometry) {
            return [];
        }
        return this._geometry.getIndices(copyWhenShared, forceCopy);
    }
    get isBlocked() {
        return this._masterMesh !== null && this._masterMesh !== undefined;
    }
    /**
     * Determine if the current mesh is ready to be rendered
     * @param completeCheck defines if a complete check (including materials and lights) has to be done (false by default)
     * @param forceInstanceSupport will check if the mesh will be ready when used with instances (false by default)
     * @returns true if all associated assets are ready (material, textures, shaders)
     */
    isReady(completeCheck = false, forceInstanceSupport = false) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (this.delayLoadState === 2) {
            return false;
        }
        if (!super.isReady(completeCheck)) {
            return false;
        }
        if (!this.subMeshes || this.subMeshes.length === 0) {
            return true;
        }
        if (!completeCheck) {
            return true;
        }
        const engine = this.getEngine();
        const scene = this.getScene();
        const hardwareInstancedRendering = forceInstanceSupport || (engine.getCaps().instancedArrays && (this.instances.length > 0 || this.hasThinInstances));
        this.computeWorldMatrix();
        const mat = this.material || scene.defaultMaterial;
        if (mat) {
            if (mat._storeEffectOnSubMeshes) {
                for (const subMesh of this.subMeshes) {
                    const effectiveMaterial = subMesh.getMaterial();
                    if (effectiveMaterial) {
                        if (effectiveMaterial._storeEffectOnSubMeshes) {
                            if (!effectiveMaterial.isReadyForSubMesh(this, subMesh, hardwareInstancedRendering)) {
                                return false;
                            }
                        }
                        else {
                            if (!effectiveMaterial.isReady(this, hardwareInstancedRendering)) {
                                return false;
                            }
                        }
                    }
                }
            }
            else {
                if (!mat.isReady(this, hardwareInstancedRendering)) {
                    return false;
                }
            }
        }
        // Shadows
        const currentRenderPassId = engine.currentRenderPassId;
        for (const light of this.lightSources) {
            const generators = light.getShadowGenerators();
            if (!generators) {
                continue;
            }
            const iterator = generators.values();
            for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
                const generator = key.value;
                if (generator && (!((_a = generator.getShadowMap()) === null || _a === void 0 ? void 0 : _a.renderList) || (((_b = generator.getShadowMap()) === null || _b === void 0 ? void 0 : _b.renderList) && ((_d = (_c = generator.getShadowMap()) === null || _c === void 0 ? void 0 : _c.renderList) === null || _d === void 0 ? void 0 : _d.indexOf(this)) !== -1))) {
                    const shadowMap = generator.getShadowMap();
                    const renderPassIds = (_e = shadowMap.renderPassIds) !== null && _e !== void 0 ? _e : [engine.currentRenderPassId];
                    for (let p = 0; p < renderPassIds.length; ++p) {
                        engine.currentRenderPassId = renderPassIds[p];
                        for (const subMesh of this.subMeshes) {
                            if (!generator.isReady(subMesh, hardwareInstancedRendering, (_g = (_f = subMesh.getMaterial()) === null || _f === void 0 ? void 0 : _f.needAlphaBlendingForMesh(this)) !== null && _g !== void 0 ? _g : false)) {
                                engine.currentRenderPassId = currentRenderPassId;
                                return false;
                            }
                        }
                    }
                    engine.currentRenderPassId = currentRenderPassId;
                }
            }
        }
        // LOD
        for (const lod of this._internalMeshDataInfo._LODLevels) {
            if (lod.mesh && !lod.mesh.isReady(hardwareInstancedRendering)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Gets a boolean indicating if the normals aren't to be recomputed on next mesh `positions` array update. This property is pertinent only for updatable parametric shapes.
     */
    get areNormalsFrozen() {
        return this._internalMeshDataInfo._areNormalsFrozen;
    }
    /**
     * This function affects parametric shapes on vertex position update only : ribbons, tubes, etc. It has no effect at all on other shapes. It prevents the mesh normals from being recomputed on next `positions` array update.
     * @returns the current mesh
     */
    freezeNormals() {
        this._internalMeshDataInfo._areNormalsFrozen = true;
        return this;
    }
    /**
     * This function affects parametric shapes on vertex position update only : ribbons, tubes, etc. It has no effect at all on other shapes. It reactivates the mesh normals computation if it was previously frozen
     * @returns the current mesh
     */
    unfreezeNormals() {
        this._internalMeshDataInfo._areNormalsFrozen = false;
        return this;
    }
    /**
     * Sets a value overriding the instance count. Only applicable when custom instanced InterleavedVertexBuffer are used rather than InstancedMeshs
     */
    set overridenInstanceCount(count) {
        this._instanceDataStorage.overridenInstanceCount = count;
    }
    // Methods
    /** @internal */
    _preActivate() {
        const internalDataInfo = this._internalMeshDataInfo;
        const sceneRenderId = this.getScene().getRenderId();
        if (internalDataInfo._preActivateId === sceneRenderId) {
            return this;
        }
        internalDataInfo._preActivateId = sceneRenderId;
        this._instanceDataStorage.visibleInstances = null;
        return this;
    }
    /**
     * @internal
     */
    _preActivateForIntermediateRendering(renderId) {
        if (this._instanceDataStorage.visibleInstances) {
            this._instanceDataStorage.visibleInstances.intermediateDefaultRenderId = renderId;
        }
        return this;
    }
    /**
     * @internal
     */
    _registerInstanceForRenderId(instance, renderId) {
        if (!this._instanceDataStorage.visibleInstances) {
            this._instanceDataStorage.visibleInstances = {
                defaultRenderId: renderId,
                selfDefaultRenderId: this._renderId,
            };
        }
        if (!this._instanceDataStorage.visibleInstances[renderId]) {
            if (this._instanceDataStorage.previousRenderId !== undefined && this._instanceDataStorage.isFrozen) {
                this._instanceDataStorage.visibleInstances[this._instanceDataStorage.previousRenderId] = null;
            }
            this._instanceDataStorage.previousRenderId = renderId;
            this._instanceDataStorage.visibleInstances[renderId] = new Array();
        }
        this._instanceDataStorage.visibleInstances[renderId].push(instance);
        return this;
    }
    _afterComputeWorldMatrix() {
        super._afterComputeWorldMatrix();
        if (!this.hasThinInstances) {
            return;
        }
        if (!this.doNotSyncBoundingInfo) {
            this.thinInstanceRefreshBoundingInfo(false);
        }
    }
    /** @internal */
    _postActivate() {
        if (this.edgesShareWithInstances && this.edgesRenderer && this.edgesRenderer.isEnabled && this._renderingGroup) {
            this._renderingGroup._edgesRenderers.pushNoDuplicate(this.edgesRenderer);
            this.edgesRenderer.customInstances.push(this.getWorldMatrix());
        }
    }
    /**
     * This method recomputes and sets a new BoundingInfo to the mesh unless it is locked.
     * This means the mesh underlying bounding box and sphere are recomputed.
     * @param applySkeleton defines whether to apply the skeleton before computing the bounding info
     * @param applyMorph  defines whether to apply the morph target before computing the bounding info
     * @returns the current mesh
     */
    refreshBoundingInfo(applySkeleton = false, applyMorph = false) {
        if (this.hasBoundingInfo && this.getBoundingInfo().isLocked) {
            return this;
        }
        const bias = this.geometry ? this.geometry.boundingBias : null;
        this._refreshBoundingInfo(this._getPositionData(applySkeleton, applyMorph), bias);
        return this;
    }
    /**
     * @internal
     */
    _createGlobalSubMesh(force) {
        const totalVertices = this.getTotalVertices();
        if (!totalVertices || !this.getIndices()) {
            return null;
        }
        // Check if we need to recreate the submeshes
        if (this.subMeshes && this.subMeshes.length > 0) {
            const ib = this.getIndices();
            if (!ib) {
                return null;
            }
            const totalIndices = ib.length;
            let needToRecreate = false;
            if (force) {
                needToRecreate = true;
            }
            else {
                for (const submesh of this.subMeshes) {
                    if (submesh.indexStart + submesh.indexCount > totalIndices) {
                        needToRecreate = true;
                        break;
                    }
                    if (submesh.verticesStart + submesh.verticesCount > totalVertices) {
                        needToRecreate = true;
                        break;
                    }
                }
            }
            if (!needToRecreate) {
                return this.subMeshes[0];
            }
        }
        this.releaseSubMeshes();
        return new SubMesh(0, 0, totalVertices, 0, this.getTotalIndices(), this);
    }
    /**
     * This function will subdivide the mesh into multiple submeshes
     * @param count defines the expected number of submeshes
     */
    subdivide(count) {
        if (count < 1) {
            return;
        }
        const totalIndices = this.getTotalIndices();
        let subdivisionSize = (totalIndices / count) | 0;
        let offset = 0;
        // Ensure that subdivisionSize is a multiple of 3
        while (subdivisionSize % 3 !== 0) {
            subdivisionSize++;
        }
        this.releaseSubMeshes();
        for (let index = 0; index < count; index++) {
            if (offset >= totalIndices) {
                break;
            }
            SubMesh.CreateFromIndices(0, offset, index === count - 1 ? totalIndices - offset : subdivisionSize, this, undefined, false);
            offset += subdivisionSize;
        }
        this.refreshBoundingInfo();
        this.synchronizeInstances();
    }
    /**
     * Copy a FloatArray into a specific associated vertex buffer
     * @param kind defines which buffer to write to (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param data defines the data source
     * @param updatable defines if the updated vertex buffer must be flagged as updatable
     * @param stride defines the data stride size (can be null)
     * @returns the current mesh
     */
    setVerticesData(kind, data, updatable = false, stride) {
        if (!this._geometry) {
            const vertexData = new VertexData();
            vertexData.set(data, kind);
            const scene = this.getScene();
            new Geometry(Geometry.RandomId(), scene, vertexData, updatable, this);
        }
        else {
            this._geometry.setVerticesData(kind, data, updatable, stride);
        }
        return this;
    }
    /**
     * Delete a vertex buffer associated with this mesh
     * @param kind defines which buffer to delete (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     */
    removeVerticesData(kind) {
        if (!this._geometry) {
            return;
        }
        this._geometry.removeVerticesData(kind);
    }
    /**
     * Flags an associated vertex buffer as updatable
     * @param kind defines which buffer to use (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param updatable defines if the updated vertex buffer must be flagged as updatable
     */
    markVerticesDataAsUpdatable(kind, updatable = true) {
        const vb = this.getVertexBuffer(kind);
        if (!vb || vb.isUpdatable() === updatable) {
            return;
        }
        this.setVerticesData(kind, this.getVerticesData(kind), updatable);
    }
    /**
     * Sets the mesh global Vertex Buffer
     * @param buffer defines the buffer to use
     * @param disposeExistingBuffer disposes the existing buffer, if any (default: true)
     * @returns the current mesh
     */
    setVerticesBuffer(buffer, disposeExistingBuffer = true) {
        if (!this._geometry) {
            this._geometry = Geometry.CreateGeometryForMesh(this);
        }
        this._geometry.setVerticesBuffer(buffer, null, disposeExistingBuffer);
        return this;
    }
    /**
     * Update a specific associated vertex buffer
     * @param kind defines which buffer to write to (positions, indices, normals, etc). Possible `kind` values :
     * - VertexBuffer.PositionKind
     * - VertexBuffer.UVKind
     * - VertexBuffer.UV2Kind
     * - VertexBuffer.UV3Kind
     * - VertexBuffer.UV4Kind
     * - VertexBuffer.UV5Kind
     * - VertexBuffer.UV6Kind
     * - VertexBuffer.ColorKind
     * - VertexBuffer.MatricesIndicesKind
     * - VertexBuffer.MatricesIndicesExtraKind
     * - VertexBuffer.MatricesWeightsKind
     * - VertexBuffer.MatricesWeightsExtraKind
     * @param data defines the data source
     * @param updateExtends defines if extends info of the mesh must be updated (can be null). This is mostly useful for "position" kind
     * @param makeItUnique defines if the geometry associated with the mesh must be cloned to make the change only for this mesh (and not all meshes associated with the same geometry)
     * @returns the current mesh
     */
    updateVerticesData(kind, data, updateExtends, makeItUnique) {
        if (!this._geometry) {
            return this;
        }
        if (!makeItUnique) {
            this._geometry.updateVerticesData(kind, data, updateExtends);
        }
        else {
            this.makeGeometryUnique();
            this.updateVerticesData(kind, data, updateExtends, false);
        }
        return this;
    }
    /**
     * This method updates the vertex positions of an updatable mesh according to the `positionFunction` returned values.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/dynamicMeshMorph#other-shapes-updatemeshpositions
     * @param positionFunction is a simple JS function what is passed the mesh `positions` array. It doesn't need to return anything
     * @param computeNormals is a boolean (default true) to enable/disable the mesh normal recomputation after the vertex position update
     * @returns the current mesh
     */
    updateMeshPositions(positionFunction, computeNormals = true) {
        const positions = this.getVerticesData(VertexBuffer.PositionKind);
        if (!positions) {
            return this;
        }
        positionFunction(positions);
        this.updateVerticesData(VertexBuffer.PositionKind, positions, false, false);
        if (computeNormals) {
            const indices = this.getIndices();
            const normals = this.getVerticesData(VertexBuffer.NormalKind);
            if (!normals) {
                return this;
            }
            VertexData.ComputeNormals(positions, indices, normals);
            this.updateVerticesData(VertexBuffer.NormalKind, normals, false, false);
        }
        return this;
    }
    /**
     * Creates a un-shared specific occurence of the geometry for the mesh.
     * @returns the current mesh
     */
    makeGeometryUnique() {
        if (!this._geometry) {
            return this;
        }
        if (this._geometry.meshes.length === 1) {
            return this;
        }
        const oldGeometry = this._geometry;
        const geometry = this._geometry.copy(Geometry.RandomId());
        oldGeometry.releaseForMesh(this, true);
        geometry.applyToMesh(this);
        return this;
    }
    /**
     * Set the index buffer of this mesh
     * @param indices defines the source data
     * @param totalVertices defines the total number of vertices referenced by this index data (can be null)
     * @param updatable defines if the updated index buffer must be flagged as updatable (default is false)
     * @returns the current mesh
     */
    setIndices(indices, totalVertices = null, updatable = false) {
        if (!this._geometry) {
            const vertexData = new VertexData();
            vertexData.indices = indices;
            const scene = this.getScene();
            new Geometry(Geometry.RandomId(), scene, vertexData, updatable, this);
        }
        else {
            this._geometry.setIndices(indices, totalVertices, updatable);
        }
        return this;
    }
    /**
     * Update the current index buffer
     * @param indices defines the source data
     * @param offset defines the offset in the index buffer where to store the new data (can be null)
     * @param gpuMemoryOnly defines a boolean indicating that only the GPU memory must be updated leaving the CPU version of the indices unchanged (false by default)
     * @returns the current mesh
     */
    updateIndices(indices, offset, gpuMemoryOnly = false) {
        if (!this._geometry) {
            return this;
        }
        this._geometry.updateIndices(indices, offset, gpuMemoryOnly);
        return this;
    }
    /**
     * Invert the geometry to move from a right handed system to a left handed one.
     * @returns the current mesh
     */
    toLeftHanded() {
        if (!this._geometry) {
            return this;
        }
        this._geometry.toLeftHanded();
        return this;
    }
    /**
     * @internal
     */
    _bind(subMesh, effect, fillMode, allowInstancedRendering = true) {
        if (!this._geometry) {
            return this;
        }
        const engine = this.getScene().getEngine();
        // Morph targets
        if (this.morphTargetManager && this.morphTargetManager.isUsingTextureForTargets) {
            this.morphTargetManager._bind(effect);
        }
        // Wireframe
        let indexToBind;
        if (this._unIndexed) {
            indexToBind = null;
        }
        else {
            switch (this._getRenderingFillMode(fillMode)) {
                case Material.PointFillMode:
                    indexToBind = null;
                    break;
                case Material.WireFrameFillMode:
                    indexToBind = subMesh._getLinesIndexBuffer(this.getIndices(), engine);
                    break;
                default:
                case Material.TriangleFillMode:
                    indexToBind = this._geometry.getIndexBuffer();
                    break;
            }
        }
        // VBOs
        if (!allowInstancedRendering || !this._userInstancedBuffersStorage || this.hasThinInstances) {
            this._geometry._bind(effect, indexToBind);
        }
        else {
            this._geometry._bind(effect, indexToBind, this._userInstancedBuffersStorage.vertexBuffers, this._userInstancedBuffersStorage.vertexArrayObjects);
        }
        return this;
    }
    /**
     * @internal
     */
    _draw(subMesh, fillMode, instancesCount) {
        if (!this._geometry || !this._geometry.getVertexBuffers() || (!this._unIndexed && !this._geometry.getIndexBuffer())) {
            return this;
        }
        if (this._internalMeshDataInfo._onBeforeDrawObservable) {
            this._internalMeshDataInfo._onBeforeDrawObservable.notifyObservers(this);
        }
        const scene = this.getScene();
        const engine = scene.getEngine();
        if (this._unIndexed || fillMode == Material.PointFillMode) {
            // or triangles as points
            engine.drawArraysType(fillMode, subMesh.verticesStart, subMesh.verticesCount, this.forcedInstanceCount || instancesCount);
        }
        else if (fillMode == Material.WireFrameFillMode) {
            // Triangles as wireframe
            engine.drawElementsType(fillMode, 0, subMesh._linesIndexCount, this.forcedInstanceCount || instancesCount);
        }
        else {
            engine.drawElementsType(fillMode, subMesh.indexStart, subMesh.indexCount, this.forcedInstanceCount || instancesCount);
        }
        return this;
    }
    /**
     * Registers for this mesh a javascript function called just before the rendering process
     * @param func defines the function to call before rendering this mesh
     * @returns the current mesh
     */
    registerBeforeRender(func) {
        this.onBeforeRenderObservable.add(func);
        return this;
    }
    /**
     * Disposes a previously registered javascript function called before the rendering
     * @param func defines the function to remove
     * @returns the current mesh
     */
    unregisterBeforeRender(func) {
        this.onBeforeRenderObservable.removeCallback(func);
        return this;
    }
    /**
     * Registers for this mesh a javascript function called just after the rendering is complete
     * @param func defines the function to call after rendering this mesh
     * @returns the current mesh
     */
    registerAfterRender(func) {
        this.onAfterRenderObservable.add(func);
        return this;
    }
    /**
     * Disposes a previously registered javascript function called after the rendering.
     * @param func defines the function to remove
     * @returns the current mesh
     */
    unregisterAfterRender(func) {
        this.onAfterRenderObservable.removeCallback(func);
        return this;
    }
    /**
     * @internal
     */
    _getInstancesRenderList(subMeshId, isReplacementMode = false) {
        if (this._instanceDataStorage.isFrozen) {
            if (isReplacementMode) {
                this._instanceDataStorage.batchCacheReplacementModeInFrozenMode.hardwareInstancedRendering[subMeshId] = false;
                this._instanceDataStorage.batchCacheReplacementModeInFrozenMode.renderSelf[subMeshId] = true;
                return this._instanceDataStorage.batchCacheReplacementModeInFrozenMode;
            }
            if (this._instanceDataStorage.previousBatch) {
                return this._instanceDataStorage.previousBatch;
            }
        }
        const scene = this.getScene();
        const isInIntermediateRendering = scene._isInIntermediateRendering();
        const onlyForInstances = isInIntermediateRendering
            ? this._internalAbstractMeshDataInfo._onlyForInstancesIntermediate
            : this._internalAbstractMeshDataInfo._onlyForInstances;
        const batchCache = this._instanceDataStorage.batchCache;
        batchCache.mustReturn = false;
        batchCache.renderSelf[subMeshId] = isReplacementMode || (!onlyForInstances && this.isEnabled() && this.isVisible);
        batchCache.visibleInstances[subMeshId] = null;
        if (this._instanceDataStorage.visibleInstances && !isReplacementMode) {
            const visibleInstances = this._instanceDataStorage.visibleInstances;
            const currentRenderId = scene.getRenderId();
            const defaultRenderId = isInIntermediateRendering ? visibleInstances.intermediateDefaultRenderId : visibleInstances.defaultRenderId;
            batchCache.visibleInstances[subMeshId] = visibleInstances[currentRenderId];
            if (!batchCache.visibleInstances[subMeshId] && defaultRenderId) {
                batchCache.visibleInstances[subMeshId] = visibleInstances[defaultRenderId];
            }
        }
        batchCache.hardwareInstancedRendering[subMeshId] =
            !isReplacementMode &&
                this._instanceDataStorage.hardwareInstancedRendering &&
                batchCache.visibleInstances[subMeshId] !== null &&
                batchCache.visibleInstances[subMeshId] !== undefined;
        this._instanceDataStorage.previousBatch = batchCache;
        return batchCache;
    }
    /**
     * @internal
     */
    _renderWithInstances(subMesh, fillMode, batch, effect, engine) {
        var _a;
        const visibleInstances = batch.visibleInstances[subMesh._id];
        const visibleInstanceCount = visibleInstances ? visibleInstances.length : 0;
        const instanceStorage = this._instanceDataStorage;
        const currentInstancesBufferSize = instanceStorage.instancesBufferSize;
        let instancesBuffer = instanceStorage.instancesBuffer;
        let instancesPreviousBuffer = instanceStorage.instancesPreviousBuffer;
        const matricesCount = visibleInstanceCount + 1;
        const bufferSize = matricesCount * 16 * 4;
        while (instanceStorage.instancesBufferSize < bufferSize) {
            instanceStorage.instancesBufferSize *= 2;
        }
        if (!instanceStorage.instancesData || currentInstancesBufferSize != instanceStorage.instancesBufferSize) {
            instanceStorage.instancesData = new Float32Array(instanceStorage.instancesBufferSize / 4);
        }
        if ((this._scene.needsPreviousWorldMatrices && !instanceStorage.instancesPreviousData) || currentInstancesBufferSize != instanceStorage.instancesBufferSize) {
            instanceStorage.instancesPreviousData = new Float32Array(instanceStorage.instancesBufferSize / 4);
        }
        let offset = 0;
        let instancesCount = 0;
        const renderSelf = batch.renderSelf[subMesh._id];
        const needUpdateBuffer = !instancesBuffer ||
            currentInstancesBufferSize !== instanceStorage.instancesBufferSize ||
            (this._scene.needsPreviousWorldMatrices && !instanceStorage.instancesPreviousBuffer);
        if (!this._instanceDataStorage.manualUpdate && (!instanceStorage.isFrozen || needUpdateBuffer)) {
            const world = this.getWorldMatrix();
            if (renderSelf) {
                if (this._scene.needsPreviousWorldMatrices) {
                    if (!instanceStorage.masterMeshPreviousWorldMatrix) {
                        instanceStorage.masterMeshPreviousWorldMatrix = world.clone();
                        instanceStorage.masterMeshPreviousWorldMatrix.copyToArray(instanceStorage.instancesPreviousData, offset);
                    }
                    else {
                        instanceStorage.masterMeshPreviousWorldMatrix.copyToArray(instanceStorage.instancesPreviousData, offset);
                        instanceStorage.masterMeshPreviousWorldMatrix.copyFrom(world);
                    }
                }
                world.copyToArray(instanceStorage.instancesData, offset);
                offset += 16;
                instancesCount++;
            }
            if (visibleInstances) {
                if (Mesh.INSTANCEDMESH_SORT_TRANSPARENT && this._scene.activeCamera && ((_a = subMesh.getMaterial()) === null || _a === void 0 ? void 0 : _a.needAlphaBlendingForMesh(subMesh.getRenderingMesh()))) {
                    const cameraPosition = this._scene.activeCamera.globalPosition;
                    for (let instanceIndex = 0; instanceIndex < visibleInstances.length; instanceIndex++) {
                        const instanceMesh = visibleInstances[instanceIndex];
                        instanceMesh._distanceToCamera = Vector3.Distance(instanceMesh.getBoundingInfo().boundingSphere.centerWorld, cameraPosition);
                    }
                    visibleInstances.sort((m1, m2) => {
                        return m1._distanceToCamera > m2._distanceToCamera ? -1 : m1._distanceToCamera < m2._distanceToCamera ? 1 : 0;
                    });
                }
                for (let instanceIndex = 0; instanceIndex < visibleInstances.length; instanceIndex++) {
                    const instance = visibleInstances[instanceIndex];
                    const matrix = instance.getWorldMatrix();
                    matrix.copyToArray(instanceStorage.instancesData, offset);
                    if (this._scene.needsPreviousWorldMatrices) {
                        if (!instance._previousWorldMatrix) {
                            instance._previousWorldMatrix = matrix.clone();
                            instance._previousWorldMatrix.copyToArray(instanceStorage.instancesPreviousData, offset);
                        }
                        else {
                            instance._previousWorldMatrix.copyToArray(instanceStorage.instancesPreviousData, offset);
                            instance._previousWorldMatrix.copyFrom(matrix);
                        }
                    }
                    offset += 16;
                    instancesCount++;
                }
            }
        }
        else {
            instancesCount = (renderSelf ? 1 : 0) + visibleInstanceCount;
        }
        if (needUpdateBuffer) {
            if (instancesBuffer) {
                instancesBuffer.dispose();
            }
            if (instancesPreviousBuffer) {
                instancesPreviousBuffer.dispose();
            }
            instancesBuffer = new Buffer(engine, instanceStorage.instancesData, true, 16, false, true);
            instanceStorage.instancesBuffer = instancesBuffer;
            if (!this._userInstancedBuffersStorage) {
                this._userInstancedBuffersStorage = {
                    data: {},
                    vertexBuffers: {},
                    strides: {},
                    sizes: {},
                    vertexArrayObjects: this.getEngine().getCaps().vertexArrayObject ? {} : undefined,
                };
            }
            this._userInstancedBuffersStorage.vertexBuffers["world0"] = instancesBuffer.createVertexBuffer("world0", 0, 4);
            this._userInstancedBuffersStorage.vertexBuffers["world1"] = instancesBuffer.createVertexBuffer("world1", 4, 4);
            this._userInstancedBuffersStorage.vertexBuffers["world2"] = instancesBuffer.createVertexBuffer("world2", 8, 4);
            this._userInstancedBuffersStorage.vertexBuffers["world3"] = instancesBuffer.createVertexBuffer("world3", 12, 4);
            if (this._scene.needsPreviousWorldMatrices) {
                instancesPreviousBuffer = new Buffer(engine, instanceStorage.instancesPreviousData, true, 16, false, true);
                instanceStorage.instancesPreviousBuffer = instancesPreviousBuffer;
                this._userInstancedBuffersStorage.vertexBuffers["previousWorld0"] = instancesPreviousBuffer.createVertexBuffer("previousWorld0", 0, 4);
                this._userInstancedBuffersStorage.vertexBuffers["previousWorld1"] = instancesPreviousBuffer.createVertexBuffer("previousWorld1", 4, 4);
                this._userInstancedBuffersStorage.vertexBuffers["previousWorld2"] = instancesPreviousBuffer.createVertexBuffer("previousWorld2", 8, 4);
                this._userInstancedBuffersStorage.vertexBuffers["previousWorld3"] = instancesPreviousBuffer.createVertexBuffer("previousWorld3", 12, 4);
            }
            this._invalidateInstanceVertexArrayObject();
        }
        else {
            if (!this._instanceDataStorage.isFrozen || this._instanceDataStorage.forceMatrixUpdates) {
                instancesBuffer.updateDirectly(instanceStorage.instancesData, 0, instancesCount);
                if (this._scene.needsPreviousWorldMatrices && (!this._instanceDataStorage.manualUpdate || this._instanceDataStorage.previousManualUpdate)) {
                    instancesPreviousBuffer.updateDirectly(instanceStorage.instancesPreviousData, 0, instancesCount);
                }
            }
        }
        this._processInstancedBuffers(visibleInstances, renderSelf);
        // Stats
        this.getScene()._activeIndices.addCount(subMesh.indexCount * instancesCount, false);
        // Draw
        if (engine._currentDrawContext) {
            engine._currentDrawContext.useInstancing = true;
        }
        this._bind(subMesh, effect, fillMode);
        this._draw(subMesh, fillMode, instancesCount);
        // Write current matrices as previous matrices in case of manual update
        // Default behaviour when previous matrices are not specified explicitly
        // Will break if instances number/order changes
        if (this._scene.needsPreviousWorldMatrices &&
            !needUpdateBuffer &&
            this._instanceDataStorage.manualUpdate &&
            (!this._instanceDataStorage.isFrozen || this._instanceDataStorage.forceMatrixUpdates) &&
            !this._instanceDataStorage.previousManualUpdate) {
            instancesPreviousBuffer.updateDirectly(instanceStorage.instancesData, 0, instancesCount);
        }
        engine.unbindInstanceAttributes();
        return this;
    }
    /**
     * @internal
     */
    _renderWithThinInstances(subMesh, fillMode, effect, engine) {
        var _a, _b;
        // Stats
        const instancesCount = (_b = (_a = this._thinInstanceDataStorage) === null || _a === void 0 ? void 0 : _a.instancesCount) !== null && _b !== void 0 ? _b : 0;
        this.getScene()._activeIndices.addCount(subMesh.indexCount * instancesCount, false);
        // Draw
        if (engine._currentDrawContext) {
            engine._currentDrawContext.useInstancing = true;
        }
        this._bind(subMesh, effect, fillMode);
        this._draw(subMesh, fillMode, instancesCount);
        // Write current matrices as previous matrices
        // Default behaviour when previous matrices are not specified explicitly
        // Will break if instances number/order changes
        if (this._scene.needsPreviousWorldMatrices && !this._thinInstanceDataStorage.previousMatrixData && this._thinInstanceDataStorage.matrixData) {
            if (!this._thinInstanceDataStorage.previousMatrixBuffer) {
                this._thinInstanceDataStorage.previousMatrixBuffer = this._thinInstanceCreateMatrixBuffer("previousWorld", this._thinInstanceDataStorage.matrixData, false);
            }
            else {
                this._thinInstanceDataStorage.previousMatrixBuffer.updateDirectly(this._thinInstanceDataStorage.matrixData, 0, instancesCount);
            }
        }
        engine.unbindInstanceAttributes();
    }
    /**
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _processInstancedBuffers(visibleInstances, renderSelf) {
        // Do nothing
    }
    /**
     * @internal
     */
    _processRendering(renderingMesh, subMesh, effect, fillMode, batch, hardwareInstancedRendering, onBeforeDraw, effectiveMaterial) {
        const scene = this.getScene();
        const engine = scene.getEngine();
        fillMode = this._getRenderingFillMode(fillMode);
        if (hardwareInstancedRendering && subMesh.getRenderingMesh().hasThinInstances) {
            this._renderWithThinInstances(subMesh, fillMode, effect, engine);
            return this;
        }
        if (hardwareInstancedRendering) {
            this._renderWithInstances(subMesh, fillMode, batch, effect, engine);
        }
        else {
            if (engine._currentDrawContext) {
                engine._currentDrawContext.useInstancing = false;
            }
            let instanceCount = 0;
            if (batch.renderSelf[subMesh._id]) {
                // Draw
                if (onBeforeDraw) {
                    onBeforeDraw(false, renderingMesh.getWorldMatrix(), effectiveMaterial);
                }
                instanceCount++;
                this._draw(subMesh, fillMode, this._instanceDataStorage.overridenInstanceCount);
            }
            const visibleInstancesForSubMesh = batch.visibleInstances[subMesh._id];
            if (visibleInstancesForSubMesh) {
                const visibleInstanceCount = visibleInstancesForSubMesh.length;
                instanceCount += visibleInstanceCount;
                // Stats
                for (let instanceIndex = 0; instanceIndex < visibleInstanceCount; instanceIndex++) {
                    const instance = visibleInstancesForSubMesh[instanceIndex];
                    // World
                    const world = instance.getWorldMatrix();
                    if (onBeforeDraw) {
                        onBeforeDraw(true, world, effectiveMaterial);
                    }
                    // Draw
                    this._draw(subMesh, fillMode);
                }
            }
            // Stats
            scene._activeIndices.addCount(subMesh.indexCount * instanceCount, false);
        }
        return this;
    }
    /**
     * @internal
     */
    _rebuild(dispose = false) {
        if (this._instanceDataStorage.instancesBuffer) {
            // Dispose instance buffer to be recreated in _renderWithInstances when rendered
            if (dispose) {
                this._instanceDataStorage.instancesBuffer.dispose();
            }
            this._instanceDataStorage.instancesBuffer = null;
        }
        if (this._userInstancedBuffersStorage) {
            for (const kind in this._userInstancedBuffersStorage.vertexBuffers) {
                const buffer = this._userInstancedBuffersStorage.vertexBuffers[kind];
                if (buffer) {
                    // Dispose instance buffer to be recreated in _renderWithInstances when rendered
                    if (dispose) {
                        buffer.dispose();
                    }
                    this._userInstancedBuffersStorage.vertexBuffers[kind] = null;
                }
            }
            if (this._userInstancedBuffersStorage.vertexArrayObjects) {
                this._userInstancedBuffersStorage.vertexArrayObjects = {};
            }
        }
        this._internalMeshDataInfo._effectiveMaterial = null;
        super._rebuild(dispose);
    }
    /** @internal */
    _freeze() {
        if (!this.subMeshes) {
            return;
        }
        // Prepare batches
        for (let index = 0; index < this.subMeshes.length; index++) {
            this._getInstancesRenderList(index);
        }
        this._internalMeshDataInfo._effectiveMaterial = null;
        this._instanceDataStorage.isFrozen = true;
    }
    /** @internal */
    _unFreeze() {
        this._instanceDataStorage.isFrozen = false;
        this._instanceDataStorage.previousBatch = null;
    }
    /**
     * Triggers the draw call for the mesh. Usually, you don't need to call this method by your own because the mesh rendering is handled by the scene rendering manager
     * @param subMesh defines the subMesh to render
     * @param enableAlphaMode defines if alpha mode can be changed
     * @param effectiveMeshReplacement defines an optional mesh used to provide info for the rendering
     * @returns the current mesh
     */
    render(subMesh, enableAlphaMode, effectiveMeshReplacement) {
        var _a, _b, _c;
        const scene = this.getScene();
        if (this._internalAbstractMeshDataInfo._isActiveIntermediate) {
            this._internalAbstractMeshDataInfo._isActiveIntermediate = false;
        }
        else {
            this._internalAbstractMeshDataInfo._isActive = false;
        }
        if (this._checkOcclusionQuery() && !this._occlusionDataStorage.forceRenderingWhenOccluded) {
            return this;
        }
        // Managing instances
        const batch = this._getInstancesRenderList(subMesh._id, !!effectiveMeshReplacement);
        if (batch.mustReturn) {
            return this;
        }
        // Checking geometry state
        if (!this._geometry || !this._geometry.getVertexBuffers() || (!this._unIndexed && !this._geometry.getIndexBuffer())) {
            return this;
        }
        const engine = scene.getEngine();
        let oldCameraMaxZ = 0;
        let oldCamera = null;
        if (this.ignoreCameraMaxZ && scene.activeCamera && !scene._isInIntermediateRendering()) {
            oldCameraMaxZ = scene.activeCamera.maxZ;
            oldCamera = scene.activeCamera;
            scene.activeCamera.maxZ = 0;
            scene.updateTransformMatrix(true);
        }
        if (this._internalMeshDataInfo._onBeforeRenderObservable) {
            this._internalMeshDataInfo._onBeforeRenderObservable.notifyObservers(this);
        }
        const renderingMesh = subMesh.getRenderingMesh();
        const hardwareInstancedRendering = batch.hardwareInstancedRendering[subMesh._id] ||
            renderingMesh.hasThinInstances ||
            (!!this._userInstancedBuffersStorage && !subMesh.getMesh()._internalAbstractMeshDataInfo._actAsRegularMesh);
        const instanceDataStorage = this._instanceDataStorage;
        const material = subMesh.getMaterial();
        if (!material) {
            if (oldCamera) {
                oldCamera.maxZ = oldCameraMaxZ;
                scene.updateTransformMatrix(true);
            }
            return this;
        }
        // Material
        if (!instanceDataStorage.isFrozen || !this._internalMeshDataInfo._effectiveMaterial || this._internalMeshDataInfo._effectiveMaterial !== material) {
            if (material._storeEffectOnSubMeshes) {
                if (!material.isReadyForSubMesh(this, subMesh, hardwareInstancedRendering)) {
                    if (oldCamera) {
                        oldCamera.maxZ = oldCameraMaxZ;
                        scene.updateTransformMatrix(true);
                    }
                    return this;
                }
            }
            else if (!material.isReady(this, hardwareInstancedRendering)) {
                if (oldCamera) {
                    oldCamera.maxZ = oldCameraMaxZ;
                    scene.updateTransformMatrix(true);
                }
                return this;
            }
            this._internalMeshDataInfo._effectiveMaterial = material;
        }
        else if ((material._storeEffectOnSubMeshes && !((_a = subMesh.effect) === null || _a === void 0 ? void 0 : _a._wasPreviouslyReady)) ||
            (!material._storeEffectOnSubMeshes && !((_b = material.getEffect()) === null || _b === void 0 ? void 0 : _b._wasPreviouslyReady))) {
            if (oldCamera) {
                oldCamera.maxZ = oldCameraMaxZ;
                scene.updateTransformMatrix(true);
            }
            return this;
        }
        // Alpha mode
        if (enableAlphaMode) {
            engine.setAlphaMode(this._internalMeshDataInfo._effectiveMaterial.alphaMode);
        }
        let drawWrapper;
        if (this._internalMeshDataInfo._effectiveMaterial._storeEffectOnSubMeshes) {
            drawWrapper = subMesh._drawWrapper;
        }
        else {
            drawWrapper = this._internalMeshDataInfo._effectiveMaterial._getDrawWrapper();
        }
        const effect = (_c = drawWrapper === null || drawWrapper === void 0 ? void 0 : drawWrapper.effect) !== null && _c !== void 0 ? _c : null;
        for (const step of scene._beforeRenderingMeshStage) {
            step.action(this, subMesh, batch, effect);
        }
        if (!drawWrapper || !effect) {
            if (oldCamera) {
                oldCamera.maxZ = oldCameraMaxZ;
                scene.updateTransformMatrix(true);
            }
            return this;
        }
        const effectiveMesh = effectiveMeshReplacement || this;
        let sideOrientation;
        if (!instanceDataStorage.isFrozen && (this._internalMeshDataInfo._effectiveMaterial.backFaceCulling || this.overrideMaterialSideOrientation !== null)) {
            const mainDeterminant = effectiveMesh._getWorldMatrixDeterminant();
            sideOrientation = this.overrideMaterialSideOrientation;
            if (sideOrientation == null) {
                sideOrientation = this._internalMeshDataInfo._effectiveMaterial.sideOrientation;
            }
            if (mainDeterminant < 0) {
                sideOrientation = sideOrientation === Material.ClockWiseSideOrientation ? Material.CounterClockWiseSideOrientation : Material.ClockWiseSideOrientation;
            }
            instanceDataStorage.sideOrientation = sideOrientation;
        }
        else {
            sideOrientation = instanceDataStorage.sideOrientation;
        }
        const reverse = this._internalMeshDataInfo._effectiveMaterial._preBind(drawWrapper, sideOrientation);
        if (this._internalMeshDataInfo._effectiveMaterial.forceDepthWrite) {
            engine.setDepthWrite(true);
        }
        // Bind
        const effectiveMaterial = this._internalMeshDataInfo._effectiveMaterial;
        const fillMode = effectiveMaterial.fillMode;
        if (this._internalMeshDataInfo._onBeforeBindObservable) {
            this._internalMeshDataInfo._onBeforeBindObservable.notifyObservers(this);
        }
        if (!hardwareInstancedRendering) {
            // Binding will be done later because we need to add more info to the VB
            this._bind(subMesh, effect, fillMode, false);
        }
        const world = effectiveMesh.getWorldMatrix();
        if (effectiveMaterial._storeEffectOnSubMeshes) {
            effectiveMaterial.bindForSubMesh(world, this, subMesh);
        }
        else {
            effectiveMaterial.bind(world, this);
        }
        if (!effectiveMaterial.backFaceCulling && effectiveMaterial.separateCullingPass) {
            engine.setState(true, effectiveMaterial.zOffset, false, !reverse, effectiveMaterial.cullBackFaces, effectiveMaterial.stencil, effectiveMaterial.zOffsetUnits);
            this._processRendering(this, subMesh, effect, fillMode, batch, hardwareInstancedRendering, this._onBeforeDraw, this._internalMeshDataInfo._effectiveMaterial);
            engine.setState(true, effectiveMaterial.zOffset, false, reverse, effectiveMaterial.cullBackFaces, effectiveMaterial.stencil, effectiveMaterial.zOffsetUnits);
            if (this._internalMeshDataInfo._onBetweenPassObservable) {
                this._internalMeshDataInfo._onBetweenPassObservable.notifyObservers(subMesh);
            }
        }
        // Draw
        this._processRendering(this, subMesh, effect, fillMode, batch, hardwareInstancedRendering, this._onBeforeDraw, this._internalMeshDataInfo._effectiveMaterial);
        // Unbind
        this._internalMeshDataInfo._effectiveMaterial.unbind();
        for (const step of scene._afterRenderingMeshStage) {
            step.action(this, subMesh, batch, effect);
        }
        if (this._internalMeshDataInfo._onAfterRenderObservable) {
            this._internalMeshDataInfo._onAfterRenderObservable.notifyObservers(this);
        }
        if (oldCamera) {
            oldCamera.maxZ = oldCameraMaxZ;
            scene.updateTransformMatrix(true);
        }
        if (scene.performancePriority === ScenePerformancePriority.Aggressive && !instanceDataStorage.isFrozen) {
            this._freeze();
        }
        return this;
    }
    /**
     *   Renormalize the mesh and patch it up if there are no weights
     *   Similar to normalization by adding the weights compute the reciprocal and multiply all elements, this wil ensure that everything adds to 1.
     *   However in the case of zero weights then we set just a single influence to 1.
     *   We check in the function for extra's present and if so we use the normalizeSkinWeightsWithExtras rather than the FourWeights version.
     */
    cleanMatrixWeights() {
        if (this.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind)) {
            if (this.isVerticesDataPresent(VertexBuffer.MatricesWeightsExtraKind)) {
                this._normalizeSkinWeightsAndExtra();
            }
            else {
                this._normalizeSkinFourWeights();
            }
        }
    }
    // faster 4 weight version.
    _normalizeSkinFourWeights() {
        const matricesWeights = this.getVerticesData(VertexBuffer.MatricesWeightsKind);
        const numWeights = matricesWeights.length;
        for (let a = 0; a < numWeights; a += 4) {
            // accumulate weights
            const t = matricesWeights[a] + matricesWeights[a + 1] + matricesWeights[a + 2] + matricesWeights[a + 3];
            // check for invalid weight and just set it to 1.
            if (t === 0) {
                matricesWeights[a] = 1;
            }
            else {
                // renormalize so everything adds to 1 use reciprocal
                const recip = 1 / t;
                matricesWeights[a] *= recip;
                matricesWeights[a + 1] *= recip;
                matricesWeights[a + 2] *= recip;
                matricesWeights[a + 3] *= recip;
            }
        }
        this.setVerticesData(VertexBuffer.MatricesWeightsKind, matricesWeights);
    }
    // handle special case of extra verts.  (in theory gltf can handle 12 influences)
    _normalizeSkinWeightsAndExtra() {
        const matricesWeightsExtra = this.getVerticesData(VertexBuffer.MatricesWeightsExtraKind);
        const matricesWeights = this.getVerticesData(VertexBuffer.MatricesWeightsKind);
        const numWeights = matricesWeights.length;
        for (let a = 0; a < numWeights; a += 4) {
            // accumulate weights
            let t = matricesWeights[a] + matricesWeights[a + 1] + matricesWeights[a + 2] + matricesWeights[a + 3];
            t += matricesWeightsExtra[a] + matricesWeightsExtra[a + 1] + matricesWeightsExtra[a + 2] + matricesWeightsExtra[a + 3];
            // check for invalid weight and just set it to 1.
            if (t === 0) {
                matricesWeights[a] = 1;
            }
            else {
                // renormalize so everything adds to 1 use reciprocal
                const recip = 1 / t;
                matricesWeights[a] *= recip;
                matricesWeights[a + 1] *= recip;
                matricesWeights[a + 2] *= recip;
                matricesWeights[a + 3] *= recip;
                // same goes for extras
                matricesWeightsExtra[a] *= recip;
                matricesWeightsExtra[a + 1] *= recip;
                matricesWeightsExtra[a + 2] *= recip;
                matricesWeightsExtra[a + 3] *= recip;
            }
        }
        this.setVerticesData(VertexBuffer.MatricesWeightsKind, matricesWeights);
        this.setVerticesData(VertexBuffer.MatricesWeightsKind, matricesWeightsExtra);
    }
    /**
     * ValidateSkinning is used to determine that a mesh has valid skinning data along with skin metrics, if missing weights,
     * or not normalized it is returned as invalid mesh the string can be used for console logs, or on screen messages to let
     * the user know there was an issue with importing the mesh
     * @returns a validation object with skinned, valid and report string
     */
    validateSkinning() {
        const matricesWeightsExtra = this.getVerticesData(VertexBuffer.MatricesWeightsExtraKind);
        const matricesWeights = this.getVerticesData(VertexBuffer.MatricesWeightsKind);
        if (matricesWeights === null || this.skeleton == null) {
            return { skinned: false, valid: true, report: "not skinned" };
        }
        const numWeights = matricesWeights.length;
        let numberNotSorted = 0;
        let missingWeights = 0;
        let maxUsedWeights = 0;
        let numberNotNormalized = 0;
        const numInfluences = matricesWeightsExtra === null ? 4 : 8;
        const usedWeightCounts = new Array();
        for (let a = 0; a <= numInfluences; a++) {
            usedWeightCounts[a] = 0;
        }
        const toleranceEpsilon = 0.001;
        for (let a = 0; a < numWeights; a += 4) {
            let lastWeight = matricesWeights[a];
            let t = lastWeight;
            let usedWeights = t === 0 ? 0 : 1;
            for (let b = 1; b < numInfluences; b++) {
                const d = b < 4 ? matricesWeights[a + b] : matricesWeightsExtra[a + b - 4];
                if (d > lastWeight) {
                    numberNotSorted++;
                }
                if (d !== 0) {
                    usedWeights++;
                }
                t += d;
                lastWeight = d;
            }
            // count the buffer weights usage
            usedWeightCounts[usedWeights]++;
            // max influences
            if (usedWeights > maxUsedWeights) {
                maxUsedWeights = usedWeights;
            }
            // check for invalid weight and just set it to 1.
            if (t === 0) {
                missingWeights++;
            }
            else {
                // renormalize so everything adds to 1 use reciprocal
                const recip = 1 / t;
                let tolerance = 0;
                for (let b = 0; b < numInfluences; b++) {
                    if (b < 4) {
                        tolerance += Math.abs(matricesWeights[a + b] - matricesWeights[a + b] * recip);
                    }
                    else {
                        tolerance += Math.abs(matricesWeightsExtra[a + b - 4] - matricesWeightsExtra[a + b - 4] * recip);
                    }
                }
                // arbitrary epsilon value for dictating not normalized
                if (tolerance > toleranceEpsilon) {
                    numberNotNormalized++;
                }
            }
        }
        // validate bone indices are in range of the skeleton
        const numBones = this.skeleton.bones.length;
        const matricesIndices = this.getVerticesData(VertexBuffer.MatricesIndicesKind);
        const matricesIndicesExtra = this.getVerticesData(VertexBuffer.MatricesIndicesExtraKind);
        let numBadBoneIndices = 0;
        for (let a = 0; a < numWeights; a += 4) {
            for (let b = 0; b < numInfluences; b++) {
                const index = b < 4 ? matricesIndices[a + b] : matricesIndicesExtra[a + b - 4];
                if (index >= numBones || index < 0) {
                    numBadBoneIndices++;
                }
            }
        }
        // log mesh stats
        const output = "Number of Weights = " +
            numWeights / 4 +
            "\nMaximum influences = " +
            maxUsedWeights +
            "\nMissing Weights = " +
            missingWeights +
            "\nNot Sorted = " +
            numberNotSorted +
            "\nNot Normalized = " +
            numberNotNormalized +
            "\nWeightCounts = [" +
            usedWeightCounts +
            "]" +
            "\nNumber of bones = " +
            numBones +
            "\nBad Bone Indices = " +
            numBadBoneIndices;
        return { skinned: true, valid: missingWeights === 0 && numberNotNormalized === 0 && numBadBoneIndices === 0, report: output };
    }
    /** @internal */
    _checkDelayState() {
        const scene = this.getScene();
        if (this._geometry) {
            this._geometry.load(scene);
        }
        else if (this.delayLoadState === 4) {
            this.delayLoadState = 2;
            this._queueLoad(scene);
        }
        return this;
    }
    _queueLoad(scene) {
        scene.addPendingData(this);
        const getBinaryData = this.delayLoadingFile.indexOf(".babylonbinarymeshdata") !== -1;
        Tools.LoadFile(this.delayLoadingFile, (data) => {
            if (data instanceof ArrayBuffer) {
                this._delayLoadingFunction(data, this);
            }
            else {
                this._delayLoadingFunction(JSON.parse(data), this);
            }
            this.instances.forEach((instance) => {
                instance.refreshBoundingInfo();
                instance._syncSubMeshes();
            });
            this.delayLoadState = 1;
            scene.removePendingData(this);
        }, () => { }, scene.offlineProvider, getBinaryData);
        return this;
    }
    /**
     * Returns `true` if the mesh is within the frustum defined by the passed array of planes.
     * A mesh is in the frustum if its bounding box intersects the frustum
     * @param frustumPlanes defines the frustum to test
     * @returns true if the mesh is in the frustum planes
     */
    isInFrustum(frustumPlanes) {
        if (this.delayLoadState === 2) {
            return false;
        }
        if (!super.isInFrustum(frustumPlanes)) {
            return false;
        }
        this._checkDelayState();
        return true;
    }
    /**
     * Sets the mesh material by the material or multiMaterial `id` property
     * @param id is a string identifying the material or the multiMaterial
     * @returns the current mesh
     */
    setMaterialById(id) {
        const materials = this.getScene().materials;
        let index;
        for (index = materials.length - 1; index > -1; index--) {
            if (materials[index].id === id) {
                this.material = materials[index];
                return this;
            }
        }
        // Multi
        const multiMaterials = this.getScene().multiMaterials;
        for (index = multiMaterials.length - 1; index > -1; index--) {
            if (multiMaterials[index].id === id) {
                this.material = multiMaterials[index];
                return this;
            }
        }
        return this;
    }
    /**
     * Returns as a new array populated with the mesh material and/or skeleton, if any.
     * @returns an array of IAnimatable
     */
    getAnimatables() {
        const results = new Array();
        if (this.material) {
            results.push(this.material);
        }
        if (this.skeleton) {
            results.push(this.skeleton);
        }
        return results;
    }
    /**
     * Modifies the mesh geometry according to the passed transformation matrix.
     * This method returns nothing, but it really modifies the mesh even if it's originally not set as updatable.
     * The mesh normals are modified using the same transformation.
     * Note that, under the hood, this method sets a new VertexBuffer each call.
     * @param transform defines the transform matrix to use
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/transforms/center_origin/bakingTransforms
     * @returns the current mesh
     */
    bakeTransformIntoVertices(transform) {
        // Position
        if (!this.isVerticesDataPresent(VertexBuffer.PositionKind)) {
            return this;
        }
        const submeshes = this.subMeshes.splice(0);
        this._resetPointsArrayCache();
        let data = this.getVerticesData(VertexBuffer.PositionKind);
        const temp = Vector3.Zero();
        let index;
        for (index = 0; index < data.length; index += 3) {
            Vector3.TransformCoordinatesFromFloatsToRef(data[index], data[index + 1], data[index + 2], transform, temp).toArray(data, index);
        }
        this.setVerticesData(VertexBuffer.PositionKind, data, this.getVertexBuffer(VertexBuffer.PositionKind).isUpdatable());
        // Normals
        if (this.isVerticesDataPresent(VertexBuffer.NormalKind)) {
            data = this.getVerticesData(VertexBuffer.NormalKind);
            for (index = 0; index < data.length; index += 3) {
                Vector3.TransformNormalFromFloatsToRef(data[index], data[index + 1], data[index + 2], transform, temp)
                    .normalize()
                    .toArray(data, index);
            }
            this.setVerticesData(VertexBuffer.NormalKind, data, this.getVertexBuffer(VertexBuffer.NormalKind).isUpdatable());
        }
        // flip faces?
        if (transform.determinant() < 0) {
            this.flipFaces();
        }
        // Restore submeshes
        this.releaseSubMeshes();
        this.subMeshes = submeshes;
        return this;
    }
    /**
     * Modifies the mesh geometry according to its own current World Matrix.
     * The mesh World Matrix is then reset.
     * This method returns nothing but really modifies the mesh even if it's originally not set as updatable.
     * Note that, under the hood, this method sets a new VertexBuffer each call.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/transforms/center_origin/bakingTransforms
     * @param bakeIndependentlyOfChildren indicates whether to preserve all child nodes' World Matrix during baking
     * @returns the current mesh
     */
    bakeCurrentTransformIntoVertices(bakeIndependentlyOfChildren = true) {
        this.bakeTransformIntoVertices(this.computeWorldMatrix(true));
        this.resetLocalMatrix(bakeIndependentlyOfChildren);
        return this;
    }
    // Cache
    /** @internal */
    get _positions() {
        if (this._internalAbstractMeshDataInfo._positions) {
            return this._internalAbstractMeshDataInfo._positions;
        }
        if (this._geometry) {
            return this._geometry._positions;
        }
        return null;
    }
    /** @internal */
    _resetPointsArrayCache() {
        if (this._geometry) {
            this._geometry._resetPointsArrayCache();
        }
        return this;
    }
    /** @internal */
    _generatePointsArray() {
        if (this._geometry) {
            return this._geometry._generatePointsArray();
        }
        return false;
    }
    /**
     * Returns a new Mesh object generated from the current mesh properties.
     * This method must not get confused with createInstance()
     * @param name is a string, the name given to the new mesh
     * @param newParent can be any Node object (default `null`)
     * @param doNotCloneChildren allows/denies the recursive cloning of the original mesh children if any (default `false`)
     * @param clonePhysicsImpostor allows/denies the cloning in the same time of the original mesh `body` used by the physics engine, if any (default `true`)
     * @returns a new mesh
     */
    clone(name = "", newParent = null, doNotCloneChildren, clonePhysicsImpostor = true) {
        return new Mesh(name, this.getScene(), newParent, this, doNotCloneChildren, clonePhysicsImpostor);
    }
    /**
     * Releases resources associated with this mesh.
     * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
     * @param disposeMaterialAndTextures Set to true to also dispose referenced materials and textures (false by default)
     */
    dispose(doNotRecurse, disposeMaterialAndTextures = false) {
        this.morphTargetManager = null;
        if (this._geometry) {
            this._geometry.releaseForMesh(this, true);
        }
        const internalDataInfo = this._internalMeshDataInfo;
        if (internalDataInfo._onBeforeDrawObservable) {
            internalDataInfo._onBeforeDrawObservable.clear();
        }
        if (internalDataInfo._onBeforeBindObservable) {
            internalDataInfo._onBeforeBindObservable.clear();
        }
        if (internalDataInfo._onBeforeRenderObservable) {
            internalDataInfo._onBeforeRenderObservable.clear();
        }
        if (internalDataInfo._onAfterRenderObservable) {
            internalDataInfo._onAfterRenderObservable.clear();
        }
        if (internalDataInfo._onBetweenPassObservable) {
            internalDataInfo._onBetweenPassObservable.clear();
        }
        // Sources
        if (this._scene.useClonedMeshMap) {
            if (internalDataInfo.meshMap) {
                for (const uniqueId in internalDataInfo.meshMap) {
                    const mesh = internalDataInfo.meshMap[uniqueId];
                    if (mesh) {
                        mesh._internalMeshDataInfo._source = null;
                        internalDataInfo.meshMap[uniqueId] = undefined;
                    }
                }
            }
            if (internalDataInfo._source && internalDataInfo._source._internalMeshDataInfo.meshMap) {
                internalDataInfo._source._internalMeshDataInfo.meshMap[this.uniqueId] = undefined;
            }
        }
        else {
            const meshes = this.getScene().meshes;
            for (const abstractMesh of meshes) {
                const mesh = abstractMesh;
                if (mesh._internalMeshDataInfo && mesh._internalMeshDataInfo._source && mesh._internalMeshDataInfo._source === this) {
                    mesh._internalMeshDataInfo._source = null;
                }
            }
        }
        internalDataInfo._source = null;
        this._instanceDataStorage.visibleInstances = {};
        // Instances
        this._disposeInstanceSpecificData();
        // Thin instances
        this._disposeThinInstanceSpecificData();
        if (this._internalMeshDataInfo._checkReadinessObserver) {
            this._scene.onBeforeRenderObservable.remove(this._internalMeshDataInfo._checkReadinessObserver);
        }
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
    /** @internal */
    _disposeInstanceSpecificData() {
        // Do nothing
    }
    /** @internal */
    _disposeThinInstanceSpecificData() {
        // Do nothing
    }
    /** @internal */
    _invalidateInstanceVertexArrayObject() {
        // Do nothing
    }
    /**
     * Modifies the mesh geometry according to a displacement map.
     * A displacement map is a colored image. Each pixel color value (actually a gradient computed from red, green, blue values) will give the displacement to apply to each mesh vertex.
     * The mesh must be set as updatable. Its internal geometry is directly modified, no new buffer are allocated.
     * @param url is a string, the URL from the image file is to be downloaded.
     * @param minHeight is the lower limit of the displacement.
     * @param maxHeight is the upper limit of the displacement.
     * @param onSuccess is an optional Javascript function to be called just after the mesh is modified. It is passed the modified mesh and must return nothing.
     * @param uvOffset is an optional vector2 used to offset UV.
     * @param uvScale is an optional vector2 used to scale UV.
     * @param forceUpdate defines whether or not to force an update of the generated buffers. This is useful to apply on a deserialized model for instance.
     * @returns the Mesh.
     */
    applyDisplacementMap(url, minHeight, maxHeight, onSuccess, uvOffset, uvScale, forceUpdate = false) {
        const scene = this.getScene();
        const onload = (img) => {
            // Getting height map data
            const heightMapWidth = img.width;
            const heightMapHeight = img.height;
            const canvas = this.getEngine().createCanvas(heightMapWidth, heightMapHeight);
            const context = canvas.getContext("2d");
            context.drawImage(img, 0, 0);
            // Create VertexData from map data
            //Cast is due to wrong definition in lib.d.ts from ts 1.3 - https://github.com/Microsoft/TypeScript/issues/949
            const buffer = context.getImageData(0, 0, heightMapWidth, heightMapHeight).data;
            this.applyDisplacementMapFromBuffer(buffer, heightMapWidth, heightMapHeight, minHeight, maxHeight, uvOffset, uvScale, forceUpdate);
            //execute success callback, if set
            if (onSuccess) {
                onSuccess(this);
            }
        };
        Tools.LoadImage(url, onload, () => { }, scene.offlineProvider);
        return this;
    }
    /**
     * Modifies the mesh geometry according to a displacementMap buffer.
     * A displacement map is a colored image. Each pixel color value (actually a gradient computed from red, green, blue values) will give the displacement to apply to each mesh vertex.
     * The mesh must be set as updatable. Its internal geometry is directly modified, no new buffer are allocated.
     * @param buffer is a `Uint8Array` buffer containing series of `Uint8` lower than 255, the red, green, blue and alpha values of each successive pixel.
     * @param heightMapWidth is the width of the buffer image.
     * @param heightMapHeight is the height of the buffer image.
     * @param minHeight is the lower limit of the displacement.
     * @param maxHeight is the upper limit of the displacement.
     * @param uvOffset is an optional vector2 used to offset UV.
     * @param uvScale is an optional vector2 used to scale UV.
     * @param forceUpdate defines whether or not to force an update of the generated buffers. This is useful to apply on a deserialized model for instance.
     * @returns the Mesh.
     */
    applyDisplacementMapFromBuffer(buffer, heightMapWidth, heightMapHeight, minHeight, maxHeight, uvOffset, uvScale, forceUpdate = false) {
        if (!this.isVerticesDataPresent(VertexBuffer.PositionKind) || !this.isVerticesDataPresent(VertexBuffer.NormalKind) || !this.isVerticesDataPresent(VertexBuffer.UVKind)) {
            Logger.Warn("Cannot call applyDisplacementMap: Given mesh is not complete. Position, Normal or UV are missing");
            return this;
        }
        const positions = this.getVerticesData(VertexBuffer.PositionKind, true, true);
        const normals = this.getVerticesData(VertexBuffer.NormalKind);
        const uvs = this.getVerticesData(VertexBuffer.UVKind);
        let position = Vector3.Zero();
        const normal = Vector3.Zero();
        const uv = Vector2.Zero();
        uvOffset = uvOffset || Vector2.Zero();
        uvScale = uvScale || new Vector2(1, 1);
        for (let index = 0; index < positions.length; index += 3) {
            Vector3.FromArrayToRef(positions, index, position);
            Vector3.FromArrayToRef(normals, index, normal);
            Vector2.FromArrayToRef(uvs, (index / 3) * 2, uv);
            // Compute height
            const u = (Math.abs(uv.x * uvScale.x + (uvOffset.x % 1)) * (heightMapWidth - 1)) % heightMapWidth | 0;
            const v = (Math.abs(uv.y * uvScale.y + (uvOffset.y % 1)) * (heightMapHeight - 1)) % heightMapHeight | 0;
            const pos = (u + v * heightMapWidth) * 4;
            const r = buffer[pos] / 255.0;
            const g = buffer[pos + 1] / 255.0;
            const b = buffer[pos + 2] / 255.0;
            const gradient = r * 0.3 + g * 0.59 + b * 0.11;
            normal.normalize();
            normal.scaleInPlace(minHeight + (maxHeight - minHeight) * gradient);
            position = position.add(normal);
            position.toArray(positions, index);
        }
        VertexData.ComputeNormals(positions, this.getIndices(), normals);
        if (forceUpdate) {
            this.setVerticesData(VertexBuffer.PositionKind, positions);
            this.setVerticesData(VertexBuffer.NormalKind, normals);
            this.setVerticesData(VertexBuffer.UVKind, uvs);
        }
        else {
            this.updateVerticesData(VertexBuffer.PositionKind, positions);
            this.updateVerticesData(VertexBuffer.NormalKind, normals);
        }
        return this;
    }
    _getFlattenedNormals(indices, positions) {
        const normals = new Float32Array(indices.length * 3);
        let normalsCount = 0;
        // Decide if normals should be flipped
        const flipNormalGeneration = this.overrideMaterialSideOrientation ===
            (this._scene.useRightHandedSystem ? 1 : 0);
        // Generate new normals
        for (let index = 0; index < indices.length; index += 3) {
            const p1 = Vector3.FromArray(positions, indices[index] * 3);
            const p2 = Vector3.FromArray(positions, indices[index + 1] * 3);
            const p3 = Vector3.FromArray(positions, indices[index + 2] * 3);
            const p1p2 = p1.subtract(p2);
            const p3p2 = p3.subtract(p2);
            const normal = Vector3.Normalize(Vector3.Cross(p1p2, p3p2));
            if (flipNormalGeneration) {
                normal.scaleInPlace(-1);
            }
            // Store same normals for every vertex
            for (let localIndex = 0; localIndex < 3; localIndex++) {
                normals[normalsCount++] = normal.x;
                normals[normalsCount++] = normal.y;
                normals[normalsCount++] = normal.z;
            }
        }
        return normals;
    }
    _convertToUnIndexedMesh(flattenNormals = false) {
        const kinds = this.getVerticesDataKinds();
        const indices = this.getIndices();
        const data = {};
        const separateVertices = (data, stride) => {
            const newData = new Float32Array(indices.length * stride);
            let count = 0;
            for (let index = 0; index < indices.length; index++) {
                for (let offset = 0; offset < stride; offset++) {
                    newData[count++] = data[indices[index] * stride + offset];
                }
            }
            return newData;
        };
        // Save previous submeshes
        const previousSubmeshes = this.geometry ? this.subMeshes.slice(0) : [];
        // Cache vertex data
        for (const kind of kinds) {
            data[kind] = this.getVerticesData(kind);
        }
        // Update vertex data
        for (const kind of kinds) {
            const vertexBuffer = this.getVertexBuffer(kind);
            const stride = vertexBuffer.getStrideSize();
            if (flattenNormals && kind === VertexBuffer.NormalKind) {
                const normals = this._getFlattenedNormals(indices, data[VertexBuffer.PositionKind]);
                this.setVerticesData(VertexBuffer.NormalKind, normals, vertexBuffer.isUpdatable(), stride);
            }
            else {
                this.setVerticesData(kind, separateVertices(data[kind], stride), vertexBuffer.isUpdatable(), stride);
            }
        }
        // Update morph targets
        if (this.morphTargetManager) {
            for (let targetIndex = 0; targetIndex < this.morphTargetManager.numTargets; targetIndex++) {
                const target = this.morphTargetManager.getTarget(targetIndex);
                const positions = target.getPositions();
                target.setPositions(separateVertices(positions, 3));
                const normals = target.getNormals();
                if (normals) {
                    target.setNormals(flattenNormals ? this._getFlattenedNormals(indices, positions) : separateVertices(normals, 3));
                }
                const tangents = target.getTangents();
                if (tangents) {
                    target.setTangents(separateVertices(tangents, 3));
                }
                const uvs = target.getUVs();
                if (uvs) {
                    target.setUVs(separateVertices(uvs, 2));
                }
            }
            this.morphTargetManager.synchronize();
        }
        // Update indices
        for (let index = 0; index < indices.length; index++) {
            indices[index] = index;
        }
        this.setIndices(indices);
        this._unIndexed = true;
        // Update submeshes
        this.releaseSubMeshes();
        for (const previousOne of previousSubmeshes) {
            SubMesh.AddToMesh(previousOne.materialIndex, previousOne.indexStart, previousOne.indexCount, previousOne.indexStart, previousOne.indexCount, this);
        }
        this.synchronizeInstances();
        return this;
    }
    /**
     * Modify the mesh to get a flat shading rendering.
     * This means each mesh facet will then have its own normals. Usually new vertices are added in the mesh geometry to get this result.
     * Warning : the mesh is really modified even if not set originally as updatable and, under the hood, a new VertexBuffer is allocated.
     * @returns current mesh
     */
    convertToFlatShadedMesh() {
        return this._convertToUnIndexedMesh(true);
    }
    /**
     * This method removes all the mesh indices and add new vertices (duplication) in order to unfold facets into buffers.
     * In other words, more vertices, no more indices and a single bigger VBO.
     * The mesh is really modified even if not set originally as updatable. Under the hood, a new VertexBuffer is allocated.
     * @returns current mesh
     */
    convertToUnIndexedMesh() {
        return this._convertToUnIndexedMesh();
    }
    /**
     * Inverses facet orientations.
     * Warning : the mesh is really modified even if not set originally as updatable. A new VertexBuffer is created under the hood each call.
     * @param flipNormals will also inverts the normals
     * @returns current mesh
     */
    flipFaces(flipNormals = false) {
        const vertex_data = VertexData.ExtractFromMesh(this);
        let i;
        if (flipNormals && this.isVerticesDataPresent(VertexBuffer.NormalKind) && vertex_data.normals) {
            for (i = 0; i < vertex_data.normals.length; i++) {
                vertex_data.normals[i] *= -1;
            }
        }
        if (vertex_data.indices) {
            let temp;
            for (i = 0; i < vertex_data.indices.length; i += 3) {
                // reassign indices
                temp = vertex_data.indices[i + 1];
                vertex_data.indices[i + 1] = vertex_data.indices[i + 2];
                vertex_data.indices[i + 2] = temp;
            }
        }
        vertex_data.applyToMesh(this, this.isVertexBufferUpdatable(VertexBuffer.PositionKind));
        return this;
    }
    /**
     * Increase the number of facets and hence vertices in a mesh
     * Vertex normals are interpolated from existing vertex normals
     * Warning : the mesh is really modified even if not set originally as updatable. A new VertexBuffer is created under the hood each call.
     * @param numberPerEdge the number of new vertices to add to each edge of a facet, optional default 1
     */
    increaseVertices(numberPerEdge = 1) {
        const vertex_data = VertexData.ExtractFromMesh(this);
        const currentIndices = vertex_data.indices && !Array.isArray(vertex_data.indices) && Array.from ? Array.from(vertex_data.indices) : vertex_data.indices;
        const positions = vertex_data.positions && !Array.isArray(vertex_data.positions) && Array.from ? Array.from(vertex_data.positions) : vertex_data.positions;
        const uvs = vertex_data.uvs && !Array.isArray(vertex_data.uvs) && Array.from ? Array.from(vertex_data.uvs) : vertex_data.uvs;
        const normals = vertex_data.normals && !Array.isArray(vertex_data.normals) && Array.from ? Array.from(vertex_data.normals) : vertex_data.normals;
        if (!currentIndices || !positions) {
            Logger.Warn("Couldn't increase number of vertices : VertexData must contain at least indices and positions");
        }
        else {
            vertex_data.indices = currentIndices;
            vertex_data.positions = positions;
            if (uvs) {
                vertex_data.uvs = uvs;
            }
            if (normals) {
                vertex_data.normals = normals;
            }
            const segments = numberPerEdge + 1; //segments per current facet edge, become sides of new facets
            const tempIndices = new Array();
            for (let i = 0; i < segments + 1; i++) {
                tempIndices[i] = new Array();
            }
            let a; //vertex index of one end of a side
            let b; //vertex index of other end of the side
            const deltaPosition = new Vector3(0, 0, 0);
            const deltaNormal = new Vector3(0, 0, 0);
            const deltaUV = new Vector2(0, 0);
            const indices = new Array();
            const vertexIndex = new Array();
            const side = new Array();
            let len;
            let positionPtr = positions.length;
            let uvPtr;
            if (uvs) {
                uvPtr = uvs.length;
            }
            let normalsPtr;
            if (normals) {
                normalsPtr = normals.length;
            }
            for (let i = 0; i < currentIndices.length; i += 3) {
                vertexIndex[0] = currentIndices[i];
                vertexIndex[1] = currentIndices[i + 1];
                vertexIndex[2] = currentIndices[i + 2];
                for (let j = 0; j < 3; j++) {
                    a = vertexIndex[j];
                    b = vertexIndex[(j + 1) % 3];
                    if (side[a] === undefined && side[b] === undefined) {
                        side[a] = new Array();
                        side[b] = new Array();
                    }
                    else {
                        if (side[a] === undefined) {
                            side[a] = new Array();
                        }
                        if (side[b] === undefined) {
                            side[b] = new Array();
                        }
                    }
                    if (side[a][b] === undefined && side[b][a] === undefined) {
                        side[a][b] = [];
                        deltaPosition.x = (positions[3 * b] - positions[3 * a]) / segments;
                        deltaPosition.y = (positions[3 * b + 1] - positions[3 * a + 1]) / segments;
                        deltaPosition.z = (positions[3 * b + 2] - positions[3 * a + 2]) / segments;
                        if (normals) {
                            deltaNormal.x = (normals[3 * b] - normals[3 * a]) / segments;
                            deltaNormal.y = (normals[3 * b + 1] - normals[3 * a + 1]) / segments;
                            deltaNormal.z = (normals[3 * b + 2] - normals[3 * a + 2]) / segments;
                        }
                        if (uvs) {
                            deltaUV.x = (uvs[2 * b] - uvs[2 * a]) / segments;
                            deltaUV.y = (uvs[2 * b + 1] - uvs[2 * a + 1]) / segments;
                        }
                        side[a][b].push(a);
                        for (let k = 1; k < segments; k++) {
                            side[a][b].push(positions.length / 3);
                            positions[positionPtr++] = positions[3 * a] + k * deltaPosition.x;
                            positions[positionPtr++] = positions[3 * a + 1] + k * deltaPosition.y;
                            positions[positionPtr++] = positions[3 * a + 2] + k * deltaPosition.z;
                            if (normals) {
                                normals[normalsPtr++] = normals[3 * a] + k * deltaNormal.x;
                                normals[normalsPtr++] = normals[3 * a + 1] + k * deltaNormal.y;
                                normals[normalsPtr++] = normals[3 * a + 2] + k * deltaNormal.z;
                            }
                            if (uvs) {
                                uvs[uvPtr++] = uvs[2 * a] + k * deltaUV.x;
                                uvs[uvPtr++] = uvs[2 * a + 1] + k * deltaUV.y;
                            }
                        }
                        side[a][b].push(b);
                        side[b][a] = new Array();
                        len = side[a][b].length;
                        for (let idx = 0; idx < len; idx++) {
                            side[b][a][idx] = side[a][b][len - 1 - idx];
                        }
                    }
                }
                //Calculate positions, normals and uvs of new internal vertices
                tempIndices[0][0] = currentIndices[i];
                tempIndices[1][0] = side[currentIndices[i]][currentIndices[i + 1]][1];
                tempIndices[1][1] = side[currentIndices[i]][currentIndices[i + 2]][1];
                for (let k = 2; k < segments; k++) {
                    tempIndices[k][0] = side[currentIndices[i]][currentIndices[i + 1]][k];
                    tempIndices[k][k] = side[currentIndices[i]][currentIndices[i + 2]][k];
                    deltaPosition.x = (positions[3 * tempIndices[k][k]] - positions[3 * tempIndices[k][0]]) / k;
                    deltaPosition.y = (positions[3 * tempIndices[k][k] + 1] - positions[3 * tempIndices[k][0] + 1]) / k;
                    deltaPosition.z = (positions[3 * tempIndices[k][k] + 2] - positions[3 * tempIndices[k][0] + 2]) / k;
                    if (normals) {
                        deltaNormal.x = (normals[3 * tempIndices[k][k]] - normals[3 * tempIndices[k][0]]) / k;
                        deltaNormal.y = (normals[3 * tempIndices[k][k] + 1] - normals[3 * tempIndices[k][0] + 1]) / k;
                        deltaNormal.z = (normals[3 * tempIndices[k][k] + 2] - normals[3 * tempIndices[k][0] + 2]) / k;
                    }
                    if (uvs) {
                        deltaUV.x = (uvs[2 * tempIndices[k][k]] - uvs[2 * tempIndices[k][0]]) / k;
                        deltaUV.y = (uvs[2 * tempIndices[k][k] + 1] - uvs[2 * tempIndices[k][0] + 1]) / k;
                    }
                    for (let j = 1; j < k; j++) {
                        tempIndices[k][j] = positions.length / 3;
                        positions[positionPtr++] = positions[3 * tempIndices[k][0]] + j * deltaPosition.x;
                        positions[positionPtr++] = positions[3 * tempIndices[k][0] + 1] + j * deltaPosition.y;
                        positions[positionPtr++] = positions[3 * tempIndices[k][0] + 2] + j * deltaPosition.z;
                        if (normals) {
                            normals[normalsPtr++] = normals[3 * tempIndices[k][0]] + j * deltaNormal.x;
                            normals[normalsPtr++] = normals[3 * tempIndices[k][0] + 1] + j * deltaNormal.y;
                            normals[normalsPtr++] = normals[3 * tempIndices[k][0] + 2] + j * deltaNormal.z;
                        }
                        if (uvs) {
                            uvs[uvPtr++] = uvs[2 * tempIndices[k][0]] + j * deltaUV.x;
                            uvs[uvPtr++] = uvs[2 * tempIndices[k][0] + 1] + j * deltaUV.y;
                        }
                    }
                }
                tempIndices[segments] = side[currentIndices[i + 1]][currentIndices[i + 2]];
                // reform indices
                indices.push(tempIndices[0][0], tempIndices[1][0], tempIndices[1][1]);
                for (let k = 1; k < segments; k++) {
                    let j;
                    for (j = 0; j < k; j++) {
                        indices.push(tempIndices[k][j], tempIndices[k + 1][j], tempIndices[k + 1][j + 1]);
                        indices.push(tempIndices[k][j], tempIndices[k + 1][j + 1], tempIndices[k][j + 1]);
                    }
                    indices.push(tempIndices[k][j], tempIndices[k + 1][j], tempIndices[k + 1][j + 1]);
                }
            }
            vertex_data.indices = indices;
            vertex_data.applyToMesh(this, this.isVertexBufferUpdatable(VertexBuffer.PositionKind));
        }
    }
    /**
     * Force adjacent facets to share vertices and remove any facets that have all vertices in a line
     * This will undo any application of covertToFlatShadedMesh
     * Warning : the mesh is really modified even if not set originally as updatable. A new VertexBuffer is created under the hood each call.
     */
    forceSharedVertices() {
        const vertex_data = VertexData.ExtractFromMesh(this);
        const currentUVs = vertex_data.uvs;
        const currentIndices = vertex_data.indices;
        const currentPositions = vertex_data.positions;
        const currentColors = vertex_data.colors;
        const currentMatrixIndices = vertex_data.matricesIndices;
        const currentMatrixWeights = vertex_data.matricesWeights;
        const currentMatrixIndicesExtra = vertex_data.matricesIndicesExtra;
        const currentMatrixWeightsExtra = vertex_data.matricesWeightsExtra;
        if (currentIndices === void 0 || currentPositions === void 0 || currentIndices === null || currentPositions === null) {
            Logger.Warn("VertexData contains empty entries");
        }
        else {
            const positions = new Array();
            const indices = new Array();
            const uvs = new Array();
            const colors = new Array();
            const matrixIndices = new Array();
            const matrixWeights = new Array();
            const matrixIndicesExtra = new Array();
            const matrixWeightsExtra = new Array();
            let pstring = new Array(); //lists facet vertex positions (a,b,c) as string "a|b|c"
            let indexPtr = 0; // pointer to next available index value
            const uniquePositions = {}; // unique vertex positions
            let ptr; // pointer to element in uniquePositions
            let facet;
            for (let i = 0; i < currentIndices.length; i += 3) {
                facet = [currentIndices[i], currentIndices[i + 1], currentIndices[i + 2]]; //facet vertex indices
                pstring = new Array();
                for (let j = 0; j < 3; j++) {
                    pstring[j] = "";
                    for (let k = 0; k < 3; k++) {
                        //small values make 0
                        if (Math.abs(currentPositions[3 * facet[j] + k]) < 0.00000001) {
                            currentPositions[3 * facet[j] + k] = 0;
                        }
                        pstring[j] += currentPositions[3 * facet[j] + k] + "|";
                    }
                }
                //check facet vertices to see that none are repeated
                // do not process any facet that has a repeated vertex, ie is a line
                if (!(pstring[0] == pstring[1] || pstring[0] == pstring[2] || pstring[1] == pstring[2])) {
                    //for each facet position check if already listed in uniquePositions
                    // if not listed add to uniquePositions and set index pointer
                    // if listed use its index in uniquePositions and new index pointer
                    for (let j = 0; j < 3; j++) {
                        ptr = uniquePositions[pstring[j]];
                        if (ptr === undefined) {
                            uniquePositions[pstring[j]] = indexPtr;
                            ptr = indexPtr++;
                            //not listed so add individual x, y, z coordinates to positions
                            for (let k = 0; k < 3; k++) {
                                positions.push(currentPositions[3 * facet[j] + k]);
                            }
                            if (currentColors !== null && currentColors !== void 0) {
                                for (let k = 0; k < 4; k++) {
                                    colors.push(currentColors[4 * facet[j] + k]);
                                }
                            }
                            if (currentUVs !== null && currentUVs !== void 0) {
                                for (let k = 0; k < 2; k++) {
                                    uvs.push(currentUVs[2 * facet[j] + k]);
                                }
                            }
                            if (currentMatrixIndices !== null && currentMatrixIndices !== void 0) {
                                for (let k = 0; k < 4; k++) {
                                    matrixIndices.push(currentMatrixIndices[4 * facet[j] + k]);
                                }
                            }
                            if (currentMatrixWeights !== null && currentMatrixWeights !== void 0) {
                                for (let k = 0; k < 4; k++) {
                                    matrixWeights.push(currentMatrixWeights[4 * facet[j] + k]);
                                }
                            }
                            if (currentMatrixIndicesExtra !== null && currentMatrixIndicesExtra !== void 0) {
                                for (let k = 0; k < 4; k++) {
                                    matrixIndicesExtra.push(currentMatrixIndicesExtra[4 * facet[j] + k]);
                                }
                            }
                            if (currentMatrixWeightsExtra !== null && currentMatrixWeightsExtra !== void 0) {
                                for (let k = 0; k < 4; k++) {
                                    matrixWeightsExtra.push(currentMatrixWeightsExtra[4 * facet[j] + k]);
                                }
                            }
                        }
                        // add new index pointer to indices array
                        indices.push(ptr);
                    }
                }
            }
            const normals = new Array();
            VertexData.ComputeNormals(positions, indices, normals);
            //create new vertex data object and update
            vertex_data.positions = positions;
            vertex_data.indices = indices;
            vertex_data.normals = normals;
            if (currentUVs !== null && currentUVs !== void 0) {
                vertex_data.uvs = uvs;
            }
            if (currentColors !== null && currentColors !== void 0) {
                vertex_data.colors = colors;
            }
            if (currentMatrixIndices !== null && currentMatrixIndices !== void 0) {
                vertex_data.matricesIndices = matrixIndices;
            }
            if (currentMatrixWeights !== null && currentMatrixWeights !== void 0) {
                vertex_data.matricesWeights = matrixWeights;
            }
            if (currentMatrixIndicesExtra !== null && currentMatrixIndicesExtra !== void 0) {
                vertex_data.matricesIndicesExtra = matrixIndicesExtra;
            }
            if (currentMatrixWeights !== null && currentMatrixWeights !== void 0) {
                vertex_data.matricesWeightsExtra = matrixWeightsExtra;
            }
            vertex_data.applyToMesh(this, this.isVertexBufferUpdatable(VertexBuffer.PositionKind));
        }
    }
    // Instances
    /**
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
    static _instancedMeshFactory(name, mesh) {
        throw _WarnImport("InstancedMesh");
    }
    /**
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static _PhysicsImpostorParser(scene, physicObject, jsonObject) {
        throw _WarnImport("PhysicsImpostor");
    }
    /**
     * Creates a new InstancedMesh object from the mesh model.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
     * @param name defines the name of the new instance
     * @returns a new InstancedMesh
     */
    createInstance(name) {
        return Mesh._instancedMeshFactory(name, this);
    }
    /**
     * Synchronises all the mesh instance submeshes to the current mesh submeshes, if any.
     * After this call, all the mesh instances have the same submeshes than the current mesh.
     * @returns the current mesh
     */
    synchronizeInstances() {
        for (let instanceIndex = 0; instanceIndex < this.instances.length; instanceIndex++) {
            const instance = this.instances[instanceIndex];
            instance._syncSubMeshes();
        }
        return this;
    }
    /**
     * Optimization of the mesh's indices, in case a mesh has duplicated vertices.
     * The function will only reorder the indices and will not remove unused vertices to avoid problems with submeshes.
     * This should be used together with the simplification to avoid disappearing triangles.
     * @param successCallback an optional success callback to be called after the optimization finished.
     * @returns the current mesh
     */
    optimizeIndices(successCallback) {
        const indices = this.getIndices();
        const positions = this.getVerticesData(VertexBuffer.PositionKind);
        if (!positions || !indices) {
            return this;
        }
        const vectorPositions = new Array();
        for (let pos = 0; pos < positions.length; pos = pos + 3) {
            vectorPositions.push(Vector3.FromArray(positions, pos));
        }
        const dupes = new Array();
        AsyncLoop.SyncAsyncForLoop(vectorPositions.length, 40, (iteration) => {
            const realPos = vectorPositions.length - 1 - iteration;
            const testedPosition = vectorPositions[realPos];
            for (let j = 0; j < realPos; ++j) {
                const againstPosition = vectorPositions[j];
                if (testedPosition.equals(againstPosition)) {
                    dupes[realPos] = j;
                    break;
                }
            }
        }, () => {
            for (let i = 0; i < indices.length; ++i) {
                indices[i] = dupes[indices[i]] || indices[i];
            }
            //indices are now reordered
            const originalSubMeshes = this.subMeshes.slice(0);
            this.setIndices(indices);
            this.subMeshes = originalSubMeshes;
            if (successCallback) {
                successCallback(this);
            }
        });
        return this;
    }
    /**
     * Serialize current mesh
     * @param serializationObject defines the object which will receive the serialization data
     */
    serialize(serializationObject = {}) {
        serializationObject.name = this.name;
        serializationObject.id = this.id;
        serializationObject.uniqueId = this.uniqueId;
        serializationObject.type = this.getClassName();
        if (Tags && Tags.HasTags(this)) {
            serializationObject.tags = Tags.GetTags(this);
        }
        serializationObject.position = this.position.asArray();
        if (this.rotationQuaternion) {
            serializationObject.rotationQuaternion = this.rotationQuaternion.asArray();
        }
        else if (this.rotation) {
            serializationObject.rotation = this.rotation.asArray();
        }
        serializationObject.scaling = this.scaling.asArray();
        if (this._postMultiplyPivotMatrix) {
            serializationObject.pivotMatrix = this.getPivotMatrix().asArray();
        }
        else {
            serializationObject.localMatrix = this.getPivotMatrix().asArray();
        }
        serializationObject.isEnabled = this.isEnabled(false);
        serializationObject.isVisible = this.isVisible;
        serializationObject.infiniteDistance = this.infiniteDistance;
        serializationObject.pickable = this.isPickable;
        serializationObject.receiveShadows = this.receiveShadows;
        serializationObject.billboardMode = this.billboardMode;
        serializationObject.visibility = this.visibility;
        serializationObject.checkCollisions = this.checkCollisions;
        serializationObject.isBlocker = this.isBlocker;
        serializationObject.overrideMaterialSideOrientation = this.overrideMaterialSideOrientation;
        // Parent
        if (this.parent) {
            this.parent._serializeAsParent(serializationObject);
        }
        // Geometry
        serializationObject.isUnIndexed = this.isUnIndexed;
        const geometry = this._geometry;
        if (geometry && this.subMeshes) {
            serializationObject.geometryUniqueId = geometry.uniqueId;
            serializationObject.geometryId = geometry.id;
            // SubMeshes
            serializationObject.subMeshes = [];
            for (let subIndex = 0; subIndex < this.subMeshes.length; subIndex++) {
                const subMesh = this.subMeshes[subIndex];
                serializationObject.subMeshes.push({
                    materialIndex: subMesh.materialIndex,
                    verticesStart: subMesh.verticesStart,
                    verticesCount: subMesh.verticesCount,
                    indexStart: subMesh.indexStart,
                    indexCount: subMesh.indexCount,
                });
            }
        }
        // Material
        if (this.material) {
            if (!this.material.doNotSerialize) {
                serializationObject.materialUniqueId = this.material.uniqueId;
                serializationObject.materialId = this.material.id; // back compat
            }
        }
        else {
            this.material = null;
            serializationObject.materialUniqueId = this._scene.defaultMaterial.uniqueId;
            serializationObject.materialId = this._scene.defaultMaterial.id; // back compat
        }
        // Morph targets
        if (this.morphTargetManager) {
            serializationObject.morphTargetManagerId = this.morphTargetManager.uniqueId;
        }
        // Skeleton
        if (this.skeleton) {
            serializationObject.skeletonId = this.skeleton.id;
            serializationObject.numBoneInfluencers = this.numBoneInfluencers;
        }
        // Physics
        //TODO implement correct serialization for physics impostors.
        if (this.getScene()._getComponent(SceneComponentConstants.NAME_PHYSICSENGINE)) {
            const impostor = this.getPhysicsImpostor();
            if (impostor) {
                serializationObject.physicsMass = impostor.getParam("mass");
                serializationObject.physicsFriction = impostor.getParam("friction");
                serializationObject.physicsRestitution = impostor.getParam("mass");
                serializationObject.physicsImpostor = impostor.type;
            }
        }
        // Metadata
        if (this.metadata) {
            serializationObject.metadata = this.metadata;
        }
        // Instances
        serializationObject.instances = [];
        for (let index = 0; index < this.instances.length; index++) {
            const instance = this.instances[index];
            if (instance.doNotSerialize) {
                continue;
            }
            const serializationInstance = {
                name: instance.name,
                id: instance.id,
                isEnabled: instance.isEnabled(false),
                isVisible: instance.isVisible,
                isPickable: instance.isPickable,
                checkCollisions: instance.checkCollisions,
                position: instance.position.asArray(),
                scaling: instance.scaling.asArray(),
            };
            if (instance.parent) {
                instance.parent._serializeAsParent(serializationInstance);
            }
            if (instance.rotationQuaternion) {
                serializationInstance.rotationQuaternion = instance.rotationQuaternion.asArray();
            }
            else if (instance.rotation) {
                serializationInstance.rotation = instance.rotation.asArray();
            }
            // Physics
            //TODO implement correct serialization for physics impostors.
            if (this.getScene()._getComponent(SceneComponentConstants.NAME_PHYSICSENGINE)) {
                const impostor = instance.getPhysicsImpostor();
                if (impostor) {
                    serializationInstance.physicsMass = impostor.getParam("mass");
                    serializationInstance.physicsFriction = impostor.getParam("friction");
                    serializationInstance.physicsRestitution = impostor.getParam("mass");
                    serializationInstance.physicsImpostor = impostor.type;
                }
            }
            // Metadata
            if (instance.metadata) {
                serializationInstance.metadata = instance.metadata;
            }
            // Action Manager
            if (instance.actionManager) {
                serializationInstance.actions = instance.actionManager.serialize(instance.name);
            }
            serializationObject.instances.push(serializationInstance);
            // Animations
            SerializationHelper.AppendSerializedAnimations(instance, serializationInstance);
            serializationInstance.ranges = instance.serializeAnimationRanges();
        }
        // Thin instances
        if (this._thinInstanceDataStorage.instancesCount && this._thinInstanceDataStorage.matrixData) {
            serializationObject.thinInstances = {
                instancesCount: this._thinInstanceDataStorage.instancesCount,
                matrixData: Array.from(this._thinInstanceDataStorage.matrixData),
                matrixBufferSize: this._thinInstanceDataStorage.matrixBufferSize,
                enablePicking: this.thinInstanceEnablePicking,
            };
            if (this._userThinInstanceBuffersStorage) {
                const userThinInstance = {
                    data: {},
                    sizes: {},
                    strides: {},
                };
                for (const kind in this._userThinInstanceBuffersStorage.data) {
                    userThinInstance.data[kind] = Array.from(this._userThinInstanceBuffersStorage.data[kind]);
                    userThinInstance.sizes[kind] = this._userThinInstanceBuffersStorage.sizes[kind];
                    userThinInstance.strides[kind] = this._userThinInstanceBuffersStorage.strides[kind];
                }
                serializationObject.thinInstances.userThinInstance = userThinInstance;
            }
        }
        // Animations
        SerializationHelper.AppendSerializedAnimations(this, serializationObject);
        serializationObject.ranges = this.serializeAnimationRanges();
        // Layer mask
        serializationObject.layerMask = this.layerMask;
        // Alpha
        serializationObject.alphaIndex = this.alphaIndex;
        serializationObject.hasVertexAlpha = this.hasVertexAlpha;
        // Overlay
        serializationObject.overlayAlpha = this.overlayAlpha;
        serializationObject.overlayColor = this.overlayColor.asArray();
        serializationObject.renderOverlay = this.renderOverlay;
        // Fog
        serializationObject.applyFog = this.applyFog;
        // Action Manager
        if (this.actionManager) {
            serializationObject.actions = this.actionManager.serialize(this.name);
        }
        return serializationObject;
    }
    /** @internal */
    _syncGeometryWithMorphTargetManager() {
        if (!this.geometry) {
            return;
        }
        this._markSubMeshesAsAttributesDirty();
        const morphTargetManager = this._internalAbstractMeshDataInfo._morphTargetManager;
        if (morphTargetManager && morphTargetManager.vertexCount) {
            if (morphTargetManager.vertexCount !== this.getTotalVertices()) {
                Logger.Error("Mesh is incompatible with morph targets. Targets and mesh must all have the same vertices count.");
                this.morphTargetManager = null;
                return;
            }
            if (morphTargetManager.isUsingTextureForTargets) {
                return;
            }
            for (let index = 0; index < morphTargetManager.numInfluencers; index++) {
                const morphTarget = morphTargetManager.getActiveTarget(index);
                const positions = morphTarget.getPositions();
                if (!positions) {
                    Logger.Error("Invalid morph target. Target must have positions.");
                    return;
                }
                this.geometry.setVerticesData(VertexBuffer.PositionKind + index, positions, false, 3);
                const normals = morphTarget.getNormals();
                if (normals) {
                    this.geometry.setVerticesData(VertexBuffer.NormalKind + index, normals, false, 3);
                }
                const tangents = morphTarget.getTangents();
                if (tangents) {
                    this.geometry.setVerticesData(VertexBuffer.TangentKind + index, tangents, false, 3);
                }
                const uvs = morphTarget.getUVs();
                if (uvs) {
                    this.geometry.setVerticesData(VertexBuffer.UVKind + "_" + index, uvs, false, 2);
                }
            }
        }
        else {
            let index = 0;
            // Positions
            while (this.geometry.isVerticesDataPresent(VertexBuffer.PositionKind + index)) {
                this.geometry.removeVerticesData(VertexBuffer.PositionKind + index);
                if (this.geometry.isVerticesDataPresent(VertexBuffer.NormalKind + index)) {
                    this.geometry.removeVerticesData(VertexBuffer.NormalKind + index);
                }
                if (this.geometry.isVerticesDataPresent(VertexBuffer.TangentKind + index)) {
                    this.geometry.removeVerticesData(VertexBuffer.TangentKind + index);
                }
                if (this.geometry.isVerticesDataPresent(VertexBuffer.UVKind + index)) {
                    this.geometry.removeVerticesData(VertexBuffer.UVKind + "_" + index);
                }
                index++;
            }
        }
    }
    /**
     * Returns a new Mesh object parsed from the source provided.
     * @param parsedMesh is the source
     * @param scene defines the hosting scene
     * @param rootUrl is the root URL to prefix the `delayLoadingFile` property with
     * @returns a new Mesh
     */
    static Parse(parsedMesh, scene, rootUrl) {
        let mesh;
        if (parsedMesh.type && parsedMesh.type === "LinesMesh") {
            mesh = Mesh._LinesMeshParser(parsedMesh, scene);
        }
        else if (parsedMesh.type && parsedMesh.type === "GroundMesh") {
            mesh = Mesh._GroundMeshParser(parsedMesh, scene);
        }
        else if (parsedMesh.type && parsedMesh.type === "GoldbergMesh") {
            mesh = Mesh._GoldbergMeshParser(parsedMesh, scene);
        }
        else if (parsedMesh.type && parsedMesh.type === "GreasedLineMesh") {
            mesh = Mesh._GreasedLineMeshParser(parsedMesh, scene);
        }
        else if (parsedMesh.type && parsedMesh.type === "TrailMesh") {
            mesh = Mesh._TrailMeshParser(parsedMesh, scene);
        }
        else {
            mesh = new Mesh(parsedMesh.name, scene);
        }
        mesh.id = parsedMesh.id;
        mesh._waitingParsedUniqueId = parsedMesh.uniqueId;
        if (Tags) {
            Tags.AddTagsTo(mesh, parsedMesh.tags);
        }
        mesh.position = Vector3.FromArray(parsedMesh.position);
        if (parsedMesh.metadata !== undefined) {
            mesh.metadata = parsedMesh.metadata;
        }
        if (parsedMesh.rotationQuaternion) {
            mesh.rotationQuaternion = Quaternion.FromArray(parsedMesh.rotationQuaternion);
        }
        else if (parsedMesh.rotation) {
            mesh.rotation = Vector3.FromArray(parsedMesh.rotation);
        }
        mesh.scaling = Vector3.FromArray(parsedMesh.scaling);
        if (parsedMesh.localMatrix) {
            mesh.setPreTransformMatrix(Matrix.FromArray(parsedMesh.localMatrix));
        }
        else if (parsedMesh.pivotMatrix) {
            mesh.setPivotMatrix(Matrix.FromArray(parsedMesh.pivotMatrix));
        }
        mesh.setEnabled(parsedMesh.isEnabled);
        mesh.isVisible = parsedMesh.isVisible;
        mesh.infiniteDistance = parsedMesh.infiniteDistance;
        mesh.showBoundingBox = parsedMesh.showBoundingBox;
        mesh.showSubMeshesBoundingBox = parsedMesh.showSubMeshesBoundingBox;
        if (parsedMesh.applyFog !== undefined) {
            mesh.applyFog = parsedMesh.applyFog;
        }
        if (parsedMesh.pickable !== undefined) {
            mesh.isPickable = parsedMesh.pickable;
        }
        if (parsedMesh.alphaIndex !== undefined) {
            mesh.alphaIndex = parsedMesh.alphaIndex;
        }
        mesh.receiveShadows = parsedMesh.receiveShadows;
        if (parsedMesh.billboardMode !== undefined) {
            mesh.billboardMode = parsedMesh.billboardMode;
        }
        if (parsedMesh.visibility !== undefined) {
            mesh.visibility = parsedMesh.visibility;
        }
        mesh.checkCollisions = parsedMesh.checkCollisions;
        mesh.overrideMaterialSideOrientation = parsedMesh.overrideMaterialSideOrientation;
        if (parsedMesh.isBlocker !== undefined) {
            mesh.isBlocker = parsedMesh.isBlocker;
        }
        mesh._shouldGenerateFlatShading = parsedMesh.useFlatShading;
        // freezeWorldMatrix
        if (parsedMesh.freezeWorldMatrix) {
            mesh._waitingData.freezeWorldMatrix = parsedMesh.freezeWorldMatrix;
        }
        // Parent
        if (parsedMesh.parentId !== undefined) {
            mesh._waitingParentId = parsedMesh.parentId;
        }
        if (parsedMesh.parentInstanceIndex !== undefined) {
            mesh._waitingParentInstanceIndex = parsedMesh.parentInstanceIndex;
        }
        // Actions
        if (parsedMesh.actions !== undefined) {
            mesh._waitingData.actions = parsedMesh.actions;
        }
        // Overlay
        if (parsedMesh.overlayAlpha !== undefined) {
            mesh.overlayAlpha = parsedMesh.overlayAlpha;
        }
        if (parsedMesh.overlayColor !== undefined) {
            mesh.overlayColor = Color3.FromArray(parsedMesh.overlayColor);
        }
        if (parsedMesh.renderOverlay !== undefined) {
            mesh.renderOverlay = parsedMesh.renderOverlay;
        }
        // Geometry
        mesh.isUnIndexed = !!parsedMesh.isUnIndexed;
        mesh.hasVertexAlpha = parsedMesh.hasVertexAlpha;
        if (parsedMesh.delayLoadingFile) {
            mesh.delayLoadState = 4;
            mesh.delayLoadingFile = rootUrl + parsedMesh.delayLoadingFile;
            mesh.buildBoundingInfo(Vector3.FromArray(parsedMesh.boundingBoxMinimum), Vector3.FromArray(parsedMesh.boundingBoxMaximum));
            if (parsedMesh._binaryInfo) {
                mesh._binaryInfo = parsedMesh._binaryInfo;
            }
            mesh._delayInfo = [];
            if (parsedMesh.hasUVs) {
                mesh._delayInfo.push(VertexBuffer.UVKind);
            }
            if (parsedMesh.hasUVs2) {
                mesh._delayInfo.push(VertexBuffer.UV2Kind);
            }
            if (parsedMesh.hasUVs3) {
                mesh._delayInfo.push(VertexBuffer.UV3Kind);
            }
            if (parsedMesh.hasUVs4) {
                mesh._delayInfo.push(VertexBuffer.UV4Kind);
            }
            if (parsedMesh.hasUVs5) {
                mesh._delayInfo.push(VertexBuffer.UV5Kind);
            }
            if (parsedMesh.hasUVs6) {
                mesh._delayInfo.push(VertexBuffer.UV6Kind);
            }
            if (parsedMesh.hasColors) {
                mesh._delayInfo.push(VertexBuffer.ColorKind);
            }
            if (parsedMesh.hasMatricesIndices) {
                mesh._delayInfo.push(VertexBuffer.MatricesIndicesKind);
            }
            if (parsedMesh.hasMatricesWeights) {
                mesh._delayInfo.push(VertexBuffer.MatricesWeightsKind);
            }
            mesh._delayLoadingFunction = Geometry._ImportGeometry;
            if (SceneLoaderFlags.ForceFullSceneLoadingForIncremental) {
                mesh._checkDelayState();
            }
        }
        else {
            Geometry._ImportGeometry(parsedMesh, mesh);
        }
        // Material
        if (parsedMesh.materialUniqueId) {
            mesh._waitingMaterialId = parsedMesh.materialUniqueId;
        }
        else if (parsedMesh.materialId) {
            mesh._waitingMaterialId = parsedMesh.materialId;
        }
        // Morph targets
        if (parsedMesh.morphTargetManagerId > -1) {
            mesh.morphTargetManager = scene.getMorphTargetManagerById(parsedMesh.morphTargetManagerId);
        }
        // Skeleton
        if (parsedMesh.skeletonId !== undefined && parsedMesh.skeletonId !== null) {
            mesh.skeleton = scene.getLastSkeletonById(parsedMesh.skeletonId);
            if (parsedMesh.numBoneInfluencers) {
                mesh.numBoneInfluencers = parsedMesh.numBoneInfluencers;
            }
        }
        // Animations
        if (parsedMesh.animations) {
            for (let animationIndex = 0; animationIndex < parsedMesh.animations.length; animationIndex++) {
                const parsedAnimation = parsedMesh.animations[animationIndex];
                const internalClass = GetClass("BABYLON.Animation");
                if (internalClass) {
                    mesh.animations.push(internalClass.Parse(parsedAnimation));
                }
            }
            Node.ParseAnimationRanges(mesh, parsedMesh, scene);
        }
        if (parsedMesh.autoAnimate) {
            scene.beginAnimation(mesh, parsedMesh.autoAnimateFrom, parsedMesh.autoAnimateTo, parsedMesh.autoAnimateLoop, parsedMesh.autoAnimateSpeed || 1.0);
        }
        // Layer Mask
        if (parsedMesh.layerMask && !isNaN(parsedMesh.layerMask)) {
            mesh.layerMask = Math.abs(parseInt(parsedMesh.layerMask));
        }
        else {
            mesh.layerMask = 0x0fffffff;
        }
        // Physics
        if (parsedMesh.physicsImpostor) {
            Mesh._PhysicsImpostorParser(scene, mesh, parsedMesh);
        }
        // Levels
        if (parsedMesh.lodMeshIds) {
            mesh._waitingData.lods = {
                ids: parsedMesh.lodMeshIds,
                distances: parsedMesh.lodDistances ? parsedMesh.lodDistances : null,
                coverages: parsedMesh.lodCoverages ? parsedMesh.lodCoverages : null,
            };
        }
        // Instances
        if (parsedMesh.instances) {
            for (let index = 0; index < parsedMesh.instances.length; index++) {
                const parsedInstance = parsedMesh.instances[index];
                const instance = mesh.createInstance(parsedInstance.name);
                if (parsedInstance.id) {
                    instance.id = parsedInstance.id;
                }
                if (Tags) {
                    if (parsedInstance.tags) {
                        Tags.AddTagsTo(instance, parsedInstance.tags);
                    }
                    else {
                        Tags.AddTagsTo(instance, parsedMesh.tags);
                    }
                }
                instance.position = Vector3.FromArray(parsedInstance.position);
                if (parsedInstance.metadata !== undefined) {
                    instance.metadata = parsedInstance.metadata;
                }
                if (parsedInstance.parentId !== undefined) {
                    instance._waitingParentId = parsedInstance.parentId;
                }
                if (parsedInstance.parentInstanceIndex !== undefined) {
                    instance._waitingParentInstanceIndex = parsedInstance.parentInstanceIndex;
                }
                if (parsedInstance.isEnabled !== undefined && parsedInstance.isEnabled !== null) {
                    instance.setEnabled(parsedInstance.isEnabled);
                }
                if (parsedInstance.isVisible !== undefined && parsedInstance.isVisible !== null) {
                    instance.isVisible = parsedInstance.isVisible;
                }
                if (parsedInstance.isPickable !== undefined && parsedInstance.isPickable !== null) {
                    instance.isPickable = parsedInstance.isPickable;
                }
                if (parsedInstance.rotationQuaternion) {
                    instance.rotationQuaternion = Quaternion.FromArray(parsedInstance.rotationQuaternion);
                }
                else if (parsedInstance.rotation) {
                    instance.rotation = Vector3.FromArray(parsedInstance.rotation);
                }
                instance.scaling = Vector3.FromArray(parsedInstance.scaling);
                if (parsedInstance.checkCollisions != undefined && parsedInstance.checkCollisions != null) {
                    instance.checkCollisions = parsedInstance.checkCollisions;
                }
                if (parsedInstance.pickable != undefined && parsedInstance.pickable != null) {
                    instance.isPickable = parsedInstance.pickable;
                }
                if (parsedInstance.showBoundingBox != undefined && parsedInstance.showBoundingBox != null) {
                    instance.showBoundingBox = parsedInstance.showBoundingBox;
                }
                if (parsedInstance.showSubMeshesBoundingBox != undefined && parsedInstance.showSubMeshesBoundingBox != null) {
                    instance.showSubMeshesBoundingBox = parsedInstance.showSubMeshesBoundingBox;
                }
                if (parsedInstance.alphaIndex != undefined && parsedInstance.showSubMeshesBoundingBox != null) {
                    instance.alphaIndex = parsedInstance.alphaIndex;
                }
                // Physics
                if (parsedInstance.physicsImpostor) {
                    Mesh._PhysicsImpostorParser(scene, instance, parsedInstance);
                }
                // Actions
                if (parsedInstance.actions !== undefined) {
                    instance._waitingData.actions = parsedInstance.actions;
                }
                // Animation
                if (parsedInstance.animations) {
                    for (let animationIndex = 0; animationIndex < parsedInstance.animations.length; animationIndex++) {
                        const parsedAnimation = parsedInstance.animations[animationIndex];
                        const internalClass = GetClass("BABYLON.Animation");
                        if (internalClass) {
                            instance.animations.push(internalClass.Parse(parsedAnimation));
                        }
                    }
                    Node.ParseAnimationRanges(instance, parsedInstance, scene);
                    if (parsedInstance.autoAnimate) {
                        scene.beginAnimation(instance, parsedInstance.autoAnimateFrom, parsedInstance.autoAnimateTo, parsedInstance.autoAnimateLoop, parsedInstance.autoAnimateSpeed || 1.0);
                    }
                }
            }
        }
        // Thin instances
        if (parsedMesh.thinInstances) {
            const thinInstances = parsedMesh.thinInstances;
            mesh.thinInstanceEnablePicking = !!thinInstances.enablePicking;
            if (thinInstances.matrixData) {
                mesh.thinInstanceSetBuffer("matrix", new Float32Array(thinInstances.matrixData), 16, false);
                mesh._thinInstanceDataStorage.matrixBufferSize = thinInstances.matrixBufferSize;
                mesh._thinInstanceDataStorage.instancesCount = thinInstances.instancesCount;
            }
            else {
                mesh._thinInstanceDataStorage.matrixBufferSize = thinInstances.matrixBufferSize;
            }
            if (parsedMesh.thinInstances.userThinInstance) {
                const userThinInstance = parsedMesh.thinInstances.userThinInstance;
                for (const kind in userThinInstance.data) {
                    mesh.thinInstanceSetBuffer(kind, new Float32Array(userThinInstance.data[kind]), userThinInstance.strides[kind], false);
                    mesh._userThinInstanceBuffersStorage.sizes[kind] = userThinInstance.sizes[kind];
                }
            }
        }
        return mesh;
    }
    // Skeletons
    /**
     * Prepare internal position array for software CPU skinning
     * @returns original positions used for CPU skinning. Useful for integrating Morphing with skeletons in same mesh
     */
    setPositionsForCPUSkinning() {
        const internalDataInfo = this._internalMeshDataInfo;
        if (!internalDataInfo._sourcePositions) {
            const source = this.getVerticesData(VertexBuffer.PositionKind);
            if (!source) {
                return internalDataInfo._sourcePositions;
            }
            internalDataInfo._sourcePositions = new Float32Array(source);
            if (!this.isVertexBufferUpdatable(VertexBuffer.PositionKind)) {
                this.setVerticesData(VertexBuffer.PositionKind, source, true);
            }
        }
        return internalDataInfo._sourcePositions;
    }
    /**
     * Prepare internal normal array for software CPU skinning
     * @returns original normals used for CPU skinning. Useful for integrating Morphing with skeletons in same mesh.
     */
    setNormalsForCPUSkinning() {
        const internalDataInfo = this._internalMeshDataInfo;
        if (!internalDataInfo._sourceNormals) {
            const source = this.getVerticesData(VertexBuffer.NormalKind);
            if (!source) {
                return internalDataInfo._sourceNormals;
            }
            internalDataInfo._sourceNormals = new Float32Array(source);
            if (!this.isVertexBufferUpdatable(VertexBuffer.NormalKind)) {
                this.setVerticesData(VertexBuffer.NormalKind, source, true);
            }
        }
        return internalDataInfo._sourceNormals;
    }
    /**
     * Updates the vertex buffer by applying transformation from the bones
     * @param skeleton defines the skeleton to apply to current mesh
     * @returns the current mesh
     */
    applySkeleton(skeleton) {
        if (!this.geometry) {
            return this;
        }
        if (this.geometry._softwareSkinningFrameId == this.getScene().getFrameId()) {
            return this;
        }
        this.geometry._softwareSkinningFrameId = this.getScene().getFrameId();
        if (!this.isVerticesDataPresent(VertexBuffer.PositionKind)) {
            return this;
        }
        if (!this.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind)) {
            return this;
        }
        if (!this.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind)) {
            return this;
        }
        const hasNormals = this.isVerticesDataPresent(VertexBuffer.NormalKind);
        const internalDataInfo = this._internalMeshDataInfo;
        if (!internalDataInfo._sourcePositions) {
            const submeshes = this.subMeshes.slice();
            this.setPositionsForCPUSkinning();
            this.subMeshes = submeshes;
        }
        if (hasNormals && !internalDataInfo._sourceNormals) {
            this.setNormalsForCPUSkinning();
        }
        // positionsData checks for not being Float32Array will only pass at most once
        let positionsData = this.getVerticesData(VertexBuffer.PositionKind);
        if (!positionsData) {
            return this;
        }
        if (!(positionsData instanceof Float32Array)) {
            positionsData = new Float32Array(positionsData);
        }
        // normalsData checks for not being Float32Array will only pass at most once
        let normalsData = this.getVerticesData(VertexBuffer.NormalKind);
        if (hasNormals) {
            if (!normalsData) {
                return this;
            }
            if (!(normalsData instanceof Float32Array)) {
                normalsData = new Float32Array(normalsData);
            }
        }
        const matricesIndicesData = this.getVerticesData(VertexBuffer.MatricesIndicesKind);
        const matricesWeightsData = this.getVerticesData(VertexBuffer.MatricesWeightsKind);
        if (!matricesWeightsData || !matricesIndicesData) {
            return this;
        }
        const needExtras = this.numBoneInfluencers > 4;
        const matricesIndicesExtraData = needExtras ? this.getVerticesData(VertexBuffer.MatricesIndicesExtraKind) : null;
        const matricesWeightsExtraData = needExtras ? this.getVerticesData(VertexBuffer.MatricesWeightsExtraKind) : null;
        const skeletonMatrices = skeleton.getTransformMatrices(this);
        const tempVector3 = Vector3.Zero();
        const finalMatrix = new Matrix();
        const tempMatrix = new Matrix();
        let matWeightIdx = 0;
        let inf;
        for (let index = 0; index < positionsData.length; index += 3, matWeightIdx += 4) {
            let weight;
            for (inf = 0; inf < 4; inf++) {
                weight = matricesWeightsData[matWeightIdx + inf];
                if (weight > 0) {
                    Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + inf] * 16), weight, tempMatrix);
                    finalMatrix.addToSelf(tempMatrix);
                }
            }
            if (needExtras) {
                for (inf = 0; inf < 4; inf++) {
                    weight = matricesWeightsExtraData[matWeightIdx + inf];
                    if (weight > 0) {
                        Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesExtraData[matWeightIdx + inf] * 16), weight, tempMatrix);
                        finalMatrix.addToSelf(tempMatrix);
                    }
                }
            }
            Vector3.TransformCoordinatesFromFloatsToRef(internalDataInfo._sourcePositions[index], internalDataInfo._sourcePositions[index + 1], internalDataInfo._sourcePositions[index + 2], finalMatrix, tempVector3);
            tempVector3.toArray(positionsData, index);
            if (hasNormals) {
                Vector3.TransformNormalFromFloatsToRef(internalDataInfo._sourceNormals[index], internalDataInfo._sourceNormals[index + 1], internalDataInfo._sourceNormals[index + 2], finalMatrix, tempVector3);
                tempVector3.toArray(normalsData, index);
            }
            finalMatrix.reset();
        }
        this.updateVerticesData(VertexBuffer.PositionKind, positionsData);
        if (hasNormals) {
            this.updateVerticesData(VertexBuffer.NormalKind, normalsData);
        }
        return this;
    }
    // Tools
    /**
     * Returns an object containing a min and max Vector3 which are the minimum and maximum vectors of each mesh bounding box from the passed array, in the world coordinates
     * @param meshes defines the list of meshes to scan
     * @returns an object `{min:` Vector3`, max:` Vector3`}`
     */
    static MinMax(meshes) {
        let minVector = null;
        let maxVector = null;
        meshes.forEach(function (mesh) {
            const boundingInfo = mesh.getBoundingInfo();
            const boundingBox = boundingInfo.boundingBox;
            if (!minVector || !maxVector) {
                minVector = boundingBox.minimumWorld;
                maxVector = boundingBox.maximumWorld;
            }
            else {
                minVector.minimizeInPlace(boundingBox.minimumWorld);
                maxVector.maximizeInPlace(boundingBox.maximumWorld);
            }
        });
        if (!minVector || !maxVector) {
            return {
                min: Vector3.Zero(),
                max: Vector3.Zero(),
            };
        }
        return {
            min: minVector,
            max: maxVector,
        };
    }
    /**
     * Returns the center of the `{min:` Vector3`, max:` Vector3`}` or the center of MinMax vector3 computed from a mesh array
     * @param meshesOrMinMaxVector could be an array of meshes or a `{min:` Vector3`, max:` Vector3`}` object
     * @returns a vector3
     */
    static Center(meshesOrMinMaxVector) {
        const minMaxVector = meshesOrMinMaxVector instanceof Array ? Mesh.MinMax(meshesOrMinMaxVector) : meshesOrMinMaxVector;
        return Vector3.Center(minMaxVector.min, minMaxVector.max);
    }
    /**
     * Merge the array of meshes into a single mesh for performance reasons.
     * @param meshes array of meshes with the vertices to merge. Entries cannot be empty meshes.
     * @param disposeSource when true (default), dispose of the vertices from the source meshes.
     * @param allow32BitsIndices when the sum of the vertices > 64k, this must be set to true.
     * @param meshSubclass (optional) can be set to a Mesh where the merged vertices will be inserted.
     * @param subdivideWithSubMeshes when true (false default), subdivide mesh into subMeshes.
     * @param multiMultiMaterials when true (false default), subdivide mesh into subMeshes with multiple materials, ignores subdivideWithSubMeshes.
     * @returns a new mesh
     */
    static MergeMeshes(meshes, disposeSource = true, allow32BitsIndices, meshSubclass, subdivideWithSubMeshes, multiMultiMaterials) {
        return runCoroutineSync(Mesh._MergeMeshesCoroutine(meshes, disposeSource, allow32BitsIndices, meshSubclass, subdivideWithSubMeshes, multiMultiMaterials, false));
    }
    /**
     * Merge the array of meshes into a single mesh for performance reasons.
     * @param meshes array of meshes with the vertices to merge. Entries cannot be empty meshes.
     * @param disposeSource when true (default), dispose of the vertices from the source meshes.
     * @param allow32BitsIndices when the sum of the vertices > 64k, this must be set to true.
     * @param meshSubclass (optional) can be set to a Mesh where the merged vertices will be inserted.
     * @param subdivideWithSubMeshes when true (false default), subdivide mesh into subMeshes.
     * @param multiMultiMaterials when true (false default), subdivide mesh into subMeshes with multiple materials, ignores subdivideWithSubMeshes.
     * @returns a new mesh
     */
    static MergeMeshesAsync(meshes, disposeSource = true, allow32BitsIndices, meshSubclass, subdivideWithSubMeshes, multiMultiMaterials) {
        return runCoroutineAsync(Mesh._MergeMeshesCoroutine(meshes, disposeSource, allow32BitsIndices, meshSubclass, subdivideWithSubMeshes, multiMultiMaterials, true), createYieldingScheduler());
    }
    static *_MergeMeshesCoroutine(meshes, disposeSource = true, allow32BitsIndices, meshSubclass, subdivideWithSubMeshes, multiMultiMaterials, isAsync) {
        // Remove any null/undefined entries from the mesh array
        meshes = meshes.filter(Boolean);
        if (meshes.length === 0) {
            return null;
        }
        let index;
        if (!allow32BitsIndices) {
            let totalVertices = 0;
            // Counting vertices
            for (index = 0; index < meshes.length; index++) {
                totalVertices += meshes[index].getTotalVertices();
                if (totalVertices >= 65536) {
                    Logger.Warn("Cannot merge meshes because resulting mesh will have more than 65536 vertices. Please use allow32BitsIndices = true to use 32 bits indices");
                    return null;
                }
            }
        }
        if (multiMultiMaterials) {
            subdivideWithSubMeshes = false;
        }
        const materialArray = new Array();
        const materialIndexArray = new Array();
        // Merge
        const indiceArray = new Array();
        const currentOverrideMaterialSideOrientation = meshes[0].overrideMaterialSideOrientation;
        for (index = 0; index < meshes.length; index++) {
            const mesh = meshes[index];
            if (mesh.isAnInstance) {
                Logger.Warn("Cannot merge instance meshes.");
                return null;
            }
            if (currentOverrideMaterialSideOrientation !== mesh.overrideMaterialSideOrientation) {
                Logger.Warn("Cannot merge meshes with different overrideMaterialSideOrientation values.");
                return null;
            }
            if (subdivideWithSubMeshes) {
                indiceArray.push(mesh.getTotalIndices());
            }
            if (multiMultiMaterials) {
                if (mesh.material) {
                    const material = mesh.material;
                    if (material instanceof MultiMaterial) {
                        for (let matIndex = 0; matIndex < material.subMaterials.length; matIndex++) {
                            if (materialArray.indexOf(material.subMaterials[matIndex]) < 0) {
                                materialArray.push(material.subMaterials[matIndex]);
                            }
                        }
                        for (let subIndex = 0; subIndex < mesh.subMeshes.length; subIndex++) {
                            materialIndexArray.push(materialArray.indexOf(material.subMaterials[mesh.subMeshes[subIndex].materialIndex]));
                            indiceArray.push(mesh.subMeshes[subIndex].indexCount);
                        }
                    }
                    else {
                        if (materialArray.indexOf(material) < 0) {
                            materialArray.push(material);
                        }
                        for (let subIndex = 0; subIndex < mesh.subMeshes.length; subIndex++) {
                            materialIndexArray.push(materialArray.indexOf(material));
                            indiceArray.push(mesh.subMeshes[subIndex].indexCount);
                        }
                    }
                }
                else {
                    for (let subIndex = 0; subIndex < mesh.subMeshes.length; subIndex++) {
                        materialIndexArray.push(0);
                        indiceArray.push(mesh.subMeshes[subIndex].indexCount);
                    }
                }
            }
        }
        const source = meshes[0];
        const getVertexDataFromMesh = (mesh) => {
            const wm = mesh.computeWorldMatrix(true);
            const vertexData = VertexData.ExtractFromMesh(mesh, false, false);
            return { vertexData, transform: wm };
        };
        const { vertexData: sourceVertexData, transform: sourceTransform } = getVertexDataFromMesh(source);
        if (isAsync) {
            yield;
        }
        const meshVertexDatas = new Array(meshes.length - 1);
        for (let i = 1; i < meshes.length; i++) {
            meshVertexDatas[i - 1] = getVertexDataFromMesh(meshes[i]);
            if (isAsync) {
                yield;
            }
        }
        const mergeCoroutine = sourceVertexData._mergeCoroutine(sourceTransform, meshVertexDatas, allow32BitsIndices, isAsync, !disposeSource);
        let mergeCoroutineStep = mergeCoroutine.next();
        while (!mergeCoroutineStep.done) {
            if (isAsync) {
                yield;
            }
            mergeCoroutineStep = mergeCoroutine.next();
        }
        const vertexData = mergeCoroutineStep.value;
        if (!meshSubclass) {
            meshSubclass = new Mesh(source.name + "_merged", source.getScene());
        }
        const applyToCoroutine = vertexData._applyToCoroutine(meshSubclass, undefined, isAsync);
        let applyToCoroutineStep = applyToCoroutine.next();
        while (!applyToCoroutineStep.done) {
            if (isAsync) {
                yield;
            }
            applyToCoroutineStep = applyToCoroutine.next();
        }
        // Setting properties
        meshSubclass.checkCollisions = source.checkCollisions;
        meshSubclass.overrideMaterialSideOrientation = source.overrideMaterialSideOrientation;
        // Cleaning
        if (disposeSource) {
            for (index = 0; index < meshes.length; index++) {
                meshes[index].dispose();
            }
        }
        // Subdivide
        if (subdivideWithSubMeshes || multiMultiMaterials) {
            //-- removal of global submesh
            meshSubclass.releaseSubMeshes();
            index = 0;
            let offset = 0;
            //-- apply subdivision according to index table
            while (index < indiceArray.length) {
                SubMesh.CreateFromIndices(0, offset, indiceArray[index], meshSubclass, undefined, false);
                offset += indiceArray[index];
                index++;
            }
            for (const subMesh of meshSubclass.subMeshes) {
                subMesh.refreshBoundingInfo();
            }
            meshSubclass.computeWorldMatrix(true);
        }
        if (multiMultiMaterials) {
            const newMultiMaterial = new MultiMaterial(source.name + "_merged", source.getScene());
            newMultiMaterial.subMaterials = materialArray;
            for (let subIndex = 0; subIndex < meshSubclass.subMeshes.length; subIndex++) {
                meshSubclass.subMeshes[subIndex].materialIndex = materialIndexArray[subIndex];
            }
            meshSubclass.material = newMultiMaterial;
        }
        else {
            meshSubclass.material = source.material;
        }
        return meshSubclass;
    }
    /**
     * @internal
     */
    addInstance(instance) {
        instance._indexInSourceMeshInstanceArray = this.instances.length;
        this.instances.push(instance);
    }
    /**
     * @internal
     */
    removeInstance(instance) {
        // Remove from mesh
        const index = instance._indexInSourceMeshInstanceArray;
        if (index != -1) {
            if (index !== this.instances.length - 1) {
                const last = this.instances[this.instances.length - 1];
                this.instances[index] = last;
                last._indexInSourceMeshInstanceArray = index;
            }
            instance._indexInSourceMeshInstanceArray = -1;
            this.instances.pop();
        }
    }
    /** @internal */
    _shouldConvertRHS() {
        return this.overrideMaterialSideOrientation === Material.CounterClockWiseSideOrientation;
    }
    /** @internal */
    _getRenderingFillMode(fillMode) {
        var _a;
        const scene = this.getScene();
        if (scene.forcePointsCloud)
            return Material.PointFillMode;
        if (scene.forceWireframe)
            return Material.WireFrameFillMode;
        return (_a = this.overrideRenderingFillMode) !== null && _a !== void 0 ? _a : fillMode;
    }
    // deprecated methods
    /**
     * Sets the mesh material by the material or multiMaterial `id` property
     * @param id is a string identifying the material or the multiMaterial
     * @returns the current mesh
     * @deprecated Please use MeshBuilder instead Please use setMaterialById instead
     */
    setMaterialByID(id) {
        return this.setMaterialById(id);
    }
    /**
     * Creates a ribbon mesh.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param
     * @param name defines the name of the mesh to create
     * @param pathArray is a required array of paths, what are each an array of successive Vector3. The pathArray parameter depicts the ribbon geometry.
     * @param closeArray creates a seam between the first and the last paths of the path array (default is false)
     * @param closePath creates a seam between the first and the last points of each path of the path array
     * @param offset is taken in account only if the `pathArray` is containing a single path
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param instance defines an instance of an existing Ribbon object to be updated with the passed `pathArray` parameter (https://doc.babylonjs.com/how_to/How_to_dynamically_morph_a_mesh#ribbon)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateRibbon(name, pathArray, closeArray, closePath, offset, scene, updatable, sideOrientation, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a plane polygonal mesh.  By default, this is a disc.
     * @param name defines the name of the mesh to create
     * @param radius sets the radius size (float) of the polygon (default 0.5)
     * @param tessellation sets the number of polygon sides (positive integer, default 64). So a tessellation valued to 3 will build a triangle, to 4 a square, etc
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateDisc(name, radius, tessellation, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a box mesh.
     * @param name defines the name of the mesh to create
     * @param size sets the size (float) of each box side (default 1)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateBox(name, size, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a sphere mesh.
     * @param name defines the name of the mesh to create
     * @param segments sets the sphere number of horizontal stripes (positive integer, default 32)
     * @param diameter sets the diameter size (float) of the sphere (default 1)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateSphere(name, segments, diameter, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a hemisphere mesh.
     * @param name defines the name of the mesh to create
     * @param segments sets the sphere number of horizontal stripes (positive integer, default 32)
     * @param diameter sets the diameter size (float) of the sphere (default 1)
     * @param scene defines the hosting scene
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateHemisphere(name, segments, diameter, scene) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a cylinder or a cone mesh.
     * @param name defines the name of the mesh to create
     * @param height sets the height size (float) of the cylinder/cone (float, default 2)
     * @param diameterTop set the top cap diameter (floats, default 1)
     * @param diameterBottom set the bottom cap diameter (floats, default 1). This value can't be zero
     * @param tessellation sets the number of cylinder sides (positive integer, default 24). Set it to 3 to get a prism for instance
     * @param subdivisions sets the number of rings along the cylinder height (positive integer, default 1)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateCylinder(name, height, diameterTop, diameterBottom, tessellation, subdivisions, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    // Torus  (Code from SharpDX.org)
    /**
     * Creates a torus mesh.
     * @param name defines the name of the mesh to create
     * @param diameter sets the diameter size (float) of the torus (default 1)
     * @param thickness sets the diameter size of the tube of the torus (float, default 0.5)
     * @param tessellation sets the number of torus sides (positive integer, default 16)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateTorus(name, diameter, thickness, tessellation, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a torus knot mesh.
     * @param name defines the name of the mesh to create
     * @param radius sets the global radius size (float) of the torus knot (default 2)
     * @param tube sets the diameter size of the tube of the torus (float, default 0.5)
     * @param radialSegments sets the number of sides on each tube segments (positive integer, default 32)
     * @param tubularSegments sets the number of tubes to decompose the knot into (positive integer, default 32)
     * @param p the number of windings on X axis (positive integers, default 2)
     * @param q the number of windings on Y axis (positive integers, default 3)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateTorusKnot(name, radius, tube, radialSegments, tubularSegments, p, q, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a line mesh..
     * @param name defines the name of the mesh to create
     * @param points is an array successive Vector3
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param instance is an instance of an existing LineMesh object to be updated with the passed `points` parameter (https://doc.babylonjs.com/how_to/How_to_dynamically_morph_a_mesh#lines-and-dashedlines).
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateLines(name, points, scene, updatable, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a dashed line mesh.
     * @param name defines the name of the mesh to create
     * @param points is an array successive Vector3
     * @param dashSize is the size of the dashes relatively the dash number (positive float, default 3)
     * @param gapSize is the size of the gap between two successive dashes relatively the dash number (positive float, default 1)
     * @param dashNb is the intended total number of dashes (positive integer, default 200)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param instance is an instance of an existing LineMesh object to be updated with the passed `points` parameter (https://doc.babylonjs.com/how_to/How_to_dynamically_morph_a_mesh#lines-and-dashedlines)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateDashedLines(name, points, dashSize, gapSize, dashNb, scene, updatable, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a polygon mesh.Please consider using the same method from the MeshBuilder class instead
     * The polygon's shape will depend on the input parameters and is constructed parallel to a ground mesh.
     * The parameter `shape` is a required array of successive Vector3 representing the corners of the polygon in th XoZ plane, that is y = 0 for all vectors.
     * You can set the mesh side orientation with the values : Mesh.FRONTSIDE (default), Mesh.BACKSIDE or Mesh.DOUBLESIDE
     * The mesh can be set to updatable with the boolean parameter `updatable` (default false) if its internal geometry is supposed to change once created.
     * Remember you can only change the shape positions, not their number when updating a polygon.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param#non-regular-polygon
     * @param name defines the name of the mesh to create
     * @param shape is a required array of successive Vector3 representing the corners of the polygon in th XoZ plane, that is y = 0 for all vectors
     * @param scene defines the hosting scene
     * @param holes is a required array of arrays of successive Vector3 used to defines holes in the polygon
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param earcutInjection can be used to inject your own earcut reference
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreatePolygon(name, shape, scene, holes, updatable, sideOrientation, earcutInjection) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates an extruded polygon mesh, with depth in the Y direction..
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param#extruded-non-regular-polygon
     * @param name defines the name of the mesh to create
     * @param shape is a required array of successive Vector3 representing the corners of the polygon in th XoZ plane, that is y = 0 for all vectors
     * @param depth defines the height of extrusion
     * @param scene defines the hosting scene
     * @param holes is a required array of arrays of successive Vector3 used to defines holes in the polygon
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param earcutInjection can be used to inject your own earcut reference
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static ExtrudePolygon(name, shape, depth, scene, holes, updatable, sideOrientation, earcutInjection) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates an extruded shape mesh.
     * The extrusion is a parametric shape. It has no predefined shape. Its final shape will depend on the input parameters.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param#extruded-shapes
     * @param name defines the name of the mesh to create
     * @param shape is a required array of successive Vector3. This array depicts the shape to be extruded in its local space : the shape must be designed in the xOy plane and will be extruded along the Z axis
     * @param path is a required array of successive Vector3. This is the axis curve the shape is extruded along
     * @param scale is the value to scale the shape
     * @param rotation is the angle value to rotate the shape each step (each path point), from the former step (so rotation added each step) along the curve
     * @param cap sets the way the extruded shape is capped. Possible values : Mesh.NO_CAP (default), Mesh.CAP_START, Mesh.CAP_END, Mesh.CAP_ALL
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param instance is an instance of an existing ExtrudedShape object to be updated with the passed `shape`, `path`, `scale` or `rotation` parameters (https://doc.babylonjs.com/how_to/How_to_dynamically_morph_a_mesh#extruded-shape)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static ExtrudeShape(name, shape, path, scale, rotation, cap, scene, updatable, sideOrientation, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates an custom extruded shape mesh.
     * The custom extrusion is a parametric shape.
     * It has no predefined shape. Its final shape will depend on the input parameters.
     *
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param#extruded-shapes
     * @param name defines the name of the mesh to create
     * @param shape is a required array of successive Vector3. This array depicts the shape to be extruded in its local space : the shape must be designed in the xOy plane and will be extruded along the Z axis
     * @param path is a required array of successive Vector3. This is the axis curve the shape is extruded along
     * @param scaleFunction is a custom Javascript function called on each path point
     * @param rotationFunction is a custom Javascript function called on each path point
     * @param ribbonCloseArray forces the extrusion underlying ribbon to close all the paths in its `pathArray`
     * @param ribbonClosePath forces the extrusion underlying ribbon to close its `pathArray`
     * @param cap sets the way the extruded shape is capped. Possible values : Mesh.NO_CAP (default), Mesh.CAP_START, Mesh.CAP_END, Mesh.CAP_ALL
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param instance is an instance of an existing ExtrudedShape object to be updated with the passed `shape`, `path`, `scale` or `rotation` parameters (https://doc.babylonjs.com/features/featuresDeepDive/mesh/dynamicMeshMorph#extruded-shape)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static ExtrudeShapeCustom(name, shape, path, scaleFunction, rotationFunction, ribbonCloseArray, ribbonClosePath, cap, scene, updatable, sideOrientation, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates lathe mesh.
     * The lathe is a shape with a symmetry axis : a 2D model shape is rotated around this axis to design the lathe.
     * @param name defines the name of the mesh to create
     * @param shape is a required array of successive Vector3. This array depicts the shape to be rotated in its local space : the shape must be designed in the xOy plane and will be rotated around the Y axis. It's usually a 2D shape, so the Vector3 z coordinates are often set to zero
     * @param radius is the radius value of the lathe
     * @param tessellation is the side number of the lathe.
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateLathe(name, shape, radius, tessellation, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a plane mesh.
     * @param name defines the name of the mesh to create
     * @param size sets the size (float) of both sides of the plane at once (default 1)
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreatePlane(name, size, scene, updatable, sideOrientation) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a ground mesh.
     * @param name defines the name of the mesh to create
     * @param width set the width of the ground
     * @param height set the height of the ground
     * @param subdivisions sets the number of subdivisions per side
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateGround(name, width, height, subdivisions, scene, updatable) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a tiled ground mesh.
     * @param name defines the name of the mesh to create
     * @param xmin set the ground minimum X coordinate
     * @param zmin set the ground minimum Y coordinate
     * @param xmax set the ground maximum X coordinate
     * @param zmax set the ground maximum Z coordinate
     * @param subdivisions is an object `{w: positive integer, h: positive integer}` (default `{w: 6, h: 6}`). `w` and `h` are the numbers of subdivisions on the ground width and height. Each subdivision is called a tile
     * @param precision is an object `{w: positive integer, h: positive integer}` (default `{w: 2, h: 2}`). `w` and `h` are the numbers of subdivisions on the ground width and height of each tile
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateTiledGround(name, xmin, zmin, xmax, zmax, subdivisions, precision, scene, updatable) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a ground mesh from a height map.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set/height_map
     * @param name defines the name of the mesh to create
     * @param url sets the URL of the height map image resource
     * @param width set the ground width size
     * @param height set the ground height size
     * @param subdivisions sets the number of subdivision per side
     * @param minHeight is the minimum altitude on the ground
     * @param maxHeight is the maximum altitude on the ground
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param onReady  is a callback function that will be called  once the mesh is built (the height map download can last some time)
     * @param alphaFilter will filter any data where the alpha channel is below this value, defaults 0 (all data visible)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateGroundFromHeightMap(name, url, width, height, subdivisions, minHeight, maxHeight, scene, updatable, onReady, alphaFilter) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a tube mesh.
     * The tube is a parametric shape.
     * It has no predefined shape. Its final shape will depend on the input parameters.
     *
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param
     * @param name defines the name of the mesh to create
     * @param path is a required array of successive Vector3. It is the curve used as the axis of the tube
     * @param radius sets the tube radius size
     * @param tessellation is the number of sides on the tubular surface
     * @param radiusFunction is a custom function. If it is not null, it overrides the parameter `radius`. This function is called on each point of the tube path and is passed the index `i` of the i-th point and the distance of this point from the first point of the path
     * @param cap sets the way the extruded shape is capped. Possible values : Mesh.NO_CAP (default), Mesh.CAP_START, Mesh.CAP_END, Mesh.CAP_ALL
     * @param scene defines the hosting scene
     * @param updatable defines if the mesh must be flagged as updatable
     * @param sideOrientation defines the mesh side orientation (https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation)
     * @param instance is an instance of an existing Tube object to be updated with the passed `pathArray` parameter (https://doc.babylonjs.com/how_to/How_to_dynamically_morph_a_mesh#tube)
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateTube(name, path, radius, tessellation, radiusFunction, cap, scene, updatable, sideOrientation, instance) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a polyhedron mesh.
     *.
     * * The parameter `type` (positive integer, max 14, default 0) sets the polyhedron type to build among the 15 embedded types. Please refer to the type sheet in the tutorial to choose the wanted type
     * * The parameter `size` (positive float, default 1) sets the polygon size
     * * You can overwrite the `size` on each dimension bu using the parameters `sizeX`, `sizeY` or `sizeZ` (positive floats, default to `size` value)
     * * You can build other polyhedron types than the 15 embbeded ones by setting the parameter `custom` (`polyhedronObject`, default null). If you set the parameter `custom`, this overwrittes the parameter `type`
     * * A `polyhedronObject` is a formatted javascript object. You'll find a full file with pre-set polyhedra here : https://github.com/BabylonJS/Extensions/tree/master/Polyhedron
     * * You can set the color and the UV of each side of the polyhedron with the parameters `faceColors` (Color4, default `(1, 1, 1, 1)`) and faceUV (Vector4, default `(0, 0, 1, 1)`)
     * * To understand how to set `faceUV` or `faceColors`, please read this by considering the right number of faces of your polyhedron, instead of only 6 for the box : https://doc.babylonjs.com/features/featuresDeepDive/materials/using/texturePerBoxFace
     * * The parameter `flat` (boolean, default true). If set to false, it gives the polyhedron a single global face, so less vertices and shared normals. In this case, `faceColors` and `faceUV` are ignored
     * * You can also set the mesh side orientation with the values : Mesh.FRONTSIDE (default), Mesh.BACKSIDE or Mesh.DOUBLESIDE
     * * If you create a double-sided mesh, you can choose what parts of the texture image to crop and stick respectively on the front and the back sides with the parameters `frontUVs` and `backUVs` (Vector4). Detail here : https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation
     * * The mesh can be set to updatable with the boolean parameter `updatable` (default false) if its internal geometry is supposed to change once created
     * @param name defines the name of the mesh to create
     * @param options defines the options used to create the mesh
     * @param scene defines the hosting scene
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreatePolyhedron(name, options, scene) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a sphere based upon an icosahedron with 20 triangular faces which can be subdivided
     * * The parameter `radius` sets the radius size (float) of the icosphere (default 1)
     * * You can set some different icosphere dimensions, for instance to build an ellipsoid, by using the parameters `radiusX`, `radiusY` and `radiusZ` (all by default have the same value than `radius`)
     * * The parameter `subdivisions` sets the number of subdivisions (positive integer, default 4). The more subdivisions, the more faces on the icosphere whatever its size
     * * The parameter `flat` (boolean, default true) gives each side its own normals. Set it to false to get a smooth continuous light reflection on the surface
     * * You can also set the mesh side orientation with the values : Mesh.FRONTSIDE (default), Mesh.BACKSIDE or Mesh.DOUBLESIDE
     * * If you create a double-sided mesh, you can choose what parts of the texture image to crop and stick respectively on the front and the back sides with the parameters `frontUVs` and `backUVs` (Vector4). Detail here : https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set#side-orientation
     * * The mesh can be set to updatable with the boolean parameter `updatable` (default false) if its internal geometry is supposed to change once created
     * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/polyhedra#icosphere
     * @param name defines the name of the mesh
     * @param options defines the options used to create the mesh
     * @param scene defines the hosting scene
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateIcoSphere(name, options, scene) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Creates a decal mesh.
     *.
     * A decal is a mesh usually applied as a model onto the surface of another mesh
     * @param name  defines the name of the mesh
     * @param sourceMesh defines the mesh receiving the decal
     * @param position sets the position of the decal in world coordinates
     * @param normal sets the normal of the mesh where the decal is applied onto in world coordinates
     * @param size sets the decal scaling
     * @param angle sets the angle to rotate the decal
     * @returns a new Mesh
     * @deprecated Please use MeshBuilder instead
     */
    static CreateDecal(name, sourceMesh, position, normal, size, angle) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /** Creates a Capsule Mesh
     * @param name defines the name of the mesh.
     * @param options the constructors options used to shape the mesh.
     * @param scene defines the scene the mesh is scoped to.
     * @returns the capsule mesh
     * @see https://doc.babylonjs.com/how_to/capsule_shape
     * @deprecated Please use MeshBuilder instead
     */
    static CreateCapsule(name, options, scene) {
        throw new Error("Import MeshBuilder to populate this function");
    }
    /**
     * Extends a mesh to a Goldberg mesh
     * Warning  the mesh to convert MUST be an import of a perviously exported Goldberg mesh
     * @param mesh the mesh to convert
     * @returns the extended mesh
     * @deprecated Please use ExtendMeshToGoldberg instead
     */
    static ExtendToGoldberg(mesh) {
        throw new Error("Import MeshBuilder to populate this function");
    }
}
// Consts
/**
 * Mesh side orientation : usually the external or front surface
 */
Mesh.FRONTSIDE = VertexData.FRONTSIDE;
/**
 * Mesh side orientation : usually the internal or back surface
 */
Mesh.BACKSIDE = VertexData.BACKSIDE;
/**
 * Mesh side orientation : both internal and external or front and back surfaces
 */
Mesh.DOUBLESIDE = VertexData.DOUBLESIDE;
/**
 * Mesh side orientation : by default, `FRONTSIDE`
 */
Mesh.DEFAULTSIDE = VertexData.DEFAULTSIDE;
/**
 * Mesh cap setting : no cap
 */
Mesh.NO_CAP = 0;
/**
 * Mesh cap setting : one cap at the beginning of the mesh
 */
Mesh.CAP_START = 1;
/**
 * Mesh cap setting : one cap at the end of the mesh
 */
Mesh.CAP_END = 2;
/**
 * Mesh cap setting : two caps, one at the beginning  and one at the end of the mesh
 */
Mesh.CAP_ALL = 3;
/**
 * Mesh pattern setting : no flip or rotate
 */
Mesh.NO_FLIP = 0;
/**
 * Mesh pattern setting : flip (reflect in y axis) alternate tiles on each row or column
 */
Mesh.FLIP_TILE = 1;
/**
 * Mesh pattern setting : rotate (180degs) alternate tiles on each row or column
 */
Mesh.ROTATE_TILE = 2;
/**
 * Mesh pattern setting : flip (reflect in y axis) all tiles on alternate rows
 */
Mesh.FLIP_ROW = 3;
/**
 * Mesh pattern setting : rotate (180degs) all tiles on alternate rows
 */
Mesh.ROTATE_ROW = 4;
/**
 * Mesh pattern setting : flip and rotate alternate tiles on each row or column
 */
Mesh.FLIP_N_ROTATE_TILE = 5;
/**
 * Mesh pattern setting : rotate pattern and rotate
 */
Mesh.FLIP_N_ROTATE_ROW = 6;
/**
 * Mesh tile positioning : part tiles same on left/right or top/bottom
 */
Mesh.CENTER = 0;
/**
 * Mesh tile positioning : part tiles on left
 */
Mesh.LEFT = 1;
/**
 * Mesh tile positioning : part tiles on right
 */
Mesh.RIGHT = 2;
/**
 * Mesh tile positioning : part tiles on top
 */
Mesh.TOP = 3;
/**
 * Mesh tile positioning : part tiles on bottom
 */
Mesh.BOTTOM = 4;
/**
 * Indicates that the instanced meshes should be sorted from back to front before rendering if their material is transparent
 */
Mesh.INSTANCEDMESH_SORT_TRANSPARENT = false;
// Statics
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Mesh._GroundMeshParser = (parsedMesh, scene) => {
    throw _WarnImport("GroundMesh");
};
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Mesh._GoldbergMeshParser = (parsedMesh, scene) => {
    throw _WarnImport("GoldbergMesh");
};
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Mesh._LinesMeshParser = (parsedMesh, scene) => {
    throw _WarnImport("LinesMesh");
};
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Mesh._GreasedLineMeshParser = (parsedMesh, scene) => {
    throw _WarnImport("GreasedLineMesh");
};
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Mesh._TrailMeshParser = (parsedMesh, scene) => {
    throw _WarnImport("TrailMesh");
};
RegisterClass("BABYLON.Mesh", Mesh);
//# sourceMappingURL=mesh.js.map