import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as CANNON from './lib/cannon-es.js';

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */
const RUTA_PERSONAJE = './models/personaje.fbx';            // personaje con skin (Idle)
const RUTA_ANIM = {                                          // animaciones "sin skin" (Mixamo, in place)
	walk: './models/caminar.fbx',
	run: './models/correr.fbx',
	jump: './models/saltar.fbx'
};
const RUTA_BAILE = '../examples/models/fbx/breakdance.fbx';  // reutilizado de la práctica 3.4 (se carga al pulsar B)
const RUTA_HDR = '../examples/models/rgbe/canary_wharf_2k.hdr';   // ambiente 360° HDR
const RUTA_PISO = '../examples/textures/piso.jpg';                // textura del piso (concreto)
const RUTA_MUSICA = '../examples/models/rgbe/musica.mp3';

const MITAD_ARENA = 15;          // la arena mide 30 x 30 m
const ALTURA_PERSONAJE = 1.8;    // m
const VEL_CAMINAR = 1.6;
const VEL_CORRER = 4.2;
const VEL_GIRO = 6;              // rad/s (giro suave hacia el objetivo de 90°)
const FUERZA_SALTO = 5.2;          // impulso del salto (≈ 1.4 m de altura)
const ROTACION_MODELO = 0;       // si el personaje se ve de espaldas, cambiar a Math.PI

const REV = parseInt(THREE.REVISION, 10);
const LUZ_MODERNA = REV >= 155;  // desde r155 las luces usan unidades físicas

const $ = (id) => document.getElementById(id);
const contenedor = $('app');
const estadoTxt = $('estado');
const accionTxt = $('accion');
const mensajes = [];
function aviso(t) { mensajes.push(t); if (mensajes.length > 3) mensajes.shift(); estadoTxt.innerHTML = mensajes.join('<br>'); }

/* =========================================================
   ESCENA, CÁMARA, RENDER
   ========================================================= */
const scene = new THREE.Scene();
// Niebla gris clara: los objetos lejanos se desvanecen hacia el gris
const COLOR_NIEBLA = 0xcfd3d8;
scene.fog = new THREE.Fog(COLOR_NIEBLA, 10, 62);   // empieza a 10 m de la cámara y es total a 62 m

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
camera.position.set(0, 5.5, -19.5);      // vista general de la arena (cámara fija)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
contenedor.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 48;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.target.set(0, 1.0, 0);

function ajustarTamano() {
	const w = contenedor.clientWidth, h = contenedor.clientHeight;
	renderer.setSize(w, h);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustarTamano);
ajustarTamano();

/* =========================================================
   AMBIENTE 360° HDR  (coherente con el piso de concreto urbano)
   ========================================================= */
new RGBELoader().load(RUTA_HDR, (tex) => {
	tex.mapping = THREE.EquirectangularReflectionMapping;
	scene.background = tex;
	scene.environment = tex;
	aviso('HDR 360° cargado');
}, undefined, () => {
	scene.background = new THREE.Color(0x9aa4b0);
	aviso('⚠ No se encontró el HDR (' + RUTA_HDR + ')');
});

/* =========================================================
   ILUMINACIÓN: sol (direccional) + 2 postes de luz (puntuales)
   ========================================================= */
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4036, LUZ_MODERNA ? 0.8 : 0.5));

const sol = new THREE.DirectionalLight(0xffd7a8, LUZ_MODERNA ? 2.6 : 1.1);
sol.position.set(14, 20, 9);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
sol.shadow.camera.left = -22; sol.shadow.camera.right = 22;
sol.shadow.camera.top = 22; sol.shadow.camera.bottom = -22;
sol.shadow.camera.near = 1; sol.shadow.camera.far = 70;
sol.shadow.bias = -0.0004;
scene.add(sol);

