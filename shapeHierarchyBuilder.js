/*
* Trying to come up witha meaningful name for this file. The purpose is to create a tree that represents how a collection
* poits and curves are organized.  I am writing this as a classs in the hgBezier folder, because it is a concept related to
* Bezier curves.  The concept is to find which shapes and points are inside of other shapes.  This is a concept that is
* used in the pltGerber library to determine which shapes are inside of other shapes.  This is important because we have kits
* that are collections of decals.  At a given level the decals are indpendent of each other.  At that level each shape and all
* shapes and text inside of it make up a decal.  The decal is a collection of shapes and text.  This will allow us to organize
* our kits by decal.
*
* The tree is a collection of nodes.  Each node has a parent and children.  The parent is the node that contains the current
* node.  The children are the nodes that are contained in the current node.  The root node is the node that contains all
* other nodes.  The root node is the top level node.  The way way we will build the tree is to start with an empty root node.
* We will then add nodes by starting with the root node and walking down the branches of the tree.  We will walk down any branch
* that contains the new shape.  We will add the node at the point where we either have a branch that is inside of the new shape or
* we reach a leaf node.  A leaf node is a node that has no children.  The leaf node is the node that contains the new shape.
* For example, the first shape we add will be the first child of the root node.  The second shape we add will be either a child
* of the root node or a child of the first shape.  If the second shape is inside of the first shape, then it will be a child of
* the first shape.  If the second shape is not inside of the first shape, then it will be a child of the root node.  The third
* shape we add will be either a child of the root node, a child of the first shape, or a child of the second shape.  We will continue
* this process until we have added all of the shapes.
*
* Now a little discussion about the shapes and points. First let us dicuss the shapes.  We will be comparing the shapes in pairs
* to determine if one shape is inside of another shape.  We will be using the Bezier curve to determine if one shape is inside
* of another shape.  However we have four possible outcomes when we compare two shapes.  The first outcome is that the two shapes
* are completely separate.  The second outcome is that the first shape is completely inside of the the second shape.  The third
* outcome is that the second shape is completely inside of the first shape.  The fourth outcome is that the two shapes overlap.
* The first outcome is the easiest to determine.  We will determine this by comparing the bounding boxes of the two shapes.  If
* the bounding boxes do not overlap, then the two shapes are completely separate.  If the bounding boxes overlap at all, we will
* look for intersections of the Bezier curves.  If we find an intersection, then the two shapes overlap.  If we do not find an
* intersection, then we will look for a shape that is completely inside of the other shape.  We will do this by choosing a point
* from one of the curves and determining if it is inside of the other curve.  If the point is inside of the other curve, then the
* first curve is inside of the second curve.  If the point is not inside of the other curve, we can assume that the other curve
* is inside of the first curve.  At this point we will have determined that one curve is inside of the other curve.  The tricky case
* is when the two curves overlap.  The rule we will use is that they will be siblings.  This means that they will be children of the
* same parent.  In theory we could have cases where the siblings could share children. We are not going to look for this case.  We
* let the children end up at the first place they fit.  Part of the reason for this is that in our use case we will not have shapes
* that overlap.  We will have shapes that are completely inside of other shapes.  We will have shapes that are completely separate
* from each other.
*
* Now let us discuss the points.  The reason for points is that they will represent text. The assumption is that the text will be
* inside of a shape.  The text will be a child of the shape that it is inside of.  The text will be a leaf node.  The text will have
* no children.  The text will have a parent.  The text can have a sibling.  The sibling can be other text or shapes. Our tests will
* done with the insertion point of the text.  The insertion point will be a point.  The point will be compared to the Bezier curves
* of the shapes.  The bezier libray has a function that will determine if a point is inside of a curve.  We will use this function
* to determine if the point is inside of the curve.
*
* Now a little discussion about the tree and the nodes. First of all, the core of the tree are the shapes ans points. The first
* element of a node is the shape or point.  The second element of a node is the parent.  The third element of a node is the children.
* The children are an array of nodes.  The children are the nodes that are inside of the current node.  The final element of the node
* is the object that is related to the shape or point.  In our use case, the object will be a plt block.  The plt block is the object
* that we are ultimately organizing.
*/
import { Bezier } from './bezier.js';

export class bzNode
{
    constructor(shape, parent, children, object)
    {
        this.shape = shape;
        this.parent = parent;
        this.children = children;
        this.object = object;
    }
}

