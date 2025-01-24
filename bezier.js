/**
  A javascript Bezier curve library by Pomax.

  Based on http://pomax.github.io/bezierinfo

  This code is MIT licensed.
**/

//import { utils } from "./utils.js";
//import { PolyBezier } from "./poly-bezier.js";
//const Bezier = (function(){
// math-inlining.
const { abs, min, max, cos, sin, acos, sqrt } = Math;
const pi = Math.PI;
// a zero coordinate, which is surprisingly useful
const ZERO = { x: 0, y: 0, z: 0 };

/**
 * Bezier curve constructor.
 *
 * ...docs pending...
 *
 * The following parameters were found in a console.log
 *
 * clockwise: false
 * dimlen: 2
 * dims: (2) ["x", "y"]
 * dpoints: (3) [Array(3), Array(2), Array(1)]
 * order: 3
 * points: (4) [{…}, {…}, {…}, {…}]
 * _3d: false
 * _linear: true
 * _lut: []
 * _t1: 0
 * _t2: 1
 *
 * clockwise   -> angle for 1st control vector to last point is > 0
 * dpoints     -> 1st delta (derivative), 2nd delta ...
 * order       -> quadratic = 2, cubic = 3
 * points      -> start point (order-1 control points) end point
 * _linear     -> true if all the points (control and ends) are on a line
 * _lut        -> precomputed table with value of t for x equal steps populate with getLUT(x)
 * _t1 and _t2 -> for new curve is 0 and 1. split will return subcurves that have t1 and t2
 *                from original curve. Each split keeps mapping back to original curve.
 *                reduce uses split so it also returns curves where _t1 and _t2 map back.
 */
//Copilot suggested an index.js file. But this is the core class that must be imported.
//It makes sense to me that this is the file that has all the classes that need to be exported
//to use the Bezier library
import { utils } from './utils.js';
class Bezier
{
    static debugObj = null;
    constructor(coords)
    {
        //	console.log("bez construct coords :", coords);
        this.debug = false;
        this.len = 0;
        if (coords.constructor.name == 'Bezier')
        {
            coords = coords.points;
        }
        let args =
            coords && coords.forEach ? coords : Array.from(arguments).slice();
        let coordlen = false;

        if (typeof args[0] === "object")
        {
            coordlen = args.length;
            const newargs = [];
            args.forEach(function (point)
            {
                ["x", "y", "z"].forEach(function (d)
                {
                    if (typeof point[d] !== "undefined")
                    {
                        newargs.push(point[d]);
                    }
                });
            });
            args = newargs;
        }

        let higher = false;
        const len = args.length;

        if (coordlen)
        {
            if (coordlen > 4)
            {
                if (arguments.length !== 1)
                {
                    throw new Error(
                        "Only new Bezier(point[]) is accepted for 4th and higher order curves"
                    );
                }
                higher = true;
            }
        } else
        {
            if (len !== 6 && len !== 8 && len !== 9 && len !== 12)
            {
                if (arguments.length !== 1)
                {
                    throw new Error(
                        "Only new Bezier(point[]) is accepted for 4th and higher order curves"
                    );
                }
            }
        }

        const _3d = (this._3d =
            (!higher && (len === 9 || len === 12)) ||
            (coords && coords[0] && typeof coords[0].z !== "undefined"));
        //console.log('_3d', _3d);
        if (_3d == 'undefined') this._3d = false;

        const points = (this.points = []);
        for (let idx = 0, step = _3d ? 3 : 2; idx < len; idx += step)
        {
            var point = {
                x: args[idx],
                y: args[idx + 1],
            };
            if (_3d)
            {
                point.z = args[idx + 2];
            }
            points.push(point);
        }
        const order = (this.order = points.length - 1);

        const dims = (this.dims = ["x", "y"]);
        if (_3d) dims.push("z");
        this.dimlen = dims.length;

        let dist = utils.dist(points[0], points[order]);
        const aligned = utils.align(points, { p1: points[0], p2: points[order] });
        this._linear = !aligned.some((p) => abs(p.y) > dist / 100);
        //if this is linear we can reduce the curve to a line
        if (this._linear)
        {
            //The test above shows that the curve is linear. Before we change the order, we need to get the
            //two endpoints of the curve. We will use these to create a new Bezier curve that is linear.
            this.points = [points[0], points[order]];
            this.order = 1;
        }

        //The following are cached
        this._lut = [];

        this._reduced = null;

        this._bbox = null; //Cache this

        this._t1 = 0;
        this._t2 = 1;
        this.update();
    }

    static quadraticFromPoints(p1, p2, p3, t)
    {
        if (typeof t === "undefined")
        {
            t = 0.5;
        }
        // shortcuts, although they're really dumb
        if (t === 0)
        {
            return new Bezier(p2, p2, p3);
        }
        if (t === 1)
        {
            return new Bezier(p1, p2, p2);
        }
        // real fitting.
        const abc = Bezier.getABC(2, p1, p2, p3, t);
        return new Bezier(p1, abc.A, p3);
    }

