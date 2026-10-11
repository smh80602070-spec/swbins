"""K-0097 단계 1b — 긴 윗옷을 뚫고 나오는 바지 정점 세기(Blender 헤드리스, 판정은 tuck.py).

  blender -b --factory-startup -P tools/char-forge/tuck_scan.py -- <GLB 폴더> <id,id|@목록파일> [--anim] [--json <out>]

<GLB 폴더>/<id>.glb 를 쉼 자세로 본다. --anim 이면 <GLB 폴더>/<id>/<id>_anims.glb(vroid_batch 산출)의 Walk 를
네 칸(1/8·3/8·5/8·7/8)에서 재고 가장 큰 값을 적는다. 줄마다 `TUCK id 아랫단 골반 본정점 뚫림`.
"""
import bpy, sys, os, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tuck  # noqa: E402

a = sys.argv[sys.argv.index('--') + 1:]
d = os.path.abspath(a[0])
ids = open(a[1][1:], encoding='utf-8').read().split() if a[1].startswith('@') else a[1].split(',')
ANIM = '--anim' in a
out = a[a.index('--json') + 1] if '--json' in a else None
rows = {}
for i in ids:
    path = os.path.join(d, i, i + '_anims.glb') if ANIM else os.path.join(d, i + '.glb')
    if not os.path.exists(path):
        print('TUCK_MISS', i, flush=True)
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    sc = bpy.context.scene
    arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
    objs = [o for o in sc.objects if o.type == 'MESH']
    if arm is None:
        print('TUCK_NOARM', i, flush=True)
        continue
    if ANIM:
        act = next((x for x in bpy.data.actions if x.name.startswith('Walk')), None)
        best = None
        if act:
            arm.animation_data_create()
            arm.animation_data.action = act
            if hasattr(arm.animation_data, 'action_slot') and act.slots:
                arm.animation_data.action_slot = act.slots[0]
            f0, f1 = act.frame_range
            for k in (1, 3, 5, 7):
                sc.frame_set(int(f0 + (f1 - f0) * k / 8))
                r = tuck.scan(arm, objs, deps=bpy.context.evaluated_depsgraph_get())
                if best is None or r['poke'] > best['poke']:
                    best = r
        r = best or dict(top_min=None, hip=None, poke=-1, checked=0)
    else:
        bpy.context.view_layer.update()
        r = tuck.scan(arm, objs)
    rows[i] = r
    print('TUCK %s %s %s %d %d' % (i, r['top_min'], r['hip'], r['checked'], r['poke']), flush=True)
if out:
    json.dump(rows, open(out, 'w', encoding='utf-8'), indent=1)
print('TUCK_DONE', len(rows))