function crearPoste(x, z) {
	const g = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.7 });
	const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.4, 12), mat);
	mastil.position.y = 2.2; mastil.castShadow = true;
	const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), mat);
	brazo.position.set(0.4, 4.4, 0);
	const foco = new THREE.Mesh(
		new THREE.SphereGeometry(0.22, 16, 12),
		new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffc97a, emissiveIntensity: 2.2 })
	);
	foco.position.set(0.85, 4.32, 0);
	const luz = new THREE.PointLight(0xffc97a, LUZ_MODERNA ? 90 : 1.4, 22, 2);
	luz.position.set(0.85, 4.2, 0);
	luz.castShadow = false;
	g.add(mastil, brazo, foco, luz);
	g.position.set(x, 0, z);
	g.lookAt(0, 0, 0);
	g.rotateY(-Math.PI / 2);      // el brazo apunta hacia el centro
	scene.add(g);
}
crearPoste(-12.5, -12.5);
crearPoste(12.5, 12.5);

/* =========================================================
   TEXTURAS GENERADAS (caja de madera y balón) y PISO
   ========================================================= */
function texturaCaja() {
	const c = document.createElement('canvas'); c.width = c.height = 256;
	const g = c.getContext('2d');
	g.fillStyle = '#a8742f'; g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 8; i++) {                                  // tablones
		g.fillStyle = i % 2 ? '#b98338' : '#9a6a28';
		g.fillRect(0, i * 32 + 2, 256, 28);
		g.strokeStyle = 'rgba(60,35,10,.45)'; g.lineWidth = 1;
		for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, i * 32 + 6 + k * 6); g.lineTo(256, i * 32 + 8 + k * 6); g.stroke(); }
	}
	g.strokeStyle = '#4a2c0c'; g.lineWidth = 16; g.strokeRect(8, 8, 240, 240);   // marco
	g.lineWidth = 10; g.beginPath(); g.moveTo(14, 14); g.lineTo(242, 242); g.moveTo(242, 14); g.lineTo(14, 242); g.stroke();
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaBalon() {
	const c = document.createElement('canvas'); c.width = 256; c.height = 128;
	const g = c.getContext('2d');
	for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
		g.fillStyle = (x + y) % 2 ? '#f4f4f4' : '#d62828';
		g.fillRect(x * 16, y * 16, 16, 16);
	}
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const texCaja = texturaCaja();
const texBalon = texturaBalon();

const texPiso = new THREE.TextureLoader().load(RUTA_PISO);
texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
texPiso.repeat.set(26, 26);
texPiso.colorSpace = THREE.SRGBColorSpace;
texPiso.anisotropy = renderer.capabilities.getMaxAnisotropy();

const piso = new THREE.Mesh(
	new THREE.PlaneGeometry(130, 130),
	new THREE.MeshStandardMaterial({ map: texPiso, roughness: 0.85, metalness: 0.05 })
);
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
scene.add(piso);

/* =========================================================
   FÍSICA (cannon-es)
   ========================================================= */
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = false;
world.defaultContactMaterial.friction = 0.4;

const matSuelo = new CANNON.Material('suelo');
const matObjeto = new CANNON.Material('objeto');
const matBalon = new CANNON.Material('balon');
const matPersonaje = new CANNON.Material('personaje');
world.addContactMaterial(new CANNON.ContactMaterial(matPersonaje, matSuelo, { friction: 0.0, restitution: 0 }));
// Sin fricción con muros y objetos: el personaje se mueve por velocidad y así no se "pega" a las paredes al saltar
world.addContactMaterial(new CANNON.ContactMaterial(matPersonaje, matObjeto, { friction: 0.0, restitution: 0 }));
world.addContactMaterial(new CANNON.ContactMaterial(matPersonaje, matBalon, { friction: 0.0, restitution: 0.3 }));
world.addContactMaterial(new CANNON.ContactMaterial(matObjeto, matSuelo, { friction: 0.5, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(matBalon, matSuelo, { friction: 0.25, restitution: 0.7 }));
world.addContactMaterial(new CANNON.ContactMaterial(matObjeto, matObjeto, { friction: 0.4, restitution: 0.05 }));

// Suelo: una caja enorme cuya cara superior está en y = 0
// (con un Plane de cannon-es el rayo para detectar el suelo falla en algunas posiciones)
const cuerpoSuelo = new CANNON.Body({ mass: 0, material: matSuelo,
	shape: new CANNON.Box(new CANNON.Vec3(200, 0.5, 200)) });
cuerpoSuelo.position.set(0, -0.5, 0);
world.addBody(cuerpoSuelo);

const dinamicos = [];     // objetos con dinámica física (se pueden empujar)
const moviles = [];       // objetos con movimiento programado (cinemáticos)

function sincronizar(par) {
	const p = par.body.position, q = par.body.quaternion;
	par.mesh.position.set(p.x, p.y, p.z);
	par.mesh.quaternion.set(q.x, q.y, q.z, q.w);
}

const texConcreto = new THREE.TextureLoader().load(RUTA_PISO);
texConcreto.wrapS = texConcreto.wrapT = THREE.RepeatWrapping;
texConcreto.repeat.set(1, 1);
texConcreto.colorSpace = THREE.SRGBColorSpace;
const matConcreto = new THREE.MeshStandardMaterial({ map: texConcreto, color: 0xb9b9b9, roughness: 0.9 });

function cajaEstatica(ancho, alto, largo, x, y, z, material = matConcreto, rotY = 0) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo), material);
	mesh.castShadow = mesh.receiveShadow = true;
	scene.add(mesh);
	const body = new CANNON.Body({ mass: 0, material: matObjeto,
		shape: new CANNON.Box(new CANNON.Vec3(ancho / 2, alto / 2, largo / 2)) });
	body.position.set(x, y, z);
	body.quaternion.setFromEuler(0, rotY, 0);
	world.addBody(body);
	mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion);
	return mesh;
}

