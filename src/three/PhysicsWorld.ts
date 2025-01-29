import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  public world: CANNON.World;

  public blockBody: CANNON.Body | null = null;
  public characterBody: CANNON.Body | null = null;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);


    const floorBody = new CANNON.Body({
      mass: 0, 
      shape: new CANNON.Plane(),
    });
    const q = new CANNON.Quaternion();
    q.setFromEuler(-Math.PI / 2, 0, 0);
    floorBody.quaternion.copy(q);

    this.world.addBody(floorBody);
  }


  public createBlockBody(x: number, y: number, z: number) {
    const halfExtents = new CANNON.Vec3(1, 1, 1);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
      mass: 0,
      shape,
    });
    body.position.set(x, y, z);

    this.world.addBody(body);
    this.blockBody = body;
  }

  public createCharacterBody(x: number, y: number, z: number) {
    const radius = 0.5;
    const shape = new CANNON.Sphere(radius);

    const body = new CANNON.Body({
      mass: 1, 
      shape,
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.9,
      angularDamping: 1.0,
    });
    
    this.world.addBody(body);
    this.characterBody = body;
  }

  public update(dt: number) {
    this.world.step(1 / 60, dt, 3);
  }
}
