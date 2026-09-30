"""char-forge 조각 내보내기 — 한 몸을 (맨몸 + 슬롯별 옷 조각) GLB 여럿으로 쪼갠다. 착용 교체·캐시템의 바탕(COSTUME-SYSTEM.md).

    export BLENDER_USER_RESOURCES="$PWD/tools/char-forge/_blender"
    "$B" -b --factory-startup -P tools/char-forge/export_parts.py -- --recipe tools/char-forge/recipes/<..>.json --out-dir tools/char-forge/_out/parts/<id> [--keep-under]

`build_real.py` 와 같은 순서로 몸을 짓고(모프 굳히기·옷 아래 살 지우기·색·눈·화장·kitbash), 동작 굽기 직전에 멈춰
  <out-dir>/body.glb            — 살(skin)·눈·눈썹·속눈썹·이 (뼈 + 스킨) — 조각 GLB 는 모두 **같은 뼈 이름**의 뼈대를 함께 실어 게임이 몸의 뼈에 다시 붙인다
  <out-dir>/<슬롯>__<옷>.glb    — 옷 조각 하나(머리카락은 슬롯 hair)
  <out-dir>/parts.json          — 매니페스트: 슬롯·파일·원래 옷 이름·재질·삼각형 수·몸 키
를 낸다. 동작은 싣지 않는다(동작은 몸 GLB 한 벌이 갖고 조각은 그 뼈를 따른다).
슬롯: head(투구·모자·관) · hair · body(윗옷·갑옷·도포) · legs(바지·치마) · hands(장갑) · feet(신발) · back(망토) · extra(그 밖).
옷 조각은 **그 몸에 맞춰** 지어져 있다 — 같은 체형 칸의 다른 몸에 그대로 씌우면 어긋난다. 체형이 다른 몸에 입힐 땐 레시피의 옷만 바꿔 다시 짓는다(COSTUME-SYSTEM.md §3).
"""
import bpy, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_real as B  # noqa: E402

SLOT_KEYS = [
    ('head', ('helmet', 'helm', 'hat', 'cap', 'crown', 'turban', 'hood', 'gat', 'samo', 'boktu', 'eboshi', 'kabuto', 'ikseong', 'myeollyu', 'tiara', 'beret', 'bandana', 'sangtu', 'chonmage', 'topknot')),
    ('feet', ('shoe', 'boot', 'sandal', 'geta', 'slipper', 'flats')),
    ('hands', ('glove', 'gauntlet', 'mitten')),
    ('back', ('cape', 'cloak', 'mantle')),
    ('legs', ('pant', 'trouser', 'skirt', 'hakama', 'jeans', 'shorts', 'leggings', 'baji')),
]


def slot_of(o):
    src = (o.get('cf_src') or o.name).lower()
    mats = ' '.join(s.material.name for s in o.material_slots if s.material)
    if mats.startswith('hair_brow') or mats.startswith('hair_lash') or src.startswith(('eyebrow', 'eyelash')):
        return 'body_face'
    if mats.startswith('hair'):
        return 'hair'
    if mats.startswith(('skin', 'eye', 'teeth')) or src in ('high-poly', 'teeth_base', 'tongue01'):
        return 'body_skin'
    for slot, keys in SLOT_KEYS:
        if any(k in src for k in keys):
            return slot
    return 'body' if mats.startswith('cloth') or '_kitbash_' in o.name else 'extra'


def safe(s):
    return ''.join(c if c.isalnum() or c in '-_' else '_' for c in s)


def export_set(arm, objs, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in [arm] + objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.animation_data_clear() if arm.animation_data else None
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                              export_def_bones=False, export_cameras=False, export_lights=False, export_extras=False, export_yup=True)


def main():
    recipe_path, out_dir = B.build.arg('--recipe'), B.build.arg('--out-dir')
    if not recipe_path or not out_dir:
        sys.exit('--recipe · --out-dir 가 필요하다')
    r = json.load(open(recipe_path, encoding='utf-8'))
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    svc = B.mpfb()
    basemesh = B.make_human(svc, r)
    mk_masks = B.makeup_masks(basemesh, svc, r['macro']['gender']) if r.get('makeup') else None
    keep = '--keep-under' in sys.argv     # 옷 아래 살을 지우지 않는다 — 옷을 벗겨도 몸이 온전(착용 교체용 맨몸). 기본은 끔(=게임 몸 GLB 와 같은 굽기)
    if keep:
        svc['ExportService'].bake_modifiers_remove_helpers(basemesh, bake_masks=False, bake_subdiv=False, remove_helpers=True, also_proxy=True)
        arm = basemesh.parent
        for o in [c for c in arm.children if c.type == 'MESH']:
            if o.data.shape_keys:
                with B.build.ctx(o, [o]):
                    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
            for md in [md for md in o.modifiers if md.type != 'ARMATURE']:
                with B.build.ctx(o, [o]):
                    bpy.ops.object.modifier_apply(modifier=md.name)
    else:
        arm = B.bake_for_export(svc, basemesh)
    arm.name = arm.data.name = r['id']
    B.name_materials(svc, arm)
    if r.get('tuck'):
        B.tuck(arm, r['tuck'])
    if r.get('under') and not keep:
        B.hide_under(arm, r['under'], r.get('under_reach'), r.get('under_below'), r.get('under_rows'), r.get('under_keep'))
    if r.get('soften'):
        B.soften(arm, r['soften'])
    tex = os.path.join(os.path.abspath(out_dir), 'tex')
    if mk_masks is not None:
        B.makeup_apply(arm, mk_masks, r['makeup'], tex)
    if r.get('eye_color'):
        B.eye_color(arm, r['eye_color'], tex)
    for slot, col in r.get('tints', {}).items():
        B.tint(arm, slot, col, tex)
    if r.get('kitbash'):
        B.kitbash(arm, r['kitbash'])
    B.build.cap_textures()

    groups = {}
    for o in [c for c in arm.children if c.type == 'MESH']:
        groups.setdefault(slot_of(o), []).append(o)
    body_objs = groups.pop('body_skin', []) + groups.pop('body_face', [])
    manifest = {'id': r['id'], 'recipe': os.path.basename(recipe_path), 'height_target_m': r.get('height_target_m'),
                'skeleton': 'mpfb game_engine (표준 뼈 이름 그대로)', 'parts': []}

    def add(slot, objs, fname):
        export_set(arm, objs, os.path.join(out_dir, fname))
        manifest['parts'].append({
            'slot': slot, 'file': fname, 'source': sorted({o.get('cf_src') or o.name for o in objs}),
            'materials': sorted({s.material.name for o in objs for s in o.material_slots if s.material}),
            'tris': sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)})

    add('body', body_objs, 'body.glb')
    manifest['parts'][0]['slot'] = 'base'
    for slot in sorted(groups):
        for o in groups[slot]:
            add(slot, [o], f"{slot}__{safe(o.get('cf_src') or o.name)}.glb")
    json.dump(manifest, open(os.path.join(out_dir, 'parts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PARTS', r['id'], json.dumps([(p['slot'], p['file'], p['tris']) for p in manifest['parts']], ensure_ascii=False))


if __name__ == '__main__':
    main()
