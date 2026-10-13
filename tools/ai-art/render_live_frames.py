"""K-0049 — 움직이는 대화 초상 프레임: VRoid 몸 반신을 표정 키(눈 감기·입 모양)별로 같은 카메라로 렌더. Blender 헤드리스.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/ai-art/render_live_frames.py -- <출력폴더> <id,id,…>
  몸 = tools/char-forge/_out/vroid/<id>/<id>.glb(K-0024·K-0097 굽기 산출, VRM 표정 키 Fcl_* 가 남아 있다)

한 사람 = <id>__<프레임>.png 여섯(768x1024, render_busts.py 와 같은 틀). 이미 있으면 그 사람은 건너뛴다.
바뀌는 건 표정 키 값뿐이라 프레임끼리 픽셀이 부위 밖에서 똑같다 → split_portrait_layers.py 가 차이로 부위를 잘라낸다.
단계 1 시험(10-13): AI 그림체 입히기(같은 씨앗 i2i)는 눈이 다 안 감기고 머리카락 결이 프레임마다 달라 버림 — 3D 렌더 그대로 쓴다.
Unity·다른 Blender 배치·ComfyUI 와 동시에 돌리지 않는다.
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix  # noqa: F401  (render_common 이 쓴다)

FRAMES = {                       # 프레임 → 표정 키 값(나머지 Fcl_* 는 0)
    'base': {},
    'blink_half': {'Fcl_EYE_Close': 0.5},
    'blink': {'Fcl_EYE_Close': 1.0},
    'mouth_half': {'Fcl_MTH_A': 0.4},
    'mouth_a': {'Fcl_MTH_A': 1.0},
    'mouth_o': {'Fcl_MTH_O': 1.0},
}

a = sys.argv[sys.argv.index('--') + 1:]
out_dir, ids = os.path.abspath(a[0]), [x for x in a[1].split(',') if x]   # 렌더 경로가 상대면 Blender 가 엉뚱한 곳에 쓴다
os.makedirs(out_dir, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
VR = os.path.join(HERE, '..', 'char-forge', '_out', 'vroid')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
exec(open(os.path.join(HERE, '..', 'char-forge', 'render', 'render_common.py'), encoding='utf-8').read())
setup_light()
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
cam_d.type = 'ORTHO'
cam_d.ortho_scale = 0.62
cam.location = (0, -6, 1.50)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 768, 1024
set_engine()
# AgX(render_common 기본)는 밝은 머리·피부를 회색 막처럼 눌러 대비가 낮다 → 대화 초상은 애니 그림처럼 Standard(LIVE_VIEW 로 바꿈)
sc.view_settings.view_transform = os.environ.get('LIVE_VIEW', 'Standard')
if os.environ.get('LIVE_LOOK'):
    sc.view_settings.look = os.environ['LIVE_LOOK']

for hid in ids:
    if all(os.path.exists(os.path.join(out_dir, '%s__%s.png' % (hid, f))) for f in FRAMES):
        continue
    glb = os.path.join(VR, hid, hid + '.glb')
    if not os.path.exists(glb):
        print('LIVE_SKIP 몸 없음', hid)
        continue
    before = set(bpy.data.objects)
    objs = load_any(glb)
    sc.frame_set(12)
    lo, hi = bbox(objs)
    k = 1.7 / (hi.z - lo.z)
    roots = [o for o in objs if o.parent is None]
    for r in roots:
        r.scale = r.scale * k
    bpy.context.view_layer.update()
    lo, hi = bbox(objs)
    for r in roots:
        r.location.x -= (lo.x + hi.x) / 2
        r.location.y -= (lo.y + hi.y) / 2
        r.location.z -= lo.z
    fix_materials()
    keys = {}
    for o in objs:
        if o.type == 'MESH' and o.data.shape_keys:
            if o.data.shape_keys.animation_data:   # 쉼 동작에 깜빡임 같은 표정 키가 들어 있으면 손으로 넣은 값을 덮는다
                o.data.shape_keys.animation_data_clear()
            for kb in o.data.shape_keys.key_blocks:
                keys.setdefault(kb.name, []).append(kb)
    miss = sorted({n for v in FRAMES.values() for n in v} - set(keys))
    if miss:
        print('LIVE_SKIP 표정 키 없음', hid, miss)
    else:
        for name, setv in FRAMES.items():
            for n, kbs in keys.items():
                for kb in kbs:
                    if n.startswith('Fcl_'):
                        kb.value = setv.get(n, 0.0)
            sc.render.filepath = os.path.join(out_dir, '%s__%s.png' % (hid, name))
            bpy.ops.render.render(write_still=True)
        print('LIVE', hid)
    for o in list(bpy.data.objects):
        if o not in before:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)   # 메시·재질·그림·동작이 사람마다 쌓이지 않게(RAM)
