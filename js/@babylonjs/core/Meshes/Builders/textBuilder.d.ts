import type { Color4 } from "../../Maths/math.color";
import { Path2 } from "../../Maths/math.path";
import type { Vector4 } from "../../Maths/math.vector";
import type { Scene } from "../../scene";
import type { Nullable } from "../../types";
import { Mesh } from "../mesh";
/**
 * Parser inspired by https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/FontLoader.js
 */
/**
 * Represents glyph data generated by http://gero3.github.io/facetype.js/
 */
export interface IGlyphData {
    /** Commands used to draw (line, move, curve, etc..) */
    o: string;
    /** Width */
    ha: number;
}
/**
 * Represents font data generated by http://gero3.github.io/facetype.js/
 */
export interface IFontData {
    /**
     * Font resolution
     */
    resolution: number;
    /** Underline tickness */
    underlineThickness: number;
    /** Bounding box */
    boundingBox: {
        yMax: number;
        yMin: number;
    };
    /** List of supported glyphs */
    glyphs: {
        [key: string]: IGlyphData;
    };
}
declare class ShapePath {
    private _paths;
    private _tempPaths;
    private _holes;
    private _currentPath;
    private _resolution;
    /** Create the ShapePath used to support glyphs */
    constructor(resolution: number);
    /** Move the virtual cursor to a coordinate */
    moveTo(x: number, y: number): void;
    /** Draw a line from the virtual cursor to a given coordinate */
    lineTo(x: number, y: number): void;
    /** Create a quadratic curve from the virtual cursor to a given coordinate */
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    /** Create a bezier curve from the virtual cursor to a given coordinate */
    bezierCurveTo(cpx1: number, cpy1: number, cpx2: number, cpy2: number, x: number, y: number): void;
    /** Extract holes based on CW / CCW */
    extractHoles(): void;
    /** Gets the list of paths */
    get paths(): Path2[];
    /** Gets the list of holes */
    get holes(): Path2[];
}
/**
 * Creates shape paths from a text and font
 * @param text the text
 * @param size size of the font
 * @param resolution resolution of the font
 * @param fontData defines the font data (can be generated with http://gero3.github.io/facetype.js/)
 * @returns array of ShapePath objects
 */
export declare function CreateTextShapePaths(text: string, size: number, resolution: number, fontData: IFontData): ShapePath[];
/**
 * Create a text mesh
 * @param name defines the name of the mesh
 * @param text defines the text to use to build the mesh
 * @param fontData defines the font data (can be generated with http://gero3.github.io/facetype.js/)
 * @param options defines options used to create the mesh
 * @param scene defines the hosting scene
 * @param earcutInjection can be used to inject your own earcut reference
 * @returns a new Mesh
 * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set/text
 */
export declare function CreateText(name: string, text: string, fontData: IFontData, options?: {
    size?: number;
    resolution?: number;
    depth?: number;
    sideOrientation?: number;
    faceUV?: Vector4[];
    faceColors?: Color4[];
    perLetterFaceUV?: (letterIndex: number) => Vector4[];
    perLetterFaceColors?: (letterIndex: number) => Color4[];
}, scene?: Nullable<Scene>, earcutInjection?: any): Nullable<Mesh>;
export {};
