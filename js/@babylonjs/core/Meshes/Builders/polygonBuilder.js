import { Vector2, Vector4 } from "../../Maths/math.vector.js";
import { Color4 } from "../../Maths/math.color.js";
import { Mesh } from "../mesh.js";
import { VertexData } from "../mesh.vertexData.js";
import { PolygonMeshBuilder } from "../polygonMesh.js";
import { VertexBuffer } from "../../Buffers/buffer.js";
import { EngineStore } from "../../Engines/engineStore.js";
import { CompatibilityOptions } from "../../Compat/compatibilityOptions.js";
/**
 * Creates the VertexData for an irregular Polygon in the XoZ plane using a mesh built by polygonTriangulation.build()
 * All parameters are provided by CreatePolygon as needed
 * @param polygon a mesh built from polygonTriangulation.build()
 * @param sideOrientation takes the values Mesh.FRONTSIDE (default), Mesh.BACKSIDE or Mesh.DOUBLESIDE
 * @param fUV an array of Vector4 elements used to set different images to the top, rings and bottom respectively
 * @param fColors an array of Color3 elements used to set different colors to the top, rings and bottom respectively
 * @param frontUVs only usable when you create a double-sided mesh, used to choose what parts of the texture image to crop and apply on the front side, optional, default vector4 (0, 0, 1, 1)
 * @param backUVs only usable when you create a double-sided mesh, used to choose what parts of the texture image to crop and apply on the back side, optional, default vector4 (0, 0, 1, 1)
 * @param wrp a boolean, default false, when true and fUVs used texture is wrapped around all sides, when false texture is applied side
 * @returns the VertexData of the Polygon
 */
export function CreatePolygonVertexData(polygon, sideOrientation, fUV, fColors, frontUVs, backUVs, wrp) {
    const faceUV = fUV || new Array(3);
    const faceColors = fColors;
    const colors = [];
    const wrap = wrp || false;
    // default face colors and UV if undefined
    for (let f = 0; f < 3; f++) {
        if (faceUV[f] === undefined) {
            faceUV[f] = new Vector4(0, 0, 1, 1);
        }
        if (faceColors && faceColors[f] === undefined) {
            faceColors[f] = new Color4(1, 1, 1, 1);
        }
    }
    const positions = polygon.getVerticesData(VertexBuffer.PositionKind);
    const normals = polygon.getVerticesData(VertexBuffer.NormalKind);
    const uvs = polygon.getVerticesData(VertexBuffer.UVKind);
    const indices = polygon.getIndices();
    const startIndex = positions.length / 9;
    let disp = 0;
    let distX = 0;
    let distZ = 0;
    let dist = 0;
    let totalLen = 0;
    const cumulate = [0];
    if (wrap) {
        for (let idx = startIndex; idx < positions.length / 3; idx += 4) {
            distX = positions[3 * (idx + 2)] - positions[3 * idx];
            distZ = positions[3 * (idx + 2) + 2] - positions[3 * idx + 2];
            dist = Math.sqrt(distX * distX + distZ * distZ);
            totalLen += dist;
            cumulate.push(totalLen);
        }
    }
    // set face colours and textures
    let idx = 0;
    let face = 0;
    for (let index = 0; index < normals.length; index += 3) {
        //Edge Face  no. 1
        if (Math.abs(normals[index + 1]) < 0.001) {
            face = 1;
        }
        //Top Face  no. 0
        if (Math.abs(normals[index + 1] - 1) < 0.001) {
            face = 0;
        }
        //Bottom Face  no. 2
        if (Math.abs(normals[index + 1] + 1) < 0.001) {
            face = 2;
        }
        idx = index / 3;
        if (face === 1) {
            disp = idx - startIndex;
            if (disp % 4 < 1.5) {
                if (wrap) {
                    uvs[2 * idx] = faceUV[face].x + ((faceUV[face].z - faceUV[face].x) * cumulate[Math.floor(disp / 4)]) / totalLen;
                }
                else {
                    uvs[2 * idx] = faceUV[face].x;
                }
            }
            else {
                if (wrap) {
                    uvs[2 * idx] = faceUV[face].x + ((faceUV[face].z - faceUV[face].x) * cumulate[Math.floor(disp / 4) + 1]) / totalLen;
                }
                else {
                    uvs[2 * idx] = faceUV[face].z;
                }
            }
            if (disp % 2 === 0) {
                uvs[2 * idx + 1] = CompatibilityOptions.UseOpenGLOrientationForUV ? 1.0 - faceUV[face].w : faceUV[face].w;
            }
            else {
                uvs[2 * idx + 1] = CompatibilityOptions.UseOpenGLOrientationForUV ? 1.0 - faceUV[face].y : faceUV[face].y;
            }
        }
        else {
            uvs[2 * idx] = (1 - uvs[2 * idx]) * faceUV[face].x + uvs[2 * idx] * faceUV[face].z;
            uvs[2 * idx + 1] = (1 - uvs[2 * idx + 1]) * faceUV[face].y + uvs[2 * idx + 1] * faceUV[face].w;
            if (CompatibilityOptions.UseOpenGLOrientationForUV) {
                uvs[2 * idx + 1] = 1.0 - uvs[2 * idx + 1];
            }
        }
        if (faceColors) {
            colors.push(faceColors[face].r, faceColors[face].g, faceColors[face].b, faceColors[face].a);
        }
    }
    // sides
    VertexData._ComputeSides(sideOrientation, positions, indices, normals, uvs, frontUVs, backUVs);
    // Result
    const vertexData = new VertexData();
    vertexData.indices = indices;
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    if (faceColors) {
        const totalColors = sideOrientation === VertexData.DOUBLESIDE ? colors.concat(colors) : colors;
        vertexData.colors = totalColors;
    }
    return vertexData;
}
/**
 * Creates a polygon mesh
 * The polygon's shape will depend on the input parameters and is constructed parallel to a ground mesh
 * * The parameter `shape` is a required array of successive Vector3 representing the corners of the polygon in th XoZ plane, that is y = 0 for all vectors
 * * You can set the mesh side orientation with the values : Mesh.FRONTSIDE (default), Mesh.BACKSIDE or Mesh.DOUBLESIDE
 * * The mesh can be set to updatable with the boolean parameter `updatable` (default false) if its internal geometry is supposed to change once created
 * * If you create a double-sided mesh, you can choose what parts of the texture image to crop and stick respectively on the front and the back sides with the parameters `frontUVs` and `backUVs` (Vector4)
 * * Remember you can only change the shape positions, not their number when updating a polygon
 * @param name defines the name of the mesh
 * @param options defines the options used to create the mesh
 * @param options.shape
 * @param options.holes
 * @param options.depth
 * @param options.smoothingThreshold
 * @param options.faceUV
 * @param options.faceColors
 * @param options.updatable
 * @param options.sideOrientation
 * @param options.frontUVs
 * @param options.backUVs
 * @param options.wrap
 * @param scene defines the hosting scene
 * @param earcutInjection can be used to inject your own earcut reference
 * @returns the polygon mesh
 */
