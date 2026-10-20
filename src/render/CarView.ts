import * as THREE from 'three';
import { Car } from '../car/Car';
import { TUNING } from '../config/tuning';

/** Placeholder 3D look for the car: low wedge body, glass canopy, wheels, thruster flame. */
export class CarView {
  readonly group = new THREE.Group();
  private readonly wheels: THREE.Object3D[] = [];
  private readonly flame: THREE.Mesh;
  private readonly underglow: THREE.MeshStandardMaterial;
  private flameLeft = 0;

  constructor(private readonly car: Car, scene: THREE.Scene) {
    const { length, height, wheelRadius } = TUNING.car;
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf5, metalness: 0.6, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1d6f93, metalness: 0.2, roughness: 0.1, emissive: 0x0a2a3a });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.8 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x9aa4b5, metalness: 0.8, roughness: 0.3 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff2040, emissiveIntensity: 1.2 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.2 });
    this.underglow = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, emissive: 0x4cc9f0, emissiveIntensity: 0 });

    // Wedge body: tall at the back, sloping to a low nose.
    const side = new THREE.Shape();
    const L = length / 2;
    const H = height / 2;
    side.moveTo(-L, -H);
    side.lineTo(L, -H);
    side.lineTo(L, -H + 0.35);
    side.lineTo(L * 0.2, H * 0.55);
    side.lineTo(-L * 0.75, H);
    side.lineTo(-L, H * 0.4);
    side.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(side, { depth: 1.8, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
    bodyGeo.translate(0, 0, -0.9);
    const body = new THREE.Mesh(bodyGeo, paint);
    body.castShadow = true;
    this.group.add(body);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(1.15, 0.42, 0.75);
    canopy.position.set(-0.45, H * 0.45, 0);
    this.group.add(canopy);

    for (const z of [-0.7, 0.7]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.45), red);
      tail.position.set(-L - 0.05, H * 0.5, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), white);
      head.position.set(L + 0.05, -H + 0.25, z);
      this.group.add(tail, head);
    }

    const glow = new THREE.Mesh(new THREE.BoxGeometry(length * 0.8, 0.05, 1.5), this.underglow);
    glow.position.y = -H - 0.02;
    this.group.add(glow);

    for (let i = 0; i < 2; i++) {
      const wheel = new THREE.Group();
      for (const z of [-0.95, 0.95]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.38, 20), tyre);
        t.rotation.x = Math.PI / 2;
        t.position.z = z;
        t.castShadow = true;
        const r = new THREE.Mesh(new THREE.BoxGeometry(wheelRadius * 1.3, 0.12, 0.4), rim);
        r.position.z = z + Math.sign(z) * 0.01;
        wheel.add(t, r);
      }
      this.wheels.push(wheel);
      this.group.add(wheel);
    }

    // Thruster flame: a cone pointing out of the floor, shown on each hop.
    this.flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 2.2, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flame.rotation.x = Math.PI; // tip down
    this.flame.position.y = -H - 1.1;
    this.flame.visible = false;
    this.group.add(this.flame);

    car.events.on('thrust', () => (this.flameLeft = 0.4));
    scene.add(this.group);
  }

  update(dt: number): void {
    const { x, y } = this.car.position;
    this.group.position.set(x, y, 0);
    this.group.rotation.z = this.car.angle;

    this.car.wheelVisuals.forEach((w, i) => {
      this.wheels[i].position.set(w.x, w.y, 0);
      this.wheels[i].rotation.z = w.spin;
    });

    this.flameLeft = Math.max(0, this.flameLeft - dt);
    const f = this.flameLeft / 0.4;
    this.flame.visible = f > 0;
    this.flame.scale.set(0.6 + 0.4 * f, f, 0.6 + 0.4 * f);
    this.flame.position.y = -TUNING.car.height / 2 - 1.1 * f;

    const target = this.car.isStuck ? 1.6 : 0;
    this.underglow.emissiveIntensity += (target - this.underglow.emissiveIntensity) * Math.min(1, dt * 12);
  }
}
