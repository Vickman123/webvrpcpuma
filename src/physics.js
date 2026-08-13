import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        // Setup world
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
        });
        
        // Materials
        this.defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.3,
                restitution: 0.5, // Bounciness
            }
        );
        this.world.addContactMaterial(defaultContactMaterial);
        
        // Floor physics
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({
            mass: 0, // static
            shape: floorShape,
            material: this.defaultMaterial
        });
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);

        this.objects = []; // To keep track of Three.js mesh <-> Cannon body pairs
    }

    addBody(mesh, body) {
        body.material = this.defaultMaterial;
        this.world.addBody(body);
        this.objects.push({ mesh, body });
    }

    update(dt) {
        // Step the physics world
        this.world.step(1 / 60, dt, 3);
        
        // Sync Three.js meshes with Cannon.js bodies
        for (const object of this.objects) {
            // Only update mesh if the body is not currently grabbed (or handled differently)
            if (!object.body.isGrabbed) {
                object.mesh.position.copy(object.body.position);
                object.mesh.quaternion.copy(object.body.quaternion);
            }
        }
    }
}
