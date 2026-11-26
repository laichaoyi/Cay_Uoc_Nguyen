/* Surface roots and lightweight leafless trees for the winter scene. */
(function (root) {
  function tubeGeometry(THREE, paths) {
    const positions = [], uvs = [], colors = [], indices = [];
    for (const { points, radii, sides, tint, flatten = 1 } of paths) {
      const first = positions.length / 3;
      let distance = 0;
      for (let i = 0; i < points.length; i++) {
        if (i) distance += points[i].distanceTo(points[i - 1]);
        const tangent = points[Math.min(i + 1, points.length - 1)].clone()
          .sub(points[Math.max(0, i - 1)]).normalize();
        const reference = Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, reference).normalize();
        const up = new THREE.Vector3().crossVectors(tangent, side).normalize();
        for (let j = 0; j <= sides; j++) {
          const angle = j / sides * Math.PI * 2;
          const vertex = points[i].clone().addScaledVector(side, Math.cos(angle) * radii[i])
            .addScaledVector(up, Math.sin(angle) * radii[i] * flatten);
          positions.push(vertex.x, vertex.y, vertex.z);
          uvs.push(j / sides * Math.max(1, Math.PI * 2 * radii[0] / 1.3), distance / 1.3);
          colors.push(tint, tint, tint);
          if (i < points.length - 1 && j < sides) {
            const a = first + i * (sides + 1) + j;
            const b = a + 1, c = a + sides + 1, d = c + 1;
            indices.push(a, b, c, b, d, c);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function addRoots(THREE, scene, ground, tree) {
    // A few irregular, partly exposed root ridges, rather than long radial logs.
    const forms = [
      [0.38, 1.45, 0.25, -0.40, 0.10],
      [2.05, 1.15, 0.20, 0.32, 0.075],
      [4.56, 1.7, 0.26, 0.45, 0.115],
    ];
    const paths = forms.map(([angle, length, thickness, curve, crest], index) => {
      const points = [], radii = [];
      const flatten = 0.55;
      for (let j = 0; j <= 18; j++) {
        const t = j / 18;
        const distance = 0.25 + length * t;
        const turn = angle + curve * t + Math.sin(t * 7 + index * 1.7) * 0.10 * t;
        const x = Math.cos(turn) * distance;
        const z = Math.sin(turn) * distance;
        const radius = thickness * Math.pow(1 - t, 1.25) * (1 + 0.09 * Math.sin(t * 13 + index)) + 0.009;
        const rise = crest * (1 - t) * (0.8 + 0.2 * Math.sin(t * 8 + index));
        const bury = 0.10 * Math.pow(t, 1.65);
        const center = ground(x, z) + rise - radius * flatten - bury;
        points.push(new THREE.Vector3(x, center, z));
        radii.push(radius);
      }
      return { points, radii, sides: 12, tint: 1.05 + index * 0.035, flatten };
    });
    const geometry = tubeGeometry(THREE, paths);
    const count = geometry.getAttribute('position').count;
    // Reuse the trunk's bark shader, with wind displacement disabled for fixed roots.
    geometry.setAttribute('aW', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
    geometry.setAttribute('aPh', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
    const roots = new THREE.Mesh(geometry, tree.materials.bark);
    roots.name = 'Exposed roots of the Wishing Tree';
    roots.customDepthMaterial = tree.materials.barkDepth;
    roots.castShadow = roots.receiveShadow = true;
    scene.add(roots);
    return roots;
  }

  function addLeaflessForest(THREE, scene, summer, material) {
    const path = (points, radii) => ({ points: points.map(p => new THREE.Vector3(...p)), radii, sides: 5, tint: 1 });
    const branches = [path([[0, -0.55, 0], [0.02, 0.03, 0], [-0.035, 0.48, 0.02], [0.015, 0.83, 0]], [0.085, 0.066, 0.036, 0.007])];
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.4;
      const x = Math.cos(angle), z = Math.sin(angle);
      const y = -0.02 + i * 0.087;
      const reach = 0.66 - i * 0.045;
      branches.push(path([[0, y, 0], [x * reach * 0.53, y + 0.15, z * reach * 0.53], [x * reach, y + 0.32, z * reach]], [0.042, 0.026, 0.005]));
      branches.push(path([[x * reach * 0.44, y + 0.12, z * reach * 0.44], [x * reach * 0.60 - z * 0.15, y + 0.39, z * reach * 0.60 + x * 0.15]], [0.019, 0.004]));
    }
    const bare = new THREE.InstancedMesh(tubeGeometry(THREE, branches), material, summer.count);
    const transform = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < summer.count; i++) {
      summer.getMatrixAt(i, transform);
      bare.setMatrixAt(i, transform);
      const tone = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const shade = Math.abs(tone) * 0.035;
      bare.setColorAt(i, color.setRGB(0.10 + shade, 0.075 + shade, 0.05 + shade));
    }
    bare.instanceMatrix.needsUpdate = true;
    bare.instanceColor.needsUpdate = true;
    bare.frustumCulled = false;
    bare.visible = false;
    bare.name = 'Bare winter woodland';
    scene.add(bare);
    return bare;
  }

  function updateLeafVisibility(tree, distantTrees, summerForest, winterForest, bareAmount) {
    const bare = bareAmount >= 0.98;
    tree.leaves.visible = !bare;
    for (const group of distantTrees.children) group.children[1].visible = !bare;
    summerForest.visible = bareAmount < 0.65;
    winterForest.visible = bareAmount >= 0.65;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { addRoots, addLeaflessForest, updateLeafVisibility };
  else root.WishingTreeWinter = { addRoots, addLeaflessForest, updateLeafVisibility };
})(globalThis);
