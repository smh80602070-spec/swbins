"""char-forge 사실 몸 빌더(단계 3, saga-unity) — 레시피 하나 → MakeHuman(MPFB) 몸·피부·눈·머리·옷 + CC0 동작 → .fbx(Humanoid) + .glb.

    set BLENDER_USER_RESOURCES=<저장소>/tools/char-forge/_blender        (MPFB 를 사용자 Blender 와 따로 둔다)
    blender -b --factory-startup -P tools/char-forge/build_real.py -- \
        --recipe tools/char-forge/recipes/_cmp_real_hero_f_01.json --out tools/char-forge/_out/_cmp_real_hero_f_01.glb \
        [--fbx tools/char-forge/_out/_cmp_real_hero_f_01.fbx] [--check]

입력(sources.json): MPFB 2.0.17 확장(코드 GPL — 만든 모델은 CC0) · MakeHuman system assets(CC0) · UAL(CC0).
뼈는 MPFB 내장 "game_engine"(UE 마네킹 이름 — 표준 뼈와 root·Head 대소문자만 다르다, rigmaps.MPFB).
동작 굽기·내보내기는 build.py 의 것을 그대로 쓴다(쉼 방향 맞춤·다리 길이 비·땅 붙이기).
"""
import bpy, bmesh, addon_utils, glob, json, math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
import rigmaps  # noqa: E402

MPFB_MOD = 'bl_ext.user_default.mpfb'
# 재질 칸(엔진 CharacterVisual 이 이름 앞머리로 받는다) — MPFB 물체 종류 → 칸
SLOT = {'basemesh': 'skin', 'eyes': 'eye', 'eyebrows': 'hair_brow', 'eyelashes': 'hair_lash', 'hair': 'hair',
        'teeth': 'teeth', 'tongue': 'teeth', 'clothes': 'cloth'}


def mpfb():
    """MPFB 를 켜고 서비스 모듈을 돌려준다. 시스템 에셋 팩이 없으면 멈춘다(fetch_sources.py 가 푼다)."""
    if not os.environ.get('BLENDER_USER_RESOURCES'):
        sys.exit('BLENDER_USER_RESOURCES 를 tools/char-forge/_blender 로 줄 것(MPFB 는 거기 설치된다)')
    addon_utils.enable(MPFB_MOD, default_set=True)
    import importlib
    m = {n: importlib.import_module(f'{MPFB_MOD}.services.{n.lower()}') for n in
         ('HumanService', 'AssetService', 'ExportService', 'ObjectService', 'LocationService', 'TargetService')}
    svc = {n: getattr(mod, n) for n, mod in m.items()}
    if not svc['AssetService'].system_assets_pack_is_installed():
        sys.exit('MakeHuman system assets 가 없다 — py tools/char-forge/fetch_sources.py')
    return svc


def asset(svc, fragment, subdir):
    p = svc['AssetService'].find_asset_absolute_path(fragment, subdir)
    if not p:
        sys.exit(f'{subdir}: 없는 에셋 {fragment}')
    return p


def kind(svc, obj):
    return str(svc['ObjectService'].get_object_type(obj) or '').lower()


def load_targets(svc, basemesh, targets):
    """레시피 targets {모프 이름: 값} — 뼈를 달기 전에 건다(관절 맞춤·옷 맞춤이 바뀐 몸을 보게, MPFB characterbuilder 와 같은 자리).
    좌우 짝 모프는 l-/r- 를 떼고 쓰면 둘 다 건다(예: "ear-shape-pointed"). animal01 팩 모프도 이름으로(예: "elvs_piggy_nose1")."""
    TS = svc['TargetService']
    stack = []
    for n, v in targets.items():
        names = [n] if TS.target_full_path(n) else [f'l-{n}', f'r-{n}']
        for nm in names:
            if not TS.target_full_path(nm):
                sys.exit(f'모르는 모프 {n}')
            stack.append({'target': nm, 'value': float(v)})
    TS.bulk_load_targets(basemesh, stack)
    bpy.context.view_layer.update()


