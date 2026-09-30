"""VRM(VRoid 몸) → 맨몸(얼굴·몸·머리) + 옷 조각(상의·하의·신발…) GLB. 옷만 갈아 끼우는 착용 교체용(COSTUME-SYSTEM.md §8).

    "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/char-forge/export_vrm_parts.py -- <입력.vrm> <출력폴더>

VRoid Studio 가 내보낸 VRM 은 재질 이름이 자리를 말해 준다: `N00_005_01_Tops_01_CLOTH` · `…Bottoms…` · `…Shoes…`(옷) / `…Face…`·`…Eye…`·`…Body_00_SKIN`(맨몸) / `…Hair…`(머리).
VRM 은 GLB 이므로 Blender 가 그냥 연다(VRM 확장은 무시). 재질별로 메시를 갈라(separate by material) 한 조각씩 같은 뼈대와 함께 내보낸다.
  base.glb                 — 얼굴·눈·피부(몸)·머리(머리카락은 옷이 아니라 얼굴에 붙는다)
  <슬롯>__<재질>.glb       — 옷 한 조각. 슬롯 = top · bottom · shoes · (그 밖 cloth)
  parts.json               — 매니페스트(슬롯·파일·재질·삼각형 수)
같은 VRoid 몸 설정(체형 슬라이더)으로 만든 모델끼리는 뼈대·몸이 같아 옷 조각이 서로 맞는다. 얼굴은 모델마다 다르게 두어도 된다.
"""
import bpy, sys, os, json, re

a = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = a[0], a[1]
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
tmp = os.path.join(out_dir, '_src.glb')
import shutil
shutil.copyfile(src, tmp)                      # 확장자 .vrm 을 .glb 로 — 임포터가 확장자로 고른다
bpy.ops.import_scene.gltf(filepath=tmp)
os.remove(tmp)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# 재질별로 갈라낸다
for o in meshes:
    if len(o.material_slots) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL')
        bpy.ops.object.mode_set(mode='OBJECT')
pieces = [o for o in bpy.data.objects if o.type == 'MESH']


def mat_of(o):
    return o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else o.name


def slot_of(name):
    n = name.lower()
    if 'cloth' in n:
        for key, slot in (('tops', 'top'), ('bottoms', 'bottom'), ('shoes', 'shoes'), ('outer', 'outer'), ('accessory', 'accessory')):
            if key in n:
                return slot
        return 'cloth'
    return 'base'                                 # face·eye·skin·hair


def safe(s):
    return re.sub(r'[^A-Za-z0-9_-]+', '_', s.replace(' (Instance)', ''))


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm] + objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_extras=False, export_yup=True)


groups = {}
for o in pieces:
    groups.setdefault(slot_of(mat_of(o)), []).append(o)
manifest = {'source': os.path.basename(src), 'parts': []}


def tris(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


export(groups.get('base', []), os.path.join(out_dir, 'base.glb'))
manifest['parts'].append({'slot': 'base', 'file': 'base.glb', 'materials': sorted({mat_of(o) for o in groups.get('base', [])}), 'tris': tris(groups.get('base', []))})
for slot in sorted(k for k in groups if k != 'base'):
    for o in groups[slot]:
        m = mat_of(o)
        fn = f'{slot}__{safe(m)}.glb'
        export([o], os.path.join(out_dir, fn))
        manifest['parts'].append({'slot': slot, 'file': fn, 'materials': [m], 'tris': tris([o])})
json.dump(manifest, open(os.path.join(out_dir, 'parts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('VRMPARTS', json.dumps([(p['slot'], p['file'], p['tris']) for p in manifest['parts']], ensure_ascii=False))
