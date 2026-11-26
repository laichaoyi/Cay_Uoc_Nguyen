/* Load the supplied static GLB and place lettering on its wooden board. */
(function (root) {
  async function addWoodenSign(THREE, scene, groundHeight, canopyGeometry) {
    const response = await fetch('assets/models/wooden-sign.glb');
    if (!response.ok) throw new Error('Wooden sign model is missing.');
    const buffer = await response.arrayBuffer();
    const header = new DataView(buffer);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) {
      throw new Error('Invalid GLB model.');
    }
    const jsonSize = header.getUint32(12, true);
    const model = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonSize)));
    const binaryStart = 20 + jsonSize + 8;
    const primitive = model.meshes[0].primitives[0];
    // This model uses tightly packed FLOAT attributes and UNSIGNED_INT indices.
    function accessor(index, components) {
      const info = model.accessors[index];
      const view = model.bufferViews[info.bufferView];
      const start = binaryStart + (view.byteOffset || 0) + (info.byteOffset || 0);
      const Type = info.componentType === 5126 ? Float32Array : Uint32Array;
      return new Type(buffer.slice(start, start + info.count * components * 4));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(accessor(primitive.attributes.POSITION, 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(accessor(primitive.attributes.NORMAL, 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(accessor(primitive.attributes.TEXCOORD_0, 2), 2));
    geometry.setIndex(new THREE.BufferAttribute(accessor(primitive.indices, 1), 1));
    geometry.computeBoundingBox();

    const image = model.images[0];
    const imageView = model.bufferViews[image.bufferView];
    const blob = new Blob([new Uint8Array(buffer, binaryStart + (imageView.byteOffset || 0), imageView.byteLength)], { type: image.mimeType });
    const imageUrl = URL.createObjectURL(blob);
    let texture;
    try { texture = await new THREE.TextureLoader().loadAsync(imageUrl); }
    finally { URL.revokeObjectURL(imageUrl); }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    const sign = new THREE.Group();
    sign.name = 'Cây ước nguyện — wooden sign';
    const wood = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sign.add(mesh);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 150px Georgia, "Times New Roman", serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(37,22,12,0.90)';
    ctx.fillStyle = '#f6e5b9';
    for (const [line, center] of [['Cây ước', 157], ['nguyện', 345]]) {
      ctx.strokeText(line, 512, center, 910);
      ctx.fillText(line, 512, center, 910);
    }
    const lettering = new THREE.CanvasTexture(canvas);
    lettering.colorSpace = THREE.SRGBColorSpace;
    lettering.anisotropy = 8;
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.98), new THREE.MeshStandardMaterial({
      map: lettering, transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    letters.position.set(-0.018, 2.1, 0.139);
    letters.receiveShadow = true;
    sign.add(letters);

    const scale = 0.78;
    const x = -4.5;
    // The default seating area is on +Z. Put the sign ahead of the canopy,
    // including clearance for animated branches and the thickness of the board.
    canopyGeometry.computeBoundingBox();
    const frontEdge = canopyGeometry.boundingBox.max.z;
    const z = Math.max(10.5, frontEdge + 2.0);
    sign.scale.setScalar(scale);
    // The post is partially buried to avoid any gap above the grass.
    sign.position.set(x, groundHeight(x, z) - geometry.boundingBox.min.y * scale - 0.12, z);
    sign.rotation.y = 0.12;
    scene.add(sign);
    return sign;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { addWoodenSign };
  else root.WishingTreeAddWoodenSign = addWoodenSign;
})(globalThis);