// ---- Fronteras del escenario: muros perimetrales (el personaje no puede salir)
const matMuro = new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: 0.8, metalness: 0.1 });
const E = MITAD_ARENA, G = 0.6, A = 1.6;
cajaEstatica(2 * E + G, A, G, 0, A / 2, E + G / 2, matMuro);
cajaEstatica(2 * E + G, A, G, 0, A / 2, -E - G / 2, matMuro);
cajaEstatica(G, A, 2 * E + G, E + G / 2, A / 2, 0, matMuro);
cajaEstatica(G, A, 2 * E + G, -E - G / 2, A / 2, 0, matMuro);
// franjas naranjas de advertencia sobre los muros
const matFranja = new THREE.MeshStandardMaterial({ color: 0xff9f43, emissive: 0x7a3d00, emissiveIntensity: 0.6, roughness: 0.6 });
[[2 * E, 0.12, 0.05, 0, A + 0.03, E - 0.28], [2 * E, 0.12, 0.05, 0, A + 0.03, -E + 0.28],
 [0.05, 0.12, 2 * E, E - 0.28, A + 0.03, 0], [0.05, 0.12, 2 * E, -E + 0.28, A + 0.03, 0]].forEach(([w, h, l, x, y, z]) => {
	const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), matFranja);
	m.position.set(x, y, z); scene.add(m);
});

// ---- Obstáculos estáticos (laberinto / pilares / escalones)
cajaEstatica(1.2, 3, 1.2, -10, 1.5, -8);
cajaEstatica(1.2, 3, 1.2, 10, 1.5, 8);
cajaEstatica(8, 1.4, 0.5, 0, 0.7, 10);
cajaEstatica(0.5, 1.4, 6, -4, 0.7, 12);
cajaEstatica(0.5, 1.4, 5, 5, 0.7, 12.5);
cajaEstatica(3, 0.35, 1.8, 11, 0.175, -3);     // escalones
cajaEstatica(3, 0.7, 1.8, 11, 0.35, -4.8);
cajaEstatica(3, 1.05, 1.8, 11, 0.525, -6.6);

// ---- Objetos dinámicos (se empujan, ruedan y chocan)
function cajaDinamica(lado, x, y, z, masa) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(lado, lado, lado),
		new THREE.MeshStandardMaterial({ map: texCaja, roughness: 0.8 }));
	mesh.castShadow = mesh.receiveShadow = true;
	scene.add(mesh);
	const body = new CANNON.Body({ mass: masa, material: matObjeto, linearDamping: 0.15, angularDamping: 0.3,
		shape: new CANNON.Box(new CANNON.Vec3(lado / 2, lado / 2, lado / 2)) });
	body.position.set(x, y, z);
	world.addBody(body);
	dinamicos.push({ mesh, body, inicio: new CANNON.Vec3(x, y, z) });
}
function esferaDinamica(radio, x, y, z, masa, mesh, material) {
	mesh.castShadow = mesh.receiveShadow = true;
	scene.add(mesh);
	const body = new CANNON.Body({ mass: masa, material, linearDamping: 0.12, angularDamping: 0.15,
		shape: new CANNON.Sphere(radio) });
	body.position.set(x, y, z);
	world.addBody(body);
	dinamicos.push({ mesh, body, inicio: new CANNON.Vec3(x, y, z) });
}
function tablonDinamico(x, y, z) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.6),
		new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.4, metalness: 0.3 }));
	mesh.castShadow = mesh.receiveShadow = true;
	scene.add(mesh);
	const body = new CANNON.Body({ mass: 10, material: matObjeto, linearDamping: 0.2, angularDamping: 0.4,
		shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.25, 0.3)) });
	body.position.set(x, y, z);
	world.addBody(body);
	dinamicos.push({ mesh, body, inicio: new CANNON.Vec3(x, y, z) });
}

