// files/psBezier/Path.js

/**
 * Represents a Path constructed from Bezier curves.
 * Supports SVG input, arrays of Beziers, or cloning from another Path.
 * Handles closed loops, global t values, intersections, and splitting functionality.
 */

import { LoopArea } from './loop-area.js';
import { Intersection } from './intersection-area.js';
import { utils } from './utils.js';
import { Bezier, PolyBezier } from './bezier.js';
class PathArea
{
    /**
     * Initializes the Path object.
     * @param {string|Array|PathArea} source - Can be an SVG string, an array of Bezier curves, or another Path object.
     */
    constructor(source)
    {
        this.beziers = [];
        this.loops = [];
        this.intersections = [];
        let polys = [];
        if (typeof source === 'string')
        {
            polys = utils.svg2Polys(source);
            //This is the only overload that doesn't populate the beziers array, so do it now
            for (let poly of polys)
            {
                for (let bezier of poly.curves)
                {
                    this.beziers.push(bezier);
                }
            }
        } else if (Array.isArray(source))
        {
            this.beziers = source;
            polys = this.fromBeziers(source);
            
        } else if (source instanceof PathArea)
        {
            //this.clone(source);
            this.beziers = [];
            //The beziers define the path, so we need to clone them. That is sufficient to clone the path
            for (let bezier of source.beziers)
            {
                //new Bezier(bezier) is a copy constructor. It creates a new Bezier object with the same properties as bezier
                this.beziers.push(new Bezier(bezier));
            }
            polys = this.fromBeziers(this.beziers);
        } else
        {
            throw new Error('Invalid source type for Path constructor.');
        }
        //When we get here, the beziers array should be populated and we should have polys
        //Validate? Each poly should be a closed loop
        this.initLoops(polys);
        //console.log(this.beziers);
    }

    /**
     * Initializes the Path from an array of Bezier curves.
     * @param {Array} bezierArray - Array of Bezier curve objects.
     */
    fromBeziers(bezierArray)
    {
        let polys = [];
        let loop = [];
        for (let bezier of bezierArray)
        {
            if (bezier instanceof Bezier)
            {
                if (loop.length === 0)
                {
                    loop.push(bezier);
                    continue;
                }
                //Implied else

                //Is this a loop? Does startPoint = endPoint?
                //We need to handle orders other than 3. The best way is to do get(0) and get(1) and compare them
                if (bezier.get(0).x === loop[loop.length - 1].get(1).x && bezier.get(0).y === loop[loop.length - 1].get(1).y)
                {
                    polys.push(new PolyBezier(loop));
                    loop = [];
                    continue;
                }
                //Implied else

                loop.push(bezier);
            }
            else
            {
                throw new Error('Invalid source type for Path constructor.');
            }
        }
        return polys;
    }

    initLoops(polys)
    {
        this.loops = [];
        let global_t = 0;
        for (let poly of polys)
        {
            let length = poly.curves.length;
            this.loops.push(new LoopArea(global_t, global_t + length, poly, poly.cw, null));
            global_t += length;
        }
    }

    /**
     * Returns the spatial point for a given global t value.
     * @param {number} global_t - A float representing the t value relative to the entire Path.
     * @returns {Object} An object with x and y coordinates.
     */
    getPoint(global_t)
    {
        if (this.beziers.length === 0)
        {
            throw new Error('No Bezier curves in Path.');
        }

        //This is simpler to implement than one might expect. We just need to take the integer part of global_t and the fractional part of global_t
        //The integer part tells us which bezier we're on, and the fractional part tells us where on that bezier we are
        let bezierIndex = Math.floor(global_t);
        let local_t = global_t - bezierIndex;
        //console.log('getPoint', global_t, bezierIndex, local_t, this.beziers);
        return this.beziers[bezierIndex].get(local_t);
    }

