/*
* This is the Area class. It is used to represent a 2D area defined by a set of paths.
* The code is written in ES6 and is intended to be used in a browser environment. It was generated
* by ChatGPT. Below are the prompts that were given to the model to generate the code.
*
* Actually, I have a use case and another level of objects and related methods that would better determine
* what I desire in defining how two curves and ultimately two shapes interact. I have an application where 
* I am cutting panels to cover windows.  I have a collection of windows of various sizes and 4' x 8' panels.  
* I want to virtually cut the panels to cover the windows. Part the process is to take the panel and line it 
* up with the window. To cut from the panel one would do an intersection with the uncovered area on the window 
* and the panel. The panel could be a partial panel that has already had pieces used for other windows. 
* The window could also be partially covered.  The core object I am looking at is an area object. The area is 
* defined by closed paths. An operation like the intersection of two areas is determined by the intersections 
* of the paths as described before.  I have developed some concepts. For example, paths have direction. 
* If we set up some rules related to direction, it makes the processing of operations like adding areas, 
* subtracting one area from another and the intersection of two areas simpler.  One rule is that the path is 
* clockwise around positive areas.  CCW paths represent holes or negative areas. For example, a CW circle 
* surrounding a CCW circle would be a donut shape with a hole in the middle.  A more general rule is that as 
* one travels a path the area is to the right and the "negative area" is to the left.  The idea of following 
* paths leads to the intersections between shapes.  Above we have overlaps and intersections. We can actually
* think of intersections as overlaps with the same starting and ending point.  Anyway every overlap and 
* intersection has two paths that enter and two paths that leave. If the paths follow the rule above of positive
* to the right and negative to the left then one can handle the three possible operations Addition, Subtraction 
* and Intersection. First, for Addition one starts an intersection and takes the path leaving that is the outermost 
* path. That should be the rule at every intersection.  For Intersections of the areas, one takes the innermost path 
* leaving each overlap/intersection. For Subtraction, one reverses the path of the area to be subtracted and then 
* just follows the addition rules.
* 
* Yes, I would definitely like a deeper dive. Actually, first I would like to both do a little more specifying and 
* discuss some concepts for validating the path overlaps/intersections. First, I am thinking the paths can be defined 
* using the SVG D parameter nomenclature.  We will convert these into the bezier model to do bezier library operations 
* as needed. Does this seem reasonable to you or should we use the bezier representation directly?
*
* In the past, I have used the d parameter technique and limited it to "M", "L", "C" and "Z".  If we are going to 
* expand support, should we cover them all? i.e "H" and "V". Are there others?
*
* Tell me about the "A" parameter. In the past, I used the cubic 
* [{x: 1.0, y: 0}, {x: 1.0, y: 0.551915}, {x: 0.551915, y: 1.0}, {x: 0, y: 1.0}] as an approximation for the first
* quadrant of the unit circle. Rotating, concatenating, using De Casteljau for the partial quadrant, rotating, scaling 
* and translating, one can create any arc at any angle and location. It seems to me that there is a way to modify this 
* for "A" parameters.
*
* I have tried to implement this already. My use case has intentionally aligned edges creating the coincidental sections. 
* I first tried small offsets and had some success, but was unhappy with the complexity I was creating.  I then started 
* thinking about how to directly handle the coincidental sections and I feel like once one gets the concepts it is a 
* simpler solution. I had already started to recognize the concept of positive and negative area based on direction.  
* All of this occurred before I knew about you.  After that I knew I wanted to bring you into working out the 
* implementation.
* * A few more of my concepts. Every intersection and coincidental sections have two entry paths and two exit paths. 
* The concept of CW and CCW is determined by a closed shape. An individual segment in those shape could be any segment
* in the space. That means that one can't determine CW or CCW looking at an individual shape.  That is why a created the 
* concept of positive to the right and negative to the left. Direction of a path is defined by the SVG and the order of 
* points. Going back to the entry and exits above. The order will determine direction and logically there will always be 
* two entries and two exits. To implement our area operations we "walk" the path moving from one intersection/coincidental
* section.  We will enter on the path will are walking at the moment. The logic that we need to develop is how to determine 
* which of the two exits do we take for the given operation. For example, for two shape with all crossing intersections we 
* will switch paths at every intersection. A more general rule is that we take the exit closest to our entrance. That is if 
* we order the entrances and exits by their tangents at the intersection.
*
* I like the intersection class, but lets expand it. Conceptually one can think of an intersection as a coincidental section
* with the same start and end point. We can create a class to handle both. Things do get a little more complicated in that 
* we need to assign entries and exits to start and end points.  Actually now that I think about it, the two paths on the same
* point are the closest exit or entrances to each other regardless of tangents. The paths at the other end is a little trickier
* because a coincidental section could change directions. We need to calculate our tangents relative to the tangents of the
* coincidental section at the start and endpoints. It is the relative tangents that tell use what we need to know. From those
* we can determine the other closest exit or entry.
* 
* One issue with walking the path is that there needs to be logic to insure that all possibilities have been covered. An example
* is subtracting an area that crosses over the area being subtracted from. The result is two closed areas. If one walks the path
* and finds one of the closed loops, there must be logic to start another walk to find the other loop.
*
* We might not have any problems, but I have had problems where two paths have very close tangents, it is possible to have them 
* ordered incorrectly. One can find these cases by walking both paths and checking the relationship between them. One must have 
* an even number of crossing intersections/coincidental sections. An odd number indicates a problem, in my experience when there 
* is a problem it is one of these close tangent issues. One way to fix it might be to validate by pairing up crossing 
* intersections. One could "fix" a close tangent problem by finding the intersection it should pair with.
*
* I had an epiphany. All loops are equal when we are doing area operations.  We can start at any loop and follow the rules. We can
* loops as pairs. Take the result from that with the next loop.  We can do this until we have processed all the loops.  We can start
* at the first loop and follow the rules.  We can then take the result and follow the rules with the next loop.  We can do this until
* we have processed all the loops.  There are several advantages to this.  We can do the processing for the pair including the
* intersection.  We can then move to the next pair.  We can also handle the case where we have a loop inside another loop.  We can
* handle the case where we have a loop that contains another loop.  We can handle the case where we have a loop that is disjoint
* from another loop.  We can handle the case where we have a loop that is coincidental with another loop. One tricky case is where
* the result is multiple loops. We need to process all the loops until there are no intersections, overlaps or encompassed loops with
* the same direction.  We can then create a new area object from the loops.  We can then process the new area object.
*/

