import { RegisterClass } from "../../../../Misc/typeStore.js";
import { NodeMaterialBlockConnectionPointTypes } from "../../Enums/nodeMaterialBlockConnectionPointTypes.js";
import { NodeMaterialBlockTargets } from "../../Enums/nodeMaterialBlockTargets.js";
import { NodeMaterialBlock } from "../../nodeMaterialBlock.js";
/**
 * Defines a block used to teleport a value to an endpoint
 */
export class NodeMaterialTeleportInBlock extends NodeMaterialBlock {
    /** Gets the list of attached endpoints */
    get endpoints() {
        return this._endpoints;
    }
    /**
     * Create a new NodeMaterialTeleportInBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name, NodeMaterialBlockTargets.Neutral);
        this._endpoints = [];
        this.registerInput("input", NodeMaterialBlockConnectionPointTypes.AutoDetect);
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "NodeMaterialTeleportInBlock";
    }
    /**
     * Gets the input component
     */
    get input() {
        return this._inputs[0];
    }
    /** Gets a boolean indicating that this connection will be used in the fragment shader */
    isConnectedInFragmentShader() {
        return this.endpoints.some((e) => e.output.isConnectedInFragmentShader);
    }
    _dumpCode(uniqueNames, alreadyDumped) {
        let codeString = super._dumpCode(uniqueNames, alreadyDumped);
        for (const endpoint of this.endpoints) {
            if (alreadyDumped.indexOf(endpoint) === -1) {
                codeString += endpoint._dumpCode(uniqueNames, alreadyDumped);
            }
        }
        return codeString;
    }
    /**
     * Add an enpoint to this block
     * @param endpoint define the endpoint to attach to
     */
    attachToEndpoint(endpoint) {
        endpoint.detach();
        this._endpoints.push(endpoint);
        endpoint._entryPoint = this;
        endpoint._outputs[0]._typeConnectionSource = this._inputs[0];
        endpoint._tempEntryPointUniqueId = null;
        endpoint.name = "> " + this.name;
    }
    /**
     * Remove enpoint from this block
     * @param endpoint define the endpoint to remove
     */
    detachFromEndpoint(endpoint) {
        const index = this._endpoints.indexOf(endpoint);
        if (index !== -1) {
            this._endpoints.splice(index, 1);
            endpoint._outputs[0]._typeConnectionSource = null;
            endpoint._entryPoint = null;
        }
    }
    /**
     * Release resources
     */
    dispose() {
        super.dispose();
        for (const endpoint of this._endpoints) {
            this.detachFromEndpoint(endpoint);
        }
        this._endpoints = [];
    }
}
RegisterClass("BABYLON.NodeMaterialTeleportInBlock", NodeMaterialTeleportInBlock);
//# sourceMappingURL=teleportInBlock.js.map