    /**
     * Calculates the total length of the Path by summing lengths of all Bezier curves.
     * @returns {number} Total length of the Path.
     */
    getTotalLength()
    {
        return this.beziers.reduce((sum, bezier) => sum + bezier.getLength(), 0);
    }

    /**
     * Splits the Path into Bezier segments between two global t values.
     * @param {number} start_t - The global t value defining the start of the split range.
     * @param {number} end_t - The global t value defining the end of the split range.
     * @returns {Array} An array of Bezier curve segments representing the split portion.
     * 
     * There are two possible segments between start_t and end_t. If start_t < end_t, 
     * the segment is from start_t to end_t. If start_t > end_t, the segment is from 
     * start_t to the end of the path, then from the beginning of the path to end_t.
     */
    split(start_t, end_t)
    {
        //console.log('split', start_t, end_t);
        // Placeholder for splitting logic.
        // Example steps:
        // 1. Find the Bezier curves corresponding to start_t and end_t.
        // 2. Split these Beziers at the corresponding local t.
        // 3. Collect the Beziers between the split points.

        if (start_t === end_t)
        {
            return [];
        }

        //Determine which loop we're in
        let loopIndex = 0;
        while (loopIndex < this.loops.length && this.loops[loopIndex].end_t < start_t)
        {
            loopIndex++;
        }
        if (loopIndex === this.loops.length)
        {
            console.warn('start_t is beyond the end of the path.');
            return [];
        }
        //Both start_t and end_t must be in the same loop
        if (end_t >= this.loops[loopIndex].end_t)
        {
            console.warn('end_t is not in the same loop as start_t.');
            return [];
        }
        let startIndex = Math.floor(start_t);
        let endIndex = Math.floor(end_t);

        if (start_t > end_t)
        {
            console.log('start_t > end_t', start_t, end_t);
            //This will go from start_t to this.loops[loopIndex].end_t, then from this.loops[loopIndex].start_t to end_t
            //First segment could be partial
            let segments = [this.beziers[startIndex].split(start_t - startIndex, 1.0)];
            for (let i = startIndex + 1; i < this.loops[loopIndex].end_t; i++)
            {
                segments.push(this.beziers[i]);
            }
            for (let i = this.loops[loopIndex].start_t; i < endIndex; i++)
            {
                segments.push(this.beziers[i]);
            }
            //There is a weird edge case where end_t is an integer and the last segment is a full bezier.
            //In that case, we have the last segment in the loop above and we don't need to add it again
            //A little explanation is in order here. In the global t system, each integer is the end of one
            //bezier and the start of the next, so for end_t to be an integer, it must be the end of a bezier
            //In every other case, we have a partial bezier at the end
            if(end_t != endIndex)segments.push(this.beziers[endIndex].split(0, end_t - endIndex));
            return segments;
        }
        //Now we have a normal split with start_t < end_t
        //We need to handle the case where start_t and end_t are in the same bezier
        if (startIndex === endIndex)
        {
            return [this.beziers[startIndex].split(start_t - startIndex, end_t - startIndex)];
        }
        let segments = [this.beziers[startIndex].split(start_t - startIndex, 1.0)];
        for (let i = startIndex + 1; i < endIndex; i++)
        {
            segments.push(this.beziers[i]);
        }
        //We have the same weird edge case here. If end_t is an integer, we have a full bezier at the end
        //If not, we have a partial bezier at the end
        if (end_t != endIndex) segments.push(this.beziers[endIndex].split(0, end_t - endIndex));
        return segments;
    }

