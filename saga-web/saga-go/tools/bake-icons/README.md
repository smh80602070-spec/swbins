# bake-icons — 짐승·건물 2D 지도 아이콘 오프라인 굽기

`sprite.js`가 캔버스로 절차적으로 그리던 지도 위 짐승(펫)·건물(성채·역참)
마커를, 이미 저장소에 있는 CC0 GLB(`assets/models/animals/*`,
`assets/models/buildings/*` — `asset3d.js`의 `DEFAULTS` 표와 같은 파일)에서
실제로 한 번 스냅샷을 구워 PNG로 바꾸는 일회성 배치 툴이다.

**게임이 이 폴더를 로드하지 않는다.** 결과물(`assets/sprites2d/beast_*.png`·
`building_*.png`)만 `sprite.js`가 쓴다. `bake.html`은 다시 돌릴 때만 연다.

## 돌리는 법

1. saga-go 루트에서 정적 서버를 띄운다(`python -m http.server 8791`, 혹은
   `run.bat`). `file://` 단독으로 열면 GLB fetch가 막힌다.
2. 브라우저(또는 헤드리스 크롬)로 `http://.../tools/bake-icons/bake.html`을
   연다. 진행 로그가 화면에 쌓이고, 다 구우면 `<title>`이
   `BAKE_DONE n/33`으로 바뀐다.
3. 결과는 `<pre id="manifest">`에 JSON(각 항목 `{key, group, ok, dataURL}`)
   으로 그대로 있다 — 개발 세션에서는 `--dump-dom`으로 이 DOM을 통째로
   받아 그 안의 JSON을 파싱해 `assets/sprites2d/<group>_<key>.png`로 흩는다
   (그 세션이 그렇게 했다 — 별도 스크립트를 안 남겨 뒀으니 필요하면
   `bake-dump.html`을 받아 `<pre id="manifest">`를 잘라 `JSON.parse` 후
   각 `dataURL`의 base64 부분을 파일로 저장하면 된다).

## 알려진 흠 (2026-09-11, 같은 날 이어서 넷은 해소)

첫 배치 굽기(헤드리스 크롬 `--use-angle=swiftshader`)에서는 아래 **다섯
개**가 로더 콜백이 영영 안 와 구워지지 않았다(fetch는 100% 받아지는데
파싱 단계에서 멎는다):

- `Orc.gltf`·`Demon.gltf`·`BlueDemon.gltf` (ogre 형태 펫 셋 — 도깨비·
  어둑귀·고깔도사·별손님)
- `tower_round.glb`(성채 3등급/웅진), `tower_ruin.glb`(역참)

**같은 날 이어서 재조사한 결과 — GPU(소프트웨어 렌더 vs `--use-angle=d3d11`
실제 GPU 플래그)는 원인이 아니었다.** 실제 GPU 플래그를 줘도 그대로
막혔고, `tower_ruin`의 `image/webp` 텍스처를 의심해 PNG로 바꿔 먹여봐도
그대로 막혔다 — JSON 구조(정점 NaN·순환 노드·인덱스 범위)도 다 정상이었다.
**대신 이 막힘 자체가 간헐적이라는 걸 확인했다** — 같은 파일을 완전히
새로운(격리된) 헤드리스 크롬 프로세스로 다시 열면 되기도, 안 되기도 했다
(Orc는 실패했다가 성공, Demon은 성공했다가 실패, 순서가 매번 달랐다).
원인은 이 환경(헤드리스+소프트웨어 또는 D3D11 렌더 조합)에서의 텍스처
디코드 관련 리소스 경합으로 추정되나 **끝내 확증은 못 했다**.

**대응 — `bake.html`의 잡마다 제한 시간을 8초→30초로 늘리고 실패하면
한 번 더 재시도하게 했다(재시도해도 안 되면 그 잡만 넘어간다, 새
`_bake_one.html` 하나짜리 잡 전용 페이지로 완전히 새 프로세스에서
격리해 재시도하는 방법도 씀).** 이렇게 **넷(Orc·Demon·BlueDemon·
tower_round)은 결국 구웠다** — `js/sprite.js`의 `BEAST_FORM_FILES.ogre`,
`js/world.js`의 `drawFort`(tier 3)에 이미 배선했다.

**`tower_ruin.glb`(역참)만 여섯 번 넘게 재시도해도 매번 막혔다** — 아직
안 풀렸다. `js/world.js`의 `drawStation`은 그대로 절차적 그림이다. 다음에
다시 시도하려면 `_bake_one.html?key=tower_ruin&group=building&url=` +
(`../../assets/models/buildings/realistic/tower_ruin.glb`를 URL 인코딩한
값)으로 격리 재시도부터 몇 번 더 해 볼 것 — 그래도 안 되면 사용자의
실제 GPU 브라우저(헤드리스 아님)로 열어 보는 쪽으로 넘겨야 한다.


## 짐승 다시 굽기 — `bake-beasts.mjs` + `view=pet` (2026-09-23)

짐승은 이제 이 스크립트로 굽는다: saga-go 폴더에서 `node tools/bake-icons/bake-beasts.mjs [키,키...]`(키를 안 주면 전부 85개).
`js/sprite.js` 의 `PET_BEAST_FILE`·`BEAST_FORM_FILES`·`BG_BEAST_FILE` 에서 키를 모아 `_bake_one.html?view=pet` 을 **한 개씩 새로 연
페이지**로 굽고 `assets/sprites2d/beast_<키>.png` 에 바로 쓴다(서버·헤드리스 크롬을 제가 띄우고 제 것만 끈다).

`view=pet` 구도 — 쉬는(idle) 클립 첫 자세 → 긴 축을 옆으로(yaw 1.1, 물고기 형태 키는 1.4) → 스킨 반영 상자 여덟 모서리를
화면에 투영해 정사각 직교 프레임에 몸 전체·발이 바닥. 예전 기본 구도(`fit` 1.6·정면 42°)는 얼굴만 크게 위아래가 잘렸다
(사슴 다리, 장룡은 막대). `_bake_one.html` 은 meshopt 디코더도 붙인다(사가나락에서 옮긴 펫 모델). 건물은 예전 구도 그대로.


## `tower_ruin`(역참) 풀림 (2026-09-23)

위 "알려진 흠" 의 마지막 하나. `bake-beasts.mjs` 와 같은 방식(서버·헤드리스 크롬을 띄워 **잡마다 새로 연 페이지**, 70초 기다림·한 번 재시도)으로
`_bake_one.html?key=tower_ruin&group=building&fit=1.1&url=..%2F..%2Fassets%2Fmodels%2Fbuildings%2Frealistic%2Ftower_ruin.glb` 을 열자 첫 시도에 구워졌다
(원인은 여전히 모름 — 예전 막힘이 간헐적이었다는 기록과 맞는다). fit 0.7 은 작고 1.4 는 위가 잘려 1.1. `world.js` `drawStation` 이
`building_tower_ruin.png` 을 쓴다(3D 역참과 같은 모델). 같은 도구로 다시 구운 `Inn` 은 기존 그림과 같았다.
