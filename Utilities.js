function calculateDistance(p1, p2)
{
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function angleBetween(v1, v2)
{
    const dot = v1.x * v2.x + v1.y * v2.y;
    const det = v1.x * v2.y - v1.y * v2.x;
    return Math.atan2(det, dot);
}

function validateAndFixCrossings(path1, path2, intersections)
{
    const crossingPairs = [];
    const unmatchedCrossings = [];

    intersections.forEach(intersection =>
    {
        if (intersection.isCrossing())
        {
            crossingPairs.push(intersection);
        }
    });

    if (crossingPairs.length % 2 !== 0)
    {
        console.warn("Odd number of crossings detected. Attempting to fix...");
    }

    const correctedPairs = pairCrossings(crossingPairs, path1, path2);

    if (correctedPairs.invalidPairs.length > 0)
    {
        console.warn("Mismatched pairs found. Adjusting...");
        fixTangents(correctedPairs.invalidPairs, path1, path2);
    }

    return correctedPairs.validPairs;
}

function pairCrossings(crossings, path1, path2)
{
    const validPairs = [];
    const invalidPairs = [];
    const visited = new Set();

    crossings.forEach((crossing, idx) =>
    {
        if (visited.has(idx)) return;

        let matched = false;

        for (let j = idx + 1; j < crossings.length; j++)
        {
            if (visited.has(j)) continue;

            if (canPairCrossings(crossing, crossings[j], path1, path2))
            {
                validPairs.push([crossing, crossings[j]]);
                visited.add(idx);
                visited.add(j);
                matched = true;
                break;
            }
        }

        if (!matched)
        {
            invalidPairs.push(crossing);
        }
    });

    return { validPairs, invalidPairs };
}
