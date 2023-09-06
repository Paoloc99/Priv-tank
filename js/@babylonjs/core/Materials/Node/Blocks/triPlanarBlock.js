import { __decorate } from "../../../tslib.es6.js";
import { NodeMaterialBlock } from "../nodeMaterialBlock.js";
import { NodeMaterialBlockConnectionPointTypes } from "../Enums/nodeMaterialBlockConnectionPointTypes.js";
import { NodeMaterialBlockTargets } from "../Enums/nodeMaterialBlockTargets.js";
import { NodeMaterialConnectionPointDirection } from "../nodeMaterialBlockConnectionPoint.js";
import { NodeMaterial } from "../nodeMaterial.js";
import { RegisterClass } from "../../../Misc/typeStore.js";
import { Texture } from "../../Textures/texture.js";

import "../../../Shaders/ShadersInclude/helperFunctions.js";
import { ImageSourceBlock } from "./Dual/imageSourceBlock.js";
import { NodeMaterialConnectionPointCustomObject } from "../nodeMaterialConnectionPointCustomObject.js";
import { EngineStore } from "../../../Engines/engineStore.js";
import { editableInPropertyPage, PropertyTypeForEdition } from "../../../Decorators/nodeDecorator.js";
/**
 * Block used to read a texture with triplanar mapping (see "boxmap" in https://iquilezles.org/articles/biplanar/)
 */