    /*
    * Sage (The name I gave my AI) did a code review and suggested subdividing findIntersections for clarity
    * and to make it easier to understand. I think that is a good idea. The first subdivision is a function
    * to take the bezier library intersections and extract the t values and convert them to global t values.
    */
    bezierLocalToGlobal(otherPath, tol = 0.01)
    {
        let rawIntersections = [];
        for (let i = 0; i < this.beziers.length; i++)
        {
            for (let j = 0; j < otherPath.beziers.length; j++)
            {
                //We need an interim object to hold the raw intersections with converted global t values
                let localIntersections = this.beziers[i].intersects(otherPath.beziers[j], tol);
                if (localIntersections.length === 0)
                {
                    //Use negative values to indicate no intersection between the beziers
                    //rawIntersections.push({ global_t1: -i, global_t2: -j });
                    continue;
                }
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
    * Sage (The name I gave my AI) did a code review and suggested subdividing findIntersections for clarity
    * The next subdivision is a function to get the loop index and the loop object for a given global t value
    * and organize the raw intersections into arrays of intersections for each loop
    */
    organizeIntersectionsByLoop(rawIntersections)
    {
        //This is where putting the beziers in an array pays off. We can just iterate through the arrays
        //Now we need to convert the rawIntersections into Intersection objects
        //We need to implement the overlap logic here, first we need to sort by global_t1
        rawIntersections.sort((a, b) => a.global_t1 - b.global_t1);
        //The logic is simple on one level. But becomes complicated by loops. First the simple part
        //An intersection or overlap starts after a gap greater then the minimum gap. Which is 2*tol
        //The first intersection gives us our start point and associated t values
        //Then we iterate through the intersections until the gap is greater than 2*tol
        //The last intersection gives us our end point and associated t values
        //Now the tricky part. We need to work with loops. We need to know which loop we're in.
        //The way to handle that is to extract the intersections for a given loop into their own array
        //This leads to the second complication. It is not likely, but it is possible that there are
        //two or more loops in the second path that have intersections with the first path
        //To handle these we need to sort by global_t2 and use the same logic as above
        //Now we will have arrays of intersections that have one loop from the first path and one loop
        //from the second path. We can then sort by global_t1 and global_t2 and assign next and cross_index
        //This is opening a can of worms, but I think some reasonable rules can be established to make the
        //logic work. First the loops in a given path must be disjoint. A note on that. If the loops are not
        //they should be able to be combined into a single loop. Second, each intersection involves two beziers
        //and therefore two loops. I believe that the contains and exit code assignment logic is valid.
        //Note these rules mean that there can't be a second loop in the middle of an overlap.
        let rawLoopIntersections = [];
        let irawIdx = 0;
        for (let i = 0; i < this.loops.length; i++)
        {
            rawLoopIntersections.push([]);
            let raw = rawIntersections[irawIdx];
            //console.log(raw, this.loops[i]);
            //This works because the rawIntersections are sorted by global_t1 and we fudged the t values
            //So that there can be no t value that is exactly on the boundary of end_t
            while (irawIdx < rawIntersections.length && raw.global_t1 < this.loops[i].end_t)
            {
                rawLoopIntersections[i].push(raw);
                irawIdx++;
                raw = rawIntersections[irawIdx];
            }
        }
        return rawLoopIntersections;
    }

    /*
    * Sage (The name I gave my AI) did a code review and suggested subdividing findIntersections for clarity
    * This is the core of the findIntersections function. It is the logic that processes the raw intersections
    * into intersections/overlaps. It is a little tricky because we have to handle the edge cases of overlaps
    * that wrap around the loop and two loops that are the same loops in the two paths. We also have to handle
    * the case where there are no intersections. This is the core of the function. The other functions are
    * just to make this one easier to understand. It has a bug and seems to have an endless loop. At a minimum
    * we need to do defensive programming to prevent the endless loop. The bug is that the last intersection
    * in the loop is not being processed. We need to process the last intersection in the loop and then break
    *
    * Things are a little more complicated than I thought. We need to handle cases where there are 0 or 1 intersections
    * between loops. In particular, the no intersections cases need to be handled, because the walkPath logic uses the
    * intersections to determine the next intersection. The logic is simple. If there are no intersections, we can
    * have disjoint loops or loops inside other loops.  And actually, the 1 intersection case is a touching intersection
    * and is a 0 intersection case.
    * 
    * Since we are working with loops and intersections here, this is the place to at least recognize the possibility
    * and prepare for the proper processing by the Area class.  The logic is simple. For unions, we take the outermost
    * CW path and the innermost CCW path. For intersections, we take the outermost CCW path and the innermost CW path.
    * If we apply this to disjoint loops, we will get the correct result. If we apply this to loops inside loops, we will
    * get the correct result. If we apply this to loops that touch, we will get the correct result. If we apply this to loops
    * that overlap, we will get the correct result.
    * 
    * I believe it should be a requirement that a given area does not have loops that overlap. This is a simple requirement
    * that can be enforced by the Area class. The logic is simple. If a CW loop is inside another CW loop, it is removed.
    * A CCW loop inside a CW loop represents a doughnot area. This is a valid area, but it is not a simple area. It should
    * be allowed. A CCW loop outside a CCW loop is removed. A CW loop inside a CCW loop is the negative of the doughnut shape.
    * This is a valid shape, but it is not a simple shape. It should be allowed. For example, if we were to subtract a
    * a doughnut shape from a rectangle, we would get a rectangle with a hole with a circle inside the hole. Effectively,
    * these are the union rules within a given area and they should apply anytime there are multiple loops in an area. For
    * subtraction, the rules are the same as for union, one just reverses the order of the second area and applies the union.
    * 
    * Intersections are a little more complicated, but should apply to multiple loops as well with order not mattering.
    * We take the outermost CCW loop and the innermost CW loop. I think it is valid to put all the loops in a single array
    * and combined the first with the second, then the results with the third, etc. This is a simple way to handle the
    * logic.
    */
    processIntersections(rawLoopIntersections, tol = 0.01)
    {
        let intersections = [];
        let gap = 5 * tol;
        for (let i = 0; i < this.loops.length; i++)
        {
            let loopIntersections = rawLoopIntersections[i];
            if (loopIntersections.length === 0) continue;

            this.loops[i].intersected = true;
            let endIdx = loopIntersections.length - 1;
            let startPoint = this.getPoint(loopIntersections[0].global_t1);
            let endPoint = this.getPoint(loopIntersections[endIdx].global_t1);
            while (utils.dist(startPoint, endPoint) < gap)
            {
                startPoint = { x: endPoint.x, y: endPoint.y };
                endIdx--;
                if (endIdx < 0) break;
                endPoint = this.getPoint(loopIntersections[endIdx].global_t1);
            }
            if (endIdx < 0)
            {
                //This is an overlap that wraps around the loop. This is an edge case that will be more common
                //than one might expect. For example, when my Storm Shutter completes a shutter, the last intersection
                //is an overlap that wraps around the loop. The logic is simple. The start and end t values are the same
                //The start and end points are the same. The direction is the same. The only difference is the global t values
                let sameLoop = new Intersection(loopIntersections[0].global_t1, loopIntersections[loopIntersections.length - 1].global_t1, loopIntersections[0].global_t2, loopIntersections[loopIntersections.length - 1].global_t2, true);
                sameLoop.same_loop = true;
                //For a while let's tell the world about this
                console.log('sameLoop', sameLoop);
                intersections.push(sameLoop);
                continue;
            }
            let startIdx = endIdx + 1;
            if (startIdx >= loopIntersections.length)
            {
                startIdx = 0;
                endIdx = loopIntersections.length - 1;
            }
            console.log('startIdx', startIdx, 'endIdx', endIdx);
            let start_t1 = loopIntersections[startIdx].global_t1;
            let start_t2 = loopIntersections[startIdx].global_t2;
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
                if (startIdx >= loopIntersections.length) startIdx = 0;

                let gap_t1 = loopIntersections[startIdx].global_t1;
                let gap_t2 = loopIntersections[startIdx].global_t2;
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
                    if (startIdx >= loopIntersections.length) startIdx = 0;
                    //New possible gap values
                    gap_t1 = loopIntersections[startIdx].global_t1;
                    gap_t2 = loopIntersections[startIdx].global_t2;
                    endPoint = this.getPoint(gap_t1);
                }
                console.log('Gap bottom of overlap loop', utils.dist(startPoint, endPoint));
                //We have another edge case.  When two curves come in at a shallow angle, the algorithm can find several intersections
                //that are closer than the minimum gap. The proble, is that because of the shallow angle, the intersections are not
                //necessarily in the correct order. The answer is to turn small overlaps into intersections. We can do this by checking
                //the distance between the end point and the start point. If it is less than 4*tol, we have an intersection.
                if (utils.dist(testStart, startPoint) < 6 * tol)
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
        }
        return intersections;
    }
    /*
    * Sage (The name I gave my AI) did a code review and suggested subdividing findIntersections for clarity
    * This is additional value in this subroutine. It is the logic that assigns the next intersection in the loop
    * and the link to the first intersection in the loop. It is a little tricky because we have to handle the edge
    * cases of the last intersection in the path and the last intersection in the loop. We also have to handle the
    * case where the next intersection is in the same loop and the case where the next intersection is in the next loop
    * 
    * The value added is that we can use the routine to assign the next intersection in the loop for both paths
    * Very tricky. Each sortedIntersections entry has a reference to the loop. We can use that to assign the first intersection
    * in the loop. The link property is the intersection to link to. The next property is the next element in the intersection
    * for the path we are linking. For example, if we are linking path 1, the next property is the path1.next property of the
    * intersection. If we are linking path 2, the next property is the path2.next property of the intersection. We can use the
    * same logic to assign the next intersection in the loop for both paths.
    */
    populateIntersectionLinks(sortedIntersections)
    {
        for (let i = 0; i < sortedIntersections.length; i++)
        {
            let loop= sortedIntersections[i].loop;
            if (loop.firstIntersection === null)
            {
                loop.firstIntersection = sortedIntersections[i].link;
                //This means the previous intersection is the last in its loop
                if (i > 0)
                {
                    let prevLoop = sortedIntersections[i - 1].loop;
                    //The prev next reference should point to the first intersection in the previous 
                    sortedIntersections[i - 1].path.next = prevLoop.firstIntersection;
                }
            }
            if (i == sortedIntersections.length - 1)
            {
                //This is the last intersection in the path and by definition the last in the loop
                //NOTE: By doing the first intersection above, we guarantee that the edge case of the last intersection
                //being the only intersection in the loop is handled
                sortedIntersections[i].path.next = loop.firstIntersection;
                continue;
            }
            //Implied else

            //Because we handled the last intersection above and continued, we can assume that there is a next intersection
            //NOTE: This could be the last intersection in the loop, but we don't know that yet. We fix this on the
            //next pass when we find a new loop. Until then, the set value assumes that the next intersection is in the same loop
            sortedIntersections[i].path.next = sortedIntersections[i + 1].link;
        }
    }

    /**
     * Finds intersections or overlaps between this Path and another Path.
     * @param {PathArea} otherPath - The Path to intersect with.
     * @returns {Array} An array of Intersection objects.
     */
    findIntersections(otherPath, tol=0.01)
    {
        let gap = 5 * tol;
        //See above for the logic of the function. In a nutshell get raw intersections in global t values
        let rawIntersections = this.bezierLocalToGlobal(otherPath, tol);
        //console.log('rawIntersections', rawIntersections);
        //Now we take the raw intersections and organize them by loop
        let rawLoopIntersections = this.organizeIntersectionsByLoop(rawIntersections);
        console.log('rawLoopIntersections', rawLoopIntersections);
        //Now we process the intersections
        this.intersections = this.processIntersections(rawLoopIntersections, tol);
        console.log('intersections', this.intersections);

        //Now we have all the intersections. We need to sort them by global_t1 and global_t2
        // Sort by global_t1 and assign path1.next
        this.intersections.sort((a, b) => a.path1.start_t - b.path1.start_t);
        let sorted = [];
        //We are creating an array of objects that contain the loop, the link, and the next intersection for path1
        for (let i = 0; i < this.intersections.length; i++)
        {
            let loopIdx = this.getLoopInfo(this.intersections[i].path1.start_t).loopIndex;
            sorted.push({loop: this.loops[loopIdx], link: this.intersections[i], path: this.intersections[i].path1 });
        }
        this.populateIntersectionLinks(sorted);
        //for (let i = 0; i < this.intersections.length; i++)
        //{
        //    this.intersections[i].path1.next = sorted[i].next;
        //}

        // Sort by global_t2 and assign path2.next; This sort is trickier. We still want to sort by the start of the overlap
        //If sameDirection is true, the start is the start of the overlap. If sameDirection is false, the end is the start of the overlap
        //The above comments were before we made a change to simplify the logic. We now sort by path2.entry_t
        this.intersections.sort((a, b) => a.path2.entry_t - b.path2.entry_t);
        sorted = [];
        for (let i = 0; i < this.intersections.length; i++)
        {
            let loopIdx = otherPath.getLoopInfo(this.intersections[i].path2.entry_t).loopIndex;
            sorted.push({ loop: otherPath.loops[loopIdx], link: this.intersections[i], path: this.intersections[i].path2 });
        }
        this.populateIntersectionLinks(sorted);
        //for (let i = 0; i < this.intersections.length; i++)
        //{
        //    this.intersections[i].path2.next = sorted[i].next;
        //}
        sorted = null;

        //Our this.intersections are linked. We can now calculate the exit codes
        //Our links have broken the intersections into loops. We must enter each loop using the firstIntersection
        //Also we don't need to be concerned about the sorting of the base array. We can use the linked list
        for (let i = 0; i < this.loops.length; i++)
        {
            if (this.loops[i].firstIntersection === null) continue;
            let loop = this.loops[i];
            let thisIntersection = loop.firstIntersection;
            let firstT = thisIntersection.path1.end_t;
            while (thisIntersection.path1.exit_code == 0)
            {
                //This code is not been calculated
                let nextIntersection = thisIntersection.path1.next;
                //console.log(nextIntersection);
                let nextT = nextIntersection.path1.start_t;
                //We need to handle the edge case of one intersection in the loop
                //By definition it is a touching intersection
                //This could be detected several ways, but the most effective is to compare the t values
                if (nextT - firstT < gap)
                {
                    //nudge firstT
                    firstT += gap;
                    if (firstT > loop.end_t) firstT = loop.start_t;
                }
                let midPoint = this.getMidPoint(firstT, nextT);
                let otherLoop = otherPath.getLoopInfo(thisIntersection.path2.end_t).loopIndex;
                let contains = otherPath.loops[otherLoop].PolyBezier.contains(midPoint);
                thisIntersection.path1.midPoint = midPoint;
                //console.log('Path1 midPoint', contains, midPoint);
                //Now we can assign the exit code based on contains and CW or CCW for both loops
                thisIntersection.path1.exit_code = this.calculateExitCode(contains, loop.direction, otherPath.loops[otherLoop].direction);
                firstT = nextIntersection.path1.end_t;
                thisIntersection = nextIntersection;
            }
        }
        //We have the path1 exit codes. We can now calculate the path2 exit codes
        //We can use the same logic as above. We need to enter each loop using the firstIntersection
        for (let i = 0; i < otherPath.loops.length; i++)
        {
            if (otherPath.loops[i].firstIntersection === null) continue;
            let loop = otherPath.loops[i];
            let thisIntersection = loop.firstIntersection;
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
                let thisLoop = this.getLoopInfo(thisIntersection.path1.end_t).loopIndex;
                let contains = this.loops[thisLoop].PolyBezier.contains(midPoint);
                //console.log('Path2 midPoint', contains, midPoint);
                //console.log(this.loops[thisLoop].PolyBezier);
                thisIntersection.path2.midPoint = midPoint;
                //Now we can assign the exit code based on contains and CW or CCW for both loops
                thisIntersection.path2.exit_code = this.calculateExitCode(contains, loop.direction, this.loops[thisLoop].direction);
                firstT = nextIntersection.path2.exit_t;
                thisIntersection = nextIntersection;
            }
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
        for (let loop of this.loops)
        {
            let intersection = loop.firstIntersection;
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
                if (intersection == loop.firstIntersection) break;
            }
            //We were missing the last intersection in the loop
            if (intersection.path1.exit_code != lastExitCode)
            {
                flipCount++;
            }
            if (flipCount % 2 != 0) console.warn(`Invalid number of crossings (${flipCount}). There must be an even number of crossings.`);
        }
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
            if (!thisOrientation && oppositeOrientation ) return -1;
            if (!thisOrientation && !oppositeOrientation ) return 1;
        } else
        {
            if (thisOrientation  && oppositeOrientation ) return -1;
            if (thisOrientation  && !oppositeOrientation ) return 1;
            if (!thisOrientation && oppositeOrientation ) return 1;
            if (!thisOrientation && !oppositeOrientation ) return -1;
        }
    }

