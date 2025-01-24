/**
  A javascript Bezier curve library by Pomax.

  Based on http://pomax.github.io/bezierinfo

  This code is MIT licensed.
**/
import { Affine } from "./affine.js";
//import { Bezier } from "./bezier.js";
//const utils = (function(){
// math-inlining.
const { abs, cos, sin, acos, atan2, sqrt, pow } = Math;

// cube root function yielding real roots
function crt(v) {
  return v < 0 ? -pow(-v, 1 / 3) : pow(v, 1 / 3);
}

var intersections = [];

// trig constants
const pi = Math.PI,
  tau = 2 * pi,
  quart = pi / 2,
  // float precision significant decimal
  epsilon = 0.000001,
  // extremas used in bbox calculation and similar algorithms
  nMax = Number.MAX_SAFE_INTEGER || 9007199254740991,
  nMin = Number.MIN_SAFE_INTEGER || -9007199254740991,
  circleFactor = 0.551915,
  // a zero coordinate, which is surprisingly useful
  ZERO = { x: 0, y: 0, z: 0 };

// Bezier utility functions
export const utils = {
  // Legendre-Gauss abscissae with n=24 (x_i values, defined at i=n as the roots of the nth order Legendre polynomial Pn(x))
  Tvalues: [
    -0.0640568928626056260850430826247450385909,
    0.0640568928626056260850430826247450385909,
    -0.1911188674736163091586398207570696318404,
    0.1911188674736163091586398207570696318404,
    -0.3150426796961633743867932913198102407864,
    0.3150426796961633743867932913198102407864,
    -0.4337935076260451384870842319133497124524,
    0.4337935076260451384870842319133497124524,
    -0.5454214713888395356583756172183723700107,
    0.5454214713888395356583756172183723700107,
    -0.6480936519369755692524957869107476266696,
    0.6480936519369755692524957869107476266696,
    -0.7401241915785543642438281030999784255232,
    0.7401241915785543642438281030999784255232,
    -0.8200019859739029219539498726697452080761,
    0.8200019859739029219539498726697452080761,
    -0.8864155270044010342131543419821967550873,
    0.8864155270044010342131543419821967550873,
    -0.9382745520027327585236490017087214496548,
    0.9382745520027327585236490017087214496548,
    -0.9747285559713094981983919930081690617411,
    0.9747285559713094981983919930081690617411,
    -0.9951872199970213601799974097007368118745,
    0.9951872199970213601799974097007368118745,
  ],

  // Legendre-Gauss weights with n=24 (w_i values, defined by a function linked to in the Bezier primer article)
  Cvalues: [
    0.1279381953467521569740561652246953718517,
    0.1279381953467521569740561652246953718517,
    0.1258374563468282961213753825111836887264,
    0.1258374563468282961213753825111836887264,
    0.121670472927803391204463153476262425607,
    0.121670472927803391204463153476262425607,
    0.1155056680537256013533444839067835598622,
    0.1155056680537256013533444839067835598622,
    0.1074442701159656347825773424466062227946,
    0.1074442701159656347825773424466062227946,
    0.0976186521041138882698806644642471544279,
    0.0976186521041138882698806644642471544279,
    0.086190161531953275917185202983742667185,
    0.086190161531953275917185202983742667185,
    0.0733464814110803057340336152531165181193,
    0.0733464814110803057340336152531165181193,
    0.0592985849154367807463677585001085845412,
    0.0592985849154367807463677585001085845412,
    0.0442774388174198061686027482113382288593,
    0.0442774388174198061686027482113382288593,
    0.0285313886289336631813078159518782864491,
    0.0285313886289336631813078159518782864491,
    0.0123412297999871995468056670700372915759,
    0.0123412297999871995468056670700372915759,
  ],

  arcfn: function (t, derivativeFn) {
    const d = derivativeFn(t);
    let l = d.x * d.x + d.y * d.y;
    if (typeof d.z !== "undefined") {
      l += d.z * d.z;
    }
    return sqrt(l);
  },

  compute: function (t, points, _3d) {
	if(_3d == 'undefined')_3d = false;
    // shortcuts
    if (t === 0) {
      points[0].t = 0;
      return points[0];
    }

    const order = points.length - 1;

    if (t === 1) {
      points[order].t = 1;
      return points[order];
    }

    const mt = 1 - t;
    let p = points;

    // constant?
    if (order === 0) {
      points[0].t = t;
      return points[0];
    }

    // linear?
    if (order === 1) {
      const ret = {
        x: mt * p[0].x + t * p[1].x,
        y: mt * p[0].y + t * p[1].y,
        t: t,
      };
      if (_3d) {
        ret.z = mt * p[0].z + t * p[1].z;
      }
      return ret;
    }

    // quadratic/cubic curve?
    if (order < 4) {
      let mt2 = mt * mt,
        t2 = t * t,
        a,
        b,
        c,
        d = 0;
      if (order === 2) {
        p = [p[0], p[1], p[2], ZERO];
        a = mt2;
        b = mt * t * 2;
        c = t2;
      } else if (order === 3) {
        a = mt2 * mt;
        b = mt2 * t * 3;
        c = mt * t2 * 3;
        d = t * t2;
      }
      const ret = {
        x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
        y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
        t: t,
      };
      if (_3d) {
        ret.z = a * p[0].z + b * p[1].z + c * p[2].z + d * p[3].z;
      }
      return ret;
    }

    // higher order curves: use de Casteljau's computation
    const dCpts = JSON.parse(JSON.stringify(points));
    while (dCpts.length > 1) {
      for (let i = 0; i < dCpts.length - 1; i++) {
        dCpts[i] = {
          x: dCpts[i].x + (dCpts[i + 1].x - dCpts[i].x) * t,
          y: dCpts[i].y + (dCpts[i + 1].y - dCpts[i].y) * t,
        };
        if (typeof dCpts[i].z !== "undefined") {
          dCpts[i] = dCpts[i].z + (dCpts[i + 1].z - dCpts[i].z) * t;
        }
      }
      dCpts.splice(dCpts.length - 1, 1);
    }
    dCpts[0].t = t;
    return dCpts[0];
  },

  computeWithRatios: function (t, points, ratios, _3d) {
    const mt = 1 - t,
      r = ratios,
      p = points;

    let f1 = r[0],
      f2 = r[1],
      f3 = r[2],
      f4 = r[3],
      d;

    // spec for linear
    f1 *= mt;
    f2 *= t;

    if (p.length === 2) {
      d = f1 + f2;
      return {
        x: (f1 * p[0].x + f2 * p[1].x) / d,
        y: (f1 * p[0].y + f2 * p[1].y) / d,
        z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z) / d,
        t: t,
      };
    }

    // upgrade to quadratic
    f1 *= mt;
    f2 *= 2 * mt;
    f3 *= t * t;

    if (p.length === 3) {
      d = f1 + f2 + f3;
      return {
        x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x) / d,
        y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y) / d,
        z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z) / d,
        t: t,
      };
    }

    // upgrade to cubic
    f1 *= mt;
    f2 *= 1.5 * mt;
    f3 *= 3 * mt;
    f4 *= t * t * t;

    if (p.length === 4) {
      d = f1 + f2 + f3 + f4;
      return {
        x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x + f4 * p[3].x) / d,
        y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y + f4 * p[3].y) / d,
        z: !_3d
          ? false
          : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z + f4 * p[3].z) / d,
        t: t,
      };
    }
  },

  derive: function (points, _3d) {
    const dpoints = [];
    for (let p = points, d = p.length, c = d - 1; d > 1; d--, c--) {
      const list = [];
      for (let j = 0, dpt; j < c; j++) {
        dpt = {
          x: c * (p[j + 1].x - p[j].x),
          y: c * (p[j + 1].y - p[j].y),
        };
        if (_3d) {
          dpt.z = c * (p[j + 1].z - p[j].z);
        }
        list.push(dpt);
      }
      dpoints.push(list);
      p = list;
    }
    return dpoints;
  },

  between: function (v, m, M) {
    return (
      (m <= v && v <= M) ||
      utils.approximately(v, m) ||
      utils.approximately(v, M)
    );
  },

  approximately: function (a, b, precision) {
    return abs(a - b) <= (precision || epsilon);
  },

  length: function (derivativeFn) {
    const z = 0.5,
      len = utils.Tvalues.length;

    let sum = 0;

    for (let i = 0, t; i < len; i++) {
      t = z * utils.Tvalues[i] + z;
      sum += utils.Cvalues[i] * utils.arcfn(t, derivativeFn);
    }
    return z * sum;
  },

  map: function (v, ds, de, ts, te) {
    const d1 = de - ds,
      d2 = te - ts,
      v2 = v - ds,
      r = v2 / d1;
    return ts + d2 * r;
  },

	lerp: function (r, v1, v2)
	{
        //console.log("lerp r, v1, v2", r, v1, v2);
    const ret = {
      x: v1.x + r * (v2.x - v1.x),
      y: v1.y + r * (v2.y - v1.y),
    };
    if (!!v1.z && !!v2.z) {
      ret.z = v1.z + r * (v2.z - v1.z);
	  }
      //console.log("lerp ret", ret);
    return ret;
  },

  pointToString: function (p) {
    let s = p.x + "/" + p.y;
    if (typeof p.z !== "undefined") {
      s += "/" + p.z;
    }
    return s;
  },

  pointsToString: function (points) {
    return "[" + points.map(utils.pointToString).join(", ") + "]";
  },

	
	//This returns the magnitude of the z vector. 
	//Positive is coming toward you. Negative away.
	//Uses the endpoints of the bezier
	crossProdBezier: function(c1, c2){
		let x1 = c1.points[c1.points.length - 1].x - c1.points[0].x;
		let y1 = c1.points[c1.points.length - 1].y - c1.points[0].y;
		let x2 = c2.points[c2.points.length - 1].x - c2.points[0].x;
		let y2 = c2.points[c2.points.length - 1].y - c2.points[0].y;
		
		return (x1 * y2) - (x2 * y1);
	},
	
	//This returns the magnitude of the z vector. 
	//Positive is coming toward you. Negative away.
	//Magnitude is sin of angle between vectors
	crossProdLine: function(l1, l2){
		let x1 = l1.p2.x - l1.p1.x;
		let y1 = l1.p2.y - l1.p1.y;
		let x2 = l2.p2.x - l2.p1.x;
		let y2 = l2.p2.y - l2.p1.y;
		
		return (x1 * y2) - (x2 * y1);
	},
	
	unitCrossProd: function(u1, u2){
		return (u1.x * u2.y) - (u2.x * u1.y);
	},
	
	unitDotProd: function(u1, u2){
		return (u1.x * u2.x) + (u1.y * u2.y);
	},
	
	//Abbreviated affine transforms. There are the top 2 rows of 3x3 matrices
	//The 3rd row is assumed to be 0,0,1
	affineAppend: function(at1, ata){
		//Add implied rows
		at1.push([0,0,1]);
		ata.push([0,0,1]);
		//console.log("affineAppend at1, ata", at1, ata);
		let newAT = [];
		for(let iRow = 0; iRow < 3; iRow++){
			let newRow = [];
			for(let iCol = 0; iCol < 3; iCol++){
				let newItem = 0;
				for(let iIdx = 0; iIdx < 3; iIdx++){
					newItem += at1[iRow][iIdx] * ata[iIdx][iCol];
				}
				//If there were an iIdxToken = 2 we would have
				//newItem += at1[iRow][2] * ata[2][iCol];
				//But ata[2][iCol] would be 0 for iCol < 2
				//ata[2][2] = 1, but it is part of the implied row
				newRow.push(newItem);
			}
			//console.log("affineAppend newRow", newRow);
			newAT.push(newRow);
		}
		//console.log("affineAppend newAT", newAT);
		newAT.pop();
		return newAT;
	},
	
	getIdentityATx: function(){
		return [[1,0,0],[0,1,0]];  //Identity matrix
	},
	
	getTranslateATx: function(vec){
		return [[1,0,vec.x],[0,1,vec.y]];
	},
	
	getScaleATx: function(vec){
		return [[vec.x,0,0],[0,vec.y,0]];
	},

	//https://en.wikipedia.org/wiki/Rotation_matrix
	//Rotation matrix -> cos, -sin, sin, cos -> x:x cos - y sin, y:x sin + y cos
	//Rotation around origin
	getRotateATx: function(ang){
		let ATsin = Math.sin(ang);
		let ATcos  = Math.cos(ang);
		return [[ATcos,-ATsin,0],[ATsin,ATcos,0]];
	},
	
	//Get the rotation matrix to rotate from quad 1 to the given quadrant
	//quad 1 => 0, quad 2 => 1, quad 3 => 2, quad 4 => 3
	//let qrot = [[[1,0,0],[0,1,0]],[[0,-1,0],[1,0,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[-1,0,0]]];
	getQuadRotATx: function(qn){
		switch(qn){
			case 1:
			return [[0,-1,0],[1,0,0]];
			case 2:
			return [[-1,0,0],[0,-1,0]];
			case 3:	
			return [[0,1,0],[-1,0,0]];			
		}
		return utils.getIdentityATx();  //Identity matrix
	},
	//Note this is an abbreviated affine transform.  We are not doing perspectives, so the final row
	//is omitted and understood to be 0,0,1.  The 3rd column is the translation column
	transformPoint: function(pt, ATx){
		//Make a copy so that when one calculates pt.y it isn't affected by calculated pt.x or visa versa
		let orgPt = {x:pt.x, y:pt.y};
		//console.log("transformPoint pt, ATx", pt, ATx);
		//Do transform in place
		//abbreviated affine has 2 rows of 3 element
		pt.x = orgPt.x*ATx[0][0] + orgPt.y*ATx[0][1] + ATx[0][2];
		pt.y = orgPt.x*ATx[1][0] + orgPt.y*ATx[1][1] + ATx[1][2];
		//console.log("transformPoint pt", pt);
//		return {x:pt.x*ATx[0][0] + pt.y * ATx[0][1] + ATx[0][2], y:pt.x*ATx[1][0] + pt.y*ATx[1][1] + ATx[1][2]};
	},
	
	//As discussed above, this is an abbreviated affine transform
	transformCurve: function(points, ATx){
		//console.log("transformCurve points, ATx", points, ATx);
		for(iIdx = 0; iIdx < points.length; iIdx++){
			//Point is transformed in place points[iIdxToken] has new values
			utils.transformPoint(points[iIdx], ATx);
		}
		// return [
			// utils.transformPoint(points[0], ATx), 
			// utils.transformPoint(points[1], ATx), 
			// utils.transformPoint(points[2], ATx), 
			// utils.transformPoint(points[3], ATx)
		// ];
		
	},
	
	transformCurves: function(curves, ATx){
		for(let iIdx = 0; iIdx < curves.length; iIdx++){
			//Curve is transformed in place points in curves[iIdxToken] have new values
			utils.transformCurve(curves[iIdx], ATx);
		}
	},
  
  //We need a function to create arcs.  There are a number pf ways to do this.
  //We will often have to place arc given center, starting point and ending point
  //We use those parameters here
  arc: function(center, start, end, cw){
	  //cw = !cw;
	  let radius = utils.dist(center, start);
	  let rad_end = utils.dist(center, end);
	  //console.log("arc center start end cw radius",center, start, end, cw, radius);
	  if(abs((radius - rad_end)/radius) > 0.01){
		  console.log("arc has radii differ by more than 1%", radius, rad_end);
		  return null;
	  }
	  let unit_start = {x:(start.x - center.x)/radius, y:(start.y - center.y)/radius};
	  let unit_end = {x:(end.x - center.x)/rad_end, y:(end.y - center.y)/rad_end};
	  //Now to create the vectors
	  //Find the angle
	  //console.log(end);
	  let dp = utils.unitDotProd(unit_start, unit_end);
	  //console.log("arc unit_start, unit_end, dot product",unit_start, unit_end, dp);
	  let quad = 0;
	  //Get a normal in the direction of rotation
	  let sn = cw?{x:unit_start.y,y:-unit_start.x}:{x:-unit_start.y,y:unit_start.x};
	  let dpn = utils.unitDotProd(sn, unit_end);
	  //Calculate how many 90 deg segments there are
	  //let cosang = dp;
	  let ang = Math.acos(Math.abs(dp));
	  let t = (2*ang)/Math.PI;
	  while(1){
		  if(dp == 1){
			  //The end points are the same, do a circle
			  quad = 4;
			  break;
		  }
		  
		  //Now there are 4 possible results
		  //The angle is 270 to +90
		  if(dp > 0){
			  if(dpn >= 0){
				  //It goes in the selected direction (0-90)
				  quad = 0;
				  break;
			  }
			  //Goes the opposite direction (270 - 360)
			  //cosang = 1-dp;
			  t=1-t; //A trick to get the complementary angle
			  quad = 3;
			  break;
		  }
		  // Greater than 90 (90 - 270)
		  if(dpn >= 0){
			  //It goes in the selected direction  (90 - 180)
			  t=1-t; //A trick to get the complementary angle
			  quad = 1;
			  break;
		  }
		  //Goes the opposite direction (180 - 270)
		  quad = 2;
		  break;  //Must break to exit while
	  }
	  //console.log("arc sn dp dpn quad", sn, dp, dpn, quad);
	  arc = [];
	  //Started by constructing arc taking direction into account.  Then realized that
	  //One could construct as if ccw and then do a mirror across x axis for cw
	  //let q1 = [{x:1, y:0}, {x:1, y:0.551915}, {x:0.551915, y:1}, {x:0, y:1}];
	  //Below are transforms to rotate the q1 arc into q1,q2,q3,q4
	  //let qrot = [[[1,0,0],[0,1,0]],[[0,-1,0],[1,0,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[-1,0,0]]];
	  for(let iQdx = 0; iQdx < quad; iQdx++){
		  //let tqdx = cw?3-iQdx:iQdx;
		  //90 degree segment of unit circle in quadrant 1
		  let newQ = [{x: 1.0, y: 0}, {x: 1.0, y: 0.551915}, {x: 0.551915, y: 1.0}, {x: 0, y: 1.0}];
		  //let newQ = [{x: 1.0, y: 0}];
		  //console.log("arc newQ", newQ);
		  //Rotate to proper quadrant
		  utils.transformCurve(newQ, utils.getQuadRotATx(iQdx));
		  arc.push(newQ);
	  }
	  //console.log("arc arc after quad fill", arc);
	  //Now the final piece
	  if(Math.abs(dp) != 1){
		// start with 90 degree segment in quadrant 1
		let lastCurve = new Bezier([{x:1, y:0}, {x:1, y:0.551915}, {x:0.551915, y:1}, {x:0, y:1}]);
		//let cosang = (dp>0)?dp:Math.abs(dp);
		//let cosang = Math.abs(dp);
		//Find the angle
		//t goes from 0 to 1 as angle goes from 0 to PI/2. The segment is split at t = ang/(pi/2)
		lastCurve = lastCurve.split(0, t);
		//The rest of the curves are defined by points
		lastCurve = lastCurve.points;
		if(quad != 0){
			//The curve is in the next quadrant after the filled ones
			utils.transformCurve(lastCurve, utils.getQuadRotATx(quad));
		}
		arc.push(lastCurve);
		//console.log("arc lastCurve", lastCurve, ang, (2*ang)/Math.PI, utils.getQuadRotATx(quad));
	  }
	  let arcCopy = [];
	  arc.forEach(function(seg){
		  let segCopy = [];
		  seg.forEach(function(pt){
			  segCopy.push({x:pt.x, y:pt.y});
		  });
		  arcCopy.push(segCopy);
	  });
	  //console.log("arc arc before transform", arcCopy);
	  //Now arc has been constructed on the unit circle centered at 0,0
	  //We need to rotate it to align with endpoints, scale to size and translate into position
	  //Start of arc is at 1,0 and is constructed as if it goes ccw. If it is cw it needs to be
	  //mirrored around the x axis. Next it needs to rotate point (1,0) to the start point 
	  //(direction does not matter).  Then the arc needs to be scaled to the required radius
	  //finally it needs to be translated to the proper center
	  //This steps are appended to the matrix in reverse order
	  let finalAT = utils.getIdentityATx();
	  //console.log("arc finalATx", finalAT);
	  finalAT = utils.affineAppend(finalAT, utils.getTranslateATx(center));
//	  console.log("arc finalATx translate", finalAT, center);
	  finalAT = utils.affineAppend(finalAT, utils.getScaleATx({x:radius, y:radius}));
	  //console.log("arc finalATx scale", finalAT, radius);
	  //The rotation of the arc from 1,0 to the start point based on unit vector
	  //x component is cos, y component sin
	  let rotAt = [[unit_start.x,-unit_start.y,0],[unit_start.y,unit_start.x,0]];
	  finalAT = utils.affineAppend(finalAT, rotAt);
//	  console.log("arc finalATx rot", finalAT);
	  if(cw)finalAT = utils.affineAppend(finalAT, utils.getScaleATx({x:1, y:-1})); //mirror on x axis
	  utils.transformCurves(arc, finalAT);
	  //utils.transformCurves(arcCopy, finalAT);
	  //let retObj = [];
	  for(let iIdx = 0; iIdx < arc.length; iIdx++){
		  //retObj.push(new Bezier(arc[iIdxToken]));
		  arc[iIdx] = new Bezier(arc[iIdx]);
	  }
	  //return retObj;
	  return arc;
  },
  
  //This function allows one to find the intersection of two lines.  It uses the algoirithm
  //from wikipedia
  //https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line
  //It also returns the denominator, t and u allowing them to be used for further testing
  //in the calling routine
  line2lineIntersection: function(line1, line2){
    //((x1-x2)(y3-y4) - (y1-y2)(x3-x4))
	let denom = ((line1.p1.x - line1.p2.x)*(line2.p1.y - line2.p2.y)) - 
	             ((line1.p1.y - line1.p2.y)*(line2.p1.x - line2.p2.x));
    //((x1-x3)(y3-y4) - (y1-y3)(x3-x4))
	let tnum  = ((line1.p1.x - line2.p1.x)*(line2.p1.y - line2.p2.y)) - 
	             ((line1.p1.y - line2.p1.y)*(line2.p1.x - line2.p2.x));
    //((x2-x1)(y1-y3) - (y2-y1)(x1-x3))
	let unum  = ((line1.p2.x - line1.p1.x)*(line1.p1.y - line2.p1.y)) -
                 ((line1.p2.y - line1.p1.y)*(line1.p1.x - line2.p1.x));
	let pi = null; //Indicate parallel line
	if(abs(denom) > 0.01){
		//Lines are not parallel
		if(tnum < unum){
			pi = {x: line1.p1.x + (tnum * (line1.p2.x - line1.p1.x))/denom,
			      y: line1.p1.y + (tnum * (line1.p2.y - line1.p1.y))/denom};
		}else{
			pi = {x: line2.p1.x + (unum * (line2.p2.x - line2.p1.x))/denom,
			      y: line2.p1.y + (unum * (line2.p2.y - line2.p1.y))/denom};
		}
	}
	return {pi: pi, tnum: tnum, unum: unum, denom: denom};
  },
  
  line_unit_normal: function(line) {
	const d = {x:line.p2.x - line.p1.x, y:line.p2.y - line.p1.y};
	const q = sqrt(d.x * d.x + d.y * d.y);
	//console.log("normal() d :", d, " q :", q, "this :", this);
	return { x: -d.y / q, y: d.x / q };
  },
  
  //This creates a unit line (vector) starting at the first point on a line
  //It goes in the direction of the line
  line_unit: function(line) {
	const d = {x:line.p2.x - line.p1.x, y:line.p2.y - line.p1.y};
	const q = sqrt(d.x * d.x + d.y * d.y);
	//console.log("normal() d :", d, " q :", q, "this :", this);
	return {p1:line.p1, p2:{ x: line.p1.x + d.x / q, y: line.p1.y + d.y / q }};
  },
  
  //This creates a unit line (vector) starting at the first point on a line
  //It goes in the direction of the line
  line_unit_unit: function(line) {
	const d = {x:line.p2.x - line.p1.x, y:line.p2.y - line.p1.y};
	const q = sqrt(d.x * d.x + d.y * d.y);
	//console.log("normal() d :", d, " q :", q, "this :", this);
	return { x: d.x / q, y: d.y / q };
  },

  
  //This function is used when creating an offset. It "fixes" the connections
  //between offset curves.  There are three possible ways two offset curves come
  //together. They could meet at the same point if the original segments have control points
  //that are on a line with the endpoints. That is the angle between the control lines is
  //180 degrees.  If the angle relative to the offset is greater than 180 the endpoints will
  //be separated and must be joined by a new curve or curves.  If the angle is less than 180
  //the lines should intersect. It is possible that they are beyond the intersection point.
  //In that case, the search for an intersection needs to move to adjacent segments.
  //Parameters
  // arr   -> array of curves to be joined
  // idx   -> index of curve in array to connect to previous curve in array
  // jtype -> type of join
  // d     -> radius of join if type is RADIUS_JOIN
  join: function(arr, idx, jtype, d, cw, cp){
	//cw = (d >= 0)?cw:!cw;
	cw = !cw;
	//console.log("join cw", cw, d);
	d = Math.abs(d);
	let prevIdx = (idx == 0)?arr.length - 1:idx - 1;
	let c1 = arr[prevIdx];
	let c2 = arr[idx];

	let c1ep = c1.points[c1.points.length - 1];
	let c2ep = c2.points[0];
	//console.log("join() endpoints :", c1ep, c2ep);
	//Are the endpoints really close
	if(utils.dist(c1ep, c2ep) < (d/10)){
		//Just join these curves.
		console.log("join close points", utils.dist(c1ep, c2ep), d/10, c1ep, c2ep);
		let newCorrection = {dx:(c2ep.x - c1ep.x)/2, dy:(c2ep.y - c1ep.y)/2};
		c1.points[c1.points.length - 1].x += newCorrection.dx;
		c1.points[c1.points.length - 2].x += newCorrection.dx;
		c1.points[c1.points.length - 1].y += newCorrection.dy;
		c1.points[c1.points.length - 2].x += newCorrection.dy;
		c1.update();
		c2.points[0].x -= newCorrection.dx;
		c2.points[1].x -= newCorrection.dx;
		c2.points[0].y -= newCorrection.dy;
		c2.points[1].x -= newCorrection.dy;
		c2.update();
		//cp.push({x:c2.points[0].x, y:c2.points[0].y});
		return idx + 1;
	}
	
	// Now we handle when the curves intersect
	let intersect = c1.intersects(c2, Math.abs(d/100));
	if(intersect.length != 0){
		let t = intersect[0].split("/").map(v => parseFloat(v));
		let newc1 = c1.split(0, t[0]);
		let newc2 = c2.split(t[1], 1);
		arr.splice(prevIdx, 1, newc1);
		arr.splice(idx, 1, newc2);
		return idx + 1;
	}
	
	//This allows us to make a pass where we just
	if(jtype == PolyBezier.NO_JOIN)return idx + 1;
	
	//Now we will do a join.  There are three types.  The MITER_JOIN is the simplest
	//and is just a straight line between the two points.  We will save that joint
	//type for last because the other two types can have cases where they need a MITER_JOIN
	//to handle exceptional cases.
	
	//For the corner 
	//		//
		// The next possibility for an intersection is converging lines.  This will be the case
		// when following offsets and offsetting a curve that has an obtuse angle.  In the
		//general case the convergence point could be
	
	//A trick to allow break to drop us into the MITER_JOIN.  If we are finished a return takes
	//us out of the routine.
	while((jtype == PolyBezier.CORNER_JOIN) || (jtype == PolyBezier.RADIUS_JOIN)){
		//The CORNER_JOIN and the RADIUS_JOIN both have some common processing.  They both
		//need to take into account where the intersection of the tangents to the endpoints
		//occur. There are three possibilities for intersections, converging, diverging and parallel.
		let c1cp = c1.points[c1.points.length - 2];
		let c2cp = c2.points[1];
		//console.log("join() ctrl points :", c1cp, c2cp);
		
		let line1 = {p1: c1ep, p2: c1cp};
		let line2 = {p1: c2ep, p2: c2cp};
		
		let pi = utils.line2lineIntersection(line1, line2);
		//console.log("join() ctrl lines :", line1, line2, pi.pi);
		
		if(jtype == PolyBezier.CORNER_JOIN){
			if(pi == null)break; //parallel lines, do a MITER_JOIN
			
			if((pi.tnum < 0) || (pi.unum < 0))break; //diverging lines, do a MITER_JOIN
			
			//We have converging lines, things are a little tricky.  We want a limit on the
			//distance. we will limit to 5 * d
			if((utils.dist(c1ep, pi.pi) <= 5*d) && (utils.dist(c2ep, pi.pi) <= 5*d)){
				//We are within the limits
				line1 = utils.makeline(c1ep, pi.pi);
				line2 = utils.makeline(pi.pi, c2ep);
				line1.joint = true;
				line2.joint = true;
				arr.splice(idx, 0, line1, line2);
				return idx + 3;
			}
			break; //Do miter join
		}
		
		//Implied else we are (jtype == PolyBezier.RADIUS_JOIN)
		//If the joining follows an offset operation, the endpoints should be aligned
		//perfectly for an arc segment.  But we will write the algorithm so that there
		//could be a straight line segment to allow an arc of the given radius
		//The center of the arc will be relative to the intersection of the tangent lines
		//at the endpoints.
		//
		//For parallel lines, If they are 2*d apart we connect them with a 180 degree
		//arc with radius of d and a straight line if needed. If not, we have a few choices.
		//We will choose to use a 180 degree arc of radius 1/2 the distance between the curves
		//and a straight line if needed if the radius is smaller than some factor of d.
		//5 * d seems too great.  How about 2 * d?
		//
		//For diverging lines we will make similar adjustments.
		//
		//For converging lines most cases will be fine.  It is possible that the lines must extend
		//to a point for an arc of radius d.  We should have the 5 * d limit.  If we hit that limit
		//we should do a MITER_JOIN
		//
		// The center of the arcs will be at the intersection of lines parallel to curves
		// at the radius distance.  This should be d. The length of these parallel lines will be
		// the length of the extensions
		
		let l1n = utils.line_unit_normal(line1);
		let l2n = utils.line_unit_normal(line2);
		if(pi == null){
			//We have parallel lines
			let nline1 = {p1:c1ep, p2:{x:c1ep.x - l1n.x, y:c1ep.y - l1n.y}};
			let paraI = utils.line2lineIntersection(nline1, line_unit(line2));
			
			//Note since the normal is a unit vector, tnum gives the distance
			if((abs(para1.tnum) + abs(para.unum)) > 5 * d)break; //radius to connect parallel lines is too great do MITER_JOIN
			
			//We have gone through the guantlet.  We can connect the parallel lines.
			break;
			
		}
		// We have converging or diverging lines
		let off1d = {p1:{x:line1.p1.x + d*l1n.x, y:line1.p1.y + d*l1n.y}, p2:{x:line1.p2.x + d*l1n.x, y:line1.p2.y + d*l1n.y}};
		let off2d = {p1:{x:line2.p1.x - d*l2n.x, y:line2.p1.y - d*l2n.y}, p2:{x:line2.p2.x - d*l2n.x, y:line2.p2.y - d*l2n.y}};
		let acenter = utils.line2lineIntersection(off1d, off2d);
		//console.log("join() ctrl offset lines :", off1d, off2d, acenter.pi);
		let newArc = utils.arc(acenter.pi, c1ep, c2ep, cw);
		if(newArc == null){
			cp.push(acenter.pi);
			break;
		}
		newArc.forEach(function(seg){
			seg.joint=true;
		});
		arr.splice(idx, 0, ...newArc);
		return idx + 1 + newArc.length;
		//return
		break; //We must have a break or return to exit the while
	}

	//If we get here we either have a MITER_JOIN or we need to finish another join type
	let newSeg1 = utils.makeline(c1ep, c2ep);
	newSeg1.joint = true;
	arr.splice(idx, 0, newSeg1);
	return idx + 2;

  },

  copy: function (obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  angle: function (o, v1, v2) {
    const dx1 = v1.x - o.x,
      dy1 = v1.y - o.y,
      dx2 = v2.x - o.x,
      dy2 = v2.y - o.y,
      cross = dx1 * dy2 - dy1 * dx2,
      dot = dx1 * dx2 + dy1 * dy2;
    return atan2(cross, dot);
  },

  // round as string, to avoid rounding errors
  round: function (v, d) {
    const s = "" + v;
    const pos = s.indexOf(".");
    return parseFloat(s.substring(0, pos + 1 + d));
  },

  dist: function (p1, p2) {
    const dx = p1.x - p2.x,
      dy = p1.y - p2.y;
    return sqrt(dx * dx + dy * dy);
  },

  closest: function (LUT, point) {
    let mdist = pow(2, 63),
      mpos,
      d;
    LUT.forEach(function (p, idx) {
      d = utils.dist(point, p);
      if (d < mdist) {
        mdist = d;
        mpos = idx;
      }
    });
    return { mdist: mdist, mpos: mpos };
  },

  abcratio: function (t, n) {
    // see ratio(t) note on http://pomax.github.io/bezierinfo/#abc
    if (n !== 2 && n !== 3) {
      return false;
    }
    if (typeof t === "undefined") {
      t = 0.5;
    } else if (t === 0 || t === 1) {
      return t;
    }
    const bottom = pow(t, n) + pow(1 - t, n),
      top = bottom - 1;
    return abs(top / bottom);
  },

  projectionratio: function (t, n) {
    // see u(t) note on http://pomax.github.io/bezierinfo/#abc
    if (n !== 2 && n !== 3) {
      return false;
    }
    if (typeof t === "undefined") {
      t = 0.5;
    } else if (t === 0 || t === 1) {
      return t;
    }
    const top = pow(1 - t, n),
      bottom = pow(t, n) + top;
    return top / bottom;
  },

  lli8: function (x1, y1, x2, y2, x3, y3, x4, y4) {
    const nx =
        (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
      ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
      d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (d == 0) {
      return false;
    }
    return { x: nx / d, y: ny / d };
  },

  lli4: function (p1, p2, p3, p4) {
    const x1 = p1.x,
      y1 = p1.y,
      x2 = p2.x,
      y2 = p2.y,
      x3 = p3.x,
      y3 = p3.y,
      x4 = p4.x,
      y4 = p4.y;
    return utils.lli8(x1, y1, x2, y2, x3, y3, x4, y4);
  },

  lli: function (v1, v2) {
    return utils.lli4(v1, v1.c, v2, v2.c);
  },

  makeline: function (p1, p2) {
    const x1 = p1.x,
      y1 = p1.y,
      x2 = p2.x,
      y2 = p2.y,
      dx = (x2 - x1) / 3,
      dy = (y2 - y1) / 3;
    return new Bezier(
      x1,
      y1,
      x1 + dx,
      y1 + dy,
      x1 + 2 * dx,
      y1 + 2 * dy,
      x2,
      y2
    );
  },

  findbbox: function (sections) {
    let mx = nMax,
      my = nMax,
      MX = nMin,
      MY = nMin;
    sections.forEach(function (s) {
      const bbox = s.bbox();
      if (mx > bbox.x.min) mx = bbox.x.min;
      if (my > bbox.y.min) my = bbox.y.min;
      if (MX < bbox.x.max) MX = bbox.x.max;
      if (MY < bbox.y.max) MY = bbox.y.max;
    });
    return {
      x: { min: mx, mid: (mx + MX) / 2, max: MX, size: MX - mx },
      y: { min: my, mid: (my + MY) / 2, max: MY, size: MY - my },
    };
  },

  shapeintersections: function (
    s1,
    bbox1,
    s2,
    bbox2,
    curveIntersectionThreshold
  ) {
    if (!utils.bboxoverlap(bbox1, bbox2)) return [];
    const intersections = [];
    const a1 = [s1.startcap, s1.forward, s1.back, s1.endcap];
    const a2 = [s2.startcap, s2.forward, s2.back, s2.endcap];
    a1.forEach(function (l1) {
      if (l1.virtual) return;
      a2.forEach(function (l2) {
        if (l2.virtual) return;
        const iss = l1.intersects(l2, curveIntersectionThreshold);
        if (iss.length > 0) {
          iss.c1 = l1;
          iss.c2 = l2;
          iss.s1 = s1;
          iss.s2 = s2;
          intersections.push(iss);
        }
      });
    });
    return intersections;
  },

  makeshape: function (forward, back, curveIntersectionThreshold) {
    const bpl = back.points.length;
    const fpl = forward.points.length;
    const start = utils.makeline(back.points[bpl - 1], forward.points[0]);
    const end = utils.makeline(forward.points[fpl - 1], back.points[0]);
    const shape = {
      startcap: start,
      forward: forward,
      back: back,
      endcap: end,
      bbox: utils.findbbox([start, forward, back, end]),
    };
    shape.intersections = function (s2) {
      return utils.shapeintersections(
        shape,
        shape.bbox,
        s2,
        s2.bbox,
        curveIntersectionThreshold
      );
    };
    return shape;
  },

  getminmax: function (curve, d, list) {
    if (!list) return { min: 0, max: 0 };
    let min = nMax,
      max = nMin,
      t,
      c;
    if (list.indexOf(0) === -1) {
      list = [0].concat(list);
    }
    if (list.indexOf(1) === -1) {
      list.push(1);
    }
    for (let i = 0, len = list.length; i < len; i++) {
      t = list[i];
      c = curve.get(t);
      if (c[d] < min) {
        min = c[d];
      }
      if (c[d] > max) {
        max = c[d];
      }
    }
    return { min: min, mid: (min + max) / 2, max: max, size: max - min };
  },

  // Allows one to look for points on a line by rotating the points (and the line) to the x axis
  align: function (points, line) {
    const tx = line.p1.x,
      ty = line.p1.y,
	  //Neg angle in radians relative to x axis
      a = -atan2(line.p2.y - ty, line.p2.x - tx),
	  //Rotate by angle a around the origin
      d = function (v) {
        return {
          x: (v.x - tx) * cos(a) - (v.y - ty) * sin(a),
          y: (v.x - tx) * sin(a) + (v.y - ty) * cos(a),
        };
      };
    return points.map(d);
  },

	roots: function (points, line)
	{
		//console.log("roots points", points, line);
		line = line || { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };

		const order = points.length - 1;
		const aligned = utils.align(points, line);
		const reduce = function (t) {
			return 0 <= t && t <= 1;
		};

		if (order == 1)
		{
			const p = aligned[0].y,
				q = aligned[1].y,
				r = p - q;
			if (r !== 0)
			{
				return [p / r].filter(reduce);
			}
			return [];
		}

		if (order === 2) {
			const a = aligned[0].y,
			b = aligned[1].y,
			c = aligned[2].y,
			d = a - 2 * b + c;
			if (d !== 0) {
				const m1 = -sqrt(b * b - a * c),
				m2 = -a + b,
				v1 = -(m1 + m2) / d,
				v2 = -(-m1 + m2) / d;
				return [v1, v2].filter(reduce);
			} else if (b !== c && d === 0) {
				return [(2 * b - c) / (2 * b - 2 * c)].filter(reduce);
			}
			return [];
		}

		// see http://www.trans4mind.com/personal_development/mathematics/polynomials/cubicAlgebra.htm
		const pa = aligned[0].y,
		pb = aligned[1].y,
		pc = aligned[2].y,
		pd = aligned[3].y;

		let d = -pa + 3 * pb - 3 * pc + pd,
		a = 3 * pa - 6 * pb + 3 * pc,
		b = -3 * pa + 3 * pb,
		c = pa;

		if (utils.approximately(d, 0)) {
			// this is not a cubic curve.
			if (utils.approximately(a, 0)) {
			// in fact, this is not a quadratic curve either.
			if (utils.approximately(b, 0)) {
				// in fact in fact, there are no solutions.
				return [];
			}
			// linear solution:
			return [-c / b].filter(reduce);
		}
		// quadratic solution:
		const q = sqrt(b * b - 4 * a * c),
		a2 = 2 * a;
		return [(q - b) / a2, (-b - q) / a2].filter(reduce);
    }

    // at this point, we know we need a cubic solution:

    a /= d;
    b /= d;
    c /= d;

    const p = (3 * b - a * a) / 3,
      p3 = p / 3,
      q = (2 * a * a * a - 9 * a * b + 27 * c) / 27,
      q2 = q / 2,
      discriminant = q2 * q2 + p3 * p3 * p3;

    let u1, v1, x1, x2, x3;
    if (discriminant < 0) {
      const mp3 = -p / 3,
        mp33 = mp3 * mp3 * mp3,
        r = sqrt(mp33),
        t = -q / (2 * r),
        cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
        phi = acos(cosphi),
        crtr = crt(r),
        t1 = 2 * crtr;
      x1 = t1 * cos(phi / 3) - a / 3;
      x2 = t1 * cos((phi + tau) / 3) - a / 3;
      x3 = t1 * cos((phi + 2 * tau) / 3) - a / 3;
      return [x1, x2, x3].filter(reduce);
    } else if (discriminant === 0) {
      u1 = q2 < 0 ? crt(-q2) : -crt(q2);
      x1 = 2 * u1 - a / 3;
      x2 = -u1 - a / 3;
      return [x1, x2].filter(reduce);
    } else {
      const sd = sqrt(discriminant);
      u1 = crt(-q2 + sd);
      v1 = crt(q2 + sd);
      return [u1 - v1 - a / 3].filter(reduce);
    }
  },

  droots: function (p) {
    // quadratic roots are easy
    if (p.length === 3) {
      const a = p[0],
        b = p[1],
        c = p[2],
        d = a - 2 * b + c;
      if (d !== 0) {
        const m1 = -sqrt(b * b - a * c),
          m2 = -a + b,
          v1 = -(m1 + m2) / d,
          v2 = -(-m1 + m2) / d;
        return [v1, v2];
      } else if (b !== c && d === 0) {
        return [(2 * b - c) / (2 * (b - c))];
      }
      return [];
    }

    // linear roots are even easier
    if (p.length === 2) {
      const a = p[0],
        b = p[1];
      if (a !== b) {
        return [a / (a - b)];
      }
      return [];
    }

    return [];
  },

  curvature: function (t, d1, d2, _3d, kOnly) {
    let num,
      dnm,
      adk,
      dk,
      k = 0,
      r = 0;

    //
    // We're using the following formula for curvature:
    //
    //              x'y" - y'x"
    //   k(t) = ------------------
    //           (x'² + y'²)^(3/2)
    //
    // from https://en.wikipedia.org/wiki/Radius_of_curvature#Definition
    //
    // With it corresponding 3D counterpart:
    //
    //          sqrt( (y'z" - y"z')² + (z'x" - z"x')² + (x'y" - x"y')²)
    //   k(t) = -------------------------------------------------------
    //                     (x'² + y'² + z'²)^(3/2)
    //

    const d = utils.compute(t, d1);
    const dd = utils.compute(t, d2);
    const qdsum = d.x * d.x + d.y * d.y;

    if (_3d) {
      num = sqrt(
        pow(d.y * dd.z - dd.y * d.z, 2) +
          pow(d.z * dd.x - dd.z * d.x, 2) +
          pow(d.x * dd.y - dd.x * d.y, 2)
      );
      dnm = pow(qdsum + d.z * d.z, 3 / 2);
    } else {
      num = d.x * dd.y - d.y * dd.x;
      dnm = pow(qdsum, 3 / 2);
    }

    if (num === 0 || dnm === 0) {
      return { k: 0, r: 0 };
    }

    k = num / dnm;
    r = dnm / num;

    // We're also computing the derivative of kappa, because
    // there is value in knowing the rate of change for the
    // curvature along the curve. And we're just going to
    // ballpark it based on an epsilon.
    if (!kOnly) {
      // compute k'(t) based on the interval before, and after it,
      // to at least try to not introduce forward/backward pass bias.
      const pk = utils.curvature(t - 0.001, d1, d2, _3d, true).k;
      const nk = utils.curvature(t + 0.001, d1, d2, _3d, true).k;
      dk = (nk - k + (k - pk)) / 2;
      adk = (abs(nk - k) + abs(k - pk)) / 2;
    }

    return { k: k, r: r, dk: dk, adk: adk };
  },

  inflections: function (points) {
    if (points.length < 4) return [];

    // FIXME: TODO: add in inflection abstraction for quartic+ curves?

    const p = utils.align(points, { p1: points[0], p2: points.slice(-1)[0] }),
      a = p[2].x * p[1].y,
      b = p[3].x * p[1].y,
      c = p[1].x * p[2].y,
      d = p[3].x * p[2].y,
      v1 = 18 * (-3 * a + 2 * b + 3 * c - d),
      v2 = 18 * (3 * a - b - 3 * c),
      v3 = 18 * (c - a);

    if (utils.approximately(v1, 0)) {
      if (!utils.approximately(v2, 0)) {
        let t = -v3 / v2;
        if (0 <= t && t <= 1) return [t];
      }
      return [];
    }

    const trm = v2 * v2 - 4 * v1 * v3,
      sq = Math.sqrt(trm),
      d2 = 2 * v1;

    if (utils.approximately(d2, 0)) return [];

    return [(sq - v2) / d2, -(v2 + sq) / d2].filter(function (r) {
      return 0 <= r && r <= 1;
    });
  },

  bboxoverlap: function (b1, b2) {
    const dims = ["x", "y"],
      len = dims.length;
	//let ol = 0; 
    for (let i = 0, dim, l, t, d; i < len; i++) {
      dim = dims[i];
      l = b1[dim].mid;
      t = b2[dim].mid;
      d = (b1[dim].size + b2[dim].size) / 2;
	  //console.log(dim, l, t, d);
	  //console.log('l - t', l-t, 'd', d);
      if ((abs(l - t) > d) && (abs(l - t) != 0)) return false;
	  //if((d - abs(l - t)) > ol)ol = d - abs(l - t);
    }
	//console.log("overlap ;", ol);
	//console.log('true overlap');
    return true;
  },

  expandbox: function (bbox, _bbox) {
    if (_bbox.x.min < bbox.x.min) {
      bbox.x.min = _bbox.x.min;
    }
    if (_bbox.y.min < bbox.y.min) {
      bbox.y.min = _bbox.y.min;
    }
    if (_bbox.z && _bbox.z.min < bbox.z.min) {
      bbox.z.min = _bbox.z.min;
    }
    if (_bbox.x.max > bbox.x.max) {
      bbox.x.max = _bbox.x.max;
    }
    if (_bbox.y.max > bbox.y.max) {
      bbox.y.max = _bbox.y.max;
    }
    if (_bbox.z && _bbox.z.max > bbox.z.max) {
      bbox.z.max = _bbox.z.max;
    }
    bbox.x.mid = (bbox.x.min + bbox.x.max) / 2;
    bbox.y.mid = (bbox.y.min + bbox.y.max) / 2;
    if (bbox.z) {
      bbox.z.mid = (bbox.z.min + bbox.z.max) / 2;
    }
    bbox.x.size = bbox.x.max - bbox.x.min;
    bbox.y.size = bbox.y.max - bbox.y.min;
    if (bbox.z) {
      bbox.z.size = bbox.z.max - bbox.z.min;
    }
  },

  pairiteration: function (c1, c2, curveIntersectionThreshold) {
    const c1b = c1.bbox(),
      c2b = c2.bbox(),
      r = 100000,
      threshold = curveIntersectionThreshold || 0.5;
	//console.log('bboxes', c1b, c2b)
    if (
      c1b.x.size + c1b.y.size <= threshold &&
      c2b.x.size + c2b.y.size <= threshold
    ) {
		//console.log("Intersection found!");
      return [
        (((r * (c1._t1 + c1._t2)) / 2) | 0) / r +
          "/" +
          (((r * (c2._t1 + c2._t2)) / 2) | 0) / r,
      ];
    }
      //console.log("Before split 0.5", c1, c2);
    let cc1 = c1.split(0.5),
      cc2 = c2.split(0.5),
      pairs = [
        { left: cc1.left, right: cc2.left },
        { left: cc1.left, right: cc2.right },
        { left: cc1.right, right: cc2.right },
        { left: cc1.right, right: cc2.left },
      ];
	  //console.log('splits', cc1, cc2);
	  // console.log('splits cc1 left', cc1.left.points[0], cc1.left.points[3]);
	  // console.log('splits cc1 right', cc1.right.points[0], cc1.right.points[3]);
	  // console.log('splits cc2 left', cc2.left.points[0], cc2.left.points[3]);
	  // console.log('splits cc2 right', cc2.right.points[0], cc2.right.points[3]);
	  //console.log('splits cc2', cc2.left.points[3], cc2.right.points[0]);
    pairs = pairs.filter(function (pair) {
      return utils.bboxoverlap(pair.left.bbox(), pair.right.bbox());
    });

    let results = [];

    if (pairs.length === 0) return results;

	  pairs.forEach(function (pair)
	  {
		  //console.log('pair', pair);
      results = results.concat(
        utils.pairiteration(pair.left, pair.right, threshold)
      );
    });

	//console.log("results : ", results);
    results = results.filter(function (v, i) {
      return results.indexOf(v) === i;
    });
	
	//if(results.length != 0)console.log("results : ", results);
	
    return results;
  },

  getccenter: function (p1, p2, p3) {
    const dx1 = p2.x - p1.x,
      dy1 = p2.y - p1.y,
      dx2 = p3.x - p2.x,
      dy2 = p3.y - p2.y,
      dx1p = dx1 * cos(quart) - dy1 * sin(quart),
      dy1p = dx1 * sin(quart) + dy1 * cos(quart),
      dx2p = dx2 * cos(quart) - dy2 * sin(quart),
      dy2p = dx2 * sin(quart) + dy2 * cos(quart),
      // chord midpoints
      mx1 = (p1.x + p2.x) / 2,
      my1 = (p1.y + p2.y) / 2,
      mx2 = (p2.x + p3.x) / 2,
      my2 = (p2.y + p3.y) / 2,
      // midpoint offsets
      mx1n = mx1 + dx1p,
      my1n = my1 + dy1p,
      mx2n = mx2 + dx2p,
      my2n = my2 + dy2p,
      // intersection of these lines:
      arc = utils.lli8(mx1, my1, mx1n, my1n, mx2, my2, mx2n, my2n),
      r = utils.dist(arc, p1);

    // arc start/end values, over mid point:
    let s = atan2(p1.y - arc.y, p1.x - arc.x),
      m = atan2(p2.y - arc.y, p2.x - arc.x),
      e = atan2(p3.y - arc.y, p3.x - arc.x),
      _;

    // determine arc direction (cw/ccw correction)
    if (s < e) {
      // if s<m<e, arc(s, e)
      // if m<s<e, arc(e, s + tau)
      // if s<e<m, arc(e, s + tau)
      if (s > m || m > e) {
        s += tau;
      }
      if (s > e) {
        _ = e;
        e = s;
        s = _;
      }
    } else {
      // if e<m<s, arc(e, s)
      // if m<e<s, arc(s, e + tau)
      // if e<s<m, arc(s, e + tau)
      if (e < m && m < s) {
        _ = e;
        e = s;
        s = _;
      } else {
        e += tau;
      }
    }
    // assign and done.
    arc.s = s;
    arc.e = e;
    arc.r = r;
    return arc;
  },

  numberSort: function (a, b) {
    return a - b;
  },
  
  /*
  * This is a simplified version of the intersectPolys function in the area.js file
  * This routine finds to intersections and tries to make them useful to calling routines
  * This routine returns an array of intersections. Each entry in the array has an object
  * with of the form {t:[], idx:[], xp: , prev:[], next:[]}
  * t, idx, prev, next are two element arrays. The index 0 are info relative to poly1 and
  * index 1 info relative to poly 2.
  * so t[0] is the t for curve in poly1, idx[0] is the index of the curve, prev[0] is the
  * index into the intersection array to the previous intersection on poly1, next[0] is
  * the index into the intersection array to the next intersection on poly1.
  * t[1], idx[1], prev[1] and next[1] is the same info relative to poly2.
  * xp is the cross product of the poly1 curve to the poly2 curve at the intersection.
  * The array is in the order in which the intersections were found. The last element in the
  * intersection array is not an intersection, but are the heads and tails for each linked
  * list. The prev is the indexes for the last intersection (tails) and next the indexes of
  * the first intersection (heads)
  */
  intersections:function(poly1, poly2, tol)
  {
		intersections = [];
		let iCnt = 0;
		for(let iIdx = 0; iIdx < poly1.curves.length; iIdx++)
		{
			let c1 = poly1.curves[iIdx];
			//console.log('c1', c1.points[0].x, c1.points[0].y, c1.points[3].x, c1.points[3].y);
			//console.log('c1', JSON.stringify(c1.points));
			for(let iJdx = 0; iJdx < poly2.curves.length; iJdx++)
			{
				let c2 = poly2.curves[iJdx];
				let xp = utils.crossProdBezier(c1, c2);
				//console.log('c2', c2.points[0].x, c2.points[0].y, c2.points[3].x, c2.points[3].y, xp);
				//console.log('c2',JSON.stringify(c2.points));
				let results = c1.intersects(c2, tol);
				//console.log('results', results);
				for(let iKdx = 0; iKdx < results.length; iKdx ++)
				{
					let t = results[iKdx].split("/").map(v => parseFloat(v));
					intersections.push({t:t, idx:[iIdx, iJdx, iCnt++], xp:xp, prev:[-1,-1],next:[-1,-1]});
				}
			}
		}
		if(intersections.length == 0)return intersections;
		//console.log('intersections', intersections);
		//Now we have all the intersections, we will sort them into order along each path and create linked lists
		// First make shallow copies
		let interPoly1 = intersections.slice();
		let interPoly2 = intersections.slice();
		//Now sort these two into path order
		interPoly1.sort(function(a,b){
			if(a.idx[0] == b.idx[0])
			{
				return a.t[0] - b.t[0];
			}
			return a.idx[0] - b.idx[0];
		});
		interPoly2.sort(function(a,b){
			if(a.idx[1] == b.idx[1])
			{
				return a.t[1] - b.t[1];
			}
			return a.idx[1] - b.idx[1];
		});
		//Now we have two sorted lists, build the linked list
		//console.log('interPoly1', interPoly1);
		//console.log('interPoly2', interPoly2);
		//Index 0 is the header/tail
		let header = {prev:[0,0],next:[0,0]};
		header.next = [interPoly1[0].idx[2], interPoly2[0].idx[2]];
		header.prev = [interPoly1.at(-1).idx[2], interPoly2.at(-1).idx[2]];
		for(let iIdx = 0; iIdx < intersections.length - 1; iIdx++)
		{
			interPoly1[iIdx].next[0] = interPoly1[iIdx + 1].idx[2];
			interPoly2[iIdx].next[1] = interPoly2[iIdx + 1].idx[2];
			interPoly1[iIdx + 1].prev[0] = interPoly1[iIdx].idx[2];
			interPoly2[iIdx + 1].prev[1] = interPoly2[iIdx].idx[2];
		}
		//Close the loops
		interPoly1.at(-1).next[0] = header.next[0];
		interPoly2.at(-1).next[1] = header.next[1];
		interPoly1[0].prev[0] = header.prev[0];
		interPoly2[0].prev[1] = header.prev[1];
		
		//console.log(intersections);
		intersections.push(header);
		return intersections;
  },
  
  getSvgPoint:function(tokens, idx){
	  return { x:parseFloat(tokens[idx]), y:parseFloat(tokens[idx + 1])};
  },

  poly2Svg: function(poly){
	if(poly.curves.length == 0)return "";
	
	let p = poly.curves[0].points;
	let firstP = p[0];
	let arrSVG = ["M", firstP.x, firstP.y];
	let last = 0;
	for(let iIdx = 0; iIdx < poly.curves.length; iIdx++){
		p = poly.curves[iIdx].points;
		last = p.length;
		if(poly.curves[iIdx]._linear)
		{
			arrSVG.push("L");
			arrSVG.push(p[last-1].x);
			arrSVG.push(p[last-1].y);
		}else
		{
			//Even though we have a 
			arrSVG.push(poly.curves[iIdx].order === 2 ? "Q" : "C");
			for (let i = 1; i < last; i++) {
			  arrSVG.push(p[i].x);
			  arrSVG.push(p[i].y);
			}
		}
		if((firstP.x == p[last - 1].x) && (firstP.y == p[last - 1].y)){
			arrSVG.push("Z");
		}
	}
	return arrSVG.join(" ");
  },

	svg2Beziers: function (strSVG)
	{
		//text.match(/\S+/g) split and remove whitespace
		let svgTokens = strSVG.match(/\S+/g);
		let beziers = [];
		let lastPoint = { x: 0, y: 0 };
		let firstPoint = lastPoint;
		let parsePoints = new Array(3);
		let iIdx = 0;
		//	  let cw = 0;
		//console.log("svg2poly svg ", strSVG);
		while (iIdx < svgTokens.length)
		{
			if (svgTokens[iIdx] == 'M')
			{
				lastPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				firstPoint = lastPoint;
				iIdx += 3;
			} else if (svgTokens[iIdx] == 'C')
			{
				//New bezier curve
				parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
				parsePoints[1] = utils.getSvgPoint(svgTokens, iIdx + 3);
				parsePoints[2] = utils.getSvgPoint(svgTokens, iIdx + 5);
				let coords = [
					lastPoint.x, lastPoint.y,
					parsePoints[0].x, parsePoints[0].y,
					parsePoints[1].x, parsePoints[1].y,
					parsePoints[2].x, parsePoints[2].y
				];
				let bzc = new Bezier(coords);
				beziers.push(bzc);
				lastPoint = parsePoints[2];
				//			  cw += (bzc.clockwise)?1:-1;
				iIdx += 7;
			} else if (svgTokens[iIdx] == 'L')
			{
				parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
				let bzl = utils.makeline(lastPoint, parsePoints[0]);
				beziers.push(bzl);
				//			  cw += (bzl.clockwise)?1:-1;
				lastPoint = parsePoints[0];
				iIdx += 3;
			} else if (svgTokens[iIdx] == 'Z')
			{
				if ((firstPoint.x != lastPoint.x) || (firstPoint.y != lastPoint.y))
				{
					beziers.push(utils.makeline(lastPoint, firstPoint));
				}
				iIdx += 1;
			}
		}
		//console.log("svg2poly ", curves);
		if (beziers.length == 0) return null;
		return beziers;
	},

	svg2Poly: function (strSVG)
	{
		//text.match(/\S+/g) split and remove whitespace
		let svgTokens = strSVG.match(/\S+/g);
		let curves = [];
		let lastPoint = { x: 0, y: 0 };
		let firstPoint = lastPoint;
		let parsePoints = new Array(3);
		let iIdx = 0;
		//	  let cw = 0;
		//console.log("svg2poly svg ", strSVG);
		while (iIdx < svgTokens.length)
		{
			if (svgTokens[iIdx] == 'M')
			{
				curves = []; //Only one shape allowed
				lastPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				firstPoint = lastPoint;
				iIdx += 3;
			} else if (svgTokens[iIdx] == 'C')
			{
				//New bezier curve
				parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
				parsePoints[1] = utils.getSvgPoint(svgTokens, iIdx + 3);
				parsePoints[2] = utils.getSvgPoint(svgTokens, iIdx + 5);
				let coords = [
					lastPoint.x, lastPoint.y,
					parsePoints[0].x, parsePoints[0].y,
					parsePoints[1].x, parsePoints[1].y,
					parsePoints[2].x, parsePoints[2].y
				];
				let bzc = new Bezier(coords);
				curves.push(bzc);
				lastPoint = parsePoints[2];
				//			  cw += (bzc.clockwise)?1:-1;
				iIdx += 7;
			} else if (svgTokens[iIdx] == 'L')
			{
				parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
				let bzl = utils.makeline(lastPoint, parsePoints[0]);
				curves.push(bzl);
				//			  cw += (bzl.clockwise)?1:-1;
				lastPoint = parsePoints[0];
				iIdx += 3;
			} else if (svgTokens[iIdx] == 'Z')
			{
				if ((firstPoint.x != lastPoint.x) || (firstPoint.y != lastPoint.y))
				{
					curves.push(utils.makeline(lastPoint, firstPoint));
				}
				iIdx += 1;
			}
		}
		//console.log("svg2poly ", curves);
		if (curves.length == 0) return null;
		let pb = new PolyBezier(curves);
		//	  pb.cw = cw;
		return pb;
	},

  svg2Polys: function(strSVG){
	  //text.match(/\S+/g) split and remove whitespace
	  let svgTokens = strSVG.match(/\S+/g);
	  let curves = [];
	  let polys = [];
	  let lastPoint = {x:0, y:0};
	  let firstPoint = lastPoint;
	  let parsePoints = new Array(3);
	  let iIdx = 0;
//	  let cw = 0;
      //console.log("svg2poly svg ", strSVG);
	  while(iIdx < svgTokens.length){
		  if(svgTokens[iIdx] == 'M'){
			  if(curves.length != 0)
			  {
				  //We have a poly ready
				  polys.push(new PolyBezier(curves));
			  }
			  curves = []; 
			  lastPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
			  firstPoint = lastPoint;
			  iIdx += 3;
		  }else if(svgTokens[iIdx] == 'C'){
			  //New bezier curve
			  parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
			  parsePoints[1] = utils.getSvgPoint(svgTokens, iIdx + 3);
			  parsePoints[2] = utils.getSvgPoint(svgTokens, iIdx + 5);
			  let coords = [
			    lastPoint.x, lastPoint.y, 
			    parsePoints[0].x, parsePoints[0].y,
			    parsePoints[1].x, parsePoints[1].y,
			    parsePoints[2].x, parsePoints[2].y
			  ];
			  let bzc = new Bezier(coords);
			  curves.push(bzc);
			  lastPoint = parsePoints[2];
//			  cw += (bzc.clockwise)?1:-1;
			  iIdx += 7;
		  }else if(svgTokens[iIdx] == 'L'){
			  parsePoints[0] = utils.getSvgPoint(svgTokens, iIdx + 1);
			  let bzl = utils.makeline(lastPoint, parsePoints[0]);
			  curves.push(bzl);
//			  cw += (bzl.clockwise)?1:-1;
			  lastPoint = parsePoints[0];
			  iIdx += 3;
		  }else if(svgTokens[iIdx] == 'Z'){
			  if((firstPoint.x != lastPoint.x) || (firstPoint.y != lastPoint.y)){
				  curves.push(utils.makeline(lastPoint, firstPoint));
			  }
			  iIdx += 1;
		  }
	  }
	  //console.log("svg2poly ", curves);
	  if(curves.length != 0)
	  {
		  polys.push(new PolyBezier(curves));
	  }
	  if(polys.length == 0)return null;
	  return polys;
  },
  
  bboxPolys:function(polys){
	  if(polys.length < 1)return null;
	  
	  let bbox = polys[0].bbox();
	  for(let iIdx = 1; iIdx < polys.length; iIdx++)
	  {
		  let bb = polys[iIdx].bbox();
		  if(bb.x.min < bbox.x.min)bbox.x.min = bb.x.min;
		  if(bb.x.max > bbox.x.max)bbox.x.max = bb.x.max;
		  if(bb.y.min < bbox.y.min)bbox.y.min = bb.y.min;
		  if(bb.y.max > bbox.y.max)bbox.y.max = bb.y.max;
	  }
	  bbox.x.mid = (bbox.x.max + bbox.x.min)/2;
	  bbox.x.size = bbox.x.max - bbox.x.min;
	  bbox.y.mid = (bbox.y.max + bbox.y.min)/2;
	  bbox.y.size = bbox.y.max - bbox.y.min;
	  return bbox;
  },
  
  transformPoly:function(poly, aTx){
	for(let iIdx = 0; iIdx < poly.curves.length; iIdx++)
	{
		let curve = poly.curves[iIdx];
		//console.log(curve);
		for(let iPdx = 0; iPdx < curve.points.length; iPdx++)
		{
			Affine.transformPoint(curve.points[iPdx], aTx);
		}
	}
	  
  },
  svgRect:function(orgW, orgH, width, height)
  {
	let svg = 'M ' + orgW.toString() + ' ' + orgH.toString() + ' ';
	svg += 'L ' + orgW.toString() + ' ' + (orgH + height).toString() + ' ';
	svg += 'L ' + (orgW + width).toString() + ' ' + (orgH + height).toString() + ' ';
	svg += 'L ' + (orgW + width).toString() + ' ' + (orgH).toString() + ' ';
	svg += 'L ' + (orgW).toString() + ' ' + (orgH).toString() + ' ';
	svg += 'Z';
	return svg;
  },
  
	svgTransform:function(svg, atx)
	{
		let svgTxed = [];
		let svgTokens = svg.match(/\S+/g);
		let aPoint = { x: 0, y: 0 };
        //let firstPoint = { x: 0, y: 0 };
		let iIdx = 0;
		while(iIdx < svgTokens.length)
		{
			if(svgTokens[iIdx] == 'M'){
				svgTxed.push('M');
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				//firstPoint = aPoint;
				iIdx += 3;
			}else if(svgTokens[iIdx] == 'Q'){
			  //New bezier curve
				svgTxed.push('Q');
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 3);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				iIdx += 5;
			}else if(svgTokens[iIdx] == 'C'){
			  //New bezier curve
				svgTxed.push('C');
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 3);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 5);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				iIdx += 7;
			}else if(svgTokens[iIdx] == 'L'){
				svgTxed.push('L');
				aPoint = utils.getSvgPoint(svgTokens, iIdx + 1);
				Affine.transformPoint(aPoint, atx);
				svgTxed.push(aPoint.x);
				svgTxed.push(aPoint.y);
				//firstPoint = aPoint;
				iIdx += 3;
			}else if(svgTokens[iIdx] == 'Z'){
				svgTxed.push('Z');
				iIdx += 1;
			}else{
				console.log('unknown token', iIdx, svgTokens[iIdx]);
				return svg;
			}
		}
		return svgTxed.join(' ');
	},

  combineLines:function(poly){
	for(let iIdx = 0; iIdx < poly.curves.length - 1; iIdx++)
	{
		let curve = poly.curves[iIdx];
		if(!curve._linear)continue; //Only lines are checked
		let nextCurve = poly.curves[iIdx + 1];
		if(!nextCurve._linear)continue; //Only lines are checked
		
		//Are they aligned, rotate line to x axis, points are also rotated and are aligned if also on the x axis
		let aligned = utils.align(nextCurve.points, { p1: curve.points[0], p2: curve.points[curve.order] });
		//We are working with two lines and end point of the last line should be the starting point of the next
		//So if the last point of the second is aligned (y is 0)
		if(abs(aligned[nextCurve.order].y) < 0.01)
		{
			//We have a two lines, assume we are not doubling back and join them
			//Actually if we are doubling back, moving the endpoint is one valid interpretation
			console.log('joining', curve.points[curve.order].x, curve.points[curve.order].y, nextCurve.points[nextCurve.order].x, nextCurve.points[nextCurve.order].y);
			curve.points[curve.order].x = nextCurve.points[nextCurve.order].x;
			curve.points[curve.order].y = nextCurve.points[nextCurve.order].y;
			poly.curves.splice(iIdx + 1, 1); //Now remove the 2nd segment
			iIdx--; //Go back and check again, in case the next segment is also in line
		}
	}
  }
};
//return utils;
//})();
