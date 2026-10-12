// Scène 3D : pub en brique, cible avec fils et relief, fléchettes métalliques. Unités : mm.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ORDER, RADII } from './board.js';

const BOARD_RADIUS = 200; // cible + couronne des numéros
const FOV = 40;
const DART_SCALE = 1.4;
const HAND_SCALE = 0.7; // la fléchette tenue est plus petite pour ne pas écraser la cible
const HAND_DEPTH = 430; // distance caméra -> pointe de la fléchette tenue
const HAND_TILT = 0.6; // la fléchette tenue est relevée d'environ 50° : on la voit en long, comme dans Darts of Fury
const LAMP_POS = new THREE.Vector3(0, 415, 150);

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0605);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);

  // Lumière : l'ampoule de la lampe au-dessus de la cible, plus un peu d'ambiance
  const spot = new THREE.SpotLight(0xffe2b0, 9, 0, 0.95, 1, 0);
  spot.position.copy(LAMP_POS);
  spot.target.position.set(0, -30, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 40;
  spot.shadow.camera.far = 1600;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.6;
  spot.shadow.radius = 3;
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1b0f0a, 0.35));

  buildWall(scene);
  buildLamp(scene);
  buildBoard(scene);

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

      const arc = 35; // cloche légère
      const duration = 480;
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

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  resize();
  showHand(true);
  window.addEventListener('resize', resize);
  loop();

  return { flyDart, clearDarts, resize, screenToBoard, setAim, setAimActive, showHand };
}

// ---------- Décor ----------

function srgb(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function brickTextures() {
  const W = 512;
  const H = 512;
  const rows = 8;
  const cols = 3;
  const bw = W / cols;
  const bh = H / rows;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = W;
  color.height = bump.height = H;
  const c = color.getContext('2d');
  const b = bump.getContext('2d');
  c.fillStyle = '#2b1b15'; // joints
  c.fillRect(0, 0, W, H);
  b.fillStyle = '#000';
  b.fillRect(0, 0, W, H);

  for (let r = 0; r < rows; r += 1) {
    const offset = r % 2 ? bw / 2 : 0;
    for (let col = -1; col <= cols; col += 1) {
      const x = col * bw + offset;
      const y = r * bh;
      const hue = 10 + Math.random() * 12;
      const sat = 32 + Math.random() * 18;
      const light = 24 + Math.random() * 12;
      c.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      b.fillStyle = `hsl(0 0% ${60 + Math.random() * 30}%)`;
      b.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }
  for (let i = 0; i < 500; i += 1) {
    c.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
    c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 4);
  }
  return { color, bump };
}

function buildWall(scene) {
  const { color, bump } = brickTextures();
  const map = srgb(new THREE.CanvasTexture(color));
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const tex of [map, bumpMap]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
  }
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 3200),
    new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 3, roughness: 0.95, metalness: 0 }),
  );
  wall.position.z = -42;
  wall.receiveShadow = true;
  scene.add(wall);

  // fond en bois derrière la cible, comme un caisson
  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(470, 470, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a2517, roughness: 0.75 }),
  );
  backboard.position.set(0, 0, -30);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  scene.add(backboard);
}

function buildLamp(scene) {
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7a35, metalness: 1, roughness: 0.35 });
  const enamel = new THREE.MeshStandardMaterial({
    color: 0x1f5a45,
    metalness: 0.3,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  // bras fixé au mur
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, LAMP_POS.z + 42, 12), brass);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, LAMP_POS.y + 12, (LAMP_POS.z - 42) / 2);
  scene.add(arm);

  // abat-jour
  const profile = [[6, 16], [10, 12], [38, -4], [70, -34], [73, -38], [70, -38]].map(
    ([r, y]) => new THREE.Vector2(r, y),
  );
  const shade = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), enamel);
  shade.position.copy(LAMP_POS);
  scene.add(shade);

  // ampoule
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(13, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
  );
  bulb.position.set(LAMP_POS.x, LAMP_POS.y - 18, LAMP_POS.z);
  scene.add(bulb);
}

function sisalBump(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i += 1) {
    const v = 90 + Math.random() * 110;
    g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    g.lineWidth = 1 + Math.random() * 1.5;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    g.stroke();
  }
  return c;
}

