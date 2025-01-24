/*
* Some tools to debug the bezier curve library. The first functions are a wway to display the bezier curves in a canvas.
*
* I think the approach is to have a list to store bezier related object to display. I think that one could have a function
* to add objects to the list and another to display the objects in the list. The display function would be called in with the
* list. The list would have beziers and points to display. And colors to use for the display.
*/

// files/psBezier/debug_bezier.js
import { Bezier, PolyBezier } from './bezier.js';

class BezierDebugTools
{
    constructor()
    {
    }

    /**
     * Adds a bezier related object to the display list.
     * @param {Object} object - The object to add to the display list.
     * @param {string} color - The color to use for the display.
     * @param {list} displayList - The list of objects to display. User supplied list.
     */
    static addBezierDisplayObject(list, object, color)
    {
        list.push({ object, color });
    }

    /**
     * Displays the bezier related objects in the display list.
     * @param {ctx} ctx - The canvas context to use for the display.
     * @param {list} displayList - The list of objects to display. User supplied list.
     */
    static displayBezierObjects(ctx, list)
    {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // We need to find the bounding box of the bezier curves to set the scale and origin of the display.
        // The bounding box is the smallest rectangle that contains the bezier curves.
        // We also need to include the points in the bounding box. Include PolyBeziers as possible objects
        let bbox = null;
        let beziers = [];
        let bcolors = [];
        let points = [];
        //let pcolors = [];
        list.forEach(item =>
        {
            let _bbox = null;
            if (item.object instanceof Bezier)
            {
                _bbox = item.object.bbox();
                beziers.push(item.object);
                bcolors.push(item.color);
            }
                //test for {x: number, y: number}
            else if (item.object.x !== undefined && item.object.y !== undefined)
            {
                _bbox = { x: { min: item.object.x, max: item.object.x }, y: { min: item.object.y, max: item.object.y } };
                points.push(item);
                //pcolors.push(item.color);
            }
            else if (item.object.constructor.name == 'PolyBezier')
            {
                console.log('PolyBezier', item.object);
                _bbox = item.object.bbox();
                item.object.curves.forEach(curve =>
                {
                    beziers.push(curve);
                    bcolors.push(item.color);
                });
            }
            if (bbox)
            {
                utils.expandbox(bbox, _bbox);
                return;
            }
            bbox = _bbox;
        });
        // We need to scale the bezier curves to fit in the display area.
        // We need to translate the bezier curves to the origin of the display area.
        let hscale = (ctx.canvas.width - 20) / (bbox.x.size);
        let vscale = (ctx.canvas.height - 20) / (bbox.y.size);
        let scale = Math.min(hscale, vscale);
        //Put the origin at the center of the display area
        ctx.save();
        ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
        ctx.scale(scale, -scale);
        ctx.translate(-bbox.x.mid, -bbox.y.mid);
        // Display the bezier curves
        let svgPath = Bezier.toSVG(beziers);
        let ctxPath = new Path2D(svgPath);
        ctx.strokeStyle = 'black';
        ctx.stroke(ctxPath);
        // Display the points
        points.forEach(point =>
        {
            ctx.beginPath();
            ctx.arc(point.object.x, point.object.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = point.color;
            ctx.fill();
        });
        ctx.restore();

    }
}
export { BezierDebugTools };
export default BezierDebugTools;