def make_human(svc, r):
    HS = svc['HumanService']
    macro = {'gender': 0.5, 'age': 0.5, 'muscle': 0.5, 'weight': 0.5, 'proportions': 0.5, 'height': 0.5,
             'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.34, 'caucasian': 0.33, 'african': 0.33}}
    macro.update({k: v for k, v in r.get('macro', {}).items() if k != 'race'})
    macro['race'].update(r.get('macro', {}).get('race', {}))
    # 살 아래 도우미(옷 맞춤용)는 가린 채로 만들고 내보내기 전에 지운다. 세분화(subdiv)는 안 건다 — 폰 예산
    basemesh = HS.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True,
                               feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
    if r.get('targets'):
        load_targets(svc, basemesh, r['targets'])
        if r.get('mouth_close'):
            mouth_close(basemesh, float(r['mouth_close']))
        # 다리 길이 모프(upperlegs-height-decr 등)는 발을 띄운다 — create_human 의 땅 맞춤은 macro 만 봐서 다시 맞춘다
        # (MPFB deserialize 도 모프 뒤에 한 번 더 한다. 그쪽은 abs(최저점)이라 뜬 발은 더 올리므로 부호를 지켜 내린다)
        low = svc['ObjectService'].get_lowest_point(basemesh)
        if abs(low) > 1e-4:
            basemesh.location.z -= low
            with build.ctx(basemesh, [basemesh]):
                bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    # 뼈를 부위보다 먼저 — add_mhclo_asset 이 붙이는 순간 가중치를 옮긴다(MPFB characterbuilder 와 같은 순서)
    HS.add_builtin_rig(basemesh, 'game_engine', import_weights=True)
    HS.set_character_skin(asset(svc, r['skin'], 'skins'), basemesh, bodyproxy=None,
                          skin_type='GAMEENGINE', material_instances=False)
    for part in ('eyes', 'eyebrows', 'eyelashes', 'teeth', 'hair'):
        if r.get(part):
            HS.add_mhclo_asset(asset(svc, r[part], part), basemesh, asset_type=part, subdiv_levels=0,
                               material_type='GAMEENGINE')
    for c in r.get('clothes', []):
        path = asset(svc, c, 'clothes')
        # 레시피 폴더 이름 → 물체 이름(.mhclo 의 name 줄, newsboy_cap 처럼 폴더와 다르다) — tints·shell src 가 폴더 이름으로 찾는다.
        # 물체에 붙인 사용자 값은 모프 굳히기에서 사라져 이름 표로 둔다
        nm = next((ln.split(' ', 1)[1].strip() for ln in open(path, encoding='utf-8', errors='replace') if ln.startswith('name ')), None)
        if nm:
            CLOTH_NAMES[c.split('/')[0]] = nm
        HS.add_mhclo_asset(path, basemesh, asset_type='Clothes', subdiv_levels=0,
                           material_type='GAMEENGINE')
    return basemesh


def bake_for_export(svc, basemesh):
    """모프(키·체격)를 바탕에 굳히고, 옷 아래 가린 살·도우미를 실제로 지운다 → 엔진이 받는 평범한 스킨 메시."""
    svc['ExportService'].bake_modifiers_remove_helpers(basemesh, bake_masks=True, bake_subdiv=False,
                                                        remove_helpers=True, also_proxy=True)
    arm = basemesh.parent
    for o in [c for c in arm.children if c.type == 'MESH']:
        if o.data.shape_keys:
            with build.ctx(o, [o]):
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
        for md in [md for md in o.modifiers if md.type != 'ARMATURE']:
            with build.ctx(o, [o]):
                bpy.ops.object.modifier_apply(modifier=md.name)
    return arm


def name_materials(svc, arm):
    """재질 이름을 표준 칸으로(skin·eye·hair·hair_brow·hair_lash·cloth_a·cloth_b …). 같은 칸이 또 나오면 번호."""
    used = {}
    for o in sorted([c for c in arm.children if c.type == 'MESH'], key=lambda c: c.name):
        k = kind(svc, o)
        base = SLOT.get(k, 'cloth')
        o['cf_src'] = o.name                 # 원래 이름(.mhclo name 줄) — tints·kitbash shell `src` 가 옷 이름으로 찾는다(cloth_src)
        for i, mat in enumerate(o.data.materials):
            if not mat:
                continue
            used[base] = used.get(base, 0) + 1
            if base == 'cloth':
                nm = 'cloth_' + 'abcdefghij'[used[base] - 1]
            else:
                nm = base if used[base] == 1 else f'{base}_{used[base]}'
            mat.name = nm
        o.name = f'{arm.name}_{k or "mesh"}' + (f'_{used.get(base, 1)}' if base == 'cloth' else '')


CLOTH_NAMES = {}  # 레시피 옷 폴더 이름 → .mhclo name 줄(make_human 이 채운다)


def cloth_src(arm, key):
    """옷 폴더 이름(또는 원래 물체 이름에 든 글자)으로 옷 물체 찾기."""
    keys = [key] + ([CLOTH_NAMES[key]] if key in CLOTH_NAMES else [])
    return next((o for o in arm.children if o.type == 'MESH' and any(k in o.get('cf_src', '') for k in keys)), None)


TUCK_UNDER = 0.004   # 눌러 넣은 살이 옷 면 아래 이만큼


def tuck(arm, keys):
    """레시피 `tuck`: [옷 폴더 이름] — 그 옷 밖으로 비어져 나온 살을 옷 면 바로 아래로 눌러 넣는다(쉼 자세, 얼굴·목 빼고).
    toigo_fisherman_sweater 는 여자 몸에서 체형을 바꿔도 가슴·어깨뼈 살이 뚫었다(09-27). 옷 면 법선은 믿지 않고
    살 법선으로 판정한다: 바깥(+n) 3cm 안에 옷이 없고 안쪽(-n) 1.2cm 안에 있으면 뚫린 살, 바깥 옷이 TUCK_UNDER 보다 가까우면 얕은 살."""
    from mathutils.bvhtree import BVHTree
    body = next(o for o in arm.children if o.type == 'MESH' and any(s.material and s.material.name.startswith('skin') for s in o.material_slots))
    skip = {g.index for g in body.vertex_groups if g.name in ('head', 'neck_01') or g.name.split('_')[0] in
            ('hand', 'thumb', 'index', 'middle', 'ring', 'pinky')}   # 손은 소매 안쪽을 맞혀 눌릴 수 있다
    mw, mwi, nm = body.matrix_world, body.matrix_world.inverted(), body.matrix_world.to_3x3()
    for key in keys:
        cl = cloth_src(arm, key)
        if cl is None:
            sys.exit(f'tuck: 옷 {key} 이 레시피 clothes 에 없다')
        bm = bmesh.new()
        bm.from_mesh(cl.data)
        bm.transform(cl.matrix_world)
        tree = BVHTree.FromBMesh(bm)
        bm.free()
        moved = 0
        for v in body.data.vertices:
            if v.groups and max(v.groups, key=lambda g: g.weight).group in skip:
                continue
            p, n = mw @ v.co, (nm @ v.normal).normalized()
            fwd = tree.ray_cast(p, n, 0.03)[0]
            if fwd is not None:
                if (fwd - p).length < TUCK_UNDER:
                    v.co = mwi @ (fwd - n * TUCK_UNDER)
                    moved += 1
                continue
            back = tree.ray_cast(p, -n, 0.012)[0]   # 뚫림은 얕다(깊으면 옷 안쪽 다른 면)
            if back is not None:
                v.co = mwi @ (back - n * TUCK_UNDER)
                moved += 1
        body.data.update()
        print('TUCK', key, 'moved', moved)


def hide_under(arm, spec, reach=None, below=None, rows=None, keep=None):
    """레시피 `under`: {겉옷 폴더 이름: [속옷 폴더 이름… 또는 'skin']} — 겉옷에 덮인 속옷(살) 면을 지운다(살의 가림 지우기와 같은 일).
    공방 옷은 몸통 뼈에만 붙어 동작 중 어깨뼈가 벌어지면 속 몸 옷이 등으로 뚫고 나왔다(09-27 조끼·가슴판).
    속옷 정점의 바깥(+n) 3cm 또는 안쪽(-n) 2cm(쉼 자세부터 속옷이 겉옷 밖 — 등 골) 안에 겉옷이 있으면 덮인 것 — 이웃이 모두 덮인 정점만 지워 가장자리 한 줄은 겉옷 밑에 겹쳐 남긴다.
    `reach` = 레시피 `under_reach` {겉옷: [바깥 m, 안쪽 m]} — 2cm 넘게 깊은 안쪽은 겉옷 면이 속옷과 같은 쪽을 볼 때만 덮인 것.
    `rows` = 레시피 `under_rows` {겉옷: {속옷: 줄 수}} — 가장자리에 겹쳐 남길 줄(기본 1, 0 = 덮인 것 전부 지움). 짧은 소매 끝단처럼
    안이 들여다보이는 단은 살을 한 줄만 남기면 지운 경계가 톱니로 보였다 — 살은 셋, 끈이 삐져나오는 민소매는 0(09-27 불량배 vest_cap).
    `keep` = 레시피 `under_keep` {겉옷: {속옷: 팔 무게}} — 윗팔·아래팔 뼈 무게 합이 그 이상인 속옷 정점은 안 지운다. 조끼 진동 밑
    재킷 소매 머리를 지우면 대기에서 팔 따라 나온 소매 위에 지운 자리가 검은 네모 홈으로 보였다(09-27 순찰 대원)."""
    from mathutils.bvhtree import BVHTree
    reach, below, rows, keep = reach or {}, below or {}, rows or {}, keep or {}
    for outer, inners in spec.items():
        far, deep = reach.get(outer, (0.03, 0.02))   # 레시피 `under_reach` {겉옷: [바깥 m, 안쪽 m]} — 판 조끼 등이 재킷 어깨뼈 자리보다 3cm 넘게 안쪽이라 쉼 자세부터 재킷이 뚫었다(09-27 순찰 대원)
        oc = cloth_src(arm, outer)
        if oc is None:
            sys.exit(f'under: 겉옷 {outer} 이 레시피 clothes 에 없다')
        bm = bmesh.new()
        bm.from_mesh(oc.data)
        bm.transform(oc.matrix_world)
        tree = BVHTree.FromBMesh(bm)
        # 레시피 `under_below` {겉옷: 여유 m} — 겉옷 윗단보다 여유만큼 아래이고 겉옷 8cm 안이면 덮인 것(장화 속 바지 — 발목 옆에서
        # 바지가 장화를 뚫어 네모 점이 떴다, 09-27 전장 망자). 광선으로는 장화 목이 좁아지는 발목 옆을 못 잡았다
        cut = (max(v.co.z for v in bm.verts) - below[outer]) if outer in below else None
        bm.free()
        for inner in inners:
            ic = cloth_src(arm, inner) if inner != 'skin' else next(   # 'skin' = 살 — 붙는 뜨개 윗옷을 동작 중 어깨뼈 살이 뚫었다(09-27, tuck 은 쉼 자세만)
                (o for o in arm.children if o.type == 'MESH' and any(sl.material and sl.material.name.startswith('skin') for sl in o.material_slots)), None)
            if ic is None:
                sys.exit(f'under: 속옷 {inner} 이 레시피 clothes 에 없다')
            mw, nm = ic.matrix_world, ic.matrix_world.to_3x3()
            bm = bmesh.new()
            bm.from_mesh(ic.data)
            bm.normal_update()
            def hit(v):
                p, n = mw @ v.co, (nm @ v.normal).normalized()
                if cut is not None and p.z < cut and tree.find_nearest(p, 0.08)[0] is not None:
                    return True
                if tree.ray_cast(p, n, far)[0] is not None:
                    return True
                loc, hn, _i, d = tree.ray_cast(p, -n, deep)
                # 2cm 넘게 깊은 것은 겉옷 판이 속옷과 같은 쪽을 볼 때만(등판) — 진동 둘레 가장자리에 걸린 어깨 소매까지 지워 톱니가 났다
                return loc is not None and (d <= 0.02 or hn.dot(n) > 0.7)
            covered = {v for v in bm.verts if hit(v)}
            kw = keep.get(outer, {}).get(inner)
            if kw is not None:
                dl = bm.verts.layers.deform.active
                arm_g = {g.index for g in ic.vertex_groups if g.name.startswith(('upperarm_', 'lowerarm_'))}
                covered = {v for v in covered if sum(w for gi, w in v[dl].items() if gi in arm_g) < kw}
            kill = covered
            for _ in range(rows.get(outer, {}).get(inner, 1)):
                kill = {v for v in kill if all(e.other_vert(v) in kill for e in v.link_edges)}
            kill = list(kill)
            bmesh.ops.delete(bm, geom=kill, context='VERTS')
            bm.to_mesh(ic.data)
            bm.free()
            print('UNDER', outer, '>', inner, 'removed', len(kill))


SOFTEN_BONES = ('spine_', 'pelvis', 'thigh_', 'calf_')


def soften(arm, spec):
    """레시피 `soften`: {옷 폴더 이름: [세로 횟수, 둘레 횟수]} — 치마의 뼈 무게를 세로로 고르게 펴고, 둘레로는 조금만 편다(왼·오 다리 나눔은 남긴다).
    가슴에서 떨어지는 치마(술사 hanbok_f)는 쉼 자세에선 곧은데, 배 높이 정점이 몸에서 11cm 떨어져 spine_01 에 붙고
    가랑이 밑 한 뼘 사이에 골반 → 허벅지로 바뀌어 대기·걷기에서 배가 불룩하고 가랑이 높이가 꺾였다(09-27).
    세로만 펴면 앞 가운데 왼·오 허벅지 경계가 대기 자세에서 세로 골로 남아 둘레도 조금 편다.
    몸통·다리 뼈에만 붙은 정점만 편다 — 소매(팔 뼈)·저고리 윗부분(spine_02 위)은 그대로."""
    for key, (v_it, h_it) in spec.items():
        cl = cloth_src(arm, key)
        if cl is None:
            sys.exit(f'soften: 옷 {key} 이 레시피 clothes 에 없다')
        names = [g.name for g in cl.vertex_groups]
        ok = [n.startswith(SOFTEN_BONES) and n not in ('spine_02', 'spine_03') for n in names]
        mw = cl.matrix_world
        co = [mw @ v.co for v in cl.data.vertices]
        n, G = len(co), len(names)
        W = np.zeros((n, G))
        for v in cl.data.vertices:
            for g in v.groups:
                W[v.index, g.group] = g.weight
        free = np.array([W[i].sum() > 0 and all(ok[j] or W[i, j] == 0 for j in range(G)) for i in range(n)])
        nbs = ([[] for _ in range(n)], [[] for _ in range(n)])   # 세로 · 둘레 이웃
        for e in cl.data.edges:
            a, b = e.vertices
            d = co[a] - co[b]
            h = int(abs(d.z) <= math.hypot(d.x, d.y))
            nbs[h][a].append(b)
            nbs[h][b].append(a)
        idx = [i for i in range(n) if free[i] and (nbs[0][i] or nbs[1][i])]
        for nb, iters in zip(nbs, (v_it, h_it)):
            for _ in range(iters):
                W2 = W.copy()
                for i in idx:
                    if nb[i]:
                        W2[i] = 0.5 * W[i] + 0.5 * W[nb[i]].mean(axis=0)
                W = W2
        for i in idx:   # 네 뼈까지·합 1 (게임 스킨과 같게)
            w = W[i].copy()
            w[np.argsort(-w, kind='stable')[4:]] = 0
            w /= w.sum()
            for j in range(G):
                if w[j] > 1e-4:
                    cl.vertex_groups[j].add([i], float(w[j]), 'REPLACE')
                elif W[i, j] or any(g.group == j for g in cl.data.vertices[i].groups):
                    cl.vertex_groups[j].remove([i])
        print('SOFTEN', key, 'verts', len(idx), 'iters', v_it, h_it)


def tint(arm, slot, hexcol, outdir):
    """재질 칸의 바탕 그림에 색을 곱해 새 그림으로 굽는다(괴물 피부 초록·잿빛 등). 노드로 곱하면 FBX 가 그림을 못 옮겨서 픽셀로 굽는다.
    그림 픽셀은 sRGB 값 그대로라 색도 sRGB(헥스 그대로)로 곱한다."""
    mat = next((m for o in arm.children if o.type == 'MESH' for m in o.data.materials if m and m.name == slot), None)
    if mat is None:   # 옷 이름으로(칸 글자는 옷 물체 이름 차례라 레시피에서 알기 어렵다)
        ob = cloth_src(arm, slot)
        mat = ob.data.materials[0] if ob is not None and ob.data.materials else None
    if mat is None:
        have = [(o.get('cf_src', ''), [m.name for m in o.data.materials if m]) for o in arm.children if o.type == 'MESH']
        sys.exit(f'tints: 재질 칸·옷 {slot} 이 없다 — 이름 표 {CLOTH_NAMES.get(slot)} · 있는 것 {have}')
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node = bsdf.inputs['Base Color'].links[0].from_node if bsdf.inputs['Base Color'].links else None
    if node is None or node.type != 'TEX_IMAGE':
        sys.exit(f'tints: {slot} 바탕색에 그림이 없다')
    src = node.image
    w, h = src.size
    px = np.empty(w * h * 4, np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    dye = hexcol.startswith('=')
    hx = hexcol.lstrip('=#')
    col = np.array([int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
    if dye:
        # 염색 `=#헥스` — 곱하기는 검은 몸 옷(SF bodysuit 평균 0)에 안 먹는다. 밝기 결(쓰는 칸의 평균·편차로 잰 치우침)만 남기고 색을 새로 입힌다.
        # 결이 없는 그림은 고른 색 — 주름·솔기는 노멀 그림이 맡는다
        lum = px[:, :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        used = lum > 0.02
        ref = lum[used] if used.mean() > 0.01 else lum
        d = np.clip((lum - np.median(ref)) / (ref.std() + 1e-3), -2.0, 2.0)
        px[:, :3] = np.clip(col[None, :] * (1.0 + 0.18 * d)[:, None], 0.0, 1.0)
    else:
        px[:, :3] *= col
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, f'{arm.name}_{slot}.png')
    img = bpy.data.images.new(f'{arm.name}_{slot}', w, h, alpha=True)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw, img.file_format = path, 'PNG'
    img.save()
    # MPFB GAMEENGINE 재질은 같은 그림을 두 노드(바탕색·알파)가 읽는다 — 한쪽만 바꾸면 원본도 FBX 에 딸려 간다(09-25 겪음)
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image == src:
            n.image = img


def eye_color(arm, name, outdir):
    """눈 색 — MPFB 눈 그림(data/eyes/materials/<이름>_eye.png)으로 눈 재질의 그림을 바꾼다. 기본은 전원 붉은 갈색(brown)이라 사람마다 같은 눈이었다.
    FBX 가 그림을 옮기게 결과 폴더로 복사해 그 그림을 읽는다(tint 와 같은 사정)."""
    import shutil
    mat = next((m for o in arm.children if o.type == 'MESH' for m in o.data.materials if m and m.name == 'eye'), None)
    if mat is None:
        sys.exit('eye_color: 눈 재질(eye)이 없다')
    hits = glob.glob(os.path.join(os.environ['BLENDER_USER_RESOURCES'], 'extensions', '.user', 'user_default', 'mpfb', 'data', 'eyes', 'materials', f'{name}_eye.png'))
    if not hits:
        sys.exit(f'eye_color: {name}_eye.png 가 없다')
    os.makedirs(outdir, exist_ok=True)
    dst = os.path.join(outdir, f'{arm.name}_eye.png')
    shutil.copyfile(hits[0], dst)
    img = bpy.data.images.load(dst)
    img.name = f'{arm.name}_eye'
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = img


def makeup_masks(basemesh, svc, gender):
    """화장 마스크 — **성별 표준 몸**(나이·체격 0.5, 모프 없음) 정점 기준으로 굽는다. 마스크는 "입술·볼·눈두덩 정점"이라 인물 모프와 무관하게
    UV 에서 같은 자리다(정점이 얼굴을 따라간다). 인물마다 모프로 다시 재던 옛 방식은 같은 피부 종류·성별끼리도 그림이 미세하게 달라 105장이 모두 따로
    실렸다(피부 283MB) — 이제 같은 종류는 완전히 같은 그림이라 dedupe_forge_textures 가 하나로 합친다(09-29)."""
    node = next(n for n in basemesh.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE')
    W, H = node.image.size
    neutral = svc['HumanService'].create_human(
        mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1,
        macro_detail_dict={'gender': float(gender), 'age': 0.5, 'muscle': 0.5, 'weight': 0.5, 'proportions': 0.5, 'height': 0.5,
                           'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.34, 'caucasian': 0.33, 'african': 0.33}})
    try:
        return _makeup_masks_of(neutral, W, H)
    finally:
        bpy.data.objects.remove(neutral, do_unlink=True)


def _mixed_world_co(basemesh):
    """세계 좌표 (n,3) — 모프는 셰이프키라 v.co 는 바탕 모양이다. 키를 값만큼 섞은 자리를 직접 잰다(bake_for_export 가 굳히는 것과 같은 결과)."""
    n = len(basemesh.data.vertices)
    sk = basemesh.data.shape_keys
    loc = np.empty(n * 3, np.float32)
    basemesh.data.vertices.foreach_get('co', loc)
    loc = loc.reshape(n, 3).astype(np.float64)
    if sk:
        base = np.empty(n * 3, np.float32)
        sk.reference_key.data.foreach_get('co', base)
        loc = base.reshape(n, 3).astype(np.float64)
        for kb in sk.key_blocks:
            if kb == sk.reference_key or kb.mute or kb.value == 0:
                continue
            k = np.empty(n * 3, np.float32)
            r0 = np.empty(n * 3, np.float32)
            kb.data.foreach_get('co', k)
            kb.relative_key.data.foreach_get('co', r0)
            loc += kb.value * (k - r0).reshape(n, 3)
    M = np.array(basemesh.matrix_world)
    return loc @ M[:3, :3].T + M[:3, 3]


def _helper_pts(basemesh, co, name):
    i = next((g.index for g in basemesh.vertex_groups if g.name == name), None)
    idx = [v.index for v in basemesh.data.vertices if any(g.group == i and g.weight > 0.5 for g in v.groups)] if i is not None else []
    return co[idx] if idx else np.zeros((0, 3))


def mouth_close(basemesh, amount):
    """자체 셰이프키 `cf_mouth_close` — 벌어진 입(MakeHuman 기본은 입술이 살짝 벌어져 이가 보인다)을 다문다. 이빨 도우미 정점으로 입 자리를 재서
    윗입술 쪽 정점은 아래로, 아랫입술 쪽은 위로 amount(m)씩 — 가로 코사인·세로 가우시안 가중치. 모프 뒤(값 섞은 자리)에 걸고 키 하나로 남겨 굳히기(bake)가 처리한다."""
    n = len(basemesh.data.vertices)
    co = _mixed_world_co(basemesh)
    teeth = np.vstack([_helper_pts(basemesh, co, 'helper-upper-teeth'), _helper_pts(basemesh, co, 'helper-lower-teeth')])
    if not len(teeth):
        sys.exit('mouth_close: 이빨 도우미 정점이 없다')
    mouth = teeth.mean(0)
    half_w = (teeth[:, 0].max() - teeth[:, 0].min()) / 2
    dx = np.clip(1.0 - np.abs(co[:, 0] - mouth[0]) / (half_w * 1.05), 0.0, 1.0)
    dz = co[:, 2] - mouth[2]
    wz = np.exp(-(dz ** 2) / (2 * 0.0085 ** 2))
    front = np.clip((mouth[1] + 0.012 - co[:, 1]) / 0.02, 0.0, 1.0)     # 입술 앞쪽 살만(안쪽 이빨·혀는 그대로)
    w = np.sin(dx * math.pi / 2) * wz * front
    disp = np.zeros((n, 3))
    disp[:, 2] = -amount * np.tanh(dz / 0.003) * w        # 세계 z: 위 입술은 아래로, 아래 입술은 위로(경계는 부드럽게 — 부호가 딱 갈리면 입꼬리가 톱니로 찢긴다)
    # 세계 변위 → 셰이프키(국소) 변위. 몸 회전이 없어 z 만 같은 축, 크기 배율만 나눠 준다
    M = np.array(basemesh.matrix_world)[:3, :3]
    loc_disp = disp @ np.linalg.inv(M).T
    if not basemesh.data.shape_keys:
        basemesh.shape_key_add(name='Basis')
    sk = basemesh.data.shape_keys
    base = np.empty(n * 3, np.float32)
    sk.reference_key.data.foreach_get('co', base)
    key = basemesh.shape_key_add(name='cf_mouth_close', from_mix=False)
    key.data.foreach_set('co', (base.reshape(n, 3) + loc_disp).astype(np.float32).ravel())
    key.value = 1.0
    bpy.context.view_layer.update()


def _makeup_masks_of(basemesh, W, H):
    """화장 자리 마스크 — 도우미 정점(이빨·눈)으로 입·눈 위치를 재서(모프를 따라간다) UV 그림 크기의 마스크 셋(입술·볼·눈두덩)을 만든다.
    도우미는 bake_for_export 가 지우므로 그 전에 부른다. 좌표는 세계 좌표, 앞 = -y·위 = +z·좌우 = x."""
    mw = basemesh.matrix_world
    gi = {g.name: g.index for g in basemesh.vertex_groups}
    n = len(basemesh.data.vertices)
    co = _mixed_world_co(basemesh)

    def pts(name):
        i = gi.get(name)
        idx = [v.index for v in basemesh.data.vertices if any(g.group == i and g.weight > 0.5 for g in v.groups)] if i is not None else []
        return co[idx] if idx else np.zeros((0, 3))

    teeth = np.vstack([pts('helper-upper-teeth'), pts('helper-lower-teeth')])
    le, re = pts('helper-l-eye'), pts('helper-r-eye')
    if not len(teeth) or not len(le) or not len(re):
        sys.exit('makeup: 이빨·눈 도우미 정점이 없다')
    mouth = teeth.mean(0)
    half_w = (teeth[:, 0].max() - teeth[:, 0].min()) / 2
    eyes = [le.mean(0), re.mean(0)]
    ey = sum(e[2] for e in eyes) / 2
    nv = len(basemesh.data.vertices)
    front = co[:, 1] < mouth[1] - 0.002      # 입 안쪽(이빨·혀 뒤)·뒤통수 제외
    lip = np.clip(1.0 - (((co[:, 0] - mouth[0]) / (half_w * 1.05)) ** 2 + ((co[:, 2] - mouth[2]) / 0.0125) ** 2), 0.0, 1.0)
    lip = np.where(front, lip, 0.0) ** 0.8
    sig = 0.35 * (ey - mouth[2])
    blush = np.zeros(nv)
    for e in eyes:
        cx, cz = e[0] * 1.05, (ey + mouth[2]) / 2 + 0.004
        blush = np.maximum(blush, np.exp(-(((co[:, 0] - cx) ** 2 + (co[:, 2] - cz) ** 2) / (2 * sig * sig))))
    blush = np.where(co[:, 1] < eyes[0][1] + 0.012, blush, 0.0)
    lid = np.zeros(nv)
    for e in eyes:
        lid = np.maximum(lid, np.exp(-(((co[:, 0] - e[0]) ** 2 / (2 * 0.016 ** 2)) + ((co[:, 2] - (e[2] + 0.007)) ** 2 / (2 * 0.0075 ** 2)))))
    lid = np.where(co[:, 1] < eyes[0][1] + 0.004, lid, 0.0)
    uv = basemesh.data.uv_layers.active.data
    masks = [np.zeros((H, W), np.float32) for _ in range(3)]
    for poly in basemesh.data.polygons:
        vs = list(poly.vertices)
        if max(lip[v] for v in vs) + max(blush[v] for v in vs) + max(lid[v] for v in vs) < 1e-3:
            continue
        uvs = [(uv[l].uv[0] * W, uv[l].uv[1] * H) for l in poly.loop_indices]
        for t in range(1, len(vs) - 1):
            ids = (0, t, t + 1)
            P = np.array([uvs[i] for i in ids])
            x0, x1 = int(max(P[:, 0].min() - 1, 0)), int(min(P[:, 0].max() + 1, W - 1))
            y0, y1 = int(max(P[:, 1].min() - 1, 0)), int(min(P[:, 1].max() + 1, H - 1))
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (P[1, 1] - P[2, 1]) * (P[0, 0] - P[2, 0]) + (P[2, 0] - P[1, 0]) * (P[0, 1] - P[2, 1])
            if abs(d) < 1e-9:
                continue
            a = ((P[1, 1] - P[2, 1]) * (xs - P[2, 0]) + (P[2, 0] - P[1, 0]) * (ys - P[2, 1])) / d
            b = ((P[2, 1] - P[0, 1]) * (xs - P[2, 0]) + (P[0, 0] - P[2, 0]) * (ys - P[2, 1])) / d
            c = 1.0 - a - b
            inside = (a >= -0.02) & (b >= -0.02) & (c >= -0.02)
            for m, arr in zip(masks, (lip, blush, lid)):
                val = a * arr[vs[ids[0]]] + b * arr[vs[ids[1]]] + c * arr[vs[ids[2]]]
                sub = m[y0:y1 + 1, x0:x1 + 1]
                np.maximum(sub, np.where(inside, val, 0.0).astype(np.float32), out=sub)
    return masks


MAKEUP_MUL = {'lip': (1.0, 0.60, 0.64), 'blush': (1.04, 0.80, 0.84), 'lid': (0.88, 0.84, 0.86)}


def makeup_apply(arm, masks, spec, outdir):
    """피부 그림에 화장을 곱해 새 그림으로 굽는다(피부 색 그대로 곱하니 어느 피부에도 맞는다). spec = {'lip':세기,'blush':세기,'lid':세기}."""
    mat = next((m for o in arm.children if o.type == 'MESH' for m in o.data.materials if m and m.name == 'skin'), None)
    if mat is None:
        sys.exit('makeup: skin 재질이 없다')
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node = bsdf.inputs['Base Color'].links[0].from_node
    src = node.image
    w, h = src.size
    px = np.empty(w * h * 4, np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    for key, m in zip(('lip', 'blush', 'lid'), masks):
        k = float(spec.get(key, 0.0))
        if k <= 0 or m.shape != (h, w):
            continue
        a = (m * k)[:, :, None]
        px[:, :, :3] = px[:, :, :3] * (1.0 - a) + np.clip(px[:, :, :3] * np.array(MAKEUP_MUL[key], np.float32), 0, 1) * a
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, f'{arm.name}_skin.png')
    img = bpy.data.images.new(f'{arm.name}_skin', w, h, alpha=True)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw, img.file_format = path, 'PNG'
    img.save()
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image == src:
            n.image = img


def _verts_world(o, group=None, min_w=0.5):
    gi = o.vertex_groups[group].index if group else None
    out = []
    for v in o.data.vertices:
        if gi is None or any(g.group == gi and g.weight >= min_w for g in v.groups):
            out.append(o.matrix_world @ v.co)
    return out


def _new_part(arm, name, bm, weights, color, rough, smooth=True, dark=None):
    """dark = (면마다 참/거짓, 헥스) — 참인 면은 둘째 재질 칸 socket(해골 눈구멍·코구멍·입 틈)."""
    """bmesh → 뼈대 자식 스킨 메시(가중치 {정점 번호: {뼈: 무게}}) + 원리 재질 하나(이름 = 칸)."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if dark:
        bm.faces.index_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth  # 바위 판은 모난 면 그대로
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = arm
    for vi, ws in weights.items():
        for bone, w in ws.items():
            vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            vg.add([vi], w, 'REPLACE')
    md = ob.modifiers.new('Armature', 'ARMATURE')
    md.object = arm
    slot = name.split('_kitbash_')[-1]
    mat = bpy.data.materials.new(slot)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = build.hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = rough
    me.materials.append(mat)
    if dark:
        flags, col = dark
        m2 = bpy.data.materials.new('socket')
        m2.use_nodes = True
        b2 = next(n for n in m2.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b2.inputs['Base Color'].default_value = build.hex_rgba(col)
        b2.inputs['Roughness'].default_value = 0.95
        me.materials.append(m2)
        for poly, f in zip(me.polygons, flags):
            poly.material_index = 1 if f else 0
    return ob


def _ring(bm, center, a, b, rx, ry, n):
    return [bm.verts.new(center + a * (rx * math.cos(2 * math.pi * k / n)) + b * (ry * math.sin(2 * math.pi * k / n)))
            for k in range(n)]


def _bridge(bm, r0, r1):
    n = len(r0)
    for k in range(n):
        bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))


def _cone(bm, pts, r0, n=10):
    """점 줄(뿌리 → 끝)을 따라 가늘어지는 원뿔 관 — 뿔·엄니."""
    seg = len(pts) - 1
    rings = []
    for i, c in enumerate(pts):
        tan = (pts[min(i + 1, seg)] - pts[max(i - 1, 0)]).normalized()
        a = tan.cross(Vector((0, 1, 0)) if abs(tan.y) < 0.9 else Vector((1, 0, 0))).normalized()
        b = tan.cross(a).normalized()
        rad = r0 * (1 - i / seg) ** 0.85 + 0.0015
        rings.append(_ring(bm, c, a, b, rad, rad, n))
    for i in range(seg):
        _bridge(bm, rings[i], rings[i + 1])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def _groups_of(skin, names):
    return {skin.vertex_groups[g].index for g in names if g in skin.vertex_groups}


def _skin_weights(skin, v, top=4):
    """살 정점 하나의 뼈 무게(큰 넷, 합 1) — 살에 박히는 부품이 그 자리 살과 같이 움직이게."""
    ws = sorted(((skin.vertex_groups[g.group].name, g.weight) for g in v.groups
                 if g.weight > 0 and skin.vertex_groups[g.group].name in BONE_NAMES), key=lambda t: -t[1])[:top]
    s = sum(w for _, w in ws) or 1.0
    return {b: w / s for b, w in ws} or {'pelvis': 1.0}


BONE_NAMES = set()  # kitbash() 가 뼈대에서 채운다(살 정점 무리 중 뼈 이름인 것만 무게로 옮긴다)


def _shell_zrange(p, height, eyes):
    """껍데기 높이 범위(m) — `z`(키 몫) 또는 `z_eye`(눈 높이에서 m)."""
    zlo, zhi = [f * height for f in p.get('z', (0.0, 1.01))]
    if 'z_eye' in p:
        if eyes is None:
            sys.exit('kitbash shell z_eye: 눈이 없다')
        ez = sum((eyes.matrix_world @ v.co).z for v in eyes.data.vertices) / len(eyes.data.vertices)
        zlo, zhi = ez + p['z_eye'][0], ez + p['z_eye'][1]
    return zlo, zhi


def _shell_faces(skin, p, height, eyes):
    """껍데기가 덮을 살 면 번호 — 모든 정점이 `groups`(fnmatch 무늬, 무게 합 ≥ minw)이고 `z`(키 몫 [아래, 위]) 안.
    `z_eye` [아래, 위] 는 눈 높이에서 m 로 잰 띠(복면·머리띠·바이저 — 키 몫은 머리 크기 모프마다 어긋난다).
    `facing` 이면 살 법선의 앞(-Y) 성분이 그 값 이상인 면만(바이저·앞 가슴판). `facing_back` 은 뒤(+Y) 쪽(배낭). `open_face` 면 눈 앞쪽·눈썹 아래 얼굴 창은 뺀다(투구)."""
    import fnmatch
    names = [g.name for g in skin.vertex_groups]
    want = {skin.vertex_groups[n].index for n in names if any(fnmatch.fnmatch(n, pat) for pat in p['groups'])}
    if not want:
        sys.exit(f"kitbash shell: 무리가 없다 {p['groups']}")
    mw = skin.matrix_world
    rot = mw.to_3x3()
    zlo, zhi = _shell_zrange(p, height, eyes)
    face_min = p.get('facing')
    back_min = p.get('facing_back')  # 등(+Y) 쪽 면만 — 배낭·등판
    minw = p.get('minw', 0.5)
    win = None
    if p.get('open_face') and eyes is not None:
        ev = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
        ecx = sum(v.x for v in ev) / len(ev)
        win = (ecx, sum(v.y for v in ev) / len(ev) + 0.03, max(v.z for v in ev) + 0.028, (max(v.x for v in ev) - min(v.x for v in ev)) * 0.95)
    ok = []
    for v in skin.data.vertices:
        co = mw @ v.co
        good = sum(g.weight for g in v.groups if g.group in want) >= minw and zlo <= co.z <= zhi
        if good and win and co.y < win[1] and co.z < win[2] and abs(co.x - win[0]) < win[3]:
            good = False
        if good and face_min is not None and -(rot @ v.normal).normalized().y < face_min:
            good = False
        if good and back_min is not None and (rot @ v.normal).normalized().y < back_min:
            good = False
        ok.append(good)
    return [f.index for f in skin.data.polygons if all(ok[i] for i in f.vertices)]


def _bone_axes(arm):
    """뼈 이름 → (머리 월드 위치, 머리→꼬리 단위 방향) — 쉼 자세."""
    mw = arm.matrix_world
    return {b.name: (mw @ b.head_local, ((mw @ b.tail_local) - (mw @ b.head_local)).normalized()) for b in arm.data.bones}


def _shell_add(acc, skin, faces, offset, thick, rings=3, snap=None):
    """살 면 → 두께 있는 닫힌 껍데기(바깥·안 두 겹 + 가장자리 벽). 정점마다 그 살 정점의 뼈 무게.
    땅(z=0) 아래로는 안 내려간다(장화 밑창이 법선 쪽으로 1.7cm 땅에 박혔다). 돌려주는 값 = {살 면: (바깥 면, 안 면)}.
    `snap` (아래, 위) m 면 가장자리 정점을 가까운 쪽 높이로 옮겨 띠 끝을 곧게 — 면 단위로 골라 계단 톱니가 났다(09-27 충돌 인형 마디 띠)."""
    from collections import Counter
    bm, weights = acc
    wl = bm.verts.layers.int.get('w') or bm.verts.layers.int.new('w')
    me, mw = skin.data, skin.matrix_world
    rot = mw.to_3x3()
    outer, inner = {}, {}
    for fi in faces:
        for vi in me.polygons[fi].vertices:
            if vi in outer:
                continue
            v = me.vertices[vi]
            co, n = mw @ v.co, (rot @ v.normal).normalized()
            ws = _skin_weights(skin, v)
            for d, tab in ((offset + thick, outer), (offset, inner)):
                q = co + n * d
                q.z = max(q.z, 0.0)
                nv = bm.verts.new(q)
                nv[wl] = len(weights)
                tab[vi] = nv
                weights.append(ws)  # 만든 순서 = 나중 정점 번호(BMVert 는 사전 키로 못 쓴다 — 해골에서 겪음)
    edges = Counter()
    for fi in faces:
        pv = list(me.polygons[fi].vertices)
        for a, b in zip(pv, pv[1:] + pv[:1]):
            edges[(a, b)] += 1
    rim = [(a, b) for (a, b) in edges if (b, a) not in edges]  # 가장자리(한 면만 가진 모서리)
    if snap and len(snap) > 2:
        # `z_snap: "axis"` — 비스듬한 팔 띠: 수평 높이 대신 주 뼈 축 위치로 맞춘다. 끝(위·아래)·좌우마다 가장자리 정점의
        # 축 위치 가운데값으로, 살 면을 따라 축 쪽으로 옮긴다(6cm 까지 — 수평으로 자른 50° 팔 띠 끝은 축 방향으로 ±4.5cm 퍼져 있다, 곧장 위로 옮기면 벌어졌다)
        axes = snap[2]
        groups = {}
        for vi in {v for e in rim for v in e}:
            ws = _skin_weights(skin, me.vertices[vi])
            b = max(ws, key=ws.get)
            if b not in axes:
                continue
            q = outer[vi].co
            side = 0 if abs(q.z - snap[0]) < abs(q.z - snap[1]) else 1
            groups.setdefault((side, b[-2:]), []).append((vi, b))
        for key, vs in groups.items():
            a = axes[max({b for _, b in vs}, key=lambda b: sum(1 for _, x in vs if x == b))][1]
            target = sorted(outer[vi].co.dot(a) for vi, _ in vs)[len(vs) // 2]
            for vi, _ in vs:
                nn = (rot @ me.vertices[vi].normal).normalized()
                t = a - nn * nn.dot(a)
                if t.length < 1e-6:
                    continue
                t.normalize()
                if abs(t.dot(a)) < 0.5:
                    continue
                for tab in (outer, inner):
                    q = tab[vi].co
                    d = (target - q.dot(a)) / t.dot(a)
                    d = max(-0.06, min(0.06, d))
                    tab[vi].co = q + t * d
    elif snap:
        up = Vector((0, 0, 1))
        for vi in {v for e in rim for v in e}:
            nn = (rot @ me.vertices[vi].normal).normalized()
            t = up - nn * nn.dot(up)  # 살 면을 따라 위쪽 — 비스듬한 팔에서 곧장 위로 옮기면 띠가 팔 밖으로 벌어졌다
            if t.length < 1e-6 or t.normalized().z < 0.3:
                continue
            t.normalize()
            for tab in (outer, inner):
                q = tab[vi].co
                z = snap[0] if abs(q.z - snap[0]) < abs(q.z - snap[1]) else snap[1]
                tab[vi].co = q + t * ((z - q.z) / t.z)
    # 안쪽 겹은 가장자리 틈(띄운 만큼의 좁은 틈)으로만 보인다 — 가장자리에서 rings 줄까지만 둔다. 그 너머는 닫힌 바깥 겹에
    # 가려 안 보이는 면이라 안 만든다(장갑·장화·쇠판 삼각형 반쯤)
    near = {v for e in rim for v in e}
    fs = set(faces)
    keep = set()
    for _ in range(rings):
        ring = {fi for fi in fs if any(v in near for v in me.polygons[fi].vertices)}
        keep |= ring
        near |= {v for fi in ring for v in me.polygons[fi].vertices}
    fmap = {}
    for fi in faces:
        pv = list(me.polygons[fi].vertices)
        fo = bm.faces.new([outer[i] for i in pv])
        fmap[fi] = (fo, bm.faces.new([inner[i] for i in reversed(pv)])) if fi in keep else (fo,)
    for a, b in rim:
        bm.faces.new([outer[b], outer[a], inner[a], inner[b]])
    return fmap


def kitbash(arm, parts):
    """괴물 부품 — README §5 D(kitbash). 몸을 다 지은 뒤 실제 살 모양을 재서 자리를 잡는다. 앞 = -Y(Blender), 위 = +Z.
    horns: 머리 뼈에 붙는 굽은 원뿔 둘(`count: 1` 이면 정수리 외뿔) · tusks: 아랫입술 두 끝에서 솟는 엄니 ·
    loincloth: 허리에서 허벅지 중간까지 치마 천(위는 골반, 아래로 갈수록 허벅지 무게) ·
    spores: 등·어깨 살에 반쯤 묻힌 혹 무리(자리·크기는 인물 id 씨앗) · rocks: 어깨·팔·등·정강이에 박힌 모난 바위 판 ·
    robe: 쇄골 아래부터 발목(`length` 면 골반→발목 몫)까지 드리운 옷자락(끝단은 해진 톱니, `teeth` 개)."""
    skin = next(o for o in arm.children if o.type == 'MESH' and o.name.endswith('_basemesh'))
    BONE_NAMES.clear()
    BONE_NAMES.update(b.name for b in arm.data.bones)
    shells, covered, shell_log = {}, set(), []  # 칸 → (bmesh, [무게 — 정점 층 'w' 번호], 색, 거칠기) · 껍데기에 덮인 살 면 · 껍데기마다 (칸, 띄움, 두께, 살 면, 면 짝)
    height = max((skin.matrix_world @ v.co).z for v in skin.data.vertices)
    eyes = next((o for o in arm.children if o.type == 'MESH' and o.name.endswith('_eyes')), None)
    for p in parts:
        kind_ = p['part']
        if kind_ == 'shell':
            # 옷·갑옷 껍데기 — 살을 본떠 띄운 두께 판. 같은 칸(slot: cloth·leather·metal …)은 한 물체로 합친다.
            # `src` = 옷 이름(원래 이름에 든 글자)이면 살 대신 그 옷 면을 본뜬다 — 진짜 옷 아래 살은 빌드가 지워
            # 몸통 위 배낭·조끼 껍데기가 통째로 사라졌다(09-26). 그 옷 면은 안 지운다
            src = skin
            if p.get('src'):
                src = cloth_src(arm, p['src'])
                if src is None:
                    sys.exit(f"kitbash shell src: 옷 {p['src']} 이 없다")
            faces = _shell_faces(src, p, height, eyes)
            slot = p.get('slot', 'cloth')
            if slot not in shells:
                shells[slot] = (bmesh.new(), [], p.get('color', '#6b5a48'), p.get('rough', 0.8))
            fmap = _shell_add(shells[slot][:2], src, faces, p.get('offset', 0.005), p.get('thick', 0.004),
                              snap=(_shell_zrange(p, height, eyes) + ((_bone_axes(arm),) if p.get('z_snap') == 'axis' else ()))
                              if p.get('z_snap') else None)
            if src is skin:
                shell_log.append((slot, p.get('offset', 0.005), p.get('thick', 0.004), set(faces), fmap))
            if p.get('hide_under', True) and src is skin:
                covered.update(faces)
            print('KITBASH shell', slot, '살 면', len(faces))
        elif kind_ == 'horns':
            hv = _verts_world(skin, 'head')
            lo, hi = Vector([min(v[i] for v in hv) for i in range(3)]), Vector([max(v[i] for v in hv) for i in range(3)])
            size = hi - lo
            L, r0, seg = p.get('length', 0.15), p.get('radius', 0.022), 10
            up, back = Vector((0, 0, 1)), Vector((0, 1, 0))
            curl = p.get('curl', 0.5)
            bm, weights = bmesh.new(), {}
            if p.get('count', 2) == 1:
                # 정수리 외뿔 — 뿌리는 머리 가운데 줄에서 실제로 가장 높은 살(머리 모프마다 정수리 높이가 다르다)
                cx, yt = (lo.x + hi.x) / 2, lo.y + p.get('at', 0.40) * size.y
                crown = [v for v in hv if abs(v.x - cx) < 0.012 and abs(v.y - yt) < 0.02] or hv
                base = max(crown, key=lambda v: v.z).copy() - up * (0.6 * r0)
                pts = [base + up * (L * (0.9 * t - 0.2 * curl * t * t)) + back * (L * 0.5 * curl * t * t)
                       for t in (i / seg for i in range(seg + 1))]
                _cone(bm, pts, r0)
            else:
                for sx in (-1, 1):
                    out = Vector((sx, 0, 0))
                    base = Vector(((lo.x + hi.x) / 2 + sx * 0.27 * size.x, lo.y + 0.42 * size.y, hi.z - 0.14 * size.z))
                    base -= (out * 0.4 + up * 0.6) * r0  # 뿌리를 살 속에 조금 묻는다
                    pts = [base + out * (L * 0.5 * t) + up * (L * (0.8 * t - 0.25 * curl * t * t)) + back * (L * 0.45 * curl * t * t)
                           for t in (i / seg for i in range(seg + 1))]
                    _cone(bm, pts, r0)
            bm.verts.index_update()
            for v in bm.verts:
                weights[v.index] = {'head': 1.0}
            _new_part(arm, f'{arm.name}_kitbash_horn', bm, weights, p.get('color', '#d8cdb0'), 0.55)
        elif kind_ == 'tusks':
            # 입술 살(MPFB 'lips' 무리)의 좌우 끝 = 입꼬리. 아랫입술 쪽으로 내려 살 속에 묻고 위·앞·바깥으로 솟게
            lv = _verts_world(skin, 'lips')
            if not lv:
                sys.exit('kitbash tusks: 살에 lips 무리가 없다')
            cx = sum(v.x for v in lv) / len(lv)
            zlow = min(v.z for v in lv)
            L, r0, seg = p.get('length', 0.035), p.get('radius', 0.008), 6
            bm, weights = bmesh.new(), {}
            for sx in (-1, 1):
                corner = max(lv, key=lambda v: (v.x - cx) * sx)
                out = Vector((sx, 0, 0))
                base = Vector((cx + (corner.x - cx) * 0.8, corner.y + 0.004, zlow + 0.002))
                pts = [base + Vector((0, 0, 1)) * (L * t) + Vector((0, -1, 0)) * (L * 0.25 * t) + out * (L * 0.2 * t * t)
                       for t in (i / seg for i in range(seg + 1))]
                _cone(bm, pts, r0, 8)
            bm.verts.index_update()
            for v in bm.verts:
                weights[v.index] = {'head': 1.0}
            _new_part(arm, f'{arm.name}_kitbash_tusk', bm, weights, p.get('color', '#e8dfc4'), 0.45)
        elif kind_ in ('spores', 'rocks'):
            # spores: 등·어깨 뒤쪽 살에 65% 묻힌 둥근 혹 · rocks: 어깨·팔·등·정강이 바깥 살에 반쯤 묻힌 납작하고 모난 바위 판
            # (면을 안 쪼갠 이십면체를 살 법선 쪽으로 눌러 판처럼, 법선 둘레로 아무렇게나 돌린다). 자리·크기는 인물 id 씨앗
            import random, zlib
            rock = kind_ == 'rocks'
            rng = random.Random(zlib.crc32(f"{arm.name}/{kind_}".encode()))
            dflt = (('spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r',
                     'calf_l', 'calf_r') if rock else ('spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'))
            back = _groups_of(skin, p.get('groups', dflt))
            rot = skin.matrix_world.to_3x3()
            cand = [v for v in skin.data.vertices
                    if sum(g.weight for g in v.groups if g.group in back) >= 0.5
                    and (rot @ v.normal).y > (p.get('facing', -0.2) if rock else 0.35)]
            if not cand:
                sys.exit(f'kitbash {kind_}: 붙일 살을 못 찾았다')
            rmin, rmax = p.get('radius', (0.03, 0.08) if rock else (0.018, 0.05))
            picked = []
            for _ in range(4000):
                if len(picked) >= p.get('count', 14):
                    break
                v = cand[rng.randrange(len(cand))]
                r = rmin + (rmax - rmin) * rng.random() ** 1.6  # 작은 혹이 많고 큰 혹은 드물게
                co = skin.matrix_world @ v.co
                if all((co - c).length > (r + rc) * 0.85 for c, rc, _ in picked):
                    picked.append((co, r, v))
            bm, weights = bmesh.new(), {}
            for co, r, v in picked:
                nrm = (rot @ v.normal).normalized()
                ws = _skin_weights(skin, v)
                geom = bmesh.ops.create_icosphere(bm, subdivisions=1 if rock else 2, radius=r)
                if rock:
                    t1 = nrm.cross(Vector((0, 0, 1)) if abs(nrm.z) < 0.9 else Vector((1, 0, 0))).normalized()
                    ang = rng.random() * 2 * math.pi
                    t1 = t1 * math.cos(ang) + nrm.cross(t1) * math.sin(ang)
                    t2 = nrm.cross(t1).normalized()
                    k1, k2, kn = 1 + 0.35 * (rng.random() - 0.5), 1 + 0.35 * (rng.random() - 0.5), p.get('flat', 0.45)
                    ctr = co + nrm * (r * kn * 0.1)  # 판 두께의 절반 조금 넘게 살 속에
                    for bv in geom['verts']:
                        c0 = bv.co.copy()
                        bv.co = ctr + t1 * (c0.x * k1) + t2 * (c0.y * k2) + nrm * (c0.z * kn)
                else:
                    sq = Vector((1 + 0.25 * (rng.random() - 0.5), 1 + 0.25 * (rng.random() - 0.5), 1 + 0.25 * (rng.random() - 0.5)))
                    ctr = co + nrm * (r * 0.35)  # 65% 는 살 속에
                    for bv in geom['verts']:
                        bv.co = ctr + Vector((bv.co.x * sq.x, bv.co.y * sq.y, bv.co.z * sq.z))
                bm.verts.index_update()
                for bv in geom['verts']:
                    weights[bv.index] = ws
            _new_part(arm, f'{arm.name}_kitbash_{"rock" if rock else "spore"}', bm, weights,
                      p.get('color', '#8a8378' if rock else '#b8a24a'), 0.95 if rock else 0.7, smooth=not rock)
        elif kind_ == 'loincloth':
            bones = arm.data.bones
            z_top = (arm.matrix_world @ bones['pelvis'].head_local).z + p.get('top', 0.04)
            th = arm.matrix_world @ bones['thigh_l'].head_local
            kn = arm.matrix_world @ bones['calf_l'].head_local
            z_bot = th.z + (kn.z - th.z) * p.get('length', 0.55)
            # 단면은 몸통·다리 살만 — A 자세에서 손이 엉덩이 높이에 걸려 손까지 두르던 것(고블린 폭 ±0.48m, 09-25 측정)
            hip = {skin.vertex_groups[g].index for g in ('pelvis', 'spine_01', 'thigh_l', 'thigh_r') if g in skin.vertex_groups}
            allv = [skin.matrix_world @ v.co for v in skin.data.vertices
                    if sum(g.weight for g in v.groups if g.group in hip) >= 0.5]
            rows, n = 7, 28
            bm, weights, rings = bmesh.new(), {}, []
            for i in range(rows):
                t = i / (rows - 1)
                z = z_top + (z_bot - z_top) * t
                sl = [v for v in allv if abs(v.z - z) < 0.012] or allv
                lo = Vector((min(v.x for v in sl), min(v.y for v in sl), z))
                hi = Vector((max(v.x for v in sl), max(v.y for v in sl), z))
                flare = 1.10 + 0.12 * t  # 아래로 조금 벌어진다(허벅지가 움직일 틈)
                c = (lo + hi) / 2
                rings.append(_ring(bm, c, Vector((1, 0, 0)), Vector((0, 1, 0)),
                                   (hi.x - lo.x) / 2 * flare + 0.006, (hi.y - lo.y) / 2 * flare + 0.006, n))
            for i in range(rows - 1):
                _bridge(bm, rings[i], rings[i + 1])
            bm.verts.index_update()
            cx = (arm.matrix_world @ bones['pelvis'].head_local).x
            lsign = 1.0 if th.x > cx else -1.0  # thigh_l 이 어느 쪽인지 뼈대에서 읽는다
            for i, ring in enumerate(rings):
                t = i / (rows - 1)
                for v in ring:
                    side = 'thigh_l' if (v.co.x - cx) * lsign > 0 else 'thigh_r'
                    wt = 0.75 * t * min(1.0, abs(v.co.x - cx) / 0.05)
                    weights[v.index] = {'pelvis': 1.0 - wt, side: wt} if wt > 0 else {'pelvis': 1.0}
            _new_part(arm, f'{arm.name}_kitbash_cloth', bm, weights, p.get('color', '#5a4632'), 0.9)
        elif kind_ == 'robe':
            # 떠 있는 괴물(안개 유령)의 긴 옷자락 — 단면은 몸통·다리 살만(팔·손·목은 뺀다), 아래로 갈수록 벌어지고 끝단은 톱니.
            # 무게: 골반 위는 높이에 맞는 등뼈 하나, 아래는 골반 → 허벅지 → 종아리로 옮겨 가되 가운데(두 다리 사이)는 골반에 남긴다
            bones = arm.data.bones
            W = lambda b: arm.matrix_world @ bones[b].head_local  # noqa: E731
            pel, kn, an = W('pelvis'), W('calf_l'), W('foot_l')
            z_top = W('clavicle_l').z - p.get('top', 0.06)
            z_bot = pel.z - (pel.z - an.z) * p['length'] if 'length' in p else an.z + p.get('hem', 0.06)  # length: 골반→발목 몫(짧은 옷)
            body = _groups_of(skin, ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'))
            allv = [skin.matrix_world @ v.co for v in skin.data.vertices
                    if sum(g.weight for g in v.groups if g.group in body) >= 0.6]
            rows, n, flare = 14, 36, p.get('flare', 0.5)
            bm, weights, rings, prev = bmesh.new(), {}, [], None
            for i in range(rows):
                t = i / (rows - 1)
                z = z_top + (z_bot - z_top) * t
                sl = [v for v in allv if abs(v.z - z) < 0.012]
                if sl:
                    # 단면 점을 모두 품는 타원 — 테두리 네모의 내접 타원은 두 다리 단면의 모서리(허벅지 바깥 앞뒤)를 놓친다(09-25 측정 37%)
                    cx0, cy0 = (min(v.x for v in sl) + max(v.x for v in sl)) / 2, (min(v.y for v in sl) + max(v.y for v in sl)) / 2
                    hx = max(max(v.x for v in sl) - cx0, 1e-3)
                    hy = max(max(v.y for v in sl) - cy0, 1e-3)
                    s = max(math.hypot((v.x - cx0) / hx, (v.y - cy0) / hy) for v in sl)
                    prev = (cx0, cy0, hx, hy, s)
                cx0, cy0, hx, hy, s = prev if prev else (0.0, 0.0, 0.15, 0.1, 1.0)
                c = Vector((cx0, cy0, z))
                # 위(가슴)는 살에 붙고, 골반 아래부터 치마처럼 벌어진다 — 아래 단면이 두 다리를 다 품도록 앞뒤도 넓힌다
                below = max(0.0, (pel.z - z) / max(pel.z - z_bot, 1e-6))
                sx = hx * s * (1.04 + flare * below) + 0.008
                sy = max(hy * s, sx * 0.62 * below) * (1.04 + flare * 0.6 * below) + 0.008
                ring = _ring(bm, c, Vector((1, 0, 0)), Vector((0, 1, 0)), sx, sy, n)
                if i == rows - 1:
                    for k, v in enumerate(ring):  # 해진 끝단
                        v.co.z += p.get('jag', 0.05) * (0.5 + 0.5 * math.cos(k * 2 * math.pi * p.get('teeth', 3) / n) * (1 if k % 2 else -0.6))
                rings.append(ring)
            for i in range(rows - 1):
                _bridge(bm, rings[i], rings[i + 1])
            bm.verts.index_update()
            cx = pel.x
            lsign = 1.0 if W('thigh_l').x > cx else -1.0
            spine = sorted(((W(b).z, b) for b in ('spine_01', 'spine_02', 'spine_03')), reverse=True)
            kd = None
            if p.get('weights') == 'skin':
                # 다리가 남는 옷(요정 잎 옷): 골반 아래 정점은 가장 가까운 다리·골반 살의 뼈 무게를 그대로 받는다 — 허벅지를 70% 만
                # 따라가게 하면 서기에 허벅지가 28% 뚫고 나왔다(09-25). 두 다리 사이 가운데 줄만 골반 쪽으로 반쯤 되돌려 찢어지지 않게
                from mathutils import kdtree
                src = [v for v in skin.data.vertices if sum(g.weight for g in v.groups if g.group in body) >= 0.6]
                kd = kdtree.KDTree(len(src))
                for i, v in enumerate(src):
                    kd.insert(skin.matrix_world @ v.co, i)
                kd.balance()
            for ring in rings:
                for v in ring:
                    z = v.co.z
                    if z >= pel.z:
                        b = next((nm for hz, nm in spine if z >= hz), 'pelvis')
                        weights[v.index] = {b: 1.0}
                        continue
                    if kd is not None:
                        ws = _skin_weights(skin, src[kd.find(v.co)[1]])
                        c = p.get('center', 0.5) * max(0.0, 1 - abs(v.co.x - cx) / 0.05)
                        ws = {b: w * (1 - c) for b, w in ws.items()}
                        ws['pelvis'] = ws.get('pelvis', 0.0) + c
                        weights[v.index] = ws
                        continue
                    side = 'l' if (v.co.x - cx) * lsign > 0 else 'r'
                    t_leg = min(1.0, (pel.z - z) / max(pel.z - kn.z, 1e-6))
                    t_calf = min(1.0, max(0.0, (kn.z - z) / max(kn.z - an.z, 1e-6)))
                    leg = 0.7 * t_leg * min(1.0, abs(v.co.x - cx) / 0.06)
                    ws = {'pelvis': 1.0 - leg}
                    if leg > 0:
                        ws[f'thigh_{side}'] = leg * (1 - 0.5 * t_calf)
                        if t_calf > 0:
                            ws[f'calf_{side}'] = leg * 0.5 * t_calf
                    weights[v.index] = ws
            if p.get('hide_legs'):
                # 다리 살을 지우면 발 뼈에 묶인 정점이 0 이 된다 — Unity Humanoid 는 스킨에 묶인 뼈로 아바타를 지어
                # "Required human bone 'LeftFoot' not found" 로 멈춘다(09-25). 끝단에 발·발끝 뼈 무게를 1% 씩 걸어 둔다(움직임엔 안 보인다)
                for v in rings[-1]:
                    side = 'l' if (v.co.x - cx) * lsign > 0 else 'r'
                    ws = {b: w * 0.98 for b, w in weights[v.index].items()}
                    ws[f'foot_{side}'] = ws[f'ball_{side}'] = 0.01  # 발끝(ball)도 — 발 방향 검사가 LeftToes 를 쓴다
                    weights[v.index] = ws
            _new_part(arm, f'{arm.name}_kitbash_robe', bm, weights, p.get('color', '#3c4a5c'), 0.85)
            if p.get('hide_legs'):
                # 떠 있는 유령은 옷자락 속에 다리가 없다 — 옷자락은 허벅지를 70% 까지만 따라가서, 서기·걷기에 다리가 벌어지면
                # 허벅지가 뚫고 나왔다(09-25 광선 측정 서기 29%·걷기 38%). 옷자락 크기를 잰 뒤에 지운다(단면이 다리를 품어야 한다)
                leg = _groups_of(skin, ('thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'))
                zc = pel.z - 0.03
                kill = [v.index for v in skin.data.vertices
                        if sum(g.weight for g in v.groups if g.group in leg) >= 0.5 and (skin.matrix_world @ v.co).z < zc]
                sbm = bmesh.new()
                sbm.from_mesh(skin.data)
                sbm.verts.ensure_lookup_table()
                bmesh.ops.delete(sbm, geom=[sbm.verts[i] for i in kill], context='VERTS')
                sbm.to_mesh(skin.data)
                sbm.free()
                skin.data.update()
                print('KITBASH robe hide_legs: 살 정점', len(kill), '지움')
        elif kind_ == 'skeleton':
            # 해골 — 살·눈·눈썹·머리를 다 걷고 뼈를 코드로 짓는다(skeleton.py). 이(teeth)는 두개골 입 틈에 남긴다. 레시피의 마지막 부품이어야 한다
            import skeleton as SK
            meshes = [o for o in arm.children if o.type == 'MESH' and o is not skin]
            eyes = next(o for o in meshes if o.name.endswith('_eyes'))
            teeth = next((o for o in meshes if o.name.endswith('_teeth')), None)
            P, s_ = SK.build(arm, skin, meshes, p)
            SK.skull(P, arm, skin, eyes, teeth, s_)
            P.bm.verts.index_update()
            P.bm.faces.index_update()
            weights = {v.index: {P.bone_of(v): 1.0} for v in P.bm.verts}
            flags = [bool(f[P.fl]) for f in P.bm.faces]
            _new_part(arm, f'{arm.name}_kitbash_bone', P.bm, weights, p.get('color', '#d6ccb2'), 0.62,
                      dark=(flags, p.get('socket', '#17120e')))
            for o in [skin] + [o for o in meshes if o is not teeth]:
                bpy.data.objects.remove(o, do_unlink=True)
            # 걷은 살·눈의 재질·그림이 남으면 FBX 가 쓰지도 않는 피부 그림을 싣는다(09-25) — 주인 없는 것을 비운다
            bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
            print('KITBASH skeleton: 뼈 조각 정점', len(weights), '· 어두운 면', sum(flags), '· 키 비', round(s_, 3))
        else:
            sys.exit(f'kitbash: 모르는 부품 {kind_}')
    if shell_log:
        # 바깥 껍데기(더 멀리 띄운 판)에 덮인 안쪽 껍데기 면은 안 보이는 낭비 — 판 가장자리에서 두 줄 안쪽부터 지운다
        # (가장자리 틈으로 들여다봐도 구멍이 안 보이게). 화질은 그대로, 삼각형만 준다
        vf = {}
        for f in skin.data.polygons:
            for vi in f.vertices:
                vf.setdefault(vi, []).append(f.index)
        polys = skin.data.polygons
        for slot, off, th, fs, fmap in shell_log:
            over = set()
            for slot2, off2, th2, fs2, _ in shell_log:
                if off2 > off + th + 0.002:
                    over |= fs2
            inner = fs & over
            for _ in range(2):
                inner = {f for f in inner if all(g in inner for vi in polys[f].vertices for g in vf[vi])}
            if inner:
                gone = [x for f in inner for x in fmap[f]]
                bmesh.ops.delete(shells[slot][0], geom=gone, context='FACES_ONLY')
                print('KITBASH shell', slot, '덮인 안쪽 면', len(inner), '지움')
    for slot, (bm, wv, col, rough) in shells.items():
        wl = bm.verts.layers.int['w']
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.verts.index_update()
        _new_part(arm, f'{arm.name}_kitbash_{slot}', bm, {v.index: wv[v[wl]] for v in bm.verts}, col, rough)
    if covered and skin.name in bpy.data.objects:
        # 껍데기 속 살 면은 지운다(같은 뼈 무게라 뚫리진 않지만 삼각형 예산 — 투구 속 귀처럼 튀어나온 살도 여기서 빠진다)
        sbm = bmesh.new()
        sbm.from_mesh(skin.data)
        sbm.faces.ensure_lookup_table()
        bmesh.ops.delete(sbm, geom=[sbm.faces[i] for i in sorted(covered)], context='FACES_ONLY')
        bmesh.ops.delete(sbm, geom=[v for v in sbm.verts if not v.link_faces], context='VERTS')
        sbm.to_mesh(skin.data)
        sbm.free()
        print('KITBASH shell: 덮인 살 면', len(covered), '지움')


def main():
    recipe_path, out = build.arg('--recipe'), build.arg('--out')
    if not recipe_path or not out:
        sys.exit('--recipe · --out 가 필요하다')
    r = json.load(open(recipe_path, encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    svc = mpfb()
    basemesh = make_human(svc, r)
    mk_masks = makeup_masks(basemesh, svc, r['macro']['gender']) if r.get('makeup') else None
    arm = bake_for_export(svc, basemesh)
    arm.name = arm.data.name = r['id']
    name_materials(svc, arm)
    if r.get('tuck'):
        tuck(arm, r['tuck'])
    if r.get('under'):
        hide_under(arm, r['under'], r.get('under_reach'), r.get('under_below'), r.get('under_rows'), r.get('under_keep'))
    if r.get('soften'):
        soften(arm, r['soften'])
    if mk_masks is not None:
        makeup_apply(arm, mk_masks, r['makeup'], os.path.join(os.path.dirname(os.path.abspath(out)), r['id'] + '_tex'))
    if r.get('eye_color'):
        eye_color(arm, r['eye_color'], os.path.join(os.path.dirname(os.path.abspath(out)), r['id'] + '_tex'))
    for slot, col in r.get('tints', {}).items():
        tint(arm, slot, col, os.path.join(os.path.dirname(os.path.abspath(out)), r['id'] + '_tex'))
    if r.get('kitbash'):
        kitbash(arm, r['kitbash'])
    build.cap_textures()
    rep = build.retarget(arm, r.get('anims', 'all'), bool(build.arg('--check')), rigmaps.MPFB)
    build.export(arm, out, build.arg('--fbx'))
    lic = {
        'id': r['id'], 'generator': 'tools/char-forge/build_real.py', 'blender': bpy.app.version_string,
        'license': 'CC0-1.0 (입력 전부 CC0 — MPFB 코드는 GPL 이지만 만든 모델에는 걸리지 않는다)',
        'inputs': ['mpfb 2.0.17: base.obj · targets · rig.game_engine', 'ual1_standard: Unreal Engine/AL_Standard.fbx']
        + [f'makehuman_system_assets: {r[p]}' for p in ('skin', 'eyes', 'eyebrows', 'eyelashes', 'teeth', 'hair') if r.get(p)]
        + [f'makehuman_system_assets: {c}' for c in r.get('clothes', [])]
        + [f'mh_animal01: targets/animal/{t}.target' for t in r.get('targets', {}) if t.split('_')[0] in ('elvs', 'culturalibre', 'jaldmic', 'titleknown')]
        + ([f"char-forge build_real.py kitbash(자체 생성): {', '.join(p['part'] for p in r['kitbash'])}"] if r.get('kitbash') else []),
    }
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    meshes = [m for m in arm.children if m.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in m.data.polygons) for m in meshes)
    lo = min((m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices) if meshes else 0
    hi = max((m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices) if meshes else 0
    meta = rep.pop('_meta')
    worst = max((v['ground_err_m'] or 0 for v in rep.values()), default=0)
    print('CHARFORGE', json.dumps({'id': r['id'], 'bones': len(arm.data.bones), 'meshes': len(meshes), 'tris': tris,
                                   'height_m': round(hi - lo, 3), 'sole_z_m': round(lo, 4), 'anims': len(rep), 'ground_err_max_m': worst,
                                   'leg_ratio': meta['leg_ratio'], 'flipped': meta['flipped'],
                                   'mats': sorted({s.material.name for m in meshes for s in m.material_slots if s.material}),
                                   'textures': sorted({f'{im.size[0]}x{im.size[1]}' for im in bpy.data.images if im.size[0]})},
                                  ensure_ascii=False))
    if build.arg('--check'):
        for n, v in sorted(rep.items(), key=lambda kv: -(kv[1]['ground_err_m'] or 0))[:6]:
            print('CHECK', n, v)
        if worst > 0.01:
            print('CHECK FAIL ground_err > 1cm')
            sys.exit(2)


if __name__ == '__main__':
    main()
