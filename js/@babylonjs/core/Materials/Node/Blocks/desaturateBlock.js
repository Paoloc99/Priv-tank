import { NodeMaterialBlock } from "../nodeMaterialBlock.js";
import { NodeMaterialBlockConnectionPointTypes } from "../Enums/nodeMaterialBlockConnectionPointTypes.js";
import { NodeMaterialBlockTargets } from "../Enums/nodeMaterialBlockTargets.js";
import { RegisterClass } from "../../../Misc/typeStore.js";
/**
 * Block used to desaturate a color
 */
export class DesaturateBlock extends NodeMaterialBlock {
    /**
     * Creates a new DesaturateBlock
     * @param name defines the block name
     */
    constructor(name) {
        super(name, NodeMaterialBlockTargets.Neutral);
        this.registerInput("color", NodeMaterialBlockConnectionPointTypes.Color3);
        this.registerInput("level", NodeMaterialBlockConnectionPointTypes.Float);
        this.registerOutput("output", NodeMaterialBlockConnectionPointTypes.Color3);
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "DesaturateBlock";
    }
    /**
     * Gets the color operand input component
     */
    get color() {
        return this._inputs[0];
    }
    /**
     * Gets the level operand input component
     */
    get level() {
        return this._inputs[1];
    }
    /**
     * Gets the output component
     */
    get output() {
        return this._outputs[0];
    }
    _buildBlock(state) {
        super._buildBlock(state);
        const output = this._outputs[0];
        const color = this.color;
        const colorName = color.associatedVariableName;
        const tempMin = state._getFreeVariableName("colorMin");
        const tempMax = state._getFreeVariableName("colorMax");
        const tempMerge = state._getFreeVariableName("colorMerge");
        state.compilationString += `float ${tempMin} = min(min(${colorName}.x, ${colorName}.y), ${colorName}.z);\n`;
        state.compilationString += `float ${tempMax} = max(max(${colorName}.x, ${colorName}.y), ${colorName}.z);\n`;
        state.compilationString += `float ${tempMerge} = 0.5 * (${tempMin} + ${tempMax});\n`;
        state.compilationString +=
            this._declareOutput(output, state) + ` = mix(${colorName}, vec3(${tempMerge}, ${tempMerge}, ${tempMerge}), ${this.level.associatedVariableName});\n`;
        return this;
    }
}
RegisterClass("BABYLON.DesaturateBlock", DesaturateBlock);
//# sourceMappingURL=desaturateBlock.js.map