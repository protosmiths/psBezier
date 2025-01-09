export class Intersection
{
    constructor(start, end, path1, path2, startTangents, endTangents)
    {
        this.start = start;
        this.end = end;
        this.path1 = path1;
        this.path2 = path2;
        this.startTangents = startTangents; // { path1: tangent1, path2: tangent2 }
        this.endTangents = endTangents;     // { path1: tangent1, path2: tangent2 }
        this.isCoincidental = this._isCoincidental();
        this.entries = {};
        this.exits = {};
        this.assignEntriesAndExits();
    }

    _isCoincidental()
    {
        const epsilon = 1e-6; // Tolerance for floating-point precision
        return Math.abs(this.start.x - this.end.x) < epsilon && Math.abs(this.start.y - this.end.y) < epsilon;
    }

    assignEntriesAndExits()
    {
        this.entries.start = this.startTangents;
        this.entries.end = this.endTangents;

        this.exits.start = {
            path1: this.startTangents.path2,
            path2: this.startTangents.path1,
        };

        this.exits.end = {
            path1: this.endTangents.path2,
            path2: this.endTangents.path1,
        };
    }

    getClosestExit(entryPath, pointType = "start")
    {
        const entryTangent = this.entries[pointType][entryPath];
        const exits = this.exits[pointType];
        return Object.entries(exits).reduce((closest, [path, tangent]) =>
        {
            const angle = this._calculateRelativeTangent(entryTangent, tangent);
            return angle < closest.angle ? { path, angle } : closest;
        }, { path: null, angle: Infinity }).path;
    }

    _calculateRelativeTangent(tangent1, tangent2)
    {
        const dot = tangent1.x * tangent2.x + tangent1.y * tangent2.y;
        const det = tangent1.x * tangent2.y - tangent1.y * tangent2.x;
        return Math.atan2(det, dot);
    }

    isCrossing()
    {
        return !this.isCoincidental;
    }
}
