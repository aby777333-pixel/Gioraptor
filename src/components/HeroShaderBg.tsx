'use client';

import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec4 position;
void main() {
  gl_Position = vec4(position);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;

#define R u_resolution
#define T u_time
#define PI 3.141592653
#define PI2 6.283185307
#define N 6.

mat2 rot(float a) { return mat2(cos(a),sin(a),-sin(a),cos(a)); }

float hash21(vec2 a) {
  a.y = mod(a.y, N);
  return fract(sin(dot(a, vec2(27.609, 57.583))) * 43758.5453);
}

float box(in vec2 p, in vec2 b) {
  vec2 q = abs(p) - b;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

const float size = 2.;
const float hlf = size / 2.;
const float dbl = size * 2.;

vec3 hsv(in vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6. + vec3(0, 4, 2), 6.) - 3.) - 1., 0., 1.);
  return c.z * mix(vec3(1), rgb, c.y);
}

void main() {
  vec2 F = gl_FragCoord.xy;
  vec2 uv = (2. * F.xy - R.xy) / max(R.x, R.y);

  uv *= rot(-T * .08);
  uv = -vec2(log(length(uv)), atan(uv.y, uv.x));
  uv /= PI;
  uv *= N;

  float px = fwidth(uv.x) * 2.5;
  uv.x += T * .4;

  vec2 p = uv * size, q;
  vec3 C = vec3(0);

  float sp = .45, sl = hlf * .975;
  float t = 1e5, id, fd;

  for (int i = 0; i < 2; i++) {
    if (i == 1) p.y += .5;
    float cnt = i < 1 ? size : dbl;
    q = vec2(p.x - cnt, p.y);
    id = floor(q.x / dbl) + .5;
    q.x -= id * dbl;

    fd = floor(q.y) + float(i);
    q.y = fract(q.y) - .5;
    t = box(q, vec2(sl, sp));
    float tc = length(q - vec2(sl, 0)) - sp;
    float bc = length(vec2(q.x, abs(q.y) - sp) + vec2(sl, 0)) - .5;

    t = min(t, tc);
    t = max(t, -bc);

    float hs = hash21(vec2(id, fd));
    float fs = fract(hs * 4785.312);

    // Use brand blue/teal/green hues instead of random rainbow
    vec3 h = hsv(vec3(hs * .15 + .55 + T * .008, .85, .35));
    vec3 CC = mix(h, h * .3, .75 - q.x * .5);
    C = mix(C, CC, smoothstep(px, -px, t));

    tc = length(q - vec2(sl * sin(hs + T * hs), 0)) - (sp * .8);
    tc = max(tc, t);

    C = mix(C, hsv(vec3(fs * .15 + .55 + T * .008, .9, .12)), smoothstep(px, -px, tc));
    C = mix(C, vec3(0), smoothstep(px, -px, abs(tc + .03) - .03));
  }

  C = pow(C, vec3(.4545));
  // Darken overall to serve as background
  C *= 0.45;
  fragColor = vec4(C, 1.0);
}`;

export default function HeroShaderBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return;

    function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(program));
      return;
    }

    const posLoc = gl.getAttribLocation(program, 'position');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0,  1, -1, 0,  -1, 1, 0,
      -1, 1, 0,   1, -1, 0,   1, 1, 0,
    ]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    function render(time: number) {
      resize();
      gl!.viewport(0, 0, gl!.canvas.width, gl!.canvas.height);
      gl!.useProgram(program);
      gl!.bindVertexArray(vao);
      gl!.uniform2f(resLoc, gl!.canvas.width, gl!.canvas.height);
      gl!.uniform1f(timeLoc, time * 0.001);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