/*
* I would like to make it so that one can import everything one needs for the Area class from this file.  I would like to
* export the Area class so that it can be imported into another file.  I would like to export the Path class so that it can
* be imported into another file.  I would like to export the Segment class so that it can be imported into another file.
*/

/**
 * Represents an Area composed of one or more Paths.
 * Supports SVG input, arrays of Paths, or cloning from another Area.
 * Facilitates Boolean operations (e.g., union, intersection) and manages Path traversal.
 */
import PathArea from './path-area.js';

class Area
{
    /**
     * Initializes the Area object.
     * @param {string|Array|PathArea|Area} source - Can be an SVG string, an array of Paths, or another Area object.
     */
    constructor(source)
    {
        //This is a Path object. It is a collection of closed loops.  The loops are defined by a series of bezier segments.
        this.path = null;

        if (typeof source === 'string')
        {
            // Parse SVG and create Paths
            this.path = this.path = new PathArea(source);
        } else if ((Array.isArray(source)) && (source[0] instanceof Bezier))
        {
            //We have an array of beziers
            this.path = new PathArea(source);
        } else if (source instanceof PathArea)
        {
            // Clone a Path
            this.path = new PathArea(source);
        } else if (source instanceof Area)
        {
            // Clone another Area
            this.path = new PathArea(source.path);
        } else
        {
            throw new Error('Invalid source type for Area constructor.');
        }
    }

    /*
    * We are changing the way we handle the area operations.  We are going to create an array of loops to be processed.
    * We will process the loops in pairs.  We will process the first pair aand remove them from the array. Then we will
    * take the result and process it with the next loop in the array.  We will continue this until we have processed all
    * the loops.  We will then create return a new Area object from the loops. Things get tricky when we have multiple
    * loops in the result.  We need to process all the loops until there are no intersections, overlaps or encompassed
    * loops with the same direction.  We can then create and return a new area object from the loops.
    * 
    * This function is called from the union and intersect functions.  It is called with the other path and the exit code.
    * It manages the processing of the loops in the two paths.  It returns a new Area object with the result of the operation.
    * 
    * The PathArea object is still at the core of the Area object. The PathArea object can take an array of beziers and
    * create a PathArea object.  That will identify the loops in the PathArea object.  The walkPath function will process
    * two loops and returnthe result as an arry of beziers.  The PathArea object can take the array of beziers and create
    * a new PathArea object.  That PathArea object will have the loops identified.  If there is only one loop in the PathArea
    * we get the next loop in the array and process it with the result.  We continue this until we have processed all the loops.
    * However if there are multiple loops in the result we need to push all but one back into the array.  We then process the
    * 
    */


