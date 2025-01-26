import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  public world: CANNON.World;

  public blockBody: CANNON.Body | null = null;
  public characterBody: CANNON.Body | null = null;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);

    const floorBody = new CANNON.Body({
      mass: 0, // static
      shape: new CANNON.Plane(),
    });
    // rotate plane so it’s horizontal at y=0
    const q = new CANNON.Quaternion();
    q.setFromEuler(-Math.PI / 2, 0, 0);
    floorBody.quaternion.copy(q);

    this.world.addBody(floorBody);
  }

  //Create a static 2x2x2 block at the given position.
  public createBlockBody(x: number, y: number, z: number) {
    const halfExtents = new CANNON.Vec3(1, 1, 1);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
      mass: 0, // static
      shape,
    });
    body.position.set(x, y, z);

    this.world.addBody(body);
    this.blockBody = body;
  }

  ///Create a dynamic "character" body at the given position.
  public createCharacterBody(x: number, y: number, z: number) {
    // A small sphere for the character
    const radius = 0.5;
    const shape = new CANNON.Sphere(radius);

    const body = new CANNON.Body({
      mass: 1, // dynamic
      shape,
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.9, // to prevent slidding
      angularDamping: 1.0, // no spin (maybe add in future for orientation)
    });

    this.world.addBody(body);
    this.characterBody = body;
  }

  public update(dt: number) {
    // step with a fixed timestep
    this.world.step(1 / 60, dt, 3);
  }
}
