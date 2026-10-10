"""옷 이식 — 샘플 X 의 옷 조각(상의·하의·신발·원피스)을 샘플 Y 의 몸 비율에 맞춰 입힌다(K-0024). Blender 헤드리스.

  쌍 시험  blender -b --factory-startup -P tools/char-forge/outfit_swap.py -- <몸 폴더> <옷 폴더> <출력 png 접두>
           (폴더 = export_parts_all.sh 가 만든 _out/parts/<글자>) 세 장: 몸 원래 옷 / 옷 원래 몸 / 이식 결과
  명단 굽기  ... -- --plan tools/char-forge/data/outfit_swap_plan.json tools/char-forge/_out/parts <출력폴더> [id,id] [--render] [--force]
           → <출력폴더>/<id>.glb (몸 base + 이식한 옷, 뼈대 J_Bip 그대로 → vroid_batch.sh 로 동작·웹·2D)

방식: 뼈마다 머리 위치 이동 + 뼈 방향 회전 + 뼈 길이 비율(몸통은 어깨·골반 폭을 가로로 더함), 대상에 없는 뼈(치마·꼬리)는 가장 가까운
공통 조상을 따른다. 옷은 법선 방향으로 살짝 부풀려 몸이 비치지 않게 한다. 경로는 abspath(Blender 가 상대경로를 드라이브 루트로 읽는다).
K-0028 무늬: 조합표 줄에 `pattern: {slot, name}` 이 있으면 그 칸 조각의 바탕색 질감을 `saga-assets/patterns/<name>.webp` 로 합성한다
(make_wardrobe_textures.compose 와 같은 식 — 패널 안에서 무늬 × 원래 명암, 접힘·그림자는 남는다).
"""
import bpy, sys, os, glob, math, json
import numpy as np
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
MODE = 'plan' if a and a[0] == '--plan' else 'pair'
if MODE == 'pair':
    tdir, sdir, out = [os.path.abspath(x) for x in a[:3]]
else:                                           # -- --plan data/outfit_swap_plan.json <parts폴더> <출력폴더> [id,id] [--render]
    PLAN, PARTS, OUTDIR = [os.path.abspath(x) for x in a[1:4]]
    ONLY = a[4] if len(a) > 4 and not a[4].startswith('--') else ''
    RENDER = '--render' in a


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def imp(f):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    return arm, [o for o in new if o.type == 'MESH'], new


def setup_render(w=420, h=640):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
    wd.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
    wd.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), 0, math.radians(20))
    cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.type = 'ORTHO'
    return sc, cam, cd


def shoot(path):
    sc, cam, cd = setup_render()
    zs = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and not o.hide_render:
            for c in o.bound_box:
                zs.append((o.matrix_world @ Vector(c)).z)
    lo, hi = min(zs), max(zs)
    cd.ortho_scale = (hi - lo) * 1.12
    # VRM 은 +Y 앞(가져오면 -Y 를 보게 놓인다) — 몸 앞에서 본다
    cam.location = (0, -6, (hi + lo) / 2); cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def bone_m(arm, name):
    b = arm.data.bones.get(name)
    return None if b is None else arm.matrix_world @ b.matrix_local


CHILD = {'Hips': 'Spine', 'Spine': 'Chest', 'Chest': 'UpperChest', 'UpperChest': 'Neck', 'Neck': 'Head',
         'Shoulder': 'UpperArm', 'UpperArm': 'LowerArm', 'LowerArm': 'Hand',
         'UpperLeg': 'LowerLeg', 'LowerLeg': 'Foot', 'Foot': 'ToeBase'}
TORSO = ('Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head')


def hum(name):
    """J_Bip_L_UpperArm → ('L', 'UpperArm') · 사람 뼈대가 아니면 None"""
    p = name.split('_')
    return (p[2], p[3]) if len(p) >= 4 and p[0] == 'J' and p[1] == 'Bip' else None


def head_of(arm, name):
    b = arm.data.bones.get(name)
    return None if b is None else arm.matrix_world @ b.head_local


def child_head(arm, name):
    h = hum(name)
    if not h:
        return None
    side, part = h
    cands = [CHILD.get(part)]
    if part == 'Chest':
        cands = ['UpperChest', 'Neck']
    for c in cands:
        if c:
            ch = head_of(arm, 'J_Bip_%s_%s' % (side, c))
            if ch is not None:
                return ch
    return None


