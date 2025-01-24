/*
* loop-area.js
* { start_t: global_t, end_t: global_t + length, PolyBezier: poly, direction: poly.cw, firstIntersection: null }
* Using the bezier library convention of adding a dash to the file name, this file is named loop-area.js. It is a utility class
* that it used to track information about loops in the Path class. It is a utility class that does not need to maintain any state.
* The Path class is used to define an Area. By definition an area is a closed loop. This class is used to track information about
* loops in the Path class.
*
* We are going to change the LoopArea class to have greater resposibilites. We have decided to change the Area class to operate on
* loops. This will allow us to use the Area class to operate on the loops in the Path class. Now we will want to find the intersections
* between two loops. We would like to have the same functionality for loops that we have for paths. We will need to track the
* intersections between loops. We will need to track the direction of the loop. We will need to track if the loop has been intersected.
* We will have global 't' values for the loop. We will have the getPoint and the split methods for the loop.
*
* At its core a Path is an array of bezier curves. The beziers are grouped into closed loops. Each closed loop also has an associated
* PolyBezier object. This allows for bezier library operations. In particular, the PolyBezier class has the contains method that can
* be used to determine if a point is inside the loop. One can operate on Beziers using the 't' parameter. This is useful for things
* like getting a point on the bezier or splitting the bezier between two 't' values. We have extended the 't' parameter to the the
* array of beziers in the Path. This allows us to operate on the entire Path using the 't' parameter. It is useful to describe the
* loop's position in the array by global 't' values. This is one of the things that the LoopArea class does.
*
* Another important thing that the LoopArea class does is to track the direction of the loop. This is important because the direction
* of the loop determines the inside and outside of the loop. The bezier library uses the convention that the inside of the loop is
* clockwise. This is the convention used by the SVG path data.
*
* When we find the intersections of a Path with another Path, we have implemented a linked list of intersections. The linked list
* is looped. The LoopArea class is used to track the first intersection in the loop giving us a way to get into the loop and iterate
* through the intersections.
*
* Lastly, if the loop has no intersections with the other path, we need to know that to proper process the loop. The LoopArea class
* is used to track this information.
*/
// files/psBezier/loop-area.js
/**
 * Utility class to track information about loops in the Path class.
 */
class LoopArea
{
    /**
     * @param {number} start_t - The global 't' value of the start of the loop.
     * @param {number} end_t - The global 't' value of the end of the loop.
     * @param {PolyBezier} PolyBezier - The PolyBezier object of the loop.
     * @param {boolean} direction - The direction of the loop (true if clockwise).
     * @param {Intersection} firstIntersection - The first intersection in the loop.
     * @param {Intersected} intersected - Boolean indicating if the loop has been intersected.
     */
    constructor(start_t, end_t, PolyBezier, direction, firstIntersection, intersected = false)
    {
        this.start_t = start_t;
        this.end_t = end_t;
        this.PolyBezier = PolyBezier;
        this.direction = direction;
        this.firstIntersection = firstIntersection;
        this.intersected = intersected;
    }

    isInside(point)
    {
        return this.PolyBezier.contains(point);
    }

    getPoint(global_t)
    {
        return this.PolyBezier.get(global_t);
    }

    getMidPoint(firstT, secondT)
    {
        if (firstT < secondT)
        {
            return this.getPoint((firstT + secondT) / 2);
        }
        //Implied else

        //This is the wrap around case. We need to find the start of the overlap
        //The average of the two t values is the midpoint at exactly 1/2 around the loop
        //We need to find the midpoint at 1/2 around the loop
        //If we are in the first half of the loop, we need to add 1/2 to the average
        //If we are in the second half of the loop, we need to subtract 1/2 from the average
        let average = (firstT + secondT) / 2;
        let midT = this.end_t / 2;
        if (average > midT) return this.getPoint(average - midT);

        return this.getPoint(average + midT);

    }

    split(global_t1, global_t2)
    {
        return this.PolyBezier.split(global_t1, global_t2);
    }

    bezierLocalToGlobal(otherLoop, tol = 0.01)
    {
        let rawIntersections = [];
        for (let i = 0; i < this.PolyBezier.curves.length; i++)
        {
            for (let j = 0; j < otherPath.PolyBezier.curves.length; j++)
            {
                //We need an interim object to hold the raw intersections with converted global t values
                let localIntersections = this.PolyBezier.curves[i].intersects(otherPath.PolyBezier.curves[j], tol);
                for (let intersection of localIntersections)
                {
                    //console.log(intersection);
                    //We need to convert the local t values to global t values
                    //The format of the localIntersections is a string of the form "t1/t2"
                    //This will split the string into an array of two strings, then convert them to floats
                    let t = intersection.split("/").map(v => parseFloat(v));
                    //Fudge the ts to guarantee that we don't have ts that are exactly on the boundary
                    //We probably don't need to fudge both ends, but it doesn't hurt
                    if (t[0] === 0) t[0] = 0.0001;
                    if (t[0] === 1) t[0] = 0.9999;
                    if (t[1] === 0) t[1] = 0.0001;
                    if (t[1] === 1) t[1] = 0.9999;
                    //console.log(t);
                    let global_t1 = i + t[0]
                    let global_t2 = j + t[1];
                    rawIntersections.push({ global_t1: global_t1, global_t2: global_t2 });
                }
            }
        }
        return rawIntersections;
    }

