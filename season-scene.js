/* Season selection, snow footprints, and summer fruit. */
(function (root) {
  const MODES = {
    spring: { bare: 0, snow: 0, fall: 0, autumn: 0, bud: 0.22, spring: 1, summer: 0 },
    summer: { bare: 0, snow: 0, fall: 0, autumn: 0, bud: 0, spring: 0, summer: 1 },
    autumn: { bare: 0.12, snow: 0, fall: 0, autumn: 1, bud: 0, spring: 0, summer: 0 },
    winter: { bare: 1, snow: 1, fall: 1, autumn: 0, bud: 0, spring: 0, summer: 0 },
  };
  const labels = { vi: ['Tự động', 'Mùa xuân', 'Mùa hạ', 'Mùa thu', 'Mùa đông'], en: ['Automatic', 'Spring', 'Summer', 'Autumn', 'Winter'] };
  const valid = mode => mode === 'auto' || Object.hasOwn(MODES, mode);

  class SeasonControl {
    constructor(select, storage) {
      this.select = select;
      this.storage = storage;
      let saved;
      try { saved = storage().getItem('wishing-tree-season'); } catch {}
      this.mode = valid(saved) ? saved : 'auto';
      this.state = null;
      select.value = this.mode;
      select.addEventListener('change', () => this.setMode(select.value));
      select.addEventListener('keydown', event => event.stopPropagation());
    }
    setMode(mode) {
      if (!valid(mode)) return;
      this.mode = mode;
      this.select.value = mode;
      try { this.storage().setItem('wishing-tree-season', mode); } catch {}
    }
    labels(lang) {
      const texts = labels[lang] || labels.en;
      for (let i = 0; i < this.select.options.length; i++) this.select.options[i].textContent = texts[i];
      this.select.setAttribute('aria-label', lang === 'vi' ? 'Chọn mùa' : 'Choose season');
    }
    update(dt, automatic) {
      const target = this.mode === 'auto' ? automatic : MODES[this.mode];
      if (!this.state) this.state = { ...target };
      for (const key of Object.keys(target)) {
        const difference = target[key] - this.state[key];
        this.state[key] = Math.abs(difference) < 0.003 ? target[key] : this.state[key] + difference * (1 - Math.exp(-dt * 0.85));
      }
      return this.state;
    }
  }

  function footprintTexture(THREE) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(62, 8); ctx.bezierCurveTo(108, 3, 117, 56, 104, 108);
    ctx.bezierCurveTo(100, 134, 81, 158, 91, 180); ctx.bezierCurveTo(101, 217, 96, 247, 66, 247);
    ctx.bezierCurveTo(34, 247, 26, 222, 35, 182); ctx.bezierCurveTo(40, 162, 19, 135, 16, 103);
    ctx.bezierCurveTo(3, 52, 17, 10, 62, 8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Gaps and shallow tread grooves in the compacted snow.
    ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 27; y < 142; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y + 12); ctx.lineTo(128, y);
      ctx.lineTo(128, y + 6); ctx.lineTo(64, y + 18); ctx.lineTo(0, y + 6); ctx.closePath(); ctx.fill();
    }
    for (let y = 185; y < 236; y += 17) ctx.fillRect(0, y, 128, 5);
    ctx.fillRect(59, 8, 8, 240); ctx.fillRect(15, 151, 100, 7);
    ctx.restore();
    return new THREE.CanvasTexture(c);
  }

  // The meadow is a fixed radial triangle grid (70 rings, 160 sectors).
  // Sample its actual triangles instead of raycasting the entire mesh every step.
  function createTerrainSampler(terrain, ground) {
    const vertices = terrain.geometry.getAttribute('position');
    const rings = 70, sectors = 160, stride = sectors + 1;
    if (vertices.count !== (rings + 1) * stride) return ground;
    const maxRadius = Math.abs(vertices.getX(rings * stride));
    function interpolate(x, z, a, b, c) {
      const ax = vertices.getX(a), az = vertices.getZ(a), bx = vertices.getX(b), bz = vertices.getZ(b), cx = vertices.getX(c), cz = vertices.getZ(c);
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denominator) < 1e-10) return null;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
      const w = 1 - u - v;
      return Math.min(u, v, w) >= -1e-6 ? u * vertices.getY(a) + v * vertices.getY(b) + w * vertices.getY(c) : null;
    }
    return (x, z) => {
      const radius = Math.hypot(x, z);
      if (radius < 1e-6 || radius > maxRadius) return ground(x, z);
      const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
      const sector = Math.min(sectors - 1, Math.floor(angle / (Math.PI * 2) * sectors));
      const approximateRing = Math.min(rings - 1, Math.floor(rings * Math.pow(radius / maxRadius, 1 / 1.6)));
      for (let ring = Math.max(0, approximateRing - 1); ring <= Math.min(rings - 1, approximateRing + 1); ring++) {
        const a = ring * stride + sector, b = a + 1, c = a + stride, d = c + 1;
        const y = interpolate(x, z, a, b, c) ?? interpolate(x, z, b, d, c);
        if (y !== null) return y;
      }
      return ground(x, z);
    };
  }

  class SnowFootprints {
    constructor(THREE, scene, terrain, ground) {
      this.THREE = THREE; this.terrain = terrain; this.ground = ground;
      this.capacity = 120; this.verticesPerMark = 9; this.next = 0; this.side = -1;
      this.marks = new Float32Array(this.capacity);
      const count = this.capacity * this.verticesPerMark;
      this.positions = new Float32Array(count * 3); this.alpha = new Float32Array(count);
      const normals = new Float32Array(count * 3), uv = [], index = [];
      for (let mark = 0; mark < this.capacity; mark++) {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
          normals[(mark * 9 + y * 3 + x) * 3 + 1] = 1;
          uv.push(x / 2, y / 2);
          if (x < 2 && y < 2) { const a = mark * 9 + y * 3 + x; index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('aFootOpacity', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(index);
      const mat = new THREE.MeshLambertMaterial({ map: footprintTexture(THREE), color: 0x687b91, transparent: true, depthWrite: false, alphaTest: 0.012, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      mat.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFootOpacity; varying float vFootOpacity;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFootOpacity = aFootOpacity;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFootOpacity;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFootOpacity;');
      };
      this.mesh = new THREE.Mesh(geo, mat); this.mesh.name = 'Footprints on snow';
      this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.visible = false; this.mesh.renderOrder = 1;
      scene.add(this.mesh);
      this.sampleTerrain = createTerrainSampler(terrain, ground);
    }
    height(x, z) { return this.sampleTerrain(x, z) + 0.009; }
    step(x, z, dx, dz, snow) {
      if (snow < 0.48) return false;
      const length = Math.hypot(dx, dz); if (length < 0.001) return false;
      dx /= length; dz /= length;
      this.side *= -1;
      const rx = -dz, rz = dx;
      const cx = x + rx * 0.115 * this.side, cz = z + rz * 0.115 * this.side;
      const turn = this.side * 0.10, cs = Math.cos(turn), sn = Math.sin(turn);
      const fx = dx * cs - dz * sn, fz = dx * sn + dz * cs;
      const sx = -fz, sz = fx;
      const mark = this.next; this.next = (mark + 1) % this.capacity;
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const i = mark * 9 + row * 3 + col;
        const u = (col / 2 - 0.5) * 0.19, v = (row / 2 - 0.5) * 0.34;
        const px = cx + sx * u + fx * v, pz = cz + sz * u + fz * v;
        this.positions.set([px, this.height(px, pz), pz], i * 3);
        this.alpha[i] = 0.83;
      }
      this.marks[mark] = 1;
      this.mesh.geometry.attributes.position.needsUpdate = true;
      this.mesh.geometry.attributes.aFootOpacity.needsUpdate = true;
      this.mesh.visible = true;
      return true;
    }
    update(dt, snow, snowfall) {
      if (snow < 0.06) {
        if (this.mesh.visible) { this.marks.fill(0); this.alpha.fill(0); this.mesh.geometry.attributes.aFootOpacity.needsUpdate = true; this.mesh.visible = false; }
        return;
      }
      if (!this.mesh.visible) return;
      let active = false;
      const cover = Math.min(1, snow / 0.48);
      for (let i = 0; i < this.capacity; i++) {
        if (this.marks[i] <= 0) continue;
        this.marks[i] = Math.max(0, this.marks[i] - dt * (0.002 + 0.009 * snowfall));
        if (this.marks[i] > 0) active = true;
        this.alpha.fill(0.83 * this.marks[i] * cover, i * 9, i * 9 + 9);
      }
      this.mesh.geometry.attributes.aFootOpacity.needsUpdate = true;
      this.mesh.visible = active;
    }
  }

  class SummerFruit {
    constructor(THREE, scene, ground, tree, branchMotion = () => {}) {
      this.T = THREE; this.ground = ground; this.tree = tree; this.branchMotion = branchMotion;
      this.items = []; this.hanging = []; this.timer = 0; this.active = false;
      this.groundLimit = 48; this.hangingLimit = 60; this.limit = this.groundLimit + this.hangingLimit;
      this.matrix = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.scale = new THREE.Vector3(); this.pos = new THREE.Vector3();
      this.offset = new THREE.Vector3(); this.spinAxis = new THREE.Vector3(0.5, 0, 0.7).normalize();
      this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 }), this.limit);
      this.mesh.name = 'Summer fruit on branches and meadow'; this.mesh.count = 0; this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; this.mesh.visible = false;
      scene.add(this.mesh);
      this.stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.013, 0.055, 5), new THREE.MeshStandardMaterial({ color: 0x57432c, roughness: 1 }), this.limit);
      this.stems.name = 'Fruit stems'; this.stems.count = 0; this.stems.frustumCulled = false; this.stems.visible = false; this.stems.castShadow = true; scene.add(this.stems);
      this.colors = [0x9e4829, 0xc98539, 0x9b6b38, 0x8b9142, 0xc76137].map(c => new THREE.Color(c));
    }
    createFruit(radius) {
      return { pos: new this.T.Vector3(), r: radius, vx: 0, vy: 0, vz: 0, rolling: 0, landed: false, color: this.colors[Math.floor(Math.random() * this.colors.length)] };
    }
    keepGroundFruit(fruit) {
      if (this.items.length >= this.groundLimit) this.items.shift();
      this.items.push(fruit);
    }
    seedGround() {
      const fruit = this.createFruit(0.14 + Math.random() * 0.055);
      const angle = Math.random() * Math.PI * 2, distance = 0.9 + Math.random() * 4.3;
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
      fruit.pos.set(x, this.ground(x, z) + fruit.r * 0.63, z);
      fruit.landed = true;
      this.keepGroundFruit(fruit);
    }
    seedCanopy() {
      // Perches are sampled from the actual woody branches; each has radius and wind weights.
      const candidates = (this.tree.perches || []).filter(p => p.r >= 0.02 && p.r <= 0.13 &&
        Math.hypot(p.pos.x, p.pos.z) > 1.5 && p.pos.y > this.ground(p.pos.x, p.pos.z) + 2.2);
      // Sample across all limbs, prioritising the lower branches visible from the meadow.
      const ordered = candidates.map(perch => ({ perch, score: perch.pos.y + Math.random() * 6 })).sort((a, b) => a.score - b.score);
      for (const { perch } of ordered) {
        if (this.hanging.length >= this.hangingLimit) break;
        if (this.hanging.some(slot => slot.perch.pos.distanceToSquared(perch.pos) < 0.52 * 0.52)) continue;
        this.hanging.push({ perch, fruit: this.createFruit(0.12 + Math.random() * 0.045), growth: 1, regrow: 0 });
      }
    }
    placeHanging(slot, time, scale) {
      const fruit = slot.fruit, branch = slot.perch;
      this.offset.set(0, 0, 0); this.branchMotion(this.offset, branch, time);
      fruit.pos.copy(branch.pos).add(this.offset);
      // The perch sits on the branch's top; the hanging stem reaches its underside.
      fruit.pos.y -= 2 * branch.r + (fruit.r * 0.83 + 0.044) * scale;
    }
    detach(time, scale) {
      const ready = this.hanging.filter(slot => slot.fruit && slot.growth >= 0.98);
      if (!ready.length) return;
      const slot = ready[Math.floor(Math.random() * ready.length)];
      this.placeHanging(slot, time, scale);
      const fruit = slot.fruit;
      fruit.vx = (Math.random() - 0.5) * 0.55; fruit.vz = (Math.random() - 0.5) * 0.55; fruit.vy = 0;
      this.keepGroundFruit(fruit);
      slot.fruit = null; slot.regrow = 20 + Math.random() * 25; slot.growth = 0;
    }
    drawFruit(fruit, index, scale, hanging) {
      if (hanging) this.q.identity();
      else this.q.setFromAxisAngle(this.spinAxis, fruit.rolling + index * 1.7);
      const radius = fruit.r * scale; this.scale.set(radius, radius * 0.83, radius);
      this.matrix.compose(fruit.pos, this.q, this.scale); this.mesh.setMatrixAt(index, this.matrix); this.mesh.setColorAt(index, fruit.color);
      this.pos.set(0, radius * 0.83 + 0.016 * scale, 0).applyQuaternion(this.q).add(fruit.pos);
      this.scale.setScalar(scale);
      this.matrix.compose(this.pos, this.q, this.scale); this.stems.setMatrixAt(index, this.matrix);
    }
    update(dt, amount, time = 0) {
      if (amount < 0.03) { this.mesh.visible = this.stems.visible = false; this.items.length = this.hanging.length = 0; this.active = false; return; }
      if (!this.active && amount > 0.35) {
        this.active = true; this.timer = 1.2;
        for (let i = 0; i < 18; i++) this.seedGround();
        this.seedCanopy();
      }
      const scale = Math.min(1, amount * 1.5);
      if (this.active && amount > 0.6 && (this.timer -= dt) <= 0) { this.detach(time, scale); this.timer = 2.2 + Math.random() * 3.5; }
      let index = 0;
      for (const fruit of this.items) {
        if (!fruit.landed) {
          fruit.vy -= 9.8 * dt; fruit.pos.x += fruit.vx * dt; fruit.pos.z += fruit.vz * dt; fruit.pos.y += fruit.vy * dt;
          const surface = this.ground(fruit.pos.x, fruit.pos.z) + fruit.r * 0.63;
          if (fruit.pos.y <= surface) { fruit.pos.y = surface; fruit.vy *= -0.22; fruit.vx *= 0.55; fruit.vz *= 0.55; if (fruit.vy < 0.45) fruit.landed = true; }
          fruit.rolling += (Math.abs(fruit.vy) + 0.3) * dt;
        }
        this.drawFruit(fruit, index++, scale, false);
      }
      for (const slot of this.hanging) {
        if (!slot.fruit && (slot.regrow -= dt) <= 0) { slot.fruit = this.createFruit(0.12 + Math.random() * 0.045); slot.growth = 0; }
        if (!slot.fruit) continue;
        slot.growth = Math.min(1, slot.growth + dt * 0.15);
        const growthScale = Math.max(0.001, scale * slot.growth);
        this.placeHanging(slot, time, growthScale);
        this.drawFruit(slot.fruit, index++, growthScale, true);
      }
      this.mesh.visible = this.stems.visible = index > 0; this.mesh.count = this.stems.count = index;
      this.mesh.instanceMatrix.needsUpdate = this.stems.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  const api = { SeasonControl, SnowFootprints, SummerFruit, createTerrainSampler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WishingTreeSeasons = api;
})(globalThis);