    static cubicFromPoints(S, B, E, t, d1)
    {
        if (typeof t === "undefined")
        {
            t = 0.5;
        }
        const abc = Bezier.getABC(3, S, B, E, t);
        if (typeof d1 === "undefined")
        {
            d1 = utils.dist(B, abc.C);
        }
        const d2 = (d1 * (1 - t)) / t;

        const selen = utils.dist(S, E),
            lx = (E.x - S.x) / selen,
            ly = (E.y - S.y) / selen,
            bx1 = d1 * lx,
            by1 = d1 * ly,
            bx2 = d2 * lx,
            by2 = d2 * ly;
        // derivation of new hull coordinates
        const e1 = { x: B.x - bx1, y: B.y - by1 },
            e2 = { x: B.x + bx2, y: B.y + by2 },
            A = abc.A,
            v1 = { x: A.x + (e1.x - A.x) / (1 - t), y: A.y + (e1.y - A.y) / (1 - t) },
            v2 = { x: A.x + (e2.x - A.x) / t, y: A.y + (e2.y - A.y) / t },
            nc1 = { x: S.x + (v1.x - S.x) / t, y: S.y + (v1.y - S.y) / t },
            nc2 = {
                x: E.x + (v2.x - E.x) / (1 - t),
                y: E.y + (v2.y - E.y) / (1 - t),
            };
        // ...done
        return new Bezier(S, nc1, nc2, E);
    }

    static getUtils()
    {
        return utils;
    }

    getUtils()
    {
        return Bezier.getUtils();
    }

    static get PolyBezier()
    {
        return PolyBezier;
    }

    valueOf()
    {
        return this.toString();
    }

    toString()
    {
        return utils.pointsToString(this.points);
    }

    /*
    * The toSVG() function is used to convert an array of Bezier curves to an SVG path data string.
    * It doesn't make a lot of sense to convert a single Bezier curve to an SVG path data string.
    * However, converting an array could be very useful. This should be a static function.
    * 
    * A little more discussion about what the function does would be helpful. It detects segments
    * and loops. It compares the first point of a bezier to the last point of the previous bezier.
    * If they are different, an 'M' command is added to the path data string. The start point is
    * recorded to check for loops. As further beziers are processed, if the start point is the same
    * as the end point of the previous bezier, the appropriate command ('L' or 'C') is added to the
    * path data string. If the start point is different, the end point is compared to the start point
    * from the last M command. If they are the same, a 'Z' command is added to the path data string.
    * 
    */
    static toSVG(curves)
    {
        //console.log("toSVG curves :", curves);
        if (!Array.isArray(curves))
        {
            throw new Error("curves must be an array");
        }
        if (curves.length === 0)
        {
            return "";
        }
        if (!curves[0] instanceof Bezier)
        {
            throw new Error("curves must be an array of Bezier curves");
        }
        let segStart = null;
        let lastEnd = null;
        let path = "";
        curves.forEach((curve) =>
        {
            const start = curve.points[0];
            const end = curve.points[curve.order];
            if (lastEnd !== null && utils.dist(lastEnd, start) > 0.0001)
            {
                segStart = null;
            }
            if (segStart === null)
            {
                segStart = start;
                path += `M ${start.x} ${start.y} `;
            }
            switch (curve.order)
            {
                case 1:
                    path += `L ${end.x} ${end.y} `;
                    break;
                case 2:
                    path += `Q ${curve.points[1].x} ${curve.points[1].y} ${end.x} ${end.y} `;
                    break;
                case 3:
                    path += `C ${curve.points[1].x} ${curve.points[1].y} ${curve.points[2].x} ${curve.points[2].y} ${end.x} ${end.y} `;
                    break;
                default:
                    throw new Error("unsupported order");
            }
            lastEnd = end;
           if (utils.dist(segStart, end) < 0.0001)
            {
                path += "Z ";
                segStart = null;
                lastEnd
            }
        });
        return path;
    }

    //toSVG()
    //{
    //    if (this._3d) return false;
    //    const p = this.points,
    //        x = p[0].x,
    //        y = p[0].y;
    //    let s = [];

    //    if (this._linear)
    //    {
    //        s = ["M", x, y, "L", p[this.order].x, p[this.order].y];
    //    } else
    //    {
    //        s = ["M", x, y, this.order === 2 ? "Q" : "C"];
    //        for (let i = 1, last = p.length; i < last; i++)
    //        {
    //            s.push(p[i].x);
    //            s.push(p[i].y);
    //        }

    //    }
    //    return s.join(" ");
    //}

    setRatios(ratios)
    {
        if (ratios.length !== this.points.length)
        {
            throw new Error("incorrect number of ratio values");
        }
        this.ratios = ratios;
        this._lut = []; //  invalidate any precomputed LUT
        this._reduced = null;
        this._bbox = null;
    }

    verify()
    {
        const print = this.coordDigest();
        if (print !== this._print)
        {
            this._print = print;
            this.update();
        }
    }

    coordDigest()
    {
        return this.points
            .map(function (c, pos)
            {
                return "" + pos + c.x + c.y + (c.z ? c.z : 0);
            })
            .join("");
    }

    update()
    {
        // for(let iIdxToken = 0; iIdxToken < this.points.length; iIdxToken++)
        // {
        // this.points[iIdxToken].x = Math.round(8.0*this.points[iIdxToken].x)/8.0;
        // this.points[iIdxToken].y = Math.round(8.0*this.points[iIdxToken].y)/8.0;
        // }		
        // invalidate any precomputed LUT
        this._lut = [];
        this._reduced = null;
        this._bbox = null;
        this.dpoints = utils.derive(this.points, this._3d);
        this.computedirection();
    }

    computedirection()
    {
        const points = this.points;
        const angle = utils.angle(points[0], points[this.order], points[1]);
        this.clockwise = angle > 0;
    }

    length()
    {
        return utils.length(this.derivative.bind(this));
    }

