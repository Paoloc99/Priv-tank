import { NodeGeometryBlock } from "../../nodeGeometryBlock";
import type { NodeGeometryConnectionPoint } from "../../nodeGeometryBlockConnectionPoint";
import type { Mesh } from "../../../../Meshes/mesh";
import type { Nullable } from "../../../../types";
/**
 * Defines a block used to generate a user defined mesh geometry data
 */
export declare class MeshBlock extends NodeGeometryBlock {
    private _mesh;
    private _cachedVertexData;
    /**
     * Gets or sets the mesh to use to get vertex data
     */
    get mesh(): Nullable<Mesh>;
    set mesh(value: Nullable<Mesh>);
    /**
     * Create a new MeshBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets a boolean indicating if the block is using cached data
     */
    get isUsingCachedData(): boolean;
    /**
     * Gets the geometry output component
     */
    get geometry(): NodeGeometryConnectionPoint;
    protected _buildBlock(): void;
    /**
     * Serializes this block in a JSON representation
     * @param saveMeshData defines a boolean indicating that mesh data must be saved as well
     * @returns the serialized block object
     */
    serialize(saveMeshData?: boolean): any;
    _deserialize(serializationObject: any): void;
}