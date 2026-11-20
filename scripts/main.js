import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer()
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( "#a8a8a8" );

document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 1, 2000 );
camera.position.set( 10,10,10 );
camera.lookAt( 0,0,0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enablePan = true;
controls.target = new THREE.Vector3( 0,0,0 );

controls.update();

const ambientLight = new THREE.AmbientLight();
scene.add( ambientLight );

const gridHelper = new THREE.GridHelper( 100, 50, 0xb5b5b5, 0x444444 ); // ( size, divisions )
gridHelper.position.set( 0, 0, 0 );
scene.add( gridHelper );

function animate() {
    requestAnimationFrame( animate );
    renderer.render( scene, camera );
    controls.update();
}

animate();