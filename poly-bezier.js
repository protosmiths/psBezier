import { utils } from "./utils.js";
//const PolyBezier = (function () {
/**
 * Poly Bezier
 * @param {[type]} curves [description]
 */
export class PolyBezier
{
    static debugObj = null;
    constructor(curves)
    {
        this.curves = [];
        this._3d = false;
        if (!!curves)
        {
            if (curves.constructor.name == 'PolyBezier')
            {
                //console.log('Cloning a PolyBezier', curves);
                for (let iIdx = 0; iIdx < curves.curves.length; iIdx++)
                {
                    this.curves.push(new Bezier(curves.curves[iIdx]));
                }
            } else
            {
                this.curves = curves;
            }
            //if(this.curves[0]._3d != 'undefined')this._3d = this.curves[0]._3d;
        }
        // let cwCnt = 0;
        // //console.log(this.curves);
        // let lastp = this.curves[0].get(0);
        // for(let iIdxToken = 1; iIdxToken < this.curves.length; iIdxToken++){
        // let curve =  this.curves[iIdxToken];
        // let angle = utils.angle(curve.get(0), lastp, curve.get(1));
        // cwCnt += (angle > 0)?-1:1;
        // lastp = curve.get(0);
        // }
        //SMGTODO This section is much improved.  The concept is good but there are still problems
        //For a properly closed shape we should always get plus or minus 2*pi. Actually, I just realized
        // that when doing offsets and doing the joins can create loops.  In those cases we could have
        //values that are multiples of 2*pi. One thing I have seen are values near 180. This should not
        //be possible. In general, a single bezier does not go that far. And a line should be 0 (suspect
        //there is a problem with the endpoint derivatives of lines). In any case, I am seeing unexpected
        //values.
        let cwCnt = 0;
        let lastPt = this.curves.at(-1).get(0);
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let thisPt = this.curves[iIdx].get(0);
            cwCnt += (thisPt.x - lastPt.x) * (thisPt.y + lastPt.y);
            lastPt = { x: thisPt.x, y: thisPt.y };
        }
        // let lastDeri = this.curves.at(-1).derivative(1);
        // lastDeri = {pt:lastDeri, size:Math.sqrt(lastDeri.x*lastDeri.x + lastDeri.y*lastDeri.y)};
        // // console.log('end derivative', lastDeri);
        // for (let iIdxToken = 0; iIdxToken < this.curves.length; iIdxToken++) {
        // let angle;
        // let curve = this.curves[iIdxToken];
        // // let d0 = utils.point_unit(curve.derivative(0));
        // let d0 = curve.derivative(0);
        // d0 = {pt:d0, size:Math.sqrt(d0.x*d0.x + d0.y*d0.y)};
        // // let d1 = utils.point_unit(curve.derivative(0));
        // let d1 = curve.derivative(1);
        // d1 = {pt:d1, size:Math.sqrt(d1.x*d1.x + d1.y*d1.y)};
        // // curve.update();
        // let dist = utils.dist(lastDeri.pt, d0.pt);
        // if(lastDeri.size > 0.1 && d0.size > 0.1 && dist > 0.1)
        // {
        // // angle = utils.angle({
        // // x: 0,
        // // y: 0
        // // }, utils.point_unit(lastDeri.pt), utils.point_unit(d0.pt));
        // angle = utils.angle({
        // x: 0,
        // y: 0
        // }, utils.point_unit(d0.pt), utils.point_unit(d1.pt));
        // cwCnt += angle;
        // //if(angle > 0.9*Math.PI || angle < -0.9*Math.PI)
        // {
        // // console.log('angle', 180*angle/Math.PI);
        // // console.log('iIdxToken lastDeri derivative(0)', iIdxToken, lastDeri.pt, d0.pt);
        // // console.log('sizes', lastDeri.size, d0.size);
        // }
        // }
        // dist = utils.dist(d0.pt, d1.pt);
        // if(d0.size > 0.1 && d1.size > 0.1 && dist > 0.1)
        // {
        // // angle = utils.angle({
        // // x: 0,
        // // y: 0
        // // }, utils.point_unit(d0.pt), utils.point_unit(d1.pt));
        // angle = utils.angle({
        // x: 0,
        // y: 0
        // }, utils.point_unit(d0.pt), utils.point_unit(d1.pt));
        // cwCnt += angle;
        // //if(angle > 0.9*Math.PI || angle < -0.9*Math.PI)
        // {
        // // console.log('angle', 180*angle/Math.PI);
        // // console.log('iIdxToken derivative(0) derivative(1)', iIdxToken, d0, d1);
        // // console.log('sizes', d0.size, d1.size);
        // }
        // }
        // lastDeri = d1;
        // }
        // if(Math.abs(cwCnt) < Math.PI)
        // {
        // let tot = 0;
        // for(let iIdxToken = 0; iIdxToken < this.curves.length; iIdxToken++)
        // {
        // let dAng = utils.angle({x:0, y:0}, {x:1, y:0}, this.curves[iIdxToken].derivative(1));
        // tot += dAng;
        // console.log('dAng', 180*dAng/Math.PI, 180*tot/Math.PI);
        // }
        // // console.log('this.curves', this.curves);
        // }

