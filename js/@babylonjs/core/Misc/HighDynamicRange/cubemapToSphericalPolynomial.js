import { Vector3 } from "../../Maths/math.vector.js";
import { Scalar } from "../../Maths/math.scalar.js";
import { SphericalPolynomial, SphericalHarmonics } from "../../Maths/sphericalPolynomial.js";

import { ToLinearSpace } from "../../Maths/math.constants.js";
import { Color3 } from "../../Maths/math.color.js";
class FileFaceOrientation {
    constructor(name, worldAxisForNormal, worldAxisForFileX, worldAxisForFileY) {
        this.name = name;
        this.worldAxisForNormal = worldAxisForNormal;
        this.worldAxisForFileX = worldAxisForFileX;
        this.worldAxisForFileY = worldAxisForFileY;
    }
}
/**
 * Helper class dealing with the extraction of spherical polynomial dataArray
 * from a cube map.
 */
export class CubeMapToSphericalPolynomialTools {
    /**
     * Converts a texture to the according Spherical Polynomial data.
     * This extracts the first 3 orders only as they are the only one used in the lighting.
     *
     * @param texture The texture to extract the information from.
     * @returns The Spherical Polynomial data.
     */
    static ConvertCubeMapTextureToSphericalPolynomial(texture) {
        var _a;
        if (!texture.isCube) {
            // Only supports cube Textures currently.
            return null;
        }
        (_a = texture.getScene()) === null || _a === void 0 ? void 0 : _a.getEngine().flushFramebuffer();
        const size = texture.getSize().width;
        const rightPromise = texture.readPixels(0, undefined, undefined, false);
        const leftPromise = texture.readPixels(1, undefined, undefined, false);
        let upPromise;
        let downPromise;
        if (texture.isRenderTarget) {
            upPromise = texture.readPixels(3, undefined, undefined, false);
            downPromise = texture.readPixels(2, undefined, undefined, false);
        }
        else {
            upPromise = texture.readPixels(2, undefined, undefined, false);
            downPromise = texture.readPixels(3, undefined, undefined, false);
        }
        const frontPromise = texture.readPixels(4, undefined, undefined, false);
        const backPromise = texture.readPixels(5, undefined, undefined, false);
        const gammaSpace = texture.gammaSpace;
        // Always read as RGBA.
        const format = 5;
        let type = 0;
        if (texture.textureType == 1 || texture.textureType == 2) {
            type = 1;
        }
        return new Promise((resolve) => {
            Promise.all([leftPromise, rightPromise, upPromise, downPromise, frontPromise, backPromise]).then(([left, right, up, down, front, back]) => {
                const cubeInfo = {
                    size,
                    right,
                    left,
                    up,
                    down,
                    front,
                    back,
                    format,
                    type,
                    gammaSpace,
                };
                resolve(this.ConvertCubeMapToSphericalPolynomial(cubeInfo));
            });
        });
    }
    /**
     * Compute the area on the unit sphere of the rectangle defined by (x,y) and the origin
     * See https://www.rorydriscoll.com/2012/01/15/cubemap-texel-solid-angle/
     * @param x
     * @param y
     */
    static _AreaElement(x, y) {
        return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
    }
    /**
     * Converts a cubemap to the according Spherical Polynomial data.
     * This extracts the first 3 orders only as they are the only one used in the lighting.
     *
     * @param cubeInfo The Cube map to extract the information from.
     * @returns The Spherical Polynomial data.
     */
    static ConvertCubeMapToSphericalPolynomial(cubeInfo) {
        const sphericalHarmonics = new SphericalHarmonics();
        let totalSolidAngle = 0.0;
        // The (u,v) range is [-1,+1], so the distance between each texel is 2/Size.
        const du = 2.0 / cubeInfo.size;
        const dv = du;
        const halfTexel = 0.5 * du;
        // The (u,v) of the first texel is half a texel from the corner (-1,-1).
        const minUV = halfTexel - 1.0;
        for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
            const fileFace = this._FileFaces[faceIndex];
            const dataArray = cubeInfo[fileFace.name];
            let v = minUV;
            // TODO: we could perform the summation directly into a SphericalPolynomial (SP), which is more efficient than SphericalHarmonic (SH).
            // This is possible because during the summation we do not need the SH-specific properties, e.g. orthogonality.
            // Because SP is still linear, so summation is fine in that basis.
            const stride = cubeInfo.format === 5 ? 4 : 3;
            for (let y = 0; y < cubeInfo.size; y++) {
                let u = minUV;
                for (let x = 0; x < cubeInfo.size; x++) {
                    // World direction (not normalised)
                    const worldDirection = fileFace.worldAxisForFileX.scale(u).add(fileFace.worldAxisForFileY.scale(v)).add(fileFace.worldAxisForNormal);
                    worldDirection.normalize();
                    const deltaSolidAngle = this._AreaElement(u - halfTexel, v - halfTexel) -
                        this._AreaElement(u - halfTexel, v + halfTexel) -
                        this._AreaElement(u + halfTexel, v - halfTexel) +
                        this._AreaElement(u + halfTexel, v + halfTexel);
                    let r = dataArray[y * cubeInfo.size * stride + x * stride + 0];
                    let g = dataArray[y * cubeInfo.size * stride + x * stride + 1];
                    let b = dataArray[y * cubeInfo.size * stride + x * stride + 2];
                    // Prevent NaN harmonics with extreme HDRI data.
                    if (isNaN(r)) {
                        r = 0;
                    }
                    if (isNaN(g)) {
                        g = 0;
                    }
                    if (isNaN(b)) {
                        b = 0;
                    }
                    // Handle Integer types.
                    if (cubeInfo.type === 0) {
                        r /= 255;
                        g /= 255;
                        b /= 255;
                    }
                    // Handle Gamma space textures.
                    if (cubeInfo.gammaSpace) {
                        r = Math.pow(Scalar.Clamp(r), ToLinearSpace);
                        g = Math.pow(Scalar.Clamp(g), ToLinearSpace);
                        b = Math.pow(Scalar.Clamp(b), ToLinearSpace);
                    }
                    // Prevent to explode in case of really high dynamic ranges.
                    // sh 3 would not be enough to accurately represent it.
                    const max = this.MAX_HDRI_VALUE;
                    if (this.PRESERVE_CLAMPED_COLORS) {
                        const currentMax = Math.max(r, g, b);
                        if (currentMax > max) {
                            const factor = max / currentMax;
                            r *= factor;
                            g *= factor;
                            b *= factor;
                        }
                    }
                    else {
                        r = Scalar.Clamp(r, 0, max);
                        g = Scalar.Clamp(g, 0, max);
                        b = Scalar.Clamp(b, 0, max);
                    }
                    const color = new Color3(r, g, b);
                    sphericalHarmonics.addLight(worldDirection, color, deltaSolidAngle);
                    totalSolidAngle += deltaSolidAngle;
                    u += du;
                }
                v += dv;
            }
        }
        // Solid angle for entire sphere is 4*pi
        const sphereSolidAngle = 4.0 * Math.PI;
        // Adjust the solid angle to allow for how many faces we processed.
        const facesProcessed = 6.0;
        const expectedSolidAngle = (sphereSolidAngle * facesProcessed) / 6.0;
        // Adjust the harmonics so that the accumulated solid angle matches the expected solid angle.
        // This is needed because the numerical integration over the cube uses a
        // small angle approximation of solid angle for each texel (see deltaSolidAngle),
        // and also to compensate for accumulative error due to float precision in the summation.
        const correctionFactor = expectedSolidAngle / totalSolidAngle;
        sphericalHarmonics.scaleInPlace(correctionFactor);
        sphericalHarmonics.convertIncidentRadianceToIrradiance();
        sphericalHarmonics.convertIrradianceToLambertianRadiance();
        return SphericalPolynomial.FromHarmonics(sphericalHarmonics);
    }
}
CubeMapToSphericalPolynomialTools._FileFaces = [
    new FileFaceOrientation("right", new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(0, -1, 0)),
    new FileFaceOrientation("left", new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0)),
    new FileFaceOrientation("up", new Vector3(0, 1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1)),
    new FileFaceOrientation("down", new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, -1)),
    new FileFaceOrientation("front", new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, -1, 0)),
    new FileFaceOrientation("back", new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, -1, 0)), // -Z bottom
];
/** @internal */
CubeMapToSphericalPolynomialTools.MAX_HDRI_VALUE = 4096;
/** @internal */
CubeMapToSphericalPolynomialTools.PRESERVE_CLAMPED_COLORS = false;
//# sourceMappingURL=cubemapToSphericalPolynomial.js.map