"""아이템 아이콘 일괄 계획(K-0035 ①) — icon_inventory.json 의 모든 항목을 그림 키(+태그형 프롬프트)에 묶어 data/icon_plan.json 을 만든다.
  py tools/ai-art/build_icon_plan.py          # → tools/ai-art/data/icon_plan.json
  - 키 하나 = 그림 한 장. 같은 물건(진주·사과·방석…)은 한 키로 합친다(ALIAS).
  - 모드: ai(SD 로 그림) · glyph(룬 12 — 코드 글리프) · color(염색 일곱 — 코드 색 견본) · skip(없음·덧옷 켜기 같은 상태 값)
  - 태그는 영문 객체 태그(문장형은 애니메이진이 추상 그림으로 푼다, 10-03 시험). 원작·실존 이름 금지(gen.py BLOCK 도 막는다).
  - 인벤토리의 모든 (판, id)가 한 번씩 풀려야 한다 — 빠지면 오류로 멈춘다(아이콘 수 = 종류 수 검증).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
inv = json.load(open(os.path.join(HERE, 'data', 'icon_inventory.json'), encoding='utf-8'))
trial = {i['id']: i for i in json.load(open(os.path.join(HERE, 'data', 'icon_trial30.json'), encoding='utf-8'))['items']}

# ── 키 → 태그 (시험 30 에서 가져오되 아쉬웠던 넷은 고침) ─────────────────────────────────────────────
T = {k: v['tags'] for k, v in trial.items()}
T['u_ssanggeom'] = 'sword, blade, twin swords, curved blade, ornate hilt, gold dragon engraving on blade'
T['honey_flower'] = 'flower, yellow flower, petals, bloom, green stem'
T['stardust'] = 'small cloth pouch, drawstring bag, sparkles, blue glow'
T['spade'] = 'single shovel, one spade, iron shovel head, wooden handle'

# ── 쪽(서랍)별 추가 태그 ──────────────────────────────────────────────────────────────────────
T.update({
    # 사가블로 기본 장비
    'w_cheoltae': 'bow (weapon), iron bow, heavy bow, metal limbs, bowstring',
    'w_bugae': 'axe, battle axe, single blade, wooden handle, steel axe head',
    'w_geukchang': 'halberd, polearm, axe blade, spear tip, long pole',
    'w_bilbut': 'calligraphy brush, ink brush, long wooden handle, ink',
    'w_lance_e': 'futuristic spear, energy lance, glowing blue tip, metallic pole, sci-fi',
    'w_gauntlet': 'powered gauntlet, mechanical glove, metal fist, sci-fi, glowing lines',
    'a_jichap': 'armor, leather armor, brown leather, chest armor, straps',
    'a_pigap': 'armor, hide armor, fur trim, thick leather, chest armor',
    'a_chalgap': 'armor, scale armor, small metal plates, laced armor, chest armor',
    'a_dopo': 'robe, long robe, cloth coat, wide sleeves, sash',
    'a_myeongap': 'cloth helmet, padded hood, quilted cap, head armor',
    'a_cheollip': 'wide brimmed hat, iron hat, conical hat, steel',
    'g_wangap': 'bracer, arm guard, leather vambrace, metal studs',
    'g_wandae': 'cloth wrist wrap, bracer, fabric bands, wrapped forearm guard',
    'b_hwaje': 'boots, leather boots, cloth boots, long boots',
    'n_okpae': 'jade pendant, necklace, green stone, silk cord',
    'n_geumpae': 'gold pendant, necklace, gold plate, chain',
    'c_hopae': 'wooden tag, name tag, rectangular wooden tablet, cord',
    'c_yeombul': 'prayer beads, wooden beads, string of beads, tassel',
    'c_hobu': 'bronze tally, tiger shaped talisman, half tablet, metal',
    'c_dokkaebi': 'bell, small bronze bell, ringing bell, red cord, charm',
    'c_gyeong': 'bronze mirror, round hand mirror, ancient mirror, ornate back',
    'r_geumji': 'ring, gold ring, jewelry, thick band',
    # 사가블로 유니크
    'u_byeoksan': 'flail, ornate chain flail, spiked ball, glowing, gold ornament',
    'u_cheonjigang': 'spear, ornate spear, long gold-trimmed polearm, glowing tip, red tassel',
    'u_cheongryong': 'glaive, polearm, green blade, crescent blade, dragon engraving, ornate',
    'u_manbal': 'bow (weapon), ornate bow, golden recurve bow, glowing string, engraved',
    'u_gwiseon': 'axe, ornate axe, double blade axe, glowing purple, spirit',
    'u_baekhak': 'hand fan, folding fan, white crane feathers, ornate, glowing',
    'u_jukjang': 'staff, green bamboo staff, glowing leaf, magic staff',
    'u_iljabul': 'calligraphy brush, ornate brush, glowing ink, gold tip',
    'u_yukdo': 'closed book, ornate ancient book, glowing, gold clasp, tied scroll',
    'u_danryeong': 'armor, ornate leather armor, red collar, gold trim, chest armor',
    'u_dujeong': 'armor, black scale armor, studded plate armor, ornate, glowing rivets',
    'u_chalgap': 'armor, ornate scale armor, many small plates, silver, chest armor',
    'u_dopo': 'robe, white robe, crane embroidery, flowing, glowing',
    'u_cheollip': 'wide brimmed hat, black iron hat, ornate, glowing',
    'u_okro': 'ornate crown, jade crown, heron ornament, silk ribbon',
    'u_eunwol': 'helmet, silver helmet, crescent moon ornament, plume',
    'u_cheongeun': 'bracer, heavy iron arm guard, massive vambrace, ornate',
    'u_yusu': 'cloth wrist wrap, flowing blue ribbon bracer, water pattern, glowing',
    'u_cheolli': 'boots, winged boots, fast, ornate leather boots, glowing',
    'u_unmun': 'shoes, cloth shoes, cloud pattern, embroidered shoes, glowing',
    'u_taeeul': 'jade pendant, ornate necklace, carved green jade, glowing, silk tassel',
    'u_geumin': 'gold seal plate, ornate pendant, engraved gold tablet, chain',
    'u_yongmun': 'ring, dragon ring, gold ring, jade stone, glowing',
    'u_hopae': 'wooden tag, official tablet, horse engraved, rectangular, glowing',
    'u_okgae': 'ring, jade ring, moonstone, silver band, glowing',
    'u_dokkaebi': 'bell, ornate bell, horned bell, gold, glowing',
    'u_gyeong': 'bronze mirror, ornate round mirror, glowing glass, jeweled frame',
    'u_mandara': 'prayer beads, large glowing beads, necklace, lotus, tassel',
    'u_byeoksa': 'paper talisman, red talisman, glowing symbols, yellow paper, charm',
    # 세트(조각 아님 — 세트 대표 휘장)
    'set_chungmu': 'emblem, loyalty crest, red banner badge, sword and shield, gold trim',
    'set_waryong': 'emblem, dragon crest, coiled dragon, blue badge, gold trim',
    'set_horang': 'emblem, tiger crest, tiger head, orange badge, claws',
    'set_cheongnang': 'emblem, medicine pouch crest, herb leaf, green badge, cloth bag',
    'set_cheolong': 'emblem, iron jar crest, round iron badge, rivets, shield',
    'set_eunha': 'emblem, galaxy crest, silver stars, dark blue badge, swirl',
    'set_maenghon': 'emblem, fierce spirit crest, flame, purple badge, skull ornament',
    'set_biyeong': 'emblem, shadow crest, feather, swift bird, dark badge',
    'set_paewang': 'emblem, overlord crest, crown, gold badge, black',
    'set_hyeonhak': 'emblem, black crane crest, crane, dark badge, white feathers',
    # 보석
    'amber': 'amber, orange gemstone, translucent, faceted gem, insect inside',
    'onyx': 'onyx, black gemstone, polished, glossy, faceted gem',
    'voidstone': 'magnetic crystal, sci-fi gem, glowing purple crystal, blue sparks, metal cage',
    # 사가스토리 일반 장비(1~4 = 낮은→높은 등급)
    'st_sword1': 'wooden sword, practice sword, plain wood, training',
    'st_sword2': 'sword, curved sword, iron blade, ring pommel, plain hilt',
    'st_sword3': 'sword, blue steel blade, straight sword, fine hilt, blue tassel',
    'st_sword4': 'sword, dragon scale blade, ornate sword, green scales, golden hilt',
    'st_hat1': 'leather cap, simple leather hood, brown cap',
    'st_hat2': 'helmet, iron helmet, round steel, plain',
    'st_hat3': 'helmet, phoenix crest helmet, steel, red plume, wings',
    'st_hat4': 'helmet, golden helmet, ornate gold crown helmet, gem',
    'st_top1': 'cotton jacket, plain cloth jacket, white tunic, simple',
    'st_top2': 'armor, leather armor, brown chest armor, buckles',
    'st_top3': 'armor, scale armor, small metal plates, laced chest armor',
    'st_top4': 'armor, studded armor, rivets, steel plate, red trim',
    'st_bot1': 'cotton pants, plain baggy trousers, white cloth',
    'st_bot2': 'leather skirt armor, brown leather tassets, armored skirt, straps',
    'st_bot3': 'iron skirt armor, steel leaf plates, armored skirt',
    'st_bot4': 'ornate skirt armor, dragon pattern, gold trim, armored skirt',
    'st_shoe1': 'sandals, straw sandals, woven, footwear',
    'st_shoe2': 'boots, leather boots, simple, brown',
    'st_shoe3': 'boots, iron boots, steel plated boots, studs',
    'st_shoe4': 'boots, winged dragon boots, ornate, flying, gold trim',
    'st_glv1': 'bracelet, cloth wristband, simple wrap',
    'st_glv2': 'gloves, leather gloves, brown, straps',
    'st_glv3': 'gauntlets, iron gauntlets, steel plates',
    'st_glv4': 'gauntlets, dragon claw gauntlets, ornate, golden claws',
    'st_cap1': 'cape, plain cloth cape, beige, short',
    'st_cap2': 'cape, leather cape, brown, fur edge',
    'st_cap3': 'cape, otter fur cape, brown fur collar, warm',
    'st_cap4': 'cape, black dragon cape, dark flowing, gold dragon embroidery',
    'st_ring1': 'ring, simple cloth ring, wooden band',
    'st_ring2': 'ring, silver ring, plain band, jewelry',
    'st_ring3': 'ring, jade ring, green stone, jewelry',
    'st_ring4': 'ring, golden dragon ring, gold band, ruby',
    'st_neck1': 'necklace, wooden bead necklace, string',
    'st_neck2': 'necklace, silver necklace, chain, pendant',
    'st_neck3': 'necklace, jade necklace, green beads, jewelry',
    'st_neck4': 'necklace, golden necklace, gold chain, jewel pendant',
    'st_ear1': 'earring, wooden earring, simple',
    'st_ear2': 'earring, silver earring, drop, jewelry',
    'st_ear3': 'earring, jade earring, green stone, jewelry',
    'st_ear4': 'earring, golden earring, gold, jewel',
    # 사가스토리 주문서·유니크
    'st_scroll_atk': 'scroll, rolled paper, red wax seal, red ribbon, magic scroll',
    'st_scroll_def': 'scroll, rolled paper, blue wax seal, blue ribbon, magic scroll',
    'st_scroll_hp': 'scroll, rolled paper, green wax seal, green ribbon, magic scroll',
    'st_u_sword': 'sword, ornate sword, glowing, thunder, silver dragon blade, gold hilt',
    'st_u_hat': 'crown, phoenix crown, golden feathers, ornate, red gems',
    'st_u_top': 'armor, ornate armor, turtle shell pattern, dark teal, gold trim, glowing',
    'st_u_bottom': 'armored skirt, ornate, blue clouds, glowing, gold trim',
    'st_u_shoes': 'boots, galloping horse boots, ornate, glowing, gold wings',
    'st_u_glove': 'gauntlets, tiger fur gauntlets, claws, ornate, glowing',
    'st_u_cape': 'cape, ornate flowing cape, blue and gold, immortal mountain pattern, glowing',
    'st_u_ring': 'ring, nine dragon ring, gold, jewels, glowing',
    'st_u_necklace': 'necklace, glowing pearl pendant, ornate, gold chain, shiny',
    'st_u_earring': 'earring, crescent moon, silver, glowing, ornate',
    # 사가국지 보물
    'rl_itm_ironblade': 'sword, iron sword, plain steel blade, simple',
    'rl_itm_warhorse': 'horse head statue, saddle, bridle, brown horse figurine',
    'rl_itm_armor': 'armor, treasure armor, ornate chest armor, gold trim',
    'rl_itm_scroll': 'closed book, military book, bamboo slips, scroll, string tie',
    'rl_itm_compass': 'compass, brass compass, round, needle, ancient',
    'rl_itm_jade': 'jade pendant, round disc, green stone, carved, tassel',
    'rl_itm_seal': 'seal stamp, imperial seal, square jade stamp, dragon knob, red ink',
    'rl_itm_drum': 'drum, war drum, red drum, wooden frame, drumsticks',
    'rl_itm_timeshard': 'crystal shard, glowing broken clock, blue time crystal, sparks, sci-fi',
    'rl_itm_purifier': 'sci-fi device, purifier machine, glowing green core, metal canister',
    'rl_itm_boneseal': 'bone seal, skull stamp, bone token, dark purple glow, ornate',
    # 사가고 가방 물건
    'go_scroll': 'scroll, recruitment letter, rolled paper, red ribbon, seal',
    'feed': 'pet food, small sack, grain bag, wooden bowl, seeds',
    'shard': 'crystal shard, seal fragment, broken stone tablet, glowing',
    'seal': 'shrine seal, stamp, wooden seal, carved, red ink',
    # 사가고 재료
    'go_apple': 'hawthorn berries, red berries, small fruit, green leaves',
    'clam': 'clam, shellfish, shell, ribbed shell, seafood',
    'go_orchid': 'orchid, blue orchid, flower, elegant petals, stem',
    'conch': 'conch shell, spiral seashell, pink, sea snail shell',
    'ash_flower': 'flower, grey flower, ash petals, ember, wilting bloom',
    'snow_bloom': 'flower, white snowflower, frost, ice petals, bloom',
    'meat': 'meat, raw meat, bone, steak on bone, red meat',
    'mint': 'mint leaves, green herb, sprig, leaves',
    # 사가고 성유물 세트(세트 대표 — 조각은 게임이 5부위 틀로 처리)
    'af_gladiator': 'trophy, gladiator crest, bronze cup, laurel, shield badge',
    'af_crimson': 'crimson flower, red petals, red crystal, ornate feather, gem',
    'af_viridescent': 'green feather, wind charm, green crystal, leaf ornament',
    'af_emblem': 'emblem, golden crest, ornate badge, shield, gold trim',
    'af_depth': 'blue crystal, deep sea pearl, ocean charm, coral, shell',
    # 사가의숲 열매·견과·광물·꽃·약초
    'fo_peach': 'peach, pink fruit, green leaf',
    'fo_persim': 'persimmon, orange fruit, soft fruit, calyx',
    'fo_plum': 'plum, small plum fruit, green and red, plum blossom twig',
    'fo_citron': 'citron, yellow citrus fruit, bumpy skin, leaf',
    'fo_chest': 'chestnut, brown nut, spiky husk, glossy',
    'fo_pine': 'pine nuts, pinecone, seeds, brown cone',
    'fo_sprout': 'spring sprouts, shoots, fresh green buds, wild vegetable',
    'iron': T['iron'],
    'fo_copper': 'copper ingot, orange metal, copper ore, rough',
    'fo_silver': 'silver ingot, bar, shiny metal, polished',
    'fo_azalea': 'azalea, pink flower, blossoms, green leaves',
    'fo_mugung': 'hibiscus, rose of sharon, purple flower, petals, stamen',
    'fo_orchid': 'orchid, white orchid, elegant, long leaves',
    'fo_maple': 'maple leaf, red maple leaf, autumn leaf, branch',
    'fo_sulwha': 'plum blossoms on snowy branch, white flowers, winter',
    'fo_geumnang': 'bleeding heart flower, pink heart shaped flowers, arching stem',
    'fo_jaran': 'purple orchid, bletilla, magenta flowers, stem',
    'fo_hongmae': 'red plum blossoms, branch, deep red flowers',
    'fo_mugwort': 'mugwort, herb, green leaves, bundle, silvery leaves',
    'fo_bellroot': 'bellflower root, balloon flower, white roots, purple flower',
    'fo_reishi': 'reishi mushroom, glossy red fan shaped mushroom, shelf mushroom',
    'fo_ginseng': 'ginseng root, human shaped root, brown, leaves',
    # 곤충
    'fo_cabbage': 'butterfly, small white butterfly, wings spread',
    'fo_ladybug': 'ladybug, red beetle, black spots, insect',
    'fo_swallow': 'swallowtail butterfly, yellow black wings, tail, insect',
    'fo_hopper': 'grasshopper, long legs, green insect',
    'fo_dragon': 'dragonfly, wings spread, slender body, insect',
    'fo_cicada': 'cicada, big eyes, clear wings, insect, brown',
    'fo_longhorn': 'longhorn beetle, long antennae, spotted beetle, insect',
    'fo_mantis': 'praying mantis, green, scythe arms, insect',
    'fo_cricket': 'cricket, brown insect, long antennae, hind legs',
    'fo_firefly': 'firefly, glowing abdomen, yellow glow, beetle, insect, night',
    'fo_rhino': 'rhinoceros beetle, horned beetle, big horn, glossy black, insect',
    'fo_stag': 'stag beetle, big mandibles, brown beetle, insect',
    'fo_snail': 'snail, spiral shell, garden snail, brown shell',
    'fo_spider': 'spider, eight legs, hairy spider, web, arachnid',
    'fo_wasp': 'wasp, yellow and black stripes, wings, stinger, insect',
    # 화석
    'fo_shard': 'pottery shard, broken clay pot piece, ancient ceramic, patterned',
    'fo_oldcoin': 'old coin, ancient bronze coin, square hole, round, green patina',
    'fo_fern': 'fern fossil, stone slab, leaf imprint, grey rock',
    'fo_fishf': 'fish fossil, stone slab, fish skeleton imprint, grey rock',
    'fo_trilo': 'trilobite fossil, segmented shell, stone, grey rock',
    'fo_ammon': 'ammonite fossil, spiral shell, stone, brown',
    'fo_track': 'bird footprint fossil, stone slab, three-toed prints, grey rock',
    'fo_tooth': 'dinosaur tooth fossil, large sharp tooth, ivory, serrated',
    'fo_bone': 'dinosaur bone fossil, big bone, ivory, rough',
    'fo_tusk': 'mammoth tusk, curved ivory tusk, huge, cream',
    # 조개
    'fo_godung': 'whelk shell, small spiral seashell, cone shell, brown',
    'fo_sora': 'turban shell, spiral shell with spikes, seashell, green',
    'fo_daehap': 'clam shell, large bivalve, fan-shaped seashell, cream',
    'fo_urchin': 'sea urchin shell, round spiny shell, purple, empty test',
    'fo_abalone': 'abalone shell, ear-shaped shell, mother of pearl, iridescent',
    # 폐허
    'fo_rooftile': 'roof tile, curved clay tile, old grey tile, ancient',
    'fo_wallstone': 'castle stone block, square cut stone, mossy, grey',
    'fo_rafter': 'wooden beam, old wood log piece, rafter, cracked',
    'fo_bignail': 'large iron nail, old rusty spike, big nail',
    'fo_doorring': 'door ring, iron door handle, round knocker, brass ring',
    'fo_postkey': 'old key, brass key, ornate old key, mailbox key, tag',
    # 물고기
    'fo_crucian': 'crucian carp, fish, silver gold fish, side view',
    'fo_carp': 'carp, big koi fish, orange fish, whiskers, side view',
    'fo_catfish': 'catfish, long whiskers, dark grey fish, side view',
    'fo_sturgeon': 'sturgeon, bony plates, long snout, dark fish, side view',
    'fo_trout': 'trout, spotted fish, silver and pink stripe, side view',
    'fo_smelt': 'smelt, small slender fish, translucent silver, side view',
    'fo_loach': 'loach, eel-like fish, slender, brown mud fish, whiskers',
    # 가구
    'yo': 'bedding, folded futon, quilted mattress, soft blanket, floral pattern',
    'fo_hwabun': 'flower pot, ceramic pot, small plant, green leaves, pottery',
    'fo_deungjan': 'oil lamp, small lamp, ceramic cup lamp, tiny flame, stand',
    'fo_mulhang': 'water jar, big ceramic jar, brown earthenware, wide jar',
    'fo_jokja': 'hanging scroll, painting scroll, rolled ends, ink landscape, wooden rod',
    'fo_seoan': 'writing desk, low desk, wooden desk, brush rest, scroll',
    'fo_hwaro': 'brazier, charcoal stove, brass stove, glowing embers',
    'fo_mungab': 'wooden cabinet, low chest, drawers, metal handles, wood grain',
    'fo_bandaji': 'chest, front-opening chest, wooden trunk, brass fittings, drawers',
    'fo_dokja': 'porcelain vase, ceramic jar, blue and white, celadon, elegant',
    'fo_badukpan': 'game board, go board, wooden board, black and white stones, grid',
    'fo_geomungo': 'zither, long stringed instrument, wooden, six strings, korean zither',
    'fest_seollal': 'good luck sieve, woven bamboo scoop, hanging, red ribbon, rice',
    'fest_daeborum': 'moon house bonfire stove, large brazier, orange flames, straw',
    'fest_samjin': 'flower rice cake table, low table, pink flower cakes, tray',
    'fest_dano': 'iris pot, calamus plant, long green leaves, flower pot, red ribbon',
    'fest_chilseok': 'magpie bridge hanging scroll, bridge of birds, stars, scroll, blue',
    'fest_baekjung': 'paper lantern, lotus lantern, pink, glowing, hanging, string',
    'fest_chuseok': 'rice cake table, crescent rice cakes, tray, pine needles, low table',
    'fest_dongji': 'red bean porridge brazier, stove with pot, steaming, red stew',
    'visit_sailor': 'treasure chest, captain chest, wooden trunk, anchor, rope, brass lock',
    'visit_wisp': 'lantern, spirit lantern, blue flame, glowing ghost light, paper',
    'visit_angler': 'fish print, ink print of fish, framed fish impression, rubbing',
    'visit_bug': 'butterfly specimen frame, pinned butterflies, wooden frame, glass',
    'visit_future': 'desk clock, sci-fi table clock, glowing blue numbers, metal base',
    'visit_dokkaebi': 'spiked club, dokkaebi club, studded wooden club, small table',
    'visit_alien': 'star map frame, constellation chart, glowing dots, framed, dark blue',
    'visit_parcel': 'stack of parcels, cardboard boxes, tied with string, tower of boxes',
    'visit_photo': 'photo screen, folding screen with photographs, forest pictures, wooden frame',
    # 도구
    'fo_deed': 'wooden tablet, land deed plaque, carved shovel mark, rectangular token, cord',
    # 벽지·바닥(견본판)
    'wall_earth': 'wall sample board, brown clay plaster, square sample, rough texture',
    'wall_hanji': 'wall sample board, cream hanji paper, square sample, subtle fibers',
    'wall_sol': 'wall sample board, pine green panel, square sample, pine needle pattern',
    'wall_muk': 'wall sample board, black ink panel, square sample, brush strokes',
    'wall_dan': 'wall sample board, colorful dancheong pattern, red green blue, square sample',
    'floor_wood': 'floor sample board, wooden planks, square sample, polished wood',
    'floor_mat': 'floor sample board, woven straw mat, square sample, braided',
    'floor_jangpan': 'floor sample board, yellow oiled paper flooring, square sample, glossy',
    'floor_stone': 'floor sample board, flat stone slabs, square sample, grey',
    'floor_ondol': 'floor sample board, heated stone floor, square sample, warm slate',
    # 옷
    'wear_leather': 'clothing, plain jacket, brown tunic, everyday clothes, folded',
    'wear_robe': 'robe, long scholar robe, white and blue, wide sleeves, folded',
    'wear_coat': 'coat, long overcoat, teal, sash, folded',
    'wear_plate': 'armor, plate armor, steel breastplate, shoulder guards',
    'wear_spacesuit': 'spacesuit, sci-fi suit, white astronaut suit, delivery logo, folded',
    'wear_topknot': 'topknot, hair bun, black hair tied up, hair ornament',
    'wear_braid': 'hair braid ribbon, long braided hair, red ribbon, hair tie',
    'wear_scholar': 'scholar hat, black cloth hat, square-topped, tied strings',
    'wear_gat': 'gat hat, black horsehair hat, wide brim, high crown, tied cord',
    'wear_hairpin': 'bridal crown, jeweled headpiece, ornate coronet, beads, tassels',
    'wear_helmet': 'war hat, felt hat with plume, red tassel, officer hat',
    # 사가블로·godot·unity 공용 도감 무기 16 (키 = id)
    'gw_sword_0': 'wooden sword, practice sword, plain wood, training',
    'gw_claymore_0': 'wooden greatsword, practice big blade, plain wood, wide plank sword',
    'gw_polearm_0': 'wooden pole, plain long stick, training spear, no blade',
    'gw_catalyst_0': 'notebook, blank book, plain cover, simple paper, string tie',
    'gw_bow_0': 'short bow, simple wooden bow, bowstring, plain',
    'gw_sword_3': 'sword, bronze sword, green patina, straight blade, simple hilt',
    'gw_claymore_3': 'woodcutter axe, large axe, heavy iron head, long wooden handle',
    'gw_polearm_3': 'bamboo spear, green bamboo pole, sharpened tip, tassel',
    'gw_catalyst_3': 'worn book, torn old book, tattered cover, loose pages',
    'gw_bow_3': 'hunting bow, leather wrapped wooden bow, bowstring, arrows',
    'gw_sword_4': 'sword, clear blue blade, jeweled hilt, glowing blue, elegant sword',
    'gw_claymore_4': 'greatsword, wave pattern, huge blade, blue water engravings, heavy',
    'gw_polearm_4': 'glaive, polearm, beacon fire, red flame ornament, crescent blade',
    'gw_catalyst_4': 'constellation scroll, glowing star map, rolled scroll, stars, sparkles',
    'gw_bow_4': 'ornate bow, sea breeze bow, light blue, feathers, wave pattern, bowstring',
    'gw_polearm_catch': 'harpoon, fishing spear, barbed tip, rope, blue ornament',
})

# ── (판, id) → 키 ──────────────────────────────────────────────────────────────────────────────
ALIAS = {
    # 시험 30 키를 그대로 쓰는 물건과, 다른 판에서 같은 물건이라 합치는 것
    ('saga-go', 'scroll'): 'go_scroll', ('saga-go', 'incense'): 'incense', ('saga-go', 'prayer'): 'prayer',
    ('saga-go', 'treat'): 'treat', ('saga-go', 'feed'): 'feed',
    ('saga-go', 'apple'): 'go_apple', ('saga-go', 'orchid'): 'go_orchid',
    ('saga-go', 'mushroom'): 'mushroom', ('saga-go', 'honey_flower'): 'honey_flower',
    ('saga-forest', 'apple'): 'apple', ('saga-forest', 'iron'): 'iron', ('saga-forest', 'stardust'): 'stardust',
    ('saga-forest', 'pearl'): 'pearl', ('saga-forest', 'bangseok'): 'bangseok', ('saga-forest', 'soban'): 'soban',
    ('saga-forest', 'byeongpung'): 'byeongpung', ('saga-forest', 'net'): 'net', ('saga-forest', 'spade'): 'spade',
    ('saga-forest', 'yo'): 'yo',
    ('saga-story', 'atk100'): 'st_scroll_atk', ('saga-story', 'atk60'): 'st_scroll_atk', ('saga-story', 'atk10'): 'st_scroll_atk',
    ('saga-story', 'def100'): 'st_scroll_def', ('saga-story', 'def60'): 'st_scroll_def',
    ('saga-story', 'hp60'): 'st_scroll_hp', ('saga-story', 'hp10'): 'st_scroll_hp',
}
# 사가블로의 사다리 용 접두사: 키 = id(이미 w_·a_·u_ 로 갈린다). 아닌 판은 접두사를 붙인다.
PREFIX = {'saga-story': 'st_', 'saga-realm': 'rl_', 'saga-forest': 'fo_'}
SKIP = {('saga-forest', 'none'), ('saga-forest', 'off'), ('saga-forest', 'on')}
DYE = {'white', 'ink', 'forest', 'indigo', 'crimson', 'gold', 'plum'}   # 숲 염색 일곱 → color 모드(코드 색 견본)
RUNES = {'cheon', 'ji', 'in', 'mu', 'mun', 'chung', 'ui', 'yong', 'ji2', 'sin', 'ryong', 'wang'}   # 사가블로 룬 12 → glyph
SETS = {'chungmu', 'waryong', 'horang', 'cheongnang', 'cheolong', 'eunha', 'maenghon', 'biyeong', 'paewang', 'hyeonhak'}
GO_ART = {'0': 'af_gladiator', '1': 'af_crimson', '2': 'af_viridescent', '3': 'af_emblem', '4': 'af_depth'}
GO_SPECIAL = {'0': 'go_orchid', '1': 'conch', '2': 'ash_flower'}
WEAR_KEY = {'leather': 'wear_leather', 'robe': 'wear_robe', 'coat': 'wear_coat', 'plate': 'wear_plate', 'spacesuit': 'wear_spacesuit',
            'topknot': 'wear_topknot', 'braid': 'wear_braid', 'scholar': 'wear_scholar', 'gat': 'wear_gat', 'hairpin': 'wear_hairpin',
            'helmet': 'wear_helmet'}
WALL = {'earth', 'hanji', 'sol', 'muk', 'dan'}
FLOOR = {'wood', 'mat', 'jangpan', 'stone', 'ondol'}


def grade_of(game, kind, iid, row_name):
    if game == 'saga-dungeon':
        if iid.startswith('u_'):
            return 4
        if iid in SETS:
            return 3
        if kind == 'gem':
            return 2
        return 1 if iid in ('w_hwando', 'w_gakgung') else 0
    if game == 'saga-story':
        if iid.startswith('u_'):
            return 4
        if kind == 'equip':
            return {'1': 0, '2': 1, '3': 2, '4': 3}[iid[-1]]
        return 0
    if game == 'saga-realm':
        return 2 if iid in ('itm_seal', 'itm_boneseal', 'itm_timeshard') else 0
    if game == 'saga-forest':
        return 2 if iid.startswith(('fest_', 'visit_')) else 0
    if game in ('saga_go', 'SagaGo'):
        return 0
    if kind == 'artifact':
        return 3
    return 0


def key_of(game, iid, kind):
    if (game, iid) in ALIAS:
        return ALIAS[(game, iid)]
    if game == 'saga-dungeon':
        if iid in SETS:
            return 'set_' + iid
        return iid
    if game == 'saga-go':
        if kind == 'artifact':
            return GO_ART[iid]
        if kind == 'material' and iid in GO_SPECIAL:
            return GO_SPECIAL[iid]
        return iid
    if game == 'saga-forest':
        if iid in WALL and kind == 'furniture':
            return 'wall_' + iid
        if iid in FLOOR and kind == 'furniture':
            return 'floor_' + iid
        if kind == 'wear':
            return WEAR_KEY.get(iid)
        if kind == 'furniture' and (iid.startswith(('fest_', 'visit_'))):
            return iid
    return PREFIX.get(game, '') + iid


def main():
    entries, keys = [], {}
    problems = []
    # 같은 id 의 서로 다른 항목끼리 부딪히면 안 된다(예: 사가블로 gem 'pearl' ↔ 숲 'pearl' 은 일부러 합침)
    for r in inv['rows']:
        game, kind = r['game'], r['kind']
        items = r['items']
        if game in ('saga_go', 'SagaGo'):   # godot·unity 무기 = 같은 열여섯 — 소스에서 직접 읽는다(인벤토리는 개수만)
            continue
        for it in items:
            iid, name = it['id'], it.get('name', '')
            if game == 'saga-go' and r['name'] == '특산물':
                name = it['name']
            if (game, iid) in SKIP:
                entries.append({'game': game, 'id': iid, 'kind': kind, 'name': name, 'mode': 'skip'})
                continue
            if game == 'saga-dungeon' and iid in RUNES:
                entries.append({'game': game, 'id': iid, 'kind': kind, 'name': name, 'mode': 'glyph', 'key': 'rune_' + iid})
                continue
            if game == 'saga-forest' and kind == 'wear' and iid in DYE:
                entries.append({'game': game, 'id': iid, 'kind': kind, 'name': name, 'mode': 'color', 'key': 'dye_' + iid})
                continue
            k = key_of(game, iid, kind)
            if not k or k not in T:
                problems.append((game, iid, name, k))
                continue
            g = grade_of(game, kind, iid, r['name'])
            entries.append({'game': game, 'id': iid, 'kind': kind, 'name': name, 'mode': 'ai', 'key': k, 'grade': g})
            if k in keys:
                keys[k]['grade'] = max(keys[k]['grade'], g)
            else:
                keys[k] = {'id': k, 'kind': kind, 'grade': g, 'tags': T[k]}
    # godot·unity 무기 열여섯
    for k in [x for x in T if x.startswith('gw_')]:
        rar = int(k.split('_')[-1]) if k.split('_')[-1].isdigit() else 4
        g = {0: 0, 3: 1, 4: 2}.get(rar, 2)
        keys[k] = {'id': k, 'kind': 'equip', 'grade': g, 'tags': T[k]}
        wid = 'w_' + k[3:]
        for game in ('saga_go-godot', 'SagaGo-unity'):
            entries.append({'game': game, 'id': wid, 'kind': 'equip', 'name': '', 'mode': 'ai', 'key': k, 'grade': g})
    if problems:
        print('풀리지 않은 항목 %d:' % len(problems))
        for p in problems:
            print('  ', p)
        return 1
    used = {e['key'] for e in entries if e['mode'] == 'ai'}
    unused = sorted(set(T) - used)
    if unused:
        print('쓰이지 않는 태그 키:', unused)
    ai = [keys[k] for k in sorted(keys)]
    out = {'note': 'tools/ai-art/build_icon_plan.py 가 만든 표 — 손으로 고치지 않는다(태그는 그 스크립트의 T)',
           'counts': {'entries': len(entries), 'ai_keys': len(ai), 'glyph': sum(e['mode'] == 'glyph' for e in entries),
                      'color': sum(e['mode'] == 'color' for e in entries), 'skip': sum(e['mode'] == 'skip' for e in entries)},
           'items': ai, 'entries': entries}
    p = os.path.join(HERE, 'data', 'icon_plan.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(out['counts'], '→', p)
    return 0


if __name__ == '__main__':
    sys.exit(main())
