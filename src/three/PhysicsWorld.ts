import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  public world: CANNON.World;
  public characterBody: CANNON.Body | null = null;
  private floorBody: CANNON.Body;
  private blockBodies: CANNON.Body[] = [];

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -20, 0)
    });

    // Set solver iterations for stability
    this.world.defaultContactMaterial.contactEquationStiffness = 1e6;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;

    // Create floor with zero bounce and high friction
    const floorShape = new CANNON.Plane();
    const floorMaterial = new CANNON.Material({
      friction: 1.0,
      restitution: 0.0
    });
    
    this.floorBody = new CANNON.Body({
      mass: 0,
      shape: floorShape,
      material: floorMaterial
    });
    this.floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(this.floorBody);
  }

  createCharacterBody(x: number, y: number, z: number) {
    // Create character physics body with zero bounce
    const shape = new CANNON.Sphere(0.5);
    const characterMaterial = new CANNON.Material({
      friction: 1.0,
      restitution: 0.0
    });

    this.characterBody = new CANNON.Body({
      mass: 1,
      shape: shape,
      material: characterMaterial,
      position: new CANNON.Vec3(x, y, z),
      fixedRotation: true,
      linearDamping: 0.9,
      allowSleep: false,
      collisionFilterGroup: 1,
      collisionFilterMask: 1
    });

    // Create contact material between character and floor with zero bounce
    const characterFloorContact = new CANNON.ContactMaterial(
      characterMaterial,
      this.floorBody.material as CANNON.Material,
      {
        friction: 1.0,
        restitution: 0.0,
        contactEquationStiffness: 1e6,
        contactEquationRelaxation: 3
      }
    );
    this.world.addContactMaterial(characterFloorContact);

    this.world.addBody(this.characterBody);
  }

  createBlockBody(x: number, y: number, z: number) {
    const shape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 1));
    const blockMaterial = new CANNON.Material({
      friction: 0.3,
      restitution: 0.0 // Zero bounce
    });

    const blockBody = new CANNON.Body({
      mass: 0,
      shape: shape,
      material: blockMaterial,
      position: new CANNON.Vec3(x, y, z),
      fixedRotation: true,
      linearDamping: 0.3,
      angularDamping: 0.3
    });

    // Create contact material between block and floor with zero bounce
    const blockFloorContact = new CANNON.ContactMaterial(
      blockMaterial,
      this.floorBody.material as CANNON.Material,
      {
        friction: 0.5,
        restitution: 0.0, // Zero bounce
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8,
        frictionEquationRelaxation: 3
      }
    );
    this.world.addContactMaterial(blockFloorContact);

    this.blockBodies.push(blockBody);
    this.world.addBody(blockBody);
  }

  update(dt: number) {
    if (this.characterBody) {
      // Prevent any upward velocity when on ground
      if (this.isCharacterOnGround()) {
        this.characterBody.velocity.y = Math.min(0, this.characterBody.velocity.y);
      }
      
      // Limit maximum velocity more strictly
      const maxVelocity = 5;
      const velocity = this.characterBody.velocity;
      if (Math.abs(velocity.y) > maxVelocity) {
        velocity.y = Math.sign(velocity.y) * maxVelocity;
      }
    }
    
    // Use fixed timestep for stability
    const fixedTimeStep = 1/60;
    const maxSubSteps = 3;
    this.world.step(fixedTimeStep, dt, maxSubSteps);
  }

  isCharacterOnGround(): boolean {
    if (!this.characterBody) return false;

    // More lenient ground check
    const height = this.characterBody.position.y;
    return height <= 0.55; // Slightly higher threshold
  }
}
