import { Bezier } from './bezier.js';
export class Segment
{
    constructor(type, points)
    {
        this.type = type; // "line", "quadratic", or "cubic"
        this.points = points; // Array of control points
        this.bezier = this.type === "cubic" ? new Bezier(points) : null; // Bezier instance for cubic curves
    }

    getEndpoints()
    {
        return this.type === "line"
            ? [this.points[0], this.points[1]]
            : [this.points[0], this.points[this.points.length - 1]];
    }

    findIntersection(otherSegment)
    {
        if (this.type === "line" && otherSegment.type === "line")
        {
            return this._findLineIntersection(otherSegment);
        } else if (this.type === "cubic" || otherSegment.type === "cubic")
        {
            return this._findBezierIntersection(otherSegment);
        }
        return null; // Extend for other segment types if needed
    }

    calculateTangent(t)
    {
        if (this.type === "line")
        {
            const [p1, p2] = this.getEndpoints();
            return { x: p2.x - p1.x, y: p2.y - p1.y };
        } else if (this.type === "cubic" && this.bezier)
        {
            const derivative = this.bezier.derivative(t);
            return { x: derivative.x, y: derivative.y };
        }
        return null;
    }

    _findBezierIntersection(otherSegment)
    {
        if (this.bezier && otherSegment.bezier)
        {
            const intersections = this.bezier.intersects(otherSegment.bezier);
            return intersections.map(t => this.bezier.get(t)); // Map t-values to points
        }
        return null;
    }

    _findLineIntersection(otherSegment)
    {
        const [p1, p2] = this.getEndpoints();
        const [q1, q2] = otherSegment.getEndpoints();
        const denominator = (p2.x - p1.x) * (q2.y - q1.y) - (p2.y - p1.y) * (q2.x - q1.x);
        if (Math.abs(denominator) < 1e-6) return null; // Parallel lines

        const ua = ((q2.x - q1.x) * (p1.y - q1.y) - (q2.y - q1.y) * (p1.x - q1.x)) / denominator;
        const ub = ((p2.x - p1.x) * (p1.y - q1.y) - (p2.y - p1.y) * (p1.x - q1.x)) / denominator;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1)
        {
            return {
                x: p1.x + ua * (p2.x - p1.x),
                y: p1.y + ua * (p2.y - p1.y),
            };
        }

        return null;
    }
}
