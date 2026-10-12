// Scène 3D : mur de pub, cible, fléchettes. Unités : mm.
import * as THREE from 'three';
import { ORDER, RADII } from './board.js';

const BOARD_RADIUS = 200; // cible + couronne des numéros
const FOV = 40;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120d0a);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 5000);

  // lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
  key.position.set(150, 300, 600);
  scene.add(key);

  buildWall(scene);
  buildBoard(scene);

  const darts = [];
  let camDistance = 1000;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;

    // On cadre la cible : toute la largeur en portrait, toute la hauteur en paysage.
    const halfH = Math.max(300, 270 / camera.aspect);
    camDistance = halfH / Math.tan((FOV / 2) * Math.PI / 180);
    // La cible est remontée dans l'écran pour laisser la place au swipe.
    const lookY = -halfH * 0.22;
    camera.position.set(0, lookY, camDistance);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.render(scene, camera);
  }

  // Lance une fléchette vers (hit.x, hit.y). Résolu quand elle est plantée.
  function flyDart(hit) {
    return new Promise((resolve) => {
      const dart = makeDart();
      scene.add(dart);

      const tilt = {
        yaw: (Math.random() - 0.5) * 0.4,
        pitch: 0.14 + Math.random() * 0.14,
      };
      // sur la cible ou sa couronne la pointe s'enfonce de 9 mm, sinon elle finit dans le mur
      const onBoard = Math.hypot(hit.x, hit.y) <= BOARD_RADIUS + 38;
      const end = new THREE.Vector3(hit.x, hit.y, onBoard ? -9 : -28);
      const start = new THREE.Vector3(hit.x * 0.25, end.y - 420, camDistance - 260);
      const arc = 70;
      const duration = 380;
      const t0 = performance.now();

      const posAt = (t) => {
        const p = start.clone().lerp(end, t);
        p.y += arc * 4 * t * (1 - t);
        return p;
      };

      const finalDir = new THREE.Vector3(Math.sin(tilt.yaw), -Math.sin(tilt.pitch), -1).normalize();
      const forward = new THREE.Vector3(0, 0, -1);

      function step(now) {
        const t = Math.min(1, (now - t0) / duration);
        const p = posAt(t);
        dart.position.copy(p);

        const ahead = posAt(Math.min(1, t + 0.02));
        const dir = ahead.sub(p);
        if (dir.lengthSq() > 1e-6) {
          dir.normalize();
          // en fin de course, on se cale sur l'angle de plantage
          dir.lerp(finalDir, t * t).normalize();
          dart.quaternion.setFromUnitVectors(forward, dir);
        }

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          dart.quaternion.setFromUnitVectors(forward, finalDir);
          darts.push(dart);
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  function clearDarts() {
    for (const dart of darts) scene.remove(dart);
    darts.length = 0;
  }

  let running = true;
  function loop() {
    if (!running) return;
    render();
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  loop();

  return { flyDart, clearDarts, resize };
}

function buildWall(scene) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.75);
  grad.addColorStop(0, '#5a3a24');
  grad.addColorStop(0.55, '#34201a');
  grad.addColorStop(1, '#150d0a');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // lattes de bois
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let x = 32; x <= size; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  wall.position.z = -30;
  scene.add(wall);
}

function buildBoard(scene) {
  const tex = new THREE.CanvasTexture(drawBoardTexture(2048));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // couronne en caoutchouc autour de la cible
  const surround = new THREE.Mesh(
    new THREE.RingGeometry(BOARD_RADIUS - 2, BOARD_RADIUS + 38, 96),
    new THREE.MeshBasicMaterial({ color: 0x1a1210 }),
  );
  surround.position.z = -2;
  scene.add(surround);

  const board = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD_RADIUS, 128),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  scene.add(board);
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

  const BLACK = '#161616';
  const CREAM = '#efe3bd';
  const RED = '#c4262e';
  const GREEN = '#1f8a4c';

  // un secteur : de rIn à rOut, centré sur l'angle theta (0 = haut, sens horaire)
  function wedge(rIn, rOut, index, color) {
    // en canvas, 0 rad = droite ; on décale de -90° pour partir du haut
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

  // bull
  g.beginPath();
  g.arc(cx, cy, RADII.outerBull * k, 0, Math.PI * 2);
  g.fillStyle = GREEN;
  g.fill();
  g.beginPath();
  g.arc(cx, cy, RADII.bull * k, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.fill();

  // fils métalliques
  g.strokeStyle = 'rgba(200,200,200,0.55)';
  g.lineWidth = Math.max(1, 0.7 * k);
  for (const r of [RADII.bull, RADII.outerBull, RADII.trebleIn, RADII.trebleOut, RADII.doubleIn, RADII.doubleOut]) {
    g.beginPath();
    g.arc(cx, cy, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 20; i += 1) {
    const a = i * sector - sector / 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * RADII.outerBull * k, cy + Math.sin(a) * RADII.outerBull * k);
    g.lineTo(cx + Math.cos(a) * RADII.doubleOut * k, cy + Math.sin(a) * RADII.doubleOut * k);
    g.stroke();
  }

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

// Fléchette : la pointe est à l'origine et regarde vers -Z.
function makeDart() {
  const dart = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.x = -Math.PI / 2; // +Y (pointe) -> -Z
  dart.add(inner);

  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb8892b, metalness: 0.8, roughness: 0.35 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.2, roughness: 0.6 });
  const flightMat = new THREE.MeshBasicMaterial({ color: 0xd9352b, side: THREE.DoubleSide });

  // le cône pointe vers +Y : centré en y = -14, sa pointe est donc en y = 0
  const tip = new THREE.Mesh(new THREE.ConeGeometry(2.4, 28, 12), metal);
  tip.position.y = -14;
  inner.add(tip);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 46, 16), barrelMat);
  barrel.position.y = -28 - 23;
  inner.add(barrel);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 38, 12), shaftMat);
  shaft.position.y = -74 - 19;
  inner.add(shaft);

  const shape = new THREE.Shape();
  shape.moveTo(0, -106);
  shape.lineTo(13, -114);
  shape.lineTo(17, -140);
  shape.lineTo(0, -142);
  shape.lineTo(-17, -140);
  shape.lineTo(-13, -114);
  shape.closePath();
  const flightGeo = new THREE.ShapeGeometry(shape);
  const flightA = new THREE.Mesh(flightGeo, flightMat);
  const flightB = new THREE.Mesh(flightGeo, flightMat);
  const roll = Math.random() * Math.PI; // chaque fléchette tourne un peu sur elle-même
  flightA.rotation.y = roll;
  flightB.rotation.y = roll + Math.PI / 2;
  inner.add(flightA, flightB);

  dart.scale.setScalar(1.7);
  return dart;
}
