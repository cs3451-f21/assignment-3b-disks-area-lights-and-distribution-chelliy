function lessEpsilon(num: number){ 
    return Math.abs(num) < 1e-10; 
} 
function greaterEpsilon(num: number){ 
    return Math.abs(num) > 1e-10; 
} 
  
// classes from the Typescript RayTracer sample
export class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

export class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static lightness(c: Color) { return Math.sqrt(c.r * c.r + c.g * c.g + c.b * c.b); }
    static toDrawingColor(c: Color) {
        var legalize = (d: number) => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

interface light {
    color: Color;
    pos: Vector;
}

interface arealight {
    color: Color;
    pos: Vector;
    u: Vector;
    v: Vector;
}

interface Ray {
    start: Vector;
    dir: Vector;
}

interface Eye {
    u: Vector;
    v: Vector;
    w: Vector;
    pos: Vector;
}

interface sphere {
    pos: Vector;
    radius: number; 
    color: Color; 
    k_ambient: number; 
    k_specular: number; 
    specular_pow: number;
}

interface disk {
    pos: Vector;
    radius: number; 
    color: Color; 
    nor: Vector;
    k_ambient: number; 
    k_specular: number; 
    specular_pow: number;
}

// a suggested interface for jitter samples
interface Sample {
    s: number,
    t: number
}

// A class for our application state and functionality
class RayTracer {
    // the constructor paramater "canv" is automatically created 
    // as a property because the parameter is marked "public" in the 
    // constructor parameter
    // canv: HTMLCanvasElement
    //
    // rendering context for the canvas, also public
    // ctx: CanvasRenderingContext2D

    // initial color we'll use for the canvas
    canvasColor = "lightyellow"

    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D 

    pointlights: light[] = []
    ambientligh: light = {color:Color.white, pos:new Vector(0,0,0)}
    ambient:boolean = false
    backgroundcolor: Color = Color.grey
    fov: number = 90
    eye: Eye = {u:new Vector(0,0,0), v:new Vector(0,0,-1), w:new Vector(0,1,0), pos:new Vector(0,0,0)}
    spheres:sphere[] = []
    disks: disk[] = []
    arealights: arealight[] = []

    // some things that will get specified by user method calls
    enableShadows = true
    jitter = false
    samples = 1

    // user method calls set these, for the optional parts of the assignment
    enableBlur = false
    enableReflections = false
    enableDepth = false

    // if you are doing reflection, set some max depth here
    maxDepth = 5;

    constructor (div: HTMLElement,
        public width: number, public height: number, 
        public screenWidth: number, public screenHeight: number) {

        // let's create a canvas and to draw in
        this.canv = document.createElement("canvas");
        this.ctx = this.canv.getContext("2d")!;
        if (!this.ctx) {
            console.warn("our drawing element does not have a 2d drawing context")
            return
        }
        
        this.pointlights = []
        this.ambientligh = {color:Color.white, pos:new Vector(0,0,0)}
        this.backgroundcolor = Color.grey
        this.ambient = false
        this.fov = 90
        this.eye = {u:new Vector(0,0,0), v:new Vector(0,0,-1), w:new Vector(0,1,0), pos:new Vector(0,0,0)}
        this.spheres = []
        this.disks = []
        this.arealights = []

        div.appendChild(this.canv);

        this.canv.id = "main";
        this.canv.style.width = this.width.toString() + "px";
        this.canv.style.height = this.height.toString() + "px";
        this.canv.width  = this.width;
        this.canv.height = this.height;
    }

    // HINT: SUGGESTED INTERNAL METHOD
    // create an array of samples (size this.samples ^ 2) in the range 0..1, which can
    // be used to create a distriubtion of rays around a single eye ray or light ray.
    // The distribution would use the jitter parameters to create either a regularly spaced or 
    // randomized set of samples.
    private createDistribution(): Sample[] {
        var output:Sample[] = []
        var interval:number = 1/this.samples
        // for (let i = 0; i < this.samples; i++) {
        //     for (let j = 0; j < this.samples; j++) {
        //         if (this.jitter == true) {
        //             var left = -1 + 2*i*interval
        //             var down = -1 + 2*j*interval
        //             var point:Sample = {s:(Math.random()*(2*interval) + left), t:(Math.random()*(2*interval) + down)}
        //         }else{
        //             var s:number = -1 + interval + 2*i*interval
        //             var t:number = -1 + interval + 2*j*interval
        //             var point:Sample = {s:s, t:t}
        //         }
        //         output.push(point)
        //     }
        // }
        for (let i = 0; i < this.samples; i++) {
            for (let j = 0; j < this.samples; j++) {
                if (this.jitter == true) {
                    var point:Sample = {s:(i+Math.random())/this.samples, t:(j+Math.random())/this.samples}
                }else{
                    var point:Sample = {s:(i+.5)/this.samples, t:(j+.5)/this.samples}
                }
                output.push(point)
            }
        }
        return output
    }

    // HINT: SUGGESTED BUT NOT REQUIRED, INTERNAL METHOD
    // like traceRay, but returns on first hit. More efficient than traceRay for detecting if "in shadow"
    private testRay(ray: Ray): number {
        var recordT:number = 9999999
        var e = ray.start
        var d = ray.dir
        this.spheres.forEach(function (sphere) {
            var c = sphere.pos
            var R = sphere.radius
            var eMc = Vector.minus(e, c)
            //check b^2-4ac
            var b = Vector.dot(d, eMc)
            var bSquare = Math.pow(b, 2)
            var ac = Vector.dot(d, d) * (Vector.dot(eMc, eMc) - R*R)
            var check = (bSquare - ac)
            if (check >= 0) {  
                var currentT1:number = (-b + Math.sqrt(check))/Vector.dot(d,d)
                var currentT2:number = (-b - Math.sqrt(check))/Vector.dot(d,d)

                var currentPoint1 = Vector.plus(e, Vector.times(currentT1, d))
                var distance1 = Vector.mag(Vector.minus(currentPoint1, ray.start))
                var currentPoint2 = Vector.plus(e, Vector.times(currentT2, d))
                var distance2 = Vector.mag(Vector.minus(currentPoint2, e))
                if (distance1 > 0 && distance2 > 0) {
                    if (distance1 < distance2 && distance1 < recordT) {
                        recordT = distance1
                    }else if (distance1 > distance2 && distance2 < recordT){
                        recordT = distance2
                    }
                }else if (distance1 > 0) {
                    if (distance1< recordT) {
                        recordT = distance1
                    }
                }else if (distance2 > 0) {
                    if (distance2 < recordT) {
                        recordT = distance2
                    }
                }
            }
        })
        
        //disks

        this.disks.forEach(function (disk) {
            var c = disk.pos
            var R = disk.radius
            var norm = disk.nor

            var D = - Vector.dot(norm, c)
            var up = -(Vector.dot(norm, e) + D)
            var down = Vector.dot(norm, d)
            var t = up/down
            var point = Vector.plus(e, Vector.times(t, d))

            var distance = Vector.mag(Vector.minus(point, c))
            if (distance <= R) {
                var distanceToLight = Vector.mag(Vector.minus(point, e))
                if (distanceToLight < recordT) {
                    recordT = distanceToLight  
                }
            }
        })
        return recordT
    }

    // NEW COMMANDS FOR PART B

    // create a new disk 
    // 
    // NOTE:  the final vx, vy, vz are only needed for optional motion blur part, 
    // and are the velocity of the object. The object is moving from x,y,z - vx,vy,vz to x,y,z + vx,vy,vz 
    // during the time interval being rendered.
    new_disk (x: number, y: number, z: number, radius: number, 
              nx: number, ny: number, nz: number, dr: number, dg: number, db: number, 
              k_ambient: number, k_specular: number, specular_pow: number,
              vx?: number, vy?: number, vz?: number) {
                var newDisk:disk = {
                    pos: new Vector(x,y,z),
                    radius: radius,
                    color: new Color(dr,dg,db),
                    nor: new Vector(nx,ny,nz),
                    k_ambient: k_ambient, 
                    k_specular: k_specular, 
                    specular_pow: specular_pow
                }
                this.disks.push(newDisk)
                    
    }

    // create a new area light source
    area_light (r: number, g: number, b: number, x: number, y: number, z: number, 
                ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) {
                    var newarealight:arealight = {
                        color: new Color(r,g,b),
                        pos: new Vector(x,y,z),
                        u: new Vector(ux,uy,uz),
                        v: new Vector(vx, vy, vz)
                    }
                    this.arealights.push(newarealight)
    }

    set_sample_level (num: number) {
        this.samples = num
    }

    jitter_on() {
        this.jitter = true
    }

    jitter_off() {
        this.jitter = false
    }

    // turn reflection on or off for extra credit reflection part
    reflection_on() {
        this.enableReflections = true
    }

    reflection_off() {
        this.enableReflections = false
    }

    // turn motion blur on or off for extra credit motion blur part
    blur_on() {
        this.enableBlur = true
    }

    blur_off() {
        this.enableBlur = false
    }

    // turn depth of field on or off for extra credit depth of field part
    depth_on() {
        this.enableDepth = true
    }

    depth_off() {
        this.enableDepth = false
    }

    // COMMANDS FROM PART A

    // clear out all scene contents
    reset_scene() {
        this.clear_screen();
        this.pointlights = []
        this.ambientligh = {color:Color.white, pos:new Vector(0,0,0)}
        this.backgroundcolor = Color.grey
        this.set_eye(0,0,0,0,0,-1,0,1,0)
        this.spheres = []
        this.ambient = false
        this.disks = []
        this.arealights = []
    }

    // create a new point light source
    new_light (r: number, g: number, b: number, x: number, y: number, z: number) {

        var newlight:light = {color:new Color(r,g,b), pos:new Vector(x, y, z)}
        this.pointlights.push(newlight)
    }

    // set value of ambient light source
    ambient_light (r: number, g: number, b: number) {
    
        var newlight:light = {color:new Color(r,g,b), pos:new Vector(0, 0, 0)}
        this.ambientligh = newlight
        this.ambient = true
    }

    // set the background color for the scene
    set_background (r: number, g: number, b: number) {
        this.backgroundcolor = new Color(r, g, b)
    }

    // set the field of view
    DEG2RAD = (Math.PI/180)

    set_fov (theta: number) {
        this.fov = theta
    }

    // // set the position of the virtual camera/eye
    // set_eye_position (x: number, y: number, z: number) {
    //     this.scene.camera.pos = new Vector(x,y,z)
    // }

    // set the virtual camera's viewing direction
    set_eye(x1: number, y1: number, z1: number, 
            x2: number, y2: number, z2: number, 
            x3: number, y3: number, z3: number) {
                var w:Vector = new Vector(-(x2 - x1), -(y2 - y1), -(z2 - z1))
                w = Vector.norm(w)
                var v:Vector = new Vector(x3,y3,z3)
                // v = Vector.norm(v)
                var u:Vector = Vector.cross(v, w)
                u = Vector.norm(u)
                v = Vector.cross(u, w)
                v = Vector.norm(v)
                var pos:Vector = new Vector(x1,y1,z1)
                this.eye = {u:u, v:v, w:w, pos:pos}
    }

    // create a new sphere.
    //
    // NOTE:  the final vx, vy, vz are only needed for optional motion blur part, 
    // and are the velocity of the object. The object is moving from x,y,z - vx,vy,vz to x,y,z + vx,vy,vz 
    // during the time interval being rendered.

    new_sphere (x: number, y: number, z: number, radius: number, 
                dr: number, dg: number, db: number, 
                k_ambient: number, k_specular: number, specular_pow: number, 
                vx?: number, vy?: number, vz?: number) {

                    var pos = new Vector(x,y,z)
                    var current:sphere = {pos:pos, radius: radius, color: new Color(dr,dg,db), 
                        k_ambient: k_ambient, k_specular: k_specular, specular_pow: specular_pow}
                    this.spheres.push(current)
    }

    // INTERNAL METHODS YOU MUST IMPLEMENT

    // create an eye ray based on the current pixel's position
    private eyeRay(i: number, j: number): Ray {
        var d:number = -1/Math.tan(this.DEG2RAD*this.fov/2)
        var ratio:number = this.height/this.width
        var us:number = -1 + 2*i/this.screenWidth + 1/this.screenWidth
        var vs:number = (-1 + 2*j/this.screenHeight + 1/this.screenHeight)*ratio
        // var us:number = -1 + 2*i/this.screenWidth
        // var vs:number = -1 + 2*j/this.screenHeight
        var dir:Vector = Vector.plus(
            Vector.plus(
                Vector.times(us, this.eye.u), 
                Vector.times(vs, this.eye.v)
            )
            , 
            Vector.times(d, this.eye.w)
        )
        dir = Vector.norm(dir)
        var output:Ray = {start:this.eye.pos, dir:dir}
        return output
    }

    private traceRay(ray: Ray, depth: number = 0): Color {
        var record:sphere|disk
        var check:number = 0
        var normal:Vector = new Vector(0,0,0)
        if (this.disks.length > 0){
            record = this.disks[0]
        }else{
            record = this.spheres[0]
        }
        var recordT:number = 9999999
        var e = ray.start
        var d = ray.dir
        this.spheres.forEach(function (sphere) {
            var c = sphere.pos
            var R = sphere.radius
            var eMc = Vector.minus(e, c)
            //check b^2-4ac
            var b = Vector.dot(d, eMc)
            var bSquare = Math.pow(b, 2)
            var ac = Vector.dot(d, d) * (Vector.dot(eMc, eMc) - R*R)
            var check = (bSquare - ac)
            if (check >= 0) {  
                var currentT1:number = (-b + Math.sqrt(check))/Vector.dot(d,d)
                var currentT2:number = (-b - Math.sqrt(check))/Vector.dot(d,d)
                if (check == 0) {
                    if (currentT2 < recordT) {
                        recordT = currentT2
                        record = sphere    
                        check = 1
                    }
                }else{
                    var min:number = 0
                    if (currentT1 > currentT2) {
                        min = currentT2                        
                    }else{
                        min = currentT1
                    }
                    if (min < recordT) {  
                        recordT = min      
                        record = sphere   
                        check = 1               
                    }
                }
            }
        })
        
        //disks

        this.disks.forEach(function (disk) {
            var c = disk.pos
            var R = disk.radius
            var norm = disk.nor

            var D = - Vector.dot(norm, c)
            var up = -(Vector.dot(norm, e) + D)
            var down = Vector.dot(norm, d)
            var t = up/down
            var point = Vector.plus(e, Vector.times(t, d))

            var distance = Vector.mag(Vector.minus(point, c))
            if (distance <= R) {  
                if (t < recordT && t > 0) {
                    recordT = t
                    record = disk 
                    check = 2   
                    normal = disk.nor
                }
            }
        })

        if(recordT == 9999999){
            return this.backgroundcolor
        }else{
            var sum = new Color(0,0,0)
            var point = Vector.plus(e, Vector.times(recordT, d))
            // var n = Vector.times(1/record.radius, Vector.minus(point, record.pos))
            var n = Vector.minus(point, record.pos)
            n = Vector.norm(n)

            if (check == 2) {
                n = normal
            }

            var kd = record.color
            var ka = record.k_ambient
            var ks = new Color(record.k_specular, record.k_specular, record.k_specular)
            var sp = record.specular_pow
            var V = ray.dir
            V = Vector.times(-1, V)
            V = Vector.norm(V)
            this.pointlights.forEach(light => {
                var l = Vector.minus(light.pos, point)
                l = Vector.norm(l)

                var newRay:Ray = {start:light.pos, dir:Vector.times(-1, l)}
                var firsthitdis:number = this.testRay(newRay)
                var originaldistance = Vector.mag(Vector.minus(point, light.pos))

                var shadow:number
                if (0.0000001 < originaldistance - firsthitdis) {
                    shadow = 0
                }else{
                    shadow = 1
                }

                var Ri = Vector.minus(
                    Vector.times(2, Vector.times(Vector.dot(l, n), n)),
                    l
                )
                Ri = Vector.norm(Ri)
                
                var Riv = Vector.dot(Ri, V)

                if (Vector.dot(Ri,l) <= 0) {
                    Riv = 0
                }

                var Rivpi = Math.pow(Riv, sp)

                var specular = Color.scale(Rivpi, ks)

                var diffuse = Color.scale(Vector.dot(n,l), kd)
                
                var finalsum = Color.plus(specular, diffuse)

                var final = Color.scale(shadow,Color.times(light.color, finalsum))

                sum = Color.plus(final, sum)
            })
        
            var distr:Sample[] = this.createDistribution()
            this.arealights.forEach(light => {
                var diffuseSum:Color = new Color(0,0,0)
                var finalSpec:Color = new Color(0,0,0)
                var counts:number  = 0
                distr.forEach(sample => {
                    var pos = Vector.plus(light.pos, Vector.plus(Vector.times(2*sample.s - 1, light.u), Vector.times(2*sample.t - 1, light.v)))
                    var l = Vector.minus(pos, point)

                    var newRay:Ray = {start:light.pos, dir:Vector.norm(Vector.times(-1, l))}
                    var firsthitdis:number = this.testRay(newRay)
                    var originaldistance = Vector.mag(Vector.minus(point, light.pos))
    
                    var shadow:number
                    if (0.0000001 < originaldistance - firsthitdis) {
                        shadow = 0
                    }else{
                        counts+=1
                        shadow = 1
                    }

                    l = Vector.norm(l)
                    var Ri = Vector.minus(
                        Vector.times(2, Vector.times(Vector.dot(l, n), n)),
                        l
                    )
                    Ri = Vector.norm(Ri)
                    
                    var Riv = Vector.dot(Ri, V)
    
                    if (Vector.dot(Ri,l) <= 0) {
                        Riv = 0
                    }
    
                    var Rivpi = Math.pow(Riv, sp)
    
                    var specular = Color.scale(Rivpi, ks)
    
                    var diffuse = Color.scale(Vector.dot(n,l), kd)
                    
                    if (shadow == 1) {
                        diffuseSum = Color.plus(diffuseSum, diffuse) 
                    }
                    
                    var magFornew = Color.lightness(specular)
                    var magForold = Color.lightness(finalSpec)

                    if ( magFornew > magForold ) {
                        finalSpec = specular
                    }
                })
                diffuseSum = Color.scale(1/(this.samples*this.samples), diffuseSum)
                sum = Color.plus(sum, Color.times(light.color,Color.plus(diffuseSum, finalSpec)))
            })

            

            var ambientColor = this.ambientligh.color
            if(this.ambient == true){
                sum = Color.plus(sum, Color.times(Color.scale(ka, ambientColor), kd))
            }

            return sum
        }

    }

    // draw_scene is provided to create the image from the ray traced colors. 
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it uses the additional constructor parameters to allow it to render a  
    //    smaller # of pixels than the size of the canvas
    //
    // YOU WILL NEED TO MODIFY draw_scene TO IMPLEMENT DISTRIBUTION RAY TRACING!
    //
    // NOTE: this method now has three optional parameters that are used for the depth of
    // field extra credit part. You will use these to modify this routine to adjust the
    // eyeRays to create the depth of field effect.
    draw_scene(lensSize?: number, depth1?: number, depth2?: number) {

        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = this.width / this.screenWidth;
        var pixelHeight = this.height / this.screenHeight;
        var y = 0;
        
        this.clear_screen();

        var renderRow = () => {
            for (var x = 0; x < this.screenWidth; x++) {
                // HINT: if you implemented "createDistribution()" above, you can use it here
                let vecs = this.createDistribution()

                // HINT: you will need to loop through all the rays, if distribution is turned
                // on, and compute an average color for each pixel.
                var sum:Color = new Color(0,0,0)
                vecs.forEach(vec => {
                    var ray = this.eyeRay(x+vec.s-0.5, y+vec.t-0.5);
                    var c = this.traceRay(ray); 
                    sum = Color.plus(c, sum)
                });

                sum = Color.scale(1/(this.samples*this.samples), sum)

                var color = Color.toDrawingColor(sum)
                this.ctx.fillStyle = "rgb(" + String(color.r) + ", " + String(color.g) + ", " + String(color.b) + ")";
                this.ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth+1, pixelHeight+1);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < this.screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                console.log("Finished rendering scene")
            }
        }

        renderRow();
    }

    clear_screen() {
        this.ctx.fillStyle = this.canvasColor;
        this.ctx.fillRect(0, 0, this.canv.width, this.canv.height);

    }
}
export {RayTracer}