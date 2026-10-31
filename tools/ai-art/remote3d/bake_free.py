"""K-0212 — TRELLIS 질감 굽기를 비상업 도구(nvdiffrast·diff-gaussian-rasterization) 없이 순수 torch 로.

쓰는 것은 torch·numpy·opencv 뿐(전부 상업 허용). 세 조각:
  rasterize()      삼각형 z-버퍼(깊이+면 번호 한 키로 scatter_reduce amin) → 면 번호·깊이·무게중심
  render_gaussians() 가우시안 스플래팅(EWA 2D 공분산, 픽셀별 깊이 정렬 + 알파 합성)
  bake_texture()   여러 뷰 관찰을 UV 텍셀에 가림 검사로 투영(미분 없음, 평균) + 빈 칸 inpaint
카메라는 TRELLIS render_utils 와 같은 규약(z-up, yaw/pitch/r/fov, look_at). 행 0 이 위(이미지 규약).
"""
import math

import numpy as np
import torch

SH_C0 = 0.28209479177387814


def look_at_view(eye, up=(0.0, 0.0, 1.0)):
    """원점을 보는 카메라의 월드→카메라 행렬(OpenCV 규약: +x 오른쪽, +y 아래, +z 앞)."""
    eye = torch.as_tensor(eye, dtype=torch.float64)
    f = -eye / eye.norm()
    u = torch.as_tensor(up, dtype=torch.float64)
    r = torch.cross(f, u, dim=0)
    r = r / r.norm()
    d = torch.cross(f, r, dim=0)  # 아래쪽
    R = torch.stack([r, d, f])
    t = -R @ eye
    V = torch.eye(4, dtype=torch.float64)
    V[:3, :3] = R
    V[:3, 3] = t
    return V.float()


def hammersley_views(n, radius=2.0):
    """TRELLIS sphere_hammersley_sequence 와 같은 분포의 카메라 위치 n 개."""
    def vdc(i, base=2):
        f, v = 1.0, 0.0
        while i > 0:
            f /= base
            v += f * (i % base)
            i //= base
        return v
    eyes = []
    for i in range(n):
        u, v = i / n, vdc(i)
        yaw = 2 * math.pi * u
        pitch = math.asin(2 * v - 1)
        eyes.append([math.sin(yaw) * math.cos(pitch) * radius, math.cos(yaw) * math.cos(pitch) * radius, math.sin(pitch) * radius])
    return eyes


def intrinsics_px(fov_deg, size):
    f = 0.5 * size / math.tan(math.radians(fov_deg) / 2)
    return torch.tensor([[f, 0, size / 2], [0, f, size / 2], [0, 0, 1.0]])


def _project(xyz, view, K):
    """월드 점 → (픽셀 x, 픽셀 y, 카메라 깊이 z)."""
    cam = xyz @ view[:3, :3].T + view[:3, 3]
    z = cam[:, 2]
    zs = z.clamp(min=1e-6)
    x = K[0, 0] * cam[:, 0] / zs + K[0, 2]
    y = K[1, 1] * cam[:, 1] / zs + K[1, 2]
    return x, y, z, cam


