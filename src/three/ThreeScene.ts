// src/three/ThreeScene.ts
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
// (Optional) import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CharacterController } from './CharacterController';

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

  private clock = new THREE.Clock();

  // Character logic
  private characterController: CharacterController;

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
    // Camera position
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
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Resume "Cube"
    const resumeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const resumeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const resumeCube = new THREE.Mesh(resumeGeometry, resumeMaterial);
    resumeCube.position.set(2, 0.5, 0);
    resumeCube.name = 'ResumeCube';
    this.scene.add(resumeCube);

    // GitHub "Cube" (Portal)
    const githubGeometry = new THREE.BoxGeometry(1, 1, 1);
    const githubMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const githubCube = new THREE.Mesh(githubGeometry, githubMaterial);
    githubCube.position.set(-2, 0.5, 0);
    githubCube.name = 'GithubCube';
    this.scene.add(githubCube);

    // OrbitControls for debugging:
    // const controls = new OrbitControls(this.camera, this.renderer.domElement);

    //listening for keyboard events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    //raycasting on mouse click
    this.renderer.domElement.addEventListener('click', this.onClick);

    // load your character model
    this.loadCharacter();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onClick = (e: MouseEvent) => {
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
    // use the GLTF type in the callback to avoid "implicitly has an any type" error
    loader.load(
      '/assets/models/human_skeleton_download_free.glb',
      (gltf: GLTF) => {
        // gltf.scene is a THREE.Group
        const model = gltf.scene;
        // If for any reason model is undefined:
        if (!model) return;

        this.scene.add(model);
        model.position.set(0, 0, 0);

        // tells CharacterController about the loaded model
        this.characterController.setCharacter(model);
      },
      undefined,
      (error) => {
        console.error('Error loading character:', error);
      }
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

    //movement update
    this.characterController.update(this.keys);

    //make camera follow
    const charPos = this.characterController.getPosition();
    if (charPos) {
      this.camera.position.x = charPos.x;
      this.camera.position.z = charPos.z + 5;
    }

    //const delta = this.clock.getDelta();

    this.renderer.render(this.scene, this.camera);
  }

  public onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
