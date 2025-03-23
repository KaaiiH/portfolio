// src/three/CharacterController.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class CharacterController {
  private character: THREE.Object3D | null = null;
  private characterBody: CANNON.Body | null = null;
  private moveSpeed = 15;
  private jumpForce = 5;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private canJump = true;
  private isJumping = false;
  private lastJumpTime = 0;
  private jumpCooldown = 500;
  private groundCheckDistance = 0.1;
  private minHeight = 0.5;
  private lastGroundedTime = 0;
  private groundedThreshold = 100; // ms to remember grounded state
  private groundCheckRay: CANNON.Ray | null = null;

  constructor() {}

  setCharacter(character: THREE.Object3D) {
    this.character = character;
  }

  getCharacter(): THREE.Object3D | null {
    return this.character;
  }

  getPosition(): THREE.Vector3 | null {
    if (!this.character) return null;
    return this.character.position;
  }

  setCharacterBody(body: CANNON.Body) {
    this.characterBody = body;
  }

  update(keys: { [key: string]: boolean }) {
    if (!this.character || !this.characterBody) return;

    // Reset horizontal velocity
    this.characterBody.velocity.x = 0;
    this.characterBody.velocity.z = 0;

    // Calculate movement direction
    this.direction.set(0, 0, 0);
    if (keys['KeyW']) this.direction.z = -1;
    if (keys['KeyS']) this.direction.z = 1;
    if (keys['KeyA']) this.direction.x = -1;
    if (keys['KeyD']) this.direction.x = 1;

    // Normalize direction and apply movement
    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      // Always maintain full speed unless falling rapidly
      const speedMultiplier = (!this.isOnGround() && this.characterBody.velocity.y < -5) ? 0.8 : 1.0;
      this.characterBody.velocity.x = this.direction.x * this.moveSpeed * speedMultiplier;
      this.characterBody.velocity.z = this.direction.z * this.moveSpeed * speedMultiplier;
    }

    // More aggressive ground correction
    if (this.characterBody.position.y < this.minHeight + 0.1) {
      this.characterBody.position.y = this.minHeight + 0.1;
      if (this.characterBody.velocity.y < 0) {
        this.characterBody.velocity.y = 0;
      }
    }

    // Update character position from physics body
    this.character.position.copy(this.characterBody.position as unknown as THREE.Vector3);
  }

  jump() {
    if (!this.characterBody || !this.isOnGround() || this.isJumping) return;

    // Check jump cooldown
    const now = Date.now();
    if (now - this.lastJumpTime < this.jumpCooldown) return;
    this.lastJumpTime = now;

    // Apply upward impulse for jump with a bit more force
    this.characterBody.velocity.y = this.jumpForce;
    this.characterBody.position.y = this.minHeight + 0.2; // Bigger boost to ensure clean takeoff
    this.isJumping = true;

    // Reset jump state when landing
    const checkLanding = () => {
      if (this.isOnGround()) {
        this.isJumping = false;
        if (this.characterBody) {
          this.characterBody.position.y = this.minHeight + 0.1;
          this.characterBody.velocity.y = 0;
        }
      } else {
        requestAnimationFrame(checkLanding);
      }
    };
    requestAnimationFrame(checkLanding);
  }

  isOnGround(): boolean {
    if (!this.characterBody) return false;
    
    const height = this.characterBody.position.y;
    const velocity = this.characterBody.velocity.y;
    const now = Date.now();
    
    // More lenient ground check with time threshold
    if (height <= this.minHeight + 0.2 && Math.abs(velocity) < 0.5) {
      this.lastGroundedTime = now;
      return true;
    }

    // Consider still grounded for a short time after leaving ground
    // This helps with jump responsiveness
    return now - this.lastGroundedTime < this.groundedThreshold;
  }

  computeRotationForVisual(): number {
    if (!this.characterBody) return 0;

    const velocity = this.characterBody.velocity;
    if (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.z) < 0.1) {
      return this.character?.rotation.y || 0;
    }

    // Add π/2 (90 degrees) for initial alignment plus π (180 degrees) for final orientation
    return Math.atan2(-velocity.x, -velocity.z) + Math.PI * 1.5;
  }
}
