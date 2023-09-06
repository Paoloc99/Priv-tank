import { Observable } from "../../Misc/observable.js";
import { NodeGeometryBlockConnectionPointTypes } from "./Enums/nodeGeometryConnectionPointTypes.js";
/**
 * Enum used to define the compatibility state between two connection points
 */
export var NodeGeometryConnectionPointCompatibilityStates;
(function (NodeGeometryConnectionPointCompatibilityStates) {
    /** Points are compatibles */
    NodeGeometryConnectionPointCompatibilityStates[NodeGeometryConnectionPointCompatibilityStates["Compatible"] = 0] = "Compatible";
    /** Points are incompatible because of their types */
    NodeGeometryConnectionPointCompatibilityStates[NodeGeometryConnectionPointCompatibilityStates["TypeIncompatible"] = 1] = "TypeIncompatible";
    /** Points are incompatible because they are in the same hierarchy **/
    NodeGeometryConnectionPointCompatibilityStates[NodeGeometryConnectionPointCompatibilityStates["HierarchyIssue"] = 2] = "HierarchyIssue";
})(NodeGeometryConnectionPointCompatibilityStates || (NodeGeometryConnectionPointCompatibilityStates = {}));
/**
 * Defines the direction of a connection point
 */
export var NodeGeometryConnectionPointDirection;
(function (NodeGeometryConnectionPointDirection) {
    /** Input */
    NodeGeometryConnectionPointDirection[NodeGeometryConnectionPointDirection["Input"] = 0] = "Input";
    /** Output */
    NodeGeometryConnectionPointDirection[NodeGeometryConnectionPointDirection["Output"] = 1] = "Output";
})(NodeGeometryConnectionPointDirection || (NodeGeometryConnectionPointDirection = {}));
/**
 * Defines a connection point for a block
 */
