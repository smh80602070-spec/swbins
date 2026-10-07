# VERTICAL_SLICE_DUNGEON

PLAN.md 51~65장 확장 순서의 두 번째 게임(GO 다음 DUNGEON) 착수 —
`docs/VERTICAL_SLICE.md`(GO)가 웹판 `saga-go`를 그대로 옮긴 것과 같은
원칙으로, 이 문서는 웹판 `saga-dungeon`(사가나락, `C:\swbins\saga-dungeon`)
의 실제 수치를 옮긴다. **다만 GO와 달리 saga-dungeon 웹판은 이미 아주
깊다** — 오픈월드 필드·바이옴 5종·POI·엘리트/보스·세공·행상·도감까지
여러 세션에 걸쳐 쌓인 큰 시스템이다(`saga-dungeon/PLAN.md` 참고, 이
문서를 쓴 시점 기준 3400줄 이상). **이번 슬라이스는 그 전체를 옮기지
않는다** — GO의 첫 버티컬 슬라이스가 "도적의 습격 하나"였던 것과 같은
크기로, saga-dungeon의 핵심 루프(방 하나 → 몬스터 → 실시간 전투 →
장비 보상)만 가장 작은 단위로 재현한다. 나머지(오픈월드·바이옴·
엘리트/보스·부대 시스템·세공·행상)는 전부 다음 슬라이스로 미룬다.

## 왜 GO와 다르게 설계하는가

GO의 VERTICAL_SLICE.md는 "게임 디자인은 엔진과 무관, 새 결정을 안
한다"고 적었는데, 그건 saga-godot이 이미 같은 웹판 GO를 옮겨 검증해
뒀기 때문이다. DUNGEON은 **saga-godot도 아직 손 안 댄 첫 시도**라
(saga-godot `docs/PROJECT_STATE.md`도 "DUNGEON은 GO 다음"이라고만
적어 두고 실제로 시작 전) 이 문서가 새로 범위를 정해야 한다. 그래도
**핵심 수치(몬스터 체력·피해량·공격 간격)는 웹판 `dungeon.js`의 실제
공식에서 그대로 가져온다** — 임의로 새 수치를 만들지 않는다는 원칙은
지킨다.

## 정체성 차이 (PLAN.md 5장)

GO는 "사람을 모은다"(등용), DUNGEON은 "더 좋은 장비를 얻는다"(파밍) —
그래서 GO의 첫 슬라이스는 골드·장비 드랍을 일부러 뺐지만, DUNGEON의
첫 슬라이스는 **처음부터 장비 드랍을 넣는다**(정체성의 핵심이라 뒤로
미루면 슬라이스가 이 게임다움을 안 보여준다).

## 범위 확정

포함:

```text
플레이어 이동(3인칭 근접, 모바일 가상 조이스틱) — GO와 같은
  CharacterController 기반이지만 카메라를 더 내려다보는 각도로(디아블로
  감각, saga-dungeon PLAN.md 16장·28-5절 참고)
카메라(추적 + 줌 + 회전, GO의 CameraRig.cs 그대로 재사용 — 기본 피치·
  줌만 다르게 튜닝)
던전 방 하나(사각형 한 칸, primitive — GLB는 다음 슬라이스)
몬스터 1종(황건적 — data-enemy.js tier1, 1층 기준 실제 수치)
실시간 근접 전투(플레이어가 다가가 공격 버튼, 몬스터도 반격) — GO의
  DuelRules.cs 같은 턴제 UI 화면이 아니라 **실제 이동+거리 판정**
  (saga-dungeon 웹판 정체성 자체가 실시간 액션이라 GO의 방식을 그대로
  베끼지 않는다)
몬스터를 처치하면 경험치·돈·무기 하나를 얻는다(자동 장착 — GO
  Inventory.cs와 같은 결)
저장/로드(로컬 파일 하나, GO와 별개 파일 — 다섯 판 세이브가 다 다른
  것과 같은 원칙)
```

제외(다음 슬라이스로 미룸): 오픈월드/필드, 바이옴 5종, 방 종류(보물·
우물·성소·정예방·상인방 등 saga-dungeon 웹판 10종), 몬스터 무리(웹판은
방 하나에 4~12마리), 엘리트/보스, 부대(다중 영웅) 시스템, 세공·행상·
도감, 회피(구르기), 스킬(속공 외 스킬 없음 — 기본 공격 하나만).

## 몬스터 수치 (saga-dungeon `js/dungeon.js` 그대로)

```js
// js/dungeon.js:149-153, MODES[0]='normal'(hp:1, dmg:1)
enemyHp(floor, boss)  = round(24 * 1.26^(floor-1) * (boss?7:1) * mode.hp)
enemyDmg(floor, boss) = round(5  * 1.20^(floor-1) * (boss?2.2:1) * mode.dmg)
```

