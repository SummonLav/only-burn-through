export const vertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uResolution;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform float uProgress;
uniform float uTime;
uniform float uWidth;
uniform float uIntensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
}

float fbm(vec2 p) {
  float n = 0.0, a = 0.5;
  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    n += a * noise(p);
    p = rotation * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return n;
}

// Contain both portrait originals without stretching or cutting off the figure.
vec3 photo(sampler2D source, vec2 uv, vec2 size) {
  float canvasAspect = uResolution.x / uResolution.y;
  float imageAspect = size.x / size.y;
  vec2 scale = vec2(max(canvasAspect / imageAspect, 1.0),
                    max(imageAspect / canvasAspect, 1.0));
  vec2 fitted = (uv - 0.5) * scale + 0.5;
  vec2 inside = step(vec2(0.), fitted) * step(fitted, vec2(1.));
  return texture2D(source, clamp(fitted, 0.0, 1.0)).rgb * inside.x * inside.y;
}

void main() {
  vec2 uv = vUv;
  if (uProgress <= 0.0) {
    gl_FragColor = vec4(photo(uFrom, uv, uFromSize), 1.0);
    return;
  }
  if (uProgress >= 1.0) {
    gl_FragColor = vec4(photo(uTo, uv, uToSize), 1.0);
    return;
  }

  // Analytic ease-out: greatest velocity at ignition, zero velocity at the top.
  float eased = 1.0 - pow(1.0 - uProgress, 2.4);
  float front = mix(-0.105, 1.035, eased);
  float time = uTime;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Domain-warped, upward-advected turbulence. No repeated sine-wave edge.
  vec2 flow = vec2(
    fbm(p * vec2(5.1, 8.0) + vec2(0.1 * time, -time * 0.8)),
    fbm(p * vec2(8.2, 5.3) + vec2(7.1, -time * 0.65))
  );
  float wave = (fbm(vec2(p.x * 6.0, time * 0.3)) - 0.5) * 0.135;
  float tongues = fbm(vec2(p.x * 20.0 + flow.x * 3.2, p.y * 5.0 - time * 1.7));
  float irregularity = smoothstep(0.0, 0.05, uProgress) * (1.0 - smoothstep(0.84, 1.0, uProgress));
  float edge = front + (wave + (tongues - 0.46) * 0.14 * uWidth) * irregularity;
  float d = uv.y - edge;
  float alive = smoothstep(0.0, 0.035, uProgress) * (1.0 - smoothstep(0.91, 1.0, uProgress));

  // Heat refraction is confined to the advancing ribbon.
  float heat = exp(-abs(d) * 15.0) * alive;
  vec2 refraction = (flow - 0.5) * vec2(0.021, 0.010) * heat * uIntensity;
  vec3 before = photo(uFrom, uv + refraction, uFromSize);
  vec3 after = photo(uTo, uv + refraction * 0.55, uToSize);
  float revealed = 1.0 - smoothstep(-0.013, 0.011, d);
  vec3 color = mix(before, after, revealed);

  float billow = fbm(vec2(p.x * 29.0 + flow.x * 4.2, p.y * 13.0 - time * 2.4));
  float fine = noise(vec2(p.x * 90.0, p.y * 45.0 - time * 6.0) + flow * 4.0);
  float width = 0.028 * uWidth;
  // A thin connected hot core and translucent, taller licks ahead of it.
  float distance = abs(d) / (width * mix(0.65, 1.5, billow));
  float body = exp(-distance * 1.18) * (0.64 + 0.5 * billow);
  float core = exp(-distance * 4.2) * (0.76 + 0.24 * fine);
  float plume = exp(-abs(d - width * 0.9) / (width * 1.35));
  plume *= smoothstep(0.38, 0.75, billow + 0.13 * fine) * 0.67;
  float fire = (body + plume) * alive;
  float glow = exp(-abs(d) / (0.085 * uWidth)) * alive;

  // Warm emission layers: crimson outside, orange/yellow body, ivory-white core.
  vec3 emission = vec3(1.0, 0.055, 0.009) * fire * 1.2;
  emission += vec3(1.0, 0.34, 0.015) * pow(body, 1.65) * 2.1 * alive;
  emission += vec3(1.0, 0.79, 0.24) * pow(body, 3.0) * 2.0 * alive;
  emission += vec3(1.0, 0.97, 0.82) * core * 2.3 * alive;
  emission += vec3(0.55, 0.065, 0.014) * glow * 0.45;

  // Sparse embers lift a short distance above the band; none fill the whole frame.
  vec2 grid = vec2(p.x * 85.0, (p.y - time * 0.065) * 72.0);
  vec2 cell = floor(grid);
  vec2 sparkUv = fract(grid) - 0.5;
  float seed = hash(cell);
  sparkUv.x += 0.2 * sin(time * 2.0 + seed * 20.0);
  float spark = exp(-length(sparkUv * vec2(1.0, 0.53)) * 33.0);
  spark *= step(0.968, seed) * smoothstep(0.014, 0.05, d);
  spark *= 1.0 - smoothstep(0.05, 0.25, d);
  emission += vec3(1.0, 0.48, 0.08) * spark * 3.5 * alive;

  // Exponential exposure gives luminous white without a hard rectangular bloom.
  vec3 light = 1.0 - exp(-emission * uIntensity);
  color = color * (1.0 - clamp(fire * 0.82, 0.0, 0.94)) + light;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
