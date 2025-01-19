// src/three/ThreeScene.ts

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterController } from './CharacterController';
import { LoopOnce, AnimationMixer, AnimationUtils } from 'three';

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

  // Time tracking
  private clock = new THREE.Clock();

  // Character logic
  private characterController: CharacterController;

  // Animation system
  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction | null } = {};

  private currentActionName: string | null = null;

  // Sitting logic
  private isSitting = false;   // Are we currently seated?
  private isAnimating = false; // Are we in a sit/stand animation?

  // Jump logic
  private isJumping = false;   // Is a jump animation playing?

  // NEW: Attack logic
  private isAttacking = false; // Is an attack animation playing?

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

    this.characterController = new CharacterController();

    this.init();
    this.animate = this.animate.bind(this);
  }

  private init() {
    // Camera
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

    // Sample blocks
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

    //Events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('click', this.onClick);

    //Load character
    this.loadCharacter();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    //Sit toggle
    if (e.code === 'KeyQ') {
      this.handleSitToggle();
    }

    //Jump
    if (e.code === 'Space') {
      this.handleJump();
    }

    //Attack
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
        model.position.set(0, 0, 0);
        model.scale.set(0.3, 0.3, 0.3);

        this.characterController.setCharacter(model);

        this.mixer = new THREE.AnimationMixer(model);

        // store original animations
        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          this.actions[clip.name] = action;
        });

        //storing last 2 seconds of animation because it's too long
        const idleJumpClip = gltf.animations.find((c) => c.name === 'Idle Jump');
        if (idleJumpClip) {
          const partialJump = AnimationUtils.subclip(
            idleJumpClip,
            'PartialIdleJump',
            120,
            180
          );
          const jumpAction = this.mixer.clipAction(partialJump);
          this.actions['PartialIdleJump'] = jumpAction;
        }

        // Start in Idle if we have it
        if (this.actions['Idle']) {
          this.playAnimation('Idle');
        } else {
          const first = Object.keys(this.actions)[0];
          if (first) this.playAnimation(first);
        }
      },
      undefined,
      (error) => console.error('Error loading character:', error)
    );
  }

 
   // Attack logic on E:
   // - If sitting, jumping, attacking, or in sit animation => ignore
   // - Otherwise single-play "Attack" animation, block movement
   
  private handleAttack() {
    // If we have a reason to block attack, do so:
    if (this.isSitting) {
      console.log('Cannot attack while sitting!');
      return;
    }
    if (this.isJumping) {
      console.log('Cannot attack while jumping!');
      return;
    }
    if (this.isAttacking) {
      console.log('Already attacking!');
      return;
    }
    if (this.isAnimating) {
      console.log('Cannot attack while sit/stand anim is in progress.');
      return;
    }

    const attackAction = this.actions['Attack'];
    if (!attackAction) {
      console.warn('No "Attack" animation found.');
      return;
    }

    // mark we are attacking => no movement
    this.isAttacking = true;

    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    // Single-play
    attackAction.reset();
    attackAction.setLoop(LoopOnce, 1);
    attackAction.clampWhenFinished = true;
    attackAction.play();

    this.currentActionName = 'Attack';

    // Use setTimeout based on clip duration to revert to idle
    const attackDuration = attackAction.getClip().duration;
    setTimeout(() => {
      this.isAttacking = false;
      // for simplicity, revert to Idle
      if (this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, attackDuration * 1000);
  }

  
  private handleJump() {
    if (this.isSitting) {
      console.log('Cannot jump while sitting!');
      return;
    }
    if (this.isJumping) return;
    if (this.isAttacking) {
      console.log('Cannot jump while attacking!');
      return;
    }

    const jumpAction = this.actions['PartialIdleJump'];
    if (!jumpAction) {
      console.warn('No "PartialIdleJump" found.');
      return;
    }

    this.isJumping = true;

    // Fade out old
    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    jumpAction.reset();
    jumpAction.setLoop(LoopOnce, 1);
    jumpAction.clampWhenFinished = true;
    jumpAction.play();

    this.currentActionName = 'PartialIdleJump';

    // After ~2s, revert to Idle
    const jumpDuration = jumpAction.getClip().duration; // ~2
    setTimeout(() => {
      this.isJumping = false;
      if (this.actions['Idle']) {
        this.playAnimation('Idle');
      }
    }, jumpDuration * 1000);
  }

  private handleSitToggle() {
    if (this.isAnimating) return;
    if (this.isJumping || this.isAttacking) {
      console.log('Cannot sit/stand while jumping or attacking!');
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

    //if we had a current action playing, fade it out
    if (this.currentActionName && this.actions[this.currentActionName]) {
      const oldAction = this.actions[this.currentActionName];
      oldAction?.fadeOut(0.3);
    }

    if (name === 'Sit down') {
      // Clamp if sitting down
      newAction.loop = THREE.LoopOnce;
      newAction.clampWhenFinished = true;
    } else {
      newAction.loop = THREE.LoopRepeat;
      newAction.clampWhenFinished = false;
    }

    newAction.reset().fadeIn(0.3).play();
    this.currentActionName = name;
  }

  private onClick = (e: MouseEvent) => {
    // If animating or not sitting => can't interact
    if (this.isAnimating) {
      console.log('Cannot interact during sit/stand anim.');
      return;
    }
    if (!this.isSitting) {
      console.log('You must be sitting to interact with these blocks.');
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

    // Movement is blocked if:
    // - We are in a sit/stand anim (isAnimating)
    // - We are actually sitting
    // - We are attacking
    // (But not blocked by jumping if you want mid-air movement.)
    const canMove = !this.isAnimating && !this.isSitting && !this.isAttacking;

    if (canMove) {
      this.characterController.update(this.keys);
    }

    // Only do Walk/Idle logic if not jumping, not animating, not sitting, not attacking
    if (!this.isJumping && !this.isAnimating && !this.isSitting && !this.isAttacking) {
      if (this.isMoving()) {
        if (this.currentActionName !== 'Walk' && this.actions['Walk']) {
          this.playAnimation('Walk Start');
          this.playAnimation('Walk');
        }
      } else {
        if (this.currentActionName !== 'Idle' && this.actions['Idle']) {
          this.playAnimation('Walk stop');
          this.playAnimation('Idle');
        }
      }
    }

    // Camera follow
    const pos = this.characterController.getPosition();
    if (pos) {
      this.camera.position.x = pos.x;
      this.camera.position.z = pos.z + 5;
    }

    // Update mixer
    const delta = this.clock.getDelta();
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Render
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