export class NodeGeometryConnectionPoint {
    /** Gets the direction of the point */
    get direction() {
        return this._direction;
    }
    /**
     * Gets or sets the connection point type (default is float)
     */
    get type() {
        if (this._type === NodeGeometryBlockConnectionPointTypes.AutoDetect) {
            if (this._ownerBlock.isInput) {
                return this._ownerBlock.type;
            }
            if (this._connectedPoint) {
                return this._connectedPoint.type;
            }
            if (this._linkedConnectionSource && this._linkedConnectionSource.isConnected) {
                return this._linkedConnectionSource.type;
            }
        }
        if (this._type === NodeGeometryBlockConnectionPointTypes.BasedOnInput) {
            if (this._typeConnectionSource) {
                if (!this._typeConnectionSource.isConnected && this._defaultConnectionPointType) {
                    return this._defaultConnectionPointType;
                }
                return this._typeConnectionSource.type;
            }
            else if (this._defaultConnectionPointType) {
                return this._defaultConnectionPointType;
            }
        }
        return this._type;
    }
    set type(value) {
        this._type = value;
    }
    /**
     * Gets a boolean indicating that the current point is connected to another NodeMaterialBlock
     */
    get isConnected() {
        return this.connectedPoint !== null || this.hasEndpoints;
    }
    /** Get the other side of the connection (if any) */
    get connectedPoint() {
        return this._connectedPoint;
    }
    /** Get the block that owns this connection point */
    get ownerBlock() {
        return this._ownerBlock;
    }
    /** Get the block connected on the other side of this connection (if any) */
    get sourceBlock() {
        if (!this._connectedPoint) {
            return null;
        }
        return this._connectedPoint.ownerBlock;
    }
    /** Get the block connected on the endpoints of this connection (if any) */
    get connectedBlocks() {
        if (this._endpoints.length === 0) {
            return [];
        }
        return this._endpoints.map((e) => e.ownerBlock);
    }
    /** Gets the list of connected endpoints */
    get endpoints() {
        return this._endpoints;
    }
    /** Gets a boolean indicating if that output point is connected to at least one input */
    get hasEndpoints() {
        return this._endpoints && this._endpoints.length > 0;
    }
    /** Get the inner type (ie AutoDetect for instance instead of the inferred one) */
    get innerType() {
        if (this._linkedConnectionSource && this._linkedConnectionSource.isConnected) {
            return this.type;
        }
        return this._type;
    }
    /**
     * Gets the value represented by this connection point
     * @param state current evaluation state
     * @returns the connected value or the value if nothing is connected
     */
    getConnectedValue(state) {
        var _a, _b, _c;
        if (this.isConnected) {
            if ((_a = this._connectedPoint) === null || _a === void 0 ? void 0 : _a._storedFunction) {
                return (_b = this._connectedPoint) === null || _b === void 0 ? void 0 : _b._storedFunction(state);
            }
            return (_c = this._connectedPoint) === null || _c === void 0 ? void 0 : _c._storedValue;
        }
        return this.value;
    }
    /**
     * Creates a new connection point
     * @param name defines the connection point name
     * @param ownerBlock defines the block hosting this connection point
     * @param direction defines the direction of the connection point
     */
    constructor(name, ownerBlock, direction) {
        /** @internal */
        this._connectedPoint = null;
        /** @internal */
        this._storedValue = null;
        /** @internal */
        this._storedFunction = null;
        /** @internal */
        this._acceptedConnectionPointType = null;
        this._endpoints = new Array();
        this._type = NodeGeometryBlockConnectionPointTypes.Geometry;
        /** @internal */
        this._linkedConnectionSource = null;
        /** @internal */
        this._typeConnectionSource = null;
        /** @internal */
        this._defaultConnectionPointType = null;
        /**
         * Gets or sets the additional types supported by this connection point
         */
        this.acceptedConnectionPointTypes = new Array();
        /**
         * Gets or sets the additional types excluded by this connection point
         */
        this.excludedConnectionPointTypes = new Array();
        /**
         * Observable triggered when this point is connected
         */
        this.onConnectionObservable = new Observable();
        /**
         * Gets or sets a boolean indicating that this connection point is exposed on a frame
         */
        this.isExposedOnFrame = false;
        /**
         * Gets or sets number indicating the position that the port is exposed to on a frame
         */
        this.exposedPortPosition = -1;
        /**
         * Gets the default value used for this point at creation time
         */
        this.defaultValue = null;
        /**
         * Gets or sets the default value used for this point if nothing is connected
         */
        this.value = null;
        /**
         * Gets or sets the min value accepted for this point if nothing is connected
         */
        this.valueMin = null;
        /**
         * Gets or sets the max value accepted for this point if nothing is connected
         */
        this.valueMax = null;
        this._ownerBlock = ownerBlock;
        this.name = name;
        this._direction = direction;
    }
    /**
     * Gets the current class name e.g. "NodeMaterialConnectionPoint"
     * @returns the class name
     */
    getClassName() {
        return "NodeGeometryConnectionPoint";
    }
    /**
     * Gets a boolean indicating if the current point can be connected to another point
     * @param connectionPoint defines the other connection point
     * @returns a boolean
     */
    canConnectTo(connectionPoint) {
        return this.checkCompatibilityState(connectionPoint) === NodeGeometryConnectionPointCompatibilityStates.Compatible;
    }
    /**
     * Gets a number indicating if the current point can be connected to another point
     * @param connectionPoint defines the other connection point
     * @returns a number defining the compatibility state
     */
    checkCompatibilityState(connectionPoint) {
        const ownerBlock = this._ownerBlock;
        const otherBlock = connectionPoint.ownerBlock;
        if (this.type !== connectionPoint.type && connectionPoint.innerType !== NodeGeometryBlockConnectionPointTypes.AutoDetect) {
            // Accepted types
            if (connectionPoint.acceptedConnectionPointTypes && connectionPoint.acceptedConnectionPointTypes.indexOf(this.type) !== -1) {
                return NodeGeometryConnectionPointCompatibilityStates.Compatible;
            }
            else {
                return NodeGeometryConnectionPointCompatibilityStates.TypeIncompatible;
            }
        }
        // Excluded
        if (connectionPoint.excludedConnectionPointTypes && connectionPoint.excludedConnectionPointTypes.indexOf(this.type) !== -1) {
            return NodeGeometryConnectionPointCompatibilityStates.TypeIncompatible;
        }
        // Check hierarchy
        let targetBlock = otherBlock;
        let sourceBlock = ownerBlock;
        if (this.direction === NodeGeometryConnectionPointDirection.Input) {
            targetBlock = ownerBlock;
            sourceBlock = otherBlock;
        }
        if (targetBlock.isAnAncestorOf(sourceBlock)) {
            return NodeGeometryConnectionPointCompatibilityStates.HierarchyIssue;
        }
        return NodeGeometryConnectionPointCompatibilityStates.Compatible;
    }
    /**
     * Connect this point to another connection point
     * @param connectionPoint defines the other connection point
     * @param ignoreConstraints defines if the system will ignore connection type constraints (default is false)
     * @returns the current connection point
     */
    connectTo(connectionPoint, ignoreConstraints = false) {
        if (!ignoreConstraints && !this.canConnectTo(connectionPoint)) {
            throw "Cannot connect these two connectors.";
        }
        this._endpoints.push(connectionPoint);
        connectionPoint._connectedPoint = this;
        this.onConnectionObservable.notifyObservers(connectionPoint);
        connectionPoint.onConnectionObservable.notifyObservers(this);
        return this;
    }
    /**
     * Disconnect this point from one of his endpoint
     * @param endpoint defines the other connection point
     * @returns the current connection point
     */
    disconnectFrom(endpoint) {
        const index = this._endpoints.indexOf(endpoint);
        if (index === -1) {
            return this;
        }
        this._endpoints.splice(index, 1);
        endpoint._connectedPoint = null;
        return this;
    }
    /**
     * Fill the list of excluded connection point types with all types other than those passed in the parameter
     * @param mask Types (ORed values of NodeMaterialBlockConnectionPointTypes) that are allowed, and thus will not be pushed to the excluded list
     */
    addExcludedConnectionPointFromAllowedTypes(mask) {
        let bitmask = 1;
        while (bitmask < NodeGeometryBlockConnectionPointTypes.All) {
            if (!(mask & bitmask)) {
                this.excludedConnectionPointTypes.push(bitmask);
            }
            bitmask = bitmask << 1;
        }
    }
    /**
     * Serializes this point in a JSON representation
     * @param isInput defines if the connection point is an input (default is true)
     * @returns the serialized point object
     */
    serialize(isInput = true) {
        const serializationObject = {};
        serializationObject.name = this.name;
        serializationObject.displayName = this.displayName;
        if (this.value !== undefined && this.value !== null) {
            if (this.value.asArray) {
                serializationObject.valueType = "BABYLON." + this.value.getClassName();
                serializationObject.value = this.value.asArray();
            }
            else {
                serializationObject.valueType = "number";
                serializationObject.value = this.value;
            }
        }
        if (isInput && this.connectedPoint) {
            serializationObject.inputName = this.name;
            serializationObject.targetBlockId = this.connectedPoint.ownerBlock.uniqueId;
            serializationObject.targetConnectionName = this.connectedPoint.name;
        }
        return serializationObject;
    }
    /**
     * Release resources
     */
    dispose() {
        this.onConnectionObservable.clear();
    }
}
//# sourceMappingURL=nodeGeometryBlockConnectionPoint.js.map