import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupXR } from './xr.js';
import { PhysicsWorld } from './physics.js';
import { XRInteractions } from './interactions.js';
import { HandTracking } from './handTracking.js';

let camera, scene, renderer;
let physics, xrInteractions, handTracking;
let clock;
let stats = { thrown: 0, grabbed: 0 };

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b); // Fondo oscuro moderno
    // Niebla sutil
    scene.fog = new THREE.Fog(0x1e293b, 5, 20);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
    // Posición inicial de cámara para modo PC (en VR será controlada por el headset)
    camera.position.set(0, 1.6, 3);

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(3, 5, 3);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Renderizador optimizado
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // La documentación moderna recomienda usar SRGBColorSpace, pero por simplicidad de dependencias mantendremos el default.
    container.appendChild(renderer.domElement);

    // Físicas
    physics = new PhysicsWorld();

    // Crear Sala
    createRoom();

    // Crear Objetos Interactivos
    createObjects();

    // Configuración de controles PC
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.6, 0);
    controls.update();

    // Botón de Demo en PC
    document.getElementById('btn-demo-pc').addEventListener('click', () => {
        document.getElementById('ui-container').style.display = 'none';
        renderer.setAnimationLoop(render);
    });

    // Configurar XR (Esto muestra el botón VR y gestiona la sesión)
    setupXR(renderer, onXRSessionStarted);

    clock = new THREE.Clock();

    window.addEventListener('resize', onWindowResize);
}

function createRoom() {
    // Piso
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x334155, 
        roughness: 0.8, 
        metalness: 0.2 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Cuadrícula futurista en el piso
    const gridHelper = new THREE.GridHelper(20, 40, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Mesas o pedestales para los objetos
    createPedestal(0, 0, -1.5);
    createPedestal(-1.5, 0, -1);
    createPedestal(1.5, 0, -1);
}

function createPedestal(x, y, z) {
    const geometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.4, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);

    // Físicas del pedestal (estático)
    const shape = new CANNON.Cylinder(0.3, 0.4, 0.8, 16);
    const body = new CANNON.Body({ mass: 0, shape: shape });
    body.position.copy(mesh.position);
    physics.addBody(mesh, body);
}

function createObjects() {
    // Material interactivo
    const objectMaterial = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        roughness: 0.3,
        metalness: 0.7
    });

    // Cubo
    const boxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const boxMesh = new THREE.Mesh(boxGeo, objectMaterial);
    boxMesh.position.set(0, 1.0, -1.5);
    boxMesh.castShadow = true;
    scene.add(boxMesh);
    
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.1, 0.1, 0.1));
    const boxBody = new CANNON.Body({ mass: 1, shape: boxShape });
    boxBody.position.copy(boxMesh.position);
    physics.addBody(boxMesh, boxBody);

    // Esfera
    const sphereGeo = new THREE.SphereGeometry(0.12, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.2, metalness: 0.8 });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(-1.5, 1.0, -1);
    sphereMesh.castShadow = true;
    scene.add(sphereMesh);

    const sphereShape = new CANNON.Sphere(0.12);
    const sphereBody = new CANNON.Body({ mass: 0.5, shape: sphereShape });
    sphereBody.position.copy(sphereMesh.position);
    physics.addBody(sphereMesh, sphereBody);

    // Cilindro
    const cylGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 16);
    const cylMat = new THREE.MeshStandardMaterial({ color: 0x34d399 });
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.position.set(1.5, 1.0, -1);
    cylMesh.castShadow = true;
    scene.add(cylMesh);

    const cylShape = new CANNON.Cylinder(0.08, 0.08, 0.3, 16);
    const cylBody = new CANNON.Body({ mass: 0.8, shape: cylShape });
    cylBody.position.copy(cylMesh.position);
    physics.addBody(cylMesh, cylBody);

    // Pelota ligera extra
    const ballGeo = new THREE.SphereGeometry(0.1, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set(0.5, 1.0, -1.5);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballShape = new CANNON.Sphere(0.1);
    const ballBody = new CANNON.Body({ mass: 0.3, shape: ballShape });
    ballBody.position.copy(ballMesh.position);
    physics.addBody(ballMesh, ballBody);
}

function updateUIStats(action) {
    if (action === 'grab') {
        stats.grabbed++;
        const el = document.getElementById('stat-grabbed');
        if (el) el.textContent = stats.grabbed;
    } else if (action === 'throw') {
        stats.thrown++;
        const el = document.getElementById('stat-thrown');
        if (el) el.textContent = stats.thrown;
    }
}

function onXRSessionStarted() {
    // Inicializar Interacciones de WebXR
    xrInteractions = new XRInteractions(scene, renderer, physics, updateUIStats);
    
    // Inicializar Hand Tracking
    handTracking = new HandTracking(scene, renderer);

    // Asegurarse de que el panel VR (DOM Overlay) si se usa, o mostrar algo en VR.
    // DOM Overlay es una feature de WebXR (requiere sessionInit: {optionalFeatures: ['dom-overlay']})
    // Por simplicidad en MVP Vanilla no configuramos dom-overlay avanzado, 
    // pero dejamos la función de UI para futura expansión.

    // Iniciar loop de renderizado
    renderer.setAnimationLoop(render);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    const dt = clock.getDelta();

    // Actualizar motor de físicas
    if (physics) physics.update(dt);

    // Actualizar interacciones de controladores (raycaster y posiciones)
    if (xrInteractions) xrInteractions.update();

    renderer.render(scene, camera);
}
