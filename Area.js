/*
* This is the Area class. It is used to represent a 2D area defined by a set of paths.
* The code is written in ES6 and is intended to be used in a browser environment. It was generated
* by ChatGPT. Below are the prompts that were given to the model to generate the code.
*
* Actually, I have a use case and another level of objects and related methods that would better determine
* what I desire in defining how two curves and ultimately two shapes interact. I have an application where 
* I am cutting panels to cover windows.  I have a collection of windows of various sizes and 4' x 8' panels.  
* I what to virtually cut the panels to cover the windows. Part the process is to take the panel and line it 
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
*/

/*
* I would like to make it so that one can import everything one needs for the Area class from this file.  I would like to
* export the Area class so that it can be imported into another file.  I would like to export the Path class so that it can
* be imported into another file.  I would like to export the Segment class so that it can be imported into another file.
*/
import { Path } from "./Path.js";
import { Segment } from "./Segment.js";
export { Area, Path, Segment };
class Area
{
    constructor(paths = [])
    {
        this.paths = paths; // Array of Path objects
    }

    add(otherArea)
    {
        const intersections = this.findIntersections(otherArea);
        return this.resolveOperation(intersections, "add");
    }

    subtract(otherArea)
    {
        otherArea.paths.forEach(path => path.reverseDirection());
        return this.add(otherArea);
    }

    intersect(otherArea)
    {
        const intersections = this.findIntersections(otherArea);
        return this.resolveOperation(intersections, "intersect");
    }

    findIntersections(otherArea)
    {
        const intersections = [];
        this.paths.forEach(path1 =>
        {
            otherArea.paths.forEach(path2 =>
            {
                intersections.push(...path1.findIntersections(path2));
            });
        });
        return intersections;
    }

    resolveOperation(intersections, operation)
    {
        const visitedSegments = new Set();
        const resultLoops = [];

        while (true)
        {
            const unvisitedSegment = this.findUnvisitedSegment(visitedSegments);
            if (!unvisitedSegment) break;

            const loop = unvisitedSegment.path.traverse(unvisitedSegment.segment, intersections, operation);
            resultLoops.push(loop);
        }

        return new Area(resultLoops);
    }

    findUnvisitedSegment(visitedSegments)
    {
        for (const path of this.paths)
        {
            for (const segment of path.segments)
            {
                if (!visitedSegments.has(segment))
                {
                    return { path, segment };
                }
            }
        }
        return null;
    }
}