def span(arm, l, r_):
    a, b = head_of(arm, l), head_of(arm, r_)
    return abs(a.x - b.x) if a is not None and b is not None else 1.0


def transplant(src_arm, tgt_arm, meshes, push=0.0):
    """src 뼈대에 묶인 옷 메시를 tgt 뼈대로 옮긴다. 뼈마다 '머리 위치 이동 + 뼈 방향 회전 + 뼈 길이 비율' 로
    움직이고(몸통은 어깨·골반 폭 비율을 가로로 더한다), 대상에 없는 뼈(치마·꼬리…)는 가장 가까운 공통 조상을 따른다."""
    tnames = {b.name for b in tgt_arm.data.bones}

    def mapped(n):
        b = src_arm.data.bones.get(n)
        while b is not None and b.name not in tnames:
            b = b.parent
        return None if b is None else b.name

    r_sh = span(tgt_arm, 'J_Bip_L_UpperArm', 'J_Bip_R_UpperArm') / max(span(src_arm, 'J_Bip_L_UpperArm', 'J_Bip_R_UpperArm'), 1e-5)
    r_hp = span(tgt_arm, 'J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg') / max(span(src_arm, 'J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg'), 1e-5)
    hs, ht = head_of(src_arm, 'J_Bip_C_Hips'), head_of(tgt_arm, 'J_Bip_C_Hips')
    hd_s, hd_t = head_of(src_arm, 'J_Bip_C_Head'), head_of(tgt_arm, 'J_Bip_C_Head')
    r_h = (hd_t.z - ht.z) / max(hd_s.z - hs.z, 1e-5)           # 골반→머리 높이 비율
    cl = lambda x, lo, hi: max(lo, min(hi, x))
    print('RATIO shoulder %.2f hip %.2f height %.2f' % (r_sh, r_hp, r_h))
    xf = {}
    for b in src_arm.data.bones:
        h = hum(b.name)
        if not h or b.name not in tnames:
            continue
        side, part = h
        Hs, Ht = head_of(src_arm, b.name), head_of(tgt_arm, b.name)
        Cs, Ct = child_head(src_arm, b.name), child_head(tgt_arm, b.name)
        T = lambda v: Matrix.Translation(v)
        if part in TORSO:
            lat = r_hp if part == 'Hips' else r_sh
            if part in ('Spine',):
                lat = (r_hp + r_sh) / 2
            ls, lt = (Cs - Hs).length if Cs is not None else 0, (Ct - Ht).length if Ct is not None else 0
            rz = cl(lt / ls, 0.5, 2.0) if ls > 1e-4 and lt > 1e-4 else r_h
            S = Matrix.Diagonal((cl(lat, 0.5, 2.0), 1 + (cl(lat, 0.5, 2.0) - 1) * 0.5, rz, 1.0))
            xf[b.name] = T(Ht) @ S @ T(-Hs)
            continue
        if Cs is not None and Ct is not None and (Cs - Hs).length > 1e-4 and (Ct - Ht).length > 1e-4:
            us, ut = (Cs - Hs).normalized(), (Ct - Ht).normalized()
            r = cl((Ct - Ht).length / (Cs - Hs).length, 0.5, 2.0)
        else:                                        # 끝 뼈(손·발·머리): 길이는 키 비율을 따르되 방향은 그대로
            us = ut = Vector((0, 0, 1)) if part not in ('Hand',) else Vector((1 if side == 'L' else -1, 0, 0))
            r = 1 + (r_h - 1) * 0.5
        g = cl(1 + (r - 1) * G, 0.6, 1.6)
        R = us.rotation_difference(ut).to_matrix().to_4x4()
        P = Matrix.Identity(4)
        for i in range(3):
            for j in range(3):
                P[i][j] = g * (1 if i == j else 0) + (r - g) * us[i] * us[j]
        xf[b.name] = T(Ht) @ R @ P @ T(-Hs)
    for b in src_arm.data.bones:           # 대상에 없는 뼈(치마·꼬리 등)는 가장 가까운 공통 조상을 그대로 따라간다
        m = mapped(b.name)
        if m is not None and b.name not in xf and m in xf:
            xf[b.name] = xf[m]
    for o in meshes:
        me = o.data
        names = {i: vg.name for i, vg in enumerate(o.vertex_groups)}
        W = o.matrix_world
        newpos = []
        for v in me.vertices:
            wp = W @ v.co
            acc = Vector((0, 0, 0)); tot = 0.0
            for g_ in v.groups:
                n = names.get(g_.group)
                if n in xf:
                    acc += g_.weight * (xf[n] @ wp); tot += g_.weight
            newpos.append(acc / tot if tot > 1e-6 else wp)
        # 새 위치 → 대상 뼈대 로컬로
        inv = tgt_arm.matrix_world.inverted()
        for v, p in zip(me.vertices, newpos):
            v.co = inv @ p
        if push:                                   # 몸이 비치지 않게 옷을 살짝 부풀린다(법선 방향)
            me.update()
            for v in me.vertices:
                v.co += v.normal * push
        # 정점 그룹 이름을 대상 뼈 이름으로 합친다
        newg = {}
        for v in me.vertices:
            for g_ in v.groups:
                n = names.get(g_.group)
                m = mapped(n) if n else None
                if m:
                    newg.setdefault(m, {}).setdefault(v.index, 0.0)
                    newg[m][v.index] += g_.weight
        for vg in list(o.vertex_groups):
            o.vertex_groups.remove(vg)
        for m, d in newg.items():
            vg = o.vertex_groups.new(name=m)
            for i, w in d.items():
                vg.add([i], min(w, 1.0), 'REPLACE')
        for md in list(o.modifiers):
            o.modifiers.remove(md)
        o.parent = tgt_arm
        o.matrix_world = tgt_arm.matrix_world.copy()
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = tgt_arm
        me.update()