1층·잡졸 기준(이번 슬라이스가 쓰는 값): **HP=24, 공격력=5**.
`js/data-enemy.js`의 tier1 목록 중 `황건적`(원작 삼국지 반란군 명칭 —
루트 CLAUDE.md 이름 정책은 실존 **인물**·장수·펫에 대한 것이라 이런
역사적 **집단명**은 해당하지 않는다, saga-dungeon 웹판이 이미 이 이름을
그대로 쓰고 있어 선례도 있음)을 그대로 쓴다.

## 플레이어 수치 (saga-dungeon 웹판 부대 시스템은 이번엔 안 옮김)

`js/hero.js`의 `partyPower()`(여러 영웅의 might/wisdom/command를 합산)
는 다중 영웅 부대 시스템 전체를 요구해 이번 슬라이스 범위 밖이다 —
**단일 캐릭터로 값만 그 자릿수에 맞춰 새로 잡는다**(`hpMaxOf()`의
`Math.max(30, round(def*3))` 하한값 30, `atkOf()`의 `max(4, atk/6)`
한 타 공식은 그대로 가져온다):

```
HP=30, 공격력(한 타)=5(=atk 30 기준 atk/6), 공격 간격=0.55초(BASE_ATK_CD)
```

24 HP 잡졸을 5타(≈2.75초)에 잡고, 잡졸의 5짜리 반격을 6대 맞으면
죽는다 — 첫 교전이 손에 잡히게 짧고 긴장되는 길이가 되도록 이 값을
그대로 썼다(실제로 그런지는 사람이 플레이해서 확인, GO도 같은 방식으로
확인함).

## 방 크기 (saga-dungeon `ROOM_W=560, ROOM_H=360`, 논리 픽셀)

플레이어 반지름 13px 기준 비율(가로 43배)을 Unity 미터 단위로 옮긴다
— CharacterController 반지름을 GO와 같은 0.4m로 두면 20m×14m 정도가
같은 비율이다. 벽 두께는 primitive Cube로, 문(다음 던전 층 연결)은
이번 슬라이스엔 없다 — 방 하나가 곧 슬라이스 전체다.

## 완료 조건 (GO의 12단계와 같은 형식, DUNGEON 정체성에 맞게 8단계로)

```
게임 실행 → 던전 방 하나에 들어간다 → 걸어서 돌아다닌다
→ 몬스터(황건적)를 만난다 → 다가가 공격한다(몬스터도 반격한다)
→ 몬스터를 처치한다 → 경험치·돈·무기를 얻는다(공격력이 올랐다는 걸
  화면에서 확인한다) → 저장한다 → 다시 켜서 이어진다
```

이 여덟 단계가 실제로 손에 잡히게 재미있는지가 PLAN.md 37장의 평가
기준과 같은 역할을 한다(GO와 같은 사람이 직접 플레이해 확인).

## Unity 구현 — 폴더·재사용

`Assets/Games/SagaDungeon/`(신규, `SagaDungeon.asmdef` — SagaGo와
같은 결로 `SagaCore`·`Unity.InputSystem` 참조, `Saga.Dungeon` 루트
네임스페이스). **SagaGo 코드를 참조하지 않는다** — 루트 CLAUDE.md
"다섯 판은 다섯 벌 복사해 나눠 든다" 원칙을 이 Unity 트랙에도 그대로
적용한다(SagaCore가 아직 비어 있어 공유할 기반도 없다, PLAN.md 3장
"Vertical Slice First"·"테스트되지 않은 추상화 금지"와도 맞음).
엔진 무관 로직(이동·카메라 조작 감각)은 그대로 베껴 오되(다시 설계
안 함), 게임 고유 로직(전투·보상·저장)은 새로 짠다.

| 재사용(그대로 복사, 네임스페이스만 변경) | 새로 짜는 것 |
|---|---|
| `Player/PlayerController.cs` | `Player/PlayerCombat.cs`(공격 입력·피격) |
| `Player/CameraRig.cs`(피치·줌만 튜닝) | `World/DungeonRoomBuilder.cs` |
| `UI/VirtualJoystick.cs` | `World/DungeonEnemy.cs`(실시간 AI) |
| `UI/DialogueLabel.cs` | `Data/HeroState.cs`·`ItemData.cs`·`SaveState.cs` |
| | `UI/PlayerHud.cs` |

씬은 `Assets/Scenes/TestDungeon.unity`(`Editor/BuildTestDungeonScene.cs`
로 조립·저장 — `BuildTestVillageScene.cs`와 같은 결). 헤드리스 검증은
`Editor/PlaytestDungeonHeadless.cs`(`PlaytestHeadless.cs`와 같은 결,
씬 경로만 다름).

## 다음 슬라이스 후보 (이번엔 안 함)

오픈월드 필드·바이옴 5종·방 종류 10종·몬스터 무리·엘리트/보스·부대
(다중 영웅) 시스템·세공·행상·도감·회피(구르기)·스킬 다양화 — 순서는
saga-dungeon 웹판 PLAN.md 챕터 순서(14~34장)를 참고해 다음 세션이
정할 것.
