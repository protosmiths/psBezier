/*
* Converting SVG path data to Bezier curves is a very important part of the bezier library. This is the code that does that.
* I have decided to needs to own file to make it easier to understand and maintain. I have used the naming convention of the 
* original code. We have poly-bezier.js for the PolyBezier class and bezier.js for the Bezier class. This file is named svg-bezier.js.
*
* The question is, should it be a class or a function? I think it should be a function. It is a utility function that does not need
* to maintain any state. It is a pure function that takes an SVG path data string and returns an array of segments.
*
* The thing about functions is that they can be exported as named exports. This is a good thing because it makes it easier to test.
* I becomes an issue when you have a lot of functions to export. You end up with a lot of named exports. This is where classes come in.
* You can have a class with a bunch of methods and export the class as a single export. This is a good thing because it reduces the
* number of named exports. At this point we probably have few functions to export so we can stick with functions.
*/
// files/psBezier/svg-bezier.js
/**
 * Converts an array of PolyBezier curves to an SVG path data string.
 * @param {Array} curves - Array of PolyBeziers.
 * @returns {string} SVG path data string.
 * @throws {TypeError} If the input is not an array of PolyBeziers.
 */
function toSVG(curves)
{
    if (!Array.isArray(curves))
    {
        throw new TypeError('toSVG expects an array of PolyBeziers.');
    }

    if (curves.length === 0)
    {
        return '';
    }

    // Ensure all elements are instances of PolyBezier
    const allPolyBeziers = curves.every(curve => curve instanceof PolyBezier);

    if (!allPolyBeziers)
    {
        throw new TypeError('toSVG expects an array of PolyBeziers.');
    }

    // Convert each PolyBezier to SVG and join the results
    return curves.map(polyBezier => polyBezier.toSVG()).join('');
}
