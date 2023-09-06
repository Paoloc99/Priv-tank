import { __decorate } from "../../../../tslib.es6.js";
import { NodeGeometryBlock } from "../../nodeGeometryBlock.js";
import { RegisterClass } from "../../../../Misc/typeStore.js";
import { NodeGeometryBlockConnectionPointTypes } from "../../Enums/nodeGeometryConnectionPointTypes.js";
import { Vector3 } from "../../../../Maths/math.vector.js";
import { PropertyTypeForEdition, editableInPropertyPage } from "../../../../Decorators/nodeDecorator.js";
/**
 * Block used to instance geometry on every face of a geometry
 */
export class InstantiateOnFacesBlock extends NodeGeometryBlock {
    /**
     * Create a new InstantiateOnFacesBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name);
        this._currentPosition = new Vector3();
        this._vertex0 = new Vector3();
        this._vertex1 = new Vector3();
        this._vertex2 = new Vector3();
        this._tempVector0 = new Vector3();
        this._tempVector1 = new Vector3();
        /**
         * Gets or sets a boolean indicating that this block can evaluate context
         * Build performance is improved when this value is set to false as the system will cache values instead of reevaluating everything per context change
         */
        this.evaluateContext = true;
        this.registerInput("geometry", NodeGeometryBlockConnectionPointTypes.Geometry);
        this.registerInput("instance", NodeGeometryBlockConnectionPointTypes.Geometry, true);
        this.registerInput("rotation", NodeGeometryBlockConnectionPointTypes.Vector3, true, Vector3.Zero());
        this.registerInput("scaling", NodeGeometryBlockConnectionPointTypes.Vector3, true, Vector3.One());
        this.registerInput("matrix", NodeGeometryBlockConnectionPointTypes.Matrix, true);
        this.registerInput("count", NodeGeometryBlockConnectionPointTypes.Int, true, 256);
        this.scaling.acceptedConnectionPointTypes.push(NodeGeometryBlockConnectionPointTypes.Float);
        this.registerOutput("output", NodeGeometryBlockConnectionPointTypes.Geometry);
    }
    /**
     * Gets the current index in the current flow
     * @returns the current index
     */
    getExecutionIndex() {
        return 0;
    }
    /**
     * Gets the current face index in the current flow
     * @returns the current face index
     */
    getExecutionFaceIndex() {
        return this._currentFaceIndex;
    }
    /**
     * Gets the current loop index in the current flow
     * @returns the current loop index
     */
    getExecutionLoopIndex() {
        return this._currentLoopIndex;
    }
    /**
     * Gets the value associated with a contextual positions
     * @returns the value associated with the source
     */
    getOverridePositionsContextualValue() {
        return this._currentPosition;
    }
    /**
     * Gets the value associated with a contextual normals
     * @returns the value associated with the source
     */
    getOverrideNormalsContextualValue() {
        this._vertex1.subtractToRef(this._vertex0, this._tempVector0);
        this._vertex2.subtractToRef(this._vertex1, this._tempVector1);
        this._tempVector0.normalize();
        this._tempVector1.normalize();
        return Vector3.Cross(this._tempVector1, this._tempVector0);
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "InstantiateOnFacesBlock";
    }
    /**
     * Gets the geometry input component
     */
    get geometry() {
        return this._inputs[0];
    }
    /**
     * Gets the instance input component
     */
    get instance() {
        return this._inputs[1];
    }
    /**
     * Gets the rotation input component
     */
    get rotation() {
        return this._inputs[2];
    }
    /**
     * Gets the scaling input component
     */
    get scaling() {
        return this._inputs[3];
    }
    /**
     * Gets the matrix input component
     */
    get matrix() {
        return this._inputs[4];
    }
    /**
     * Gets the count input component
     */
    get count() {
        return this._inputs[5];
    }
    /**
     * Gets the geometry output component
     */
    get output() {
        return this._outputs[0];
    }
    _buildBlock(state) {
        const func = (state) => {
            state.executionContext = this;
            this._vertexData = this.geometry.getConnectedValue(state);
            state.geometryContext = this._vertexData;
            if (!this._vertexData || !this._vertexData.positions || !this._vertexData.indices || !this.instance.isConnected) {
                state.executionContext = null;
                state.geometryContext = null;
                this.output._storedValue = null;
                return;
            }
            // Processing
            let instanceGeometry = null;
            const instanceCount = this.count.getConnectedValue(state);
            const faceCount = this._vertexData.indices.length / 3;
            const instancePerFace = instanceCount / faceCount;
            let accumulatedCount = 0;
            const additionalVertexData = [];
            let totalDone = 0;
            this._currentLoopIndex = 0;
            for (this._currentFaceIndex = 0; this._currentFaceIndex < faceCount; this._currentFaceIndex++) {
                // Extract face vertices
                this._vertex0.fromArray(this._vertexData.positions, this._vertexData.indices[this._currentFaceIndex * 3] * 3);
                this._vertex1.fromArray(this._vertexData.positions, this._vertexData.indices[this._currentFaceIndex * 3 + 1] * 3);
                this._vertex2.fromArray(this._vertexData.positions, this._vertexData.indices[this._currentFaceIndex * 3 + 2] * 3);
                accumulatedCount += instancePerFace;
                const countPerFace = (accumulatedCount | 0) - totalDone;
                if (countPerFace < 1) {
                    continue;
                }
                for (let faceDispatchCount = 0; faceDispatchCount < countPerFace; faceDispatchCount++) {
                    if (totalDone >= instanceCount) {
                        break;
                    }
                    // Get random point on face
                    let x = Math.random();
                    let y = Math.random();
                    if (x > y) {
                        const temp = x;
                        x = y;
                        y = temp;
                    }
                    const s = x;
                    const t = y - x;
                    const u = 1 - s - t;
                    this._currentPosition.set(s * this._vertex0.x + t * this._vertex1.x + u * this._vertex2.x, s * this._vertex0.y + t * this._vertex1.y + u * this._vertex2.y, s * this._vertex0.z + t * this._vertex1.z + u * this._vertex2.z);
                    // Clone the instance
                    instanceGeometry = this.instance.getConnectedValue(state);
                    if (!instanceGeometry || !instanceGeometry.positions || instanceGeometry.positions.length === 0) {
                        continue;
                    }
                    const clone = instanceGeometry.clone();
                    if (this.matrix.isConnected) {
                        const transform = this.matrix.getConnectedValue(state);
                        state._instantiateWithMatrix(clone, transform, additionalVertexData);
                    }
                    else {
                        const scaling = state.adaptInput(this.scaling, NodeGeometryBlockConnectionPointTypes.Vector3, Vector3.OneReadOnly);
                        const rotation = this.rotation.getConnectedValue(state) || Vector3.ZeroReadOnly;
                        state._instantiate(clone, this._currentPosition, rotation, scaling, additionalVertexData);
                    }
                    totalDone++;
                    this._currentLoopIndex++;
                }
            }
            // Merge
            if (additionalVertexData.length) {
                if (additionalVertexData.length === 1) {
                    this._vertexData = additionalVertexData[0];
                }
                else {
                    // We do not merge the main one as user can use a merge node if wanted
                    const main = additionalVertexData.splice(0, 1)[0];
                    this._vertexData = main.merge(additionalVertexData, true, false, true, true);
                }
            }
            return this._vertexData;
        };
        // Storage
        if (this.evaluateContext) {
            this.output._storedFunction = func;
        }
        else {
            this.output._storedValue = func(state);
        }
    }
    _dumpPropertiesCode() {
        const codeString = super._dumpPropertiesCode() + `${this._codeVariableName}.evaluateContext = ${this.evaluateContext ? "true" : "false"};\n`;
        return codeString;
    }
    /**
     * Serializes this block in a JSON representation
     * @returns the serialized block object
     */
    serialize() {
        const serializationObject = super.serialize();
        serializationObject.evaluateContext = this.evaluateContext;
        return serializationObject;
    }
    _deserialize(serializationObject) {
        super._deserialize(serializationObject);
        if (serializationObject.evaluateContext !== undefined) {
            this.evaluateContext = serializationObject.evaluateContext;
        }
    }
}
__decorate([
    editableInPropertyPage("Evaluate context", PropertyTypeForEdition.Boolean, "ADVANCED", { notifiers: { rebuild: true } })
], InstantiateOnFacesBlock.prototype, "evaluateContext", void 0);
RegisterClass("BABYLON.InstantiateOnFacesBlock", InstantiateOnFacesBlock);
//# sourceMappingURL=instantiateOnFacesBlock.js.map