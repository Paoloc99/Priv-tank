import { RegisterClass } from "../../../Misc/typeStore.js";
import { NodeGeometryBlockConnectionPointTypes } from "../Enums/nodeGeometryConnectionPointTypes.js";
import { NodeGeometryBlock } from "../nodeGeometryBlock.js";
/**
 * Defines a block used to debug values going through it
 */
export class DebugBlock extends NodeGeometryBlock {
    /**
     * Create a new DebugBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name);
        /**
         * Gets the log entries
         */
        this.log = [];
        this.registerInput("input", NodeGeometryBlockConnectionPointTypes.AutoDetect);
        this.registerOutput("output", NodeGeometryBlockConnectionPointTypes.BasedOnInput);
        this._outputs[0]._typeConnectionSource = this._inputs[0];
        this._inputs[0].excludedConnectionPointTypes.push(NodeGeometryBlockConnectionPointTypes.Geometry);
    }
    /**
     * Gets the time spent to build this block (in ms)
     */
    get buildExecutionTime() {
        return 0;
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "DebugBlock";
    }
    /**
     * Gets the input component
     */
    get input() {
        return this._inputs[0];
    }
    /**
     * Gets the output component
     */
    get output() {
        return this._outputs[0];
    }
    _buildBlock() {
        if (!this.input.isConnected) {
            this.output._storedFunction = null;
            this.output._storedValue = null;
            return;
        }
        this.log = [];
        this.output._storedFunction = (state) => {
            const input = this.input.getConnectedValue(state);
            this.log.push(input !== undefined && input !== null ? input.toString() : "null");
            return input;
        };
    }
}
RegisterClass("BABYLON.DebugBlock", DebugBlock);
//# sourceMappingURL=debugBlock.js.map