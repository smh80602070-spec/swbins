"""지역 배치표(layout.json)의 sky 칸에 하늘 파노라마 그림 이름을 이어 붙인다 — export_region 이 layout 을 새로 쓸 때마다 다시 돌린다.
  py tools/world-forge/link_sky.py        (saga-assets/regions/<지역>/sky_<지역>.jpg 가 있는 지역만)
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIND = {'village': 'day_clouds'}
for r in ('galaxy_ferry', 'frost_peak', 'time_rift', 'crossroads', 'village'):
    d = os.path.join(ROOT, 'saga-assets', 'regions', r)
    if not os.path.exists(os.path.join(d, f'sky_{r}.jpg')):
        continue
    p = os.path.join(d, 'layout.json')
    lay = json.load(open(p, encoding='utf-8'))
    sky = lay.get('sky') or {'kind': KIND.get(r, '?')}
    sky['panorama'] = {'full': f'sky_{r}.jpg', 'mobile': f'sky_{r}_2k.jpg', 'projection': 'equirectangular', 'forward': '+y'}
    lay['sky'] = sky
    json.dump(lay, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('sky linked', r)
