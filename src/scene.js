// Scène 3D : arène néon, cible lumineuse, tours de cubes, fléchettes métalliques. Unités : mm.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ORDER, RADII } from './board.js';

const BOARD_RADIUS = 200; // cible + couronne des numéros
const FOV = 40;
const DART_SCALE = 1.4;
const HAND_SCALE = 0.7; // la fléchette tenue est plus petite pour ne pas écraser la cible
const HAND_DEPTH = 430; // distance caméra -> pointe de la fléchette tenue
const HAND_TILT = 0.3; // la fléchette tenue est relevée d'environ 50° : on la voit en long, comme dans Darts of Fury

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050c);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);

  // Lumière : un projecteur froid devant la cible (pour les ombres des fléchettes), le reste est néon
  const spot = new THREE.SpotLight(0xcfe0ff, 7, 0, 0.9, 1, 0);
  spot.position.set(0, 300, 420);
  spot.target.position.set(0, -60, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 40;
  spot.shadow.camera.far = 1600;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.6;
  spot.shadow.radius = 3;
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x7fa6ff, 0x0a0f24, 0.55));

  buildArena(scene);
  const { faceMat } = buildBoard(scene);
  const towers = buildTowers(scene);
  let dim = 0;
  let dimTarget = 0;

  const darts = [];
  const wobbles = [];
  const clock = new THREE.Clock();

  let camDistance = 1000;
  let camBaseY = 0;

  // ---------- Fléchette en main (visée) ----------
  const hand = makeDart();
  hand.scale.setScalar(DART_SCALE * HAND_SCALE);
  scene.add(hand);
  const aim = { active: false, x: 0, y: 0 };
  const handTarget = new THREE.Vector3();
  const handDir = new THREE.Vector3();
  const handQuatTarget = new THREE.Quaternion();
  const FORWARD = new THREE.Vector3(0, 0, -1);

  // Pose de la fléchette tenue : la pointe est sur la ligne de vue du point visé, près de la caméra,
  // et la fléchette est relevée pour qu'on la voie en long.
  function handPose(boardX, boardY, outPos, outDir) {
    tmpB.set(boardX, boardY, 0);
    outPos
      .copy(camera.position)
      .add(tmpV.copy(tmpB).sub(camera.position).multiplyScalar(HAND_DEPTH / camDistance));
    outDir.copy(tmpB).sub(outPos).normalize();
    outDir.y += HAND_TILT;
    outDir.normalize();
  }

  // au repos, la fléchette est au centre bas de l'écran
  function idleBoardPoint() {
    return screenToBoard(window.innerWidth / 2, window.innerHeight * 0.74);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;

    // On cadre la cible : toute la largeur en portrait, toute la hauteur en paysage.
    const halfH = Math.max(290, 243 / camera.aspect);
    camDistance = halfH / Math.tan((FOV / 2) * Math.PI / 180);
    // La cible est remontée dans l'écran pour laisser la place à la fléchette en bas.
    camBaseY = -halfH * 0.2;
    camera.position.set(0, camBaseY, camDistance);
    camera.lookAt(0, camBaseY, 0);
    camera.updateProjectionMatrix();
  }

  // Position du doigt (px) -> point sur la cible (mm)
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function screenToBoard(px, py) {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return { x: 0, y: 0 };
    return { x: hit.x, y: hit.y };
  }

  function setAimActive(active) {
    aim.active = active;
  }
  function setAim(x, y) {
    aim.x = x;
    aim.y = y;
  }
  function showHand(visible) {
    hand.visible = visible;
    if (visible) {
      const p = idleBoardPoint();
      handPose(p.x, p.y, hand.position, handDir);
      hand.quaternion.setFromUnitVectors(FORWARD, handDir);
      aim.active = false;
    }
  }

  // ---------- Étincelles à l'impact ----------
  const SPARKS = 18;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffd27a,
    size: 5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkLife = 0;

  function burst(x, y) {
    for (let i = 0; i < SPARKS; i += 1) {
      sparkPos[i * 3] = x;
      sparkPos[i * 3 + 1] = y;
      sparkPos[i * 3 + 2] = 6;
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      sparkVel[i * 3] = Math.cos(a) * speed;
      sparkVel[i * 3 + 1] = Math.sin(a) * speed + 40;
      sparkVel[i * 3 + 2] = 40 + Math.random() * 160;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkLife = 0.4;
  }

  // ---------- Vol d'une fléchette ----------
  // fromHand : la fléchette part de la position de visée et pique droit vers la cible.
  function flyDart(hit, { fromHand = false } = {}) {
    return new Promise((resolve) => {
      const dart = makeDart();
      scene.add(dart);

      const tilt = {
        yaw: (Math.random() - 0.5) * 0.14,
        pitch: 0.1 + Math.random() * 0.08,
      };
      const onBoard = Math.hypot(hit.x, hit.y) <= BOARD_RADIUS + 38;
      const end = new THREE.Vector3(hit.x, hit.y, onBoard ? -9 : -28);
      const start = new THREE.Vector3();
      const startDir = new THREE.Vector3();
      if (fromHand) {
        start.copy(hand.position);
        startDir.copy(FORWARD).applyQuaternion(hand.quaternion);
        hand.visible = false;
      } else {
        const p = idleBoardPoint();
        handPose(p.x, p.y, start, startDir);
      }
      dart.position.copy(start);
      dart.scale.setScalar(DART_SCALE * HAND_SCALE);
      dart.quaternion.setFromUnitVectors(FORWARD, startDir);

      const arc = 8; // presque pas de cloche : l effet vient de la perspective
      const duration = 150; // très rapide, comme dans Darts of Fury (environ 0,1 s)
      const t0 = performance.now();

      const posAt = (t) => {
        const p = start.clone().lerp(end, t);
        p.y += arc * 4 * t * (1 - t);
        return p;
      };
      const finalDir = new THREE.Vector3(Math.sin(tilt.yaw), -Math.sin(tilt.pitch), -1).normalize();

      function step(now) {
        const t = Math.min(1, (now - t0) / duration);
        const p = posAt(t);
        dart.position.copy(p);
        dart.scale.setScalar(DART_SCALE * (HAND_SCALE + (1 - HAND_SCALE) * Math.min(1, t * 1.6)));

        const dir = posAt(Math.min(1, t + 0.02)).sub(p);
        if (dir.lengthSq() > 1e-6) {
          dir.normalize();
          // au départ elle garde l'angle de la main, puis suit la courbe, puis se plante
          const w = Math.max(0, 1 - t / 0.3);
          if (w > 0) dir.lerp(startDir, w * w).normalize();
          dir.lerp(finalDir, t * t).normalize();
          dart.quaternion.setFromUnitVectors(FORWARD, dir);
        }

        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        dart.quaternion.setFromUnitVectors(FORWARD, finalDir);
        darts.push(dart);
        burst(hit.x, hit.y);
        wobbles.push({
          dart,
          base: dart.quaternion.clone(),
          t0: performance.now(),
          amp: 0.035 + Math.random() * 0.025,
          sign: Math.random() < 0.5 ? -1 : 1,
        });
        resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function clearDarts() {
    for (const dart of darts) scene.remove(dart);
    darts.length = 0;
    wobbles.length = 0;
  }

  // ---------- Boucle ----------
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  function loop() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    // légère respiration de la caméra
    camera.position.x = Math.sin(t * 0.5) * 2.5;
    camera.position.y = camBaseY + Math.sin(t * 0.8) * 1.5;
    camera.lookAt(0, camBaseY, 0);

    // fléchette en main
    if (hand.visible) {
      if (aim.active) {
        handPose(aim.x, aim.y, handTarget, handDir);
      } else {
        const p = idleBoardPoint();
        handPose(p.x, p.y + Math.sin(t * 2) * 1.5, handTarget, handDir);
      }
      handQuatTarget.setFromUnitVectors(FORWARD, handDir);
      const k = 1 - Math.exp(-dt * (aim.active ? 30 : 12));
      hand.position.lerp(handTarget, k);
      hand.quaternion.slerp(handQuatTarget, k);
    }

    // fléchettes qui vibrent après l'impact
    const now = performance.now();
    for (let i = wobbles.length - 1; i >= 0; i -= 1) {
      const w = wobbles[i];
      const s = (now - w.t0) / 1000;
      if (s > 0.9) {
        w.dart.quaternion.copy(w.base);
        wobbles.splice(i, 1);
        continue;
      }
      const angle = w.amp * Math.exp(-s * 6) * Math.sin(s * 42) * w.sign;
      tmpE.set(angle, angle * 0.6, 0);
      w.dart.quaternion.copy(w.base).multiply(tmpQ.setFromEuler(tmpE));
    }

    // étincelles
    if (sparkLife > 0) {
      sparkLife -= dt;
      for (let i = 0; i < SPARKS; i += 1) {
        sparkVel[i * 3 + 1] -= 520 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = Math.max(0, sparkLife / 0.4);
    } else {
      sparkMat.opacity = 0;
    }

    // la cible s'assombrit pendant le vol, puis se rallume
    dim += (dimTarget - dim) * (1 - Math.exp(-dt * 8));
    faceMat.emissiveIntensity = 1 - 0.78 * dim;
    towers.update(dt);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  resize();
  showHand(true);
  window.addEventListener('resize', resize);
  loop();

  function setScores(fractions, burst = true) {
    towers.set(fractions, burst);
  }
  function setBoardDim(on) {
    dimTarget = on ? 1 : 0;
  }
  function boardToScreen(x, y) {
    const v = new THREE.Vector3(x, y, 0).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  return { flyDart, clearDarts, resize, screenToBoard, setAim, setAimActive, showHand, setScores, setBoardDim, boardToScreen };
}

// ---------- Décor ----------

function srgb(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeBeam(color, height, radius) {
  const geo = new THREE.CylinderGeometry(radius * 0.12, radius, height, 32, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(color) } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; varying float vY; void main(){ gl_FragColor = vec4(c, 0.22*pow(1.0-vY, 1.8)); }',
  });
  return new THREE.Mesh(geo, mat);
}

function backdropTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 150, 10, 128, 250, 330);
  grad.addColorStop(0, '#14264f');
  grad.addColorStop(0.5, '#08112b');
  grad.addColorStop(1, '#02040b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  // lignes de scène très discrètes
  g.strokeStyle = 'rgba(80,130,255,0.07)';
  for (let i = 0; i < 12; i += 1) {
    g.beginPath();
    g.moveTo(0, 330 + i * 16);
    g.lineTo(256, 330 + i * 16);
    g.stroke();
  }
  return srgb(new THREE.CanvasTexture(c));
}

function buildArena(scene) {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshBasicMaterial({ map: backdropTexture() }),
  );
  wall.position.set(0, -100, -60);
  scene.add(wall);

  // grand pied noir sous la cible, comme dans l'arène
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(46, 60, 700, 40),
    new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.35, metalness: 0.7 }),
  );
  pillar.position.set(0, -560, -40);
  scene.add(pillar);

  // petits projecteurs bleus de chaque côté de la cible
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x1b3d9a,
    emissive: 0x2a6bff,
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(44, 70, 40), lampMat);
    lamp.position.set(side * 232, 135, -20);
    lamp.rotation.z = side * -0.55;
    scene.add(lamp);
  }

  // faisceaux de lumière
  const beams = new THREE.Group();
  const b1 = makeBeam(0x6fa8ff, 520, 120);
  b1.position.set(0, 20, -50);
  beams.add(b1);
  for (const side of [-1, 1]) {
    const b = makeBeam(0x3a78ff, 360, 70);
    b.position.set(side * 300, -300, -50);
    b.rotation.z = side * 0.06;
    b.scale.y = -1;
    beams.add(b);
  }
  scene.add(beams);
}

function neonBoardTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const k = size / (BOARD_RADIUS * 2);
  const cx = size / 2;
  const cy = size / 2;
  const sector = Math.PI / 10;

  g.fillStyle = '#050816';
  g.fillRect(0, 0, size, size);

  function wedge(rIn, rOut, index, from, to) {
    const a0 = index * sector - sector / 2 - Math.PI / 2;
    const a1 = a0 + sector;
    const grad = g.createRadialGradient(cx, cy, rIn * k, cx, cy, rOut * k);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    g.beginPath();
    g.arc(cx, cy, rOut * k, a0, a1);
    g.arc(cx, cy, rIn * k, a1, a0, true);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
  }

  for (let i = 0; i < 20; i += 1) {
    const dark = i % 2 === 0;
    // secteurs : dégradé violet au centre vers bleu vers le bord
    const [a, b] = dark ? ['#7a22d8', '#16269e'] : ['#35a0ff', '#1646d8'];
    wedge(RADII.outerBull, RADII.trebleIn, i, a, b);
    wedge(RADII.trebleOut, RADII.doubleIn, i, a, b);
    const ring = dark ? '#ff2a55' : '#ffb02e';
    wedge(RADII.trebleIn, RADII.trebleOut, i, ring, ring);
    wedge(RADII.doubleIn, RADII.doubleOut, i, ring, ring);
  }

  g.beginPath();
  g.arc(cx, cy, RADII.outerBull * k, 0, Math.PI * 2);
  g.fillStyle = '#19e6d0';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, RADII.bull * k, 0, Math.PI * 2);
  g.fillStyle = '#ff2a55';
  g.fill();

  // couronne sombre avec cercle et chiffres blancs
  g.strokeStyle = '#eaf2ff';
  g.lineWidth = 1.6 * k;
  g.beginPath();
  g.arc(cx, cy, 196 * k, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#f2f6ff';
  g.font = `600 ${Math.round(17 * k)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 20; i += 1) {
    const a = i * sector - Math.PI / 2;
    g.fillText(String(ORDER[i]), cx + Math.cos(a) * 182 * k, cy + Math.sin(a) * 182 * k);
  }
  return c;
}

function buildBoard(scene) {
  const faceTex = srgb(new THREE.CanvasTexture(neonBoardTexture(2048)));
  faceTex.anisotropy = 4;
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    color: 0x6a6a6a,
    emissive: 0xffffff,
    emissiveMap: faceTex,
    emissiveIntensity: 1,
    roughness: 0.8,
    metalness: 0,
    toneMapped: false,
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(BOARD_RADIUS, 128), faceMat);
  face.receiveShadow = true;
  scene.add(face);

  const bodyGeo = new THREE.CylinderGeometry(BOARD_RADIUS + 22, BOARD_RADIUS + 22, 40, 96);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x080b16, roughness: 0.5 }));
  body.position.z = -20.5;
  scene.add(body);

  const profile = [[197, -6], [199, 3], [203, 8], [212, 11], [220, 8], [223, -6]].map(
    ([r, y]) => new THREE.Vector2(r, y),
  );
  const surroundGeo = new THREE.LatheGeometry(profile, 128);
  surroundGeo.rotateX(Math.PI / 2);
  const surround = new THREE.Mesh(
    surroundGeo,
    new THREE.MeshStandardMaterial({ color: 0x0a0e1c, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
  );
  scene.add(surround);

  // liseré lumineux autour de la cible
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_RADIUS + 3, 1.6, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xcfe0ff, toneMapped: false }),
  );
  glow.position.z = 3;
  scene.add(glow);

  // fils fins et lumineux
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff, toneMapped: false });
  for (const r of [RADII.outerBull, RADII.trebleIn, RADII.trebleOut, RADII.doubleIn, RADII.doubleOut]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 6, 180), wireMat);
    ring.position.z = 0.6;
    scene.add(ring);
  }
  const wireLen = RADII.doubleOut - RADII.outerBull;
  const wireMid = (RADII.doubleOut + RADII.outerBull) / 2;
  const wireGeo = new THREE.BoxGeometry(0.7, wireLen, 1.2);
  for (let i = 0; i < 20; i += 1) {
    const a = i * (Math.PI / 10) - Math.PI / 20;
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(Math.sin(a) * wireMid, Math.cos(a) * wireMid, 0.6);
    wire.rotation.z = -a;
    scene.add(wire);
  }
  return { faceMat };
}

// ---------- Tours de cubes (les scores) ----------

const TOWER = { w: 92, maxH: 240, base: -470, x: 148, cell: 23 };

function cubeTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = hex;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(0, 0, 64, 5);
  g.fillRect(0, 0, 5, 64);
  g.fillStyle = 'rgba(0,0,0,0.38)';
  g.fillRect(0, 59, 64, 5);
  g.fillRect(59, 0, 5, 64);
  const t = srgb(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildTowers(scene) {
  const towers = [];
  const colors = [
    { hex: '#ff2f8f', css: 0xff2f8f },
    { hex: '#2fc4ff', css: 0x2fc4ff },
  ];
  colors.forEach((col, i) => {
    const tex = cubeTexture(col.hex);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TOWER.w, 1, TOWER.w), mat);
    const x = (i === 0 ? -1 : 1) * TOWER.x;
    mesh.position.set(x, TOWER.base, -5);
    scene.add(mesh);
    towers.push({ mesh, tex, x, color: col.css, current: 1, target: 1 });
  });

  // cubes qui volent quand le score baisse
  const cubeGeo = new THREE.BoxGeometry(14, 14, 14);
  const cubes = [];
  for (let i = 0; i < 48; i += 1) {
    const m = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false }));
    m.visible = false;
    scene.add(m);
    cubes.push({ m, vx: 0, vy: 0, vz: 0, life: 0, spin: 0 });
  }
  let nextCube = 0;

  function layout(t) {
    const h = Math.max(2, TOWER.maxH * t.current);
    t.mesh.scale.y = h;
    t.mesh.position.y = TOWER.base + h / 2;
    t.tex.repeat.set(TOWER.w / TOWER.cell, h / TOWER.cell);
  }
  towers.forEach(layout);

  function set(fractions, burst = true) {
    fractions.forEach((f, i) => {
      const t = towers[i];
      const next = Math.min(1, Math.max(0, f));
      if (burst && next < t.target - 0.002) {
        const n = Math.min(14, Math.max(4, Math.round((t.target - next) * 90)));
        const top = TOWER.base + TOWER.maxH * t.current;
        for (let k = 0; k < n; k += 1) {
          const c = cubes[nextCube];
          nextCube = (nextCube + 1) % cubes.length;
          c.m.material.color.setHex(t.color);
          c.m.material.opacity = 1;
          c.m.position.set(t.x + (Math.random() - 0.5) * TOWER.w * 0.8, top, 20 + Math.random() * 20);
          c.vx = (Math.random() - 0.5) * 260;
          c.vy = 120 + Math.random() * 260;
          c.vz = 40 + Math.random() * 120;
          c.spin = (Math.random() - 0.5) * 8;
          c.life = 1;
          c.m.visible = true;
        }
      }
      t.target = next;
      if (!burst) {
        t.current = next;
        layout(t);
      }
    });
  }

  function update(dt) {
    for (const t of towers) {
      if (Math.abs(t.current - t.target) > 0.0005) {
        t.current += (t.target - t.current) * (1 - Math.exp(-dt * 6));
        layout(t);
      }
    }
    for (const c of cubes) {
      if (c.life <= 0) continue;
      c.life -= dt * 0.9;
      c.vy -= 700 * dt;
      c.m.position.x += c.vx * dt;
      c.m.position.y += c.vy * dt;
      c.m.position.z += c.vz * dt;
      c.m.rotation.x += c.spin * dt;
      c.m.rotation.y += c.spin * dt;
      c.m.material.opacity = Math.max(0, c.life);
      if (c.life <= 0) c.m.visible = false;
    }
  }
  return { set, update };
}

// ---------- Fléchette ----------
// La pointe est à l'origine et regarde vers -Z. Pièces partagées entre toutes les fléchettes.

let dartParts = null;

function lathe(points, segments = 20) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

function flightTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#10143a';
  g.fillRect(0, 0, 128, 256);

  const tri = (color, pts) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  tri('#b3123f', [0, 0, 128, 0, 0, 150]);
  tri('#2a6fb8', [128, 40, 128, 150, 30, 256]);
  tri('#d9d6e6', [0, 120, 56, 256, 0, 256]);
  tri('#3a1d7a', [60, 0, 128, 0, 128, 70]);
  tri('#c99a2e', [52, 200, 76, 200, 64, 232]);
  g.strokeStyle = 'rgba(235,235,245,0.7)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 150);
  g.lineTo(128, 40);
  g.moveTo(30, 256);
  g.lineTo(128, 150);
  g.stroke();
  g.fillStyle = '#0e0a1c';
  g.fillRect(0, 0, 10, 256); // bande côté axe
  return srgb(new THREE.CanvasTexture(c));
}

function getDartParts() {
  if (dartParts) return dartParts;

  // pointe : une fine aiguille en acier, presque cylindrique, qui sort du corps
  const tip = lathe([[0.95, -24], [0.95, -4], [0.5, -1.3], [0, 0]], 12);

  // corps (barrel) : nez qui s'effile jusqu'à l'aiguille, puis grip quadrillé
  const bp = [[1.5, -22], [2.0, -26], [2.8, -30], [3.3, -34], [3.5, -38]];
  for (let y = -38; y > -68; y -= 2.4) {
    bp.push([3.5, y], [3.5, y - 0.9], [3.0, y - 1.1], [3.0, y - 1.9]);
  }
  bp.push([3.3, -70], [2.3, -75]);
  bp.reverse(); // y croissant
  const barrel = lathe(bp, 28);

  const shaft = lathe(
    [[2.2, -112], [2.2, -104], [1.8, -103], [1.8, -100], [2.2, -99], [2.2, -90], [1.8, -89], [1.8, -86], [2.2, -85], [2.2, -75]],
    16,
  );

  // un aileron "standard" arrondi : x = distance à l'axe, y = position le long de l'axe
  const shape = new THREE.Shape();
  shape.moveTo(0, -104);
  shape.lineTo(5, -104);
  shape.quadraticCurveTo(19, -110, 21, -128);
  shape.quadraticCurveTo(21, -141, 12, -146);
  shape.lineTo(0, -146);
  shape.closePath();
  const flight = new THREE.ShapeGeometry(shape, 12);
  const pos = flight.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i) / 21;
    uv[i * 2 + 1] = (pos.getY(i) + 146) / 42;
  }
  flight.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  dartParts = {
    tip,
    barrel,
    shaft,
    flight,
    steel: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    tungsten: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 1, roughness: 0.28, side: THREE.DoubleSide }),
    anodized: new THREE.MeshStandardMaterial({ color: 0x16171b, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }),
    flightMat: new THREE.MeshStandardMaterial({
      map: flightTexture(),
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0,
    }),
  };
  return dartParts;
}

function makeDart() {
  const parts = getDartParts();
  const dart = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.x = -Math.PI / 2; // +Y (pointe) -> -Z
  dart.add(inner);

  const meshes = [
    new THREE.Mesh(parts.tip, parts.steel),
    new THREE.Mesh(parts.barrel, parts.tungsten),
    new THREE.Mesh(parts.shaft, parts.anodized),
  ];
  const roll = Math.PI / 4; // quatre ailerons en X, vus de derrière
  for (let i = 0; i < 4; i += 1) {
    const f = new THREE.Mesh(parts.flight, parts.flightMat);
    f.rotation.y = roll + (i * Math.PI) / 2;
    meshes.push(f);
  }
  for (const m of meshes) {
    m.castShadow = true;
    inner.add(m);
  }

  dart.scale.setScalar(DART_SCALE);

  return dart;
}
