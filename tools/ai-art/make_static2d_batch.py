"""K-0056 단계 2 — 웹 2D 정적 지물(건물 12·지물 15·탈것 5·자연 소품 19 = 51)을 AI 로 만드는 배치. 그림체 = B(사용자 판정 2026-10-03).
  py tools/ai-art/make_static2d_batch.py [--only id,id]  → batches/static2d.json (out static2d)
밑그림 = 3D 툰 스프라이트(saga-assets/world/sprite/<id>.webp)를 흰 배경 768 에 올린 것 → img2img(denoise 0.6): 틀·크기·시점은 3D 와 같고 그림체만 B 로 바뀐다
(프롬프트만 쓰면 대상이 화면 가득 확대돼 잘리고, isometric 을 쓰면 받침대가 붙는다 — 10-03 시험). 이름은 3D id 와 같다(웹이 world2d/<id>.webp 자리에 그대로 갈아 끼운다). 지형 조각 10 은 2D 에서 K-0020 바닥 타일이 대신해 뺀다.
STYLE 꼬리가 이후 2D 전부의 상수 — 바꾸면 전부 다시 만든다. 원작·작가·실존 이름 금지(gen.py BLOCK).
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single object'
NEG = ('lowres, bad anatomy, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, '
       'gradient background, background scenery, multiple views, border, frame, human, person, people')
V = 'three-quarter view from above'
# 흰색에 가까운 물체는 흰 배경에서 분리가 모호해 연한 녹회색 배경에 그린다(포장이 배경색을 모서리에서 읽어 지운다)
TINT_BG = {'future_dome_01': (176, 204, 188), 'tree_birch_01': (182, 200, 214), 'tree_pine_01_snow': (176, 204, 188)}
SUBJ = {
    # 건물 12
    'eu_house_01': f'two-storey half-timbered house, steep tiled roof, chimney, small windows, {V}',
    'modern_block_01': f'modern three-storey apartment block, flat roof, ribbon windows, concrete walls, {V}',
    'future_dome_01': f'futuristic dome house, round white dome roof, ring windows, sci-fi dwelling, {V}',
    'stone_tower_01': f'tall stone watchtower, four storeys, crenellated top, small arrow slits, {V}',
    'chinese_hall_01': f'grand hall, red pillars, wide curved tiled eaves, wooden palace building, {V}',
    'dungeon_gate_01': f'rocky arch entrance to a dungeon, stone stairs going down, dark opening, {V}',
    'forest_cottage_01': f'small thatched cottage, round wooden door, tiny chimney, cozy hut, {V}',
    'inn_01': f'two-storey village inn, hanging sign board, tiled roof, wooden balcony, {V}',
    'barn_01': f'large red wooden barn, gabled roof, big double doors, hay loft, {V}',
    'hanok_01': f'traditional korean house, gray curved tile roof, wooden pillars, paper doors, stone base, {V}',
    'jp_minka_01': f'traditional japanese farmhouse, thick thatched hip roof, wooden walls, {V}',
    'silkroad_house_01': f'desert clay-brick house, flat roof, arched door, small windows, sand colored walls, {V}',
    # 지물 15
    'well_01': f'stone water well with small wooden roof, bucket and rope, {V}',
    'street_lamp_01': f'iron street lamp post, glowing lantern, curved arm, {V}',
    'signal_pylon_01': f'futuristic guide pylon, glowing cyan crystal top, white tapered pillar, {V}',
    'torch_stand_01': f'wooden torch stand, burning flame in a bowl, {V}',
    'altar_01': f'stone altar, stepped platform, two small pillars, {V}',
    'iron_fence_01': f'black iron spear fence section with posts, {V}',
    'wood_fence_01': f'wooden picket fence section, rails and posts, {V}',
    'mailbox_01': f'red wooden mailbox on a post, small flag, {V}',
    'haystack_01': f'round haystack, golden hay cone, {V}',
    'bamboo_clump_01': f'clump of green bamboo stalks with leaves, {V}',
    'stele_01': f'stone stele monument with carved top roof, on a stone base, {V}',
    'stone_lantern_01': f'stone garden lantern, tiered roof, glowing window, {V}',
    'banner_pole_01': f'tall wooden banner pole with a plain red cloth banner, stone base, {V}',
    'city_wall_segment_01': f'stone city wall section with battlements, {V}',
    'brazier_01': f'iron fire brazier on three legs, glowing coals and flames, {V}',
    # 탈것 5
    'sail_boat_01': f'small wooden sailboat with a white sail, side view three-quarter, {V}',
    'mine_cart_01': f'wooden mine cart with iron wheels, filled with ore, {V}',
    'raft_01': f'simple wooden log raft with a pole, {V}',
    'ox_cart_01': f'wooden ox cart with two big wheels, hay load, {V}',
    'caravan_wagon_01': f'covered caravan wagon, canvas roof, four wheels, {V}',
    # 자연 소품 19 (K-0052)
    'tree_broadleaf_01': f'tall broadleaf tree, round leafy green crown, brown trunk, {V}',
    'tree_broadleaf_02': f'wide low broadleaf tree, thick trunk, spreading green crown, {V}',
    'tree_pine_01': f'green pine fir tree, layered cone shape, {V}',
    'tree_pine_01_snow': f'snow covered pine fir tree, white snow on layered branches, {V}',
    'tree_pine_02': f'tall pine tree, bare trunk, tufts of green needles on top, {V}',
    'tree_dead_01': f'dead bare tree, twisted dark branches, no leaves, {V}',
    'tree_birch_01': f'white birch tree, white trunk with black marks, light green leaves, {V}',
    'bush_01': f'round green bush, leafy shrub, {V}',
    'grass_tuft_01': f'tuft of green grass blades, {V}',
    'flower_patch_01': f'patch of colorful wildflowers, yellow pink white purple, green stems, {V}',
    'rock_small_01': f'small gray rock with a pebble, {V}',
    'rock_large_01': f'large gray boulder with two smaller rocks, {V}',
    'rock_moss_01': f'gray rock covered with green moss, {V}',
    'pebbles_01': f'handful of small gray pebbles on the ground, {V}',
    'log_01': f'fallen tree log with cut end, small twig, {V}',
    'stump_01': f'tree stump with roots and cut top rings, {V}',
    'mushroom_01': f'cluster of three mushrooms, red cap with white spots and orange caps, {V}',
    'hill_01': f'small grassy hill mound, green grass, {V}',
    'mountain_01': f'rocky mountain peak with snow cap, {V}',
    # 무기 27 (K-0030)
    'wpn_sword_common': f'plain iron straight sword with leather grip, fantasy game weapon item, {V}',
    'wpn_sword_rare': f'steel blue sword with brass crossguard and a small golden gem, fantasy game weapon item, {V}',
    'wpn_sword_legend': f'golden ornate sword with winged crossguard and glowing orange gem, fantasy game weapon item, {V}',
    'wpn_spear_common': f'plain wooden spear with iron leaf head, fantasy game weapon item, {V}',
    'wpn_spear_rare': f'long spear with blue steel head, brass rings and a red tassel, fantasy game weapon item, {V}',
    'wpn_spear_legend': f'golden spear with ornate head, gold rings, glowing gem, fantasy game weapon item, {V}',
    'wpn_axe_common': f'plain iron battle axe with wooden haft, fantasy game weapon item, {V}',
    'wpn_axe_rare': f'blue steel battle axe with brass trim and gem, fantasy game weapon item, {V}',
    'wpn_axe_legend': f'golden double bladed battle axe with ornate head and glowing gem, fantasy game weapon item, {V}',
    'wpn_dagger_common': f'plain iron dagger with leather grip, fantasy game weapon item, {V}',
    'wpn_dagger_rare': f'blue steel dagger with brass guard and small gem, fantasy game weapon item, {V}',
    'wpn_dagger_legend': f'golden ornate dagger with glowing gem, fantasy game weapon item, {V}',
    'wpn_bow_common': f'plain wooden recurve bow with string, fantasy game weapon item, {V}',
    'wpn_bow_rare': f'blue and brass trimmed recurve bow with string and a gem, fantasy game weapon item, {V}',
    'wpn_bow_legend': f'golden ornate recurve bow with glowing gem, fantasy game weapon item, {V}',
    'wpn_staff_common': f'plain wooden staff with iron claw head, fantasy game weapon item, {V}',
    'wpn_staff_rare': f'wooden staff with brass rings and a glowing yellow crystal, fantasy game weapon item, {V}',
    'wpn_staff_legend': f'ornate staff with gold claws and a glowing orange crystal, fantasy game weapon item, {V}',
    'wpn_gun_common': f'plain gray steel pistol, long barrel, fantasy game weapon item, {V}',
    'wpn_gun_rare': f'blue steel pistol with brass trim and gem, fantasy game weapon item, {V}',
    'wpn_gun_legend': f'golden ornate pistol with glowing orange strip, fantasy game weapon item, {V}',
    'wpn_shield_common': f'round wooden shield with iron rim and boss, fantasy game weapon item, {V}',
    'wpn_shield_rare': f'round blue steel shield with brass studs and gem, fantasy game weapon item, {V}',
    'wpn_shield_legend': f'round golden shield with ornate rays and glowing gem, fantasy game weapon item, {V}',
    'wpn_gauntlet_common': f'leather fist gauntlet with iron knuckle plate, fantasy game weapon item, {V}',
    'wpn_gauntlet_rare': f'blue and brass fist gauntlet with gem, fantasy game weapon item, {V}',
    'wpn_gauntlet_legend': f'golden red ornate fist gauntlet with glowing gem, fantasy game weapon item, {V}',
    # 실내 물건 40 (K-0026)
    'table_wood_01': f'rectangular wooden dining table with dark legs, {V}',
    'table_round_01': f'round wooden table on a single pedestal, {V}',
    'chair_wood_01': f'simple wooden chair with high back, {V}',
    'stool_01': f'small round wooden three legged stool, {V}',
    'bed_wood_01': f'wooden bed with pillow and red blanket, {V}',
    'bed_futon_01': f'folded futon bedding on floor with blue blanket and pillow, {V}',
    'shelf_wall_01': f'wooden wall shelf with jars and boxes, {V}',
    'bookshelf_01': f'tall wooden bookshelf full of colorful books, {V}',
    'hearth_stone_01': f'stone fireplace with logs and glowing embers, {V}',
    'stove_iron_01': f'small black iron stove with a chimney pipe, {V}',
    'trunk_01': f'old wooden travel trunk with iron straps and brass lock, {V}',
    'crate_small_01': f'small wooden crate with dark corners, {V}',
    'counter_01': f'wooden shop counter with dark top and a brass bell, {V}',
    'display_stand_01': f'merchant display stand with red cloth and golden trinkets, {V}',
    'mirror_stand_01': f'tall standing mirror in a dark wooden frame, {V}',
    'vase_tall_01': f'tall blue ceramic vase, {V}',
    'candlestick_01': f'brass candlestick with a lit white candle, {V}',
    'rug_rect_01': f'rectangular woven rug, red border, gold and blue pattern, {V}',
    'rug_round_01': f'round woven rug in green, cream and red rings, {V}',
    'oil_lamp_01': f'small brass oil lamp with a flame, {V}',
    'table_lamp_01': f'modern table lamp with a warm glowing shade, {V}',
    'holo_panel_01': f'futuristic standing holographic panel with glowing cyan screen, {V}',
    'sofa_01': f'brown cloth sofa with armrests, {V}',
    'desk_01': f'wooden writing desk with drawers, {V}',
    'wardrobe_01': f'tall wooden wardrobe with two doors, {V}',
    'cabinet_low_01': f'low wooden cabinet with two doors, {V}',
    'kitchen_pot_01': f'iron cooking pot hanging on a tripod over embers, {V}',
    'keg_01': f'small wooden keg with iron hoops and a brass tap, {V}',
    'spinning_wheel_01': f'wooden spinning wheel, {V}',
    'cushion_01': f'round red floor cushion, {V}',
    'low_table_01': f'low wooden table, traditional style, {V}',
    'screen_folding_01': f'four panel folding screen with cream paper panels, {V}',
    'tatami_mat_01': f'straw tatami mat with dark edges, {V}',
    'hanging_lantern_01': f'hanging lantern with glowing window, short chain, {V}',
    'weapon_rack_01': f'wooden weapon rack with swords and spears, {V}',
    'armor_stand_01': f'metal armor stand with chest plate and helmet, {V}',
    'map_table_01': f'wooden map table with a parchment map and a red marker, {V}',
    'globe_stand_01': f'blue world globe on a dark stand, {V}',
    'hologram_globe_01': f'sci-fi hologram globe, glowing cyan, on a dark base, {V}',
    'terminal_01': f'sci-fi computer terminal with glowing cyan screen, {V}',
    # 자연 소품 변형 5 (K-0058)
    'tree_broadleaf_03': f'tall slim broadleaf tree, oval yellow-green leafy crown, thin brown trunk, {V}',
    'tree_pine_03': f'wide dark green spruce tree, big drooping layered branches, {V}',
    'bush_02': f'round green flowering bush with small pink and white flowers, {V}',
    'grass_tuft_02': f'tall thin grass with golden seed heads, {V}',
    'rock_large_02': f'tall standing gray rock pillar with small boulders at the base, {V}',
    # 마을·장터 소품 12 + 던전 방 키트 6 (K-0053)
    'market_stall_01': f'market stall, wooden counter with red and cream striped awning, fruit and crates on top, {V}',
    'low_stone_wall_01': f'low stone wall section, rough stacked gray stones with flat cap stones, {V}',
    'signpost_01': f'wooden signpost, dark pole with two pointed arrow boards, small stone base, {V}',
    'notice_board_01': f'village notice board, wooden frame with small roof, paper notes pinned on, {V}',
    'crate_stack_01': f'stack of four wooden crates with dark iron corners, {V}',
    'barrel_01': f'wooden barrel with iron hoops, {V}',
    'sack_pile_01': f'pile of five tied burlap grain sacks, beige cloth, {V}',
    'tent_small_01': f'small beige canvas a-frame tent with ropes and pegs, {V}',
    'tent_large_01': f'large round circus style tent, red and cream stripes, small red flag on top, {V}',
    'campfire_logs_01': f'campfire pit, ring of stones, leaning firewood logs, no flames, {V}',
    'bench_01': f'wooden park bench with backrest, dark iron legs, {V}',
    'handcart_01': f'wooden hand cart with one spoked wheel pair, two long handles, {V}',
    'dungeon_pillar_01': f'ancient stone pillar, square base and capital, weathered gray stone, {V}',
    'wall_piece_01': f'tall dungeon stone brick wall section, rough stones, {V}',
    'chest_01': f'dark wooden treasure chest with rounded lid, iron bands and small gold lock, {V}',
    'jar_01': f'large brown clay jar with two handles, {V}',
    'altar_base_01': f'round stepped stone altar base, glowing purple ring on top, four small stone posts, {V}',
    'bars_door_01': f'dungeon iron bars gate in a stone doorframe, black vertical bars, {V}',
}


def main():
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    tag = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else 'static2d'                    # 새 묶음은 따로 둔다(예: village)
    sprite_dir = os.path.abspath(sys.argv[sys.argv.index('--init-src') + 1]) if '--init-src' in sys.argv else None   # 3D 렌더 밑그림 폴더(<id>.webp)
    from PIL import Image
    init_dir = os.path.join(HERE, '_out', tag + '_init')
    os.makedirs(init_dir, exist_ok=True)
    root = os.path.abspath(os.path.join(HERE, '..', '..'))
    items = []
    for iid, subj in SUBJ.items():
        if only and iid not in only:
            continue
        src = os.path.join(sprite_dir or os.path.join(root, 'saga-assets', 'world', 'sprite'), iid + '.webp')
        if not os.path.exists(src):
            print('밑그림 없음', iid)
            continue
        sp = Image.open(src).convert('RGBA')
        bb = sp.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        sp = sp.crop(bb)
        k = 600 / max(sp.size)                                     # 768 안에 여백을 두고 키운다
        sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
        cv = Image.new('RGB', (768, 768), TINT_BG.get(iid, (255, 255, 255)))
        cv.paste(sp, ((768 - sp.width) // 2, (768 - sp.height) // 2 + 20), sp)
        ip = os.path.join(init_dir, iid + '.png')
        cv.save(ip)
        items.append({'id': iid, 'seed': int(hashlib.md5(('2d:' + iid).encode()).hexdigest()[:8], 16), 'prompt': f'{subj}, {STYLE}'.replace('white background', 'plain pastel gray-green background') if iid in TINT_BG else f'{subj}, {STYLE}', 'negative': NEG,
                      'init_image': ip, 'denoise': 0.65,
                      'meta': {'mode': 'img2img', 'init_image': iid + '.webp (3D 툰 렌더 밑그림, tools/world-forge)', 'denoise': 0.65, 'init_license': 'CC0-1.0 (코드 형태 + Poly Haven CC0 재질)'}})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': tag,
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
             'items': items}
    out = os.path.join(HERE, 'batches', tag + '.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', out)


if __name__ == '__main__':
    main()
