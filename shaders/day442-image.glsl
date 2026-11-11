/*
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

    ▓              🌟  KuKo Day 442  🌟

    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
*/

#define AA 1
#define FAR 30.
#define PI 3.14159265

// create the vector arrow
float arrow(vec3 p, vec3 a, vec3 b, float off, int id)
{
    float d1 = sdCapsule(p, a, b, 0.15);

    return d1;//min(d1,d2);
}

// Got the matrix folding idea from this shader
// https://www.shadertoy.com/view/s3XXDj
vec2 shape(vec3 p, vec3 a, vec3 b)
{
    vec3 np1 = p;
    // fold the space
    for(int i=1; i<6; i++)
    {
        p = abs(p) - 0.45;
        p.xy *= mat2(-0.3443, 0.8854, -0.8854, -0.3443);//mat2(0.7,0.7,-0.7,0.7);
        p.yz *= mat2(0.3443, 0.8854, -0.8854, 0.3443);//mat2(0.7,0.7,-0.7,0.7);
        p.xy *= r2(iTime * 0.05);
    }

    p.yz *= r2(2.85); //r2(iMouse.x/100.);
    p.xz *= r2(.4); //r2(iMouse.y/100.);

    float d4 = sdCapsule(p, a, b, 0.06);//sdLink(p, b.z , b.y, 0.03);

    float d2 = length(np1) - 4.4;

    vec3 np = p;
    np.xy += .2;//iMouse.x/200.;;
    //np.y += iMouse.y/200.;
    np.z -= iTime * 0.01;//iMouse.z/200.;

    float cell = .5;
    np = vec3(mod(np, cell) - cell * 0.5);
    float d5 = length(np) - 0.08;

    float d6 = -smin(-d2,-d4, 0.25);
    float id =2.;

    if(d6 > d5){ d6 = -smin(-d2,-d5, 0.2); id = 4.;}
    return vec2(d6, id);
}

vec2 map(vec3 p)
{
    p.yz *= r2(iTime * 0.1);

    float fx = sin(iTime * 1.) * 0.005 - 0.03;

    // red
    vec3 a1 = vec3(0,0,0);
    vec3 b2 = vec3(0,0,1.);

    vec2 d1 = shape(p, a1, b2);
    float d2 = length(p) - 4.4;

    // final shape
    float  shape = d1.x;
    float id = d1.y;

    //if(shape > d1.x) { shape = -smin(-d2,-d1.x, 0.34); id= 0.;}

    return vec2(shape, id);
}

vec2 rayMarch(vec3 ro, vec3 rd)
{
    float dt = 0.;
    float id = 0.;
    for(int i=0; i<60; i++)
    {
        // position along the ray
        vec3 p = ro + rd * dt;

        // current distance to the scene
        vec2 sdf = map(p);

        float d = sdf.x;

        id = sdf.y;
        // march the ray
        dt += d;

        if(abs(d) < 0.001 || dt > 30.) break;
    }

    return vec2(dt, id);
}

vec3 calcNormal(vec3 p)
{
    float e = 0.001;
    return normalize(vec3(
        map(p + vec3(e,0,0)).x - map(p - vec3(e,0,0)).x,
        map(p + vec3(0,e,0)).x - map(p - vec3(0,e,0)).x,
        map(p + vec3(0,0,e)).x - map(p - vec3(0,0,e)).x
    ));
}


mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv =          ( cross(cu,cw) );
    return mat3( cu, cv, cw );
}


vec3 render(vec3 ro, vec3 rd)
{
    vec3 col = vec3(0);

    vec2 dt = rayMarch(ro,rd);

    vec3 l,p;
    if(dt.x < 30.)
    {
        p = ro + rd * dt.x;
        vec3 n = calcNormal(p);
        l = normalize(vec3(0,2,0)-p);

        float NoV  = clamp(dot(n, -rd), 0.0, 1.0);
        float rim  = pow(1.0 - NoV, 2.5) * 2.;

        vec3 bgcol = vec3(0);

        float diff = max(dot(n, l), 0.0);
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 12.0);

        vec3 rimCol = vec3(0);

        if (dt.y > 3.)
        {
            // blobs
            bgcol = vec3(0.725,0.133,0.537);
            rimCol = vec3(0.404,0.055,0.565) * rim;
        }
        else
        {
            // spikes
            bgcol = vec3(0.804,0.075,0.184);
            rimCol = vec3(0.918,0.063,0.063) * rim;
        }

        col = bgcol * (diff + 0.0) + vec3(.8) * spec * .5;
        col += rimCol;

    }


    // Blend the scene and the background
    col = mix(col, vec3(0.0123), min(pow(dt.x,2.3)*.3/FAR, 1.));

    return col;
    //O = vec4(col,1.0);
}


/*
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

    ▓              🌟  AA  🌟

    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
*/

void mainImage(out vec4 O, in vec2 I)
{
    vec2 uv = (2.0 * I - iResolution.xy) / iResolution.y;

    vec2 mo = iMouse.xy/iResolution.xy;
	float t = 18. + iTime*.5;

    // camera
    vec3 ta = vec3(0,0,0);
    vec3 ro = ta + vec3( 5.5*cos(0.1*t), 2.2, 5.5*sin(0.1*t));
    // camera-to-world transformation
    mat3 ca = setCamera( ro, ta, 0.0 );

    vec3 tot = vec3(0.0);

    for (int m = 0; m < AA; m++)
    for (int n = 0; n < AA; n++) {
        vec2 off = vec2(m, n) / float(AA) - 0.5;
        vec2 uv = (2.0 * (I + off) - iResolution.xy) / iResolution.y;
        vec3 rd = ca *  normalize(vec3(uv, 1.5));
        vec3 col = render(ro, rd);

        col = pow(col * 1.0, vec3(1.1 / 2.2));

        tot += col;
    }

    tot /= float(AA * AA);

    O = vec4(tot, 1.0);
}