export function CreatePolygon(name, options, scene = null, earcutInjection = earcut) {
    options.sideOrientation = Mesh._GetDefaultSideOrientation(options.sideOrientation);
    const shape = options.shape;
    const holes = options.holes || [];
    const depth = options.depth || 0;
    const smoothingThreshold = options.smoothingThreshold || 2;
    const contours = [];
    let hole = [];
    for (let i = 0; i < shape.length; i++) {
        contours[i] = new Vector2(shape[i].x, shape[i].z);
    }
    const epsilon = 0.00000001;
    if (contours[0].equalsWithEpsilon(contours[contours.length - 1], epsilon)) {
        contours.pop();
    }
    const polygonTriangulation = new PolygonMeshBuilder(name, contours, scene || EngineStore.LastCreatedScene, earcutInjection);
    for (let hNb = 0; hNb < holes.length; hNb++) {
        hole = [];
        for (let hPoint = 0; hPoint < holes[hNb].length; hPoint++) {
            hole.push(new Vector2(holes[hNb][hPoint].x, holes[hNb][hPoint].z));
        }
        polygonTriangulation.addHole(hole);
    }
    //updatability is set during applyToMesh; setting to true in triangulation build produces errors
    const polygon = polygonTriangulation.build(false, depth, smoothingThreshold);
    polygon._originalBuilderSideOrientation = options.sideOrientation;
    const vertexData = CreatePolygonVertexData(polygon, options.sideOrientation, options.faceUV, options.faceColors, options.frontUVs, options.backUVs, options.wrap);
    vertexData.applyToMesh(polygon, options.updatable);
    return polygon;
}
/**
 * Creates an extruded polygon mesh, with depth in the Y direction.
 * * You can set different colors and different images to the top, bottom and extruded side by using the parameters `faceColors` (an array of 3 Color3 elements) and `faceUV` (an array of 3 Vector4 elements)
 * @see https://doc.babylonjs.com/features/featuresDeepDive/materials/using/texturePerBoxFace
 * @param name defines the name of the mesh
 * @param options defines the options used to create the mesh
 * @param options.shape
 * @param options.holes
 * @param options.depth
 * @param options.faceUV
 * @param options.faceColors
 * @param options.updatable
 * @param options.sideOrientation
 * @param options.frontUVs
 * @param options.backUVs
 * @param options.wrap
 * @param scene defines the hosting scene
 * @param earcutInjection can be used to inject your own earcut reference
 * @returns the polygon mesh
 */
export function ExtrudePolygon(name, options, scene = null, earcutInjection = earcut) {
    return CreatePolygon(name, options, scene, earcutInjection);
}
/**
 * Class containing static functions to help procedurally build meshes
 * @deprecated use the functions directly from the module
 */
export const PolygonBuilder = {
    ExtrudePolygon,
    CreatePolygon,
};
VertexData.CreatePolygon = CreatePolygonVertexData;
Mesh.CreatePolygon = (name, shape, scene, holes, updatable, sideOrientation, earcutInjection = earcut) => {
    const options = {
        shape: shape,
        holes: holes,
        updatable: updatable,
        sideOrientation: sideOrientation,
    };
    return CreatePolygon(name, options, scene, earcutInjection);
};
Mesh.ExtrudePolygon = (name, shape, depth, scene, holes, updatable, sideOrientation, earcutInjection = earcut) => {
    const options = {
        shape: shape,
        holes: holes,
        depth: depth,
        updatable: updatable,
        sideOrientation: sideOrientation,
    };
    return ExtrudePolygon(name, options, scene, earcutInjection);
};
//# sourceMappingURL=polygonBuilder.js.map