G = float(os.environ.get('G', '0.5'))


def export_glb(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False,
                              export_apply=False, export_image_format='AUTO', export_yup=True)


def dress(body_dir, picks, got=None):
    """몸 base.glb 를 불러 picks=[(조각 GLB 경로, 슬롯)] 을 이식한다. 대상 뼈대를 돌려준다. got={} 이면 조각 경로 → 메시 목록을 채운다."""
    tarm, _, _ = imp(os.path.join(body_dir, 'base.glb'))
    for f, slot in picks:
        sarm, meshes, new = imp(f)
        if got is not None:
            got[f] = meshes
        transplant(sarm, tarm, meshes, push=PUSH.get(slot, 0.002))
        for o in new:
            if o.type == 'ARMATURE':
                bpy.data.objects.remove(o)
    return tarm


PUSH = {'bottom': 0.004, 'shoes': 0.002, 'top': 0.003, 'cloth': 0.003}
PATTERNS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'saga-assets', 'patterns')


def base_color_image(mat):
    """재질의 바탕색으로 들어가는 이미지 노드 — Principled 'Base Color' 또는 무광(KHR_materials_unlit → Emission 'Color') 위로
    몇 단계까지 거슬러 찾는다(VRoid 조각은 무광으로 들어온다)."""
    nt = mat.node_tree
    to = {}
    for l in nt.links:
        to.setdefault(l.to_node, []).append(l)
    for n in nt.nodes:
        want = {'BSDF_PRINCIPLED': 'Base Color', 'EMISSION': 'Color'}.get(n.type)
        if not want:
            continue
        front = [l.from_node for l in to.get(n, []) if l.to_socket.name == want]
        for _ in range(4):
            for f in front:
                if f.type == 'TEX_IMAGE' and f.image and f.image.size[0] > 0:
                    return f
            front = [l.from_node for f in front for l in to.get(f, [])]
    return None