    /*
    * The processIntersections function is used to process the raw intersections between two loops. 
    */
    processIntersections(rawIntersections, tol = 0.01)
    {
        let intersections = [];
        if (rawIntersections.length === 0) return intersections;
        //We need to sort the intersections by global_t1
        rawIntersections.sort((a, b) => a.global_t1 - b.global_t1);
        //console.log(rawIntersections);
        //We need to convert the rawIntersections to Intersection objects

        let gap = 5 * tol;

        this.intersected = true;
        let endIdx = rawIntersections.length - 1;
        let startPoint = this.getPoint(rawIntersections[0].global_t1);
        let endPoint = this.getPoint(rawIntersections[endIdx].global_t1);
        while (utils.dist(startPoint, endPoint) < gap)
        {
            startPoint = { x: endPoint.x, y: endPoint.y };
            endIdx--;
            if (endIdx < 0) break;
            endPoint = this.getPoint(rawIntersections[endIdx].global_t1);
        }
        if (endIdx < 0)
        {
            //This is an overlap that wraps around the loop. This is an edge case that will be more common
            //than one might expect. For example, when my Storm Shutter completes a shutter, the last intersection
            //is an overlap that wraps around the loop. The logic is simple. The start and end t values are the same
            //The start and end points are the same. The direction is the same. The only difference is the global t values
            let sameLoop = new Intersection(rawIntersections[0].global_t1, rawIntersections[rawIntersections.length - 1].global_t1, rawIntersections[0].global_t2, rawIntersections[rawIntersections.length - 1].global_t2, true);
            sameLoop.same_loop = true;
            //For a while let's tell the world about this
            console.log('sameLoop', sameLoop);
            intersections.push(sameLoop);
            return intersections;
        }
        let startIdx = endIdx + 1;
        if (startIdx >= rawIntersections.length)
        {
            startIdx = 0;
            endIdx = rawIntersections.length - 1;
        }
        console.log('startIdx', startIdx, 'endIdx', endIdx);
        let start_t1 = rawIntersections[startIdx].global_t1;
        let start_t2 = rawIntersections[startIdx].global_t2;
        startPoint = this.getPoint(start_t1);
        let overlap = false;
        while (startIdx != endIdx)
        {
            let sameDir = true;
            let dirNotFound = true;
            //If we have a gap, we have an intersection and the end values ar the start values in the intersection creation.
            let end_t1 = start_t1;
            let end_t2 = start_t2;
            startIdx++;
            if (startIdx >= rawIntersections.length) startIdx = 0;

            let gap_t1 = rawIntersections[startIdx].global_t1;
            let gap_t2 = rawIntersections[startIdx].global_t2;
            endPoint = this.getPoint(gap_t1);
            overlap = false;
            //I realized there is some tricky stuff happening here. The end value we want is the value before the gap
            //We also want to keep the start t values for the intersection/overlap creation. Want we need to do is
            //increment the startIdx and move the end and gap values along. The end values are before the gap values
            //The gap values are the start values for the next intersection/overlap
            let testStart = { x: startPoint.x, y: startPoint.y };
            while ((startIdx != endIdx) && (utils.dist(startPoint, endPoint) < gap))
            {
                console.log('Gap top of overlap loop', utils.dist(startPoint, endPoint));
                overlap = true;
                if (dirNotFound)
                {
                    let dirDiff = gap_t2 - end_t2;
                    if (dirDiff != 0)
                    {
                        if (dirDiff > 0.5)
                        {
                            sameDir = false;
                        } else if (dirDiff > 0)
                        {
                            sameDir = true;
                        } else if (dirDiff < -0.5)
                        {
                            sameDir = true;
                        } else
                        {
                            sameDir = false;
                        }
                        dirNotFound = false;
                    }
                }
                //No gap, move to the possible end of the overlap
                end_t1 = gap_t1;
                end_t2 = gap_t2;
                startPoint = { x: endPoint.x, y: endPoint.y };
                startIdx++;
                if (startIdx >= rawIntersections.length) startIdx = 0;
                //New possible gap values
                gap_t1 = rawIntersections[startIdx].global_t1;
                gap_t2 = rawIntersections[startIdx].global_t2;
                endPoint = this.getPoint(gap_t1);
            }
            console.log('Gap bottom of overlap loop', utils.dist(startPoint, endPoint));
            //We have another edge case.  When two curves come in at a shallow angle, the algorithm can find several intersections
            //that are closer than the minimum gap. The proble, is that because of the shallow angle, the intersections are not
            //necessarily in the correct order. The answer is to turn small overlaps into intersections. We can do this by checking
            //the distance between the end point and the start point. If it is less than 4*tol, we have an intersection.
            if (utils.dist(testStart, startPoint) < 10 * tol)
            {
                let t1Ave = (start_t1 + end_t1) / 2;
                let t2Ave = (start_t2 + end_t2) / 2;
                intersections.push(new Intersection(t1Ave, t1Ave, t2Ave, t2Ave, true));
            } else
            {
                intersections.push(new Intersection(start_t1, end_t1, start_t2, end_t2, sameDir));
            }
            //Next start values are after the gap
            start_t1 = gap_t1;
            start_t2 = gap_t2;
            startPoint = { x: endPoint.x, y: endPoint.y };
        }
        //Things are a little tricky here. We exited because we got to endIdx. Because of preprocessing we guaranteed
        //a gap after the last intersection. We need to process that gap. If we ended on an overlap, that gap has already
        //been processed. If we ended on an intersection, we need to process the gap
        if (!overlap)
        {
            //This is an intersection. start and end t values are the same
            intersections.push(new Intersection(start_t1, start_t1, start_t2, start_t2, true));
        }
        return intersections;
    }