        // curves.forEach(function(curve){
        // //console.log("PolyBezier curve.clockwise", curve.clockwise);
        // cwCnt += (curve.clockwise)?1:-1;
        // });
        this.cw = (cwCnt >= 0);
        // console.log("PolyBezier cw", cwCnt, this.cw);
    }

    valueOf()
    {
        return this.toString();
    }

    toString()
    {
        return (
            "[" +
            this.curves
                .map(function (curve)
                {
                    return utils.pointsToString(curve.points);
                })
                .join(", ") +
            "]");
    }

    addCurve(curve)
    {
        this.curves.push(curve);
        this._3d = this._3d || curve._3d;
    }

    length()
    {
        return this.curves
            .map(function (v)
            {
                return v.length();
            })
            .reduce(function (a, b)
            {
                return a + b;
            });
    }

    curve(idx)
    {
        return this.curves[idx];
    }

    bbox()
    {
        const c = this.curves;
        var bbox = c[0].bbox();
        for (var i = 1; i < c.length; i++)
        {
            utils.expandbox(bbox, c[i].bbox());
        }
        return bbox;
    }

    //Some discussion, at an intersection we are crossing another curve.  There are four possible transitions for a curve
    //One, the curve was inside and passes to the outside.
    //Two, the curve was outside the closed shape and it passes to the inside.
    //Three, the curve is inside and stays inside.
    //Four, two outside lines cross. This is theoretically possible, but shouldn't occur in an offset shape
    //The second transition is always true if the curve is outside.
    //The third transition is always true if both curves are inside
    //The first transition is where the magic happens.  Defining it will be key.
    //We will code these transitions by using bits to represent the state of the line at that intersection.
    //Bit 0 is the state entering and bit 1 the state leaving. 0 indicates outside and 1 inside
    // a 0 initializes
    // 1 going from inside to out
    // 2 going from outside to in
    // 3 staying inside
    //
    // Another note at an intersection where an outside line goes inside the other line must pick
    // up and become the outside line.  The path goes in the same direction for all curves so
    // a 1 transition must be matched to a 2 transition and visa versa.  If that is not possible then
    // it must be a 3 to a 3
    //
    // Another factor is the cross product.  For a path going inside (transition 2) it is positive.
    // A path going outside (transition 1) is negative. For crossing paths that stay inside or
    // outside the 1st cross is negative. At any given intersection the number of positive crosses
    // must equal the number of negative in the path between the two intersecting segments.
    //
    // Let us walk a path with some possible transitions. The path will start outside and go inside
    // it will make a loop inside and then
    //
    // This routine is to be called twice.  On the first pass all transitions are 0 and can get no
    // information from the matching intersection.  The 2nd pass will resolve the
    determineTransitions(intersections, lastTransition)
    {
        for (let iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            let iThis = intersections[iIdx];
            if (iThis.iCode < 0)
            {
                //Intersection with inner shape.  There is no xref
                //Just set the last transition to indicate we are inside for sure
                lastTransition = 3;
                continue;
            }
            switch (lastTransition)
            {

                //These last transitions indicate the path went or stayed inside at the previous intersection
                case 2:
                case 3:
                    let otherTransition = intersections[iThis.xref].transition;
                    if (otherTransition == 3)
                    {
                        iThis.transition = 3;
                    } else
                    {
                        iThis.transition = 1;
                        intersections[iThis.xref].transition = 2;
                    }
                    break;

                case 0: //Assumed to be outside
                case 1: //Went outside at the last transition
                    iThis.transition = 2; //Going inside
                    intersections[iThis.xref].transition = 1; //Going outside
                    break;

            }
            lastTransition = iThis.transition;
        }
        return lastTransition;
    }

    getOuterPath(offset, intersections)
    {
        let outerOffset = [];
        let iCdx = 0;
        for (let iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            let inter1 = intersections[iIdx];
            if (inter1.routed != undefined)
                continue;

            inter1.routed = true;
            switch (inter1.transition)
            {
                case 0: //Shouldn't happens
                    //console.log("getOuterPath 0 transition found at intersection ", iIdxToken, inter1);
                    continue;

                case 1:
                    //Start of a path
                    break;

                case 2:
                    continue; //Going inside
                    break;

                case 3:
                    continue; //Not on a path
                    break;
            }

            //We get here when we have an intersection where we are going to the outside
            //This intersection is in a curve, it could have another intersection on it.
            //If so the next intersection should be going inside
            //If not we should be following the path to the next intersection
            let nextIdx = iIdx + 1;
            if (nextIdx >= intersections.length)
                nextIdx = 0;
            while (nextIdx != iIdx)
            {
                iCdx++;
                if (iCdx >= 20)
                    return outerOffset;
                //console.log("getOuterPath inter1", inter1);
                let thisC = inter1.refC;
                let curve = offset[thisC];
                let nextInter2 = intersections[nextIdx];
                nextInter2.routed = true;
                //console.log("getOuterPath nextInter2", nextInter2);
                //console.log("getOuterPath inter1, nextInter2", inter1, nextInter2);
                //console.log("getOuterPath inter1.th, nextInter2.th", inter1.th, nextInter2.th);
                if (nextInter2.transition == 3)
                {
                    //We are going on the inside
                    break;
                }
                if (nextInter2.transition != 2)
                {
                    console.log("getOuterPath intersection transition is not the expected 2", nextIdx, nextInter2);
                }
                if (thisC == nextInter2.refC)
                {
                    console.log("getOuterPath inter1.th, nextInter2.th", inter1.th, nextInter2.th);
                    if (inter1.th != nextInter2.th)
                        outerOffset.push(curve.split(inter1.th, nextInter2.th));
                } else
                {
                    //console.log("getOuterPath curve.split(inter1.th, 1)", inter1.th, curve.split(inter1.th, 1));
                    outerOffset.push(curve.split(inter1.th, 1));
                    thisC++;
                    if (thisC >= offset.length)
                        thisC = 0;
                    while (thisC != nextInter2.refC)
                    {
                        console.log("getOuterPath offset[thisC]", offset[thisC]);
                        outerOffset.push(offset[thisC]);
                        thisC++;
                        if (thisC >= offset.length)
                            thisC = 0;
                    }
                    curve = offset[thisC];
                }
                //We are the curve with the next intersection
                if (inter1.refC == nextInter2.refC)
                {
                    if (inter1.iCode < 0)
                    {
                        //We should not be
                        console.log("trying to put inner path on outer path", inter1);
                        return outerOffset;
                    }
                    console.log("getOuterPath curve.split(inter1.th, nextInter2.th)", inter1.th, nextInter2.th, curve.split(inter1.th, nextInter2.th));
                    if (inter1.th != nextInter2.th)
                        outerOffset.push(curve.split(inter1.th, nextInter2.th));
                } else
                {
                    //console.log("getOuterPath curve.split(0, nextInter2.th)", nextInter2.th, curve.split(0, nextInter2.th));
                    if (nextInter2.th != 0)
                        outerOffset.push(curve.split(0, nextInter2.th));
                }

                nextIdx = nextInter2.xref;
                if (nextIdx == iIdx)
                    break;
                inter1 = intersections[nextIdx];
                inter1.routed = true;
                if (inter1.transition != 1)
                {
                    console.log("getOuterPath linked intersection transition is not the expected 1", nextIdx, inter1);
                }

                nextIdx++;
                if (nextIdx >= intersections.length)
                    nextIdx = 0;
            }
            //console.log("getOuterPath a path", outerOffset);
            return outerOffset;
        }
        return null;
    }

    static NO_JOIN = 0;
    static MITER_JOIN = 1;
    static CORNER_JOIN = 2;
    static RADIUS_JOIN = 3;

    /*
     * This function as written does not take into account the gaps and overlaps
     * between offset curves. The join parameter fixes this.
     *
     * Previously we did the join and then searched for intersections.  We are going
     * to reverse the order.  There are a couple of advantages. One the intersection
     * search will remove some joints.  Second it will leave simpler joints.
     *
     * The intersection search will do two things. One it will remove parts past the
     * odd number intersections. Two it will create new polys after even number.
     * The algorithm might need to be fine tuned, but initially it will be assumed
     * the starting point is on a curve to be saved.  The intersection numbering is
     * tricky.  The search algorithm searches forward from a given segment to find
     * other segments that intersect.  If there are no other intersections before
     * getting to the second segment, then the intersection is odd and the segments
     * are removed.  If another intersection is found, it is even and the segments
     * following it are kept.
     *
     * We will do the intersection search in two steps.  First we will find and number.
     * Then we will split and remove and generate new polys.
     *
     * Looking at some curves and one can see that the numbering rule is not a complete
     * solution.  One can find examples where it does not work.  The clue is that there
     * is an "inside" and an "outside".  If the curve crosses into the inside both sides
     * of it are "inside". A curve that crosses it does not go "outside".  So one instead
     * of numbers one must track the "inside" and "outside" of a curve.
     *
     * Each intersection has two or more lines crossing.  These lines are all split at the
     * intersection. Of the 4 or more lines only lines are adjacent to a line that has the
     * "outside" on the same side. Normally, this means that at most two lines are on the
     * "outside". It is possible for multiple curves to kiss and have more than 2 "outside"
     * lines.  This would be very rare.  If the logic of adjacent "outsides" is applied
     * correctly, this condition would be detected.
     *
     * More discussion about algorithm.  As we travel around the loop, the first time we
     * get to an intersection we only "know" the
     *
     * At a higher level, winding rules would apply.  We are not going use them here. At
     * this level we will assume that "inside" is the side closest to the curve and the
     * "outside" is the side further out. By definition a positive offset is to the right
     * of the direction of travel.
     */
    /*
     * I am revisiting the offset improvements. Since the above discussion I have improved
     * algorithms for finding intersections and combining areas.  Those algorithms should be
     * of use for the offset function. First we will use the cw/ccw rule for combined shapes.
     * It turns out that this rule puts a positive offset on the outside of cw shapes and the
     * inside of ccw shapes (or holes) as expected.
     *
     * Offsets below a certain size for a given set of shapes will not need the area functions
     * and will have simple scenarios for joining the offset curves.  As the offset value
     * increases the situation becomes more complex. The offset curves from adjacent shapes may
     * overlap and need to be added together. More complex will be the overlap of offset curves
     * from the same shape.  In those cases, the intersections should be detected and the rule
     * of following the outer path should apply.  The outermost path is a little difficult since
     * the test points will be on the curve. In the area add algorithm, each intersection has two
     * paths out. It choses the most likely one and tests if that choice is correct. If it is not,
     * the other path is taken, no testing required. Additional complexity, when the shape self
     * intersects there will be intersections that are entirely inside.  They have no outside path.
     * One may start on one of those intersections.  The algorithm must recognize this and move to
     * an intersection on the outside to start.  There will be only one outermost path for a self
     * intersecting shape.  One is guaranteed to make it back to the same intersection. Thyere are
     * other combinations where that is not true. For example, a subtracting shape could split
     * a positive shape into two or more shapes. Once we remove the self-intersections, we use the
     * area functions to combine the shapes.
     *
     * We discussed how to handle self-intersecting shapes
     * before discussing joining the offset shapes.  That is because some of the joins can leverage
     * the fact that this operation will follow.  When we generate offset curves we should look for
     * how adajcent curves interact. The most direct is that they intersect.  In that case,
     * we truncate the two curves at the intersection.  It is more complex when they don't
     * intersect.
     *
     * Even more complex is when the offset of some curves intersect curves that are not adajcent
     *
     * There are three possible join types (jtype parameter). They are NO_JOIN (default choice)
     * MITER_JOIN, CORNER_JOIN, and RADIUS_JOIN. The miter join joins the endpoints with a line.
     * The corner join extends the curves along the tangent to the endpoint until their intersection.
     * The radius join uses an arc whose center of radius is the intersection of the normals to the
     * endpoints. This creates an arc that is tangent to the endpoints and has a radius of the offset.
     *
     * Now a disussion about removing the parts of offsets that are too close to other curves.  When
     * two offsets intersect, each intersect crosses into the region that is too close to the curve
     * of the opposite offset. These segments must be removed.  It is also possible for the offsets
     * to continue on to another intersection beyond which they have the right spacing and should be
     * kept. The algorithm for finding self intersections is a little tricky
     */
    offset(d, jtype)
    {

        const offset = [];
        // Generate the offsets.  Note
        this.curves.forEach(function (v)
        {
            offset.push(...v.offset(d)); //Equivalent to offset = offset.concat(segOffsets);
            // if(!v._linear)
            // {
            // let segOffsets = v.offset(d);
            // for(let iIdxToken = 0; iIdxToken < segOffsets.length; iIdxToken++)
            // {
            // offset.push(segOffsets[iIdxToken]);
            // if (PolyBezier.debugObj != null) {
            // DrawUtils.displayPoint(segOffsets[iIdxToken].points[0], 0.05, PolyBezier.debugObj, '#ff0000');
            // DrawUtils.displayPoint(segOffsets[iIdxToken].points[1], 0.01, PolyBezier.debugObj, '#00ff00');
            // DrawUtils.displayPoint(segOffsets[iIdxToken].points[2], 0.01, PolyBezier.debugObj, '#00ff00');
            // DrawUtils.displayPoint(segOffsets[iIdxToken].points[3], 0.05, PolyBezier.debugObj, '#0000ff');
            // }

            // }
            // }
        });
        // console.log('offset', offset);
        // let adjT = [];
        // offset.forEach(function(){adjT.push([0,1])});
        let len = offset.length;
        for (let iIdx = len - 1; iIdx >= 0; iIdx--)
        {
            if (offset[iIdx].length() >= d / 40) continue;
            offset.splice(iIdx, 1);
        }
        let offsets = new PolyBezier(offset);
        // console.log('offsets cw', offsets.cw);
        //NOTE turns out joins must come first. The joins themselves could be part of the
        //overlaps detected by intersections.
        offsets.join(d, jtype);
        // console.log('offsets', offsets);
        let arrSelfies = offsets.self_intersections(d / 50);
        let selfies = arrSelfies[0];
        if (selfies.length == 0)
        {
            return [offsets];
            // return [offsets, arrSelfies[0]];
        }
        if (selfies.length == 1)
        {
            let newLoop = [];
            //Take the long way round
            let thisI = selfies[0];
            let branch = 0;
            if (thisI.idx[0] < thisI.idx[1]) branch = 1;
            let curveIdx = thisI.idx[branch];
            newLoop.push(offsets.curves[curveIdx++].split(thisI.t[branch], 1));
            while (curveIdx != thisI.idx[branch ^ 1])
            {
                if (curveIdx >= offsets.curves.length) curveIdx = 0;
                newLoop.push(new Bezier(offsets.curves[curveIdx++]));
            }
            newLoop.push(offsets.curves[curveIdx++].split(0, thisI.t[branch ^ 1]));
            return [new PolyBezier(newLoop)];
            // return [[new PolyBezier(newLoop)], arrSelfies[0]];
        }
        //This way of making sorted lists does not work for these intersections. The problem is that
        //for these intersection there is one poly and the idx element for the next intersection
        //could be either branch. To make matters worse each intersection does not have a relationship
        //with the next that is meaningful for our purposes. One answer is to "sort" each intersection
        //selfies = this.makeSortedLists(selfies);
        //let header = selfies.pop();
        ///let idx0 = header.next[0];
        // console.log('selfies before', selfies);
        //The 0 side follows the path, we now need the 1 side to follow the branches
        //Following the path is not enough. We should show the adjacent intersections
        /*
        * As one gets a better understanding, things can suddenly become clear. It is convenient to
        * view the shape as a real line where we start at 0 and go to 1 with real number on curve 0.
        * At curve 1 we go from 1.0 to 2, etc. Every intersection exists at two of these real numbers.
        * One enters the intersection on one of the curves leading up to one of the values.  There are
        * two paths in. There are two paths out leaving starting at one of the points on the intersection.
        * Which point is represented by the 0 and 1 indexes. so idx[0] + t[0] is one point and idx[1] + t[1]
        * the other point. The next intersection is the one with the next higher value, it could be either
        * point. It doesn't matter.  It is possible that the next point is the opposite point in the same
        * intersection.
        */
        let debugI = false;
        for (let iIdx = 0; iIdx < selfies.length; iIdx++)
        {
            let thisI = selfies[iIdx];
            if (selfies.length == 1)
            {
                thisI.prev = [0, 0];
                thisI.next = [0, 0];
                continue;
            }
            // console.log('thisI', thisI);
            //We enter the intersection on the curve on the 0 index and leave to the next
            //intersection on the 1 curve.  The branch is on the upper side of the 0 curve
            let path0Start = thisI.realIdx[0];
            let path1Start = thisI.realIdx[1];
            if (debugI)
            {
                console.log('');
                console.log('iIdxToken path0Start path1Start', iIdx, path0Start, path1Start);
            }
            //If we go through the loop and a field is still -1, we have a wraparound
            thisI.prev = [-1, -1];
            thisI.next = [-1, -1];
            thisI.nextVal = [-1, -1];
            thisI.prevVal = [-1, -1];
            //Now we know where the present intersection is along the path. We search for
            //the next and previous intersection on each branch. Wraparound is tricky
            for (let iJdx = 0; iJdx < selfies.length; iJdx++)
            {
                // if(iJdx == iIdxToken)continue; //We will find short loops later
                //We will include the possiblity of a loop
                //if(iJdx == iIdxToken)continue;
                let possibleI = selfies[iJdx];
                let poss0 = possibleI.realIdx[0];
                let poss1 = possibleI.realIdx[1];
                //This intersection crosses at the two points above, the possible next is the closest
                //higher
                if (debugI) console.log('iJdx possible0Idx possible1Idx', iJdx, poss0, poss1);
                if (poss0 > path0Start && iIdx != iJdx)
                {
                    //This intersection is after the being tested
                    if (thisI.next[0] < 0)
                    {
                        //This is the first one found
                        thisI.next[0] = iJdx;
                        thisI.nextVal[0] = poss0;
                        if (debugI) console.log('1st next[0] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                    } else
                    {
                        //Is this intersection closer than the one we have now?
                        if (poss0 < thisI.nextVal[0])
                        {
                            thisI.next[0] = iJdx;
                            thisI.nextVal[0] = poss0;
                            if (debugI) console.log('Better next[0] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                        }
                    }
                }
                if (poss1 > path0Start)
                {
                    if (thisI.next[0] < 0)
                    {
                        thisI.next[0] = iJdx;
                        thisI.nextVal[0] = poss1;
                        if (debugI) console.log('1st next[0] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss1 < thisI.nextVal[0])
                        {
                            thisI.next[0] = iJdx;
                            thisI.nextVal[0] = poss1;
                            if (debugI) console.log('Better next[0] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                        }
                    }
                }
                if (poss0 > path1Start)
                {
                    // if(thisI.next[1] < 0)thisI.next[1] = iJdx;
                    if (thisI.next[1] < 0)
                    {
                        thisI.next[1] = iJdx;
                        thisI.nextVal[1] = poss0;
                        if (debugI) console.log('1st next[1] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss0 < thisI.nextVal[1])
                        {
                            thisI.next[1] = iJdx;
                            thisI.nextVal[1] = poss0;
                            if (debugI) console.log('Better next[1] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                        }
                    }
                }
                if (poss1 > path1Start && iIdx != iJdx)
                {
                    // if(thisI.next[1] < 0)thisI.next[1] = iJdx;
                    if (thisI.next[1] < 0)
                    {
                        thisI.next[1] = iJdx;
                        thisI.nextVal[1] = poss1;
                        if (debugI) console.log('1st next[1] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss1 < thisI.nextVal[1])
                        {
                            thisI.next[1] = iJdx;
                            thisI.nextVal[1] = poss1;
                            if (debugI) console.log('Better next[1] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                        }
                    }
                }
                // if(poss0  < path0Start)
                // {
                // if(thisI.prev[0] < 0)
                // {
                // thisI.prev[0] = iJdx;
                // }else
                // {
                // //Do we have a better match
                // if(poss0 > selfies[thisI.prev[0]].idx[0] + selfies[thisI.prev[0]].t[0])
                // {
                // thisI.prev[0] = iJdx;
                // }
                // }
                // }
                // if(poss1  < path1Start)
                // {
                // // if(thisI.prev[1] < 0)thisI.prev[1] = iJdx;
                // if(thisI.prev[1] < 0)
                // {
                // thisI.prev[1] = iJdx;
                // }else
                // {
                // //Do we have a better match
                // if(poss1 > selfies[thisI.prev[1]].idx[1] + selfies[thisI.prev[1]].t[1])
                // {
                // thisI.prev[1] = iJdx;
                // }
                // }
                // }
                if (poss0 < path0Start && iIdx != iJdx)
                {
                    //This intersection is after the being tested
                    if (thisI.prev[0] < 0)
                    {
                        //This is the first one found
                        thisI.prev[0] = iJdx;
                        thisI.prevVal[0] = poss0;
                        if (debugI) console.log('1st prev[0] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                    } else
                    {
                        //Is this intersection closer than the one we have now?
                        if (poss0 > thisI.prevVal[0])
                        {
                            thisI.prev[0] = iJdx;
                            thisI.prevVal[0] = poss0;
                            if (debugI) console.log('Better prev[0] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                        }
                    }
                }
                if (poss1 < path0Start)
                {
                    if (thisI.prev[0] < 0)
                    {
                        thisI.prev[0] = iJdx;
                        thisI.prevVal[0] = poss1;
                        if (debugI) console.log('1st prev[0] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss1 > thisI.prevVal[0])
                        {
                            thisI.prev[0] = iJdx;
                            thisI.prevVal[0] = poss1;
                            if (debugI) console.log('Better prev 0 poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                        }
                    }
                }
                if (poss0 < path1Start)
                {
                    // if(thisI.prev[1] < 0)thisI.prev[1] = iJdx;
                    if (thisI.prev[1] < 0)
                    {
                        thisI.prev[1] = iJdx;
                        thisI.prevVal[1] = poss0;
                        if (debugI) console.log('1st prev[1] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss0 > thisI.prevVal[1])
                        {
                            thisI.prev[1] = iJdx;
                            thisI.prevVal[1] = poss0;
                            if (debugI) console.log('Better prev[1] poss0 iIdxToken iJdx', poss0, iIdx, iJdx);
                        }
                    }
                }
                if (poss1 < path1Start && iIdx != iJdx)
                {
                    // if(thisI.prev[1] < 0)thisI.prev[1] = iJdx;
                    if (thisI.prev[1] < 0)
                    {
                        thisI.prev[1] = iJdx;
                        thisI.prevVal[1] = poss1;
                        if (debugI) console.log('1st prev[1] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                    } else
                    {
                        //Do we have a better match
                        if (poss1 > thisI.prevVal[1])
                        {
                            thisI.prev[1] = iJdx;
                            thisI.prevVal[1] = poss1;
                            if (debugI) console.log('Better prev[1] poss1 iIdxToken iJdx', poss1, iIdx, iJdx);
                        }
                    }
                }
                // if((possibleI.idx[0] + possibleI.t[0])  < (path0Idx + path0T))
                // {
                // if(thisI.prev[0] < 0)thisI.prev[0] = selfies.length - 1 - iJdx;
                // }
                // if((possibleI.idx[1] + possibleI.t[1])  < (path1Idx + path1T))
                // {
                // if(thisI.prev[1] < 0)thisI.prev[1] = selfies.length - 1 - iJdx;
                // }
                // console.log('possibleI', possibleI);
                //Look for next on 0 branch
            }
            // if(thisI.next[0] < 0)
            // {
            // thisI.next[0] = 0;
            // }else
            // {
            // //Check for short loop
            // let next0 = selfies[thisI.next[0]];
            // if((next0.idx[1] + next0.t[1]) > (path1Idx + path1T))
            // {
            // thisI.next[0] = iIdxToken;
            // }
            // }
            if (thisI.next[1] < 0)
            {
                thisI.next[1] = 0;
            }
            if (thisI.prev[0] < 0)
            {
                thisI.prev[0] = selfies.length - 1;
            }
            // if(thisI.prev[1] < 0)
            // {
            // thisI.prev[1] = selfies.length - 1;
            // if((iIdxToken == 0) && (thisI.next[0] == 0))
            // {
            // thisI.prev[1] = 0;
            // }
            // }else
            // {
            // let prev1 = selfies[thisI.prev[1]];
            // if((prev1.idx[0] + prev1.t[0]) < (path0Idx + path0T))
            // {
            // thisI.prev[1] = iIdxToken;
            // }
            // }
        }
        selfies.at(-1).next[1] = 0;
        let loops = [];
        //Get on the right path
        // let curveIdx = selfies[idx0].idx[0];
        // let nextT = 1;
        // if(selfies[selfies[idx0].next[0]].idx[0] == curveIdx)nextT = selfies[selfies[idx0].next[0]].t[0];
        // let midPt = offsets.curves[curveIdx].get((selfies[idx0].t[0] + nextT)/2);
        // //This is wrong we are looking for the distance from the
        // let proj = offsets.curves[selfies[idx0].idx[1]].project(midPt);
        // console.log('proj midPt', proj, midPt);
        // let startBranch = 0;
        //if(proj.d < d)startBranch = 1; //midpt on curve 0 is inside offset distance
        offsets.findLoops(selfies, 0, 1, 0, loops);
        // console.log('loops', loops);
        // console.log('selfies after', selfies);
        let selectArr = 1;
        if (PolyBezier.debugObj != null)
        {
            for (let iIdx = 0; iIdx < arrSelfies[selectArr].length; iIdx++)
            {
                let thisi = arrSelfies[selectArr][iIdx];
                DrawUtils.displayPoint(offsets.curves[thisi.idx[0]].get(thisi.t[0]), 0.02, PolyBezier.debugObj, '#0f0f00');
            }
        }
        return loops;
        // return [loops, arrSelfies[selectArr]];
        // return [[offsets], arrSelfies[selectArr]];

    }

    /*
    * This will join the endpoints of all adjacent curves
    * The styles ars NO_JOIN, MITER_JOIN, CORNER_JOIN and RADIUS_JOIN.
    * We will first test the distance between the endpoints. A very
    * small distance indicates that they are already joined.
    * If the distance is not close we get the derivatives and find where
    * the tangents to the endpoints meet. There are three possibilites
    * They meet farther out, they meet closer in or they don't meet
    * (they are close to parallel)
    */
    join(d, jtype = PolyBezier.NO_JOIN)
    {
        // console.log('join d jtype', d, jtype);
        if (jtype == PolyBezier.NO_JOIN) return;
        let len = this.curves.length;
        let c1 = this.curves.at(-1);
        let corners = [];
        for (let iIdx = 0; iIdx < len; c1 = this.curves[iIdx], iIdx++)
        {
            let c2 = this.curves[iIdx];
            let c1ep1 = c1.get(1);
            let c2ep0 = c2.get(0);
            let dist = utils.dist(c1ep1, c2ep0);
            // console.log('dist', dist);
            if (dist < d / 10)
            {
                corners.push({ i: utils.clonePt(c2ep0), t: 0 });
                continue;
            }
            switch (jtype)
            {
                case PolyBezier.NO_JOIN:
                    break;

                case PolyBezier.MITER_JOIN:
                    corners.push({ i: c2ep0, t: 2 });
                    break;

                case PolyBezier.CORNER_JOIN:
                    let d1 = c1.derivative(1);
                    //Note that t for c1ep1 is 1/parm3 or 1/3
                    let l1 = utils.makeExtendedLine(c1ep1, { x: c1ep1.x + d1.x, y: c1ep1.y + d1.y }, 10);
                    let d2 = c2.derivative(0);
                    let l2 = utils.makeExtendedLine(c2ep0, { x: c2ep0.x + d2.x, y: c2ep0.y + d2.y }, 10);
                    let meetingPt = l1.lineIntersects(l2);
                    if (meetingPt.length > 0)
                    {
                        corners.push({ i: l1.get(meetingPt[0]), t: meetingPt[0] <= 4.5 / 10 ? -1 : 1 });
                        // console.log('meetingPt', meetingPt, c1ep1, l1.get(meetingPt[0]));
                        // if(PolyBezier.debugObj != null)
                        // {
                        // DrawUtils.displayPoint(l1.get(meetingPt[0]), 0.05, PolyBezier.debugObj, '#0f0f00');
                        // }
                        continue;
                    }
                    // console.log('No meeting', iIdxToken, l1, l2);
                    corners.push({ i: utils.clonePt(c2ep0), t: 2 });
                    //let angle = utils.angle({x:0, y:0}, d1, d2);
                    break;

                case PolyBezier.RADIUS_JOIN:
                    let n1 = c1.normal(1);
                    let ln1 = utils.makeExtendedLine(c1ep1, { x: c1ep1.x + n1.x, y: c1ep1.y + n1.y }, 10);
                    let n2 = c2.normal(0);
                    let ln2 = utils.makeExtendedLine(c2ep0, { x: c2ep0.x + n2.x, y: c2ep0.y + n2.y }, 10);
                    let normalPt = ln1.lineIntersects(ln2);
                    if (normalPt.length > 0)
                    {
                        // corners.push({i:c2ep0, t:2});
                        corners.push({ i: ln1.get(normalPt[0]), t: 3 });
                        // console.log('normalPt', normalPt, c1ep1, ln1.get(normalPt[0]));
                        // if(PolyBezier.debugObj != null)
                        // {
                        // DrawUtils.displayPoint(ln1.get(normalPt[0]), 0.05, PolyBezier.debugObj, '#0f0f00');
                        // }
                        continue;
                    }
                    corners.push({ i: c2ep0, t: 2 });
                    break;
            }
        }
        let newCurves = [];
        len = corners.length;
        for (let iIdx = 0; iIdx < len; iIdx++)
        {
            let nextIdx = (iIdx + 1 < len) ? iIdx + 1 : 0;
            // console.log('iIdxToken nextIdx', iIdxToken, nextIdx, corners[iIdxToken]);
            if (this.curves[iIdx]._linear && jtype == PolyBezier.CORNER_JOIN)
            {
                newCurves.push(utils.makeline(corners[iIdx].i, corners[nextIdx].i));
                continue;
            }

            switch (corners[iIdx].t)
            {
                case 2:
                    break;

                case 1:
                    newCurves.push(utils.makeline(corners[iIdx].i, this.curves[iIdx].get(0)));
                    break;

                case 0:
                    break;

                case -1:
                    break;
            }
            newCurves.push(new Bezier(this.curves[iIdx]));

            switch (corners[nextIdx].t)
            {
                case 3:
                    let p1 = this.curves[iIdx].get(1);
                    let d1 = this.curves[iIdx].derivative(1);
                    let d2 = this.curves[nextIdx].derivative(0);
                    let nPt = corners[nextIdx].i;
                    let startAng = utils.angle(nPt, { x: nPt.x + 1, y: nPt.y }, p1);
                    let cw = (utils.angle(p1, { x: p1.x + d1.x, y: p1.y + d1.y }, nPt) < 0);
                    // console.log('cw', cw);
                    let endAng = utils.angle(nPt, { x: nPt.x + 1, y: nPt.y }, this.curves[nextIdx].get(0));
                    //let angExtent = utils.angle(nPt, this.curves[iIdxToken].get(1), this.curves[nextIdx].get(0));
                    let angExtent = utils.angle({ x: 0, y: 0 }, d1, d2);
                    // if(angExtent > 0)
                    // {
                    // angExtent -= 2*Math.PI;
                    // }else
                    // {
                    // angExtent += 2*Math.PI;
                    // }
                    // angExtent += 2*Math.PI;
                    //Must be the direction of the poly
                    if (cw)
                    {
                        while (angExtent > 0) angExtent -= 2 * Math.PI;
                    } else
                    {
                        while (angExtent < 0) angExtent += 2 * Math.PI;
                    }
                    // console.log('startAng angExtent endAng', 180*startAng/Math.PI, 180*angExtent/Math.PI, 180*endAng/Math.PI, nPt);
                    newCurves.push(...DrawUtils.arc(nPt, d, startAng, angExtent));
                    //newCurves.push(utils.makeline(this.curves[iIdxToken].get(1), this.curves[nextIdx].get(0)));
                    break;

                case 2:
                    newCurves.push(utils.makeline(this.curves[iIdx].get(1), this.curves[nextIdx].get(0)));
                    break;

                case 1:
                    newCurves.push(utils.makeline(this.curves[iIdx].get(1), corners[nextIdx].i));
                    break;

                case 0:
                    break;

                case -1:
                    newCurves.push(utils.makeline(this.curves[iIdx].get(1), this.curves[nextIdx].get(0)));
                    break;
            }
        }
        this.curves = newCurves;
    }

    /*
    * This routine finds the loops that make up the final offset. The offset for a given curve can
    * be closer than the offset distance to other curves in a shape.  When this happens the offset
    * will cross the offset of the other curve at an intersection.  The loop that one is following
    * continues on the other branch of the intersection. This branch could have new loops on it.
    * The answer is to make the routine reentrant and to make a call on the branch not taken. That
    * call will search for loops and spawn other calls as needed.  The tricky here is getting back
    * to the same intersection. One answer is to spawn a call with the original end index.
    *
    * A little more discussion about the intersections. The intersections are arranged in order
    * along the raw offset. A branch can skip intersections.  The reentrant call should cover the
    * skipped intersections. Every intersection should be checked in a call.
    *
    * We are going to make the call with a startIdx and and branch that is known to be on the path
    * and is the start of a loop.
    *
    * After the makeSortedLists call, the intersection array has objects that include next and prec 
    * elements that make up two linked lists (linked by index). The first is organzed with the 0
    * indexed curves in the intersections and the second the 1 indexed.
    */
    findLoops(intersections, startIdx, branch, depth, loopArray)
    {
        let debugFindLoop = false;
        if (debugFindLoop) console.log('findLoops startIdx', startIdx);
        if (++depth > 3) return;
        // intersections = this.makeSortedLists(intersections);
        // let header = intersections.pop();
        let newLoop = [];
        //This routine is arranged to be called with the startIdx and branch index pointing to the
        //start of a new loop
        let loopIdx = startIdx;
        //Go until we loop
        do
        {
            if (newLoop.length > 75) return;
            if (debugFindLoop) console.log('loopIdx', loopIdx);
            //We are at an intersection where the next segment is in the loop.
            //The segment starts at this intersection
            //NOTE: The logic that follows could be a little confusing.  We will be following the segment
            //And then we will look at this intersection for a branch.
            let thisI = intersections[loopIdx];
            //Leave on the higher branch
            let nextIdx = thisI.next[branch];
            if (thisI.next[branch ^ 1] > nextIdx)
            {
                branch ^= 1;
                nextIdx = thisI.next[branch];
            }
            //Even if it is higher don't take the self referenced branch
            if (nextIdx == loopIdx)
            {
                branch ^= 1;
                nextIdx = thisI.next[branch];
            }
            //The index of the intersection at the end of this branch
            if (debugFindLoop) console.log('loopIdx nextIdx branch', loopIdx, nextIdx, branch);
            //The intersection of the end
            let nextI = intersections[nextIdx];
            //Index into shape of first curve, it will be the part of the curve past
            //the intersection (positive T)
            let curveIdx = thisI.idx[branch];
            //This is the t parameter of the intersection
            let firstT = thisI.t[branch];
            //The index of the curve at the next intersection
            //We enter on the matching curve
            let nextCurveIdx = nextI.idx[0];
            let nextT = nextI.t[0];
            let nextPrev = nextI.prev[0];
            if (nextPrev != loopIdx)
            {
                nextCurveIdx = nextI.idx[1];
                nextT = nextI.t[1];
            }
            //Walk the path to the next intersection
            while (curveIdx != nextCurveIdx)
            {
                //The next intersection was not on the same curve. Get the curve from the
                //first intersection all the way to the end of the curve
                //Increment the curve idx
                newLoop.push(this.curves[curveIdx++].split(firstT, 1));
                //Handle wrapparound
                if (curveIdx >= this.curves.length) curveIdx = 0;
                //Following curve start at the beginning of the curve. As long
                //as we stay in the loop, we are taking complete curve
                firstT = 0;
            }
            //We walked the path to the next intersection. If this intersection is at the
            //same curve index as the first, the firstT variable still has the first
            //intersection t value.  If not firstT is 0. The second t is from
            //the next intersection
            newLoop.push(this.curves[curveIdx].split(firstT, nextT));
            // if(nextIdx == endIdx) return new PolyBezier(newLoop);
            //This is the next intersection on the other branch at the thisI intersection
            //As discussed above we are now looking at the first intersection for a branch
            //Leave on the higher curve
            let nextBranchIdx = thisI.next[branch ^ 1];
            //Does this branch go anywhere?
            //
            //If we look down the branch on thisI and the nextI intersection is different
            //then we have a another section
            if (loopIdx < nextBranchIdx)
            {
                //This has a new loop
                this.findLoops(intersections, nextBranchIdx, 0, depth, loopArray);
                if (debugFindLoop) console.log('Returned loop at ', nextBranchIdx);
            }
            branch = 1;
            loopIdx = nextIdx;
        } while (loopIdx != startIdx);
        //We have a loop
        loopArray.push(new PolyBezier(newLoop));
        // return new PolyBezier(newLoop);
        // return newLoop;
    }

    /*
    * This routine is a little tricky. We take the original array and store in
    * each element the index of that element in the original array.
    * Then we make shallow copies and sort them along the curves by the 0 index
    * and the 1 index in the intersections. Then we populate the next and prev
    * pointers with the indexes in the original array.  This creates two linked
    * list inthe original array.
    */
    makeSortedLists(intersections)
    {
        for (let iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            intersections[iIdx].idx[2] = iIdx;
        }
        let interPoly0 = intersections.slice();
        let interPoly1 = intersections.slice();
        //Now sort these two into path order
        // interPoly0.sort(function(a,b){
        // if(a.idx[0] == b.idx[0])
        // {
        // return a.t[0] - b.t[0];
        // }
        // return a.idx[0] - b.idx[0];
        // });
        interPoly0.sort(function (a, b)
        {
            return (a.idx[0] + a.t[0]) - (b.idx[0] + b.t[0]);
        });
        interPoly1.sort(function (a, b)
        {
            return (a.idx[1] + a.t[1]) - (b.idx[1] + b.t[1]);
        });
        //Now we have two sorted lists, build the linked list
        let header = { prev: [0, 0], next: [0, 0] };
        header.next = [interPoly0[0].idx[2], interPoly1[0].idx[2]];
        header.prev = [interPoly0.at(-1).idx[2], interPoly1.at(-1).idx[2]];
        for (let iIdx = 0; iIdx < intersections.length - 1; iIdx++)
        {
            interPoly0[iIdx].next[0] = interPoly0[iIdx + 1].idx[2];
            interPoly1[iIdx].next[1] = interPoly1[iIdx + 1].idx[2];
            interPoly0[iIdx + 1].prev[0] = interPoly0[iIdx].idx[2];
            interPoly1[iIdx + 1].prev[1] = interPoly1[iIdx].idx[2];
        }
        //Close the loops
        interPoly0.at(-1).next[0] = header.next[0];
        interPoly1.at(-1).next[1] = header.next[1];
        interPoly0[0].prev[0] = header.prev[0];
        interPoly1[0].prev[1] = header.prev[1];

        // console.log('interPoly0', interPoly0);
        // console.log('interPoly1', interPoly1);

        //console.log(intersections);
        intersections.push(header);
        return intersections;
    }

    new1_offset(d, jtype, cp)
    {
        console.log('offset(d, jtype, cp)', d, jtype, cp);
        if (this.curves.length < 2)
            return new PolyBeziers([new PolyBezier(this.curves[0].offset(d)[0])]);
        let joinType = PolyBezier.NO_JOIN;
        if (typeof (jtype) != 'undefined')
            joinType = jtype;
        const offsets = [];
        let lastOffset = this.curves.at(-1).offset(d).at(-1);
        // let nextOffset =
        // let lastI = lastOffset.intersects(this.curves.at(0).offset(d).at(0), Math.abs(d/100));
        // offsets.push(lastOffset);
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let theseOffsets = this.curves[iIdx].offset(d);
            for (let iJdx = 0; iJdx < theseOffsets.length; iJdx++)
            {
                let thisOffset = theseOffsets[iJdx];
                console.log('thisOffset', new Bezier(thisOffset));
                let intersects = thisOffset.intersects(lastOffset, Math.abs(d / 100));
                console.log('intersects', intersects);
                if (intersects.length > 0)
                {
                    //Assume a single intersection that may have multiple hits
                    //Get an entry near the middle SMGTODO consider positive ID of cluster
                    let intersect = intersects[Math.floor(intersects.length / 2)];
                    let t = intersect.split("/").map(v => parseFloat(v));
                    intersect = thisOffset.get(t[0]);
                    if (PolyBezier.debugObj != null)
                    {
                        DrawUtils.displayPoint(intersect, 0.25, PolyBezier.debugObj, '#ff0000');
                        console.log('intersect', intersect);
                    }
                    if (joinType != PolyBezier.NO_JOIN)
                    {
                        offsets[offsets.length - 1] = lastOffset.split(0, t[1]);
                        thisOffset = thisOffset.split(t[0], 1);
                        console.log('thisOffset split', t[0], new Bezier(thisOffset));
                        offsets.push(thisOffset);
                        lastOffset = new Bezier(thisOffset);
                        continue;
                    }
                }
                switch (joinType)
                {
                    case PolyBezier.NO_JOIN:
                        break;

                    case PolyBezier.MITER_JOIN:
                        offsets.push(utils.makeline(lastOffset.get(1), thisOffset.get(0)));
                        break;

                    //SMGTODO This should detect and truncate long corners
                    case PolyBezier.CORNER_JOIN:
                        let ep1 = lastOffset.get(1);
                        let d1 = lastOffset.derivative(1);
                        let p2 = {
                            x: ep1.x + d1.x,
                            y: ep1.y + d1.y
                        };
                        let line1 = utils.makeExtendedLine(ep1, p2, 3);
                        let ep2 = thisOffset.get(0);
                        d1 = thisOffset.derivative(0);
                        p2 = {
                            x: ep2.x - d1.x,
                            y: ep2.y - d1.y
                        };
                        let line2 = utils.makeExtendedLine(ep2, p2, 3);
                        let corner = line1.lineIntersects(line2);
                        if (corner.length > 0)
                        {
                            corner = line1.get(corner[0]);
                            offsets.push(utils.makeline(ep1, corner));
                            offsets.push(utils.makeline(corner, ep2));
                        }
                        break;

                    case PolyBezier.RADIUS_JOIN:
                        break;
                }
                console.log('thisOffset', new Bezier(thisOffset));
                offsets.push(thisOffset);
                lastOffset = thisOffset;
            }
        }
        return new PolyBezier(offsets);
    }
    old_offset(d, jtype, cp)
    {
        //	if(jtype === undefined)var jtype = PolyBezier.NO_JOIN;

        const offset = [];
        this.curves.forEach(function (v)
        {
            offset.push(...v.offset(d)); //Equivalent to offset = offset.concat(segOffsets);
        });
        let offsets = new PolyBezier(offset);
        let ints = offsets.self_intersections(0.02);
        console.log('ints', ints);
        return;
        //This is the original offset
        if (jtype === undefined)
            return [new PolyBezier(offset)];

        let iIdx = 0;
        while (iIdx < offset.length)
        {
            //iIdxToken = utils.join(offset, iIdxToken, PolyBezier.MITER_JOIN, d);
            iIdx = utils.join(offset, iIdx, jtype, d, this.cw, cp);
        }
        //return [new PolyBezier(offset)];
        if (jtype == PolyBezier.NO_JOIN)
            return [new PolyBezier(offset)];
        //We can clear out the obvious
        //Before looking for intersections remove paths that cross the offset curve
        //return new PolyBezier(offset);
        //Now we search for intersections
        // let inout = (d < 0)?-1:1;
        // for(iIdxToken = 0; iIdxToken < offset.length; iIdxToken++){
        // offset[iIdxToken].orient = {r:inout, l:-inout};
        // offset[iIdxToken].intersections = [];
        // }
        //Walk the curve segments looking for intersections with other segments
        let intersections = [];
        let points = [];
        let iCode = 0;
        for (let iC1dx = 0; iC1dx < offset.length; iC1dx++)
        {
            let c1 = offset[iC1dx];
            //Look at all the segments that follow this one.  Don't need to look the one before
            //those intersections have already been found
            for (let iC2dx = iC1dx + 1; iC2dx < offset.length; iC2dx++)
            {
                let c2 = offset[iC2dx];
                let intersect = c1.intersects(c2, Math.abs(d / 100));
                for (let iIdx = 0; iIdx < intersect.length; iIdx++)
                {
                    let t = intersect[iIdx].split("/").map(v => parseFloat(v));
                    //The sign of the cross product tells us which way the lines crossed.
                    let xp = utils.crossProdBezier(c1, c2);
                    intersections.push({
                        th: t[0],
                        tt: t[1],
                        refC: iC1dx,
                        cross: xp,
                        transition: 0,
                        iCode: iCode
                    });
                    intersections.push({
                        th: t[1],
                        tt: t[0],
                        refC: iC2dx,
                        cross: -xp,
                        transition: 0,
                        iCode: iCode
                    });
                    iCode++; //New code for next intersection
                    points.push(c1.get(t[0]));
                    //Record this intersection on 1st segment
                    // let xref1 = c1.intersections.length;  //The next index on c1
                    // let xref2 = c2.intersections.length;  //The next index on c2
                    // //xrefC and xrefI allow one to find the same intersection on the other curve
                    // c1.intersections.push({th:t[0], tt:t[1], xrefC:iC2dx, xrefI:xref2, cross:xp, out:true});
                    // //Record this intersection on 2nd segment
                    // c2.intersections.push({th:t[1], tt:t[0], xrefC:iC1dx, xrefI:xref1, cross:-xp, out:true});
                }
            }
        }
        let innerPoints = [];
        for (let iC1dx = 0; iC1dx < offset.length; iC1dx++)
        {
            let c1 = offset[iC1dx];
            for (let iC2dx = 0; iC2dx < this.curves.length; iC2dx++)
            {
                let cinner = this.curves[iC2dx];
                let intersect = c1.intersects(cinner, Math.abs(d / 100));
                for (let iIdx = 0; iIdx < intersect.length; iIdx++)
                {
                    let t = intersect[iIdx].split("/").map(v => parseFloat(v));
                    //The sign of the cross product tells us which way the lines crossed.
                    let xp = utils.crossProdBezier(c1, cinner);
                    intersections.push({
                        th: t[0],
                        tt: t[1],
                        refC: iC1dx,
                        cross: xp,
                        transition: 3,
                        iCode: -1
                    });
                    innerPoints.push(c1.get(t[0]));
                }
            }
        }
        //Sort all the intersections by curve index and th.  They will be in the order that we would see walking the path
        intersections.sort(function (a, b)
        {
            let idxDiff = a.refC - b.refC;
            if (idxDiff != 0)
                return idxDiff;

            return (a.th - b.th);
        });
        // for(let iC1dx = 0; iC1dx < offset.length; iC1dx++){
        // let c1 = offset[iC1dx];
        // c1.intersections.sort(function(a,b){
        // let idxDiff = a.refC - b.refC;
        // if(idxDiff != 0)return idxDiff;

        // return (a.th - b.th);
        // });
        // }
        //Use the codes to create xrefs
        for (iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            //
            let i1 = intersections[iIdx];
            if (i1.iCode < 0)
                continue; //Intersection with inner curves
            //console.log("Poly offset intersection ", i1);
            if (i1.xref != undefined)
                continue; //Already found
            for (let iI2dx = iIdx + 1; iI2dx < intersections.length; iI2dx++)
            {
                let i2 = intersections[iI2dx];
                if (i2.iCode < 0)
                    continue; //Intersection with inner curves
                if (i1.iCode == i2.iCode)
                {
                    //We have found the match
                    i1.xref = iI2dx;
                    i2.xref = iIdx;
                    break;
                }
            }
        }
        let iT = "";
        for (iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            iT += intersections[iIdx].transition.toString();
        }
        console.log(iT);
        //We now have all the intersections recognized and organized
        //Let us find and mark all of the interior paths (paths that intersect
        //the curves being outlined)
        //Some tricky logic.  We want to make the transitions on the inner
        //intersections depend on the onInnerPath state
        let onInnerPath = false; //We start outside
        let bTransitionOut = false;;
        let iPrevInter = intersections[intersections.length - 1];
        for (iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            let iThis = intersections[iIdx];
            if (onInnerPath)
            {
                //Looking for a transition out.
                if (iThis.iCode < 0)
                {
                    onInnerPath = false;
                    bTransitionOut = true;
                } else
                {
                    //Mark everything on inner path as in
                    iThis.transition = 3;
                    bTransitionOut = false;
                }
            } else
            {
                //Looking for a transition in.
                if (iThis.iCode < 0)
                {
                    onInnerPath = true;
                    if (iPrevInter.iCode >= 0)
                    {
                        iPrevInter.transition = 2;
                    }
                } else
                {
                    if (bTransitionOut)
                    {
                        iThis.transition = 1;
                    }
                }
                bTransitionOut = false;
            }
            iPrevInter = iThis;
        }
        iT = "";
        for (iIdx = 0; iIdx < intersections.length; iIdx++)
        {
            iT += intersections[iIdx].transition.toString();
        }
        console.log(iT);
        //We can remove all the paths that intersect the original shape
        //	let innerIntersections = [];

        //Now we can adjust the curves and remove inner loops.
        let lastTransition = 0;
        //1st pass to populate transitions with tentative values
        //lastTransition = this.determineTransitions(intersections, lastTransition);
        //2nd pass to resolve tentative values
        lastTransition = this.determineTransitions(intersections, lastTransition);
        let offsetCurves = [];
        let offsetCurve = this.getOuterPath(offset, intersections);
        while (offsetCurve != null && offsetCurve.length > 0)
        {
            console.log('offsetCurve', offsetCurve);
            offsetCurves.push(new PolyBezier(offsetCurve));
            offsetCurve = this.getOuterPath(offset, intersections);
        }
        return [offsetCurves, points, innerPoints];
        // for(let iC1dx = 0; iC1dx < offset.length; iC1dx++){
        // let c1 = offset[iCdx];
        // for(iIdxToken = 0; iIdxToken < c1.intersections.length; iIdxToken++){
        // //Here we go
        // let c1i = c1.intersections[iIdxToken];
        // let c2i = offset[c1i.xrefC].intersections[c1i.xrefI];
        // }
        // }
        // let iIdxToken = 0;
        // while(iIdxToken < offset.length){
        // iIdxToken = utils.join(offset, iIdxToken);
        // }
        // if(jtype != 0){
        // let iIdxToken = 0;
        // while(iIdxToken < offset.length){
        // iIdxToken = utils.join(offset, iIdxToken);
        // }
        // //Now search for intersections
        // // iIdxToken = 0;
        // // let remove = true;
        // // for(; iIdxToken < offset.length; iIdxToken++){
        // // let c1 = offset[iIdxToken];
        // // //console.log("poly offset :", c1.points);
        // // for(let iKdx = iIdxToken + 2; iKdx < offset.length; iKdx++){
        // // let intersect = c1.intersects(offset[iKdx], 2);
        // // if(intersect.length == 0){
        // // //if(remove)offset.splice(iIdxToken, 1);
        // // continue;
        // // }
        // // //We have an intersections
        // // let t = intersect[0].split("/").map(v => parseFloat(v));
        // // let new1 = c1.split(0, t[0]);
        // // let new2 = offset[iKdx].split(t[1], 1);
        // // //console.log("offset join news :",iIdxToken,iKdx,new1,new2);
        // // offset.splice(iIdxToken, iKdx + 1 - iIdxToken, new1, new2);
        // // //iIdxToken++
        // // break;
        // // }
        // // }
        // }
        // return new PolyBezier(offset);
    }

    /*
     * A discussion about how this algorithm works. First if the point
     * is outside the bounding box it can't be inside the shape.
     *
     * If it is inside the bounding box, a test line is created that starts at the
     * point being tested and ends on a point outside the shape. We can choose these
     * points using the bounding box limits. Then we determine how many times this
     * line intersects the shape. An odd number and it is inside, an even number (or 0)
     * and it is outside.
     *
     * A problem was found where the test line was coincident with a line in the shape
     * The intersection algorithm sees this as many intersections with even or odd being
     * arbitrary. If we detect a coincidental segment, we will use a different test line
     * going in a different direction. At this point we have 8 test lines Going through
     * all the sides and corners of the bounding box. If all of these test lines have
     * coincidental segments in the shape, we are going to assume the point is inside.
     *
     * This algorityhm 'leaks'! If the test line goes through an endpoint
     * the intersection is not detected.
     *
     * The leak is fixed. See discussion below.
     *
     * Another problem happens when the point is closer to a curve than the intersection
     * detection tolerance. When a point is that close we should be able to use the cw/ccw
     * and which side of the line to determine if the point is inside. An important property
     * of CW/CCW is the direction of the path and the inside of the shape. For a CW shape,
     * the inside is to the right. For a CCW shape, the inside is to the left. If we find
     * that a point is close to the line and there are no closer lines, then we can determine
     * if the point is contained in the shape by determining the above information.
     *
     * Some problems with the above algorithm. The assumption was that the projection of a
     * point onto a curve would be on a line perpendicular to the curve. Instead the project
     * function is finding the closest distance. That is not necessarily on a perpendicular.
     * If the closest distance is to and endpoint for example, it could be at any angle
     * relative to the curve. Our cross product test can give the wrong result in those cases.
     */
    contains(p, tol = 0.01)
    {

        let bbox = this.bbox();
        if (p.x < bbox.x.min)
            return false;
        if (p.x > bbox.x.max)
            return false;
        if (p.y < bbox.y.min)
            return false;
        if (p.y > bbox.y.max)
            return false;

        //The point is inside the bounding box, it could be inside the shape
        //Test for points close to line. The bbox call above has cached the
        //bbox results for all curves. So we can test them first
        let min = { d: 10 * tol, i: -1 };
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let thisCurve = this.curves[iIdx];
            let bb = thisCurve.bbox();
            if (p.x < bb.x.min - tol / 2) continue;
            if (p.x > bb.x.max + tol / 2) continue;
            if (p.y < bb.y.min - tol / 2) continue;
            if (p.y > bb.y.max + tol / 2) continue;

            //We are inside the bounding box
            let proj = thisCurve.project(p);
            if (proj.d > tol) continue;
            let der = thisCurve.derivative(proj.t);
            let ang = Math.abs(utils.angle(proj, { x: proj.x + der.x, y: proj.y + der.y }, p));
            // console.log('ang', ang);
            //It is possible that the closest point is past the end of the curve and is on the wrong side
            //giving a bad result. Constraining the angle from the projection to closer to the expected
            //perpendicular will give better results
            if (ang < Math.PI / 4) continue;
            if (ang > 3 * Math.PI / 4) continue;
            // if(Area.debugObj != null)
            // {
            // DrawUtils.displayPoint(proj, 0.002, Area.debugObj, '#77ff00');
            // DrawUtils.displayShape([utils.makeline(proj, p)], Area.debugObj, '#222222');
            // DrawUtils.displayShape([utils.makeline(proj, {x:proj.x+der.x, y:proj.y+der.y})], Area.debugObj, '#222222');
            // }

            if (min.i < 0 || min.d > proj.d)
            {
                min = { x: proj.x, y: proj.y, i: iIdx, t: proj.t, d: proj.d };
            }
        }
        if (min.i >= 0)
        {
            //We are within tolerance which side are we on
            //NOTE we chose the closest curve so that no other curve can be between
            //our point and this curve

            let thisCurve = this.curves[min.i];
            let der = thisCurve.derivative(min.t);
            let cross = (der.x * (p.y - min.y)) - (der.y * (p.x - min.x));
            //The sign of cross determines if we are to the left or the right of the curve
            //Then cw or ccw determines if we are on the inside. Following the right-hand
            //rule for the cross product, negative numbers are inside a CW shape, etc.
            // console.log('Contain close pt cross', p, cross);
            // if(Area.debugObj != null)
            // {
            // let ci = true; //Points on the curve are contained regardless of CW/CCW
            // if(cross < 0)
            // {
            // if(!this.cw)ci = false;
            // }else
            // {
            // if(this.cw)ci = false;
            // }
            // // let ci = '#ff0000';
            // // if(intersections[iIdxToken].inside[0])ci = '#00ff00';
            // // console.log('mid', mid);
            // DrawUtils.displayPoint(thisCurve.get(0), 0.001, Area.debugObj, '#00ff00');
            // DrawUtils.displayPoint(thisCurve.get(1), 0.001, Area.debugObj, '#ff0000');
            // DrawUtils.displayPoint(p, 0.003, Area.debugObj, ci?'#ff0000':'#00ff00');
            // DrawUtils.displayPoint(min, 0.005, Area.debugObj, '#00ffff');
            // DrawUtils.displayShape([utils.makeline(p, min)], Area.debugObj, '#00ffff');
            // }
            if (cross == 0) return true; //Points on the curve are contained regardless of CW/CCW
            if (cross < 0)
            {
                if (this.cw) return true;
                return false;
            }
            if (this.cw) return false;
            return true;
        }
        //These are lines in different directions that start on the test point
        //and end outside the bounding box. We test for how many times a line
        //intersects the shape.
        let vote = [0, 0];
        let lines = [{
            p1: p,
            p2: {
                x: p.x,
                y: bbox.y.max + 1
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.max + 1,
                y: p.y
            }
        }, {
            p1: p,
            p2: {
                x: p.x,
                y: bbox.y.min - 1
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.min - 1,
                y: p.y
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.max + 1,
                y: bbox.y.max + 1
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.min - 1,
                y: bbox.y.min - 1
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.min - 1,
                y: bbox.y.max + 1
            }
        }, {
            p1: p,
            p2: {
                x: bbox.x.max + 1,
                y: bbox.y.min - 1
            }
        }
        ];
        for (let iJdx = 0; iJdx < lines.length; iJdx++)
        {
            if (vote[0] - vote[1] >= 3) return false;
            if (vote[1] - vote[0] >= 3) return true;
            // console.log('iJdx', iJdx);
            let intersections = [];
            let line = lines[iJdx];
            let coincident = false;
            for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
            {
                // console.log('iIdxToken', iIdxToken);
                //We are only going to look for coincidence with lines
                if (this.curves[iIdx]._linear)
                {
                    //The curve is a line. Put it in a format the align function needs.
                    let curveLine = {
                        p1: this.curves[iIdx].get(0),
                        p2: this.curves[iIdx].get(1)
                    };
                    //The align function transforms all points by translating so that curveLine.p1
                    //is at 0,0. It then rotates util curveLine.p2 is on the x axis. It returns an
                    // array of the transformed points from the first parameter
                    let aligned = utils.align([line.p1, line.p2], curveLine);
                    // console.log('aligned', aligned);
                    //If all the points are on the x axis, we have a coincidental line
                    if (!aligned.some((pt) => Math.abs(pt.y) > 0.01))
                    {
                        // console.log('Coincident line found', this.curves[iIdxToken]);
                        coincident = true;
                        break; //End the test with this line
                    }

                }
                let theseIntersects = this.curves[iIdx].lineIntersects(line);
                if (theseIntersects.length != 0)
                {
                    intersections = intersections.concat(theseIntersects);
                    continue;
                }
                //There was a problem where the test line could go through the endpoint of a
                //segment and not show as an intersection. In that case a point inside a shape
                //would not be shown as inside because the endpoint allowed the test line to leak.
                //To solve the leak, look at endpoints (one end only).  In theory, segments share
                //endpoints. If we detected at both endpoints we would see two intersections. So
                //we just look at one end and assume that the other end will be detected on another
                //segment. We do not do these tests if another intersection was found.  There is
                //a small possiblity that an intersection near an endpoint would be detected above.
                //It could also get detected here.  The chance of a curve bending enough for a line
                //to go through an endpoint and to also intersect is smaller. It is possible to add
                //code to detect this situation, but it is not worth the investment at this time.
                //Get the starting endpoint
                let ep = this.curves[iIdx].get(0);
                //Is this end point on our test line
                //The align function translates line.p1 to 0,0 and translates and rotates line.p2
                //to the x axis. It also translates and rotates the points in the array that is the
                //first paramemeter.  It returns the transformed points.  If they are on the x axis
                //they are on the extended line.  If the point is bewteen x = 0 and the
                //x of the transformed line.p2, it is on the line between the endpoints.
                let aligned = utils.align([ep], line);
                //If the transformed endpoint has an x coordinate below 0 it can't be on the line
                if (aligned[0].x < 0)
                    continue;
                //The endpoint x coord is greater than zero.  Is it on the x axis. If not it can't
                //be on the line
                if (Math.abs(aligned[0].y) >= 0.0001)
                    continue;

                //This returns the transformed coordinates for line.p2. The x coord is our upper limit
                let limit = utils.align([line.p2], line);
                //If the transformed endpoint is below or equal to the upper limit, it is on the line.
                //The t parameter for the line is the ratio of the x values. It isn't important at this
                //time because we only care about the number of intersection. But in case it matters in the
                //future, we have set it correctly.
                if (aligned[0].x <= limit[0].x)
                    intersections.push([aligned[0].x / limit[0].x]);

            }
            // console.log('contains intersections', line, this.curves, intersections);
            //If a coincident line is found, thge results are considered invalid. We try another line
            if (coincident)
                continue;
            if (intersections.length % 2 == 0)
            {
                vote[0]++;
                continue;
            }
            vote[1]++;
            // return false;

            // return true;
        }
        if (vote[0] > vote[1]) return false;

        return true;
    }

    reverse()
    {
        //console.log('PolyBezier.reverse');
        this.curves.reverse();
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            this.curves[iIdx].reverse();
        }
        this.cw = !this.cw;
        //console.log(this);
        return this;
    }

    self_intersections(tol)
    {
        let rawIntersections = [];
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let c1 = this.curves[iIdx];
            // console.log('c1', new Bezier(c1));
            for (let iJdx = iIdx + 1; iJdx < this.curves.length; iJdx++)
            {
                let c2 = this.curves[iJdx];
                // console.log('c2', new Bezier(c2));
                let results = c1.intersects(c2, tol, true);
                // console.log('iIdxToken iJdx results', iIdxToken, iJdx, results);
                for (let iKdx = 0; iKdx < results.length; iKdx++)
                {
                    let t = results[iKdx].split("/").map(v => parseFloat(v));
                    //Record the t parameters and the curve indices
                    //rawIntersections.push({t:t, idx:[iIdxToken, iJdx], entry:[1,1], exit:[1,1]});
                    // rawIntersections.push({t:t, idx:[iIdxToken, iJdx, -1]/*, entry:[1,1], exit:[1,1]*/});
                    rawIntersections.push({
                        pt: c1.get(t[0]),
                        realIdx: [iIdx + t[0], iJdx + t[1]],
                        t: t,
                        idx: [iIdx, iJdx, -1]/*, entry:[1,1], exit:[1,1]*/
                    });
                }

            }
        }
        if (rawIntersections.length == 0)
            return []; //No intersections return empty array
        // return rawIntersections;
        //Preprocess endpoints out
        let len = rawIntersections.length;
        let cLen = this.curves.length;
        for (let iIdx = len - 1; iIdx >= 0; iIdx--)
        {
            let rawOne = rawIntersections[iIdx];
            let test = Math.abs(rawOne.idx[0] - rawOne.idx[1]);
            //Handle wraparound
            if (test > cLen / 2)
            {
                test = Math.abs(cLen - test);
                // console.log('test', test);
            }
            if (test > 2) continue;
            if (test == 2)
            {
                if ((utils.dist(rawOne.pt, this.curves[rawOne.idx[0]].get(1)) > 4 * tol) &&
                    (utils.dist(rawOne.pt, this.curves[rawOne.idx[1]].get(0)) > 4 * tol)) continue;
            }
            rawIntersections.splice(iIdx, 1);
        }
        let processed = this.processRawIntersections2(rawIntersections, tol, false);
        //Remove the endpoint intersections
        // return [processed, rawIntersections];
        // len = processed.length;
        //We start from the end and work down so that removing items do not
        //affect the items to be checked
        // let lasti = processed[0];
        // for(let iIdxToken = len - 1; iIdxToken >= 0; iIdxToken--)
        // {
        // let ep, pt, dist;
        // let thisi = processed[iIdxToken];
        // // if(thisi.t[0] > 0.9 && thisi.t[1] < 0.1)
        // {
        // ep = this.curves[thisi.idx[0]].get(1);
        // pt = this.curves[thisi.idx[0]].get(thisi.t[0]);
        // dist = utils.dist(pt, ep);
        // // thisi.dist = dist;
        // // console.log('dist ep1', dist);
        // if(dist > 4*tol)continue;
        // ep = this.curves[thisi.idx[1]].get(0);
        // pt = this.curves[thisi.idx[1]].get(thisi.t[1]);
        // dist = utils.dist(pt, ep);
        // // console.log('dist ep2', dist);
        // if(dist > 3*tol)continue;
        // //inntersection is close to both endpoints
        // processed.splice(iIdxToken,1);
        // continue;
        // }
        // if(thisi.t[0] < 0.1 && thisi.t[1] > 0.9)
        // {
        // ep = this.curves[thisi.idx[0]].get(0);
        // pt = this.curves[thisi.idx[0]].get(thisi.t[0]);
        // dist = utils.dist(pt, ep);
        // // console.log('dist ep3', dist);
        // if(dist > 2*tol)continue;
        // ep = this.curves[thisi.idx[1]].get(1);
        // pt = this.curves[thisi.idx[1]].get(thisi.t[1]);
        // dist = utils.dist(pt, ep);
        // // console.log('dist ep4', dist);
        // if(dist > 2*tol)continue;
        // //inntersection is close to both endpoints
        // processed.splice(iIdxToken,1);
        // continue;
        // }
        // }

        //Sort along the curves in this PolyBezier (first shape)
        // processed.sort(function (a, b) {
        // return (a.idx[0] + a.t[0]) - (b.idx[0] + b.t[0]);
        // });
        // len = processed.length;
        // for(let iIdxToken = 0; iIdxToken < len; iIdxToken++)
        // {
        // let thisI = processed[iIdxToken];
        // thisI.pt = this.curves[thisI.idx[0]].get(thisI.t[0]);
        // }
        return [processed, rawIntersections];
    }
    /*
     * Finding the intersections between two PolyBeziers is a core step for many operations.
     * In particular Area operations. We need a way to describe all the ways two shapes can
     * interact. First, some assumptions.  Most importantly, the shapes do not self-intersect.
     * We can test this assumption and abort if it is violated. We are not goimg to attempt
     * to 'fix' the problem. The use cases determine how they should be fixed. That should
     * happen at a higher level. The second assumption is that CW paths create solid shapes
     * annd CCW paths cut out holes. A simpler rule is that a path removes on the left and
     * adds on the right.  In any case, the direction of the paths at an intersection need
     * to be known. This leads to a discussion about coincident paths. When two paths cross
     * there is a single intersection.  It is also possible for two paths to come together
     * and become coincident.  In a way, this is a stretched out intersection. If both paths
     * go the same direction in the coincidental section two enter at one end and two leave
     * at the other. If they go opposite directions one enters and one leaves at each end.
     * Coincidental sections can be described by two 'intersections' at each end. These must
     * show which path enters which path leaves. We can split single intersections like we
     * do coincidental sections. For the add function, one flips between paths. So the split
     * should have one path entering and the opposite leaving. In the add operation, we
     * would not need to go to the 2nd half.
     *
     * Now a discussion about processing. First, intersections are found using bounding boxes
     * in something like sucessive approximation. Two segments are considered to have an
     * intersection when the bounding box (or the distance between points) is less than a
     * given value (tolerance). Coincidental segments show up as a series of intersections
     * at roughly the tolerance distance.  Another wrinkle is that single intersections may
     * generate multiple points, particularly when the segments come together at a low angle.
     * The answer is to allow segments to be created and convert all segments less than
     * 2 rolerances to be converted into single intersections. Another tricky thing is when
     * the coincidence happens at an endpoint.  The adjacent curves may find intersections
     * near their endpoints within the given tolerance. This creates a logic issue.  We are
     * now bringing four lines together with two entry points. We must ID these cases and
     * 'fix' them.
     *
     * This is a little tricky. Let assume we have sorted the intersections into order for
     * the first shape (this PolyBezier). There are three way we can encounter this case.
     * All happen near endpoints. If the 2nd curve becomes coincident at an endpoint on this
     * curve. Near the endpoint of the segment before the coincidental one, we can get
     * intersections with up to two segments on the second curve. The answer is when near an
     * endpoint is to move forward until one is into concidental section, then back into the
     * endpoint. One should be able to determine the right segment on curve two and to
     * remove all other points near it.
     *
     * The first step in processing is to sort the intersections along the two paths. Above
     * we discuss entering and leaving. For single intersections this is implied by t. One
     * leaves on an increasing t.
     *
     * NOTE: Searching for self-intersections could have the same issue with adjacent curves
     * that was discussed above. We need to throw out intersections near the endpoints of
     * adjacent curves.
     */
    intersections(poly, tol)
    {
        //SMG_TODO test for self-intersections. NOTE: I am not implementing this because
        //I have well behaved shapes. There should be a way of skipping this test when
        //implemented
        let rawIntersections = [];
        // let limit = 4 * tol;
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let c1 = this.curves[iIdx];
            if (PolyBezier.debugObj != null)
            {
                if (PolyBezier.debugObj.c1Idx == iIdx) PolyBezier.debugObj.dropin.push([new Bezier(c1), '#ffff00']);
            }
            // console.log('c1', new Bezier(c1));
            for (let iJdx = 0; iJdx < poly.curves.length; iJdx++)
            {
                let c2 = poly.curves[iJdx];
                if (PolyBezier.debugObj != null)
                {
                    // console.trace();
                    if (PolyBezier.debugObj.c2Idx == iJdx) PolyBezier.debugObj.dropin.push([new Bezier(c2), '#00ffff']);
                }
                // console.log('c2', new Bezier(c2));
                if (PolyBezier.debugObj != null)
                {
                    if ((PolyBezier.debugObj.c1Idx == iIdx) && (PolyBezier.debugObj.c2Idx == iJdx))
                    {
                        c1.debug = true;
                    }
                }
                let results = c1.intersects(c2, tol, true);
                if (PolyBezier.debugObj != null)
                {
                    if ((PolyBezier.debugObj.c1Idx == iIdx) && (PolyBezier.debugObj.c2Idx == iJdx))
                    {
                        c1.debug = false;
                        console.log('iIdxToken iJdx results c1 c2', iIdx, iJdx, results, c1, c2);
                    }
                }
                //console.log('iJdx results', iJdx, results);
                for (let iKdx = 0; iKdx < results.length; iKdx++)
                {
                    let t = results[iKdx].split("/").map(v => parseFloat(v));
                    //Record the t parameters and the curve indices
                    //rawIntersections.push({t:t, idx:[iIdxToken, iJdx], entry:[1,1], exit:[1,1]});
                    // rawIntersections.push({t:t, idx:[iIdxToken, iJdx, -1]/*, entry:[1,1], exit:[1,1]*/});
                    rawIntersections.push({
                        pt: c1.get(t[0]),
                        realIdx: [iIdx + t[0], iJdx + t[1]],
                        t: t,
                        idx: [iIdx, iJdx, -1]/*, entry:[1,1], exit:[1,1]*/
                    });
                }

            }
        }
        if (rawIntersections.length == 0)
            return []; //No intersections return empty array

        //Sort along the curves in this PolyBezier (first shape)
        rawIntersections.sort(function (a, b)
        {
            return (a.idx[0] + a.t[0]) - (b.idx[0] + b.t[0]);
        });
        if (PolyBezier.debugObj != null)
        {
            for (let iIdx = 0; iIdx < rawIntersections.length; iIdx++)
            {
                let thisi = rawIntersections[iIdx];
                DrawUtils.displayPoint(thisi.pt, 0.01, PolyBezier.debugObj, '#0f0f00');
            }
            // PolyBezier.debugObj = null;
        }
        let processed = this.processRawIntersections2(rawIntersections, tol);
        // if(PolyBezier.debugObj != null)
        // {
        // for(let iIdxToken = 0; iIdxToken < processed.length; iIdxToken++)
        // {
        // let thisi = processed[iIdxToken];
        // DrawUtils.displayPoint(thisi.pt, 0.1, PolyBezier.debugObj, '#0f0f00');
        // }
        // }
        return processed;
    }
    processRawIntersections2(rawIntersections, tol, selfI)
    {
        //The default is false when selfI is undefined
        let locSelf = false;
        if (typeof (selfI) != 'undefined') locSelf = selfI;
        let debugProc = false;
        // if(PolyBezier.debugObj != null)debugProc = true;
        //Choose a test limit that is greater than the spacing of coincidental intersections
        let limit = 2 * tol;
        // console.log('limit', limit);
        if (debugProc) console.log('processRawIntersections tol intersections', tol, rawIntersections);
        //Now convert raw intersections into single and coincidental intersections.
        //Getting started is a little tricky. It is possible that we start in the middle of
        //a coincidental section. By design these are identified by starting and ending pairs.
        //We either need to back up until we are at the beginning or move forward past the end
        //and handle this segment later. Backing up is easier. Another gotcha could be if we are
        //at the end of a coincidental section and there are noi following points. We need to look
        //back for that as well. So we search back until we find a gap greater than the coincident
        //limit. Then we make the point in front of the gap the first to process. That point is
        //guaranteed to be the start of a coincidental section or a single intersection.
        let theIntersections = [];
        let anIntersect = rawIntersections[0];;
        let anotherIntersect;
        let dist = 0;
        if (rawIntersections.length == 0) return theIntersections;

        if (rawIntersections.length <= 2)
        {
            if (rawIntersections.length == 2)
            {
                anotherIntersect = rawIntersections[1];
                dist = utils.dist(anIntersect.pt, anotherIntersect.pt);
                if (dist < limit)
                {
                    rawIntersections.splice(1, 1);
                }
            }
            theIntersections.push({
                pt: anIntersect.pt,
                realIdx: [anIntersect.realIdx[0], anIntersect.realIdx[1]],
                t: [anIntersect.t[0], anIntersect.t[1]],
                idx: [anIntersect.idx[0], anIntersect.idx[1], anIntersect.idx[2]],
                entry: [1, 1],
                exit: [1, 1]
            });
            if (rawIntersections.length == 1) return theIntersections;
            theIntersections.push({
                pt: anotherIntersect.pt,
                realIdx: [anotherIntersect.realIdx[0], anotherIntersect.realIdx[1]],
                t: [anotherIntersect.t[0], anotherIntersect.t[1]],
                idx: [anotherIntersect.idx[0], anotherIntersect.idx[1], anotherIntersect.idx[2]],
                entry: [1, 1],
                exit: [1, 1]
            });
            return theIntersections;
        }
        //We need to work back from -1 so that we have a valid endIdx. We don't want endIdx
        //to be greater than rawIntersections.length - 1. endIdx is
        //rawIntersections.length + iIdxToken - 1, so iIdxToken must be less than or equal to 0
        //This had to change
        let iIdx = 0;
        anIntersect = rawIntersections.at(iIdx--); //Post dec intersection at iIdxToken (-1)
        if (debugProc) console.log('Starting intersect working back anIntersect', anIntersect);
        //iIdxToken = -2
        let processPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
        // let debugDist = [];
        // for(let iJdx = 0; iJdx < rawIntersections.length; iJdx++)
        // {
        // dist = utils.dist(rawIntersections[iJdx].pt, anIntersect.pt);
        // debugDist.push(dist);
        // anIntersect = rawIntersections[iJdx];
        // }
        // if(debugProc)console.log('dist', debugDist);
        while (dist <= limit && iIdx >= -rawIntersections.length)
        {
            anIntersect = rawIntersections.at(iIdx--); //Post dec
            //iIdxToken = -3, -4, ...
            // let thisPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
            let thisPt = anIntersect.pt;
            dist = utils.dist(processPt, thisPt);
            // dist = Math.sqrt((processPt.x - thisPt.x) ** 2 + (processPt.y - thisPt.y) ** 2);
            // if(debugProc)console.log('dist to find start gap', dist, iIdxToken);
            //Make thisPt the reference for the next test
            processPt = { x: thisPt.x, y: thisPt.y };
        }
        //We can verify this by assuming the gap is immediate. We would have it between
        //-1 and -2
        //The dist from processPt to thisPt is greater than coincident limit. We want to
        //start at index of processPt+1. iIdxToken is thisPt index - 1 and is processPt index - 2
        iIdx += 3; //This puts a point with a gap in front of it at iIdxToken - 1
        //A little more discussion here. There is another benefit to starting negative.
        //We can set it up so that the loop goes util the last point is the point now
        //at iIdxToken - 1. This means we will process the that is now at iIdxToken - 2 as the last
        //point fully completing the loop.
        //By starting at iIdxToken -1 above and finding an immediate gap means that iIdxToken ends
        //up at -3. For iIdxToken - 1 to equal -1, iIdxToken must be 0, so we add 3.
        //Now to cover the entire range endIdx must equal rawIntersections + length.
        //The adjustment is to add iIdxToken (0 in this case) it will be some negative number
        //is the gap[ is further back.
        //if(iIdxToken > 0)iIdxToken = 0;
        let endIdx = rawIntersections.length + iIdx;
        if (debugProc) console.log('rawLength:', rawIntersections.length, ' endIdx:', endIdx, ' starting iIdxToken:', iIdx);
        //Get ready to do the first intersection
        let intersect2Process = rawIntersections.at(iIdx - 1);
        //We have a valid starting point. A little discussion. We are always looking back at
        //iIdxToken - 1 and making a determination about it. For a clean start we need to have
        //an intersection with a gap in front of it where iIdxToken - 1 points at the that
        //intersection.
        //BTW we use the 'at' method to look back because it allows negative numbers to wrap
        //Note by getting the intersect2Process in the for before the index is incremented
        //we can use continue and the implied else design pattern
        let startIdx = iIdx - 1;
        let thisIdx = iIdx;
        for (; iIdx < endIdx; intersect2Process = rawIntersections.at(thisIdx), iIdx++)
        {
            //Inside the loop we process all the intersections up to the next gap and adjust
            //iIdxToken to point at the first intersection after the gap. When we add 1 to iIdxToken
            //the point at iIdxToken - 1 is the intersection to process
            //intersect2Process is always iIdxToken - 1
            processPt = intersect2Process.pt;
            // processPt = this.curves[intersect2Process.idx[0]].get(intersect2Process.t[0]);
            thisIdx = iIdx;
            if (thisIdx >= rawIntersections.length) thisIdx -= rawIntersections.length;
            anIntersect = rawIntersections.at(thisIdx);
            let thisPt = anIntersect.pt;
            // let thisPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
            // dist = Math.sqrt((1 - thisPt.x)**2 + (5.7 - thisPt.y)**2);
            // if(dist < 5)
            // {
            // if(debugProc)console.log('processPt thisPt', processPt, thisPt);
            // }

            //The dist from the processPt to the next intersect point
            dist = utils.dist(processPt, thisPt);
            // dist = Math.sqrt((processPt.x - thisPt.x) ** 2 + (processPt.y - thisPt.y) ** 2);
            // if(debugProc)console.log('iIdxToken dist adjacent processPt thisPt', iIdxToken, dist, processPt, thisPt);
            if ((dist < limit) && (iIdx < endIdx - 1)) continue;

            if (debugProc) console.log('iIdxToken dist adjacent processPt thisPt', iIdx, dist, processPt, thisPt);
            //When we get to here we have a group of intersections that have no gaps greater
            //than the limit. The first point is at startIdx, the last at iIdxToken - 1;
            //Is this one intersection?
            if (startIdx == iIdx - 1)
            {
                //We have a single intersection

                //Prepare now for next run, this allows us to just continue below
                startIdx = iIdx;
                //If we are analyzing self intersections and we have intersection between adjacent curves
                //these are probably at the endpoint
                if (locSelf && Math.abs(intersect2Process.idx[0] - intersect2Process.idx[1]) == 1)
                {
                    //We are analyzing a self intersecting curve.
                    //Skip this intersection if it is near the endpoint
                    let ep = this.curves[intersect2Process.idx[0]].get(1);
                    dist = utils.dist(ep, intersect2Process.pt);
                    if (dist < limit) continue; //Near endpoint, skip it

                    //Test both endpoints
                    ep = this.curves[intersect2Process.idx[1]].get(0);
                    dist = utils.dist(ep, intersect2Process.pt);
                    if (dist < limit) continue;
                }
                //We have gap before and after this intersection
                //The last point stands alone as a single intersection
                theIntersections.push({
                    pt: { x: intersect2Process.pt.x, y: intersect2Process.pt.y },
                    realIdx: [intersect2Process.realIdx[0], intersect2Process.realIdx[1]],
                    t: [intersect2Process.t[0], intersect2Process.t[1]],
                    idx: [intersect2Process.idx[0], intersect2Process.idx[1], intersect2Process.idx[2]],
                    entry: [1, 1],
                    exit: [1, 1]
                });
                if (debugProc) console.log('Single intersection startIdx:', startIdx, 'iIdxToken:', iIdx, theIntersections.length - 1, intersect2Process);
                //Go back to the top, implied else.
                //We don't need to adjust iIdxToken
                continue;
            }
            //Now we have more than one intersection, what is the length?
            //We have the possibility of having an endpoint near a valid intersection
            dist = utils.dist(rawIntersections.at(startIdx).pt, rawIntersections.at(iIdx - 1).pt);
            if (dist < 2 * limit)
            {
                //Treat this like a single intersection
                //We have a single intersection
                let saveStart = startIdx;
                let midIdx = (startIdx + iIdx - 1) / 2;
                intersect2Process = rawIntersections.at(midIdx);
                //Prepare now for next run, this allows us to just continue below
                startIdx = iIdx;
                //If we are analyzing self intersections and we have intersection between adjacent curves
                //these are probably at the endpoint
                if (locSelf && Math.abs(intersect2Process.idx[0] - intersect2Process.idx[1]) == 1)
                {
                    //We are analyzing a self intersecting curve.
                    //Skip this intersection if it is near the endpoint
                    let ep = this.curves[intersect2Process.idx[0]].get(1);
                    dist = utils.dist(ep, intersect2Process.pt);
                    if (dist < limit) continue; //Near endpoint, skip it

                    //Test both endpoints
                    ep = this.curves[intersect2Process.idx[1]].get(0);
                    dist = utils.dist(ep, intersect2Process.pt);
                    if (dist < limit) continue;
                }
                //We have gap before and after this intersection
                //The last point stands alone as a single intersection
                theIntersections.push({
                    pt: { x: intersect2Process.pt.x, y: intersect2Process.pt.y },
                    realIdx: [intersect2Process.realIdx[0], intersect2Process.realIdx[1]],
                    t: [intersect2Process.t[0], intersect2Process.t[1]],
                    idx: [intersect2Process.idx[0], intersect2Process.idx[1], intersect2Process.idx[2]],
                    entry: [1, 1],
                    exit: [1, 1]
                });
                if (debugProc) console.log('Single intersection from group middleIdx', midIdx, 'startIdx:', saveStart, 'iIdxToken:', iIdx, theIntersections.length - 1, intersect2Process);
                //console.log('Single intersection', theIntersections.length-1, intersect2Process);
                //Go back to the top, implied else.
                //We don't need to adjust iIdxToken
                continue;
            }
            //Now we could have a coincidental section
            //Start from the middle and work to the ends
            let midIdx = (startIdx + iIdx - 1) / 2;
            // console.log('startIdx', startIdx);
            anIntersect = rawIntersections.at(midIdx);
            let workIdx = midIdx;
            for (; ;)
            {
                if (workIdx <= startIdx) break;
                do
                {
                    // console.log('startIdx workIdx', startIdx, workIdx);
                    intersect2Process = rawIntersections.at(--workIdx);
                } while ((anIntersect.idx[0] == intersect2Process.idx[0]) && (anIntersect.idx[1] == intersect2Process.idx[1]) && (workIdx >= startIdx));
                if (workIdx == startIdx) break;
                dist = utils.dist(rawIntersections.at(startIdx).pt, intersect2Process.pt);
                if (dist <= 2 * limit) break;

                anIntersect = rawIntersections.at(workIdx);

            }
            //If we get here we are either at startIdx or we are one below the end of matching indexes
            if ((anIntersect.idx[0] != intersect2Process.idx[0]) || (anIntersect.idx[1] != intersect2Process.idx[1]))
            {
                startIdx = workIdx + 1;
            }
            // startIdx  is set
            let lastIdx = iIdx - 1;
            //We will work from the middle to the end.  In most cases a coincidental section starts and/or ends
            //on an endpoint. There can be extraneous points near the endpoints. We hope to find and filter those
            //points out
            anIntersect = rawIntersections.at(midIdx);
            workIdx = midIdx;
            for (; ;)
            {
                do
                {
                    intersect2Process = rawIntersections.at(++workIdx);
                } while ((anIntersect.idx[0] == intersect2Process.idx[0]) && (anIntersect.idx[1] == intersect2Process.idx[1]) && (workIdx >= lastIdx));
                if (workIdx == lastIdx) break;
                dist = utils.dist(rawIntersections.at(lastIdx).pt, intersect2Process.pt);
                if (dist <= 2 * limit) break;

                anIntersect = rawIntersections.at(workIdx);
            }
            //If we get here we are either at startIdx or we are one below the end of matching indexes
            if ((anIntersect.idx[0] != intersect2Process.idx[0]) || (anIntersect.idx[1] != intersect2Process.idx[1]))
            {
                lastIdx = workIdx - 1;
            }
            let startIntersect = rawIntersections.at(startIdx);
            let lastIntersect = rawIntersections.at(lastIdx);
            let curve2Dir = Math.sign(lastIntersect.t[1] - startIntersect.t[1]);
            if (lastIntersect.idx[1] != startIntersect.idx[1])
            {
                curve2Dir = Math.sign(lastIntersect.idx[1] - startIntersect.idx[1]);
            }
            //One end of coincidental section
            theIntersections.push({
                pt: { x: startIntersect.pt.x, y: startIntersect.pt.y },
                realIdx: [startIntersect.realIdx[0], startIntersect.realIdx[1]],
                t: [startIntersect.t[0], startIntersect.t[1]],
                idx: [startIntersect.idx[0], startIntersect.idx[1], startIntersect.idx[2]],
                entry: [1, curve2Dir],
                exit: [-1, -curve2Dir]
            });
            //Opposite end of coincidental section
            theIntersections.push({
                pt: { x: lastIntersect.pt.x, y: lastIntersect.pt.y },
                realIdx: [lastIntersect.realIdx[0], lastIntersect.realIdx[1]],
                t: [lastIntersect.t[0], lastIntersect.t[1]],
                idx: [lastIntersect.idx[0], lastIntersect.idx[1], lastIntersect.idx[2]],
                entry: [-1, -curve2Dir],
                exit: [1, curve2Dir]
            });
            startIdx = iIdx;
        }
        for (let iJdx = 0; iJdx < theIntersections.length; iJdx++)
        {
            theIntersections[iJdx].idx[2] = iJdx;
            theIntersections[iJdx].prev = [-1, -1];
            theIntersections[iJdx].next = [-1, -1];
        }
        if (debugProc) console.log('theIntersections', theIntersections);
        // return [];
        theIntersections.sort(function (a, b)
        {
            return (a.idx[0] + a.t[0]) - (b.idx[0] + b.t[0]);
        });
        return theIntersections;
    }
    /*
    * This is a key function for detecting intersections. The core intersect detection algorithm
    * uses a succesive approximation technique that divides the curves in half and tests for
    * overlapping bounding boxes. It does this until the boxes are smaller or equal to some tolerance.
    * It is possible for multiple branches to return an intersection. This is particularily true when
    * the curves approach the intersection at a low angle. Additionally, two curves that are coincidental
    * or have coincidental sections will return a series of intersections approximately at intervals
    * related to the tolerance (approximately 2*tolerance).
    * the purpose of this function is to analyze the intersections and determine what the topology was
    * that generated the intersections.  At this time, the analysis is based on the intersections alone.
    * In the future, the code could inspect the curves to improve tthe accuracy.
    */
    processRawIntersections(rawIntersections, tol, selfI)
    {
        //The default is false when selfI is undefined
        let locSelf = false;
        if (typeof (selfI) != 'undefined') locSelf = selfI;
        let debugProc = false;
        if (PolyBezier.debugObj != null) debugProc = true;
        //Choose a test limit that is greateer than the spacing of coincidental intersections
        let limit = 5 * tol;
        if (debugProc) console.log('processRawIntersections tol intersections', tol, rawIntersections);
        //Now convert raw intersections into single and coincidental intersections.
        //Getting started is a little tricky. It is possible that we start in the middle of
        //a coincidental section. By design these are identified by starting and ending pairs.
        //We either need to back up until we are at the beginning or move forward past the end
        //and handle this segment later. Backing up is easier. Another gotcha could be if we are
        //at the end of a coincidental section and there are noi following points. We need to look
        //back for that as well. So we search back until we find a gap greater than the coincident
        //limit. Then we make the point in front of the gap the first to process. That point is
        //guaranteed to be the start of a coincidental section or a single intersection.
        let theIntersections = [];
        //We need to work back from -1 so that we have a valid endIdx. We don't want endIdx
        //to be greater than rawIntersections.length - 1. endIdx is
        //rawIntersections.length + iIdxToken - 1, so iIdxToken must be less than or equal to 0
        let iIdx = -1;
        let anIntersect = rawIntersections.at(iIdx--); //Post dec intersection at iIdxToken (-1)
        if (debugProc) console.log('Starting intersect working back anIntersect', anIntersect);
        //iIdxToken = -2
        let processPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
        let dist = 0;
        while (dist <= limit && iIdx > -rawIntersections.length)
        {
            anIntersect = rawIntersections.at(iIdx--); //Post dec
            //iIdxToken = -3, -4, ...
            let thisPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
            dist = utils.dist(processPt, thisPt);
            // dist = Math.sqrt((processPt.x - thisPt.x) ** 2 + (processPt.y - thisPt.y) ** 2);
            if (debugProc) console.log('dist to find start gap', dist, iIdx);
            //Make thisPt the reference for the next test
            processPt = { x: thisPt.x, y: thisPt.y };
        }
        //We can verify this by assuming the gap is immediate. We would have it between
        //-1 and -2
        //The dist from processPt to thisPt is greater than coincident limit. We want to
        //start at index of processPt+1. iIdxToken is thisPt index - 1 and is processPt index - 2
        iIdx += 3; //This puts a point with a gap in front of it at iIdxToken - 1
        //A little more discussion here. There is another benefit to starting negative.
        //We can set it up so that the loop goes util the last point is the point now
        //at iIdxToken - 1. This means we will process the that is now at iIdxToken - 2 as the last
        //point fully completing the loop.
        //By starting at iIdxToken -1 above and finding an immediate gap means that iIdxToken ends
        //up at -3. For iIdxToken - 1 to equal -1, iIdxToken must be 0, so we add 3.
        //Now to cover the entire range endIdx must equal rawIntersections + length.
        //The adjustment is to add iIdxToken (0 in this case) it will be some negative number
        //is the gap[ is further back.
        if (iIdx > 0) iIdx = 0;
        let endIdx = rawIntersections.length + iIdx;
        if (debugProc) console.log('rawLength endIdx starting iIdxToken', rawIntersections.length, endIdx, iIdx);
        //Get ready to do the first intersection
        let intersect2Process = rawIntersections.at(iIdx - 1);
        //We have a valid starting point. A little discussion. We are always looking back at
        //iIdxToken - 1 and making a determination about it. For a clean start we need to have
        //an intersection with a gap in front of it where iIdxToken - 1 points at the that
        //intersection.
        //BTW we use the 'at' method to look back because it allows negative numbers to wrap
        //Note by getting the intersect2Process in the for before the index is incremented
        //we can use continue and the implied else design pattern
        for (; iIdx < endIdx; intersect2Process = rawIntersections.at(iIdx), iIdx++)
        {
            //Inside the loop we process all the intersections up to the next gap and adjust
            //iIdxToken to point at the first intersection after the gap. When we add 1 to iIdxToken
            //the point at iIdxToken - 1 is the intersection to process
            //intersect2Process is always iIdxToken - 1
            processPt = intersect2Process.pt;
            // processPt = this.curves[intersect2Process.idx[0]].get(intersect2Process.t[0]);
            anIntersect = rawIntersections.at(iIdx);
            let thisPt = anIntersect.pt;
            // let thisPt = this.curves[anIntersect.idx[0]].get(anIntersect.t[0]);
            // dist = Math.sqrt((1 - thisPt.x)**2 + (5.7 - thisPt.y)**2);
            // if(dist < 5)
            // {
            // if(debugProc)console.log('processPt thisPt', processPt, thisPt);
            // }

            //The dist from the processPt to the next intersect point
            dist = utils.dist(processPt, thisPt);
            // dist = Math.sqrt((processPt.x - thisPt.x) ** 2 + (processPt.y - thisPt.y) ** 2);
            if (debugProc) console.log('iIdxToken dist adjacent processPt thisPt', iIdx, dist, processPt, thisPt);
            //The simplest of all. A single intersection with gaps before and after
            if (dist > limit)
            {
                //If we are analyzing self intersections and we have intersection between adjacent curves
                //these are probably at the endpoint
                // if(locSelf && Math.abs(anIntersect.idx[0] - anIntersect.idx[1]) == 1)
                // {
                // //We are analyzing a self intersecting curve.
                // //Skip this intersection if it is near the endpoint
                // let ep = this.curves[anIntersect.idx[0]].get(1);
                // dist = utils.dist(ep, thisPt);
                // if(dist < limit)continue; //Near endpoint, skip it

                // //Test both endpoints
                // ep = this.curves[anIntersect.idx[1]].get(0);
                // dist = utils.dist(ep, thisPt);
                // if(dist < limit)continue;
                // }
                //We have gap before and after this intersection
                if (debugProc) console.log('Single intersection', intersect2Process);
                //The last point stands alone as a single intersection
                theIntersections.push({
                    pt: intersect2Process.pt,
                    realIdx: [intersect2Process.realIdx[0], intersect2Process.realIdx[1]],
                    t: [intersect2Process.t[0], intersect2Process.t[1]],
                    idx: [intersect2Process.idx[0], intersect2Process.idx[1], intersect2Process.idx[2]],
                    entry: [1, 1],
                    exit: [1, 1]
                });
                //Go back to the top, implied else. Code below runs when there is no gap
                //We don't need to adjust iIdxToken
                continue;
            }

            //Now we have two points that are closer than the coincidence limit.
            //There are three posibilities. One, they are part of a single intersection.
            //Two they are extraneous points on adjacent curves at the beginning
            //of coincidence. Three they are the start of coincidence without extraneous
            //points.
            //
            //For the first case we will have several points within the coincidence limits
            //and then a gap. We choose a point in the middle, generate a single intersection
            //and move on. If we get beyond the limits and don't find the gap, then we have
            //a coincidence section. There is one other edge case where we have a single
            //intersection near an endpoint. We could get detections on either side.
            //
            //In the 2nd case, we are near an endpoint. The extraneous points come from the
            //curve that connects to the endpoint.  Even when approaching at a low angle
            //There should be less than one or two extraneous points. Actual coincidence
            //is indicated by several consecutive points with the same indexes.
            //
            //If we don't find this we need to consolidate the points we have found into
            //single intersections
            //
            //The algorithm to filter the extraneous points also works for the third case.

            //Here we prepare to search for a run of intersections.  Even though our setup
            //should ensure a gap at the end we will also test the index
            //We need a series of points that are less than the limit apart (no gaps) and
            //have the same curve indexes and have greater than or equal to the following
            //distance between the first and last point
            let run = 20 * tol;
            let runDist = 0;
            //Start at our process point
            let startIdx = iIdx - 1;
            //The follow two steps happen often, get the intersection and then the point
            //In this case, we get the point on our curve (this PolyBezier)
            let startIntersect = rawIntersections.at(startIdx);
            if (debugProc) console.log('Start of search for a run', startIntersect);
            // let startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
            let startPt = { x: startIntersect.pt.x, y: startIntersect.pt.y };
            //searchIdx will be incremented at the top of the loop, so start here
            let searchIdx = startIdx;
            let searchIntersect;
            // let searchPt;
            let searchDist;
            do
            {
                searchIdx++;
                searchIntersect = rawIntersections.at(searchIdx);
                // searchPt = this.curves[searchIntersect.idx[0]].get(searchIntersect.t[0]);

                searchDist = utils.dist(searchIntersect.pt, startPt);
                // searchDist = Math.sqrt((searchIntersect.pt.x - startPt.x) ** 2 + (searchIntersect.pt.y - startPt.y) ** 2);
                runDist += searchDist;
                //This point becomes the next start point
                startPt = {
                    x: searchIntersect.pt.x,
                    y: searchIntersect.pt.y
                };
                //Now wondering what this accomplishes.  I believe the assumption is that coincidental sections
                //are almost certainly going to start at endpoints. But this is a problem when we have a single
                //intersection near an endpoint. That type of intersection is guaranteed in looking at self
                //intersections.  This breaks self intersections
                if ((startIntersect.idx[0] != searchIntersect.idx[0]) || (startIntersect.idx[1] != searchIntersect.idx[1]))
                {
                    //The indexes are different, set a new start at the last point
                    if (debugProc) console.log('Crossed into new segment', startIntersect.idx[0], searchIntersect.idx[0], startIntersect.idx[1], searchIntersect.idx[1]);
                    //startPt is set correctly above
                    startIdx = searchIdx - 1;
                    startIntersect = rawIntersections.at(startIdx);
                    runDist = 0;
                    //startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
                }
                //We keep looping until one of the following is false.
                //Note we test searchIdx against endIdx - 1, because we will increment at the
                //top of the loop. The last pass will be searchIdx = endIdx - 1
            } while ((searchDist <= limit) && (searchIdx < endIdx - 1) && (runDist < run));
            if (debugProc) console.log('runDist (searchDist > limit)', runDist, (searchDist > limit));
            // }while((searchDist <= limit)  && (searchIdx < endIdx - 1) && ((searchIdx - startIdx) < run));
            //Did we find a run
            // if(searchDist > limit)
            if (runDist < run)
            {
                //There was no run before a gap. Treat as a single intersection
                //The ideal solution would be to find the average point, but determining the curve
                //indexes could be a problem. The answer is to use the intersection whose index
                //is in the middle.
                let singleIdx = Math.round((iIdx + searchIdx - 2) / 2);
                let singleIntersect = rawIntersections.at(singleIdx);
                //searchIdx points to next intersection
                iIdx = searchIdx;
                // if(locSelf && Math.abs(singleIntersect.idx[0] - singleIntersect.idx[1]) == 1)
                // {
                // //We are analyzing a self intersecting curve.
                // //Skip this intersection if it is near the endpoint
                // let ep = this.curves[singleIntersect.idx[0]].get(0);
                // dist = utils.dist(ep, singleIntersect.pt);
                // if(dist < limit)continue;

                // //Test both endpoints
                // ep = this.curves[singleIntersect.idx[0]].get(1);
                // dist = utils.dist(ep, singleIntersect.pt);
                // if(dist < limit)continue;
                // }
                if (debugProc) console.log('Not long enough for coincidence single intersect', singleIntersect);
                theIntersections.push({
                    pt: singleIntersect.pt,
                    realIdx: [singleIntersect.realIdx[0], singleIntersect.realIdx[1]],
                    t: [singleIntersect.t[0], singleIntersect.t[1]],
                    idx: [singleIntersect.idx[0], singleIntersect.idx[1], singleIntersect.idx[2]],
                    entry: [1, 1],
                    exit: [1, 1]
                });
                continue;
            }
            //We have a run. Now look back to include the earliest points with the two indexes
            //The other points should be points on other curves near the endpoint
            let endRun = searchIdx;
            //We found a run now find the 1st intersection on the same curves
            searchIdx = startIdx - 1;
            while (searchIdx >= iIdx - 1)
            {
                searchIntersect = rawIntersections.at(searchIdx);
                if ((startIntersect.idx[0] == searchIntersect.idx[0]) && (startIntersect.idx[1] == searchIntersect.idx[1]))
                {
                    startIdx = searchIdx;
                }
                searchIdx--;
            }
            //Now startIdx points at earliest intersection on the same curves as the run
            //Start a coincidental section
            startIntersect = rawIntersections.at(startIdx);
            searchIntersect = rawIntersections.at(endRun);
            startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
            let segStartPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
            if (debugProc) console.log('coincident start', startIdx, startIntersect);
            //Positive 1 indicates increasing t and an entry
            let curve2Dir = Math.sign(searchIntersect.t[1] - startIntersect.t[1]);
            if (searchIntersect.idx[1] != startIntersect.idx[1])
            {
                curve2Dir = Math.sign(searchIntersect.idx[1] - startIntersect.idx[1]);
            }
            theIntersections.push({
                realIdx: [startIntersect.realIdx[0], startIntersect.realIdx[1]],
                t: [startIntersect.t[0], startIntersect.t[1]],
                idx: [startIntersect.idx[0], startIntersect.idx[1], startIntersect.idx[2]],
                entry: [1, curve2Dir],
                exit: [-1, -curve2Dir]
            });

            //Search for the end of the coincidental section
            do
            {
                searchIdx++;
                searchIntersect = rawIntersections.at(searchIdx);
                // searchPt = this.curves[searchIntersect.idx[0]].get(searchIntersect.t[0]);
                searchDist = Math.sqrt((searchIntersect.pt.x - startPt.x) ** 2 + (searchIntersect.pt.y - startPt.y) ** 2);
                if (debugProc) console.log('Search for coincidence end dist idx', searchDist, searchIdx, searchIntersect.pt);
                startPt = {
                    x: searchIntersect.pt.x,
                    y: searchIntersect.pt.y
                };
            } while ((searchDist <= limit) && (searchIdx < endIdx));
            //searchIdx points to the first intersection after a gap or to the end index
            let nextIdx = searchIdx;
            if (debugProc) console.log('nextIdx', nextIdx);
            if (searchDist > limit)
            {
                //There was a gap, move back to intersection before the gap
                searchIdx--;
            }
            //Start at index before the gap
            startIdx = searchIdx;
            startIntersect = rawIntersections.at(startIdx);
            startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
            runDist = 0;
            //Search back for a run
            do
            {
                searchIdx--;
                if (debugProc) console.log('searchIdx', searchIdx);
                searchIntersect = rawIntersections.at(searchIdx);
                // searchPt = this.curves[searchIntersect.idx[0]].get(searchIntersect.t[0]);
                searchDist = Math.sqrt((searchIntersect.pt.x - startPt.x) ** 2 + (searchIntersect.pt.y - startPt.y) ** 2);
                runDist += searchDist;
                startPt = {
                    x: searchIntersect.pt.x,
                    y: searchIntersect.pt.y
                };
                if ((startIntersect.idx[0] != searchIntersect.idx[0]) || (startIntersect.idx[1] != searchIntersect.idx[1]))
                {
                    startIdx = searchIdx + 1;
                    startIntersect = rawIntersections.at(startIdx);
                    runDist = 0;
                    //startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
                }
            } while ((searchDist <= limit) && (searchIdx > iIdx - 1) && (runDist < run));
            // }while((searchDist <= limit)  && (searchIdx > iIdxToken - 1) && ((startIdx - searchIdx) < run));
            searchIdx = startIdx + 1;
            //Now search forward to include points also on the two curves
            while (searchIdx <= nextIdx)
            {
                searchIntersect = rawIntersections.at(searchIdx);
                if (debugProc) console.log('searchIntersect', searchIntersect);
                if ((startIntersect.idx[0] == searchIntersect.idx[0]) && (startIntersect.idx[1] == searchIntersect.idx[1]))
                {
                    startIdx = searchIdx;
                }
                searchIdx++;
            }
            startIntersect = rawIntersections.at(startIdx);
            startPt = this.curves[startIntersect.idx[0]].get(startIntersect.t[0]);
            dist = Math.sqrt((segStartPt.x - startPt.x) ** 2 + (segStartPt.y - startPt.y) ** 2);
            if (debugProc) console.log('coincident info', segStartPt, startPt, dist);
            if (debugProc) console.log('coincident end', startIdx, startIntersect);
            theIntersections.push({
                pt: startIntersect.pt,
                realIdx: [startIntersect.realIdx[0], startIntersect.realIdx[1]],
                t: [startIntersect.t[0], startIntersect.t[1]],
                idx: [startIntersect.idx[0], startIntersect.idx[1], startIntersect.idx[2]],
                entry: [-1, -curve2Dir],
                exit: [1, curve2Dir]
            });
            iIdx = nextIdx;
        }
        for (let iJdx = 0; iJdx < theIntersections.length; iJdx++)
        {
            theIntersections[iJdx].idx[2] = iJdx;
            theIntersections[iJdx].prev = [-1, -1];
            theIntersections[iJdx].next = [-1, -1];
        }
        if (debugProc) console.log('theIntersections', theIntersections);
        // return [];
        theIntersections.sort(function (a, b)
        {
            return (a.idx[0] + a.t[0]) - (b.idx[0] + b.t[0]);
        });
        return theIntersections;
    }

    getReal(real)
    {
        return this.curves[Math.floor(real)].get(real % 1);
    }

    lineIntersects(line)
    {
        // console.log('PolyBezier.lineIntersects: line', line);
        let intersects = [];
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            let c1 = this.curves[iIdx];
            let results = c1.lineIntersects(line);
            // console.log('results', results)
            for (let iKdx = 0; iKdx < results.length; iKdx++)
            {
                // console.log('PolyBezier.lineIntersects', c1.get(results[iKdx]));
                intersects.push({
                    t: results[iKdx],
                    idx: iIdx
                });
            }
        }
        return intersects;
    }

    update()
    {
        for (let iIdx = 0; iIdx < this.curves.length; iIdx++)
        {
            this.curves[iIdx].update();
        }
    }
    shapeRelationxx(shape, tol = 0.01)
    {
        let rel = this.shapeRelation(shape, tol);
        console.log('shapeRelation', rel, this, shape);
        return rel;
    }
    /*
    * This function finds how a shape relates to this shape. The shape is a PolyBezier. This is for closed shapes.
    * There are five possibilities. The shapes are disjoint, one shape is inside the other, the shapes are coincidental,
    * the shapes intersect, or the shapes are tangent. The function returns an object with the following properties:
    * disjoint: true if the shapes are disjoint
    * inside: true if the shape is inside this shape
    * surround: true if the shape surrounds the this shape
    * coincidental: true if the shapes are coincidental
    * intersect: true if the shapes intersect. This includes tangent
    */
    shapeRelation(shape, tol = 0.01)
    {
        let relation = {
            disjoint: false,
            inside: false,
            surround: false,
            coincidental: false,
            intersect: false
        };
        //First test for a point
        if (shape.constructor.name != "PolyBezier")
        {
            if (this.contains(shape))
            {
                relation.inside = true;
                return relation;
            }
            relation.disjoint = true;
            return relation;
        }
        //this.bbox();
        //shape.bbox();
        //console.log('shapeRelation', this, shape);
        //We now have two PolyBeziers
        //First test for disjoint. This first test should be for overlapping bounding boxes
        //there will be no intersects for enclosed shapes
        if (!utils.bboxoverlap(this.bbox(), shape.bbox()))
        {
            //console.log('disjoint no bboxoverlap');
            relation.disjoint = true;
            return relation;
        }
        //console.log('shapeRelation', this, shape);
        let intersects = this.intersections(shape, tol)
        //console.log('shapeRelation intersects', intersects);
        if (intersects.length != 0)
        {
            //We have realized that open shapes need to be treated differently. An open shape will be inside a closed shape
            //that it intersects.  We will need to test for this.
            if (!shape.closed)
            {
                if (this.closed)
                {
                    //The open shape is inside the closed shape
                    relation.inside = true;
                    return relation;
                }
                relation.surround = true;
                return relation;
            }
            if (!this.closed)
            {
                if (shape.closed)
                {
                    //The closed shape surrounds the open shape
                    relation.surround = true;
                    return relation;
                }
                relation.inside = true;
                return relation;
            }

            // We have two possiblities, the shapes are coincidental or they intersect
            // for now we will ignore tangent and coincidental
            relation.intersect = true;
            return relation;
        }
        //console.log('shapeRelation 0 intersects', intersects);
        // Now we have three possibilities, the shapes are disjoint, the test shape is inside the this shape, 
        //or the this shape is inside the test shape
        //Next test for inside. The test is easy pick a point in the test shape and test if it is inside the this shape
        if (this.contains(shape.curves[0].get(0)))
        {
            //console.log('shape is inside this', shape, this);
            relation.inside = true;
            return relation;
        }
        //Next test for surround
        if (shape.contains(this.curves[0].get(0)))
        {
            //console.log('shape surrounds this', shape, this);
            relation.surround = true;
            return relation;
        }
        // finally the shapes are disjoint
        relation.disjoint = true;
        return relation;
    }

}
//    return PolyBezier;
//})();