// 3 cajas (en pirámide)
cajaDinamica(0.8, 3, 0.4, 3, 6);
cajaDinamica(0.8, 3.9, 0.4, 3.2, 6);
cajaDinamica(0.8, 3.45, 1.2, 3.1, 6);
// 2 piedras
esferaDinamica(0.6, -4, 0.6, 4,
	14, new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 0.95, flatShading: true })), matObjeto);
esferaDinamica(0.5, -6, 0.5, -3,
	10, new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x5f5b56, roughness: 0.95, flatShading: true })), matObjeto);
// 2 balones (rebotan)
esferaDinamica(0.4, 5, 0.4, -4,
	0.6, new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.4 })), matBalon);
esferaDinamica(0.4, 2, 0.4, -6,
	0.6, new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.4 })), matBalon);
// 1 tablón / banca
tablonDinamico(-8, 0.25, 8);

// ---- Objetos con movimiento programado (cinemáticos)
// 1) Barredora giratoria
{
	// 4 m de largo y a 6.5 m del muro del fondo: su punta nunca toca el muro (no puede aplastar al personaje contra él)
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 0.5),
		new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.4, metalness: 0.4 }));
	mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
	const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: matObjeto,
		shape: new CANNON.Box(new CANNON.Vec3(2, 0.25, 0.25)) });
	body.position.set(2, 0.45, 6.5);
	body.angularVelocity.set(0, 1.1, 0);
	world.addBody(body);
	const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), matMuro);
	eje.position.set(2, 0.45, 6.5); eje.castShadow = true; scene.add(eje);
	moviles.push({ mesh, body, tipo: 'giro' });
}
// 2) Muro corredizo (va y viene)
{
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 4),
		new THREE.MeshStandardMaterial({ color: 0xff9f43, roughness: 0.5, metalness: 0.2 }));
	mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
	const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: matObjeto,
		shape: new CANNON.Box(new CANNON.Vec3(0.75, 0.8, 2)) });
	body.position.set(-9, 0.8, 0);
	world.addBody(body);
	moviles.push({ mesh, body, tipo: 'vaiven', x0: -9, amp: 3.5, w: 0.7 });
}

/* =========================================================
   PERSONAJE
   ========================================================= */
const personaje = new THREE.Group();     // se sincroniza con el cuerpo físico
scene.add(personaje);

const MEDIA_ALTURA = ALTURA_PERSONAJE / 2;
const cuerpoPj = new CANNON.Body({
	mass: 60, material: matPersonaje, fixedRotation: true, linearDamping: 0.0,
	shape: new CANNON.Box(new CANNON.Vec3(0.35, MEDIA_ALTURA, 0.3)),
	collisionFilterGroup: 2, collisionFilterMask: 1
});
cuerpoPj.position.set(0, MEDIA_ALTURA + 0.05, -10);
world.addBody(cuerpoPj);

let yaw = 0, yawObjetivo = 0;
let mixer = null;
const acciones = {};
let accionActual = null;
let modeloListo = false;

const NOMBRES = { idle: 'Quieto', walk: 'Caminar', run: 'Correr', jump: 'Saltar', dance: 'Bailar' };

function prepararClip(clip, nombre) {
	clip.name = nombre;
	// Evitar que la animación desplace el hueso raíz: el movimiento lo hace el motor físico
	clip.tracks.forEach((tr) => {
		if (/Hips\.position$/.test(tr.name)) {
			const v = tr.values;
			for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
		}
	});
	return clip;
}

