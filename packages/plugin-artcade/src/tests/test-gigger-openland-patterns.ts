import { PatternData } from "./test-insert-example";

export const giggerOpenlandPatterns = [
    {
        type: "game_mechanic",
        pattern_name: "first-person-movement",
        content: {
            js: `
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();

function checkCollisions(newPosition) {
    const mapBoundary = 990;
    if (Math.abs(newPosition.x) > mapBoundary || Math.abs(newPosition.z) > mapBoundary) {
        return false;
    }
    return true;
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 3;
    camera.position.z = 30;
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);

    document.addEventListener('click', function() {
        controls.lock();
    });

    document.addEventListener('keydown', function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
        }
    });

    document.addEventListener('keyup', function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    });

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016;

    if (controls && controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;

        const newPosition = camera.position.clone();
        newPosition.x -= velocity.x * delta;
        newPosition.z -= velocity.z * delta;

        if (checkCollisions(newPosition)) {
            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);
        } else {
            // Try smaller movement if full movement fails
            newPosition.copy(camera.position);
            newPosition.x -= velocity.x * delta * 0.5;
            newPosition.z -= velocity.z * delta * 0.5;
            if (checkCollisions(newPosition)) {
                controls.moveRight(-velocity.x * delta * 0.5);
                controls.moveForward(-velocity.z * delta * 0.5);
            }
            velocity.x = 0;
            velocity.z = 0;
        }

        camera.position.y = 3;
    }

    renderer.render(scene, camera);
}

init();
animate();`,
            html: `<div id="instructions">WASD - Move around<br>Mouse - Look around</div>`,
            css: `
body { margin: 0; overflow: hidden; }
canvas { display: block; }
#instructions {
    position: fixed;
    bottom: 20px;
    left: 20px;
    color: white;
    font-family: Arial, sans-serif;
    background: rgba(0,0,0,0.5);
    padding: 10px;
    border-radius: 5px;
}`,
            context:
                "First-person movement system with smooth keyboard/mouse controls, collision detection, and height locking",
            metadata: {
                type: "game_mechanic",
                features: [
                    "first_person",
                    "keyboard_input",
                    "mouse_look",
                    "collision_detection",
                    "height_lock",
                ],
                movement_type: "3d",
                input_type: "keyboard_mouse",
            },
        },
        room_id: "first_person-keyboard_mouse-collision",
    },
];

export type { PatternData };
