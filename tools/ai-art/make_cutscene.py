"""K-0044 — 시나리오 컷신 일러스트: `scenario/` 의 부·막·계절 흐름에 맞춘 **배경 전용 컷**(사람 없음) 판마다 12장 = 60장.

  py tools/ai-art/make_cutscene.py batch          # 장면표 → data/cutscene_plan.json + batches/cutscene.json (Illustrious 1152×648, 후보 1)
  py tools/ai-art/make_cutscene.py sheet          # 확인 시트 → _out/cutscene_sheet.jpg
  py tools/ai-art/make_cutscene.py pack           # 1920×1080 webp → _out/cutscene_final/<판>_<번호>_<id>.webp + .license.json
  py tools/ai-art/make_cutscene.py check          # 장면표 = 산출 수 · 크기 · 용량 · .license.json 100%

장면표의 `ref` 는 시나리오 문서의 부·막 제목(정본과 어긋나지 않게 제목만 따른다 — 장 번호는 시나리오가 진행하는 대로 게임이 컷을 연결). 사람·얼굴 컷은 3D 몸 렌더 밑그림 img2img 가 필요해 이번엔 안 한다.
원작 장면·인물 모사 금지·실존 지명 금지(gen.py BLOCK). 글자·로고 없음. 후보는 1장 — 마음에 안 들면 `_out/cutscene_picks.json` 으로 씨앗만 바꿔 다시 뽑는다.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'cutscene_final')
GW, GH = 1152, 648
PREFIX = 'masterpiece, best quality, amazing quality, absurdres, scenery, no humans, wide shot, painterly game cutscene background, cinematic lighting'
NEG = 'lowres, bad anatomy, text, letters, logo, watermark, signature, username, blurry, worst quality, low quality, 1girl, 1boy, solo, people, person, character, face, hands, frame, border'

PLAN = {
    'go': [  # 사가만리 시나리오 1~9부
        ('storm_sky', '1부 먹구름', 'ominous black storm clouds gathering over a peaceful mixed-era village, shafts of light breaking through'),
        ('frost_plateau', '2부 서리봉 고원', 'frozen highland plateau with a lone stone shrine, aurora over snowy peaks, cold blue light'),
        ('scattered_wings', '3부 흩어진 날개', 'old post road across golden plains, torn feathers drifting in the wind, a distant relay station'),
        ('galaxy_ferry', '4부 은하 나루', 'a ferry dock at the edge of a starry river, glowing galaxy water, floating lanterns, a time-worn pier'),
        ('crossroads', '5부 틈새 갈림길', 'a surreal crossroads where signposts point to different eras, floating island shards, soft strange light'),
        ('sunken_capital', '6부 가라앉은 옛 도읍', 'an ancient capital half sunken in dark water, drowned towers and gates, pale moonlight'),
        ('cloud_route', '7부 구름 위 항로', 'ships sailing above a sea of clouds between sky islands, golden sunrise'),
        ('storm_origin', '8부 먹구름의 근원', 'a gigantic swirling black vortex above a ruined citadel, lightning, dramatic red sky'),
        ('petrified_street', '9부 굳은 거리', 'a street of frozen petrified buildings and stone carts, eerie gray fog, a single warm lamp'),
        ('home_village', '개요 · 고향', 'cozy hometown village at morning with smoke from chimneys, bamboo grove and a river'),
        ('portal_gate', '개요 · 문', 'a glowing portal gate between old timber houses and glass towers at dusk'),
        ('epilogue_dawn', '결말', 'peaceful dawn over a restored land, clear sky, birds, soft golden light'),
    ],
    'dungeon': [  # 사가나락 1~5막 + 결말
        ('act1_plain', '1막 중원의 난', 'burning plain with broken war chariots and torn banners under a smoky sunset, distant fortress'),
        ('act1_pit', '1막 굴혈 입구', 'a dark cave entrance at the foot of a cliff with iron gates and torches, ominous mist'),
        ('act2_ruincity', '2막 잿빛 폐도시', 'ruined gray modern city with collapsed towers, rusted cars and drifting ash'),
        ('act2_saltflat', '2막 소금 개펄', 'vast white salt flats with rusted machines half buried and a pale pink sky'),
        ('act3_hellgate', '3막 지옥 균열', 'a gigantic glowing crack in the ground leaking fire and lava, floating rocks, red sky'),
        ('act3_solarcity', '3막 태양 신도시', 'a gleaming futuristic city of mirrored towers under a blinding sun, empty streets'),
        ('act4_desert', '4막 모랫길', 'a long sand road with half-buried statues under a hot orange sky'),
        ('act4_snow', '4막 북방 설산', 'a frozen fortress on a snowy mountain, blizzard, blue shadows'),
        ('act4_scrap', '4막 고철 황무지', 'a wasteland of towering scrap heaps and dead machines under a smoggy sky'),
        ('act5_nameless', '5막 이름 없는 곳', 'a surreal blend of three eras: ancient columns, concrete slabs and neon holograms in a dark void'),
        ('boss_hall', '결전', 'a vast stone throne hall with a huge glowing sigil on the floor and burning braziers'),
        ('epilogue_gate', '결말', 'the great gate opening to a calm sunrise, light pouring over the stone stairs'),
    ],
    'forest': [  # 사가마을 사계
        ('spring_postbox', '봄 옛 우체통', 'an old mossy mailbox at a forest path in spring, cherry blossoms falling, soft morning light'),
        ('spring_village', '봄 마을', 'a cozy village of thatched houses among blooming trees with a stream and a wooden bridge'),
        ('summer_guests', '여름 금으로 온 손님들', 'a summer village square with colorful stalls and golden lanterns, warm evening glow, fireflies'),
        ('summer_modern', '여름 현대 손님', 'a small parking spot at the forest edge with a parked old-fashioned delivery van, tall green trees'),
        ('autumn_records', '가을 앞날의 기록', 'an autumn forest clearing with a glowing futuristic monolith covered in leaves, floating light motes'),
        ('autumn_harvest', '가을 수확', 'harvest festival field with pumpkins and hay bales under an orange sunset'),
        ('winter_linked', '겨울 이어진 숲', 'a snowy forest where trails of light connect all the trees, deep blue night, glowing lanterns'),
        ('winter_hearth', '겨울 난롯가', 'a warm cabin interior with a crackling fireplace and snow outside the window'),
        ('mushroom_valley', '버섯 요정골', 'a valley of giant glowing mushrooms at night with fairy lights'),
        ('firefly_oaks', '반딧불 참나무숲', 'an ancient oak forest alive with fireflies on a summer night'),
        ('giant_boulders', '거인 바위 고개', 'a mountain pass blocked with enormous mossy boulders under morning mist'),
        ('year_after', '결말 · 다음 해', 'the village at dawn after the first snow melts, new green shoots everywhere'),
    ],
    'story': [  # 사가종횡 1~4부
        ('part1_town', '1부 무명', 'a small walled town at dusk with lanterns and a road leading into dark hills'),
        ('part1_forest', '1부 숲길', 'a deep forest road with ancient trees and shafts of light'),
        ('part2_river', '2부 갈래 · 강나루', 'a river port with docked boats and lanterns at night under a full moon'),
        ('part2_city', '2부 갈래 · 도심', 'a rainy modern city street with neon reflections and empty crosswalks'),
        ('part3_gorge', '3부 불길', 'a gorge on fire with burning walls and rising embers, red sky'),
        ('part3_orbital', '3부 궤도 기지', 'an orbital space station corridor with a window onto a vast planet'),
        ('part4_gates', '4부 난세의 문', 'three towering gates side by side, each leading to a different era, glowing'),
        ('part4_battlefield', '4부 옛 전장', 'an ancient battlefield with torn banners and broken spears under storm clouds'),
        ('cave_crystal', '굴혈', 'a cave with giant glowing blue crystals and an underground lake'),
        ('fortress_mountain', '산성', 'a mountain fortress with winding stairs above the clouds at sunrise'),
        ('ruin_capital', '옛터', 'ruins of a vast ancient capital overgrown with vines at golden hour'),
        ('epilogue_road', '결말 · 다음 부', 'a long open road toward a sunrise horizon with three trails branching'),
    ],
    'realm': [  # 사가천하 1~6막
        ('act1_warlords', '1막 군웅', 'many camp fires of rival armies across a dusk plain with distant walled towns'),
        ('act1_palace', '1막 궁성', 'an empty palace hall with red pillars and a throne at dawn, dust in the light'),
        ('act2_great_battle', '2막 대전', 'a vast river plain with two armies\' camps facing each other under a gray sky, smoke'),
        ('act2_modern', '2막 현대', 'a modern cityscape superimposed on an ancient battlefield, ghostly overlap'),
        ('act3_river', '3막 강 위', 'a wide river with a long chain of war ships at night, fire arrows in the sky'),
        ('act3_future', '3막 미래', 'hovering war platforms above a river, glowing banners, cold blue light'),
        ('act4_rift', '4막 삼계 균열', 'a huge rift in the sky pulling storm clouds and shards of three eras, terrifying'),
        ('act5_silkroad', '5막 실크로드', 'a caravan trail through red dunes toward a distant oasis city at sunset'),
        ('act5_sea', '5막 남해', 'a harbor of tall-masted ships at dawn with a calm turquoise sea'),
        ('act6_throne', '6막 천하', 'a grand throne hall opening onto a view of a unified land at sunrise'),
        ('map_table', '지도 막사', 'a command tent with a large map table, candles and carved markers, warm light'),
        ('epilogue_peace', '결말', 'peaceful rice fields and a quiet river with a white heron at dawn'),
    ],
}


def plan_items():
    out = []
    for g, rows in PLAN.items():
        for i, (cid, ref, prompt) in enumerate(rows, 1):
            out.append((g, i, cid, ref, prompt))
    return out


def batch():
    items = []
    for n, (g, i, cid, ref, prompt) in enumerate(plan_items(), 1):
        items.append({'id': f'cut_{g}_{i:02d}_{cid}', 'seed': 20271004 + 97 * n, 'prompt': prompt})
    b = {'model': 'Illustrious-XL-v2.0', 'out': 'cutscene',
         'defaults': {'prompt_prefix': PREFIX, 'width': GW, 'height': GH, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG}, 'items': items}
    json.dump(b, open(os.path.join(HERE, 'batches', 'cutscene.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
    json.dump({'note': 'K-0044 컷신 장면표 — ref 는 시나리오 부·막·계절 제목(제목만 따른다)', 'scenes': [{'game': g, 'no': i, 'id': cid, 'ref': ref, 'prompt': prompt} for g, i, cid, ref, prompt in plan_items()]},
              open(os.path.join(HERE, 'data', 'cutscene_plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH cutscene', len(items))


def sheet():
    cw, ch = 256, 144
    items = plan_items()
    cols = 6
    rows = (len(items) + cols - 1) // cols
    out = Image.new('RGB', (cols * cw, rows * (ch + 12)), (30, 30, 30))
    d = ImageDraw.Draw(out)
    for i, (g, n, cid, ref, _p) in enumerate(items):
        p = os.path.join(OUT, 'cutscene', f'cut_{g}_{n:02d}_{cid}.png')
        x, y = (i % cols) * cw, (i // cols) * (ch + 12)
        if os.path.exists(p):
            out.paste(Image.open(p).convert('RGB').resize((cw, ch)), (x, y + 11))
        d.text((x + 2, y), f'{g}{n:02d} {cid}', fill=(255, 255, 0))
    out.save(os.path.join(OUT, 'cutscene_sheet.jpg'), quality=82)
    print('시트')


def pack():
    os.makedirs(FINAL, exist_ok=True)
    n = 0
    for g, i, cid, ref, _p in plan_items():
        sid = f'cut_{g}_{i:02d}_{cid}'
        src = os.path.join(OUT, 'cutscene', sid + '.png')
        if not os.path.exists(src):
            print('없음', sid)
            continue
        im = Image.open(src).convert('RGB').resize((1920, 1080), Image.LANCZOS)
        dst = os.path.join(FINAL, sid + '.webp')
        im.save(dst, 'WEBP', quality=82, method=6)
        lp = os.path.join(OUT, 'cutscene', sid + '.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': sid, 'game': g, 'scene_ref': ref, 'size': [1920, 1080], 'upscaled_from': [GW, GH], 'note': '사람 없음·글자 없음 — 배경 전용 컷'})
        json.dump(lic, open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n += 1
    print('컷', n)


def check():
    bad = []
    total = 0
    for g, i, cid, ref, _p in plan_items():
        sid = f'cut_{g}_{i:02d}_{cid}'
        p = os.path.join(FINAL, sid + '.webp')
        if not os.path.exists(p):
            bad.append('없음 ' + sid)
            continue
        total += os.path.getsize(p)
        if Image.open(p).size != (1920, 1080):
            bad.append('크기 ' + sid)
        if not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
            bad.append('license 없음 ' + sid)
    mb = total / 1048576
    print(f'컷 {len(plan_items())} · 합계 {mb:.1f}MB')
    print('CUTSCENE_FAIL' if bad else 'CUTSCENE_OK')
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'batch': batch, 'sheet': sheet, 'pack': pack}.get(cmd, lambda: sys.exit(check()) if cmd == 'check' else print(__doc__))()
