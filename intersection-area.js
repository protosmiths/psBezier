
// files/psBezier/Intersection.js

/**
 * Represents an intersection or overlap between two paths.
 * Tracks relationships between corresponding global t values on both paths
 * and provides information for area operations like union, intersection, and subtraction.
 *
 * We are going to add links to the Intersection class to create a linked list of intersections.
 * Each intersetion will have a reference to the next intersection in the same loop for path 1.
 * And a reference to the corresponding intersection in the other path.
 * 
 * I have a function to populate the links. It is called populateIntersectionLinks. I want to use it for both paths.
 * To do that I need to pass references to the function. I need to change the Intersection class to have a form
 * that will allow me to pass references to the function.
 *
 * We have a special case that could be fairly coomon.  That is two loops that are the same shape.  In this case
 * the intersections will be the same.  We need to be able to handle this case.  We will add a flag to the Intersection
 * class to indicate. This case is detected in the processIntersections function. It needs to be recognized by functions
 * that follow.  A flag in the Intersection class will allow us to do this without extra logic.
 */
class Intersection
{
    /**
     * Initializes an Intersection object.
     * @param {number} path1_start_t - Global t value on Path 1 defining the start of intersection.
     * @param {number} path1_end_t - Global t value on Path 1 defining the end of intersection.
     * @param {number} path2_start_t - Global t value on Path 2 corresponding to Path 1's start.
     * @param {number} path2_end_t - Global t value on Path 2 corresponding to Path 1's end.
     * @param {boolean} same_direction - True if the paths are in the same direction, else False.
     * 
     */
    constructor(
        path1_start_t,
        path1_end_t,
        path2_start_t,
        path2_end_t,
        same_direction
    )
    {
        // These can be passed as references to the populateIntersectionLinks function
        this.path1 = { start_t: path1_start_t, end_t: path1_end_t, entry_t: path1_start_t, exit_t: path1_end_t, next: null, exit_code: 0 };
        this.path2 = { start_t: path2_start_t, end_t: path2_end_t, entry_t: path2_start_t, exit_t: path2_end_t, next: null, exit_code: 0 };
        //These have been added to allow for simpler logic in the area operations
        //When path 2 goes the other direction from path 1 these are flipped
        if (!same_direction)
        {
            this.path2.path_entry_t = path2_end_t;
            this.path2.path_exit_t = path2_start_t;
        }
        this.same_direction = same_direction;
        this.processed = false; // Flag to mark this Intersection as processed
        this.same_loop = false; // Flag to mark this Intersection as part of the same loop
    }

    // Mark this Intersection as processed
    markProcessed()
    {
        this.processed = true;
    }

    // Check if this Intersection has been processed
    isProcessed()
    {
        return this.processed || false;
    }

    /**
     * Determines if this object represents a single point of intersection.
     * @returns {boolean} True if start_t == end_t for both paths, else False.
     */
    isIntersection()
    {
        return (
            this.path1_start_t === this.path1_end_t &&
            this.path2_start_t === this.path2_end_t
        );
    }

    /**
     * Determines if this object represents an overlap segment.
     * @returns {boolean} True if start_t != end_t for both paths, else False.
     */
    isOverlap()
    {
        return (
            this.path1_start_t !== this.path1_end_t &&
            this.path2_start_t !== this.path2_end_t
        );
    }

    /**
     * Maps a global t value on Path 1 to the corresponding t value on Path 2.
     * Assumes a linear relationship between the start and end t values.
     * @param {number} path1_t - The global t value on Path 1 (either start_t or end_t).
     * @returns {number} The corresponding global t value on Path 2.
     */
    getCorrespondingT(path1_t)
    {
        if (path1_t === this.path1_start_t)
        {
            return this.path2_start_t;
        } else if (path1_t === this.path1_end_t)
        {
            return this.path2_end_t;
        } else
        {
            // Linear interpolation for intermediate t values
            const ratio =
                (path1_t - this.path1_start_t) /
                (this.path1_end_t - this.path1_start_t);
            return (
                this.path2_start_t +
                ratio * (this.path2_end_t - this.path2_start_t)
            );
        }
    }