    populateIntersectionLinks(sorted)
    {
        for (let i = 0; i < sorted.length - 1; i++)
        {
            sorted[i].path.next = sorted[i + 1].link;
        }
        sorted[sorted.length - 1].path.next = sorted[0].link;
    }

    //Now to implement findIntersections for loops
    //We will need to track the intersections between loops
    //We will need to track the direction of the loop
    //We will need to track if the loop has been intersected
    //We will have global 't' values for the loop
    findIntersections(otherLoop)
    {
        let rawIntersections = this.bezierLocalToGlobal(otherLoop);
        let intersections = this.processIntersections(rawIntersections);
        if (intersections.length == 0) return intersections;
        if (intersections.length == 1)
        {
            let midPoint = this.getMidPoint(intersections[0].path1.end_t, intersections[0].path1.start_t);
            let contains = otherLoop.isInside(midPoint);
            intersections[0].path1.exit_code = this.calculateExitCode(contains, this.direction, otherLoop.direction);
            midPoint = otherLoop.getMidPoint(intersections[0].path2.exit_t, intersections[0].path2.entry_t);
            contains = this.isInside(midPoint);
            intersections[0].path2.exit_code = this.calculateExitCode(contains, otherLoop.direction, this.direction);
            return intersections;
        }
        //We need to sort the intersections by path1 start_t. Note we have at least two intersections
        this.intersections.sort((a, b) => a.path1.start_t - b.path1.start_t);
        let sorted = [];
        //We are creating an array of objects that contain the loop, the link, and the next intersection for path1
        for (let i = 0; i < this.intersections.length; i++)
        {
            sorted.push({ loop: this, link: this.intersections[i], path: this.intersections[i].path1 });
        }
        this.populateIntersectionLinks(sorted);

        this.intersections.sort((a, b) => a.path2.entry_t - b.path2.entry_t);
        sorted = [];
        //We are creating an array of objects that contain the loop, the link, and the next intersection for path2
        for (let i = 0; i < this.intersections.length; i++)
        {
            sorted.push({ loop: otherLoop, link: this.intersections[i], path: this.intersections[i].path2 });
        }
        this.populateIntersectionLinks(sorted);
        sorted = null;
        this.intersections.sort((a, b) => a.path1.start_t - b.path1.start_t);
        let thisIntersection = this.intersection[0];
        let firstT = thisIntersection.path1.end_t;
        while (thisIntersection.path1.exit_code == 0)
        {
            //This code is not been calculated
            let nextIntersection = thisIntersection.path1.next;
            //console.log(nextIntersection);
            let nextT = nextIntersection.path1.start_t;
            let midPoint = this.getMidPoint(firstT, nextT);
            let contains = otherLoop.isInside(midPoint);
            thisIntersection.path1.midPoint = midPoint;
            //console.log('Path1 midPoint', contains, midPoint);
            //Now we can assign the exit code based on contains and CW or CCW for both loops
            thisIntersection.path1.exit_code = this.calculateExitCode(contains, loop.direction, otherLoop.direction);
            firstT = nextIntersection.path1.end_t;
            thisIntersection = nextIntersection;
        }
        //We have the path1 exit codes. We can now calculate the path2 exit codes
        //We can use the same logic as above. We need to enter each loop using the firstIntersection
        this.intersections.sort((a, b) => a.path2.entry_t - b.path2.entry_t);
        let thisIntersection = this.intersections[0];
        let firstT = thisIntersection.path2.exit_t;
        while (thisIntersection.path2.exit_code == 0)
        {
            //This code is not been calculated
            let nextIntersection = thisIntersection.path2.next;
            let nextT = nextIntersection.path2.entry_t;
            //We need to handle the edge case of one intersection in the loop
            //By definition it is a touching intersection
            //This could be detected several ways, but the most effective is to compare the t values
            if (nextT - firstT < gap)
            {
                //nudge firstT
                firstT += gap;
                if (firstT > loop.end_t) firstT = loop.start_t;
            }
            let midPoint = otherPath.getMidPoint(firstT, nextT);
            let contains = this.isInside(midPoint);
            //console.log('Path2 midPoint', contains, midPoint);
            //console.log(this.loops[thisLoop].PolyBezier);
            thisIntersection.path2.midPoint = midPoint;
            //Now we can assign the exit code based on contains and CW or CCW for both loops
            thisIntersection.path2.exit_code = this.calculateExitCode(contains, loop.direction, this.direction);
            firstT = nextIntersection.path2.exit_t;
            thisIntersection = nextIntersection;
        }
        //return intersections;
        /*
        * Now to validate. There are some rules the intersections must meet. First, the exit codes must be symmetrical. That is the path 1 exit code
        * for the intersection must be the negative of the path 2 exit code. There must be an even number of crossings. Touching intersections will
        * have the same exit codes as the last intersection. The exit codes flip for a crossing. The must be an even number of flips. The symmetry
        * rule along with the even number of flips guarantees that the exit codes are correct for both paths if they are valid for one path. Note
        * that these rules are per loop. The loops must be disjoint. If they are not, they can be combined into a single loop. A future enhancment
        * will be to combine loops that are not disjoint when they are passed to the area.
        */
        let intersection = this.intersected[0];
        let flipCount = 0;
        let lastExitCode = intersection.path1.exit_code;
        while (intersection != null)
        {
            //console.log(intersection);
            if (intersection.path1.exit_code != lastExitCode)
            {
                flipCount++;
                lastExitCode = intersection.path1.exit_code;
            }
            if (intersection.path1.exit_code != -intersection.path2.exit_code)
            {
                let badPoint = this.getPoint(intersection.path1.end_t);
                let message = `Invalid intersection. The exit codes are not symmetrical at point ${badPoint.x}, ${badPoint.y}.`;
                console.warn(message);
                console.warn('Exit codes:', intersection.path1.exit_code, intersection.path2.exit_code);
            }
            intersection = intersection.path1.next;
            if (intersection == this.intersections[0]) break;
        }
        //We were missing the last intersection in the loop
        if (intersection.path1.exit_code != lastExitCode)
        {
            flipCount++;
        }
        if (flipCount % 2 != 0) console.warn(`Invalid number of crossings (${flipCount}). There must be an even number of crossings.`);
    }