    static getABC(order = 2, S, B, E, t = 0.5)
    {
        const u = utils.projectionratio(t, order),
            um = 1 - u,
            C = {
                x: u * S.x + um * E.x,
                y: u * S.y + um * E.y,
            },
            s = utils.abcratio(t, order),
            A = {
                x: B.x + (B.x - C.x) / s,
                y: B.y + (B.y - C.y) / s,
            };
        return { A, B, C, S, E };
    }

    getABC(t, B)
    {
        B = B || this.get(t);
        let S = this.points[0];
        let E = this.points[this.order];
        return Bezier.getABC(this.order, S, B, E, t);
    }

    getLUT(steps)
    {
        this.verify();
        steps = steps || 100;
        if (this._lut.length === steps)
        {
            return this._lut;
        }
        this._lut = [];
        // We want a range from 0 to 1 inclusive, so
        // we decrement and then use <= rather than <:
        steps--;
        for (let i = 0, p, t; i < steps; i++)
        {
            t = i / (steps - 1);
            p = this.compute(t);
            p.t = t;
            this._lut.push(p);
        }
        return this._lut;
    }

    on(point, error)
    {
        error = error || 5;
        const lut = this.getLUT(),
            hits = [];
        for (let i = 0, c, t = 0; i < lut.length; i++)
        {
            c = lut[i];
            if (utils.dist(c, point) < error)
            {
                hits.push(c);
                t += i / lut.length;
            }
        }
        if (!hits.length) return false;
        return (t /= hits.length);
    }

    project(point)
    {
        // step 1: coarse check
        const LUT = this.getLUT(),
            l = LUT.length - 1,
            closest = utils.closest(LUT, point),
            mpos = closest.mpos,
            t1 = (mpos - 1) / l,
            t2 = (mpos + 1) / l,
            step = 0.1 / l;

        // step 2: fine check
        let mdist = closest.mdist,
            t = t1,
            ft = t,
            p;
        mdist += 1;
        for (let d; t < t2 + step; t += step)
        {
            p = this.compute(t);
            d = utils.dist(point, p);
            if (d < mdist)
            {
                mdist = d;
                ft = t;
            }
        }
        ft = ft < 0 ? 0 : ft > 1 ? 1 : ft;
        p = this.compute(ft);
        p.t = ft;
        p.d = mdist;
        return p;
    }

    get(t)
    {
        return this.compute(t);
    }

    point(idx)
    {
        return this.points[idx];
    }

    compute(t)
    {
        if (this.ratios)
        {
            return utils.computeWithRatios(t, this.points, this.ratios, this._3d);
        }
        return utils.compute(t, this.points, this._3d, this.ratios);
    }

    raise()
    {
        const p = this.points,
            np = [p[0]],
            k = p.length;
        for (let i = 1, pi, pim; i < k; i++)
        {
            pi = p[i];
            pim = p[i - 1];
            np[i] = {
                x: ((k - i) / k) * pi.x + (i / k) * pim.x,
                y: ((k - i) / k) * pi.y + (i / k) * pim.y,
            };
        }
        np[k] = p[k - 1];
        return new Bezier(np);
    }

    derivative(t)
    {
        return utils.compute(t, this.dpoints[0], this._3d);
    }

    dderivative(t)
    {
        return utils.compute(t, this.dpoints[1], this._3d);
    }

    align()
    {
        let p = this.points;
        return new Bezier(utils.align(p, { p1: p[0], p2: p[p.length - 1] }));
    }

    curvature(t)
    {
        return utils.curvature(t, this.dpoints[0], this.dpoints[1], this._3d);
    }

    inflections()
    {
        return utils.inflections(this.points);
    }

    normal(t)
    {
        //console.log(this);
        if (this._3d == 'undefined') return this.__normal2(t);
        return this._3d ? this.__normal3(t) : this.__normal2(t);
    }

    __normal2(t)
    {
        const d = this.derivative(t);
        const q = sqrt(d.x * d.x + d.y * d.y);
        //console.log("normal() d :", d, " q :", q, "this :", this);
        return { x: -d.y / q, y: d.x / q };
    }

    __normal3(t)
    {
        // see http://stackoverflow.com/questions/25453159
        const r1 = this.derivative(t),
            r2 = this.derivative(t + 0.01),
            q1 = sqrt(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z),
            q2 = sqrt(r2.x * r2.x + r2.y * r2.y + r2.z * r2.z);
        r1.x /= q1;
        r1.y /= q1;
        r1.z /= q1;
        r2.x /= q2;
        r2.y /= q2;
        r2.z /= q2;
        // cross product
        const c = {
            x: r2.y * r1.z - r2.z * r1.y,
            y: r2.z * r1.x - r2.x * r1.z,
            z: r2.x * r1.y - r2.y * r1.x,
        };
        const m = sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
        c.x /= m;
        c.y /= m;
        c.z /= m;
        // rotation matrix
        const R = [
            c.x * c.x,
            c.x * c.y - c.z,
            c.x * c.z + c.y,
            c.x * c.y + c.z,
            c.y * c.y,
            c.y * c.z - c.x,
            c.x * c.z - c.y,
            c.y * c.z + c.x,
            c.z * c.z,
        ];
        // normal vector:
        const n = {
            x: R[0] * r1.x + R[1] * r1.y + R[2] * r1.z,
            y: R[3] * r1.x + R[4] * r1.y + R[5] * r1.z,
            z: R[6] * r1.x + R[7] * r1.y + R[8] * r1.z,
        };
        return n;
    }

