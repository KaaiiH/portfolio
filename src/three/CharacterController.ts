import * as THREE from 'three';

/**
 * handles character movement and any future logic (e.g., jumping, animations).
 */
export class CharacterController {
  private character: THREE.Group | null = null;

  
  constructor() {}

  /**
   * sets the 3D model for the character.
   * @param model A Three.js Group (e.g., from a GLTF file)
   */
  public setCharacter(model: THREE.Group) {
    this.character = model;
  }

  /**
   * moves the character based on current key presses.
   * @param keys The record of keyboard states (e.g., { KeyW: true, ... })
   */
  public update(keys: Record<string, boolean>) {
    if (!this.character) return;

    const speed = 0.05;

    if (keys['KeyW']) {
      this.character.position.z -= speed;
    }
    if (keys['KeyS']) {
      this.character.position.z += speed;
    }
    if (keys['KeyA']) {
      this.character.position.x -= speed;
    }
    if (keys['KeyD']) {
      this.character.position.x += speed;
    }
  }

  /**
   * returns the character’s current position for camera following or other logic.
   */
  public getPosition(): THREE.Vector3 | null {
    if (!this.character) return null;
    return this.character.position.clone();
  }
}