function crearAccion(nombre, clip, opciones = {}) {
	const a = mixer.clipAction(prepararClip(clip, nombre));
	if (opciones.una_vez) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
	acciones[nombre] = a;
}

function fijarAccion(nombre) {
	if (!mixer || accionActual === nombre || !acciones[nombre]) return;
	const prev = acciones[accionActual];
	const sig = acciones[nombre];
	sig.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
	if (prev) prev.fadeOut(0.2);
	accionActual = nombre;
	accionTxt.textContent = NOMBRES[nombre];
}

function personajeProvisional() {
	const g = new THREE.Group();
	const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 12),
		new THREE.MeshStandardMaterial({ color: 0xffb27a }));
	m.position.y = 0.9; m.castShadow = true;
	const nariz = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
	nariz.position.set(0, 1.5, 0.3);
	g.add(m, nariz);
	return g;
}

async function cargarPersonaje() {
	const loader = new FBXLoader();
	let fbx;
	try {
		fbx = await loader.loadAsync(RUTA_PERSONAJE);
	} catch (e) {
		console.error(e);
		aviso('⚠ No se pudo cargar ' + RUTA_PERSONAJE + ' (se muestra un personaje provisional)');
		const prov = personajeProvisional();
		prov.position.y = -MEDIA_ALTURA;
		personaje.add(prov);
		return;
	}

	// Escalar el modelo a ~1.8 m y apoyar los pies en y = 0
	const caja = new THREE.Box3().setFromObject(fbx);
	const alto = caja.max.y - caja.min.y;
	const esc = ALTURA_PERSONAJE / alto;
	fbx.scale.multiplyScalar(esc);
	fbx.updateMatrixWorld(true);
	const caja2 = new THREE.Box3().setFromObject(fbx);
	fbx.position.y -= caja2.min.y;

	fbx.traverse((o) => {
		if (o.isMesh || o.isSkinnedMesh) {
			o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
		}
	});

	const holder = new THREE.Group();
	holder.rotation.y = ROTACION_MODELO;
	holder.add(fbx);
	holder.position.y = -MEDIA_ALTURA;
	personaje.add(holder);

	mixer = new THREE.AnimationMixer(fbx);
	if (fbx.animations.length) crearAccion('idle', fbx.animations[0]);
	else aviso('⚠ personaje.fbx no trae animación Idle');

	const nombres = Object.keys(RUTA_ANIM);   // caminar, correr, saltar
	const res = await Promise.allSettled(nombres.map((n) => loader.loadAsync(RUTA_ANIM[n])));
	res.forEach((r, i) => {
		const n = nombres[i];
		if (r.status === 'fulfilled' && r.value.animations.length) {
			crearAccion(n, r.value.animations[0], { una_vez: n === 'jump' });
		} else {
			console.warn('Animación no disponible:', n, r.reason || '');
			aviso('⚠ Falta la animación: ' + n + ' (' + RUTA_ANIM[n] + ')');
		}
	});

	modeloListo = true;
	fijarAccion('idle');
	aviso('Personaje listo · usa W, Shift, Espacio, Q, E, B');
}

/* =========================================================
   TECLADO
   ========================================================= */
const teclas = new Set();
let bailando = false;
let saltando = false;
let tSalto = 0;

window.addEventListener('keydown', (e) => {
	if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
	if (e.repeat) return;
	teclas.add(e.code);
	switch (e.code) {
		case 'KeyQ': yawObjetivo += Math.PI / 2; break;     // giro de 90° a la izquierda
		case 'KeyE': yawObjetivo -= Math.PI / 2; break;     // giro de 90° a la derecha
		case 'Space': intentarSalto(); break;
		case 'KeyB': alternarBaile(); break;
		case 'KeyC': alternarCamara(); break;
		case 'KeyR': reiniciarObjetos(); break;
		case 'KeyM': alternarMusica(); break;
	}
});
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

const avanza = () => teclas.has('KeyW') || teclas.has('ArrowUp');
const corre = () => teclas.has('ShiftLeft') || teclas.has('ShiftRight');

