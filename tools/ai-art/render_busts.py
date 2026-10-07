"""공방 인물 몸 → 가슴 위 반신 렌더(초상 밑그림). Blender 헤드리스.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/ai-art/render_busts.py -- <출력폴더> [--only id,id] <glb>...
  (예: … -- tools/ai-art/_out/busts $(ls tools/char-forge/_out/hero/hero_*.glb))

한 장 = 768x1024, 키 1.7m 로 맞춘 몸의 가슴 위, 정면, 가운데. 이미 있는 그림은 건너뛴다. 몸마다 20초 안팎.
이 그림은 `gen.py` 이미지→이미지의 밑그림일 뿐 — 게임에 안 들어가고 저장소에도 안 넣는다(_out 은 gitignore).
Unity·다른 Blender 배치·ComfyUI 와 동시에 돌리지 않는다(PC 가 멈추지 않게).
"""
import bpy, sys, os, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out_dir = a[0]
only = set()
models = []
i = 1
while i < len(a):
    if a[i] == '--only':
        only = set(a[i + 1].split(','))
        i += 2
    else:
        models.append(a[i])
        i += 1
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
COMMON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'char-forge', 'render', 'render_common.py')
exec(open(COMMON, encoding='utf-8').read())

setup_light()
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)   # 조용한 회청색 — 그림체 바꿀 때 배경이 방해 안 하게
cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
cam_d.type = 'ORTHO'
cam_d.ortho_scale = 0.62           # 큰 쪽(세로) 기준 0.62m: 머리 위 여백 ~ 가슴 위
cam.location = (0, -6, 1.50)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 768, 1024
set_engine()

for p in models:
    hid = os.path.splitext(os.path.basename(p))[0]
    dst = os.path.join(out_dir, hid + '.png')
    if os.path.exists(dst) or (only and hid not in only and hid[5:] not in only):
        continue
    before = set(bpy.data.objects)
    objs = load_any(p)
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
    sc.render.filepath = dst
    bpy.ops.render.render(write_still=True)
    print('BUST', hid)
    for o in list(bpy.data.objects):
        if o not in before:
            bpy.data.objects.remove(o, do_unlink=True)
