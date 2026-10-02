"""world-forge 공용 — 재질(Poly Haven PBR 세트)·bmesh 도우미. Blender 헤드리스 안에서 쓴다.

좌표: 미터, x = 오른쪽, y = 앞(+)·뒤(-), z = 위. 벽 좌표계 (u 따라, d 바깥 깊이, v 높이).
"""
import json
import math
import os

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_src', 'polyhaven')
_ROLE = {}


def sources():
    if not _ROLE:
        _ROLE.update(json.load(open(os.path.join(HERE, 'sources.json'), encoding='utf-8'))['items'])
    return _ROLE


_mat_cache = {}
STYLE = {'mode': 'real'}      # 'real' = 사실 PBR(Unity) · 'toon' = 바탕색 한 장(Godot cel_toon·웹 스프라이트)


def set_style(mode):
    STYLE['mode'] = mode


def _image(fn, colorspace):
    p = os.path.join(SRC, fn)
    if not os.path.exists(p):
        raise SystemExit(f'재질 사진 없음 {p} — py tools/world-forge/fetch_sources.py')
    im = bpy.data.images.load(p, check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def pbr_material(tid, tile_m=2.0, tint=None, rough_mul=1.0, name=None, gain=1.0, sat=1.0):
    """Poly Haven 재질 세트 → 원리 재질(밝기·거칠기·노멀). tint = 헥스, 곱해 색을 바꾼다. UV 는 미터 단위(tile_m 미터 = 그림 한 장)."""
    key = (tid, tint, rough_mul, name, gain, sat)
    if key in _mat_cache:
        return _mat_cache[key]
    mat = bpy.data.materials.new(name or tid)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    if STYLE['mode'] == 'toon':
        return _toon_material(mat, nt, bsdf, tid, tint, key, gain, sat)
    idx = {}
    idx_path = os.path.join(SRC, 'index.json')
    if os.path.exists(idx_path):
        idx = json.load(open(idx_path, encoding='utf-8')).get(tid, {})

    def tex(kind, cs):
        fn = idx.get(kind)
        if not fn:
            return None
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = _image(fn, cs)
        n.interpolation = 'Linear'
        return n
    d = tex('diff', 'sRGB')
    d_out = d.outputs['Color'] if d is not None else None
    if d is not None and (gain != 1.0 or sat != 1.0):
        # glTF 는 바탕색 배율을 1 보다 크게 못 싣는다(노드가 내보내기에서 사라진다) — 밝기·채도는 그림 픽셀에 구워 넣는다(옷 공방 tint 와 같은 사정)
        import numpy as np
        src = d.image
        w_, h_ = src.size
        px = np.empty(w_ * h_ * 4, np.float32)
        src.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        lum = px[:, :3].mean(axis=1, keepdims=True)
        px[:, :3] = np.clip((lum + (px[:, :3] - lum) * sat) * gain, 0.0, 1.0)
        img = bpy.data.images.new(f'{tid}_g{gain:g}_s{sat:g}', w_, h_, alpha=False)
        img.pixels.foreach_set(px.ravel())
        img.pack()      # 새 그림은 기본이 sRGB — 픽셀을 채운 뒤 색공간을 만지면 버퍼가 지워진다
        d.image = img
    if d is not None:
        if tint:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs['B'].default_value = hex_rgba(tint)
            nt.links.new(d_out, mix.inputs['A'])
            nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
        else:
            nt.links.new(d_out, bsdf.inputs['Base Color'])
    r = tex('rough', 'Non-Color')
    if r is not None:
        if rough_mul != 1.0:
            m = nt.nodes.new('ShaderNodeMath')
            m.operation = 'MULTIPLY'
            m.inputs[1].default_value = rough_mul
            nt.links.new(r.outputs['Color'], m.inputs[0])
            nt.links.new(m.outputs['Value'], bsdf.inputs['Roughness'])
        else:
            nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
    nor = tex('nor', 'Non-Color')
    if nor is not None:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nor.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    mat['tile_m'] = float(tile_m)
    _mat_cache[key] = mat
    return mat


def _toon_material(mat, nt, bsdf, tid, tint, key, gain=1.0, sat=1.0):
    """툰(원신풍) — 노멀·거칠기를 떼고 바탕색 그림 하나만(256px, 채도 +18%). saga-godot cel_toon 은 바탕색 텍스처 하나만 읽는다."""
    import numpy as np
    idx = json.load(open(os.path.join(SRC, 'index.json'), encoding='utf-8')).get(tid, {}) if os.path.exists(os.path.join(SRC, 'index.json')) else {}
    fn = idx.get('diff')
    if fn:
        im = bpy.data.images.load(os.path.join(SRC, fn), check_existing=False)
        im.scale(256, 256)
        px = np.array(im.pixels[:], np.float32).reshape(256, 256, 4)
        rgb = px[..., :3]
        lum = rgb.mean(axis=2, keepdims=True)
        rgb = np.clip(lum + (rgb - lum) * 1.18 * sat, 0, 1)
        rgb = np.clip(rgb * gain, 0, 1)
        if tint:
            rgb = rgb * np.array(hex_rgba(tint)[:3], np.float32) ** (1 / 2.2)
        px[..., :3] = rgb
        out = bpy.data.images.new(f'{tid}_toon', 256, 256, alpha=False)
        out.pixels.foreach_set(px.ravel())
        out.pack()
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = out
        nt.links.new(n.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Specular IOR Level'].default_value = 0.0
    mat['style'] = 'toon'
    _mat_cache[key] = mat
    return mat


def flat_material(name, color, rough=0.6, metal=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = hex_rgba(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
    return mat


def hex_rgba(h):
    h = h.lstrip('#')
    s = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s]
    return (*lin, 1.0)


class Mesh:
    """bmesh 한 덩어리 + 재질 칸 이름표. quad 로 면을 더하고 UV 는 미터 단위로 준다."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.verify()
        self.mats = []          # 재질 객체 목록(칸 번호 = 목록 위치)
        self.slot = {}          # 이름 → 번호

    def slot_of(self, key, mat):
        if key not in self.slot:
            self.slot[key] = len(self.mats)
            self.mats.append(mat)
        return self.slot[key]

    def face(self, pts, uvs, slot):
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = slot
        for l, uv in zip(f.loops, uvs):
            l[self.uv].uv = uv
        return f

    def quad(self, a, b, c, d, slot, uva=(0, 0), uvb=(1, 0), uvc=(1, 1), uvd=(0, 1)):
        return self.face([a, b, c, d], [uva, uvb, uvc, uvd], slot)

    def box(self, o, u, v, w, slot, tile=1.0):
        """o = 최소 모서리, u·v·w = 세 변 벡터(길이 포함). 여섯 면, 바깥이 앞. UV 는 면 크기 / tile."""
        o, u, v, w = Vector(o), Vector(u), Vector(v), Vector(w)
        p = lambda a, b, c: o + u * a + v * b + w * c
        lu, lv, lw = u.length / tile, v.length / tile, w.length / tile
        # 밖에서 보아 시계 반대 순서
        self.quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0), slot, (0, 0), (lv, 0), (lv, lu), (0, lu))   # -w 면
        self.quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1), slot, (0, 0), (lu, 0), (lu, lv), (0, lv))    # +w 면
        self.quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1), slot, (0, 0), (lu, 0), (lu, lw), (0, lw))    # -v 면
        self.quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), slot, (0, 0), (lw, 0), (lw, lu), (0, lu))    # +v 면
        self.quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0), slot, (0, 0), (lw, 0), (lw, lv), (0, lv))    # -u 면
        self.quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1), slot, (0, 0), (lv, 0), (lv, lw), (0, lw))    # +u 면

    def build(self, arm_parent=None):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def cap_textures(max_px=1024):
    """텍스처 최대 변 — 2k 사진을 그대로 품으면 건물 하나가 100MB 를 넘는다. 트랙 가져오기에서 다시 키울 일은 없다(멀리서 보는 건물)."""
    for im in bpy.data.images:
        if im.size[0] > max_px or im.size[1] > max_px:
            k = max_px / max(im.size)
            im.scale(max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))


def export_glb(objs, path, max_px=1024, fmt='AUTO', jpeg_q=88):
    cap_textures(max_px)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_image_format=fmt, export_jpeg_quality=jpeg_q)