    /**
     * Retrieves the spatial points for the intersection/overlap.
     * @param {Path} path1 - The Path object corresponding to Path 1.
     * @param {Path} path2 - The Path object corresponding to Path 2.
     * @returns {Object} An object containing start and end points for both paths.
     */
    getPoints(path1, path2)
    {
        return {
            path1_start: path1.getPoint(this.path1_start_t),
            path1_end: path1.getPoint(this.path1_end_t),
            path2_start: path2.getPoint(this.path2_start_t),
            path2_end: path2.getPoint(this.path2_end_t),
        };
    }

    /**
     * Sets the index of the next intersection in the same loop.
     * @param {number} next_index - Index of the next Intersection in the sorted array.
     */
    setNext(next_index)
    {
        this.next = next_index;
    }

    /**
     * Sets the cross-index for the corresponding intersection in the other path.
     * @param {number} cross_index - Index of the corresponding Intersection in the other Path's array.
     */
    setCrossIndex(cross_index)
    {
        this.cross_index = cross_index;
    }
}

export { Intersection };
export default Intersection;

//    """
//    def __init__(self, path1_start_t, path1_end_t, path2_start_t, path2_end_t,
//    path1_entry_code, path1_exit_code, path2_entry_code, path2_exit_code):
//"""
//        Initializes an Intersection object.
//        - path1_start_t, path1_end_t: Global t values on Path 1 defining the segment of intersection / overlap.
//        - path2_start_t, path2_end_t: Global t values on Path 2 corresponding to Path 1's start and end points.
//    - path1_entry_code, path1_exit_code: Area entry / exit codes for Path 1.
//        - path2_entry_code, path2_exit_code: Area entry / exit codes for Path 2.
//        """
//self.path1_start_t = path1_start_t
//self.path1_end_t = path1_end_t
//self.path2_start_t = path2_start_t
//self.path2_end_t = path2_end_t
//self.path1_entry_code = path1_entry_code
//self.path1_exit_code = path1_exit_code
//self.path2_entry_code = path2_entry_code
//self.path2_exit_code = path2_exit_code

//        # The index of the next intersection in the same loop
//self.next = None

//        # The cross - index for the corresponding intersection in the other path
//self.cross_index = None

//    def is_intersection(self):
//"""
//        Determines if this object represents a single point of intersection.
//        - Returns True if start_t == end_t for both paths.
//        - Returns False if the object represents an overlap.
//        """
//        pass  # Co - Pilot: Check if start_t == end_t for both paths

//    def is_overlap(self):
//"""
//        Determines if this object represents an overlap segment.
//        - Returns True if start_t != end_t for both paths.
//        """
//        pass  # Co - Pilot: Check if start_t != end_t for both paths

//    def get_corresponding_t(self, path1_t):
//"""
//        Maps a global t value on Path 1 to the corresponding t value on Path 2.
//    - path1_t: The global t value on Path 1(either start_t or end_t).
//        - Returns the corresponding global t value on Path 2.
//"""
//        pass  # Co - Pilot: Map path1_t to its corresponding path2_t

//    def get_points(self, path1, path2):
//"""
//        Retrieves the spatial points for the intersection / overlap.
//        - path1, path2: The Path objects corresponding to Path 1 and Path 2.
//    - Returns a dictionary with start and end points for both paths:
//        {
//            "path1_start": (x, y),
//                "path1_end": (x, y),
//                    "path2_start": (x, y),
//                        "path2_end": (x, y)
//        }
//"""
//        pass  # Co - Pilot: Use path.get_point(global_t) to retrieve spatial points

//    def set_next(self, next_index):
//"""
//        Sets the index of the next intersection in the same loop.
//        - next_index: Index of the next Intersection in the sorted array.
//        """
//        pass  # Co - Pilot: Assign the next property

//    def set_cross_index(self, cross_index):
//"""
//        Sets the cross - index for the corresponding intersection in the other path.
//        - cross_index: Index of the corresponding Intersection in the other Path's array.
//"""
//        pass  # Co - Pilot: Assign the cross_index property
