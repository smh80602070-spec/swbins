# -*- coding: utf-8 -*-
"""K-0036 단계 3·4 — swbins3 에서 합성한 대사(out/saga-voice/<목소리>/<줄>.ogg)를 정본 saga-assets/voice 로 들인다.

  py tools/asset-forge/voicepack.py [--write]     (기본은 셈만)
  → saga-assets/voice/voice_<목소리>_<줄 id>.ogg + .license.json · voice_list.json(줄 글·목소리 설명·인물 → 목소리 배정)

받아쓰기 점검(report.json)에서 ok 인 줄만 들인다(오류 > 30% 로 남은 줄은 빼고 셈에 적음). 검증: 음량 편차 ≤ 3dB · 합계 ≤ 40MB.
배치는 asset-place `voice`(웹 shared/audio/voice · 고돗 assets/audio/voice · 유니티 Resources/Audio/Voice).
"""
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PLAN = os.path.join(ROOT, 'tools', 'asset-forge', 'data', 'voice_plan.json')
SRC = os.environ.get('SAGA_VOICE_SRC', r'C:\swbins3\voice-gen\out\saga-voice')
DST = os.path.join(ROOT, 'saga-assets', 'voice')
LIMIT_MB = 40


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    write = '--write' in sys.argv
    plan = json.load(open(PLAN, encoding='utf-8'))
    rep = json.load(open(os.path.join(SRC, 'report.json'), encoding='utf-8'))
    text = {ln['id']: ln for ln in plan['lines']}
    ok, bad, dbs, size = [], [], [], 0
    for key, r in sorted(rep['lines'].items()):
        v, lid = key.split('/')
        src = os.path.join(SRC, v, lid + '.ogg')
        if not r.get('ok') or not os.path.exists(src):
            bad.append(key)
            continue
        ok.append((v, lid, src, r))
        dbs.append(r['db'])
        size += os.path.getsize(src)
    spread = (max(dbs) - min(dbs)) if dbs else 0
    print(f'VOICEPACK 들일 줄 {len(ok)} · 뺀 줄 {len(bad)} · 음량 편차 {spread:.1f}dB · {size / 1e6:.1f}MB'
          + (f' · 뺀 것 {", ".join(bad[:10])}' if bad else ''))
    if spread > 3 or size > LIMIT_MB * 1e6:
        print('VOICEPACK_FAIL 음량 편차 > 3dB 또는 용량 한도')
        return 1
    if not write:
        return 0
    os.makedirs(DST, exist_ok=True)
    for v, lid, src, r in ok:
        name = f'voice_{v}_{lid}'
        shutil.copyfile(src, os.path.join(DST, name + '.ogg'))
        lic = {'id': name, 'generator': 'C:/swbins3/voice-gen/saga_voice_batch.py (Qwen3-TTS VoiceDesign 견본 → Base 복제) + tools/asset-forge/voiceplan.py',
               'model': f'{plan["model"]["design"]} · {plan["model"]["clone"]}', 'license': plan['model']['license'] + ' (모델·코드) — 목소리는 글 설명으로 만든 것, 실존 인물·배우 목소리 모사 없음',
               'voice': v, 'voice_desc': plan['voices'][v]['desc'], 'text': text[lid]['text'], 'kind': text[lid]['kind'],
               'asr_cer': r['cer'], 'duration_s': r['sec'], 'rms_db': r['db']}
        json.dump(lic, open(os.path.join(DST, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    have = {f'{v}/{lid}' for v, lid, _, _ in ok}
    index = {'note': 'K-0036 — 짧은 대사 음성. 파일 = voice_<목소리>_<줄 id>.ogg. 인물은 assign 의 목소리 줄을 쓰고, system 은 NA(해설) 한 벌. 생성: tools/asset-forge/voicepack.py',
             'voices': plan['voices'], 'lines': plan['lines'], 'assign': {k: v['voice'] for k, v in plan['assign'].items()},
             'missing': sorted(bad)}
    json.dump(index, open(os.path.join(DST, 'voice_list.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('VOICEPACK_OK 정본', len(have), '줄 →', os.path.relpath(DST, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
