import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class XRInteractions {
    constructor(scene, renderer, physicsWorld, uiCallback) {
        this.scene = scene;
        this.renderer = renderer;
        this.physicsWorld = physicsWorld;
        this.uiCallback = uiCallback; // to update UI score

        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();
        this.intersected = [];

        this.initControllers();
    }

    initControllers() {
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            
            // Eventos del gatillo/grip
            controller.addEventListener('selectstart', (e) => this.onSelectStart(e));
            controller.addEventListener('selectend', (e) => this.onSelectEnd(e));
            
            // Visualización del rayo
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)
            ]);
            const line = new THREE.Line(geometry);
            line.name = 'line';
            line.scale.z = 5; // Longitud inicial del rayo
            controller.add(line);

            // Guardar variables de estado
            controller.userData.isSelecting = false;
            controller.userData.selectedObject = null;
            controller.userData.previousPositions = []; // Para calcular velocidad
            
            this.scene.add(controller);
            this.controllers.push(controller);

            // Representación visual del control (básica)
            const grip = this.renderer.xr.getControllerGrip(i);
            // Podríamos cargar un modelo aquí, pero usaremos algo simple
            this.scene.add(grip);
        }
    }

    onSelectStart(event) {
        const controller = event.target;
        controller.userData.isSelecting = true;

        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        // Interactuar solo con objetos que tengan un cuerpo físico
        const interactableMeshes = this.physicsWorld.objects.map(obj => obj.mesh);
        const intersects = this.raycaster.intersectObjects(interactableMeshes, false);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            this.grabObject(controller, object);
        }
    }

    onSelectEnd(event) {
        const controller = event.target;
        controller.userData.isSelecting = false;

        if (controller.userData.selectedObject) {
            this.releaseObject(controller);
        }
    }

    grabObject(controller, object) {
        controller.userData.selectedObject = object;
        
        // Encontrar el cuerpo físico asociado
        const physObj = this.physicsWorld.objects.find(o => o.mesh === object);
        if (physObj) {
            physObj.body.isGrabbed = true;
            physObj.body.velocity.set(0, 0, 0);
            physObj.body.angularVelocity.set(0, 0, 0);
            controller.userData.selectedBody = physObj.body;
        }

        // Cambiar parentesco para que se mueva con el control
        // Usamos attach para mantener la posición mundial
        controller.attach(object);
        
        if (this.uiCallback) this.uiCallback('grab');
    }

    releaseObject(controller) {
        const object = controller.userData.selectedObject;
        const body = controller.userData.selectedBody;

        // Devolver a la escena
        this.scene.attach(object);
        
        if (body) {
            body.isGrabbed = false;
            
            // Actualizar la posición del cuerpo físico a la nueva posición del mesh
            body.position.copy(object.position);
            body.quaternion.copy(object.quaternion);

            // Calcular y aplicar velocidad (lanzamiento)
            const velocity = this.calculateVelocity(controller);
            body.velocity.copy(velocity);
            
            // Pequeña rotación aleatoria al lanzar
            body.angularVelocity.set(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            );
            
            // Validar si fue un lanzamiento rápido
            if (velocity.length() > 2.0 && this.uiCallback) {
                this.uiCallback('throw');
            }
        }

        controller.userData.selectedObject = null;
        controller.userData.selectedBody = null;
    }

    calculateVelocity(controller) {
        const positions = controller.userData.previousPositions;
        if (positions.length < 2) return new CANNON.Vec3(0, 0, 0);

        // Promediar los últimos deltas de posición para obtener una velocidad suavizada
        const currentPos = positions[positions.length - 1].pos;
        const oldPos = positions[0].pos;
        const dt = positions[positions.length - 1].time - positions[0].time;

        if (dt <= 0) return new CANNON.Vec3(0, 0, 0);

        // Convertir de THREE.Vector3 a CANNON.Vec3 y calcular v = d/t
        const vel = new CANNON.Vec3(
            (currentPos.x - oldPos.x) / dt,
            (currentPos.y - oldPos.y) / dt,
            (currentPos.z - oldPos.z) / dt
        );
        
        // Multiplicador opcional para mejorar la sensación de lanzamiento
        vel.scale(1.5, vel);
        return vel;
    }

    update() {
        const now = performance.now() / 1000; // segundos
        
        for (const controller of this.controllers) {
            // Actualizar posición del rayo (intersecciones visuales)
            if (!controller.userData.selectedObject) {
                this.tempMatrix.identity().extractRotation(controller.matrixWorld);
                this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
                this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

                const interactableMeshes = this.physicsWorld.objects.map(obj => obj.mesh);
                const intersects = this.raycaster.intersectObjects(interactableMeshes, false);

                const line = controller.getObjectByName('line');
                if (line) {
                    if (intersects.length > 0) {
                        line.scale.z = intersects[0].distance;
                        line.material.color.setHex(0x00ff00); // Verde si apunta a algo
                    } else {
                        line.scale.z = 5;
                        line.material.color.setHex(0xffffff);
                    }
                }
            } else {
                // Si tiene algo agarrado, ocultar rayo o ponerlo corto
                const line = controller.getObjectByName('line');
                if (line) line.scale.z = 0;
            }

            // Registrar posiciones para calcular velocidad al soltar
            const pos = new THREE.Vector3();
            pos.setFromMatrixPosition(controller.matrixWorld);
            
            controller.userData.previousPositions.push({ pos: pos, time: now });
            
            // Mantener solo los últimos ~10 frames de historial
            if (controller.userData.previousPositions.length > 10) {
                controller.userData.previousPositions.shift();
            }

            // Si hay un objeto agarrado, actualizar el cuerpo físico al mesh (que se mueve con el control)
            if (controller.userData.selectedObject && controller.userData.selectedBody) {
                const object = controller.userData.selectedObject;
                const body = controller.userData.selectedBody;
                
                // Obtener posición mundial del mesh que ahora es hijo del controlador
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                object.getWorldPosition(worldPos);
                object.getWorldQuaternion(worldQuat);

                body.position.copy(worldPos);
                body.quaternion.copy(worldQuat);
                
                // Anular velocidades para que la gravedad no lo hunda de las manos
                body.velocity.set(0, 0, 0);
                body.angularVelocity.set(0, 0, 0);
            }
        }
    }
}
