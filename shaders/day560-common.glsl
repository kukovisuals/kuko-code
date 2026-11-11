#define h(p)   fract(sin(dot(p, vec2(127.1, 311.7))) * 4e3)
#define L(p,b) length(p - vec2(b,0) * clamp(p/b, 0.,1.))
#define B(b)   max(abs(b.x), abs(b.y)) - 0.15