const origen = new CANNON.Vec3(), destino = new CANNON.Vec3();
const resultadoRayo = new CANNON.RaycastResult();
function enSuelo() {
	origen.copy(cuerpoPj.position);
	destino.set(origen.x, origen.y - MEDIA_ALTURA - 0.12, origen.z);
	resultadoRayo.reset();
	world.raycastClosest(origen, destino, { collisionFilterMask: 1, skipBackfaces: true }, resultadoRayo);
	return resultadoRayo.hasHit;
}

function intentarSalto() {
	if (saltando || !enSuelo()) return;
	saltando = true; tSalto = 0; bailando = false;
	cuerpoPj.velocity.y = FUERZA_SALTO;
}

// El baile (breakdance de la práctica 3.4) se carga la primera vez que se pulsa B
let cargandoBaile = false;
async function alternarBaile() {
	if (!modeloListo) return;
	if (!acciones.dance) {
		if (cargandoBaile) return;
		cargandoBaile = true; aviso('Cargando baile…');
		try {
			const fbx = await new FBXLoader().loadAsync(RUTA_BAILE);
			crearAccion('dance', fbx.animations[0]);
			aviso('Baile listo');
			bailando = true;
		} catch (e) {
			console.error(e); aviso('⚠ No se pudo cargar el baile (' + RUTA_BAILE + ')');
		}
		cargandoBaile = false;
		return;
	}
	bailando = !bailando;
}

// Cámara: fija (vista general, la niebla se nota al alejarse) o siguiendo al personaje
let seguirCamara = false;
let transicionCam = 0;                       // segundos de transición suave al cambiar de modo
function alternarCamara() {
	seguirCamara = !seguirCamara;
	$('camara').textContent = seguirCamara ? 'sigue al personaje' : 'fija';
	transicionCam = 1.8;
}

function reiniciarObjetos() {
	dinamicos.forEach((d) => {
		d.body.position.copy(d.inicio);
		d.body.velocity.setZero(); d.body.angularVelocity.setZero();
		d.body.quaternion.set(0, 0, 0, 1);
	});
}

/* =========================================================
   MÚSICA (opcional): se activa con M o al primer clic
   ========================================================= */
let sonido = null;
function alternarMusica() {
	try {
		if (!sonido) {
			const escucha = new THREE.AudioListener();
			camera.add(escucha);
			sonido = new THREE.Audio(escucha);
			new THREE.AudioLoader().load(RUTA_MUSICA, (buf) => {
				sonido.setBuffer(buf); sonido.setLoop(true); sonido.setVolume(0.4); sonido.play();
			}, undefined, () => aviso('Sin música (no se encontró el mp3)'));
			return;
		}
		if (sonido.isPlaying) sonido.pause(); else if (sonido.buffer) sonido.play();
	} catch (err) { console.warn(err); }
}

/* =========================================================
   BUCLE PRINCIPAL
   ========================================================= */
const reloj = new THREE.Clock();
let tiempo = 0;
const ARRIBA = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const objetivoCam = new THREE.Vector3();
const desdeCam = new THREE.Vector3();
const VISTA_GENERAL_POS = new THREE.Vector3(0, 5.5, -19.5), VISTA_GENERAL_TGT = new THREE.Vector3(0, 1.0, 0);
const DIST_SIGUE = 7, ALT_SIGUE = 3.2;       // cámara "sigue": 7 m detrás del personaje y 3.2 m por encima de su torso

let pausaManual = false;                         // solo para pruebas: ver window.__escena.paso()
function animar() {
	requestAnimationFrame(animar);
	const dt = Math.min(reloj.getDelta(), 0.05);
	if (!pausaManual) actualizar(dt);
	renderer.render(scene, camera);
}