    /*
    * Calculates the exit code for an intersection/overlap. It could also be called the entry code.
    * It depends on the perspective. The exit code is the code for the path that is exiting the intersection.
    * If one is on a CW path one gets the code of the area one is entering.  For example, the arae outside
    * a CW shape is -1. The area inside a CW shape is 1. The area inside a CCW shape is -1. The area outside
    * a CCW shape is 1. On a CCW path, the exit code is -1 times the code for the aera one is entering.
    * This creates the table below.
    */
    calculateExitCode(isInside, thisOrientation, oppositeOrientation)
    {
        if (isInside)
        {
            if (thisOrientation && oppositeOrientation) return 1;
            if (thisOrientation && !oppositeOrientation) return -1;
            if (!thisOrientation && oppositeOrientation) return -1;
            if (!thisOrientation && !oppositeOrientation) return 1;
        } else
        {
            if (thisOrientation && oppositeOrientation) return -1;
            if (thisOrientation && !oppositeOrientation) return 1;
            if (!thisOrientation && oppositeOrientation) return 1;
            if (!thisOrientation && !oppositeOrientation) return -1;
        }
    }

        //Validate the intersections
        //console.log(intersections);

        //console.log(rawIntersections);
        //console.log(rawIntersections);
        //We need to convert the rawIntersections to Intersection objects

        //We will need to track the intersections between loops
        //We will need to track the direction of the loop
        //We will need to track if the loop has been intersected
        //We will have global 't' values for the loop
    }
}
export { LoopArea };
export default LoopArea;