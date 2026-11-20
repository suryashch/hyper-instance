import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ObjectBVH, acceleratedRaycast } from 'three-mesh-bvh';

const renderer = new THREE.WebGLRenderer()
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( "#a8a8a8" );

document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 1, 2000 );
camera.position.set( 10,10,10 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enablePan = true;
controls.target = new THREE.Vector3( 0,0,0 );
controls.update();

const ambientLight = new THREE.AmbientLight();
scene.add( ambientLight );

const gridHelper = new THREE.GridHelper( 100, 50, 0xb5b5b5, 0x444444 ); // ( size, divisions )
gridHelper.position.set( 0, 0, 0 );
scene.add( gridHelper );

const objectGroup = new THREE.Group();
objectGroup.position.set( -21, 0, 32 );

const raycaster = new THREE.Raycaster();
THREE.Mesh.prototype.raycast = acceleratedRaycast;
raycaster.firstHitOnly = true;

const mouse = new THREE.Vector2();

let bvh;


const vertexShader = `
    #include <batching_pars_vertex>
    #include <color_pars_vertex>

    varying vec3 v_BatchedNormal;
    varying vec4 v_BatchedColor;
    varying vec3 v_ViewDirection;

    void main() {
        #include <batching_vertex>
        #include <color_vertex>

        mat4 batchingModelViewMatrix = modelViewMatrix * batchingMatrix;

        vec4 batchedPosition = batchingModelViewMatrix * vec4( position, 1.0 );
        v_ViewDirection = normalize( -batchedPosition.xyz );

        v_BatchedNormal = vec3( normalize( batchingModelViewMatrix * vec4( normal, 0.0 )));

        v_BatchedColor = vec4( vColor );
        
        gl_Position = projectionMatrix * batchedPosition;
    }
`

const fragmentShader = `
    varying vec3 v_BatchedNormal;
    varying vec4 v_BatchedColor;
    varying vec3 v_ViewDirection;

    void main() {
        float fresnel = dot( v_ViewDirection, v_BatchedNormal );

        gl_FragColor = vec4( vec3( fresnel * v_BatchedColor.rgb), v_BatchedColor.a );  // v_InstanceColor
        // gl_FragColor = vec4( fresnel * vec3( 0.8, 0.8, 0.8 ), 1.0 );
    }
`


await init();

bvh = new ObjectBVH( scene );

animate();

function animate() {
    requestAnimationFrame( animate );
    renderer.render( scene, camera );
    controls.update();
}

async function init() {
    const loader = new GLTFLoader().setPath( "public/models/" );
    let batchedMesh;
    
    loader.load( 'mep-hyperinstance-ifc-guid-color-2.glb', loadGltf );
    loader.load( 'mep-fittings_hi-lo-res_ifc-guid-2.glb', loadGltf );
    scene.add( objectGroup );
    
    function loadGltf( gltf ) {
        const visited = [];
        const n_Instances = gltf.scene.userData.nInstances;

        let i = 0;
        let instanceId;
        let geometryId;
        let matrix;
        let instColor = new THREE.Vector4();
        let defaultColor = new THREE.Vector4( 0.8, 0.8, 0.8, 1.0 );

        batchedMesh = new THREE.BatchedMesh(
            gltf.scene.userData.nInstances,
            gltf.scene.userData.vCount,
            gltf.scene.userData.iCount,
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                side: THREE.DoubleSide,
            })
        )
        
        gltf.scene.traverse(( child ) => {
            if ( child.isMesh && child.children.length === 0 ) {
                if ( i > n_Instances ) {
                    console.log("Exceeded number of instances");
                    return;
                };

                if ( !visited.includes( child.geometry.uuid )) {
                    geometryId = batchedMesh.addGeometry( child.geometry );
                    visited[ geometryId ] = child.geometry.uuid;
                }                

                if ( child.matrixWorld ) {
                    matrix = child.matrixWorld.clone();
                } else {
                    rotation = child.rotation.clone();
                    translation = child.translation.clone();
                    scale = child.scale.clone();

                    matrix.compose( translation, rotation, scale );
                }

                if ( !child.userData.R ) {
                    instColor.copy( defaultColor );
                } else {
                    instColor.set( child.userData.R, child.userData.G, child.userData.B, child.userData.A );
                };
                
                instanceId = batchedMesh.addInstance( visited.indexOf( child.geometry.uuid ));
                batchedMesh.setMatrixAt( instanceId, matrix );
                batchedMesh.setColorAt( instanceId, instColor );
                i++;

                child.geometry = null;
                child.matrixWorld = null;

                child.traverse((element) => {
                    element = null;
                })
            }
        })

        objectGroup.add( batchedMesh );
    }
}

window.addEventListener( 'dblclick', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects( bvh.objects );

    if (intersects.length > 0) {
        controls.target.copy( intersects[0].point );
    };
});

window.addEventListener( 'resize', () => {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});