function actualizar(dt) {
	tiempo += dt;

	// --- giro suave hacia el objetivo (múltiplos de 90°)
	const antes = yaw;
	const dif = yawObjetivo - yaw;
	if (Math.abs(dif) > 1e-4) yaw += Math.sign(dif) * Math.min(Math.abs(dif), VEL_GIRO * dt);
	else yaw = yawObjetivo;
	const dYaw = yaw - antes;

	// --- movimiento del personaje (controlado por teclado)
	if (avanza()) bailando = false;
	const vel = avanza() ? (corre() ? VEL_CORRER : VEL_CAMINAR) : 0;
	cuerpoPj.velocity.x = Math.sin(yaw) * vel;
	cuerpoPj.velocity.z = Math.cos(yaw) * vel;

	// --- movimiento programado de los objetos cinemáticos
	moviles.forEach((m) => {
		if (m.tipo === 'vaiven') {
			m.body.position.x = m.x0 + m.amp * Math.sin(m.w * tiempo);
			m.body.velocity.set(m.amp * m.w * Math.cos(m.w * tiempo), 0, 0);
		}
	});

	world.step(1 / 60, dt, 4);

	// --- límites de seguridad de la arena
	const L = MITAD_ARENA - 0.5;
	cuerpoPj.position.x = Math.max(-L, Math.min(L, cuerpoPj.position.x));
	cuerpoPj.position.z = Math.max(-L, Math.min(L, cuerpoPj.position.z));

	// --- salto: termina al volver al suelo
	if (saltando) {
		tSalto += dt;
		if (tSalto > 0.35 && enSuelo()) saltando = false;
	}

	// --- sincronizar mallas con la física
	personaje.position.set(cuerpoPj.position.x, cuerpoPj.position.y, cuerpoPj.position.z);
	personaje.rotation.y = yaw;
	dinamicos.forEach(sincronizar);
	moviles.forEach(sincronizar);

	// --- máquina de animaciones
	if (modeloListo) {
		let nombre = 'idle';
		if (saltando && acciones.jump) nombre = 'jump';
		else if (avanza()) nombre = (corre() && acciones.run) ? 'run' : (acciones.walk ? 'walk' : 'idle');
		else if (bailando && acciones.dance) nombre = 'dance';
		fijarAccion(nombre);
		mixer.update(dt);
	} else {
		accionTxt.textContent = saltando ? 'Saltar' : (avanza() ? (corre() ? 'Correr' : 'Caminar') : 'Quieto');
	}

	// --- cámara: el ratón la orbita; con C puede seguir al personaje
	const kCam = 1 - Math.exp(-4 * dt);
	if (seguirCamara) {
		if (dYaw !== 0) {                               // la cámara gira junto con el personaje
			tmpV.copy(camera.position).sub(controls.target).applyAxisAngle(ARRIBA, dYaw);
			camera.position.copy(controls.target).add(tmpV);
		}
		objetivoCam.set(cuerpoPj.position.x, cuerpoPj.position.y + 0.35, cuerpoPj.position.z);
		tmpV.copy(objetivoCam).sub(controls.target).multiplyScalar(1 - Math.exp(-6 * dt));   // seguimiento suave
		camera.position.add(tmpV);
		controls.target.add(tmpV);
		if (transicionCam > 0) {                        // al activarla, se acerca y se coloca detrás del personaje
			tmpV.copy(camera.position).sub(controls.target);
			desdeCam.set(-Math.sin(yaw) * DIST_SIGUE, ALT_SIGUE, -Math.cos(yaw) * DIST_SIGUE);
			tmpV.lerp(desdeCam, kCam);
			camera.position.copy(controls.target).add(tmpV);
		}
	} else if (transicionCam > 0) {                     // al desactivarla, regresa a la vista general
		camera.position.lerp(VISTA_GENERAL_POS, kCam);
		controls.target.lerp(VISTA_GENERAL_TGT, kCam);
	}
	transicionCam = Math.max(0, transicionCam - dt);
	controls.update();
}

cargarPersonaje().then(() => { if (!modeloListo) accionTxt.textContent = 'Provisional'; });
animar();
window.addEventListener('pointerdown', () => { if (!sonido) alternarMusica(); }, { once: true });

// Utilidad para depurar desde la consola del navegador (window.__escena)
window.__escena = {
	scene, camera, controls, world, cuerpoPj, dinamicos, moviles,
	estado: () => ({ yaw, yawObjetivo, saltando, bailando, accion: accionActual, seguirCamara, modeloListo }),
	// avance manual y determinista (pruebas): n pasos de dt segundos y un render; continuar() reanuda el bucle normal
	paso: (n = 1, dt = 1 / 60) => { pausaManual = true; for (let i = 0; i < n; i++) actualizar(dt); renderer.render(scene, camera); },
	continuar: () => { pausaManual = false; }
};
