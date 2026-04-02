'use client';

import { useEffect, useRef } from 'react';

export default function HeroShaderBg() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    async function init() {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
      const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
      const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');

      if (cancelled || !container) return;

      const noiseChunk = `
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float noise(in vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                         mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                         mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        float fbm(vec3 p) {
          float f = 0.0; float amp = 0.5;
          for(int i = 0; i < 4; i++) { f += amp * noise(p); p *= 2.2; amp *= 0.5; }
          return f;
        }
        float ridge(vec3 p) {
          float f = 0.0; float amp = 0.5;
          for(int i = 0; i < 4; i++) { float n = noise(p); n = 1.0 - abs(n * 2.0 - 1.0); f += amp * n; p *= 2.2; amp *= 0.5; }
          return f;
        }
        float veinNoise(vec3 p) {
          float f = 0.0; float amp = 0.5;
          for(int i = 0; i < 3; i++) { float n = noise(p); n = 1.0 - abs(n * 2.0 - 1.0); n = pow(n, 5.0); f += amp * n; p *= 2.5; amp *= 0.4; }
          return f;
        }
      `;

      const volumeVertexShader = `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `;

      const volumeFragmentShader = `
        ${noiseChunk}
        varying vec3 vWorldPosition;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorOuter;
        uniform float uTime;
        uniform float uRidgeTime;
        uniform float uVeinTime;
        uniform float uDensityMult;
        uniform float uStructure;

        vec2 hitBox(vec3 ro, vec3 rd, vec3 extents) {
          vec3 t0 = (-extents - ro) / rd;
          vec3 t1 = (extents - ro) / rd;
          vec3 tmin = min(t0, t1);
          vec3 tmax = max(t0, t1);
          float tnear = max(max(tmin.x, tmin.y), tmin.z);
          float tfar = min(min(tmax.x, tmax.y), tmax.z);
          return vec2(tnear, tfar);
        }

        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vWorldPosition - cameraPosition);
          vec2 hit = hitBox(ro, rd, vec3(5.0));
          if(hit.x > hit.y || hit.y < 0.0) discard;

          float stepSize = 0.3;
          float t = max(hit.x, 0.0);
          float tmax = min(hit.y, 15.0);
          vec4 sum = vec4(0.0);

          for(int i = 0; i < 32; i++) {
            if(t >= tmax || sum.a >= 0.95) break;
            vec3 p = ro + rd * t;
            float r = length(p);
            if(r < 4.8) {
              vec3 q = p - vec3(0.0, uTime * 0.15, uTime * 0.05);
              q *= uStructure * 3.0;
              vec3 qRidge = p - vec3(0.0, uRidgeTime * 0.15, uRidgeTime * 0.05);
              qRidge *= uStructure * 3.0;
              vec3 qVein = p - vec3(0.0, uVeinTime * 0.15, uVeinTime * 0.05);
              qVein *= uStructure * 3.0;

              float n1 = fbm(q);
              float n2 = ridge(qRidge * 1.5 + n1 * 0.5);
              float veins = veinNoise(qVein * 2.0 - vec3(uVeinTime * 0.1));
              float falloff = smoothstep(4.5, 0.5, r);
              float density = (n1 * 0.6 + n2 * 0.4) * falloff;
              density -= fbm(q * 2.5) * 0.4;
              density = max(density, 0.0) * uDensityMult;

              if(density > 0.01) {
                vec3 c = mix(uColorOuter, uColorMid, smoothstep(4.5, 1.5, r));
                float coreGlow = smoothstep(2.5, 0.0, r) * (density * 1.0);
                c = mix(c, uColorCore, coreGlow);
                c = mix(c, vec3(0.0, 0.5, 0.8), smoothstep(0.6, 1.0, n2) * 0.3);
                vec3 veinColor = mix(uColorMid, vec3(0.3, 0.7, 1.0), n1);
                c += veinColor * veins * 2.0 * falloff;
                c *= mix(0.1, 1.0, n1);
                vec4 src = vec4(c * density * 1.2, density * 0.15 * 1.2);
                sum += src * (1.0 - sum.a);
              }
            }
            t += stepSize;
          }
          gl_FragColor = sum;
        }
      `;

      const particleVS = `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float pSize = size * (10.0 / -mvPosition.z);
          gl_PointSize = max(pSize, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `;
      const particleFS = `
        varying vec3 vColor;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(vColor * 1.5, alpha);
        }
      `;

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#060D16');

      const w = container.clientWidth;
      const h = container.clientHeight;
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
      camera.position.set(0, 0, 3.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * 0.75);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.cursor = 'grab';

      // Interactive orbit controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 3.0;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.minDistance = 2.0;
      controls.maxDistance = 8;

      // Post-processing
      const renderScene = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h), 0.4, 0.4, 0.4
      );
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * 0.75);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);

      const group = new THREE.Group();
      scene.add(group);

      // Nebula volume — brand-colored (blue/teal)
      const volumeGeo = new THREE.BoxGeometry(10, 10, 10);
      const volumeUniforms = {
        uTime: { value: 0 },
        uRidgeTime: { value: 0 },
        uVeinTime: { value: 0 },
        uDensityMult: { value: 0.5 },
        uStructure: { value: 0.14 },
        uColorCore: { value: new THREE.Color('#b0e0ff') },
        uColorMid: { value: new THREE.Color('#0091D5') },
        uColorOuter: { value: new THREE.Color('#002a44') },
      };

      const volumeMaterial = new THREE.ShaderMaterial({
        vertexShader: volumeVertexShader,
        fragmentShader: volumeFragmentShader,
        uniforms: volumeUniforms,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(volumeGeo, volumeMaterial));

      // Stars
      const particleCount = 500;
      const particleGeo = new THREE.BufferGeometry();
      const pPositions = new Float32Array(particleCount * 3);
      const pColors = new Float32Array(particleCount * 3);
      const pSizes = new Float32Array(particleCount);
      const colorPalettes = [
        new THREE.Color('#ffffff'),
        new THREE.Color('#0091D5'),
        new THREE.Color('#00A5A8'),
      ];
      for (let i = 0; i < particleCount; i++) {
        const r = 0.5 + Math.random() * 8.0;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pPositions[i * 3 + 2] = r * Math.cos(phi);
        const color = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        pColors[i * 3] = color.r;
        pColors[i * 3 + 1] = color.g;
        pColors[i * 3 + 2] = color.b;
        pSizes[i] = Math.random() * 1.0 + 0.2;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
      particleGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader: particleVS,
        fragmentShader: particleFS,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeo, particleMaterial);
      group.add(particles);

      // Animation
      const clock = new THREE.Clock();
      let shaderTime = 0;
      let ridgeTime = 0;
      let veinTime = 0;
      let animId = 0;

      function animate() {
        if (cancelled) return;
        animId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        shaderTime += delta * 1.0;
        ridgeTime += delta * 0.3;
        veinTime += delta * 1.0;

        volumeUniforms.uTime.value = shaderTime;
        volumeUniforms.uRidgeTime.value = ridgeTime;
        volumeUniforms.uVeinTime.value = veinTime;

        particles.rotation.y += delta * 0.02;
        controls.update();
        composer.render();
      }

      animate();

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      cleanupRef.current = () => {
        cancelled = true;
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', handleResize);
        controls.dispose();
        renderer.dispose();
        composer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    }

    init();

    return () => {
      cancelled = true;
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
