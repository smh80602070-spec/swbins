"""옷 조각 GLB 의 바탕색 질감을 PNG 로 뽑는다(AI 질감 변형의 밑그림). Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/vrm_piece_tex.py -- <조각폴더>      # <폴더>/tex/<조각>.png + tex/index.json(크기)
옷 조각(`top__… bottom__… shoes__…`)만 처리한다. 질감이 없는 조각은 건너뛴다.
"""
import bpy, sys, os, json, glob
d = sys.argv[sys.argv.index('--') + 1]
os.makedirs(os.path.join(d, 'tex'), exist_ok=True)
index = {}
for f in sorted(glob.glob(os.path.join(d, '*__*.glb'))):
    name = os.path.splitext(os.path.basename(f))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    img = None
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0:
                img = n.image
                break
        if img:
            break
    if not img:
        print('NOTEX', name)
        continue
    p = os.path.join(d, 'tex', name + '.png')
    img.filepath_raw = p
    img.file_format = 'PNG'
    img.save()
    index[name] = {'size': list(img.size), 'image': img.name}
    print('TEX', name, list(img.size))
json.dump(index, open(os.path.join(d, 'tex', 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
