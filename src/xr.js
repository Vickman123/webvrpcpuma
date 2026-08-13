import * as THREE from 'three';

export function setupXR(renderer, setupSceneCallback) {
    renderer.xr.enabled = true;
    
    // Check if WebXR is supported
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            const btnEnterVR = document.getElementById('btn-enter-vr');
            const statusMessage = document.getElementById('status-message');
            const btnDemoPC = document.getElementById('btn-demo-pc');
            
            if (supported) {
                statusMessage.style.display = 'none';
                btnEnterVR.style.display = 'block';
                btnDemoPC.style.display = 'block'; // Opcional para pruebas

                btnEnterVR.addEventListener('click', async () => {
                    // Start session
                    const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
                    try {
                        const session = await navigator.xr.requestSession('immersive-vr', sessionInit);
                        renderer.xr.setSession(session);
                        
                        // Ocultar UI 2D principal
                        document.getElementById('ui-container').style.display = 'none';
                        
                        session.addEventListener('end', () => {
                            document.getElementById('ui-container').style.display = 'flex';
                        });

                        setupSceneCallback();
                    } catch (e) {
                        console.error('Error al iniciar WebXR:', e);
                        alert('No se pudo iniciar la sesión VR. Error: ' + e.message);
                    }
                });
            } else {
                statusMessage.textContent = 'Conecta un Meta Quest 3/3S para entrar en la experiencia VR. Tu navegador actual no soporta immersive-vr.';
                btnDemoPC.style.display = 'block';
            }
        });
    } else {
        document.getElementById('status-message').textContent = 'WebXR no está disponible en este navegador (requiere HTTPS o localhost, y un navegador compatible como Meta Quest Browser).';
        document.getElementById('btn-demo-pc').style.display = 'block';
    }
}
