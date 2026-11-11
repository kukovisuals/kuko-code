const vec3 DIR[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0),
                            vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
                            
                            
float P(vec3 p) { return texelFetch(iChannel0, ivec3(p), 0).r; }

// integer hash, reliable even for tiny probabilities
float rnd(ivec3 p, int s)
{
    uint n = uint(p.x)*1973u + uint(p.y)*9277u + uint(p.z)*26699u + uint(s)*83492791u;
    n = (n ^ (n >> 15)) * 2246822519u;
    n = (n ^ (n >> 13)) * 3266489917u;
    return float(n ^ (n >> 16)) / 4294967296.;
}

void mainVolume(out vec4 O, vec3 p)
{
    vec3 q = p/64. - 1.;
    
    vec2 a = abs(q.xy);
        
    if (max(a.x, a.y) > .92 || abs(q.z) > .95) return;
    float v = P(p), next = 0.;
    
    if (v > .68) next = .66;
    if (v > .5 && v <= .66) next = v - 1./255.;
    
    // loop the directions
    for (int i = 0; i < 6; i++)
    {
        float n = P(p - DIR[i]);
        if (v < .5 && n > .68 && int(round((n - .7)/.04)) == i) 
            next = .7 + .04*float(i);
    }

    float k = floor(5.*rnd(ivec3(p), 3*iFrame + 1));
    
    if (next > .7 && rnd(ivec3(p), 3*iFrame) > .96) 
        next = .7 + .04*(k + step(2., k));

    // spawn on the bottom
    if (v < .05 && q.y > .9 && rnd(ivec3(p), 4*iFrame + 2) > .9998) 
        next = .82;
    
    O = vec4(next);
}
