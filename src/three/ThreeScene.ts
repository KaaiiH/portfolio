// src/three/ThreeScene.ts

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterController } from './CharacterController';
import { LoopOnce, AnimationMixer, AnimationUtils } from 'three';
import { PhysicsWorld } from './PhysicsWorld'; 
import * as CANNON from 'cannon-es';

interface ThreeSceneOptions {
  canvas: HTMLCanvasElement;
  onObjectInteract?: (objectName: string) => void;
}

export class ThreeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationId?: number;
  private clock = new THREE.Clock();
  private characterController: CharacterController;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction | null } = {};
  private currentActionName: string | null = null;
  private keys: Record<string, boolean> = {};
  private isSitting = false;
  private isAnimating = false;
  private isJumping = false;
  private isAttacking = false;
  private physicsWorld: PhysicsWorld | null = null;
  private testBlockMesh: THREE.Mesh | null = null;
  private cameraTarget = new THREE.Vector3(0, 2, 5);
  private shakeStart = 0;
  private shakeDuration = 0;
  private isShaking = false;

  constructor(private options: ThreeSceneOptions) {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.options.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Initialize character controller
    this.characterController = new CharacterController();

    // Bind animation function
    this.animate = this.animate.bind(this);

    // Initialize the scene
    this.init();
  }

  private init() {
    // Initialize physics
    this.physicsWorld = new PhysicsWorld();

    // Set up lights with better illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased intensity
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; // Increased shadow resolution
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);

    // Add a hemisphere light for better ambient illumination
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    this.scene.add(hemisphereLight);

    // Create floor with brighter material
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x808080,  // Lighter grey
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(planeGeometry, planeMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Create test block with better material
    const blockGeometry = new THREE.BoxGeometry(2, 1, 2);
    const blockMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xa0a0a0,  // Lighter grey
      roughness: 0.7,
      metalness: 0.3
    });
    const testBlock = new THREE.Mesh(blockGeometry, blockMaterial);
    testBlock.position.set(0, 1, -5);
    testBlock.castShadow = true;
    testBlock.receiveShadow = true;
    this.scene.add(testBlock);
    this.testBlockMesh = testBlock;

    this.physicsWorld.createBlockBody(0, 1, -5);

    // Add event listeners
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('click', this.onClick);

    // Load character
    this.loadCharacter();

    // Start the animation loop
    this.start();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    if (e.code === 'KeyQ') {
      this.handleSitToggle();
    }
    if (e.code === 'Space') {
      this.handleJump(); //physics jump + jump animation
    }
    if (e.code === 'KeyE') {
      this.handleAttack();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private loadCharacter() {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/models/4_legged_spider_creature.glb',
      (gltf: GLTF) => {
        const model = gltf.scene;
        if (!model) return;

        this.scene.add(model);
        // Start slightly above floor to prevent falling through
        model.position.set(0, 1, 0);
        model.scale.set(0.3, 0.3, 0.3);

        this.characterController.setCharacter(model);

        // Create physics body slightly above ground
        this.physicsWorld?.createCharacterBody(0, 1, 0);
        if (this.physicsWorld?.characterBody) {
          this.characterController.setCharacterBody(this.physicsWorld.characterBody);
        }

        this.mixer = new THREE.AnimationMixer(model);

        // Log available animations for debugging
        console.log('Available animations:', gltf.animations.map(a => a.name));

        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          this.actions[clip.name] = action;
          console.log(`Loaded animation: ${clip.name}`);
        });

        const idleJumpClip = gltf.animations.find((c) => c.name === 'Idle Jump');
        if (idleJumpClip) {
          const partialJump = AnimationUtils.subclip(idleJumpClip, 'PartialIdleJump', 135, 180);
          this.actions['PartialIdleJump'] = this.mixer.clipAction(partialJump);
        }

        // Start in Idle
        if (this.actions['Idle']) {
          this.playAnimation('Idle');
        } else {
          const firstClip = Object.keys(this.actions)[0];
          if (firstClip) this.playAnimation(firstClip);
        }
      },
      (progress) => {
        console.log('Loading model:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => console.error('Error loading character:', error)
    );
  }

  public start() {
    this.animate();
  }

  public stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();

    // Update physics first
    if (this.physicsWorld) {
      this.physicsWorld.update(dt);
    }

    // Update character controller
    if (!this.isSitting && !this.isAnimating && !this.isAttacking) {
      this.characterController.update(this.keys);
    }

    // Update character model position and rotation
    const characterModel = this.characterController.getCharacter();
    const characterBody = this.physicsWorld?.characterBody;
    if (characterModel && characterBody) {
      // Smooth position update
      const targetPosition = new THREE.Vector3(
        characterBody.position.x,
        characterBody.position.y,
        characterBody.position.z
      );
      characterModel.position.lerp(targetPosition, 0.5);

      // Smooth rotation update
      const targetRotation = this.characterController.computeRotationForVisual();
      characterModel.rotation.y = THREE.MathUtils.lerp(
        characterModel.rotation.y,
        targetRotation,
        0.1
      );
    }

    // Update block positions
    if (this.testBlockMesh && this.physicsWorld?.blockBodies[0]) {
      const blockBody = this.physicsWorld.blockBodies[0];
      this.testBlockMesh.position.set(
        blockBody.position.x,
        blockBody.position.y,
        blockBody.position.z
      );
    }

    // Update animations
    if (!this.isJumping && !this.isAttacking && !this.isSitting && !this.isAnimating) {
      if (this.isMoving()) {
        if (this.currentActionName !== 'Walk' && this.actions['Walk']) {
          this.playAnimation('Walk');
        }
      } else {
        if (this.currentActionName !== 'Idle' && this.actions['Idle']) {
          this.playAnimation('Idle');
        }
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private isMoving(): boolean {
    return (
      this.keys['KeyW'] ||
      this.keys['KeyA'] ||
      this.keys['KeyS'] ||
      this.keys['KeyD']
    );
  }

  private handleJump() {
    if (this.isSitting || this.isJumping || this.isAttacking || this.isAnimating) {
      console.log('Cannot jump now!');
      return;
    }

 
    this.characterController.jump();

    const jumpAnim = this.actions['PartialIdleJump'];
    if (!jumpAnim) {
      console.warn('No "PartialIdleJump" found.');
      return;
    }

    this.isJumping = true;

    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    jumpAnim.reset();
    jumpAnim.setLoop(LoopOnce, 1);
    jumpAnim.clampWhenFinished = true;
    jumpAnim.play();
    this.currentActionName = 'PartialIdleJump';


    const jumpDuration = jumpAnim.getClip().duration - 0.5; // or the full duration
    const animMs = jumpDuration * 1000;


    setTimeout(() => {
      this.isJumping = false;
      if (this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, animMs);
  }


  private handleAttack() {
    if (this.isSitting || this.isJumping) {
      console.log('Cannot attack while jumping or sitting!');
      return;
    }
    if (this.isAttacking) {
      console.log('Already attacking!');
      return;
    }

    const attackAction = this.actions['Attack'];
    if (!attackAction) {
      console.warn('No "Attack" animation found.');
      return;
    }

    this.isAttacking = true;

    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    attackAction.reset();
    attackAction.setLoop(LoopOnce, 1);
    attackAction.clampWhenFinished = true;
    attackAction.play();
    this.currentActionName = 'Attack';

    const attackDuration = attackAction.getClip().duration;
    setTimeout(() => {
      this.isAttacking = false;
      if (this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, attackDuration * 1000);

    
    setTimeout(() => {
      this.startCameraShake(0.2);//shake camera for 0.2 seconds
    }, 1200); //delay by 1.2 seconds
  }

  

  private handleSitToggle() {
    if (this.isAnimating || this.isJumping || this.isAttacking) {
      console.log('Cannot sit/stand now!');
      return;
    }

    if (!this.isSitting) {
      this.playSitAnimation('Sit down', 2.0, true);
    } else {
      this.playSitAnimation('Sit up', 1.0, false);
    }
  }

  private playSitAnimation(clipName: string, durationSeconds: number, willSit: boolean) {
    this.isAnimating = true;
    this.playAnimation(clipName);

    setTimeout(() => {
      this.isSitting = willSit;
      this.isAnimating = false;

      if (!this.isSitting && this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, durationSeconds * 1000);
  }


  private playAnimation(name: string) {
    if (!this.mixer) return;
    if (!this.actions[name]) {
      console.warn(`No animation named "${name}"`);
      return;
    }

    const newAction = this.actions[name];
    if (!newAction) return;

    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    if (name === 'Sit down') {
      newAction.loop = THREE.LoopOnce;
      newAction.clampWhenFinished = true;
    } else {
      newAction.loop = THREE.LoopRepeat;
      newAction.clampWhenFinished = false;
    }

    newAction.reset().fadeIn(0.3).play();
    this.currentActionName = name;
  }

  // ----------------------------------------------------------
  // Camera smoothing + shake
  // ----------------------------------------------------------
  private updateCamera(dt: number) {
    // 1) Follow character smoothly
    const pos = this.characterController.getPosition();
    if (pos) {
      // desired camera position is a bit behind the character
      const desiredX = pos.x;
      const desiredZ = pos.z + 5; 
      const desiredY = pos.y + 2; // keep camera 2 units above char

      // Lerp the camera's position to avoid snapping
      const lerpFactor = 7 * dt; // adjust for smoothness
      this.camera.position.x += (desiredX - this.camera.position.x) * lerpFactor;
      this.camera.position.y += (desiredY - this.camera.position.y) * lerpFactor;
      this.camera.position.z += (desiredZ - this.camera.position.z) * lerpFactor;
    }

    // 2) If shaking, add small random offset
    if (this.isShaking) {
      const elapsed = performance.now() - this.shakeStart;
      if (elapsed < this.shakeDuration) {
        // small random offset
        const shakeAmount = 0.05; // amplitude
        this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
        this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
      } else {
        // stop shaking
        this.isShaking = false;
      }
    }
  }

  private startCameraShake(durationSec: number) {
    this.isShaking = true;
    this.shakeStart = performance.now();
    this.shakeDuration = durationSec * 1000;
  }

  // ----------------------------------------------------------
  // Click interactions
  // ----------------------------------------------------------
  private onClick = (e: MouseEvent) => {
    if (this.isAnimating) {
      console.log('Cannot interact during sit/stand anim.');
      return;
    }
    if (!this.isSitting) {
      console.log('You must be sitting to interact.');
      return;
    }

    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const hits = raycaster.intersectObjects(this.scene.children, true);
    if (hits.length > 0) {
      const first = hits[0].object;
      console.log('Clicked on:', first.name);
      if (this.options.onObjectInteract) {
        this.options.onObjectInteract(first.name);
      }
    }
  };


  public onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
