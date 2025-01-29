// src/three/CharacterController.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class CharacterController {
  private characterModel: THREE.Group | null = null;
  private characterBody: CANNON.Body | null = null;

  private lastAngle = 0;

  constructor() {}

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

    const speed = 15; 
    const velocity = new CANNON.Vec3(
      0,
      this.characterBody.velocity.y,
      0
    );

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

  /**
   * a small downward raycast to see if there's ground within 0.55 units
   * (our sphere radius is 0.5). If so, we consider ourselves on the ground.
   */
  private isOnGround(): boolean {
    if (!this.characterBody) return false;
    const from = this.characterBody.position.clone();
    const to = from.clone();
    to.y -= 0.55; // a bit more than radius


    const result = new CANNON.RaycastResult();
    if (!this.characterBody.world) return false;
    this.characterBody.world.raycastClosest(from, to, {}, result);

    return result.hasHit;
  }

  
  public jump() {
    if (!this.characterBody) return;
    if (this.isOnGround()) {
      this.characterBody.velocity.y = 10; // big enough to get on top
    }
  }


  public computeRotationForVisual(): number {
    if (!this.characterBody) return this.lastAngle;

    const vx = this.characterBody.velocity.x;
    const vz = this.characterBody.velocity.z;
    const speedSq = vx * vx + vz * vz;
    if (speedSq < 0.001) {
      return this.lastAngle;
    }

    // If the model faces +Z by default, angle = atan2(vx, vz) + π/2
    const angle = Math.atan2(vx, vz) + Math.PI / 2;
    this.lastAngle = angle;
    return angle;
  }

  public getPosition(): THREE.Vector3 | null {
    if (!this.characterBody) return null;
    const p = this.characterBody.position;
    return new THREE.Vector3(p.x, p.y, p.z);
  }
}
