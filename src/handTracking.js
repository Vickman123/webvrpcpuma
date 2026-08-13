import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

export class HandTracking {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.handModels = [];

        this.initHands();
    }

    initHands() {
        const handModelFactory = new XRHandModelFactory();

        for (let i = 0; i < 2; i++) {
            const hand = this.renderer.xr.getHand(i);
            
            // Modelo visual básico (cubos para las articulaciones)
            const handModel = handModelFactory.createHandModel(hand, 'mesh'); 
            hand.add(handModel);

            // Escuchar gestos básicos: pinch (agarrar)
            hand.addEventListener('pinchend', (e) => this.onPinchEnd(e));
            hand.addEventListener('pinchstart', (e) => this.onPinchStart(e));

            this.scene.add(hand);
            this.handModels.push(hand);
        }
    }

    onPinchStart(event) {
        // El controller 0 o 1 asociado a la mano también dispara selectstart normalmente.
        // WebXR en Meta Quest a menudo mapea el pinch al evento 'select' del controller.
        // Aquí podríamos añadir lógica personalizada específica para manos si se requiere.
        console.log("Pinch start detectado con mano", event.handedness);
    }

    onPinchEnd(event) {
        console.log("Pinch end detectado con mano", event.handedness);
    }
}