export class bzTree
{
    constructor()
    {
        this.root = new bzNode(null, null, [], null);
    }

    /*
    * Here we will add a node to a tree.  First we need to test if the shape is a point or a curve.  If the shape is a point, then
    * it can't surround any other shapes.  If the shape is a curve, then it can surround other shapes.  We will start with the root
    * node and walk down the branches of the tree.  We will walk down any branch that contains the new shape.  We will add the node
    * at the point where we either have a branch that is inside of the new shape or we reach a leaf node.  A leaf node is a node that
    * has no children.  The leaf node is the node that contains the new shape.  For example, the first shape we add will be the first
    * child of the root node.  The second shape we add will be either a child of the root node or a child of the first shape.  If the
    * second shape is inside of the first shape, then it will be a child of the first shape.  If the second shape is not inside of the
    * first shape, then it will be a child of the root node.  The third shape we add will be either a child of the root node, a child
    * of the first shape, or a child of the second shape.  We will continue this process until we have added all of the shapes.
    * 
    * Note: The branches of the tree are the children of the nodes.  The children are the nodes that are inside of the current node.
    * The first implementation of this function did not increment an index and work the children array.
    * 
    * @param {shape} shape - The shape that we are adding to the tree. Closed shape or point.
    * @param {object} object - The object that is related to the shape.  In our use case, the object will be a plt block.
    * @param {number} tol - The tolerance that we will use to determine if one shape is inside of another shape.  The tolerance
    * will be used to determine if a point is inside of a curve.  Tolerance is a parameter because plt files are in 1000 units
    * per inch. So a 0.01 inch tolerance is 10 units.
    */
    addNode(shape, object, tol = 0.01)
    {
        let currentNode = this.root;
        let newNode = new bzNode(shape, currentNode, [], object);

        // Determine if the shape is a point or a curve
        const isPoint = shape.constructor.name !== "PolyBezier";
        if (isPoint)
        {
            newNode.children = null; // Points cannot have children
            // I am thinking that we should just traverse the tree and follow the branches until we find a node with no branches
            // for us to follow.  We will add the new node to the node with no branches.
            // New node is a point. There are only two possibilities: either it is inside a branch or it is not.
            for(let i = 0; i < currentNode.children.length; i++)
            {
                let branch = currentNode.children[i];
                if (branch.children === null)
                {
                    // Branch is a point, by definition it cannot contain the new point
                    continue;
                }
                let relation = branch.shape.shapeRelation(shape, tol);
                if (relation.inside)
                {
                    // New shape is inside this branch, update currentNode and restart loop
                    //Note we know that the branch is not a point and has a children array (it could be empty)
                    currentNode = branch;
                    i = -1; // Restart loop with new currentNode
                    continue;
                }
            }
            // No suitable branch found, add newNode to currentNode's children
            currentNode.children.push(newNode);
            return;
        }

        //Implied else. NewNode is a curve. We can use it for our shapeRelation function.
        // We will walk down the branches of the tree.  We will walk down any branch that contains the new shape.
        //If we find a branch that is inside of the new shape, we will add the branch to the new shape and remove it from the
        //current node. We will continue to loop to find any other branches that are inside of the new shape. By definition
        //we can't have a branch that is inside of another branch.  We will only have a branch that is inside of the new shape.
 
        for (let i = 0; i < currentNode.children.length; i++)
        {
            let branch = currentNode.children[i];

            //Since newNode is a curve, we can use it for our shapeRelation function.No need to check if branch is a point.
            //The shapeRelation function will handle points. shape and newNode.shape are the same object. 
            let relation = newNode.shape.shapeRelation(branch.shape, tol);

            if (relation.surround)
            {
                //branch surrounds new node, take the branch
                currentNode = branch;
                i = -1;
                continue;
            }

            if (relation.inside)
            {
                // Branch is inside new node, add branch to new node and remove it from current node
                newNode.children.push(branch);
                branch.parent = newNode;
                currentNode.children.splice(i, 1);
                i--; // Adjust index after removal
            }
        }
        //We have walked down the branches of the tree.  We have walked down any branch that contains the new shape.
        //We have reached a node with no branches or that we have taken over one or more branches.  We will add the new node to the
        //current node.
        currentNode.children.push(newNode);
    }
}
