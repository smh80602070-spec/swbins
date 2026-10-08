# -*- coding: utf-8 -*-
"""K-0036 단계 2 — 음성 대사 계획: 목소리 견본 10(남 5·여 5) · 짧은 대사 목록 · 인물 299 → 목소리 배정표.

  py tools/asset-forge/voiceplan.py          → tools/asset-forge/data/voice_plan.json (같은 입력이면 같은 결과)

- 대사는 목소리마다 한 벌(외침·획득·인사) — 인물은 배정된 목소리의 줄을 같이 쓴다. 시스템 안내는 해설 목소리(narrator) 한 벌만.
  그래서 파일 수 = 10 × (외침+획득+인사) + 안내 (인물 299 × 줄이 아님 — 용량 한도 40MB).
- 목소리 = Qwen3-TTS VoiceDesign 설명(영어, 모델이 그렇게 받는다) → 견본 한 줄을 뽑아 받아쓰기 오류 ≤ 10% 인 것을 고정 → Base 복제로 전 줄(swbins3 voice-gen).
- 배정: 성별(`tools/char-forge/data/outfit_swap_plan.json`, 도감 105 는 hero_traits 실제 성별) + 차림(갑옷·관복·왕실·궁중·평복 …, hero_traits)으로
  어울리는 목소리 둘 중 하나를 id 해시로 — 같은 인물은 늘 같은 목소리.
- 대사 글: 실존 인물·원작 대사·이름 없음(이름 정책), 과거·현대·미래가 섞인 판이라 시대색이 짙은 말투는 피한다.
"""
import hashlib
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'asset-forge', 'data', 'voice_plan.json')

VOICES = {   # id: (성별, 설명 — Qwen3 VoiceDesign instruct, 견본 문장)
    'M1': ('M', 'A firm adult Korean man in his thirties, strong chest voice, confident and commanding, warrior tone.', '앞으로! 내가 길을 연다!'),
    'M2': ('M', 'A calm Korean man in his forties, low soft voice, measured and thoughtful, scholar tone.', '서두르지 말게. 길은 하나가 아니니.'),
    'M3': ('M', 'An elderly Korean man, deep warm slightly husky voice, slow and dignified, wise elder tone.', '허허, 오랜만에 반가운 얼굴이로구나.'),
    'M4': ('M', 'A cheerful young Korean man in his early twenties, bright energetic voice, quick and friendly.', '좋아, 이번엔 내 차례지!'),
    'M5': ('M', 'A rough Korean man, gravelly low voice, blunt and gruff, tough mercenary tone.', '흥, 덤빌 테면 덤벼 봐.'),
    'F1': ('F', 'A bright young Korean woman, clear and lively voice, slightly fast, friendly and warm.', '어서 와요! 기다리고 있었어요.'),
    'F2': ('F', 'A calm adult Korean woman, soft elegant voice, graceful and composed, noble tone.', '예를 갖추어 맞이하겠습니다.'),
    'F3': ('F', 'A strong Korean woman in her thirties, clear firm voice, brave and determined, warrior tone.', '물러서지 마! 여기서 막는다!'),
    'F4': ('F', 'A gentle elderly Korean woman, warm kind voice, slow and caring, grandmother tone.', '아이고, 먼 길 오느라 고생했구나.'),
    'F5': ('F', 'A playful young Korean woman, light teasing voice, quick and witty, mischievous tone.', '어머, 벌써 지친 거야?'),
    'NA': ('-', 'A neutral clear Korean announcer voice, calm and even, friendly system guide tone.', '저장이 완료되었습니다.'),
}
ATTIRE = {   # 차림 → 어울리는 목소리 후보(성별별)
    'armor': (['M1', 'M5'], ['F3', 'F1']), 'naval': (['M1', 'M3'], ['F3', 'F2']), 'robe': (['M2', 'M3'], ['F2', 'F4']),
    'monk': (['M3', 'M2'], ['F4', 'F2']), 'royal': (['M2', 'M1'], ['F2', 'F3']), 'court': (['M2', 'M4'], ['F2', 'F5']),
    'tribal': (['M5', 'M1'], ['F3', 'F5']), 'plain': (['M4', 'M2'], ['F1', 'F5']),
}
LINES = {    # 종류 → 문장(목소리마다 한 벌, 안내는 NA 한 벌)
    'shout': ['간다!', '받아라!', '이걸로 끝이다!', '물러서!', '조심해!', '지금이야!', '막아라!', '한 번 더!', '놓치지 마!', '뒤를 맡겨!',
              '좋아, 잡았다!', '어림없다!', '비켜라!', '모두 힘을 모아!', '여기서 끝내자!', '크윽…!', '아직이다!', '도와줘!', '후퇴한다!', '이겼다!'],
    'pickup': ['좋은 걸 찾았네.', '이건 쓸 만하겠어.', '챙겨 두자.', '오, 반짝이는데?', '운이 좋군.', '이거 귀한 거야.', '주머니가 무거워졌어.', '하나 더!',
               '이 정도면 넉넉해.', '나중에 쓰자.', '꽤 값나가겠는걸.', '새 장비다!', '이건 처음 보는데.', '손에 잘 맞아.', '고마워, 잘 쓸게.',
               '보물이다!', '이걸 찾고 있었어.', '가방이 꽉 찼네.', '버리긴 아깝다.', '좋아, 모았다.'],
    'greet': ['안녕하세요.', '어서 오세요.', '또 만났네요.', '무슨 일이에요?', '좋은 아침이에요.', '오늘도 수고 많아요.', '잘 지냈어요?', '반가워요.',
              '조심히 다녀와요.', '필요한 게 있으면 말해요.', '다음에 또 봐요.', '오늘 날씨 좋네요.', '바쁘신가 봐요.', '잠깐 쉬었다 가요.', '고마워요.',
              '무사히 돌아왔군요.', '소문 들었어요.', '부탁 하나 해도 될까요?', '좋은 하루 보내요.', '늘 응원할게요.'],
    'system': ['저장이 완료되었습니다.', '새 지역을 발견했습니다.', '배낭이 가득 찼습니다.', '일일 의뢰가 갱신되었습니다.', '연결이 끊어졌습니다. 다시 시도해 주세요.',
               '레벨이 올랐습니다.', '새 동료가 합류했습니다.', '의뢰를 완료했습니다.', '새 장비를 얻었습니다.', '체력이 부족합니다.',
               '보스가 나타났습니다.', '전투에서 승리했습니다.', '전투에서 패배했습니다.', '불러오기가 완료되었습니다.', '설정이 바뀌었습니다.',
               '새 기술을 배웠습니다.', '시간이 얼마 남지 않았습니다.', '문이 열렸습니다.', '보상을 받았습니다.', '오늘의 접속 보상이 도착했습니다.'],
}


