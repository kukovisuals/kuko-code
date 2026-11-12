#define H(p)   fract(sin(dot(p, vec2(127.1, 311.7))) * 4e3)
#define L(p,s) length(p - s * clamp(dot(p,s) ,0.,.5))

// does cell c pick direction index k?
bool W(vec2 c, float k)
{
    return k == floor(H(c) * 4.) || k == floor(H(c + iTime * 4e-7) * 4.);
}

void mainImage( out vec4 O, vec2 I )
{
    vec2 m = 20. / iResolution.yy;
         I *= m;
         
    // cells
    vec2 c = floor(I),
         v = I - c - 0.5,
         s;
         
    // put a dot on every cell so we know what's up 
    
    // this cell's two picks, rolled once before the loop
    float a = floor(H(c) * 4.),
          b = floor(H(c + iTime * 4e-7) * 4.);

    // how do we add the edges 
    float d1 = 1., d3 = 1., n=0., i, k;

    for( s.x++; i++<4.; s = vec2(-s.y, s))
    {
        // direction index for this pass: 0 right, 1 up, 2 left, 3 down
        k = i - 1.;
        // this cell picked k, and the neighbor picked the opposite back
        if( (k == a || k == b) && W(c+s, mod(i+1., 4.)) )
        {
            d1 = min(d1, L(v, s));
            n++;
        }
    }
    
    // grab the n = 1 which seems to be the tip 
    if(n == 1.)
        d1 = min(abs(length(v) - 0.3) + 0.04, d1);
          
    O = 1. - (d1-.04)/m.xxxx;
    
}
