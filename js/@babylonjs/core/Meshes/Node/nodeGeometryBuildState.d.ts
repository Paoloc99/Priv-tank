import type { Nullable } from "../../types";
import type { VertexData } from "../mesh.vertexData";
import type { NodeGeometryConnectionPoint } from "./nodeGeometryBlockConnectionPoint";
import { NodeGeometryContextualSources } from "./Enums/nodeGeometryContextualSources";
import { Matrix, Vector3 } from "../../Maths/math.vector";
import type { INodeGeometryExecutionContext } from "./Interfaces/nodeGeometryExecutionContext";
import { NodeGeometryBlockConnectionPointTypes } from "./Enums/nodeGeometryConnectionPointTypes";
/**
 * Class used to store node based geometry build state
 */
export declare class NodeGeometryBuildState {
    private _rotationMatrix;
    private _scalingMatrix;
    private _positionMatrix;
    private _scalingRotationMatrix;
    private _transformMatrix;
    private _tempVector3;
    /** Gets or sets the list of non connected mandatory inputs */
    notConnectedNonOptionalInputs: NodeGeometryConnectionPoint[];
    /** Gets or sets the list of non contextual inputs having no contextudal data */
    noContextualData: NodeGeometryContextualSources[];
    /** Gets or sets the build identifier */
    buildId: number;
    /** Gets or sets a boolean indicating that verbose mode is on */
    verbose: boolean;
    /** Gets or sets the vertex data */
    vertexData: Nullable<VertexData>;
    /** Gets or sets the geometry context */
    geometryContext: Nullable<VertexData>;
    /** Gets or sets the execution context */
    executionContext: Nullable<INodeGeometryExecutionContext>;
    /**
     * Gets the value associated with a contextual source
     * @param source Source of the contextual value
     * @returns the value associated with the source
     */
    getContextualValue(source: NodeGeometryContextualSources): any;
    /**
     * Adapt a value to a target type
     * @param source defines the value to adapt
     * @param targetType defines the target type
     * @returns the adapted value
     */
    adapt(source: NodeGeometryConnectionPoint, targetType: NodeGeometryBlockConnectionPointTypes): any;
    /**
     * Adapt an input value to a target type
     * @param source defines the value to adapt
     * @param targetType defines the target type
     * @param defaultValue defines the default value to use if not connected
     * @returns the adapted value
     */
    adaptInput(source: NodeGeometryConnectionPoint, targetType: NodeGeometryBlockConnectionPointTypes, defaultValue: any): any;
    /**
     * Emits console errors and exceptions if there is a failing check
     */
    emitErrors(): void;
    /** @internal  */
    _instantiate(clone: VertexData, currentPosition: Vector3, rotation: Vector3, scaling: Vector3, additionalVertexData: VertexData[]): void;
    /** @internal  */
    _instantiateWithMatrix(clone: VertexData, transform: Matrix, additionalVertexData: VertexData[]): void;
}
