import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { EffectComposer } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SMAAPass.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/RGBELoader.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.142.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { EffectShader } from "./EffectShader.js";
import { FXAAShader } from 'https://unpkg.com/three@0.142.0/examples/jsm/shaders/FXAAShader.js'
import { OrbitControls } from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/OrbitControls.js';
import { AssetManager } from './AssetManager.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SAOPass.js';
import { SSRPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SSRPass.js';
import { Stats } from "./stats.js";
import {
    MeshBVH,
    MeshBVHVisualizer,
    MeshBVHUniformStruct,
    FloatVertexAttributeTexture,
    shaderStructs,
    shaderIntersectFunction,
    SAH
} from 'https://unpkg.com/three-mesh-bvh@0.5.10/build/index.module.js';
import { GUI } from 'https://unpkg.com/three@0.138.0/examples/jsm/libs/lil-gui.module.min.js';
let saoPass,ssrPass


const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set( BLOOM_SCENE );

const selects = [];
async function main() {
    const params = {
        exposure: 0.85,
        bloomStrength: 0.3,
        bloomThreshold: 0.85,
        bloomRadius: 0
    };
    // Setup basic renderer, controls, and profiler
    const clientWidth = window.innerWidth ;
    const clientHeight = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set( - 20.8, 5.6, 15.7 );

    camera.layers.enable(1);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    // renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 18;
    controls.maxDistance = 50;
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    // Setup scene
    // Skybox

    // const environment = await new THREE.CubeTextureLoader().loadAsync([
    //     "skybox/Box_Right.bmp",
    //     "skybox/Box_Left.bmp",
    //     "skybox/Box_Top.bmp",
    //     "skybox/Box_Bottom.bmp",
    //     "skybox/Box_Front.bmp",
    //     "skybox/Box_Back.bmp"
    // ]);
    const environment =  new RGBELoader()
    .setPath('')
    .load('gem.hdr', function (texture2) {

        texture2.mapping = THREE.EquirectangularReflectionMapping;

        scene.background = texture2;
        scene.environment = texture2;

    });
   
    environment.encoding = THREE.sRGBEncoding;
    // scene.background = environment;
    // Lighting
    const ambientLight = new THREE.AmbientLight(new THREE.Color(1.0, 1.0, 1.0), 0.25);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.35);
    directionalLight.position.set(150, 200, 50);
    // Shadows
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.left = -75;
    directionalLight.shadow.camera.right = 75;
    directionalLight.shadow.camera.top = 75;
    directionalLight.shadow.camera.bottom = -75;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.blurSamples = 8;
    directionalLight.shadow.radius = 4;
    scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 10);
    directionalLight2.color.setRGB(1.0, 1.0, 1.0);
    directionalLight2.position.set(-50, 200, -150);
    scene.add(directionalLight2);
    // Objects

    // let diamondGeo = (await AssetManager.loadGLTFAsync("ATASAY_02.glb")).scene.children[0].children[1].children[0].geometry;
    let diamondGeo = (await AssetManager.loadGLTFAsync("atasay2.glb")).scene.getObjectByName('dia007').geometry
    console.log(diamondGeo)


    diamondGeo.scale(10, 10, 10);
    diamondGeo.translate(0, 5, 0);
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCamera = new THREE.CubeCamera(1, 100000, cubeRenderTarget);
    // scene.add(cubeCamera);
    cubeCamera.position.set(0, 5, 0);
    cubeCamera.update(renderer, scene);
    scene.background = cubeRenderTarget.texture;
    const makeDiamond = (geo,inputColor,iorValue, {
            color = inputColor,
            ior = iorValue
        } = {}) => {
            const mergedGeometry = geo;
            mergedGeometry.boundsTree = new MeshBVH(mergedGeometry.toNonIndexed(), { lazyGeneration: false, strategy: SAH });
            const collider = new THREE.Mesh(mergedGeometry);
            collider.material.wireframe = true;
            collider.material.opacity = 1;
            collider.material.transparent = true;
            collider.visible = false;
            collider.boundsTree = mergedGeometry.boundsTree;
            scene.add(collider);
            const visualizer = new MeshBVHVisualizer(collider, 20);
            visualizer.visible = false;
            visualizer.update();
            // scene.add(visualizer);
            const diamond = new THREE.Mesh(geo, new THREE.ShaderMaterial({
                uniforms: {
                    envMap: { value: environment },
                    bvh: { value: new MeshBVHUniformStruct() },
                    bounces: { value: 3 },
                    color: { value: color },
                    ior: { value: 2.0 },
                    correctMips: { value: true },
                    projectionMatrixInv: { value: camera.projectionMatrixInverse },
                    viewMatrixInv: { value: camera.matrixWorld },
                    chromaticAberration: { value: true },
                    aberrationStrength: { value: 0.01 },
                    resolution: { value: new THREE.Vector2(clientWidth, clientHeight) }
                },
                vertexShader: /*glsl*/ `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            uniform mat4 viewMatrixInv;
            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vNormal = (viewMatrixInv * vec4(normalMatrix * normal, 0.0)).xyz;
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            }
            `,
                fragmentShader: /*glsl*/ `
            precision highp isampler2D;
            precision highp usampler2D;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            uniform samplerCube envMap;
            uniform float bounces;
            ${ shaderStructs }
            ${ shaderIntersectFunction }
            uniform BVH bvh;
            uniform float ior;
            uniform vec3 color;
            uniform bool correctMips;
            uniform bool chromaticAberration;
            uniform mat4 projectionMatrixInv;
            uniform mat4 viewMatrixInv;
            uniform mat4 modelMatrix;
            uniform vec2 resolution;
            uniform bool chromaticAbberation;
            uniform float aberrationStrength;
            vec3 totalInternalReflection(vec3 ro, vec3 rd, vec3 normal, float ior, mat4 modelMatrixInverse) {
                vec3 rayOrigin = ro;
                vec3 rayDirection = rd;
                rayDirection = refract(rayDirection, normal, 1.0 / ior);
                rayOrigin = vWorldPosition + rayDirection * 0.001;
                rayOrigin = (modelMatrixInverse * vec4(rayOrigin, 1.0)).xyz;
                rayDirection = normalize((modelMatrixInverse * vec4(rayDirection, 0.0)).xyz);
                for(float i = 0.0; i < bounces; i++) {
                    uvec4 faceIndices = uvec4( 0u );
                    vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
                    vec3 barycoord = vec3( 0.0 );
                    float side = 1.0;
                    float dist = 0.0;
                    bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
                    vec3 hitPos = rayOrigin + rayDirection * max(dist - 0.001, 0.0);
                   // faceNormal *= side;
                    vec3 tempDir = refract(rayDirection, faceNormal, ior);
                    if (length(tempDir) != 0.0) {
                        rayDirection = tempDir;
                        break;
                    }
                    rayDirection = reflect(rayDirection, faceNormal);
                    rayOrigin = hitPos + rayDirection * 0.01;
                }
                rayDirection = normalize((modelMatrix * vec4(rayDirection, 0.0)).xyz);
                return rayDirection;
            }
            void main() {
                mat4 modelMatrixInverse = inverse(modelMatrix);
                vec2 uv = gl_FragCoord.xy / resolution;
                vec3 directionCamPerfect = (projectionMatrixInv * vec4(uv * 2.0 - 1.0, 0.0, 1.0)).xyz;
                directionCamPerfect = (viewMatrixInv * vec4(directionCamPerfect, 0.0)).xyz;
                directionCamPerfect = normalize(directionCamPerfect);
                vec3 normal = vNormal;
                vec3 rayOrigin = cameraPosition;
                vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
                vec3 finalColor;
                if (chromaticAberration) {
                vec3 rayDirectionR = totalInternalReflection(rayOrigin, rayDirection, normal, max(ior * (1.0 - aberrationStrength), 1.0), modelMatrixInverse);
                vec3 rayDirectionG = totalInternalReflection(rayOrigin, rayDirection, normal, max(ior, 1.0), modelMatrixInverse);
                vec3 rayDirectionB = totalInternalReflection(rayOrigin, rayDirection, normal, max(ior * (1.0 + aberrationStrength), 1.0), modelMatrixInverse);
                float finalColorR = textureGrad(envMap, rayDirectionR, dFdx(correctMips ? directionCamPerfect: rayDirection), dFdy(correctMips ? directionCamPerfect: rayDirection)).r;
                float finalColorG = textureGrad(envMap, rayDirectionG, dFdx(correctMips ? directionCamPerfect: rayDirection), dFdy(correctMips ? directionCamPerfect: rayDirection)).g;
                float finalColorB = textureGrad(envMap, rayDirectionB, dFdx(correctMips ? directionCamPerfect: rayDirection), dFdy(correctMips ? directionCamPerfect: rayDirection)).b;
                finalColor = vec3(finalColorR, finalColorG, finalColorB) * color;
                } else {
                    rayDirection = totalInternalReflection(rayOrigin, rayDirection, normal, max(ior, 1.0), modelMatrixInverse);
                    finalColor = textureGrad(envMap, rayDirection, dFdx(correctMips ? directionCamPerfect: rayDirection), dFdy(correctMips ? directionCamPerfect: rayDirection)).rgb;
                    finalColor *= color;
                }
                gl_FragColor = vec4(vec3(finalColor), 1.0);
            }
            `
            }));
            diamond.material.uniforms.bvh.value.updateFrom(collider.boundsTree);
            diamond.castShadow = true;
            diamond.receiveShadow = true;
            return diamond;
        }
   
    // const diamond = makeDiamond(diamondGeo);
    // scene.add(diamond);
    let diamondModel,Diamond_OvalMat,Diamond_Oval,diamondModelTopDiamond
    new RGBELoader()
    .setPath( '' )
    .load( 'gem.hdr', function ( texture ) {

        texture.mapping = THREE.EquirectangularReflectionMapping;

        scene.background = texture;
        scene.environment = texture;

        render();

        // model

        const loader = new GLTFLoader().setPath( '' );
        loader.load( 'atasay2.glb', function ( gltf ) {
       
            diamondModel = gltf.scene
            diamondModel.scale.set(2.85,2.85,2.85);;
            diamondModel.position.y = -5
            diamondModel.rotation.y = -Math.PI/4 -0.15
   
        //     diamondModelTopDiamond = diamondModel.getObjectByName('oval_gem').material
            // Diamond_Oval =  makeDiamond(diamondModel.getObjectByName('oval_gem').geometry)
        //     Diamond_OvalMat = Diamond_Oval.material
        diamondModel.getObjectByName('dia007').layers.toggle( BLOOM_SCENE );
        // diamondModel.getObjectByName('25mm00').layers.toggle( BLOOM_SCENE );
        // diamondModel.getObjectByName('25mm001').layers.toggle( BLOOM_SCENE );
        // selects.push( diamondModel.getObjectByName('DIAMOND_CELLS003') );
        // selects.push( diamondModel.getObjectByName('DIAMOND_CELLS003_1') );
        // diamondModel.getObjectByName('DIAMOND_CELLS003_1').visible = false
        // selects.push( diamondModel.getObjectByName('25mm002') );
        // selects.push( diamondModel.getObjectByName('25mm003') );
        diamondModel.layers.set(0)
        diamondModel.getObjectByName('dia007').layers.set(1);
        // diamondModel.getObjectByName('25mm001').layers.set(1);
        // diamondModel.getObjectByName('25mm001').layers.set(1);
        // diamondModel.getObjectByName('DIAMOND_CELLS003_1').material =  makeDiamond(diamondModel.getObjectByName('DIAMOND_CELLS003_1').geometry,new THREE.Color(1,1,1),2).material

        // diamondModel.getObjectByName('DIAMOND_CELLS003').material =  makeDiamond(diamondModel.getObjectByName('DIAMOND_CELLS003').geometry,new THREE.Color(1,1,1),5).material
        diamondModel.getObjectByName('dia007').material =  makeDiamond(diamondModel.getObjectByName('dia007').geometry,new THREE.Color(1,1,1),2).material
        // diamondModel.getObjectByName('25mm003').material =  makeDiamond(diamondModel.getObjectByName('25mm001').geometry,new THREE.Color(1,1,1),2).material
        //     console.log( diamondModel.getObjectByName('oval_gem').material )
        //   console.log( diamondModel.getObjectByName('ring_1').children)
        //     for (var i = 0; i < diamondModel.getObjectByName('ring_1').children.length; i++) {
        //        if(i !== 45){
        //         diamondModel.getObjectByName('ring_1').children[i].material = makeDiamond(diamondModel.getObjectByName('dia_2_020').geometry,new THREE.Color(1,1,1),2).material
        //        }
        //     }

            scene.add( diamondModel );
   
            

            render();

        } );

    } );
    // Build postprocessing stack
    // Render Targets
    const defaultTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });
    defaultTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);
    // Post Effects
    const composer = new EffectComposer(renderer);
    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const effectPass = new ShaderPass(EffectShader);
    composer.addPass(effectPass);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    // composer.addPass(smaaPass);
    const effectController = {
        bounces: 3.0,
        ior: 2.4,
        correctMips: true,
        chromaticAberration: true,
        aberrationStrength: 0.01
    };

    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;
	let renderPass = new RenderPass( scene, camera );


	// saoPass = new SAOPass( scene, camera, false, true );
    // // composer.addPass( saoPass );
    // saoPass.resolution.set(512, 512)
    // saoPass.params.saoIntensity = 0.002
    // saoPass.params.saoScale =2
    // saoPass.params.saoKernelRadius =16
    // saoPass.params.saoBlurRadius =100

    composer.addPass( bloomPass );

	ssrPass = new SSRPass( {
        renderer,
        scene,
        camera,
        width: innerWidth,
        height: innerHeight,
        // groundReflector: params.groundReflector ? groundReflector : null,
        // selects: params.groundReflector ? selects : null
        selects,
    } );
    // composer.addPass( ssrPass );
    
    // composer.addPass( new ShaderPass( GammaCorrectionShader ) );
    const fxaaPass = new ShaderPass( FXAAShader );
    // composer.addPass( fxaaPass );
    const gui = new GUI();
    gui.add(effectController, "bounces", 1.0, 10.0, 1.0).name("Bounces").onChange( function ( value ) {

        // diamond.uniforms.ior = Number( value );
         // diamond.material.uniforms.bounces.value = effectController.bounces;
         diamondModel.getObjectByName('dia007').material.uniforms.bounces.value = effectController.bounces;
         

    } );;;
    gui.add(effectController, "ior", 1.0, 5.0, 0.01).name("IOR").onChange( function ( value ) {

        // diamond.uniforms.ior = Number( value );
         // diamond.material.uniforms.bounces.value = effectController.bounces;
         diamondModel.getObjectByName('dia007').material.uniforms.ior.value = effectController.ior;
         

    } );
    // gui.add(effectController, "correctMips");
    // gui.add(effectController, "chromaticAberration");
    gui.add(effectController, "aberrationStrength", 0.00, 1.0, 0.0001).name("Aberration Strength").onChange( function ( value ) {

        // diamond.uniforms.ior = Number( value );
         // diamond.material.uniforms.bounces.value = effectController.bounces;
         diamondModel.getObjectByName('dia007').material.uniforms.aberrationStrength.value = effectController.aberrationStrength;
         

    } );

    gui.add( params, 'bloomThreshold', 0.0, 10.0 ).onChange( function ( value ) {

        bloomPass.threshold = Number( value );

    } );

    gui.add( params, 'bloomStrength', 0.0, 10.0 ).onChange( function ( value ) {

        bloomPass.strength = Number( value );

    } );

    gui.add( params, 'bloomRadius', 0.0, 10.0 ).step( 0.01 ).onChange( function ( value ) {

        bloomPass.radius = Number( value );

    } );
    // gui.add( saoPass.params, 'output', {
    //     'Beauty': SAOPass.OUTPUT.Beauty,
    //     'Beauty+SAO': SAOPass.OUTPUT.Default,
    //     'SAO': SAOPass.OUTPUT.SAO,
    //     'Depth': SAOPass.OUTPUT.Depth,
    //     'Normal': SAOPass.OUTPUT.Normal
    // } ).onChange( function ( value ) {

    //     saoPass.params.output = parseInt( value );

    // } );
    // gui.add( saoPass.params, 'saoBias', - 1, 1 );
    // gui.add( saoPass.params, 'saoIntensity', 0, 1 );
    // gui.add( saoPass.params, 'saoScale', 0, 10 );
    // gui.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    // gui.add( saoPass.params, 'saoMinResolution', 0, 1 );
    // gui.add( saoPass.params, 'saoBlur' );
    // gui.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    // gui.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    // gui.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );

    gui
    .add(renderer, 'toneMapping', {
        No: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        ACESFilmic: THREE.ACESFilmicToneMapping
    })
    gui.add( params, 'exposure', 0.1, 2 ).onChange( function ( value ) {
    // gui.add( params, 'enableSSR' ).name( 'Enable SSR' );
    // gui.add( params, 'groundReflector' ).onChange( () => {

    //     if ( params.groundReflector ) {

    //         ssrPass.groundReflector = groundReflector,
    //         ssrPass.selects = selects;

    //     } else {

    //         ssrPass.groundReflector = null,
    //         ssrPass.selects = null;

    //     }

    // } );
    // ssrPass.thickness = 0.018;
    // gui.add( ssrPass, 'thickness' ).min( 0 ).max( .1 ).step( .0001 );
    // ssrPass.infiniteThick = false;
    // gui.add( ssrPass, 'infiniteThick' );
    renderer.toneMappingExposure = Math.pow( value, 4.0 );

} );
    function animate() {

        renderer.clear();
        renderer.render(scene, camera);
        effectPass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        composer.render();
        controls.update();
        stats.update();
        requestAnimationFrame(animate);
    }
    function render() {
        // diamond.material.uniforms.bounces.value = effectController.bounces;
        // diamondModel.material.uniforms.ior.value = effectController.ior;
        // diamond.material.uniforms.correctMips.value = effectController.correctMips;
        // diamond.material.uniforms.chromaticAberration.value = effectController.chromaticAberration;
        // diamond.material.uniforms.aberrationStrength.value = effectController.aberrationStrength;

        // diamond.updateMatrix();
        // diamond.updateMatrixWorld();
        renderer.setRenderTarget(defaultTexture);
      
        renderer.render( scene, camera );
   
  scene.background = new THREE.Color(0.1, 0.1, 0.1)
    }
    requestAnimationFrame(animate);
}
main();