def pixels(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def compose(a, tile):
    """make_wardrobe_textures.compose 와 같은 식(numpy, Blender 안). a=(H,W,4) 0..1, tile=(th,tw,3)."""
    h, w = a.shape[:2]
    rgb, al = a[..., :3], a[..., 3]
    mask = al > 0.5 if al.min() < 0.99 else rgb.max(axis=2) > 0.05
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ref = np.percentile(lum[mask], 70) if mask.any() else 1.0
    shade = np.clip(lum / max(ref, 0.03), 0.35, 1.35)
    shade = 0.35 + 0.65 * shade / 1.35
    big = np.tile(tile, (h // tile.shape[0] + 1, w // tile.shape[1] + 1, 1))[:h, :w]
    out = np.where(mask[..., None], np.clip(big * shade[..., None] * 1.15, 0, 1), rgb)
    return np.concatenate([out, al[..., None]], axis=2)


def apply_pattern(meshes, name):
    """meshes 의 바탕색 질감을 무늬로 합성한 새 이미지로 바꾼다(재질·이미지는 복사 — 다른 조각과 나눠 쓰면 안 번지게). 바꾼 장 수."""
    pat = bpy.data.images.load(os.path.join(PATTERNS, name + '.webp'))
    done, n = {}, 0
    for o in meshes:
        for ms in o.material_slots:
            m = ms.material
            if not m or not m.use_nodes:
                continue
            if m.name not in done:
                m2 = m.copy()
                node = base_color_image(m2)
                if node is not None:
                    src = node.image
                    w, h = src.size
                    t = pat.copy()
                    t.scale(max(256, w // 3), max(256, h // 3))   # 원래 식: 타일 = 질감의 1/3(최소 256)
                    tile = pixels(t)[..., :3]
                    bpy.data.images.remove(t)
                    res = compose(pixels(src), tile)
                    img = bpy.data.images.new('%s__%s' % (src.name, name), w, h, alpha=True)
                    img.pixels.foreach_set(res.ravel())
                    img.pack()
                    node.image = img
                    n += 1
                done[m.name] = m2
            ms.material = done[m.name]
    bpy.data.images.remove(pat)
    return n

if MODE == 'pair':
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    clear()
    imp(os.path.join(tdir, 'base.glb'))
    for f in sorted(glob.glob(os.path.join(tdir, '*__*.glb'))):
        imp(f)
    shoot(out + '_body_own.png')
    clear()
    imp(os.path.join(sdir, 'base.glb'))
    for f in sorted(glob.glob(os.path.join(sdir, '*__*.glb'))):
        imp(f)
    shoot(out + '_outfit_own.png')
    clear()
    dress(tdir, [(f, os.path.basename(f).split('__')[0]) for f in sorted(glob.glob(os.path.join(sdir, '*__*.glb')))
                 if os.path.basename(f).split('__')[0] in ('top', 'bottom', 'shoes', 'cloth')])
    shoot(out + '_swap.png')
    print('DONE')
else:                                           # plan 모드 — 명단 299 를 한 번에 굽는다
    plan = json.load(open(PLAN, encoding='utf-8'))['entries']
    only = set(ONLY.split(',')) if ONLY else None
    os.makedirs(OUTDIR, exist_ok=True)
    done = fail = 0
    for e in plan:
        if only and e['id'] not in only:
            continue
        dst = os.path.join(OUTDIR, e['id'] + '.glb')
        if os.path.exists(dst) and '--force' not in a:
            continue
        try:
            picks, pat_files = [], []
            pt = e.get('pattern')
            for slot, src in e['kit'].items():
                pj = json.load(open(os.path.join(PARTS, src, 'parts.json'), encoding='utf-8'))['parts']
                want = ('top', 'bottom', 'cloth') if slot == 'cloth' else (slot,)   # 원피스는 그 샘플의 상의·하의 조각까지 함께(몸통 가림)
                got = [(os.path.join(PARTS, src, p['file']), p['slot']) for p in pj if p['slot'] in want]
                picks += got
                if pt and pt['slot'] == slot:
                    pat_files += [f for f, _ in got]
            clear()
            meshes_of = {}
            dress(os.path.join(PARTS, e['body']), picks, meshes_of)
            if pt:
                k = apply_pattern([m for f in pat_files for m in meshes_of.get(f, [])], pt['name'])
                if not k:
                    raise RuntimeError('무늬를 입힐 바탕색 질감 없음: %s' % pt)
            tmp = os.path.join(OUTDIR, '_tmp_' + e['id'] + '.glb')
            export_glb(tmp)
            os.replace(tmp, dst)
            if RENDER:
                shoot(os.path.join(OUTDIR, e['id'] + '.png'))
            done += 1
            print('OK', e['id'], flush=True)
        except Exception as ex:
            fail += 1
            print('FAIL', e['id'], repr(ex), flush=True)
    print('SWAP_RESULT 만듦 %d · 실패 %d' % (done, fail))
