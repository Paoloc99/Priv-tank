import { NodeGeometryBlockConnectionPointTypes } from "../../Enums/nodeGeometryConnectionPointTypes.js";
import { NodeGeometryBlock } from "../../nodeGeometryBlock.js";
import { RegisterClass } from "../../../../Misc/typeStore.js";
import { VertexData } from "../../../../Meshes/mesh.vertexData.js";
/**
 * Defines a block used to generate a user defined mesh geometry data
 */
export class MeshBlock extends NodeGeometryBlock {
    /**
     * Gets or sets the mesh to use to get vertex data
     */
    get mesh() {
        return this._mesh;
    }
    set mesh(value) {
        this._mesh = value;
    }
    /**
     * Create a new MeshBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name);
        this._cachedVertexData = null;
        this.registerOutput("geometry", NodeGeometryBlockConnectionPointTypes.Geometry);
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "MeshBlock";
    }
    /**
     * Gets a boolean indicating if the block is using cached data
     */
    get isUsingCachedData() {
        return !this.mesh && !!this._cachedVertexData;
    }
    /**
     * Gets the geometry output component
     */
    get geometry() {
        return this._outputs[0];
    }
    _buildBlock() {
        if (!this._mesh) {
            if (this._cachedVertexData) {
                this.geometry._storedValue = this._cachedVertexData.clone();
            }
            else {
                this.geometry._storedValue = null;
            }
            return;
        }
        this.geometry._storedValue = VertexData.ExtractFromMesh(this._mesh, false, true);
        this._cachedVertexData = null;
    }
    /**
     * Serializes this block in a JSON representation
     * @param saveMeshData defines a boolean indicating that mesh data must be saved as well
     * @returns the serialized block object
     */
    serialize(saveMeshData) {
        const serializationObject = super.serialize();
        if (saveMeshData) {
            if (this._mesh) {
                serializationObject.cachedVertexData = VertexData.ExtractFromMesh(this._mesh, false, true).serialize();
            }
            else if (this._cachedVertexData) {
                serializationObject.cachedVertexData = this._cachedVertexData.serialize();
            }
        }
        return serializationObject;
    }
    _deserialize(serializationObject) {
        super._deserialize(serializationObject);
        if (serializationObject.cachedVertexData) {
            this._cachedVertexData = VertexData.Parse(serializationObject.cachedVertexData);
        }
    }
}
RegisterClass("BABYLON.MeshBlock", MeshBlock);
//# sourceMappingURL=meshBlock.js.map