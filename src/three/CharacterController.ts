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
    const direction = new THREE.Vector2(0, 0);

    if (keys['KeyW']) {
      direction.y -= 1
    }
    if (keys['KeyS']) {
      direction.y += 1
    }
    if (keys['KeyA']) {
      direction.x -= 1;
    }
    if (keys['KeyD']) {
      direction.x += 1;
    }

    // Normalize so that diagonal speed isn't faster than straight.
    if (direction.length() > 0) {
      direction.normalize(); // now length is 1
    }

    // Move character in that direction (scaled by speed).
    this.character.position.x += direction.x * speed;
    this.character.position.z += direction.y * speed;

    if (direction.length() > 0) {
      // Because the model rotation.y = 0 means it faces +Z
      // we can use the formula:  angle = atan2(direction.x, direction.y) + PI/2.
      const angle = Math.atan2(direction.x, direction.y) + Math.PI / 2;
      this.character.rotation.y = angle;
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
