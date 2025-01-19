// src/three/ThreeScene.ts

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterController } from './CharacterController';
import { LoopOnce } from 'three';

interface ThreeSceneOptions {
  canvas: HTMLCanvasElement;
  onObjectInteract?: (objectName: string) => void;
}

export class ThreeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationId?: number;

  // Movement keys
  private keys: Record<string, boolean> = {};

  // Track time between frames for animations
  private clock = new THREE.Clock();

  // Character logic
  private characterController: CharacterController;

  // Animation mixer and actions
  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction | null } = {};

  // Current action name, for toggling animations
  private currentActionName: string | null = null;

  // NEW: Sitting and animation state
  private isSitting = false;    // Are we currently seated?
  private isAnimating = false;  // Are we in the middle of a sit/stand animation?

  constructor(private options: ThreeSceneOptions) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.options.canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x202020);

    // Initialize the character controller
    this.characterController = new CharacterController();

    this.init();
    this.animate = this.animate.bind(this);
  }

  private init() {
    this.camera.position.set(0, 2, 5);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    // Floor
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(planeGeometry, planeMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const resumeCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    resumeCube.position.set(2, 0.5, 0);
    resumeCube.name = 'ResumeCube';
    this.scene.add(resumeCube);

    const githubCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x0000ff })
    );
    githubCube.position.set(-2, 0.5, 0);
    githubCube.name = 'GithubCube';
    this.scene.add(githubCube);

    // Listen for keyboard events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Raycasting on mouse click
    this.renderer.domElement.addEventListener('click', this.onClick);

    // Load character with animations
    this.loadCharacter();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    if (e.code === 'KeyQ') {
      this.handleSitToggle();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  /**
   * Toggle between "Sit down" (2s) and "Sit up" (1s).
   */
  private handleSitToggle() {
    // If we're already animating a sit or stand, ignore.
    if (this.isAnimating) return;

    if (!this.isSitting) {
      // Sit down
      this.playSitAnimation('Sit down', 2.0, true);
    } else {
      // Stand up
      this.playSitAnimation('Sit up', 1.0, false);
    }
  }

  private playSitAnimation(clipName: string, durationSeconds: number, willSit: boolean) {
    // we're now animating; disallow movement & clicks
    this.isAnimating = true;
    this.playAnimation(clipName);

    // after the designated time, finalize the state
    setTimeout(() => {
      this.isSitting = willSit;
      this.isAnimating = false;

      // If we just stood up, revert to Idle
      if (!this.isSitting && this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, durationSeconds * 1000);
  }

  private onClick = (e: MouseEvent) => {
    // if we're animating or not sitting, we won't interact
    if (this.isAnimating) {
      console.log('Cannot interact while animating.');
      return;
    }
    if (!this.isSitting) {
      console.log('You must be sitting to interact with these blocks!');
      return;
    }

    // otherwise, proceed with usual raycasting
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      const firstHit = intersects[0].object;
      console.log('Clicked on:', firstHit.name);

      // Fire callback for object interaction
      if (this.options.onObjectInteract) {
        this.options.onObjectInteract(firstHit.name);
      }
    }
  };

  private loadCharacter() {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/models/4_legged_spider_creature.glb',
      (gltf: GLTF) => {

        const model = gltf.scene;
        if (!model) return;

        this.scene.add(model);
        model.position.set(0, 0, 0);
        model.scale.set(0.3, 0.3, 0.3);

        this.characterController.setCharacter(model);

        //create AnimationMixer
        this.mixer = new THREE.AnimationMixer(model);

        //gather animations
        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          this.actions[clip.name] = action;
        });

        //start in Idle if exists
        if (this.actions['Idle']) {
          this.playAnimation('Idle');
        } else {
          console.warn('No Idle animation found. Playing first found clip...');
          const firstClipName = Object.keys(this.actions)[0];
          if (firstClipName) this.playAnimation(firstClipName);
        }
      },
      undefined,
      (error) => {
        console.error('Error loading character with animations:', error);
      }
    );
  }

  private playAnimation(name: string) {
    if (!this.mixer) return;
    if (!this.actions[name]) {
      console.warn(`No animation named '${name}'`);
      return;
    }

    const newAction = this.actions[name];
    if (!newAction) return;

    //if we had a current action playing, fade it out
    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    //fade in and play new action
    if (name === 'Sit down') {
      //only play once, then clamp final pose
      newAction.loop = LoopOnce;
      newAction.clampWhenFinished = true;
    }
    else {
      newAction.loop = THREE.LoopRepeat;
      newAction.clampWhenFinished = false;
    }
    newAction.reset().fadeIn(0.3).play();
    this.currentActionName = name;
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

    // Skip movement if we're animating a sit/stand
    if (!this.isAnimating && !this.isSitting) {
      // Update character movement if not animating
      this.characterController.update(this.keys);
    }

    //Switch to walk or idle if not sitting/animating
    if (!this.isAnimating && !this.isSitting) {
      if (this.isMoving()) {
        // if there's a 'Walk Start' and 'Walk', you might do:
        if (this.currentActionName !== 'Walk' && this.actions['Walk']) {
          this.playAnimation('Walk Start');
          this.playAnimation('Walk');
        }
      } else {
        // no movement => idle
        if (this.currentActionName !== 'Idle' && this.actions['Idle']) {
          this.playAnimation('Walk stop');
          this.playAnimation('Idle');
        }
      }
    }

    const charPos = this.characterController.getPosition();
    if (charPos) {
      this.camera.position.x = charPos.x;
      this.camera.position.z = charPos.z + 5;
    }

    //Update mixer
    const delta = this.clock.getDelta();
    if (this.mixer) {
      this.mixer.update(delta);
    }

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

  public onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
