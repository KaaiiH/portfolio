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


  private keys: Record<string, boolean> = {};


  private clock = new THREE.Clock();


  private characterController: CharacterController;


  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction | null } = {};


  private currentActionName: string | null = null;


  private isSitting = false;
  private isAnimating = false; 
  private isJumping = false;
  private isAttacking = false;


  private physicsWorld: PhysicsWorld | null = null;

  private testBlockMesh: THREE.Mesh | null = null;

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
 
    this.physicsWorld = new PhysicsWorld();


    this.camera.position.set(0, 2, 5);


    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);


    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(planeGeometry, planeMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);


    const blockGeometry = new THREE.BoxGeometry(2, 2, 2);
    const blockMaterial = new THREE.MeshStandardMaterial({ color: 0x8f8f8f });
    const testBlock = new THREE.Mesh(blockGeometry, blockMaterial);
    testBlock.position.set(0, 1, -5);
    this.scene.add(testBlock);
    this.testBlockMesh = testBlock;

    this.physicsWorld.createBlockBody(0, 1, -5);

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


    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('click', this.onClick);


    this.loadCharacter();
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
        // Start slightly above floor
        model.position.set(0, 1, 0);
        model.scale.set(0.3, 0.3, 0.3);


        this.characterController.setCharacter(model);

  
        this.physicsWorld?.createCharacterBody(0, 1, 0);
        if (this.physicsWorld?.characterBody) {
          this.characterController.setCharacterBody(this.physicsWorld.characterBody);
        }


        this.mixer = new THREE.AnimationMixer(model);


        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          this.actions[clip.name] = action;
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
      undefined,
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


    if (!this.isSitting && !this.isAnimating && !this.isAttacking) {
      this.characterController.update(this.keys);
    }


    if (this.physicsWorld) {
      this.physicsWorld.update(dt);
    }


    const characterModel = this.characterController.getCharacter();
    const characterBody = this.physicsWorld?.characterBody;
    if (characterModel && characterBody) {
      characterModel.position.set(
        characterBody.position.x,
        characterBody.position.y,
        characterBody.position.z
      );

      // face direction from velocity
      const angle = this.characterController.computeRotationForVisual();
      characterModel.rotation.y = angle;
    }


    if (!this.isJumping && !this.isAttacking && !this.isSitting && !this.isAnimating) {
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


    if (this.mixer) {
      this.mixer.update(dt);
    }


    const pos = this.characterController.getPosition();
    if (pos) {
      this.camera.position.x = pos.x;
      this.camera.position.z = pos.z + 5;
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
