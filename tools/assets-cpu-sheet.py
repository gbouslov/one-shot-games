"""Offline CPU fallback when the existing WebGL asset sheet cannot launch.

Run with an official Blender binary:
  blender --background --factory-startup --threads 4 --python tools/assets-cpu-sheet.py -- 
    --ids=car-concept,v12-goblin --out=references/audit/cars-1111
This inspects the packed GLBs. It does not establish browser runtime correctness.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, position, energy, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    aim(obj, target)


def render_asset(root, entry, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.import_scene.gltf(filepath=str(root / 'assets' / entry['file']))
    scene.view_layers[0].update()
    meshes = [o for o in scene.objects if o.type == 'MESH']
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector([min(v[i] for v in corners) for i in range(3)])
    high = Vector([max(v[i] for v in corners) for i in range(3)])
    center = (low + high) / 2
    span = max(high - low)
    # Normalize the presentation only. Never rewrite the packed model transforms.
    pivot = bpy.data.objects.new('presentation', None)
    scene.collection.objects.link(pivot)
    for obj in list(scene.objects):
        if obj != pivot and obj.parent is None:
            obj.parent = pivot
    pivot.scale = (4 / span,) * 3
    pivot.location = (-center.x * 4 / span, -center.y * 4 / span, -low.z * 4 / span)
    bpy.context.view_layer.update()
    height = (high.z - low.z) * 4 / span
    target = (0, 0, height * 0.45)
    world = bpy.data.worlds.new('Studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.24, 0.27, 0.32, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.015))
    floor = bpy.context.object
    mat = bpy.data.materials.new('Matte studio floor')
    mat.diffuse_color = (0.045, 0.052, 0.065, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = 0.7
    floor.data.materials.append(mat)
    area('Key softbox', (2, -3, 6), 1100, 5, target)
    area('Fill softbox', (-4, -1, 3), 750, 4, target)
    area('Rim softbox', (1, 4, 5), 1500, 3, target)
    data = bpy.data.cameras.new('Camera')
    camera = bpy.data.objects.new('Camera', data)
    scene.collection.objects.link(camera)
    camera.location = (4.7, -6.1, 3.4)
    data.type = 'ORTHO'
    data.ortho_scale = 5.6
    aim(camera, target)
    scene.camera = camera
    scene.render.filepath = str(out / (entry['id'] + '.png'))
    bpy.ops.render.render(write_still=True)
    print('ASSET_RENDER ' + json.dumps({'id': entry['id'], 'image': scene.render.filepath}), flush=True)


args = argparse.ArgumentParser()
args.add_argument('--ids', required=True)
args.add_argument('--out', default='references/audit/cars-1111')
args.add_argument('--model-file', help='Single-model source comparison; never rewrites catalog')
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = Path(__file__).resolve().parent.parent
out = root / opts.out
out.mkdir(parents=True, exist_ok=True)
catalog = json.loads((root / 'assets/catalog.json').read_text())
by_id = {a['id']: a for a in catalog['assets']}
for asset_id in opts.ids.split(','):
    entry = dict(by_id[asset_id])
    if opts.model_file:
        entry['file'] = str(Path(opts.model_file).resolve())
    render_asset(root, entry, out)
