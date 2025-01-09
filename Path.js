export class Path
{
    constructor(segments)
    {
        this.segments = segments; // Array of Segment objects
    }

    findIntersections(otherPath)
    {
        const intersections = [];
        this.segments.forEach(seg1 =>
        {
            otherPath.segments.forEach(seg2 =>
            {
                const intersection = seg1.findIntersection(seg2);
                if (intersection)
                {
                    intersections.push(intersection);
                }
            });
        });
        return intersections;
    }
}
