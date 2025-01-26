import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * handles character movement and any future logic (e.g., jumping, animations).
 */
export class CharacterController {
  private characterModel: THREE.Group | null = null;
  private characterBody: CANNON.Body | null = null;

  constructor() {}

  /**
   * sets the 3D model for the character.
   * @param model A Three.js Group (e.g., from a GLTF file)
   */
  public setCharacter(model: THREE.Group) {
    this.characterModel = model;
  }

  public setCharacterBody(body: CANNON.Body) {
    this.characterBody = body;
  }

  public getCharacter(): THREE.Group | null {
    return this.characterModel;
  }

  public update(keys: Record<string, boolean>) {
    if (!this.characterBody) return;

    const speed = 15; // SPEED VARIABLE
    const velocity = new CANNON.Vec3(0, this.characterBody.velocity.y, 0);

    if (keys['KeyW']) {
      velocity.z = -speed;
    } else if (keys['KeyS']) {
      velocity.z = speed;
    }

    if (keys['KeyA']) {
      velocity.x = -speed;
    } else if (keys['KeyD']) {
      velocity.x = speed;
    }

    this.characterBody.velocity.copy(velocity);
  }


  public computeRotationForVisual(): number {
    if (!this.characterBody) return 0;

    const vx = this.characterBody.velocity.x;
    const vz = this.characterBody.velocity.z;
    if (Math.abs(vx) < 0.001 && Math.abs(vz) < 0.001) {
      return 0;
    }
    return Math.atan2(vx, vz) + Math.PI / 2;
  }

  public getPosition(): THREE.Vector3 | null {
    if (!this.characterBody) return null;
    const p = this.characterBody.position;
    return new THREE.Vector3(p.x, p.y, p.z);
  }
}
