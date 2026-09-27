# char-forge 렌더 비교 (눈으로 보기)

공방 몸을 **지금 게임 몸(Mixamo)과 같은 빛·같은 키 1.70m** 로 나란히 찍는다. 2026-09-26 처음 눈으로 봤을 때
수치 검사(CMP_RESULT OK·verify·measure)가 못 잡은 옷 품질 문제가 그대로 드러났다(char-forge README §8-1).

**루트 CLAUDE.md 규칙: 작업 중 스크린샷은 사용자가 요청할 때만.** 사용자가 "직접 확인해봐"처럼 부탁했거나,
그 부탁으로 시작한 옷·몸 작업을 이어 갈 때 쓴다. 그림은 스크래치패드에 두고 저장소에 넣지 않는다.

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
A=saga-unity/Assets/Art/CharactersRealistic
# 짝 = <Mixamo 폴더 또는 -> <공방 .glb>  (Mixamo 폴더는 <이름>/<이름>.fbx + <이름>@Idle*.fbx, Maria 처럼 폴더 밖이면 .fbx 경로)
"$B" -b --factory-startup -P tools/char-forge/render/render_pairs.py -- out.png full $A/Paladin tools/char-forge/_out/_cmp_real_paladin_01.glb - my.glb
# 머리만 가까이(얼굴·모자) — 모델 여럿
"$B" -b --factory-startup -P tools/char-forge/render/render_heads.py -- heads.png a.glb b.glb "$A/Maria WProp J J Ong.fbx"
# 한 몸 앞·비스듬·옆·뒤 네 방향(등 매듭·소데·모자 날개처럼 앞에서 안 보이는 것) — 모델 하나가 한 줄
"$B" -b --factory-startup -P tools/char-forge/render/render_turn.py -- turn.png a.glb b.glb c.glb
```

- `render_common.py` — 가져오기(glTF 뼈 모양 Icosphere 지움)·대기 동작 한 프레임·빛·Eevee·`fix_materials`
- **함정**: Blender glTF 가져오기는 피부를 BLEND 로 둬서 이·눈이 얼굴 위에 그려진다 → `fix_materials` 가 피부·옷 알파를 끊고
  머리카락·눈썹·속눈썹·눈만 알파를 남긴다(게임 셰이더처럼). 눈까지 끊으면 흰 눈알이 된다.
- 동작: 기본은 대기 한 프레임, `CF_CLIP=run`(동작 이름 일부) 이면 그 동작 — 옷 뚫림은 달리기에서 잘 드러난다.
- 렌더는 한 장에 20초 안팎. Unity 를 안 건드려서 다른 세션이 Unity 를 써도 된다.