function buildBoard(scene) {
  const faceTex = srgb(new THREE.CanvasTexture(drawBoardTexture(2048)));
  const bumpMap = new THREE.CanvasTexture(sisalBump(1024));

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD_RADIUS, 128),
    new THREE.MeshStandardMaterial({ map: faceTex, bumpMap, bumpScale: 1.6, roughness: 0.92, metalness: 0 }),
  );
  face.receiveShadow = true;
  scene.add(face);

  // épaisseur de la cible
  const bodyGeo = new THREE.CylinderGeometry(BOARD_RADIUS, BOARD_RADIUS, 40, 96);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x20140e, roughness: 0.9 }));
  body.position.z = -20.5;
  scene.add(body);

  // couronne en caoutchouc, avec un vrai profil en relief
  const profile = [[197, -6], [199, 3], [203, 10], [212, 14], [220, 9], [223, -6]].map(
    ([r, y]) => new THREE.Vector2(r, y),
  );
  const surroundGeo = new THREE.LatheGeometry(profile, 128);
  surroundGeo.rotateX(Math.PI / 2);
  const surround = new THREE.Mesh(
    surroundGeo,
    new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.65, metalness: 0.05, side: THREE.DoubleSide }),
  );
  surround.castShadow = true;
  surround.receiveShadow = true;
  scene.add(surround);

  // fils métalliques en relief
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.28 });
  for (const r of [RADII.outerBull, RADII.trebleIn, RADII.trebleOut, RADII.doubleIn, RADII.doubleOut]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.5, 6, 180), wireMat);
    ring.position.z = 0.7;
    ring.castShadow = true;
    scene.add(ring);
  }
  const wireLen = RADII.doubleOut - RADII.outerBull;
  const wireMid = (RADII.doubleOut + RADII.outerBull) / 2;
  const wireGeo = new THREE.BoxGeometry(0.8, wireLen, 1.4);
  for (let i = 0; i < 20; i += 1) {
    const a = i * (Math.PI / 10) - Math.PI / 20;
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(Math.sin(a) * wireMid, Math.cos(a) * wireMid, 0.7);
    wire.rotation.z = -a;
    wire.castShadow = true;
    scene.add(wire);
  }
  const bullRing = new THREE.Mesh(new THREE.TorusGeometry(RADII.bull, 0.5, 6, 48), wireMat);
  bullRing.position.z = 0.7;
  scene.add(bullRing);
}

// Dessine la cible dans un canvas carré qui couvre [-200 ; 200] mm.
function drawBoardTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const k = size / (BOARD_RADIUS * 2); // px par mm
  const cx = size / 2;
  const cy = size / 2;
  const sector = Math.PI / 10;

  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, size, size);

  const BLACK = '#171513';
  const CREAM = '#e9dcb4';
  const RED = '#b8242b';
  const GREEN = '#1d7f49';

  // un secteur : de rIn à rOut, centré sur l'angle theta (0 = haut, sens horaire)
  function wedge(rIn, rOut, index, color) {
    const a0 = index * sector - sector / 2 - Math.PI / 2;
    const a1 = a0 + sector;
    g.beginPath();
    g.arc(cx, cy, rOut * k, a0, a1);
    g.arc(cx, cy, rIn * k, a1, a0, true);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  for (let i = 0; i < 20; i += 1) {
    const dark = i % 2 === 0;
    const single = dark ? BLACK : CREAM;
    const ring = dark ? RED : GREEN;
    wedge(RADII.outerBull, RADII.trebleIn, i, single);
    wedge(RADII.trebleIn, RADII.trebleOut, i, ring);
    wedge(RADII.trebleOut, RADII.doubleIn, i, single);
    wedge(RADII.doubleIn, RADII.doubleOut, i, ring);
  }

  g.beginPath();
  g.arc(cx, cy, RADII.outerBull * k, 0, Math.PI * 2);
  g.fillStyle = GREEN;
  g.fill();
  g.beginPath();
  g.arc(cx, cy, RADII.bull * k, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.fill();

  // numéros
  g.fillStyle = '#f4f4f4';
  g.font = `bold ${Math.round(17 * k)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 20; i += 1) {
    const a = i * sector - Math.PI / 2;
    const r = 185 * k;
    g.fillText(String(ORDER[i]), cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }

  return c;
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
  g.fillStyle = '#2b1163';
  g.fillRect(0, 0, 128, 256);

  const tri = (color, pts) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  tri('#e0307c', [0, 0, 128, 0, 0, 150]);
  tri('#2fd0e8', [128, 40, 128, 150, 30, 256]);
  tri('#f4f1ff', [0, 120, 56, 256, 0, 256]);
  tri('#7a2fd0', [60, 0, 128, 0, 128, 70]);
  tri('#ffc233', [52, 200, 76, 200, 64, 232]);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
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
