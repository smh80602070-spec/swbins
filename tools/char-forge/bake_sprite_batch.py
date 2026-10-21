"""K-0015 스프라이트 대량 굽기 드라이버 — 계획 JSON 의 벌마다 gear_sprites.py(Blender) 를 돌려 WebP 시트로 묶는다.

py tools/char-forge/bake_sprite_batch.py <plan.json> [--only id1,id2] [--dry]

plan.json:
 {"px":128, "frames":8, "ortho":2.5, "cam_z":0.95, "clips":["idle","walk","attack","hit","death"], "dirs":[0,1,2],
  "bodies": {"basem": "tools/char-forge/_out/cc0_test/cc0_basem.glb", ...},          # 몸 glb (.vrm 복사본)
  "entries": [{"id":"orc_01","body":"basem","kind":"orc_warlord"}, {"id":"x","body":"basef","kind":"rand:undead:7"}]}
 몸마다 같은 이름 + _anims.glb 가 있어야 한다(bake_for_rig.py 산출) — 없으면 이 도구가 만든다.

산출(git 밖): tools/char-forge/_out/sprites/<id>/<동작>.webp (가로 프레임, 세로 방향) + <id>/manifest.json
이미 있는 동작 시트는 건너뛴다(이어하기). Blender 는 낮은 우선순위로 돈다(PC 가 멈추지 않게).
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
OUT = os.path.join(HERE, '_out', 'sprites')
CLIPMAP = ('idle=Idle_Loop,walk=Walk_Loop,sprint=Sprint_Loop,attack=Sword_Attack,hit=Hit_Chest,dodge=Roll,death=Death01,pickup=PickUp_Table'
           # K-0161 자체 키프레임 다섯(새로 굽는 몸 _anims 에도) — 모캡 25 를 더한 30 팩은 data/clips30.json → vroid_clips30_anims.glb(anim_extra c=)
           ',water=CF_Water_Pour,sleep=CF_Sleep_Loop,flag_wave=CF_Flag_Wave_Loop,hang=CF_Hang_Loop,ride_idle=CF_Ride_Idle_Loop,ride_charge=CF_Ride_Charge_Loop')
BELOW_NORMAL = 0x00004000


def run(cmd, env=None, log=None):
    f = open(log, 'wb') if log else subprocess.DEVNULL
    p = subprocess.run(cmd, env=env, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                       creationflags=BELOW_NORMAL if os.name == 'nt' else 0)
    if log:
        f.close()
    return p.returncode


def ensure_anims(glb):
    anims = glb[:-4] + '_anims.glb'
    if not os.path.exists(anims):
        print('동작 굽기:', os.path.basename(glb))
        rc = run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'bake_for_rig.py'), '--', '--target', glb,
                  '--map', 'vroid', '--clips', CLIPMAP, '--out', anims, '--check'], log=anims + '.log')
        if rc != 0 or not os.path.exists(anims):
            sys.exit(f'동작 굽기 실패: {glb} (로그 {anims}.log)')
    return anims


def sheet_from_frames(folder, dirs, frames, out_webp, px):
    from PIL import Image
    sheet = Image.new('RGBA', (px * frames, px * len(dirs)), (0, 0, 0, 0))
    for r, d in enumerate(dirs):
        for f in range(frames):
            im = Image.open(os.path.join(folder, f'd{d}_f{f:02d}.png')).convert('RGBA')
            sheet.alpha_composite(im, (f * px, r * px))
    sheet.save(out_webp, 'WEBP', quality=85, method=6)
    return os.path.getsize(out_webp)


def main():
    plan_path = sys.argv[1]
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    dry = '--dry' in sys.argv
    plan = json.load(open(plan_path, encoding='utf-8'))
    px, frames = plan.get('px', 128), plan.get('frames', 8)
    dirs, clips = plan.get('dirs', [0, 1, 2]), plan.get('clips', ['walk'])
    ents = [e for e in plan['entries'] if not only or e['id'] in only.split(',')]
    print(f'{len(ents)}벌 × 동작 {len(clips)} × 방향 {len(dirs)} × {frames}프레임 · {px}px')
    if dry:
        return
    out_root = os.path.join(ROOT, plan['out']) if plan.get('out') else OUT   # 시범·새 형식은 다른 폴더로(옛 시트를 안 건드림)
    os.makedirs(out_root, exist_ok=True)
    total = 0
    for e in ents:
        odir = os.path.join(out_root, e['id'])
        epx, eortho, ecz = e.get('px', px), e.get('ortho', plan.get('ortho', 2.5)), e.get('cam_z', plan.get('cam_z', 0.95))   # 긴 무기 인물은 칸만 키운다(px/m 같게)
        cmap = e.get('clipmap') or {c: c for c in clips}           # 역할(시트 파일 이름) → _anims.glb 안 동작 이름(K-0029 무기별)
        nfr_of = {}
        if plan.get('roles16'):                                    # K-0138 16방향: 역할 → [동작, 프레임]. '$attack' = 그 인물 clipmap 값(무기별), 'm.<이름>' = 모캡 파일 동작
            nfr_of = {r: n for r, (s, n) in plan['roles16'].items()}
            cmap = {r: (cmap.get(s[1:], s[1:]) if s.startswith('$') else s) for r, (s, n) in plan['roles16'].items()}
        roles = list(cmap)
        todo = [c for c in roles if not os.path.exists(os.path.join(odir, c + '.webp'))]
        if not todo:
            print('건너뜀(있음):', e['id'])
            continue
        body = os.path.abspath(os.path.join(ROOT, plan['bodies'][e['body']]))
        anims = ensure_anims(body)
        tmp = os.path.join(odir, '_frames')
        acts = list(dict.fromkeys(cmap[c] for c in todo))
        env = dict(os.environ, SPRITE_MODE='1', CLIP=','.join(acts), NFR=str(frames), NDIR=str(plan.get('ndir', 4)), DIR_LIST=','.join(map(str, dirs)),
                   SPRITE_PX=str(epx), ORTHO=str(eortho), CAM_Z=str(ecz), ANIM_GLB=anims, VIEW_DEG='180')
        if nfr_of:
            env['NFR_MAP'] = ','.join(f'{cmap[r]}={nfr_of[r]}' for r in todo)
        if plan.get('anim_extra'):                                 # 'm=<모캡 glb>' — 동작 이름 앞에 m. 이 붙는다(gear_sprites) · K-0161 여럿은 ';' 로('m=…;c=…')
            env['ANIM_GLB'] = anims + ''.join(';' + pre + '=' + os.path.join(ROOT, path)
                                              for pre, path in (x.split('=', 1) for x in plan['anim_extra'].split(';') if x))
        if e.get('weapon'):
            env['WEAPON'] = os.path.abspath(os.path.join(ROOT, e['weapon']))
            if e.get('two_hand_clips'):
                env['TWO_HAND_CLIPS'] = ','.join(e['two_hand_clips'])
            env['COMBAT_CLIPS'] = ','.join(cmap[r] for r in plan.get('combat_roles', ('idle', 'attack', 'attack2', 'heavy')) if r in cmap)
            if plan.get('weapon_upright'):
                env['WEAPON_UPRIGHT'] = '1'
        os.makedirs(odir, exist_ok=True)
        t0 = time.time()
        rc = run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'gear_sprites.py'), '--', body, tmp, e['kind']],
                 env=env, log=os.path.join(odir, 'bake.log'))
        if rc != 0:
            print('실패:', e['id'], '(로그', os.path.join(odir, 'bake.log') + ')')
            continue
        sizes = {}
        for c in todo:
            folder = os.path.join(tmp, cmap[c].replace('@', '_').replace(':', '-')) if len(acts) > 1 else tmp
            sizes[c] = sheet_from_frames(folder, dirs, nfr_of.get(c, frames), os.path.join(odir, c + '.webp'), epx)
        man = {'id': e['id'], 'body': e['body'], 'kind': e['kind'], 'px': epx, 'frames': frames, 'dirs': dirs, 'clips': roles,
                   'ortho_m': eortho, 'cam_z': ecz, 'side_faces': 'right', 'px_per_m': round(epx / eortho, 2),
                   'license': 'CC0 VRoid 몸 + 절차 생성 장비(자체) — 출처 tools/char-forge/_src/cc0_vroid, 코드 gear_sprites.py'}
        if plan.get('ndir', 4) != 4 or e.get('weapon'):                 # K-0029 8방향·무기별 시트 — 웹(W-0073)이 읽는 칸
            man.update({'ndir': plan.get('ndir', 4), 'mirror': True, 'weapon': e.get('weapon_kind'), 'clipmap': cmap})
        json.dump(man, open(os.path.join(odir, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        if nfr_of:                                                 # K-0138 웹 sheetspec.js 가 읽는 한 파일(빠진 칸은 웹 DEFAULT16)
            sj = {'dirs': plan.get('ndir', 16), 'rows': len(dirs), 'px': epx, 'cam_z': ecz, 'ortho_m': eortho,
                  'frames': {r: nfr_of[r] for r in roles}, 'fps': {r: plan['fps16'][r] for r in roles if r in plan.get('fps16', {})},
                  'roles': {r: r + '.webp' for r in roles}, 'mirror': True, 'side_faces': 'right', 'weapon': e.get('weapon_kind')}
            json.dump(sj, open(os.path.join(odir, 'sheet.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
        kb = sum(sizes.values()) / 1024
        total += kb
        print(f'ok {e["id"]} {time.time() - t0:.0f}s {kb:.0f}KB ({len(todo)}동작)')
    print(f'끝 - 합계 {total:.0f}KB')


if __name__ == '__main__':
    main()
