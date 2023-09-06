import { NodeGeometryBlock } from "../../nodeGeometryBlock.js";
import { RegisterClass } from "../../../../Misc/typeStore.js";
import { NodeGeometryBlockConnectionPointTypes } from "../../Enums/nodeGeometryConnectionPointTypes.js";
/**
 * Block used to set normals for a geometry
 */
export class SetNormalsBlock extends NodeGeometryBlock {
    /**
     * Create a new SetNormalsBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name);
        this.registerInput("geometry", NodeGeometryBlockConnectionPointTypes.Geometry);
        this.registerInput("normals", NodeGeometryBlockConnectionPointTypes.Vector3);
        this.registerOutput("output", NodeGeometryBlockConnectionPointTypes.Geometry);
    }
    /**
     * Gets the current index in the current flow
     * @returns the current index
     */
    getExecutionIndex() {
        return this._currentIndex;
    }
    /**
     * Gets the current loop index in the current flow
     * @returns the current loop index
     */
    getExecutionLoopIndex() {
        return this._currentIndex;
    }
    /**
     * Gets the current face index in the current flow
     * @returns the current face index
     */
    getExecutionFaceIndex() {
        return 0;
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "SetNormalsBlock";
    }
    /**
     * Gets the geometry input component
     */
    get geometry() {
        return this._inputs[0];
    }
    /**
     * Gets the normals input component
     */
    get normals() {
        return this._inputs[1];
    }
    /**
     * Gets the geometry output component
     */
    get output() {
        return this._outputs[0];
    }
    _buildBlock(state) {
        state.executionContext = this;
        this._vertexData = this.geometry.getConnectedValue(state);
        state.geometryContext = this._vertexData;
        if (!this._vertexData || !this._vertexData.positions) {
            state.executionContext = null;
            state.geometryContext = null;
            this.output._storedValue = null;
            return;
        }
        if (!this.normals.isConnected) {
            state.executionContext = null;
            state.geometryContext = null;
            this.output._storedValue = this._vertexData;
            return;
        }
        if (!this._vertexData.normals) {
            this._vertexData.normals = [];
        }
        // Processing
        const vertexCount = this._vertexData.positions.length / 3;
        for (this._currentIndex = 0; this._currentIndex < vertexCount; this._currentIndex++) {
            const tempVector3 = this.normals.getConnectedValue(state);
            if (tempVector3) {
                tempVector3.toArray(this._vertexData.normals, this._currentIndex * 3);
            }
        }
        // Storage
        this.output._storedValue = this._vertexData;
        state.executionContext = null;
        state.geometryContext = null;
    }
}
RegisterClass("BABYLON.SetNormalsBlock", SetNormalsBlock);
//# sourceMappingURL=setNormalsBlock.js.map