"""펫 3D 대역 모델 → 전신 렌더(초상 밑그림). Blender 헤드리스.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/ai-art/render_pets.py -- <출력폴더> <glb>...
  (출력 이름 = <폴더>__<모델>.png — 예: animals__Horse_White.png)

한 장 = 768x896(펫 초상 배치와 같은 크기), 전신을 가운데에 맞추고 앞에서 약간 비스듬히(3/4). 이미 있는 그림은 건너뛴다.
`render_busts.py` 와 같은 조명·배경·재질 처리를 쓴다. 이 그림은 `gen.py` 이미지→이미지의 밑그림일 뿐 — 게임에 안 들어가고 저장소에도 안 넣는다(_out 은 gitignore).
Unity·다른 Blender 배치·ComfyUI 와 동시에 돌리지 않는다(PC 가 멈추지 않게). 100장 넘으면 나눠서(Blender 가 메모리를 물고 늘어난다).
"""
import bpy, sys, os, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out_dir, models = a[0], a[1:]
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
COMMON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'char-forge', 'render', 'render_common.py')
exec(open(COMMON, encoding='utf-8').read())

setup_light()
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
cam_d.type = 'ORTHO'
cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 768, 896
set_engine()


def name_of(p):
    p = p.replace('\\', '/')
    return os.path.basename(os.path.dirname(p)) + '__' + os.path.splitext(os.path.basename(p))[0]


for p in models:
    dst = os.path.join(out_dir, name_of(p) + '.png')
    if os.path.exists(dst):
        continue
    before = set(bpy.data.objects)
    before_k = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=p)          # 뼈 없는 정적 모델도 있어 load_any(뼈 필수)를 안 쓴다
    objs = new_objs(before_k)
    sc.frame_set(12)
    roots = [o for o in objs if o.parent is None]
    piv = bpy.data.objects.new('piv', None)            # 뿌리가 쿼터니언 회전이라 오일러를 못 먹는다 — 빈 물체에 매달아 돌린다
    sc.collection.objects.link(piv)
    for r in roots:
        r.parent = piv
    bpy.context.view_layer.update()
    lo, hi = bbox(objs)
    yaw = 90.0 if (hi.y - lo.y) > (hi.x - lo.x) * 1.15 else 0.0     # 긴 쪽을 가로(X)로 — 옆모습
    piv.rotation_euler[2] = math.radians(yaw + 30.0)                  # 거기서 30° 비스듬히(3/4)
    bpy.context.view_layer.update()
    lo, hi = bbox(objs)
    size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) or 1.0
    k = 1.0 / size                       # 가장 큰 변을 1m 로
    piv.scale = (k, k, k)
    bpy.context.view_layer.update()
    lo, hi = bbox(objs)
    cx, cy, cz = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2
    cam.location = (cx, cy - 6, cz)
    w, h = hi.x - lo.x, hi.z - lo.z
    cam_d.ortho_scale = max(h * 1.0, w * 896 / 768) * 1.18     # 큰 쪽 기준 여백 9%
    fix_materials()
    sc.render.filepath = dst
    bpy.ops.render.render(write_still=True)
    print('PET', name_of(p))
    for o in list(bpy.data.objects):
        if o not in before or o is piv:
            bpy.data.objects.remove(o, do_unlink=True)