    /**
     * Performs a union operation on the Area.
     * Combines all Paths in this Area with the Paths in another Area.
     * @param {Area} otherArea - The Area to union with.
     * @returns {Area} A new Area representing the union.
     */
    union(otherArea)
    {
        this.path.findIntersections(otherArea.path);
        //Need to handle case where we have no intersections. Loops that are inside get swallowed up.
        //The walkPath method does not handle this case. It is easier to handle it here.
        // Note that our goal is to create a new Area object. We are not modifying the current Area object.
        // or the otherArea object. First, loops that stand alone are added to the result. Then we deal with loops
        // that are inside other loops or contain other loops.  Things get a little tricky here because of direction.
        // We should work in pairs. Two loops going the same direction become the outside loop. Two loops going in
        // the opposite direction are cloned and added to the result. Note the result at this point is an array of
        //beziers. At the end we will create a new Area object from the array of beziers.
        //if (this.path.intersections.length === 0)
        //{
        //    let resultSegments = [];
        //    let currentPath = this.path.segments[0];
        //    let front = true;
        //    while (currentPath)
        //    {
        //        let nextPath = currentPath.next;
        //        let startT = front ? 0 : 1;
        //        let endT = nextPath ? (front ? 0 : 1) : 1;
        //        resultSegments.push(...currentPath.split(startT, endT));
        //        currentPath = nextPath;
        //        front = !front;
        //    }
        //    return new Area(resultSegments);
        //}

        return this.walkPath(otherArea.path, -1);
    }

    intersect(otherArea)
    {
        this.path.findIntersections(otherArea.path);
        return this.walkPath(otherArea.path, 1);
    }

    subtract(otherArea)
    {
        otherArea.reverse();
        return this.union(otherArea);
    }

    isEmpty()
    {
        return this.beziers.length === 0;
    }
    /**
     * Walks a Path to construct a union/intersect Path based on exit codes.
     * @param {PathArea} path - The other peth for the walk operation.
     * @param {number} exitCode - The exit code to use for the walk operation. (-1 for union, 1 for intersect)
     * @returns {PathArea} A new Path representing the union/intersect operation.
     */
    walkPath(otherPath, exitCode)
    {
        let resultSegments = [];
        let currentIntersection = this.path.intersections[0];
        let front = true;

        //We should handle the case where we have 1 or 0 intersections. For 1 intersection we have a simple case.
        //One of the two paths will the the path depending on the exit code and the loop direction.  It gets even more
        //complicated. There can be multiple loops in both paths. The logic we have discussed so far is for the case
        //where we have one loop in each path. And we have not really covered all of the cases for the different
        //directions of the loops.  We need to handle the case where we have multiple loops in each path. I think we
        //can determine the logic for the case where we have one loop in each path.  We can then extend that logic to
        //the case where we have multiple loops in each path.  Now we need to recognize the intersections between loops
        //The reality is that that is what counts.  We need to recognize the intersections between loops.
        if (this.path.intersections.length === 1)
        {
            if (currentIntersection.path1.exit_code === exitCode)
            {
                return new Area(this.path);
            }
            return new Area(otherPath);
        }
        //We have 0 intersections. There are three possibilities. The two paths are disjoint. This path is inside the otherPath.
        //Or the otherPath is inside this path. We can handle the last two cases and the third case would what is left.
        //Now what about exit codes and directions of paths.
        let thatLoop = otherPath.getLoopInfo(currentIntersection.path2.entry_t);
        let pathInside = otherPath.loops[thatLoop.loopIndex].PolyBezier.contains(this.path.getPoint(currentIntersection.path1.start_t));
        if (pathInside) return new Area(this.path);

        let thisLoop = this.path.getLoopInfo(currentIntersection.path1.start_t);
        let otherInside = this.path.loops[thisLoop.loopIndex].PolyBezier.contains(otherPath.getPoint(currentIntersection.path2.entry_t));
        if (otherInside) return new Area(otherPath);

        //Disjoint paths. Return the two paths for union and an empty path for intersection.
        //Implied else
        if (exitCode === 1) return new Area();

        //Concatenate the beziers in the two paths.
        let thisBeziers = this.path.beziers.concat(otherPath.beziers);
        return new Area(thisBeziers);

        while (currentIntersection)
        {
            //console.log('currentIntersection', currentIntersection);
            if (currentIntersection.isProcessed())
            {
                //We have finished a processing loop
                //We have an issue to handle here. If the first intersection was an overlap, we may have processed all the intersections
                //but we started at the other end of the overlap. We have come around to the other end of the overlap and we have processed
                //all the intersections. We need to take the overlap and finish the loop by going to the other end.
                let testIdx = 0;
                while (testIdx < this.path.intersections.length)
                {
                    currentIntersection = this.path.intersections[testIdx];
                    if (!currentIntersection.isProcessed()) break;
                    testIdx++;
                }
                if (testIdx === this.path.intersections.length)
                {
                    currentIntersection = null;
                    break;
                }
            }
            if (currentIntersection == null) break;
            let nextIntersection = null;
            let bounds = null;
            // Determine the Path and direction to follow based on exit codes
            if (currentIntersection.path1.exit_code === exitCode)
            {
                //We are taking path1
                //console.log('Taking path1');
                nextIntersection = currentIntersection.path1.next;
                bounds = this.getPathBounds(currentIntersection, nextIntersection, 0, front);
                //Path 1 always goes to the front of the intersection/overlap
                front = true;
                resultSegments.push(...this.path.split(bounds.startT, bounds.endT));
           } else
            {
                //Taking path 2
                //console.log('Taking path2');
                nextIntersection = currentIntersection.path2.next;
                bounds = this.getPathBounds(currentIntersection, nextIntersection, 1, front);
                //Path 2 goes to the front if it is the same direction as path 1
                front = nextIntersection.sameDirection;
                resultSegments.push(...otherPath.split(bounds.startT, bounds.endT));
            }
            currentIntersection.markProcessed();
            // Move to the next intersection
            currentIntersection = nextIntersection;
        }
        console.log('resultSegments', resultSegments);
        return new Area(resultSegments);
    }

