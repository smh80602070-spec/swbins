"""K-0090 ⑤ — 사가나락 확장 인물 30(ft_·md_, data-hero-ext.js)의 초상을 글→그림(애니풍) 대신 3D 몸 반신 렌더 img2img 로.

  py tools/ai-art/make_dungeon30_i2i.py   → batches/k90_dungeon30_i2i.json (30)
  py tools/ai-art/gen.py tools/ai-art/batches/k90_dungeon30_i2i.json
  py tools/ai-art/pack_web_portraits.py --src k90_dungeon30_i2i --games saga-dungeon

도감 299(105 + 국지 194)는 몸 렌더 밑그림 img2img(denoise 0.55)라 반실사 툰, 이 30명만 web_dungeon_30(t2i)이라 큰 눈 애니풍 —
사가나락 출사표에서 두 그림체가 섞였다(소넷 회귀 감사 시트 「0-enter」). 프롬프트는 web_dungeon_30 그대로(인물 성별·머리·옷이 정본),
밑그림은 게임이 그 인물에게 입히는 빌린 몸(shared/js/assets3d.js borrowRecipe — 'hero:<id>' 씨앗 해시, BORROW 표)의 반신 렌더.
빌린 몸 성별이 인물과 반대면(30 중 12) 같은 성별 렌더 중 씨앗 해시로 고른다 — 반대 성별 몸에 얹으면 얼굴·어깨가 깨진다.
"""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BUSTS = os.path.join(HERE, '_out', 'busts_realm')
# 10-09 node 로 borrowRecipe 를 사가나락 설정(data.js·data-hero-ext.js·assets3d-ids.js·core.js)으로 돌린 결과
BORROW = {
    'ft_airesearch': 'nz_soman', 'ft_astronaut': 'ru_geohae', 'ft_bioeng': 'kr2_seolharan', 'ft_climateeng': 'tb_saryeong', 'ft_cyberdoc': 'tb_japgol',
    'ft_dronecmd': 'nh_migyeon', 'ft_ewarfare': 'nh_jinju', 'ft_fusioneng': 'xiyu_gyoha', 'ft_hacker': 'jp_shioji', 'ft_hologramartist': 'jiao_luyan',
    'ft_marspioneer': 'rf_yanghong', 'ft_nanotech': 'sl_wangjeong', 'ft_orbitmech': 'rf_guojia', 'ft_quantumphy': 'rf_lidian', 'ft_roboteng': 'rf_zhangren',
    'md_architect': 'mb_hoja', 'md_athlete': 'rf_lidian', 'md_ceo': 'jiao_banrok', 'md_chef': 'rf_guojia', 'md_developer': 'ru_sanaek',
    'md_doctor': 'ru_doksi', 'md_entrepreneur': 'rf_huanggai', 'md_explorer': 'nz_ahyang', 'md_firefighter': 'ly_sanga', 'md_journalist': 'ru_sayeong',
    'md_lawyer': 'nz_soman', 'md_musician': 'rf_huanggai', 'md_photographer': 'xiyu_gyoha', 'md_pilot': 'xb_hoja', 'md_scientist': 'kr2_sogaram',
}


def gender(prompt):
    return 'F' if prompt.lstrip().startswith('1girl') else 'M'


def main():
    src = json.load(open(os.path.join(HERE, 'batches', 'web_dungeon_30.json'), encoding='utf-8'))
    realm = json.load(open(os.path.join(HERE, 'batches', 'web_realm_194_i2i.json'), encoding='utf-8'))
    body_g = {i['id']: gender(i['prompt']) for i in realm['items'] if os.path.exists(os.path.join(BUSTS, 'hero_%s.png' % i['id']))}
    by_g = {g: sorted(b for b, x in body_g.items() if x == g) for g in 'MF'}
    items, swapped = [], []
    for it in src['items']:
        hid = it['id']
        g = gender(it['prompt'])
        body = BORROW[hid]
        if body_g.get(body) != g:
            pool = by_g[g]
            body = pool[int(hashlib.md5(('k90:' + hid).encode()).hexdigest()[:8], 16) % len(pool)]
            swapped.append(hid)
        items.append(dict(it, init_image=os.path.join(BUSTS, 'hero_%s.png' % body), body=body))
    out = {'model': src['model'], 'out': 'k90_dungeon30_i2i',
           'note': 'K-0090 ⑤ — web_dungeon_30 프롬프트 + 빌린 몸 반신 렌더 밑그림(성별 반대 %d명은 같은 성별 렌더로) img2img 0.55 — 도감 299 와 같은 그림체' % len(swapped),
           'defaults': dict(src['defaults'], denoise=0.55), 'items': items}
    p = os.path.join(HERE, 'batches', 'k90_dungeon30_i2i.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(p, len(items), '성별 맞춰 바꾼 밑그림', len(swapped), swapped)


if __name__ == '__main__':
    main()
