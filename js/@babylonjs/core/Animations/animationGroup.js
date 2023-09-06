import { Animation } from "./animation.js";
import { Observable } from "../Misc/observable.js";
import { EngineStore } from "../Engines/engineStore.js";
import { Tags } from "../Misc/tags.js";
/**
 * This class defines the direct association between an animation and a target
 */
export class TargetedAnimation {
    /**
     * Returns the string "TargetedAnimation"
     * @returns "TargetedAnimation"
     */
    getClassName() {
        return "TargetedAnimation";
    }
    /**
     * Serialize the object
     * @returns the JSON object representing the current entity
     */
    serialize() {
        const serializationObject = {};
        serializationObject.animation = this.animation.serialize();
        serializationObject.targetId = this.target.id;
        return serializationObject;
    }
}
/**
 * Use this class to create coordinated animations on multiple targets
 */
export class AnimationGroup {
    /**
     * Makes sure that the animations are either played or stopped according to the animation group mask.
     * Note however that the call won't have any effect if the animation group has not been started yet.
     * You should call this function if you modify the mask after the animation group has been started.
     */
    syncWithMask() {
        if (!this.mask) {
            return;
        }
        for (let i = 0; i < this._animatables.length; ++i) {
            const animatable = this._animatables[i];
            if (this.mask.retainsTarget(animatable.target.name)) {
                if (animatable.paused) {
                    animatable.restart();
                }
            }
            else {
                if (!animatable.paused) {
                    animatable.pause();
                }
            }
        }
    }
    /**
     * Removes all animations for the targets not retained by the animation group mask.
     * Use this function if you know you won't need those animations anymore and if you want to free memory.
     */
    removeUnmaskedAnimations() {
        if (!this.mask) {
            return;
        }
        // Removes all animatables (in case the animation group has already been started)
        for (let i = 0; i < this._animatables.length; ++i) {
            const animatable = this._animatables[i];
            if (!this.mask.retainsTarget(animatable.target.name)) {
                animatable.stop();
                this._animatables.splice(i, 1);
                --i;
            }
        }
        // Removes the targeted animations
        for (let index = 0; index < this._targetedAnimations.length; index++) {
            const targetedAnimation = this._targetedAnimations[index];
            if (!this.mask.retainsTarget(targetedAnimation.target.name)) {
                this._targetedAnimations.splice(index, 1);
                --index;
            }
        }
    }
    /**
     * Gets the first frame
     */
    get from() {
        return this._from;
    }
    /**
     * Gets the last frame
     */
    get to() {
        return this._to;
    }
    /**
     * Define if the animations are started
     */
    get isStarted() {
        return this._isStarted;
    }
    /**
     * Gets a value indicating that the current group is playing
     */
    get isPlaying() {
        return this._isStarted && !this._isPaused;
    }
    /**
     * Gets or sets the speed ratio to use for all animations
     */
    get speedRatio() {
        return this._speedRatio;
    }
    /**
     * Gets or sets the speed ratio to use for all animations
     */
    set speedRatio(value) {
        if (this._speedRatio === value) {
            return;
        }
        this._speedRatio = value;
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.speedRatio = this._speedRatio;
        }
    }
    /**
     * Gets or sets if all animations should loop or not
     */
    get loopAnimation() {
        return this._loopAnimation;
    }
    set loopAnimation(value) {
        if (this._loopAnimation === value) {
            return;
        }
        this._loopAnimation = value;
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.loopAnimation = this._loopAnimation;
        }
    }
    /**
     * Gets or sets if all animations should be evaluated additively
     */
    get isAdditive() {
        return this._isAdditive;
    }
    set isAdditive(value) {
        if (this._isAdditive === value) {
            return;
        }
        this._isAdditive = value;
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.isAdditive = this._isAdditive;
        }
    }
    /**
     * Gets or sets the weight to apply to all animations of the group
     */
    get weight() {
        return this._weight;
    }
    set weight(value) {
        if (this._weight === value) {
            return;
        }
        this._weight = value;
        this.setWeightForAllAnimatables(this._weight);
    }
    /**
     * Gets the targeted animations for this animation group
     */
    get targetedAnimations() {
        return this._targetedAnimations;
    }
    /**
     * returning the list of animatables controlled by this animation group.
     */
    get animatables() {
        return this._animatables;
    }
    /**
     * Gets the list of target animations
     */
    get children() {
        return this._targetedAnimations;
    }
    /**
     * Gets or sets the order of play of the animation group (default: 0)
     */
    get playOrder() {
        return this._playOrder;
    }
    set playOrder(value) {
        if (this._playOrder === value) {
            return;
        }
        this._playOrder = value;
        if (this._animatables.length > 0) {
            for (let i = 0; i < this._animatables.length; i++) {
                this._animatables[i].playOrder = this._playOrder;
            }
            this._scene.sortActiveAnimatables();
        }
    }
    /**
     * Allows the animations of the animation group to blend with current running animations
     * Note that a null value means that each animation will use their own existing blending configuration (Animation.enableBlending)
     */
    get enableBlending() {
        return this._enableBlending;
    }
    set enableBlending(value) {
        if (this._enableBlending === value) {
            return;
        }
        this._enableBlending = value;
        if (value !== null) {
            for (let i = 0; i < this._targetedAnimations.length; ++i) {
                this._targetedAnimations[i].animation.enableBlending = value;
            }
        }
    }
    /**
     * Gets or sets the animation blending speed
     * Note that a null value means that each animation will use their own existing blending configuration (Animation.blendingSpeed)
     */
    get blendingSpeed() {
        return this._blendingSpeed;
    }
    set blendingSpeed(value) {
        if (this._blendingSpeed === value) {
            return;
        }
        this._blendingSpeed = value;
        if (value !== null) {
            for (let i = 0; i < this._targetedAnimations.length; ++i) {
                this._targetedAnimations[i].animation.blendingSpeed = value;
            }
        }
    }
    /**
     * Merge the array of animation groups into a new animation group
     * @param animationGroups List of animation groups to merge
     * @param disposeSource If true, animation groups will be disposed after being merged (default: true)
     * @param normalize If true, animation groups will be normalized before being merged, so that all animations have the same "from" and "to" frame (default: false)
     * @param weight Weight for the new animation group. If not provided, it will inherit the weight from the first animation group of the array
     * @returns The new animation group or null if no animation groups were passed
     */
    static MergeAnimationGroups(animationGroups, disposeSource = true, normalize = false, weight) {
        if (animationGroups.length === 0) {
            return null;
        }
        weight = weight !== null && weight !== void 0 ? weight : animationGroups[0].weight;
        let beginFrame = Number.MAX_VALUE;
        let endFrame = -Number.MAX_VALUE;
        if (normalize) {
            for (const animationGroup of animationGroups) {
                if (animationGroup.from < beginFrame) {
                    beginFrame = animationGroup.from;
                }
                if (animationGroup.to > endFrame) {
                    endFrame = animationGroup.to;
                }
            }
        }
        const mergedAnimationGroup = new AnimationGroup(animationGroups[0].name + "_merged", animationGroups[0]._scene, weight);
        for (const animationGroup of animationGroups) {
            if (normalize) {
                animationGroup.normalize(beginFrame, endFrame);
            }
            for (const targetedAnimation of animationGroup.targetedAnimations) {
                mergedAnimationGroup.addTargetedAnimation(targetedAnimation.animation, targetedAnimation.target);
            }
            if (disposeSource) {
                animationGroup.dispose();
            }
        }
        return mergedAnimationGroup;
    }
    /**
     * Instantiates a new Animation Group.
     * This helps managing several animations at once.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations
     * @param name Defines the name of the group
     * @param scene Defines the scene the group belongs to
     * @param weight Defines the weight to use for animations in the group (-1.0 by default, meaning "no weight")
     * @param playOrder Defines the order of play of the animation group (default is 0)
     */
    constructor(
    /** The name of the animation group */
    name, scene = null, weight = -1, playOrder = 0) {
        this.name = name;
        this._targetedAnimations = new Array();
        this._animatables = new Array();
        this._from = Number.MAX_VALUE;
        this._to = -Number.MAX_VALUE;
        this._speedRatio = 1;
        this._loopAnimation = false;
        this._isAdditive = false;
        this._weight = -1;
        this._playOrder = 0;
        this._enableBlending = null;
        this._blendingSpeed = null;
        /** @internal */
        this._parentContainer = null;
        /**
         * This observable will notify when one animation have ended
         */
        this.onAnimationEndObservable = new Observable();
        /**
         * Observer raised when one animation loops
         */
        this.onAnimationLoopObservable = new Observable();
        /**
         * Observer raised when all animations have looped
         */
        this.onAnimationGroupLoopObservable = new Observable();
        /**
         * This observable will notify when all animations have ended.
         */
        this.onAnimationGroupEndObservable = new Observable();
        /**
         * This observable will notify when all animations have paused.
         */
        this.onAnimationGroupPauseObservable = new Observable();
        /**
         * This observable will notify when all animations are playing.
         */
        this.onAnimationGroupPlayObservable = new Observable();
        /**
         * Gets or sets an object used to store user defined information for the node
         */
        this.metadata = null;
        this._animationLoopFlags = [];
        this._scene = scene || EngineStore.LastCreatedScene;
        this._weight = weight;
        this._playOrder = playOrder;
        this.uniqueId = this._scene.getUniqueId();
        this._scene.addAnimationGroup(this);
    }
    /**
     * Add an animation (with its target) in the group
     * @param animation defines the animation we want to add
     * @param target defines the target of the animation
     * @returns the TargetedAnimation object
     */
    addTargetedAnimation(animation, target) {
        const targetedAnimation = new TargetedAnimation();
        targetedAnimation.animation = animation;
        targetedAnimation.target = target;
        const keys = animation.getKeys();
        if (this._from > keys[0].frame) {
            this._from = keys[0].frame;
        }
        if (this._to < keys[keys.length - 1].frame) {
            this._to = keys[keys.length - 1].frame;
        }
        if (this._enableBlending !== null) {
            animation.enableBlending = this._enableBlending;
        }
        if (this._blendingSpeed !== null) {
            animation.blendingSpeed = this._blendingSpeed;
        }
        this._targetedAnimations.push(targetedAnimation);
        return targetedAnimation;
    }
    /**
     * Remove an animation from the group
     * @param animation defines the animation we want to remove
     */
    removeTargetedAnimation(animation) {
        for (let index = this._targetedAnimations.length - 1; index > -1; index--) {
            const targetedAnimation = this._targetedAnimations[index];
            if (targetedAnimation.animation === animation) {
                this._targetedAnimations.splice(index, 1);
            }
        }
    }
    /**
     * This function will normalize every animation in the group to make sure they all go from beginFrame to endFrame
     * It can add constant keys at begin or end
     * @param beginFrame defines the new begin frame for all animations or the smallest begin frame of all animations if null (defaults to null)
     * @param endFrame defines the new end frame for all animations or the largest end frame of all animations if null (defaults to null)
     * @returns the animation group
     */
    normalize(beginFrame = null, endFrame = null) {
        if (beginFrame == null) {
            beginFrame = this._from;
        }
        if (endFrame == null) {
            endFrame = this._to;
        }
        for (let index = 0; index < this._targetedAnimations.length; index++) {
            const targetedAnimation = this._targetedAnimations[index];
            const keys = targetedAnimation.animation.getKeys();
            const startKey = keys[0];
            const endKey = keys[keys.length - 1];
            if (startKey.frame > beginFrame) {
                const newKey = {
                    frame: beginFrame,
                    value: startKey.value,
                    inTangent: startKey.inTangent,
                    outTangent: startKey.outTangent,
                    interpolation: startKey.interpolation,
                };
                keys.splice(0, 0, newKey);
            }
            if (endKey.frame < endFrame) {
                const newKey = {
                    frame: endFrame,
                    value: endKey.value,
                    inTangent: endKey.inTangent,
                    outTangent: endKey.outTangent,
                    interpolation: endKey.interpolation,
                };
                keys.push(newKey);
            }
        }
        this._from = beginFrame;
        this._to = endFrame;
        return this;
    }
    _processLoop(animatable, targetedAnimation, index) {
        animatable.onAnimationLoop = () => {
            this.onAnimationLoopObservable.notifyObservers(targetedAnimation);
            if (this._animationLoopFlags[index]) {
                return;
            }
            this._animationLoopFlags[index] = true;
            this._animationLoopCount++;
            if (this._animationLoopCount === this._targetedAnimations.length) {
                this.onAnimationGroupLoopObservable.notifyObservers(this);
                this._animationLoopCount = 0;
                this._animationLoopFlags.length = 0;
            }
        };
    }
    /**
     * Start all animations on given targets
     * @param loop defines if animations must loop
     * @param speedRatio defines the ratio to apply to animation speed (1 by default)
     * @param from defines the from key (optional)
     * @param to defines the to key (optional)
     * @param isAdditive defines the additive state for the resulting animatables (optional)
     * @returns the current animation group
     */
    start(loop = false, speedRatio = 1, from, to, isAdditive) {
        if (this._isStarted || this._targetedAnimations.length === 0) {
            return this;
        }
        this._loopAnimation = loop;
        this._animationLoopCount = 0;
        this._animationLoopFlags.length = 0;
        for (let index = 0; index < this._targetedAnimations.length; index++) {
            const targetedAnimation = this._targetedAnimations[index];
            const animatable = this._scene.beginDirectAnimation(targetedAnimation.target, [targetedAnimation.animation], from !== undefined ? from : this._from, to !== undefined ? to : this._to, loop, speedRatio, undefined, undefined, isAdditive !== undefined ? isAdditive : this._isAdditive);
            animatable.weight = this._weight;
            animatable.playOrder = this._playOrder;
            animatable.onAnimationEnd = () => {
                this.onAnimationEndObservable.notifyObservers(targetedAnimation);
                this._checkAnimationGroupEnded(animatable);
            };
            this._processLoop(animatable, targetedAnimation, index);
            this._animatables.push(animatable);
        }
        this.syncWithMask();
        this._scene.sortActiveAnimatables();
        this._speedRatio = speedRatio;
        this._isStarted = true;
        this._isPaused = false;
        this.onAnimationGroupPlayObservable.notifyObservers(this);
        return this;
    }
    /**
     * Pause all animations
     * @returns the animation group
     */
    pause() {
        if (!this._isStarted) {
            return this;
        }
        this._isPaused = true;
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.pause();
        }
        this.onAnimationGroupPauseObservable.notifyObservers(this);
        return this;
    }
    /**
     * Play all animations to initial state
     * This function will start() the animations if they were not started or will restart() them if they were paused
     * @param loop defines if animations must loop
     * @returns the animation group
     */
    play(loop) {
        // only if all animatables are ready and exist
        if (this.isStarted && this._animatables.length === this._targetedAnimations.length) {
            if (loop !== undefined) {
                this.loopAnimation = loop;
            }
            this.restart();
        }
        else {
            this.stop();
            this.start(loop, this._speedRatio);
        }
        this._isPaused = false;
        return this;
    }
    /**
     * Reset all animations to initial state
     * @returns the animation group
     */
    reset() {
        if (!this._isStarted) {
            this.play();
            this.goToFrame(0);
            this.stop();
            return this;
        }
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.reset();
        }
        return this;
    }
    /**
     * Restart animations from key 0
     * @returns the animation group
     */
    restart() {
        if (!this._isStarted) {
            return this;
        }
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.restart();
        }
        this.onAnimationGroupPlayObservable.notifyObservers(this);
        return this;
    }
    /**
     * Stop all animations
     * @returns the animation group
     */
    stop() {
        if (!this._isStarted) {
            return this;
        }
        const list = this._animatables.slice();
        for (let index = 0; index < list.length; index++) {
            list[index].stop(undefined, undefined, true);
        }
        // We will take care of removing all stopped animatables
        let curIndex = 0;
        for (let index = 0; index < this._scene._activeAnimatables.length; index++) {
            const animatable = this._scene._activeAnimatables[index];
            if (animatable._runtimeAnimations.length > 0) {
                this._scene._activeAnimatables[curIndex++] = animatable;
            }
        }
        this._scene._activeAnimatables.length = curIndex;
        this._isStarted = false;
        return this;
    }
    /**
     * Set animation weight for all animatables
     *
     * @since 6.12.4
     *  You can pass the weight to the AnimationGroup constructor, or use the weight property to set it after the group has been created,
     *  making it easier to define the overall animation weight than calling setWeightForAllAnimatables() after the animation group has been started
     * @param weight defines the weight to use
     * @returns the animationGroup
     * @see https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations#animation-weights
     */
    setWeightForAllAnimatables(weight) {
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.weight = weight;
        }
        return this;
    }
    /**
     * Synchronize and normalize all animatables with a source animatable
     * @param root defines the root animatable to synchronize with (null to stop synchronizing)
     * @returns the animationGroup
     * @see https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations#animation-weights
     */
    syncAllAnimationsWith(root) {
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.syncWith(root);
        }
        return this;
    }
    /**
     * Goes to a specific frame in this animation group
     * @param frame the frame number to go to
     * @returns the animationGroup
     */
    goToFrame(frame) {
        if (!this._isStarted) {
            return this;
        }
        for (let index = 0; index < this._animatables.length; index++) {
            const animatable = this._animatables[index];
            animatable.goToFrame(frame);
        }
        return this;
    }
    /**
     * Dispose all associated resources
     */
    dispose() {
        this._targetedAnimations.length = 0;
        this._animatables.length = 0;
        // Remove from scene
        const index = this._scene.animationGroups.indexOf(this);
        if (index > -1) {
            this._scene.animationGroups.splice(index, 1);
        }
        if (this._parentContainer) {
            const index = this._parentContainer.animationGroups.indexOf(this);
            if (index > -1) {
                this._parentContainer.animationGroups.splice(index, 1);
            }
            this._parentContainer = null;
        }
        this.onAnimationEndObservable.clear();
        this.onAnimationGroupEndObservable.clear();
        this.onAnimationGroupPauseObservable.clear();
        this.onAnimationGroupPlayObservable.clear();
        this.onAnimationLoopObservable.clear();
        this.onAnimationGroupLoopObservable.clear();
    }
    _checkAnimationGroupEnded(animatable) {
        // animatable should be taken out of the array
        const idx = this._animatables.indexOf(animatable);
        if (idx > -1) {
            this._animatables.splice(idx, 1);
        }
        // all animatables were removed? animation group ended!
        if (this._animatables.length === 0) {
            this._isStarted = false;
            this.onAnimationGroupEndObservable.notifyObservers(this);
        }
    }
    /**
     * Clone the current animation group and returns a copy
     * @param newName defines the name of the new group
     * @param targetConverter defines an optional function used to convert current animation targets to new ones
     * @param cloneAnimations defines if the animations should be cloned or referenced
     * @returns the new animation group
     */
    clone(newName, targetConverter, cloneAnimations = false) {
        const newGroup = new AnimationGroup(newName || this.name, this._scene);
        for (const targetAnimation of this._targetedAnimations) {
            newGroup.addTargetedAnimation(cloneAnimations ? targetAnimation.animation.clone() : targetAnimation.animation, targetConverter ? targetConverter(targetAnimation.target) : targetAnimation.target);
        }
        return newGroup;
    }
    /**
     * Serializes the animationGroup to an object
     * @returns Serialized object
     */
    serialize() {
        const serializationObject = {};
        serializationObject.name = this.name;
        serializationObject.from = this.from;
        serializationObject.to = this.to;
        serializationObject.targetedAnimations = [];
        for (let targetedAnimationIndex = 0; targetedAnimationIndex < this.targetedAnimations.length; targetedAnimationIndex++) {
            const targetedAnimation = this.targetedAnimations[targetedAnimationIndex];
            serializationObject.targetedAnimations[targetedAnimationIndex] = targetedAnimation.serialize();
        }
        if (Tags && Tags.HasTags(this)) {
            serializationObject.tags = Tags.GetTags(this);
        }
        // Metadata
        if (this.metadata) {
            serializationObject.metadata = this.metadata;
        }
        return serializationObject;
    }
    // Statics
    /**
     * Returns a new AnimationGroup object parsed from the source provided.
     * @param parsedAnimationGroup defines the source
     * @param scene defines the scene that will receive the animationGroup
     * @returns a new AnimationGroup
     */
    static Parse(parsedAnimationGroup, scene) {
        const animationGroup = new AnimationGroup(parsedAnimationGroup.name, scene);
        for (let i = 0; i < parsedAnimationGroup.targetedAnimations.length; i++) {
            const targetedAnimation = parsedAnimationGroup.targetedAnimations[i];
            const animation = Animation.Parse(targetedAnimation.animation);
            const id = targetedAnimation.targetId;
            if (targetedAnimation.animation.property === "influence") {
                // morph target animation
                const morphTarget = scene.getMorphTargetById(id);
                if (morphTarget) {
                    animationGroup.addTargetedAnimation(animation, morphTarget);
                }
            }
            else {
                const targetNode = scene.getNodeById(id);
                if (targetNode != null) {
                    animationGroup.addTargetedAnimation(animation, targetNode);
                }
            }
        }
        if (parsedAnimationGroup.from !== null && parsedAnimationGroup.to !== null) {
            animationGroup.normalize(parsedAnimationGroup.from, parsedAnimationGroup.to);
        }
        if (Tags) {
            Tags.AddTagsTo(animationGroup, parsedAnimationGroup.tags);
        }
        if (parsedAnimationGroup.metadata !== undefined) {
            animationGroup.metadata = parsedAnimationGroup.metadata;
        }
        return animationGroup;
    }
    /**
     * Convert the keyframes for all animations belonging to the group to be relative to a given reference frame.
     * @param sourceAnimationGroup defines the AnimationGroup containing animations to convert
     * @param referenceFrame defines the frame that keyframes in the range will be relative to
     * @param range defines the name of the AnimationRange belonging to the animations in the group to convert
     * @param cloneOriginal defines whether or not to clone the group and convert the clone or convert the original group (default is false)
     * @param clonedName defines the name of the resulting cloned AnimationGroup if cloneOriginal is true
     * @returns a new AnimationGroup if cloneOriginal is true or the original AnimationGroup if cloneOriginal is false
     */
    static MakeAnimationAdditive(sourceAnimationGroup, referenceFrame = 0, range, cloneOriginal = false, clonedName) {
        let animationGroup = sourceAnimationGroup;
        if (cloneOriginal) {
            animationGroup = sourceAnimationGroup.clone(clonedName || animationGroup.name);
        }
        const targetedAnimations = animationGroup.targetedAnimations;
        for (let index = 0; index < targetedAnimations.length; index++) {
            const targetedAnimation = targetedAnimations[index];
            Animation.MakeAnimationAdditive(targetedAnimation.animation, referenceFrame, range);
        }
        animationGroup.isAdditive = true;
        return animationGroup;
    }
    /**
     * Creates a new animation, keeping only the keys that are inside a given range
     * @param animationGroup defines the animation group on which to operate
     * @param fromKey defines the lower bound of the range
     * @param toKey defines the upper bound of the range
     * @param name defines the name of the new animation group. If not provided, use the same name as animationGroup
     * @returns a new animation group stripped from all the keys outside the given range
     */
    static ClipKeys(sourceAnimationGroup, fromKey, toKey, name) {
        const animationGroup = sourceAnimationGroup.clone(name || sourceAnimationGroup.name);
        return this.ClipKeysInPlace(animationGroup, fromKey, toKey);
    }
    /**
     * Updates an existing animation, keeping only the keys that are inside a given range
     * @param animationGroup defines the animation group on which to operate
     * @param fromKey defines the lower bound of the range
     * @param toKey defines the upper bound of the range
     * @returns the source animationGroup stripped from all the keys outside the given range
     */
    static ClipKeysInPlace(animationGroup, fromKey, toKey) {
        let from = Number.MAX_VALUE;
        let to = -Number.MAX_VALUE;
        const targetedAnimations = animationGroup.targetedAnimations;
        for (let index = 0; index < targetedAnimations.length; index++) {
            const targetedAnimation = targetedAnimations[index];
            const animation = targetedAnimation.animation.clone();
            const keys = animation.getKeys();
            const newKeys = [];
            let startFrame = Number.MAX_VALUE;
            for (let k = 0; k < keys.length; k++) {
                if (k >= fromKey && k <= toKey) {
                    const key = keys[k];
                    const newKey = {
                        frame: key.frame,
                        value: key.value,
                        inTangent: key.inTangent,
                        outTangent: key.outTangent,
                        interpolation: key.interpolation,
                        lockedTangent: key.lockedTangent,
                    };
                    if (startFrame === Number.MAX_VALUE) {
                        startFrame = newKey.frame;
                    }
                    newKey.frame -= startFrame;
                    newKeys.push(newKey);
                }
            }
            if (newKeys.length === 0) {
                targetedAnimations.splice(index, 1);
                index--;
                continue;
            }
            if (from > newKeys[0].frame) {
                from = newKeys[0].frame;
            }
            if (to < newKeys[newKeys.length - 1].frame) {
                to = newKeys[newKeys.length - 1].frame;
            }
            animation.setKeys(newKeys, true);
            targetedAnimation.animation = animation;
        }
        animationGroup._from = from;
        animationGroup._to = to;
        return animationGroup;
    }
    /**
     * Returns the string "AnimationGroup"
     * @returns "AnimationGroup"
     */
    getClassName() {
        return "AnimationGroup";
    }
    /**
     * Creates a detailed string about the object
     * @param fullDetails defines if the output string will support multiple levels of logging within scene loading
     * @returns a string representing the object
     */
    toString(fullDetails) {
        let ret = "Name: " + this.name;
        ret += ", type: " + this.getClassName();
        if (fullDetails) {
            ret += ", from: " + this._from;
            ret += ", to: " + this._to;
            ret += ", isStarted: " + this._isStarted;
            ret += ", speedRatio: " + this._speedRatio;
            ret += ", targetedAnimations length: " + this._targetedAnimations.length;
            ret += ", animatables length: " + this._animatables;
        }
        return ret;
    }
}
//# sourceMappingURL=animationGroup.js.map