@torch.no_grad()
def rasterize(verts, faces, view, K, size, uv=None, budget=24_000_000):
    """삼각형 z-버퍼. 반환 dict: face(H,W) int64, -1 이면 빈 곳 / depth(H,W) / uv(H,W,2)(uv 를 주면)."""
    dev = verts.device
    H = W = size
    x, y, z, _ = _project(verts, view, K)
    ok = z > 1e-3
    fx, fy, fz = x[faces], y[faces], z[faces]  # (F,3)
    fok = ok[faces].all(1)
    minx = fx.min(1).values.floor().clamp(0, W - 1).long()
    maxx = fx.max(1).values.ceil().clamp(0, W - 1).long()
    miny = fy.min(1).values.floor().clamp(0, H - 1).long()
    maxy = fy.max(1).values.ceil().clamp(0, H - 1).long()
    inview = fok & (fx.max(1).values >= 0) & (fx.min(1).values < W) & (fy.max(1).values >= 0) & (fy.min(1).values < H)
    ext = torch.maximum(maxx - minx, maxy - miny) + 1
    BIG = torch.iinfo(torch.int64).max
    key = torch.full((H * W,), BIG, dtype=torch.int64, device=dev)
    SH = 31
    ids_all = torch.nonzero(inview).squeeze(1)
    if ids_all.numel() == 0:
        return {'face': torch.full((H, W), -1, dtype=torch.long, device=dev), 'depth': torch.zeros(H, W, device=dev)}
    size_class = 4
    while True:
        lo = size_class // 2 if size_class > 4 else 0
        sel = ids_all[(ext[ids_all] > lo) & (ext[ids_all] <= size_class)]
        if sel.numel():
            S = size_class
            per = max(1, budget // (S * S))
            off = torch.arange(S, device=dev)
            for c in range(0, sel.numel(), per):
                f = sel[c:c + per]
                px = minx[f][:, None, None] + off[None, :, None]
                py = miny[f][:, None, None] + off[None, None, :]
                px = px.expand(-1, S, S)
                py = py.expand(-1, S, S)
                inb = (px <= maxx[f][:, None, None]) & (py <= maxy[f][:, None, None])
                cx, cy = px.float() + 0.5, py.float() + 0.5
                x0, x1, x2 = fx[f, 0][:, None, None], fx[f, 1][:, None, None], fx[f, 2][:, None, None]
                y0, y1, y2 = fy[f, 0][:, None, None], fy[f, 1][:, None, None], fy[f, 2][:, None, None]
                den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
                good = den.abs() > 1e-12
                den = torch.where(good, den, torch.ones_like(den))
                l0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) / den
                l1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) / den
                l2 = 1 - l0 - l1
                inside = inb & good & (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
                # 카메라 깊이는 1/z 가 화면에서 선형 → 깊이 비교용으로 1/z 보간 뒤 뒤집는다
                iz = l0 / fz[f, 0][:, None, None] + l1 / fz[f, 1][:, None, None] + l2 / fz[f, 2][:, None, None]
                zz = 1.0 / iz.clamp(min=1e-9)
                zq = (zz / 16.0).clamp(0, 1) * float((1 << 30) - 1)
                kk = zq.long() * (1 << SH) + f[:, None, None]
                pix = (py * W + px)
                m = inside
                key.scatter_reduce_(0, pix[m], kk[m], reduce='amin', include_self=True)
        if size_class >= max(H, W):
            break
        size_class *= 2
    hit = key != BIG
    face = torch.where(hit, key & ((1 << SH) - 1), torch.full_like(key, -1)).view(H, W)
    out = {'face': face}
    fc = face.clamp(min=0)
    ys, xs = torch.meshgrid(torch.arange(H, device=dev), torch.arange(W, device=dev), indexing='ij')
    cx, cy = xs.float() + 0.5, ys.float() + 0.5
    tri = faces[fc]
    X, Y, Z = x[tri], y[tri], z[tri]
    den = (Y[..., 1] - Y[..., 2]) * (X[..., 0] - X[..., 2]) + (X[..., 2] - X[..., 1]) * (Y[..., 0] - Y[..., 2])
    den = torch.where(den.abs() > 1e-12, den, torch.ones_like(den))
    l0 = ((Y[..., 1] - Y[..., 2]) * (cx - X[..., 2]) + (X[..., 2] - X[..., 1]) * (cy - Y[..., 2])) / den
    l1 = ((Y[..., 2] - Y[..., 0]) * (cx - X[..., 2]) + (X[..., 0] - X[..., 2]) * (cy - Y[..., 2])) / den
    l2 = 1 - l0 - l1
    lam = torch.stack([l0, l1, l2], -1)
    pc = lam / Z  # 원근 보정
    pc = pc / pc.sum(-1, keepdim=True).clamp(min=1e-12)
    out['depth'] = 1.0 / (lam / Z).sum(-1).clamp(min=1e-9)
    if uv is not None:
        out['uv'] = (pc[..., None] * uv[tri]).sum(-2)
    return out


@torch.no_grad()
def render_gaussians(g, view, K, size, max_r=24, budget=30_000_000):
    """g: dict xyz(N,3) scaling(N,3) rotation(N,4, 정규화 전) opacity(N) features(N,1,3). 반환 (size,size,3) uint8, 검은 배경."""
    dev = g['xyz'].device
    xyz, sc, op = g['xyz'], g['scaling'], g['opacity'].reshape(-1)
    q = torch.nn.functional.normalize(g['rotation'], dim=-1)
    col = (g['features'].reshape(-1, 3) * SH_C0 + 0.5).clamp(min=0)
    w, xq, yq, zq = q.unbind(-1)
    R = torch.stack([1 - 2 * (yq * yq + zq * zq), 2 * (xq * yq - w * zq), 2 * (xq * zq + w * yq),
                     2 * (xq * yq + w * zq), 1 - 2 * (xq * xq + zq * zq), 2 * (yq * zq - w * xq),
                     2 * (xq * zq - w * yq), 2 * (yq * zq + w * xq), 1 - 2 * (xq * xq + yq * yq)], -1).view(-1, 3, 3)
    M = R * sc[:, None, :]                      # R S
    cov3 = M @ M.transpose(1, 2)
    px, py, z, cam = _project(xyz, view, K)
    keep = (z > 0.05) & (px > -64) & (px < size + 64) & (py > -64) & (py < size + 64)
    idx = torch.nonzero(keep).squeeze(1)
    if idx.numel() == 0:
        return np.zeros((size, size, 3), np.uint8)
    cam, z, px, py, cov3, op, col = cam[idx], z[idx], px[idx], py[idx], cov3[idx], op[idx], col[idx]
    fx, fy = K[0, 0], K[1, 1]
    J = torch.zeros(idx.numel(), 2, 3, device=dev)
    J[:, 0, 0] = fx / z
    J[:, 0, 2] = -fx * cam[:, 0] / (z * z)
    J[:, 1, 1] = fy / z
    J[:, 1, 2] = -fy * cam[:, 1] / (z * z)
    T = J @ view[:3, :3]
    cov2 = T @ cov3 @ T.transpose(1, 2)
    cov2[:, 0, 0] += 0.3
    cov2[:, 1, 1] += 0.3
    a, b, c = cov2[:, 0, 0], cov2[:, 0, 1], cov2[:, 1, 1]
    det = (a * c - b * b).clamp(min=1e-12)
    ia, ib, ic = c / det, -b / det, a / det
    mid = 0.5 * (a + c)
    lam = mid + torch.sqrt((mid * mid - det).clamp(min=0.0))
    rad = (3.0 * torch.sqrt(lam)).ceil().clamp(1, max_r).long()
    order = torch.argsort(z)                     # 앞에서 뒤로
    px, py, z, ia, ib, ic, rad, op, col = [t[order] for t in (px, py, z, ia, ib, ic, rad, op, col)]
    n = px.numel()
    rank = torch.arange(n, device=dev)
    keys, alphas, cols = [], [], []
    S = 2
    while True:
        lo = S // 2 if S > 2 else 0
        sel = torch.nonzero((rad * 2 + 1 > lo) & (rad * 2 + 1 <= S)).squeeze(1)
        if sel.numel():
            per = max(1, budget // (S * S))
            off = torch.arange(S, device=dev) - (S // 2 - 1) if S > 2 else torch.arange(S, device=dev)
            for ch in range(0, sel.numel(), per):
                s = sel[ch:ch + per]
                cx0 = px[s].floor().long()[:, None, None]
                cy0 = py[s].floor().long()[:, None, None]
                X = cx0 + off[None, :, None]
                Y = cy0 + off[None, None, :]
                X = X.expand(-1, S, S)
                Y = Y.expand(-1, S, S)
                dx = X.float() + 0.5 - px[s][:, None, None]
                dy = Y.float() + 0.5 - py[s][:, None, None]
                pw = -0.5 * (ia[s][:, None, None] * dx * dx + 2 * ib[s][:, None, None] * dx * dy + ic[s][:, None, None] * dy * dy)
                al = (op[s][:, None, None] * torch.exp(pw)).clamp(max=0.99)
                m = (al >= 1 / 255.) & (X >= 0) & (X < size) & (Y >= 0) & (Y < size) & (pw <= 0)
                if m.any():
                    keys.append((Y * size + X)[m] * n + rank[s][:, None, None].expand(-1, S, S)[m])
                    alphas.append(al[m])
                    cols.append(rank[s][:, None, None].expand(-1, S, S)[m])
        if S >= 2 * max_r + 2:
            break
        S *= 2
    img = torch.zeros(size * size, 3, device=dev)
    if keys:
        key = torch.cat(keys)
        al = torch.cat(alphas)
        gi = torch.cat(cols)
        key, perm = torch.sort(key)
        al, gi = al[perm], gi[perm]
        pix = key // n
        la = torch.log1p(-al.double())
        cs = torch.cumsum(la, 0)
        first = torch.ones_like(pix, dtype=torch.bool)
        first[1:] = pix[1:] != pix[:-1]
        seg_start = torch.cummax(torch.where(first, torch.arange(pix.numel(), device=dev), torch.zeros_like(pix)), 0).values
        base = (cs - la)[seg_start]                # 이 픽셀 구간 시작 직전의 누적
        trans = torch.exp((cs - la) - base).float()  # 자기 앞까지의 투과율
        img.index_add_(0, pix, (trans * al)[:, None] * col[gi])
    return (img.clamp(0, 1).view(size, size, 3) * 255).round().byte().cpu().numpy()


@torch.no_grad()
def bake_texture(verts, faces, uvs, observations, masks, views, K, size, texture_size=1024):
    """관찰(위가 행 0, uint8) 들을 UV 텍셀로 가림 검사하며 평균. 반환 (T,T,3) uint8, 위가 행 0."""
    import cv2
    dev = verts.device
    tex = torch.zeros(texture_size * texture_size, 3, device=dev)
    wsum = torch.zeros(texture_size * texture_size, device=dev)
    for obs, msk, view in zip(observations, masks, views):
        r = rasterize(verts, faces, view, K, size, uv=uvs)
        face = r['face']
        # 면이 화면에 거의 수직으로 서 있으면 색이 번지니 가중을 줄인다
        tri = verts[faces[face.clamp(min=0)]]
        n = torch.cross(tri[..., 1, :] - tri[..., 0, :], tri[..., 2, :] - tri[..., 0, :], dim=-1)
        n = torch.nn.functional.normalize(n, dim=-1)
        eye = -(view[:3, :3].T @ view[:3, 3])
        vdir = torch.nn.functional.normalize(eye - tri.mean(-2), dim=-1)
        wgt = (n * vdir).sum(-1).abs()
        ok = (face >= 0) & msk & (wgt > 0.2)
        uv = r['uv'][ok]
        tx = (uv[:, 0] * texture_size).floor().long().clamp(0, texture_size - 1)
        ty = ((1 - uv[:, 1]) * texture_size).floor().long().clamp(0, texture_size - 1)
        idx = ty * texture_size + tx
        w = wgt[ok]
        tex.index_add_(0, idx, obs[ok] * w[:, None])
        wsum.index_add_(0, idx, w)
    has = wsum > 0
    tex[has] /= wsum[has][:, None]
    img = (tex.view(texture_size, texture_size, 3).clamp(0, 1) * 255).byte().cpu().numpy()
    hole = (~has).view(texture_size, texture_size).cpu().numpy().astype(np.uint8)
    return cv2.inpaint(img, hole, 3, cv2.INPAINT_TELEA), has.float().mean().item()
