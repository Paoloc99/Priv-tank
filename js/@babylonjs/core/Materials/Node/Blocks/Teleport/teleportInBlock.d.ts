import { NodeMaterialBlock } from "../../nodeMaterialBlock";
import type { NodeMaterialConnectionPoint } from "../../nodeMaterialBlockConnectionPoint";
import type { NodeMaterialTeleportOutBlock } from "./teleportOutBlock";
/**
 * Defines a block used to teleport a value to an endpoint
 */
export declare class NodeMaterialTeleportInBlock extends NodeMaterialBlock {
    private _endpoints;
    /** Gets the list of attached endpoints */
    get endpoints(): NodeMaterialTeleportOutBlock[];
    /**
     * Create a new NodeMaterialTeleportInBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets the input component
     */
    get input(): NodeMaterialConnectionPoint;
    /** Gets a boolean indicating that this connection will be used in the fragment shader */
    isConnectedInFragmentShader(): boolean;
    _dumpCode(uniqueNames: string[], alreadyDumped: NodeMaterialBlock[]): string;
    /**
     * Add an enpoint to this block
     * @param endpoint define the endpoint to attach to
     */
    attachToEndpoint(endpoint: NodeMaterialTeleportOutBlock): void;
    /**
     * Remove enpoint from this block
     * @param endpoint define the endpoint to remove
     */
    detachFromEndpoint(endpoint: NodeMaterialTeleportOutBlock): void;
    /**
     * Release resources
     */
    dispose(): void;
}