    getLoopInfo(global_t)
    {
        let loopIndex = 0;
        while (loopIndex < this.loops.length && this.loops[loopIndex].end_t < global_t)
        {
            loopIndex++;
        }
        if (loopIndex === this.loops.length)
        {
            console.warn('global_t is beyond the end of the path.', global_t, this.loops);
            return null;
        }
        return { loopIndex: loopIndex, loop_t: global_t - this.loops[loopIndex].start_t };
    }

    getMidPoint(firstT, secondT)
    {
        let firstLoop = this.getLoopInfo(firstT);
        let secondLoop = this.getLoopInfo(secondT);
        if (firstLoop.loopIndex != secondLoop.loopIndex)
        {
            console.warn('Midpoint points are in different loops.');
            return null;
        }
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
        let midT = (this.loops[firstLoop.loopIndex].start_t + this.loops[firstLoop.loopIndex].end_t) / 2;
        let sizeT = this.loops[firstLoop.loopIndex].end_t - this.loops[firstLoop.loopIndex].start_t;
        if (average > midT) return this.getPoint(average - sizeT / 2);

        return this.getPoint(average + sizeT / 2);

        //if (average > midT)
        //{
        //    return this.getPoint(midT - (average - midT));
        //}
        ////Implied else

        //return this.getPoint(midT + (midT - average));
        //let upperDelta = this.loops[firstLoop.loopIndex].end_t - firstT;
        //let lowerDelta = secondT - this.loops[firstLoop.loopIndex].start_t;
        //if (upperDelta > lowerDelta)
        //{
        //    //Add 0.5 to the average to get the midpoint
        //    return this.getPoint(((firstT + secondT) / 2) + 0.5);
        ////    return this.getPoint((firstT + this.loops[firstLoop.loopIndex].end_t + lowerDelta) / 2);
        //}
        ////Implied else

        ////Subtract 0.5 from the average to get the midpoint
        ////Add 0.5 to the average to get the midpoint
        //return this.getPoint(((firstT + secondT) / 2) - 0.5);

        //return this.getPoint((firstT + this.loops[firstLoop.loopIndex].start_t - upperDelta) / 2);
    }

    toSVG()
    {
        console.log(this);
        return Bezier.toSVG(this.beziers);
    }
    reverse()
    {
        //console.log(this.toSVG());
        let newBeziers = [];
        for (let i = this.beziers.length - 1; i >= 0; i--)
        {
            newBeziers.push(this.beziers[i].reverse());
        }
        let polys = this.fromBeziers(newBeziers);
        this.initLoops(polys);
        //console.log(this.toSVG());
    }
}

export { PathArea };
export default PathArea;