export class TriPlanarBlock extends NodeMaterialBlock {
    /**
     * Gets or sets the texture associated with the node
     */
    get texture() {
        var _a;
        if (this.source.isConnected) {
            return ((_a = this.source.connectedPoint) === null || _a === void 0 ? void 0 : _a.ownerBlock).texture;
        }
        return this._texture;
    }
    set texture(texture) {
        var _a;
        if (this._texture === texture) {
            return;
        }
        const scene = (_a = texture === null || texture === void 0 ? void 0 : texture.getScene()) !== null && _a !== void 0 ? _a : EngineStore.LastCreatedScene;
        if (!texture && scene) {
            scene.markAllMaterialsAsDirty(1, (mat) => {
                return mat.hasTexture(this._texture);
            });
        }
        this._texture = texture;
        if (texture && scene) {
            scene.markAllMaterialsAsDirty(1, (mat) => {
                return mat.hasTexture(texture);
            });
        }
    }
    /**
     * Gets the textureY associated with the node
     */
    get textureY() {
        var _a;
        if (this.sourceY.isConnected) {
            return ((_a = this.sourceY.connectedPoint) === null || _a === void 0 ? void 0 : _a.ownerBlock).texture;
        }
        return null;
    }
    /**
     * Gets the textureZ associated with the node
     */
    get textureZ() {
        var _a, _b;
        if ((_a = this.sourceZ) === null || _a === void 0 ? void 0 : _a.isConnected) {
            return ((_b = this.sourceY.connectedPoint) === null || _b === void 0 ? void 0 : _b.ownerBlock).texture;
        }
        return null;
    }
    _getImageSourceBlock(connectionPoint) {
        return (connectionPoint === null || connectionPoint === void 0 ? void 0 : connectionPoint.isConnected) ? connectionPoint.connectedPoint.ownerBlock : null;
    }
    /**
     * Gets the sampler name associated with this texture
     */
    get samplerName() {
        const imageSourceBlock = this._getImageSourceBlock(this.source);
        if (imageSourceBlock) {
            return imageSourceBlock.samplerName;
        }
        return this._samplerName;
    }
    /**
     * Gets the samplerY name associated with this texture
     */
    get samplerYName() {
        var _a, _b;
        return (_b = (_a = this._getImageSourceBlock(this.sourceY)) === null || _a === void 0 ? void 0 : _a.samplerName) !== null && _b !== void 0 ? _b : null;
    }
    /**
     * Gets the samplerZ name associated with this texture
     */
    get samplerZName() {
        var _a, _b;
        return (_b = (_a = this._getImageSourceBlock(this.sourceZ)) === null || _a === void 0 ? void 0 : _a.samplerName) !== null && _b !== void 0 ? _b : null;
    }
    /**
     * Gets a boolean indicating that this block is linked to an ImageSourceBlock
     */
    get hasImageSource() {
        return this.source.isConnected;
    }
    /**
     * Gets or sets a boolean indicating if content needs to be converted to gamma space
     */
    set convertToGammaSpace(value) {
        var _a;
        if (value === this._convertToGammaSpace) {
            return;
        }
        this._convertToGammaSpace = value;
        if (this.texture) {
            const scene = (_a = this.texture.getScene()) !== null && _a !== void 0 ? _a : EngineStore.LastCreatedScene;
            scene === null || scene === void 0 ? void 0 : scene.markAllMaterialsAsDirty(1, (mat) => {
                return mat.hasTexture(this.texture);
            });
        }
    }
    get convertToGammaSpace() {
        return this._convertToGammaSpace;
    }
    /**
     * Gets or sets a boolean indicating if content needs to be converted to linear space
     */
    set convertToLinearSpace(value) {
        var _a;
        if (value === this._convertToLinearSpace) {
            return;
        }
        this._convertToLinearSpace = value;
        if (this.texture) {
            const scene = (_a = this.texture.getScene()) !== null && _a !== void 0 ? _a : EngineStore.LastCreatedScene;
            scene === null || scene === void 0 ? void 0 : scene.markAllMaterialsAsDirty(1, (mat) => {
                return mat.hasTexture(this.texture);
            });
        }
    }
    get convertToLinearSpace() {
        return this._convertToLinearSpace;
    }
    /**
     * Create a new TriPlanarBlock
     * @param name defines the block name
     */
    constructor(name, hideSourceZ = false) {
        super(name, NodeMaterialBlockTargets.Neutral);
        /**
         * Project the texture(s) for a better fit to a cube
         */
        this.projectAsCube = false;
        this._convertToGammaSpace = false;
        this._convertToLinearSpace = false;
        /**
         * Gets or sets a boolean indicating if multiplication of texture with level should be disabled
         */
        this.disableLevelMultiplication = false;
        this.registerInput("position", NodeMaterialBlockConnectionPointTypes.AutoDetect, false);
        this.registerInput("normal", NodeMaterialBlockConnectionPointTypes.AutoDetect, false);
        this.registerInput("sharpness", NodeMaterialBlockConnectionPointTypes.Float, true);
        this.registerInput("source", NodeMaterialBlockConnectionPointTypes.Object, true, NodeMaterialBlockTargets.VertexAndFragment, new NodeMaterialConnectionPointCustomObject("source", this, NodeMaterialConnectionPointDirection.Input, ImageSourceBlock, "ImageSourceBlock"));
        this.registerInput("sourceY", NodeMaterialBlockConnectionPointTypes.Object, true, NodeMaterialBlockTargets.VertexAndFragment, new NodeMaterialConnectionPointCustomObject("sourceY", this, NodeMaterialConnectionPointDirection.Input, ImageSourceBlock, "ImageSourceBlock"));
        if (!hideSourceZ) {
            this.registerInput("sourceZ", NodeMaterialBlockConnectionPointTypes.Object, true, NodeMaterialBlockTargets.VertexAndFragment, new NodeMaterialConnectionPointCustomObject("sourceZ", this, NodeMaterialConnectionPointDirection.Input, ImageSourceBlock, "ImageSourceBlock"));
        }
        this.registerOutput("rgba", NodeMaterialBlockConnectionPointTypes.Color4, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("rgb", NodeMaterialBlockConnectionPointTypes.Color3, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("r", NodeMaterialBlockConnectionPointTypes.Float, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("g", NodeMaterialBlockConnectionPointTypes.Float, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("b", NodeMaterialBlockConnectionPointTypes.Float, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("a", NodeMaterialBlockConnectionPointTypes.Float, NodeMaterialBlockTargets.Neutral);
        this.registerOutput("level", NodeMaterialBlockConnectionPointTypes.Float, NodeMaterialBlockTargets.Neutral);
        this._inputs[0].addExcludedConnectionPointFromAllowedTypes(NodeMaterialBlockConnectionPointTypes.Color3 | NodeMaterialBlockConnectionPointTypes.Vector3 | NodeMaterialBlockConnectionPointTypes.Vector4);
        this._inputs[1].addExcludedConnectionPointFromAllowedTypes(NodeMaterialBlockConnectionPointTypes.Color3 | NodeMaterialBlockConnectionPointTypes.Vector3 | NodeMaterialBlockConnectionPointTypes.Vector4);
    }
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName() {
        return "TriPlanarBlock";
    }
    /**
     * Gets the position input component
     */
    get position() {
        return this._inputs[0];
    }
    /**
     * Gets the normal input component
     */
    get normal() {
        return this._inputs[1];
    }
    /**
     * Gets the sharpness input component
     */
    get sharpness() {
        return this._inputs[2];
    }
    /**
     * Gets the source input component
     */
    get source() {
        return this._inputs[3];
    }
    /**
     * Gets the sourceY input component
     */
    get sourceY() {
        return this._inputs[4];
    }
    /**
     * Gets the sourceZ input component
     */
    get sourceZ() {
        return this._inputs[5];
    }
    /**
     * Gets the rgba output component
     */
    get rgba() {
        return this._outputs[0];
    }
    /**
     * Gets the rgb output component
     */
    get rgb() {
        return this._outputs[1];
    }
    /**
     * Gets the r output component
     */
    get r() {
        return this._outputs[2];
    }
    /**
     * Gets the g output component
     */
    get g() {
        return this._outputs[3];
    }
    /**
     * Gets the b output component
     */
    get b() {
        return this._outputs[4];
    }
    /**
     * Gets the a output component
     */
    get a() {
        return this._outputs[5];
    }
    /**
     * Gets the level output component
     */
    get level() {
        return this._outputs[6];
    }
    prepareDefines(mesh, nodeMaterial, defines) {
        if (!defines._areTexturesDirty) {
            return;
        }
        const toGamma = this.convertToGammaSpace && this.texture && !this.texture.gammaSpace;
        const toLinear = this.convertToLinearSpace && this.texture && this.texture.gammaSpace;
        // Not a bug... Name defines the texture space not the required conversion
        defines.setValue(this._linearDefineName, toGamma, true);
        defines.setValue(this._gammaDefineName, toLinear, true);
    }
    isReady() {
        if (this.texture && !this.texture.isReadyOrNotBlocking()) {
            return false;
        }
        return true;
    }
    bind(effect) {
        if (!this.texture) {
            return;
        }
        effect.setFloat(this._textureInfoName, this.texture.level);
        if (!this._imageSource) {
            effect.setTexture(this._samplerName, this.texture);
        }
    }
    _generateTextureLookup(state) {
        var _a, _b;
        const samplerName = this.samplerName;
        const samplerYName = (_a = this.samplerYName) !== null && _a !== void 0 ? _a : samplerName;
        const samplerZName = (_b = this.samplerZName) !== null && _b !== void 0 ? _b : samplerName;
        const sharpness = this.sharpness.isConnected ? this.sharpness.associatedVariableName : "1.0";
        const x = state._getFreeVariableName("x");
        const y = state._getFreeVariableName("y");
        const z = state._getFreeVariableName("z");
        const w = state._getFreeVariableName("w");
        const n = state._getFreeVariableName("n");
        const uvx = state._getFreeVariableName("uvx");
        const uvy = state._getFreeVariableName("uvy");
        const uvz = state._getFreeVariableName("uvz");
        state.compilationString += `
            vec3 ${n} = ${this.normal.associatedVariableName}.xyz;

            vec2 ${uvx} = ${this.position.associatedVariableName}.yz;
            vec2 ${uvy} = ${this.position.associatedVariableName}.zx;
            vec2 ${uvz} = ${this.position.associatedVariableName}.xy;
        `;
        if (this.projectAsCube) {
            state.compilationString += `
                ${uvx}.xy = ${uvx}.yx;

                if (${n}.x >= 0.0) {
                    ${uvx}.x = -${uvx}.x;
                }
                if (${n}.y < 0.0) {
                    ${uvy}.y = -${uvy}.y;
                }
                if (${n}.z < 0.0) {
                    ${uvz}.x = -${uvz}.x;
                }
            `;
        }
        state.compilationString += `
            vec4 ${x} = texture2D(${samplerName}, ${uvx});
            vec4 ${y} = texture2D(${samplerYName}, ${uvy});
            vec4 ${z} = texture2D(${samplerZName}, ${uvz});
           
            // blend weights
            vec3 ${w} = pow(abs(${n}), vec3(${sharpness}));

            // blend and return
            vec4 ${this._tempTextureRead} = (${x}*${w}.x + ${y}*${w}.y + ${z}*${w}.z) / (${w}.x + ${w}.y + ${w}.z);        
        `;
    }
    _generateConversionCode(state, output, swizzle) {
        if (swizzle !== "a") {
            // no conversion if the output is "a" (alpha)
            if (!this.texture || !this.texture.gammaSpace) {
                state.compilationString += `#ifdef ${this._linearDefineName}
                    ${output.associatedVariableName} = toGammaSpace(${output.associatedVariableName});
                    #endif
                `;
            }
            state.compilationString += `#ifdef ${this._gammaDefineName}
                ${output.associatedVariableName} = toLinearSpace(${output.associatedVariableName});
                #endif
            `;
        }
    }
    _writeOutput(state, output, swizzle) {
        let complement = "";
        if (!this.disableLevelMultiplication) {
            complement = ` * ${this._textureInfoName}`;
        }
        state.compilationString += `${this._declareOutput(output, state)} = ${this._tempTextureRead}.${swizzle}${complement};\n`;
        this._generateConversionCode(state, output, swizzle);
    }
    _buildBlock(state) {
        super._buildBlock(state);
        if (this.source.isConnected) {
            this._imageSource = this.source.connectedPoint.ownerBlock;
        }
        else {
            this._imageSource = null;
        }
        this._textureInfoName = state._getFreeVariableName("textureInfoName");
        this.level.associatedVariableName = this._textureInfoName;
        this._tempTextureRead = state._getFreeVariableName("tempTextureRead");
        this._linearDefineName = state._getFreeDefineName("ISLINEAR");
        this._gammaDefineName = state._getFreeDefineName("ISGAMMA");
        if (!this._imageSource) {
            this._samplerName = state._getFreeVariableName(this.name + "Sampler");
            state._emit2DSampler(this._samplerName);
        }
        // Declarations
        state.sharedData.blockingBlocks.push(this);
        state.sharedData.textureBlocks.push(this);
        state.sharedData.blocksWithDefines.push(this);
        state.sharedData.bindableBlocks.push(this);
        const comments = `//${this.name}`;
        state._emitFunctionFromInclude("helperFunctions", comments);
        state._emitUniformFromString(this._textureInfoName, "float");
        this._generateTextureLookup(state);
        for (const output of this._outputs) {
            if (output.hasEndpoints && output.name !== "level") {
                this._writeOutput(state, output, output.name);
            }
        }
        return this;
    }
    _dumpPropertiesCode() {
        let codeString = super._dumpPropertiesCode();
        codeString += `${this._codeVariableName}.convertToGammaSpace = ${this.convertToGammaSpace};\n`;
        codeString += `${this._codeVariableName}.convertToLinearSpace = ${this.convertToLinearSpace};\n`;
        codeString += `${this._codeVariableName}.disableLevelMultiplication = ${this.disableLevelMultiplication};\n`;
        codeString += `${this._codeVariableName}.projectAsCube = ${this.projectAsCube};\n`;
        if (!this.texture) {
            return codeString;
        }
        codeString += `${this._codeVariableName}.texture = new BABYLON.Texture("${this.texture.name}", null, ${this.texture.noMipmap}, ${this.texture.invertY}, ${this.texture.samplingMode});\n`;
        codeString += `${this._codeVariableName}.texture.wrapU = ${this.texture.wrapU};\n`;
        codeString += `${this._codeVariableName}.texture.wrapV = ${this.texture.wrapV};\n`;
        codeString += `${this._codeVariableName}.texture.uAng = ${this.texture.uAng};\n`;
        codeString += `${this._codeVariableName}.texture.vAng = ${this.texture.vAng};\n`;
        codeString += `${this._codeVariableName}.texture.wAng = ${this.texture.wAng};\n`;
        codeString += `${this._codeVariableName}.texture.uOffset = ${this.texture.uOffset};\n`;
        codeString += `${this._codeVariableName}.texture.vOffset = ${this.texture.vOffset};\n`;
        codeString += `${this._codeVariableName}.texture.uScale = ${this.texture.uScale};\n`;
        codeString += `${this._codeVariableName}.texture.vScale = ${this.texture.vScale};\n`;
        codeString += `${this._codeVariableName}.texture.coordinatesMode = ${this.texture.coordinatesMode};\n`;
        return codeString;
    }
    serialize() {
        const serializationObject = super.serialize();
        serializationObject.convertToGammaSpace = this.convertToGammaSpace;
        serializationObject.convertToLinearSpace = this.convertToLinearSpace;
        serializationObject.disableLevelMultiplication = this.disableLevelMultiplication;
        serializationObject.projectAsCube = this.projectAsCube;
        if (!this.hasImageSource && this.texture && !this.texture.isRenderTarget && this.texture.getClassName() !== "VideoTexture") {
            serializationObject.texture = this.texture.serialize();
        }
        return serializationObject;
    }
    _deserialize(serializationObject, scene, rootUrl) {
        super._deserialize(serializationObject, scene, rootUrl);
        this.convertToGammaSpace = serializationObject.convertToGammaSpace;
        this.convertToLinearSpace = !!serializationObject.convertToLinearSpace;
        this.disableLevelMultiplication = !!serializationObject.disableLevelMultiplication;
        this.projectAsCube = !!serializationObject.projectAsCube;
        if (serializationObject.texture && !NodeMaterial.IgnoreTexturesAtLoadTime && serializationObject.texture.url !== undefined) {
            rootUrl = serializationObject.texture.url.indexOf("data:") === 0 ? "" : rootUrl;
            this.texture = Texture.Parse(serializationObject.texture, scene, rootUrl);
        }
    }
}
__decorate([
    editableInPropertyPage("Project as cube", PropertyTypeForEdition.Boolean, "ADVANCED", { notifiers: { update: true } })
], TriPlanarBlock.prototype, "projectAsCube", void 0);
RegisterClass("BABYLON.TriPlanarBlock", TriPlanarBlock);
//# sourceMappingURL=triPlanarBlock.js.map