    // This gives us the bounds of the path between two intersections or overlaps (current and next)
    // pathIndex is 0 for path1 and 1 for path2
    // front is true if the path is at the front of the intersection/overlap
    //The reason for front is that path2. We always go to the entry point of the intersection/overlap because we won't know
    //the exit until the next decision point. We might exit without tranversing the entire intersection/overlap.
    //When path2 is going the other direction from path1, the entry point is the end of the intersection/overlap.
    getPathBounds(currentIntersection, nextIntersection, pathIndex, front)
    {
        if (pathIndex === 0)
        {
            return {
                startT: front ? currentIntersection.path1.start_t : currentIntersection.path1.end_t,
                endT: nextIntersection.path1.start_t
            };
        } else
        {
            return {
                startT: front ? currentIntersection.path2.start_t : currentIntersection.path2.end_t,
                endT: nextIntersection.path2.entry_t
            };
        }
    }

    toSVG()
    {
        return this.path.toSVG();
    }

    /**
     * Creates a clone of the Area.
     * @returns {Area} A new Area object identical to the current one.
     */
    clone()
    {
        return new Area(this);
    }

    reverse()
    {
        this.path.reverse();
    }

    /**
     * Additional helper methods as needed.
     */
    /*
    * A handy debug function would be to display some Area. This could done by passing in an array of Areas to display.
    * The paths could be displayed in different colors.  One could also pass a display context to the function.  The function
    * would then draw the paths on the display context. 
    * 
    * One could take the paths and find the bounding box of the paths.  This could be used to scale the paths to fit in a
    * display area.  The paths could be scaled and translated to fit in the display area.  
    */
    static displayAreas(displayContext, areas)
    {
        let colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'black'];
        if (areas.length === 0) return;
        let bounds = utils.findbbox(areas[0].path.beziers);
        for (let i = 1; i < areas.length; i++)
        {
            utils.expandbox(bounds, utils.findbbox(areas[i].path.beziers));
        }
        //console.log(bounds);
        let hscale = (displayContext.canvas.width - 10) / bounds.x.size;
        let vscale = (displayContext.canvas.height - 10) / bounds.y.size;
        //console.log(hscale, vscale);
        let scale = (vscale < hscale) ? vscale : hscale;
        displayContext.clearRect(0, 0, displayContext.canvas.width, displayContext.canvas.height);
        displayContext.save();
        //Standard display transfomation moves the center of the bounding box to 0,0
        //Then scales the bounding box to fit in the display area
        //Then translate the display area to the center of the display area
        displayContext.translate(displayContext.canvas.width / 2, displayContext.canvas.height / 2);
        displayContext.scale(scale, -scale);
        displayContext.translate(-bounds.x.mid, -bounds.y.mid);
        for (let i = 0; i < areas.length; i++)
        {
            let color = colors[i % colors.length];
            displayContext.strokeStyle = color;
            let svgPath = areas[i].toSVG();
            let path = new Path2D(svgPath);
            //Draw the path
            displayContext.stroke(path);
            //Draw the detected intersections and midpoints
            let intersections = areas[i].path.intersections;
            //Some area paths may not have intersections
            //intersections can be undefined or null
            if (intersections)
            {
                for (let j = 0; j < intersections.length; j++)
                {
                    let intersection = intersections[j];
                    displayContext.beginPath();
                    displayContext.arc(intersection.path1.midPoint.x, intersection.path1.midPoint.y, 3, 0, 2 * Math.PI);
                    displayContext.fillStyle = color;
                    displayContext.fill();
                    displayContext.beginPath();
                    displayContext.arc(intersection.path2.midPoint.x, intersection.path2.midPoint.y, 3, 0, 2 * Math.PI);
                    displayContext.fillStyle = 'black';
                    displayContext.fill();
                }
            }
        }
        displayContext.restore();
    }
}

export { Area };
export default Area;