    hull(t)
    {
        let p = this.points,
            _p = [],
            q = [],
            idx = 0;
        q[idx++] = p[0];
        q[idx++] = p[1];
        q[idx++] = p[2];
        if (this.order === 3)
        {
            q[idx++] = p[3];
        }
        // we lerp between all points at each iteration, until we have 1 point left.
        while (p.length > 1)
        {
            _p = [];
            for (let i = 0, pt, l = p.length - 1; i < l; i++)
            {
                pt = utils.lerp(t, p[i], p[i + 1]);
                q[idx++] = pt;
                _p.push(pt);
            }
            p = _p;
        }
        return q;
    }

    split(t1, t2)
    {
        // shortcuts
        if (t1 === 0 && !!t2)
        {
            return this.split(t2).left;
        }
        if (t2 === 1)
        {
            return this.split(t1).right;
        }

        // Handle linear Bezier curve (order 1)
        if (this.order === 1)
        {
            //console.log("split() order 1 this :", t1, this);
            const p0 = this.points[0];
            const p1 = this.points[1];
            //console.log("split() order 1 dist p0 p1 :", utils.dist(p0, p1));
            const q0 = utils.lerp(t1, p0, p1);
            const q1 = utils.lerp(t2, p0, p1);
            //console.log("split() order 1 q0 :", q0, " q1 :", q1);
            const result = {
                left: new Bezier([p0, q0]),
                right: new Bezier([q0, p1]),
                span: [p0, q0, q1, p1]
            };

            // make sure we bind _t1/_t2 information!
            result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2);
            result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2);
            result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2);
            result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2);

            // if we have no t2, we're done
            if (!t2)
            {
                return result;
            }

            // if we have a t2, split again:
            t2 = utils.map(t2, t1, 1, 0, 1);
            return result.right.split(t2).left;
        }

        // no shortcut: use "de Casteljau" iteration.
        const q = this.hull(t1);
        const result = {
            left:
                this.order === 2
                    ? new Bezier([q[0], q[3], q[5]])
                    : new Bezier([q[0], q[4], q[7], q[9]]),
            right:
                this.order === 2
                    ? new Bezier([q[5], q[4], q[2]])
                    : new Bezier([q[9], q[8], q[6], q[3]]),
            span: q,
        };

        // make sure we bind _t1/_t2 information!
        result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2);
        result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2);
        result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2);
        result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2);

        // if we have no t2, we're done
        if (!t2)
        {
            return result;
        }

        // if we have a t2, split again:
        t2 = utils.map(t2, t1, 1, 0, 1);
        return result.right.split(t2).left;
    }
    //split(t1, t2) {
    //    // shortcuts
    //    if (t1 === 0 && !!t2) {
    //      return this.split(t2).left;
    //    }
    //    if (t2 === 1) {
    //      return this.split(t1).right;
    //    }

    //    // no shortcut: use "de Casteljau" iteration.
    //    const q = this.hull(t1);
    //    const result = {
    //      left:
    //        this.order === 2
    //          ? new Bezier([q[0], q[3], q[5]])
    //          : new Bezier([q[0], q[4], q[7], q[9]]),
    //      right:
    //        this.order === 2
    //          ? new Bezier([q[5], q[4], q[2]])
    //          : new Bezier([q[9], q[8], q[6], q[3]]),
    //      span: q,
    //    };

    //	//  map: function (v, ds, de, ts, te) {
    //	//    const d1 = de - ds,
    //	//      d2 = te - ts,
    //	//      v2 = v - ds,
    //	//      r = v2 / d1;
    //	//    return ts + d2 * r;
    //	//  },

    //    // make sure we bind _t1/_t2 information!
    //    result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2);
    //    result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2);
    //    result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2);
    //    result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2);

    //    // if we have no t2, we're done
    //    if (!t2) {
    //      return result;
    //    }

    //    // if we have a t2, split again:
    //    t2 = utils.map(t2, t1, 1, 0, 1);
    //    return result.right.split(t2).left;
    //  }

    /*
    * extrema() returns the extrema of the curve. At a minimum, it will return the
    * start and end points of the curve. It may also return the points where the curve
    * crosses the x-axis. It may also return the points where the curve is at a local
    * maximum or minimum.
    * 
    * The function returns an object with the following properties:
    * 
    * x: an array of x values where the curve crosses the x-axis
    * y: an array of y values where the curve is at a local maximum or minimum
    * values: an array of t values where the curve is at a local maximum or minimum
    * 
    */
    extrema()
    {
        const result = {};
        let roots = [];

        //console.log("extrema this:", this);
        this.dims.forEach(
            function (dim)
            {
                let mfn = function (v)
                {
                    return v[dim];
                };
                let p = this.dpoints[0].map(mfn);
                result[dim] = utils.droots(p);
                //console.log("extrema() result[dim] :", result[dim]);
                if (this.order === 3)
                {
                    p = this.dpoints[1].map(mfn);
                    result[dim] = result[dim].concat(utils.droots(p));
                }
                result[dim] = result[dim].filter(function (t)
                {
                    return t >= 0 && t <= 1;
                });
                roots = roots.concat(result[dim].sort(utils.numberSort));
            }.bind(this)
        );

        result.values = roots.sort(utils.numberSort).filter(function (v, idx)
        {
            return roots.indexOf(v) === idx;
        });

        //if two points are close remove one
        let len = this.length();
        //console.log("extrema() len :", len);
        let that = this;
        let lastPoint = this.get(0);
        result.values = result.values.filter(function (v)
        {
            let thisPoint = that.get(v);
            let dist = utils.dist(thisPoint, lastPoint);
            //console.log("extrema() dist :", dist);
            if ((dist / len) < 0.01) return false;

            lastPoint = thisPoint;
            return true;
        });
        //console.log("extrema() result :", result);
        return result;
    }

    bbox()
    {
        //Is it cached
        if (this._bbox != null) return this._bbox;
        const extrema = this.extrema(),
            result = {};
        this.dims.forEach(
            function (d)
            {
                result[d] = utils.getminmax(this, d, extrema[d]);
            }.bind(this)
        );
        this._bbox = result;
        return result;
    }

    overlaps(curve, tol)
    {
        let ltol = 0.00001;
        if (typeof (tol) != 'undefined') ltol = tol;
        if (this.debug) console.log('this.bbox', this.bbox());
        if (this.debug) console.log('curve.bbox', curve.bbox());
        const lbbox = this.bbox(),
            tbbox = curve.bbox();
        let blap = utils.bboxoverlap(lbbox, tbbox, ltol);
        if (this.debug) console.log('bboxoverlap(lbbox, tbbox)', blap);
        return blap;
    }

    /*
    * positive offset is to the left of direction. Negative for the right.
    */
    offset(t, d)
    {
        if (typeof d !== "undefined")
        {
            const c = this.get(t),
                n = this.normal(t);
            const ret = {
                c: c,
                n: n,
                x: c.x + n.x * d,
                y: c.y + n.y * d,
            };
            if (this._3d)
            {
                ret.z = c.z + n.z * d;
            }
            return ret;
        }
        if (this._linear)
        {
            // console.log('linear offset');
            // console.log(this.normal(0));
            const nv = this.normal(0),
                coords = this.points.map(function (p)
                {
                    const ret = {
                        x: p.x + t * nv.x,
                        y: p.y + t * nv.y,
                    };
                    if (p.z && nv.z)
                    {
                        ret.z = p.z + t * nv.z;
                    }
                    return ret;
                });
            //console.log(coords);
            if (Bezier.debugObj != null)
            {
                for (let iIdx = 0; iIdx < coords.length; iIdx++)
                {
                    DrawUtils.displayPoint(coords[iIdx], 0.05, Bezier.debugObj, '#ff0000');
                }
            }
            return [new Bezier(coords)];
        }
        // Now we return 
        // console.log('offset this', this);
        return this.reduce().map(function (s)
        {
            // console.log('s', s);	
            if (s._linear)
            {
                return s.offset(t)[0];
            }
            return s.scale(t);
        });
    }

    simple()
    {
        //console.log("simple() this :", this);
        if (this.order === 3)
        {
            const a1 = utils.angle(this.points[0], this.points[3], this.points[1]);
            const a2 = utils.angle(this.points[0], this.points[3], this.points[2]);
            //console.log("a1 :", a1, " a2 :", a2);
            if ((a1 > 0.001 && a2 < -0.001) || (a1 < -0.001 && a2 > 0.001)) return false;
            if ((abs(a1) < 0.001) && (abs(a2) < 0.001)) return true;
        }
        const n1 = this.normal(0);
        const n2 = this.normal(1);
        //console.log("n1 :", n1, " n2 :", n2);
        let s = n1.x * n2.x + n1.y * n2.y;
        if (s > 1) s = 1;
        if (s < -1) s = -1;
        if (this._3d)
        {
            s += n1.z * n2.z;
        }
        //console.log("abs(acos(s)) < pi / 3  s:", s, "abs(acos(s)) :",abs(acos(s)), "pi/3 :", pi / 3);
        return abs(acos(s)) < pi / 3;
    }

    /*
    * reduce() returns an array of Bezier curves that are simple. A simple curve is one that
    * does not have any inflection points. The curve is split at the inflection points. The
    * function returns an array of Bezier curves that are simple.
    */
    reduce()
    {
        if (this._reduced != null) return this._reduced;
        // TODO: examine these var types in more detail...
        let that = this;
        //console.log("this() :", that);
        let i,
            t1 = 0,
            t2 = 0,
            step = 0.01,
            segment,
            pass1 = [],
            pass2 = [];
        // first pass: split on extrema
        let extrema = this.extrema().values;
        //console.log("extrema.values :", extrema);
        if (extrema.indexOf(0) === -1)
        {
            extrema = [0].concat(extrema);
        }
        if (extrema.indexOf(1) === -1)
        {
            extrema.push(1);
        }
        //console.log("reduce() pass1 extrema :", extrema);
        for (t1 = extrema[0], i = 1; i < extrema.length; i++)
        {
            t2 = extrema[i];
            segment = this.split(t1, t2);
            segment._t1 = t1;
            segment._t2 = t2;
            pass1.push(segment);
            t1 = t2;
        }
        // if(Bezier.debugObj != null)
        // {
        // DrawUtils.displayShape(pass1, Bezier.debugObj, '#707070');
        // for(let iIdxToken = 0; iIdxToken < pass1.length; iIdxToken++)
        // {
        // DrawUtils.displayPoint(pass1[iIdxToken].get(0), 0.05, Bezier.debugObj, '#ff0000');
        // DrawUtils.displayPoint(pass1[iIdxToken].get(1), 0.05, Bezier.debugObj, '#0000ff');
        // }
        // }

        // console.log('reduce pass1', pass1);

        // second pass: further reduce these segments to simple segments
        pass1.forEach(function (p1)
        {
            t1 = 0;
            t2 = 0;
            while (t2 <= 1)
            {
                for (t2 = t1 + step; t2 <= 1 + step; t2 += step)
                {
                    segment = p1.split(t1, t2);
                    if (!segment.simple())
                    {
                        //console.log("!segment.simple() segment :", segment);
                        t2 -= step;
                        if (abs(t1 - t2) < step)
                        {
                            // we can never form a reduction
                            console.log("We can never form a reduction => abs(t1 - t2) < step) t1:", t1, " t2 :", t2, "step :", step);
                            //console.log("segment :", segment);
                            console.log("this :", that);
                            return [];
                        }
                        segment = p1.split(t1, t2);
                        segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
                        segment._t2 = utils.map(t2, 0, 1, p1._t1, p1._t2);
                        pass2.push(segment);
                        t1 = t2;
                        break;
                    }
                }
            }
            if (t1 < 1)
            {
                segment = p1.split(t1, 1);
                segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
                segment._t2 = p1._t2;
                pass2.push(segment);
            }
        });
        //console.log('reduce pass2', pass2);
        this._reduced = pass2;
        //if (Bezier.debugObj != null)
        //{
        //    DrawUtils.displayShape(pass2, Bezier.debugObj, '#707070');
        //    for (let iIdx = 0; iIdx < pass2.length; iIdx++)
        //    {
        //        DrawUtils.displayPoint(pass2[iIdx].get(0), 0.05, Bezier.debugObj, '#ff0000');
        //        DrawUtils.displayPoint(pass2[iIdx].get(1), 0.05, Bezier.debugObj, '#0000ff');
        //    }
        //}
        return pass2;
    }

    scale(d)
    {
        const order = this.order;
        let distanceFn = false;
        if (typeof d === "function")
        {
            distanceFn = d;
        }
        if (distanceFn && order === 2)
        {
            return this.raise().scale(distanceFn);
        }

        // TODO: add special handling for degenerate (=linear) curves.
        const clockwise = this.clockwise;
        const r1 = distanceFn ? distanceFn(0) : d;
        const r2 = distanceFn ? distanceFn(1) : d;
        const v = [this.offset(0, 10), this.offset(1, 10)];
        const points = this.points;
        const np = [];
        const o = utils.lli4(v[0], v[0].c, v[1], v[1].c);

        if (!o)
        {
            throw new Error("cannot scale this curve. Try reducing it first.");
        }
        // move all points by distance 'd' wrt the origin 'o'

        // move end points by fixed distance along normal.
        [0, 1].forEach(function (t)
        {
            const p = (np[t * order] = utils.copy(points[t * order]));
            p.x += (t ? r2 : r1) * v[t].n.x;
            p.y += (t ? r2 : r1) * v[t].n.y;
        });

        if (!distanceFn)
        {
            // move control points to lie on the intersection of the offset
            // derivative vector, and the origin-through-control vector
            [0, 1].forEach((t) =>
            {
                if (order === 2 && !!t) return;
                const p = np[t * order];
                const d = this.derivative(t);
                const p2 = { x: p.x + d.x, y: p.y + d.y };
                np[t + 1] = utils.lli4(p, p2, o, points[t + 1]);
            });
            // if(Bezier.debugObj != null)
            // {
            // // DrawUtils.displayShape(np, Bezier.debugObj, '#707070');
            // for(let iIdxToken = 0; iIdxToken < np.length; iIdxToken++)
            // {
            // DrawUtils.displayPoint(np[iIdxToken], 0.05, Bezier.debugObj, '#ff0000');
            // // DrawUtils.displayPoint(np[iIdxToken], 0.05, Bezier.debugObj, '#0000ff');
            // }
            // }
            return new Bezier(np);
        }

        // move control points by "however much necessary to
        // ensure the correct tangent to endpoint".
        [0, 1].forEach(function (t)
        {
            if (order === 2 && !!t) return;
            var p = points[t + 1];
            var ov = {
                x: p.x - o.x,
                y: p.y - o.y,
            };
            var rc = distanceFn ? distanceFn((t + 1) / order) : d;
            if (distanceFn && !clockwise) rc = -rc;
            var m = sqrt(ov.x * ov.x + ov.y * ov.y);
            ov.x /= m;
            ov.y /= m;
            np[t + 1] = {
                x: p.x + rc * ov.x,
                y: p.y + rc * ov.y,
            };
        });
        if (Bezier.debugObj != null)
        {
            // DrawUtils.displayShape(np, Bezier.debugObj, '#707070');
            for (let iIdx = 0; iIdx < np.length; iIdx++)
            {
                DrawUtils.displayPoint(np[iIdx].get(0), 0.05, Bezier.debugObj, '#ff0000');
                DrawUtils.displayPoint(np[iIdx].get(1), 0.05, Bezier.debugObj, '#0000ff');
            }
        }

        return new Bezier(np);
    }

    outline(d1, d2, d3, d4)
    {
        d2 = typeof d2 === "undefined" ? d1 : d2;
        const reduced = this.reduce(),
            len = reduced.length,
            fcurves = [];

        let bcurves = [],
            p,
            alen = 0,
            tlen = this.length();

        const graduated = typeof d3 !== "undefined" && typeof d4 !== "undefined";

        function linearDistanceFunction(s, e, tlen, alen, slen)
        {
            return function (v)
            {
                const f1 = alen / tlen,
                    f2 = (alen + slen) / tlen,
                    d = e - s;
                return utils.map(v, 0, 1, s + f1 * d, s + f2 * d);
            };
        }

        // form curve oulines
        reduced.forEach(function (segment)
        {
            const slen = segment.length();
            if (graduated)
            {
                fcurves.push(
                    segment.scale(linearDistanceFunction(d1, d3, tlen, alen, slen))
                );
                bcurves.push(
                    segment.scale(linearDistanceFunction(-d2, -d4, tlen, alen, slen))
                );
            } else
            {
                fcurves.push(segment.scale(d1));
                bcurves.push(segment.scale(-d2));
            }
            alen += slen;
        });

        // reverse the "return" outline
        bcurves = bcurves
            .map(function (s)
            {
                p = s.points;
                if (p[3])
                {
                    s.points = [p[3], p[2], p[1], p[0]];
                } else
                {
                    s.points = [p[2], p[1], p[0]];
                }
                return s;
            })
            .reverse();

        // form the endcaps as lines
        const fs = fcurves[0].points[0],
            fe = fcurves[len - 1].points[fcurves[len - 1].points.length - 1],
            bs = bcurves[len - 1].points[bcurves[len - 1].points.length - 1],
            be = bcurves[0].points[0],
            ls = utils.makeline(bs, fs),
            le = utils.makeline(fe, be),
            segments = [ls].concat(fcurves).concat([le]).concat(bcurves),
            slen = segments.length;

        return new PolyBezier(segments);
    }

    outlineshapes(d1, d2, curveIntersectionThreshold)
    {
        d2 = d2 || d1;
        const outline = this.outline(d1, d2).curves;
        const shapes = [];
        for (let i = 1, len = outline.length; i < len / 2; i++)
        {
            const shape = utils.makeshape(
                outline[i],
                outline[len - i],
                curveIntersectionThreshold
            );
            shape.startcap.virtual = i > 1;
            shape.endcap.virtual = i < len / 2 - 1;
            shapes.push(shape);
        }
        return shapes;
    }

    //Some improvement to this function. The technique of splitting curves
    //and looking for overlapping boxes can result in multiple solutions.
    //These solutions will all be very close to each other.
    intersects(curve, curveIntersectionThreshold, raw = false)
    {
        //console.log('intersects', this, curve, raw);
        //if(typeof raw === "undefined")raw = false;
        if (!curve) return this.selfintersects(curveIntersectionThreshold);
        //if(this._linear && curve._linear)
        //{
        // //let thisLine = {p1: this.points[0], p2:this.points[this.order]};
        // let curveLine = {p1: curve.points[0], p2:curve.points[curve.order]};
        // return this.lineIntersects(curveLine);
        //}
        if (curve.p1 && curve.p2)
        {
            console.log('lineIntersects');
            return this.lineIntersects(curve);
        }
        if (curve instanceof Bezier)
        {
            //console.log('reducing curve for curveintersects');
            curve = curve.reduce();
            //console.log('reduced curve', curve);
        }
        let found = this.curveintersects(
            this.reduce(),
            curve,
            curveIntersectionThreshold
        );
        //console.log('curveintersects', found);
        //Do we have more than 1 intersection
        if (!raw && (found.length > 1))
        {
            //We have more than 1 intersection.  
            //Average all points closer than 2*curveIntersectionThreshold
            let aPt = found[0];  //Start with 1st intersection
            //Get the t values on the two curves
            let t = aPt.split("/").map(v => parseFloat(v));
            //Create an object to average the points
            let avePt = { t0tot: t[0], t1tot: t[1], cnt: 1, testPt: this.get(t[0]) };
            //Start an array of average points
            let AvePts = [avePt];
            for (let iPdx = 1; iPdx < found.length; iPdx++)
            {
                //Get next intersection to test
                aPt = found[iPdx];
                //Get t values
                t = aPt.split("/").map(v => parseFloat(v));
                //Get the intersection point for testing
                let altPt = this.get(t[0]);
                //Test against average points
                let iAdx = 0;
                for (; iAdx < AvePts.length; iAdx++)
                {
                    //Get average point object
                    avePt = AvePts[iAdx];
                    //Is this intersection close to the average point
                    if ((utils.dist(avePt.testPt, altPt) < 2 * curveIntersectionThreshold))
                    {
                        //This intersection is close enough to this average point
                        avePt.t0tot += t[0]; //Increase t total for 1st curve
                        avePt.t1tot += t[1]; //Increase t total for 2nd curve
                        avePt.cnt++;  //Increase count of points in average
                        //Calculate a new test point using new average
                        avePt.testPt = this.get(avePt.t0tot / avePt.cnt);
                        break;  //Leave the loop, we have found our point
                    }
                }
                //Did we complete the average loop.  If so there was no average point this
                //intersection was close to. Add a new average point with this intersection
                //to the average point array.
                if (iAdx >= AvePts.length)
                {
                    //New pt
                    AvePts.push({ t0tot: t[0], t1tot: t[1], cnt: 1, testPt: this.get(t[0]) });
                }
            }
            //Now empty found array
            found = [];
            //Repopulate found array with average points
            for (let iAdx = 0; iAdx < AvePts.length; iAdx++)
            {
                avePt = AvePts[iAdx];
                found.push((avePt.t0tot / avePt.cnt) + "/" + (avePt.t1tot / avePt.cnt));
            }
        }
        //We want found sorted by 1st t
        found.sort(function (a, b)
        {
            let ta = a.split("/").map(v => parseFloat(v));
            let tb = b.split("/").map(v => parseFloat(v));
            return (ta[0] - tb[0]);
        });
        return found;
    }

    lineIntersects(line)
    {
        let theLine = line;
        if (line.constructor.name == 'Bezier')
        {
            theLine = { p1: line.get(0), p2: line.get(1) };
        }
        const mx = min(theLine.p1.x, theLine.p2.x),
            my = min(theLine.p1.y, theLine.p2.y),
            MX = max(theLine.p1.x, theLine.p2.x),
            MY = max(theLine.p1.y, theLine.p2.y);
        // console.log('utils.roots(this.points, theLine)', utils.roots(this.points, theLine));
        return utils.roots(this.points, theLine).filter((t) =>
        {
            var p = this.get(t);
            return utils.between(p.x, mx, MX) && utils.between(p.y, my, MY);
        });
    }

    selfintersects(curveIntersectionThreshold)
    {
        // "simple" curves cannot intersect with their direct
        // neighbour, so for each segment X we check whether
        // it intersects [0:x-2][x+2:last].

        const reduced = this.reduce(),
            len = reduced.length - 2,
            results = [];

        for (let i = 0, result, left, right; i < len; i++)
        {
            left = reduced.slice(i, i + 1);
            right = reduced.slice(i + 2);
            result = this.curveintersects(left, right, curveIntersectionThreshold);
            results.push(...result);
        }
        return results;
    }

    curveintersects(c1, c2, curveIntersectionThreshold)
    {
        const pairs = [];
        let that = this;
        // step 1: pair off any overlapping segments
        c1.forEach(function (l)
        {
            if (that.debug) console.log('l tol', l, curveIntersectionThreshold);
            l.debug = that.debug;
            c2.forEach(function (r)
            {
                if (l.overlaps(r, curveIntersectionThreshold))
                {
                    pairs.push({ left: l, right: r });
                }
            });
        });
        if (this.debug) console.log('pairs', pairs);
        // step 2: for each pairing, run through the convergence algorithm.
        let intersections = [];
        pairs.forEach(function (pair)
        {
            const result = utils.pairiteration(
                pair.left,
                pair.right,
                curveIntersectionThreshold
            );
            if (result.length > 0)
            {
                intersections = intersections.concat(result);
            }
        });
        //if(intersections.length != 0)console.log("Intersections found! ", intersections);
        return intersections;
    }

    arcs(errorThreshold)
    {
        errorThreshold = errorThreshold || 0.5;
        return this._iterate(errorThreshold, []);
    }

    reverse()
    {
        let p = this.points;
        if (this.order == 3) this.points = [{ x: p[3].x, y: p[3].y, t: 0 }, p[2], p[1], { x: p[0].x, y: p[0].y, t: 1 }];
        if (this.order == 2) this.points = [{ x: p[2].x, y: p[2].y, t: 0 }, p[1], { x: p[0].x, y: p[0].y, t: 1 }];
        if (this.order == 1) this.points = [{ x: p[1].x, y: p[1].y, t: 0 }, { x: p[0].x, y: p[0].y, t: 1 }];
        this.update();
        return this;
    }

    _error(pc, np1, s, e)
    {
        const q = (e - s) / 4,
            c1 = this.get(s + q),
            c2 = this.get(e - q),
            ref = utils.dist(pc, np1),
            d1 = utils.dist(pc, c1),
            d2 = utils.dist(pc, c2);
        return abs(d1 - ref) + abs(d2 - ref);
    }

    _iterate(errorThreshold, circles)
    {
        let t_s = 0,
            t_e = 1,
            safety;
        // we do a binary search to find the "good `t` closest to no-longer-good"
        do
        {
            safety = 0;

            // step 1: start with the maximum possible arc
            t_e = 1;

            // points:
            let np1 = this.get(t_s),
                np2,
                np3,
                arc,
                prev_arc;

            // booleans:
            let curr_good = false,
                prev_good = false,
                done;

            // numbers:
            let t_m = t_e,
                prev_e = 1,
                step = 0;

            // step 2: find the best possible arc
            do
            {
                prev_good = curr_good;
                prev_arc = arc;
                t_m = (t_s + t_e) / 2;
                step++;

                np2 = this.get(t_m);
                np3 = this.get(t_e);

                arc = utils.getccenter(np1, np2, np3);

                //also save the t values
                arc.interval = {
                    start: t_s,
                    end: t_e,
                };

                let error = this._error(arc, np1, t_s, t_e);
                curr_good = error <= errorThreshold;

                done = prev_good && !curr_good;
                if (!done) prev_e = t_e;

                // this arc is fine: we can move 'e' up to see if we can find a wider arc
                if (curr_good)
                {
                    // if e is already at max, then we're done for this arc.
                    if (t_e >= 1)
                    {
                        // make sure we cap at t=1
                        arc.interval.end = prev_e = 1;
                        prev_arc = arc;
                        // if we capped the arc segment to t=1 we also need to make sure that
                        // the arc's end angle is correct with respect to the bezier end point.
                        if (t_e > 1)
                        {
                            let d = {
                                x: arc.x + arc.r * cos(arc.e),
                                y: arc.y + arc.r * sin(arc.e),
                            };
                            arc.e += utils.angle({ x: arc.x, y: arc.y }, d, this.get(1));
                        }
                        break;
                    }
                    // if not, move it up by half the iteration distance
                    t_e = t_e + (t_e - t_s) / 2;
                } else
                {
                    // this is a bad arc: we need to move 'e' down to find a good arc
                    t_e = t_m;
                }
            } while (!done && safety++ < 100);

            if (safety >= 100)
            {
                break;
            }

            // console.log("L835: [F] arc found", t_s, prev_e, prev_arc.x, prev_arc.y, prev_arc.s, prev_arc.e);

            prev_arc = prev_arc ? prev_arc : arc;
            circles.push(prev_arc);
            t_s = prev_e;
        } while (t_e < 1);
        return circles;
    }
}
export { Bezier };
export default Bezier;
export { PolyBezier } from './poly-bezier.js';
export { PolyBeziers } from './poly-beziers.js';
export { utils } from './utils.js';
export { Affine } from './affine.js';
//return Bezier;
//})();
//export { Bezier };