def h(s):
    return int(hashlib.md5(s.encode('utf-8')).hexdigest()[:8], 16)


def main():
    plan = json.load(open(os.path.join(ROOT, 'tools', 'char-forge', 'data', 'outfit_swap_plan.json'), encoding='utf-8'))['entries']
    traits = json.load(open(os.path.join(ROOT, 'tools', 'char-forge', 'data', 'hero_traits.json'), encoding='utf-8'))['heroes']
    assign, count = {}, {}
    for e in plan:
        g = traits.get(e['id'], {}).get('gender') or e.get('gender') or 'M'
        att = traits.get(e['id'], {}).get('attire', 'plain')
        cands = ATTIRE.get(att, ATTIRE['plain'])[0 if g == 'M' else 1] if e['id'] in traits else [k for k, v in VOICES.items() if v[0] == g]   # 차림 모르는 인물(사가천하 194)은 그 성별 다섯에 고르게
        v = cands[h(e['id']) % len(cands)]
        assign[e['id']] = {'voice': v, 'gender': g, 'attire': att}
        count[v] = count.get(v, 0) + 1
    lines = [{'id': f'{k}_{i + 1:02d}', 'kind': k, 'text': t} for k, ts in LINES.items() for i, t in enumerate(ts)]
    files = sum(len(ts) for k, ts in LINES.items() if k != 'system') * (len(VOICES) - 1) + len(LINES['system'])
    out = {'note': 'K-0036 단계 2 — 생성: py tools/asset-forge/voiceplan.py (손으로 고치지 않는다). 파일 = 목소리 10 × (외침·획득·인사) + 해설 안내. 합성은 swbins3 voice-gen(Qwen3 VoiceDesign 견본 → Base 복제).',
           'model': {'design': 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', 'clone': 'Qwen/Qwen3-TTS-12Hz-1.7B-Base', 'license': 'Apache-2.0'},
           'voices': {k: {'gender': g, 'desc': d, 'sample': s} for k, (g, d, s) in VOICES.items()},
           'lines': lines, 'files': files, 'voice_count': dict(sorted(count.items())), 'assign': assign}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('VOICEPLAN', len(assign), '인물 ·', len(lines), '문장 · 파일', files, '·', dict(sorted(count.items())))


if __name__ == '__main__':
    main()
