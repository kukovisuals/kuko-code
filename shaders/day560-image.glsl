vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * sin(0.+5.1416 * (c * t + d));
}

#define rot(a) mat2(cos(a + vec4(0,11,33,0)))

// snap to voxel
float density(vec3 p)
{
    vec3 a = abs(p), u = (floor((.5 + .5*p)*128.) + .5) / 128.;
    return max(a.x, max(a.y, a.z)) > 1. ? 0. : texture(iChannel0, u).r;
}

void mainImage(out vec4 O, vec2 I)
{
    vec3 R = iResolution,
         M = length(iMouse.xy) > 10. ? iMouse.xyz/R - .5 : vec3(0),
         D = normalize(vec3(I + I, -2.*R.y) - R),
         p = vec3(0, 0, 1.);

    // look around
    p.yz *= rot(3.*M.y); D.yz *= rot(3.*M.y);
    p.xz *= rot(3.*M.x); D.xz *= rot(3.*M.x);

    // only march inside the cube
    vec3 t0 = (-1. - p)/D, t1 = (1. - p)/D,
         tn = min(t0, t1), tf = max(t0, t1);
    float T = 1., dl = 1./100., r,
          l = max(max(tn.x, max(tn.y, tn.z)), 0.) + h(I)*dl,
          e = min(tf.x, min(tf.y, tf.z));
    p += D*l;
    O = vec4(0, 0, 0, 1);

    // stop at the fog
    for (; l < e && T > .01; l += dl, p += D*dl)
    {
        r = density(p);
        // each voxel gets its own slow shimmer
        float tw = .5 + .05*sin(1.*iTime + 6.28*h(floor(p.xz*64.) + floor(p.y*64.)*7.));
        
        //col
        vec3 tc = 2.*palette(l, vec3(.5), vec3(.5), vec3(.4), vec3(0.8, .133, .9));

        // white heads, palette trails and wall traces, everything else dark
        vec3 c = r > .7 ? vec3(1) : r > .5 ? tc*(2. + 3.*tw) : vec3(0);
        
        O.rgb += T * r * dl * 10. * c;
    }
}
