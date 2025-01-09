//const PolyBeziers = (function(){
/**
 * Poly Beziers
 * @param {[type]} PolyBeziers [description]
 *
 * This class allows us to define arbitrary shapes. The PolyBezier class defines
 * a single shape.  There is an implied move and an assumed series of connected
 * beziers making a single shape.  The PolyBezier shape may be closed if the starting
 * point and the ending point are the same. It may also be an open shape. The
 * PolyBeziers class allows combined shapes, for example an 'O'.  The rule is that CW
 * shapes add and CCW shapes subtract.  So the 'O' would have a CW outer circle and a
 * CCW inner circle. It is expected that all PolyBezier shapes in a PolyBeziers object
 * are closed.
 *
 * NOTE: self intersecting shapes are not allowed. They should be broken at the
 * intersections and turned into two or more shapes. Each shape can be CW or CCW to
 * clearly define it.
 */
export class PolyBeziers
{
	constructor(polys)
	{
		this.polys = [];
		if (!!polys) {
			if(polys.constructor.name == 'PolyBeziers')
			{
				//console.log('Cloning a PolyBeziers', polys);
				for(let iIdx = 0; iIdx < polys.polys.length; iIdx++){
					this.polys.push(new PolyBezier(polys.polys[iIdx]));
				}
			}else
			{
				//this.polys = polys;			
				for(let iIdx = 0; iIdx < polys.length; iIdx++){
					this.polys.push(new PolyBezier(polys[iIdx]));
				}
			}
		}
	}
	
	offset(d, jtype)
	{
		let offsetPolys = [];
		for(let iIdx = 0; iIdx < this.polys.length; iIdx++)
		{
			let thisOff = this.polys[iIdx].offset(d, jtype);
			// console.log('thisOff', thisOff);
			offsetPolys.push(...thisOff);
		}
		// console.log('offsetPolys', offsetPolys);
		return new PolyBeziers(offsetPolys);
	}

	bbox() {
		const c = this.polys;
		var bbox = c[0].bbox();
		for (var i = 1; i < c.length; i++) {
			utils.expandbox(bbox, c[i].bbox());
		}
		return bbox;
	}
}
//return PolyBeziers;
//})();
