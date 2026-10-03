using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 3절 — 공격 목표 카탈로그. 처음엔 소패
    /// 하나였다(허창과 맞닿은 평범한 소성, js/data-city.js 그대로: wall
    /// 3600·land plain). **51장 "대규모 콘텐츠" — 정도를 두 번째 목표로
    /// 추가**(2026-09-14) — 소패 함락 뒤에도 계속 확장할 거리가 있도록,
    /// 복양과 맞닿은 둘째 소성. 원작 시나리오 194에서도 복양 방면 다음
    /// 목표로 실제 있던 지명(조조·여포가 다퉜던 곳)이라 이름 정책(인물
    /// 실명 금지) 대상이 아니다 — 지명이지 인물이 아니다. **병력·수치는
    /// 소패와 같은 재해석 논리**(RealmEnemyRecord 클래스 주석 참고: 적
    /// AI가 없어 정적으로 채운다) — 정도는 소패보다 한 단계 큰 다음
    /// 목표로 자리하도록 성벽·병력을 살짝 올렸다.
    /// **51장 2차 확장(2026-09-15)** — 낙양(진류의 첫 목표, 시작 성
    /// 셋 중 그때까지 목표가 없던 유일한 곳)·하비(소패 함락 뒤 이어지는
    /// 둘째 목표)·업(정도 함락 뒤 이어지는 둘째 목표) 셋을 더했다.
    /// AttackFromCityId가 "xiaopei"·"dingtao"인 항목은 그 성을 먼저
    /// 함락해 RealmCityState.ActiveCityIds에 편입시키기 전엔
    /// RealmWarState.Attack()이 출진 병력·무장을 그 성에서 못 구해
    /// 자연히 막힌다 — 별도 "잠금" 플래그 없이 기존 게이트(출진 성
    /// 소유 여부)만으로 순서가 강제된다. wall/troops는 saga-web/
    /// saga-realm/js/data-city.js 원본 성벽값 + 소패·정도가 이미 쓰던
    /// 비율(병력≈성벽×0.23)로, train은 함락 난이도가 깊어질수록(진류·
    /// 소패·복양의 첫 목표=40·45·50, 그 다음 단계=55·60) 단계적으로
    /// 올렸다.
    /// **51장 3차 확장(2026-09-16)** — 낙양·하비·업을 함락한 뒤 각자
    /// 이어지는 셋째 단계(장안·수춘·진양)를 더했다. 이제 시작 성 셋
    /// (허창·진류·복양)과 2차 확장 셋(낙양·하비·업) 전부가 자기 목표를
    /// 하나씩 갖고, 3차 확장 셋(장안·수춘·진양)만 아직 다음 목표가
    /// 없다 — 다음에 더 늘릴 자리는 이 셋 중 하나에서 고르면 된다.
    /// **51장 4차 확장(2026-09-16, 같은 날 "이어해")** — 장안→한중,
    /// 수춘→여남 둘을 더했다. 진양은 원작 LINKS상 이웃(업·낙양·장안)이
    /// 전부 이미 우리 성이라 더 뻗을 자리가 없어 이번엔 그대로 뒀다
    /// (막다른 가지 — 결함이 아니라 원작 지도가 그렇게 생겼다). train은
    /// 사슬마다 깊이 하나당 +15(허창 사슬: 40·55·70·85, 진류 사슬:
    /// 50·65·80, 복양 사슬: 45·60·75로 진양에서 끝)로 규칙을 지켰다.
    /// **51장 5차 확장(2026-09-16, 같은 날 "묻지 말고 이어해")** —
    /// 한중→성도(촉의 심장부), 여남→강하(형주 방면 첫걸음) 둘을 더했다.
    /// **"wan"은 앞으로도 절대 attackFromCityId로 안 쓴다** —
    /// PlaytestRealmSlice.cs의 PlotGate·AttackWrongCity가 "목표 없는
    /// 성"을 검증할 때 고정으로 쓰는 성이라, 여기 목표를 붙이면 그
    /// 게이트 테스트가 조용히 깨진다(2차 확장 때 진류로 이미 한 번
    /// 겪은 회귀와 같은 함정).
    /// **51장 6차 확장(2026-09-16, 같은 날 "이어해줘")** — 성도→강주,
    /// 강하→양양 둘을 더했다. 두 사슬(허창·진류 출신) 모두 여섯 단계
    /// 깊이까지 왔다 — train도 그대로 +15씩 이어 붙였다(110·115).
    /// **51장 7차 확장(2026-09-16, 같은 날 "이어해")** — 강주→영안,
    /// 양양→강릉 둘을 더했다. 두 사슬 모두 일곱 단계 깊이(train
    /// 125·130)까지 왔다.
    /// **51장 8차 확장(2026-09-16, 같은 날 "이어해줘")** — 강릉→장사
    /// 하나만 더했다. **영안은 이번에 막다른 가지로 확인됐다** —
    /// 원작 LINKS상 영안의 이웃(강주·강릉)이 전부 이미 우리 성이라
    /// 진양과 같은 사정(더 뻗을 자리가 없다). 장사는 여덟 단계
    /// 깊이(train 145, +15 그대로)까지 왔다.
    /// **51장 9차 확장(2026-09-16, 같은 날 "이어해줘")** — 장사→시상
    /// (강동의 서쪽 문)을 더했다. 원작 LINKS상 시상은 수춘·강하와도
    /// 맞닿아 있지만 그 둘은 이미 각자 목표(여남·양양)를 붙였으니(성
    /// 하나당 목표 하나) 이번엔 장사 쪽에서만 이어 붙였다. 아홉 단계
    /// 깊이(train 160, +15 그대로)까지 왔다.
    /// **51장 10차 확장(2026-09-16, 같은 날 "순서대로 이어해줘")** —
    /// 시상→건업(원작 LINKS: chaisang-jianye, 훗날 오나라 도읍)을
    /// 더했다. 시상의 다른 이웃(kuaiji, 강동 끝)은 이번에 안 골랐다 —
    /// 다음 확장 후보. 허창 사슬이 열 단계 깊이(train 175, +15 그대로)까지
    /// 왔다.
    /// **51장 11차 확장(2026-09-16, 같은 날 "순서대로 이어해줘")** —
    /// 건업→회계(원작 LINKS: jianye-kuaiji, "강동의 끝"). 원작 LINKS엔
    /// 장사(changsha)도 회계와 맞닿지만 장사는 이미 시상을 목표로 갖고
    /// 있어(성 하나당 목표 하나) 건업 쪽에서만 이어 붙였다. 허창 사슬이
    /// 열한 단계 깊이(train 190, +15 그대로)까지 왔다 — 회계는 원작
    /// LINKS상 더 이상 이웃이 없어(강동의 끝) 이 사슬의 마지막 칸이다.
    /// **51장 12차 확장(2026-09-17)** — 진양→운중(원작 LINKS: jinyang-
    /// yunzhong). 4차 확장 때 진양을 "이웃(업·낙양·장안)이 전부 이미 우리
    /// 성"이라 막다른 가지로 적었는데, 그건 화북 본토 LINKS만 보고 놓친
    /// 오판이었다 — data-city.js 542행 "막북" 구역에 jinyang-yunzhong 링크가
    /// 따로 있다(원작 시나리오 밖 이 저장소 창작 확장 지역, 균열/폐허로
    /// 이어지는 관문). 운중은 land: plain·landmark: true(막북 첫 관문) —
    /// wall 3400은 원작 그대로, troops는 다른 성들과 같은 wall×0.23(50
    /// 단위 반올림) 공식으로 800, train은 복양 사슬 깊이(45·60·75)에 +15
    /// 이어 90.
    /// **51장 13차 확장(2026-09-17, 같은 세션 "막북 안쪽으로 계속
    /// 이어해")** — 운중→상군(원작 LINKS: yunzhong-shangjun). 운중의
    /// 이웃은 안문·정양·상군 셋인데, 안문·정양은 둘 다 운중 하나로만
    /// 이어진 잎사귀(다른 LINKS 줄이 전혀 없다)라 골라도 바로 막다른
    /// 가지가 된다 — 상군은 북지·삭방으로 계속 뻗어 사슬을 더 늘릴 수
    /// 있어 이번엔 상군을 골랐다(안문·정양은 다음 확장 후보로 남긴다).
    /// 원작 land는 hill인데 이 사슬의 다른 성들(진양·한중·영안·장사)과
    /// 같은 이유로 Plain 처리(새 enum 값 추가는 범위 밖). wall 3200은
    /// 원작 그대로, troops=wall×0.23 반올림=750, train=운중의 90+15=105.
    /// **51장 14차 확장(2026-09-17, 같은 세션 "묻지말고 이어해줘")** —
    /// 상군→삭방(원작 LINKS: shangjun-shuofang). 상군의 다른 이웃(북지)은
    /// 잎사귀(다른 LINKS 없음)라 골라도 바로 막다른 가지가 된다 — 삭방은
    /// 오원(wuyuan)으로 한 단계 더 이어져 사슬을 늘릴 수 있어 이번엔
    /// 삭방을 골랐다(북지는 다음 확장 후보로 남긴다). land는 원작 그대로
    /// plain(보정 불필요). wall 2900은 원작 그대로, troops=wall×0.23
    /// 반올림=650, train=상군의 105+15=120.
    /// **51장 15차 확장(2026-09-17, 같은 세션 "오원까지 마무리하고
    /// 이어해줘")** — 삭방→오원(원작 LINKS: shuofang-wuyuan). 오원엔
    /// 다른 LINKS가 전혀 없어(잎사귀) 복양 사슬은 여기서 끝난다 — 이제
    /// 세 사슬(허창·복양·진류) 전부 확정된 막다른 끝. 원작 land는 hill인데
    /// 진양·한중 등과 같은 이유로 Plain 처리. wall 2700은 원작 그대로,
    /// troops=wall×0.23 반올림=600, train=삭방의 120+15=135.
    /// **51장 16차 확장(2026-09-18, PLAN.md Q-U2 사용자 결정)** — 세 사슬의
    /// 끝(회계·영안·오원)은 원작 LINKS를 교주·서역·남중·막북·균열·임읍·
    /// 묘역까지 전부 뒤져도 더 뻗을 링크가 진짜로 없다(확인 완료). 대신
    /// **"성 하나당 목표 하나" 제약을 풀어** 이미 목표가 있는 국경 성에서
    /// 둘째 목표를 열었다 — 데이터 모델은 원래도 이걸 막지 않았다
    /// (`Catalog`는 목표 id로 키가 잡히지 `attackFromCityId`로 잡히지
    /// 않는다, 같은 성을 출진지로 둔 항목을 여럿 둬도 원래 무해했다).
    /// 진짜 바뀐 건 `TargetFrom()`이 첫째만 돌려주던 것을 `TargetsFrom()`
    /// (전부 반환)으로 일반화하고, `RealmWarState.Attack()/Plot()`이 목표
    /// id를 인자로 받게 되고, UI(`RealmCommandUi`)가 목표가 여럿이면
    /// 고르는 패널을 새로 연 것 — 3장. ① 장안(changan)의 둘째 목표
    /// (원작 LINKS: changan-tianshui, "농서의 요충" — 한중(hanzhong)과도
    /// 맞닿지만 천수는 한 성에만 준다). ② 장사(changsha)의 둘째 목표
    /// (원작 LINKS: changsha-nanhai, 교주 관문). ③ 강주(jiangzhou)의
    /// 둘째 목표(원작 LINKS: jiangzhou-zhuti, 남중 관문). train은 셋 다
    /// "같은 출진 성의 기존 목표와 같은 깊이"(형제 가지) 규칙으로
    /// 출진 성 자신의 train+15 그대로: 장안 65+15=80(한중과 같음), 장사
    /// 145+15=160(시상과 같음), 강주 110+15=125(영안과 같음). wall은 원작
    /// 그대로(천수 4400·남해 4400·주제 3200), troops=wall×0.23 반올림
    /// (1000·1000·750). 셋 다 land는 원작 그대로 옮기되 hill인 천수만
    /// 다른 hill/mount 성들과 같은 이유로 Plain 처리(주제는 원작 river
    /// 그대로). 교주(nanhai 너머 창오·합포)·남중(zhuti 너머 건녕)은 더
    /// 깊이 뻗을 수 있는 새 지역이라 다음 확장 후보로 남긴다.
    /// **51장 17차 확장(2026-09-18, 새 세션 "사가유니티 이어해")** — 16차가
    /// 다음 후보로 남긴 두 곳을 이었다. ① 남해→창오(원작 LINKS:
    /// nanhai-cangwu, "산과 강이 겹치는 안쪽 땅, 길이 하나뿐"). 남해의
    /// 다른 이웃(합포, LINKS: nanhai-hepu)도 계속 뻗지만 이번엔 창오
    /// 쪽만 골랐다(다음 확장 후보로 남김 — 지금까지 관례대로 한 갈래씩).
    /// ② 주제→건녕(원작 LINKS: zhuti-jianning, "남중 여러 부족을 아우르는
    /// 다스림의 중심" — 월수·장가·운남 셋으로 더 뻗는 허브라 다음 확장
    /// 여지가 넓다). 둘 다 16차의 "형제 가지"가 아니라 정상적인 한 단계
    /// 더 깊은 자식(부모 자신이 아니라 부모의 목표 성에서 이어짐)이라
    /// train은 옛 규칙(부모의 train+15) 그대로: 창오 160+15=175, 건녕
    /// 125+15=140. wall은 원작 그대로(창오 3600·건녕 3800),
    /// troops=wall×0.23 반올림(850·850 — 우연히 같음). land는 원작
    /// 그대로 옮기되 창오(hill)는 다른 hill/mount 성들과 같은 이유로
    /// Plain 처리, 건녕은 원작 plain 그대로.
    /// **51장 18차 확장(2026-09-18, 같은 날 "사가유니티 이어해")** — 17차가
    /// 남긴 후보 중 한 갈래씩 더 이었다. ① 창오→울림(원작 LINKS:
    /// cangwu-yulin, "숲이 짙은 산골, 코끼리가 짐을 나른다" — 울림은
    /// 교지(jiaozhi)로 더 뻗어 교주 사슬이 계속 이어질 수 있다).
    /// ② 건녕→월수(원작 LINKS: jianning-yuexi, "서쪽 산길, 강족과 맞닿은
    /// 변경" — 원작 LINKS상 월수는 더 이상 이웃이 없어 이 사슬의 막다른
    /// 끝). 건녕의 다른 이웃(장가·운남)은 여전히 열려 있어 다음 확장
    /// 후보로 남긴다. 남해의 다른 이웃(합포)도 아직 안 골랐다 — 이번에도
    /// 관례대로 한 갈래씩만. train은 부모의 train+15 그대로: 울림
    /// 175+15=190, 월수 140+15=155. wall은 원작 그대로(울림 3400·월수
    /// 2800), troops=wall×0.23 반올림(800·650). land는 둘 다 원작이
    /// hill/mount라 다른 성들과 같은 이유로 Plain 처리.
    /// **51장 19차 확장(2026-09-18, 같은 날 "사가유니티 이어해")** — 이번엔
    /// 교주 사슬 하나(울림→교지)와, **건녕(jianning)의 둘째 목표**(장가)를
    /// 함께 열었다. ① 울림→교지(원작 LINKS: yulin-jiaozhi, "붉은 강이
    /// 바다로 드는 삼각주, 교주에서 가장 큰 저자" — 구진(jiuzhen)으로 더
    /// 뻗을 수 있어 다음 확장 후보로 남긴다). ② 건녕→장가(원작 LINKS:
    /// jianning-zangke, "협곡을 낀 물길, 배는 못 다녀도 걷기는 험하다").
    /// 건녕은 이미 월수(18차)를 목표로 갖고 있어 **16차의 "형제 가지"
    /// 규칙을 처음으로 원래 세 국경 성(장안·장사·강주) 밖으로 확장**한
    /// 사례다 — `TargetsFrom`/공격·계략 고르기 패널이 이미 목표 개수와
    /// 무관하게 동작하도록 짜여 있어(16차 때부터) 코드는 한 줄도 안
    /// 고쳤다, 데이터만 늘렸다. train은 형제 가지 규칙대로 건녕 자신의
    /// train+15=155(월수와 같음), 교지는 정상적인 한 단계 더 깊은 자식
    /// 규칙대로 울림의 190+15=205. wall은 원작 그대로(교지 4600·장가
    /// 3000), troops=wall×0.23 반올림(1050·700). 교지는 원작 river
    /// 그대로, 장가(hill)는 다른 hill/mount 성들과 같은 이유로 Plain
    /// 처리. 건녕의 남은 이웃(운남)·남해의 남은 이웃(합포)은 다음 확장
    /// 후보로 남긴다.
    /// **51장 20차 확장(2026-09-18, 같은 날 "사가유니티 이어해")** — 교주
    /// 사슬 하나(교지→구진)와, **남해(nanhai)의 둘째 목표**(합포)를 함께
    /// 열었다. ① 교지→구진(원작 LINKS: jiaozhi-jiuzhen, "벼가 두 번
    /// 여무는 들, 남쪽으로 갈수록 낯설어진다" — 일남(rinan)으로 더 뻗을
    /// 수 있어 다음 확장 후보로 남긴다). ② 남해→합포(원작 LINKS:
    /// nanhai-hepu, "진주가 나는 바닷가, 배가 곧 재물이다") — 남해는
    /// 이미 창오(17차)를 목표로 갖고 있어 19차(건녕→장가)와 같은 결로
    /// "형제 가지" 규칙을 또 한 번 확장했다(합포의 원작 LINKS 쪽 다음
    /// 칸이 이미 우리 성인 교지라 합포 자체가 이 방향의 마지막 칸이다).
    /// train은 형제 가지 규칙대로 남해 자신의 train+15=175(창오와 같음),
    /// 구진은 정상적인 한 단계 더 깊은 자식 규칙대로 교지의 205+15=220.
    /// wall은 원작 그대로(구진 3000·합포 3200), troops=wall×0.23 반올림
    /// (700·750). 둘 다 원작 land 그대로(구진 plain·합포 river, 보정
    /// 불필요). 건녕의 남은 이웃(운남)은 다음 확장 후보로 남긴다.
    /// **51장 21차 확장(2026-09-18, 같은 날 "사가유니티 이어해")** — 교주
    /// 사슬 하나(구진→일남)와, **건녕(jianning)의 셋째 목표**(운남)를
    /// 함께 열었다. ① 구진→일남(원작 LINKS: jiuzhen-rinan, "한(漢)의
    /// 땅이라 부르는 가장 남쪽 끝" — 향림(xianglin)으로 더 뻗을 수 있어
    /// 다음 확장 후보). ② 건녕→운남(원작 LINKS: jianning-yunnan, "구름
    /// 남쪽의 큰 호수") — 건녕은 이미 월수·장가 둘을 목표로 갖고 있어
    /// **형제 가지가 셋으로 늘어난 첫 사례**다(운남의 원작 LINKS 다음
    /// 칸 영창(yongchang)은 남중보다 더 먼 서역 방면이라 이번엔 안
    /// 골랐다 — 다음 확장 후보). `TargetsFrom`/공격·계략 고르기 패널이
    /// 목표 개수와 무관하게 동작하는 걸 다시 확인(이번엔 목표 3개짜리
    /// 패널). train은 일남이 정상적인 한 단계 더 깊은 자식 규칙(구진
    /// 220+15=235), 운남이 형제 가지 규칙(건녕 140+15=155, 월수·장가와
    /// 같음). wall은 원작 그대로(일남 2800·운남 2900), troops=wall×0.23
    /// 반올림(650·650 — 우연히 같음). 둘 다 원작 land가 hill/mount라
    /// 다른 성들과 같은 이유로 Plain 처리.
    /// **51장 22차 확장(2026-09-19, 새 세션 "사가유니티 이어해")** — 21차가
    /// 남긴 두 후보(일남→상림, 운남→영창)를 함께 열었다. ① 일남→상림
    /// (원작 LINKS: rinan-xianglin, 실제 후한서·양서에 나오는 일남군
    /// 속현이자 임읍국이 일어난 바로 그 현 — 노용·전충 둘로 더 뻗을
    /// 수 있어 다음 확장 후보). ② 운남→영창(원작 LINKS: yunnan-
    /// yongchang, "머나먼 서쪽 땅, 천축의 물건도 이 길을 거쳐 온다" —
    /// 신독(shendu)으로 더 뻗을 수 있어 다음 확장 후보). 둘 다 정상적인
    /// 한 단계 더 깊은 자식(부모의 train+15): 상림 235+15=250, 영창
    /// 155+15=170. wall은 원작 그대로(상림 3200·영창 3400),
    /// troops=wall×0.23 반올림(750·800). 둘 다 원작 land가 이미 plain이라
    /// 보정 불필요.
    /// **51장 23차 확장(2026-09-19, 같은 날 "23차도 이어해")** — 22차가
    /// 남긴 후보 중 한 갈래씩 골랐다. ① 상림→전충(원작 LINKS:
    /// xianglin-dianchong — 상림의 다른 이웃 노용(luorong, 잎사귀 하나
    /// 뿐)보다 전충을 골랐다, "임읍국의 도성"이라 landmark이고 비경·
    /// 서권·구속 셋으로 더 뻗는 허브라 다음 확장 여지가 넓다 — 17차
    /// 건녕을 고른 것과 같은 이유). ② 영창→신독(원작 LINKS: yongchang-
    /// shendu, "한서가 '신독'이라 적은 땅" — 영창의 유일한 이웃, landmark,
    /// 건타라·대하·목건타·사이 넷으로 더 뻗는 허브). 둘 다 정상적인 한
    /// 단계 더 깊은 자식(부모의 train+15): 전충 250+15=265, 신독
    /// 170+15=185. wall은 원작 그대로(전충 3800·신독 4000),
    /// troops=wall×0.23 반올림(850·900). 둘 다 원작 land가 이미 plain이라
    /// 보정 불필요.
    /// </summary>
    public class RealmEnemyRecord
    {
        public int Wall;
        public int MaxWall;
        public int Troops;
        public int Train;
        public int Tech;
        public bool Captured;
    }

    public class RealmEnemyCityDef
    {
        public readonly string Id;
        private readonly string _name;
        public string Name => RealmLocalization.T("city." + Id, _name);
        public readonly RealmLand Land;
        public readonly int BaseWall;
        public readonly int BaseTroops;
        public readonly int BaseTrain;
        public readonly int BaseTech;
        /// <summary>이 성을 칠 수 있는 유일한 출진 성 — 이 슬라이스는
        /// 성 하나당 목표 하나로 좁힌다(여러 목표를 동시에 공략하는 건
        /// 범위 밖).</summary>
        public readonly string AttackFromCityId;

        public RealmEnemyCityDef(string id, string name, RealmLand land, int baseWall, int baseTroops, int baseTrain, int baseTech, string attackFromCityId)
        {
            Id = id;
            _name = name;
            Land = land;
            BaseWall = baseWall;
            BaseTroops = baseTroops;
            BaseTrain = baseTrain;
            BaseTech = baseTech;
            AttackFromCityId = attackFromCityId;
        }
    }

    public static class RealmEnemyCity
    {
        public const string XiaopeiId = "xiaopei";
        public const string DingtaoId = "dingtao";
        public const string LuoyangId = "luoyang";
        public const string XiapiId = "xiapi";
        public const string YeId = "ye";
        public const string ChanganId = "changan";
        public const string ShouchunId = "shouchun";
        public const string JinyangId = "jinyang";
        public const string HanzhongId = "hanzhong";
        public const string RunanId = "runan";
        public const string ChengduId = "chengdu";
        public const string JiangxiaId = "jiangxia";
        public const string JiangzhouId = "jiangzhou";
        public const string XiangyangId = "xiangyang";
        public const string YonganId = "yongan";
        public const string JianglingId = "jiangling";
        public const string ChangshaId = "changsha";
        public const string ChaisangId = "chaisang";
        public const string JianyeId = "jianye";
        public const string KuaijiId = "kuaiji";
        public const string YunzhongId = "yunzhong";
        public const string ShangjunId = "shangjun";
        public const string ShuofangId = "shuofang";
        public const string WuyuanId = "wuyuan";
        public const string TianshuiId = "tianshui";
        public const string NanhaiId = "nanhai";
        public const string ZhutiId = "zhuti";
        public const string CangwuId = "cangwu";
        public const string JianningId = "jianning";
        public const string YulinId = "yulin";
        public const string YuexiId = "yuexi";
        public const string JiaozhiId = "jiaozhi";
        public const string ZangkeId = "zangke";
        public const string JiuzhenId = "jiuzhen";
        public const string HepuId = "hepu";
        public const string RinanId = "rinan";
        public const string YunnanId = "yunnan";
        public const string XianglinId = "xianglin";
        public const string YongchangId = "yongchang";
        public const string DianchongId = "dianchong";
        public const string ShenduId = "shendu";
        public const string BijingId = "bijing";
        public const string JiantuoluoId = "jiantuoluo";
        public const string LuorongId = "luorong";
        public const string JibinId = "jibin";
        public const string DaxiaId = "daxia";
        public const string WuyishanliId = "wuyishanli";
        public const string MoqietuoId = "moqietuo";
        public const string SheyiId = "sheyi";
        public const string ZhuwuId = "zhuwu";
        public const string XiquanId = "xiquan";
        public const string QuzuId = "quzu";
        public const string BeidiId = "beidi";
        public const string YanmenId = "yanmen";
        public const string DingxiangId = "dingxiang";

        public static readonly string[] AllIds =
        {
            XiaopeiId, DingtaoId, LuoyangId, XiapiId, YeId, ChanganId, ShouchunId, JinyangId,
            HanzhongId, RunanId, ChengduId, JiangxiaId, JiangzhouId, XiangyangId,
            YonganId, JianglingId, ChangshaId, ChaisangId, JianyeId, KuaijiId, YunzhongId, ShangjunId,
            ShuofangId, WuyuanId, TianshuiId, NanhaiId, ZhutiId, CangwuId, JianningId, YulinId, YuexiId,
            JiaozhiId, ZangkeId, JiuzhenId, HepuId, RinanId, YunnanId, XianglinId, YongchangId,
            DianchongId, ShenduId, BijingId, JiantuoluoId, LuorongId, JibinId, DaxiaId, WuyishanliId, MoqietuoId, SheyiId, ZhuwuId,
            XiquanId, QuzuId, BeidiId, YanmenId, DingxiangId,
        };

        private static readonly Dictionary<string, RealmEnemyCityDef> Catalog = new Dictionary<string, RealmEnemyCityDef>
        {
            // 소패는 허창(xuchang)과만 맞닿아 있다 — 이 슬라이스의 첫 출진 성.
            [XiaopeiId] = new RealmEnemyCityDef(XiaopeiId, "소패", RealmLand.Plain, baseWall: 3600, baseTroops: 800, baseTrain: 40, baseTech: 100, attackFromCityId: "xuchang"),
            // 정도는 복양(puyang)과만 맞닿아 있다 — 둘째 출진 성. 소패보다
            // 한 단계 큰 다음 목표(성벽·병력 소패의 약 1.4배).
            [DingtaoId] = new RealmEnemyCityDef(DingtaoId, "정도", RealmLand.Plain, baseWall: 5000, baseTroops: 1150, baseTrain: 45, baseTech: 100, attackFromCityId: "puyang"),
            // 낙양은 진류(chenliu)와만 맞닿아 있다 — 시작 성 셋 중 그때까지
            // 유일하게 목표가 없던 진류의 첫 출진 성(원작 LINKS: chenliu-luoyang).
            [LuoyangId] = new RealmEnemyCityDef(LuoyangId, "낙양", RealmLand.Plain, baseWall: 6800, baseTroops: 1550, baseTrain: 50, baseTech: 100, attackFromCityId: "chenliu"),
            // 하비는 소패(xiaopei)와만 맞닿아 있다(원작 LINKS: xiaopei-xiapi) —
            // 소패를 함락해야 열리는 둘째 단계 목표.
            [XiapiId] = new RealmEnemyCityDef(XiapiId, "하비", RealmLand.River, baseWall: 5200, baseTroops: 1200, baseTrain: 55, baseTech: 100, attackFromCityId: "xiaopei"),
            // 업은 정도(dingtao)와만 맞닿아 있다(원작 LINKS: puyang-ye — 정도가
            // 원작에 없는 창작 지명이라 그 다음 칸으로 자연스럽게 이어 붙였다) —
            // 정도를 함락해야 열리는 둘째 단계 목표, 다섯 중 가장 어렵다.
            [YeId] = new RealmEnemyCityDef(YeId, "업", RealmLand.Plain, baseWall: 6500, baseTroops: 1500, baseTrain: 60, baseTech: 100, attackFromCityId: "dingtao"),
            // 장안은 낙양(luoyang)과만 맞닿아 있다(원작 LINKS: luoyang-changan) —
            // 낙양을 함락해야 열리는 셋째 단계 목표.
            [ChanganId] = new RealmEnemyCityDef(ChanganId, "장안", RealmLand.Plain, baseWall: 6600, baseTroops: 1500, baseTrain: 65, baseTech: 100, attackFromCityId: "luoyang"),
            // 수춘은 하비(xiapi)와만 맞닿아 있다(원작 LINKS: xiapi-shouchun) —
            // 하비를 함락해야 열리는 셋째 단계 목표.
            [ShouchunId] = new RealmEnemyCityDef(ShouchunId, "수춘", RealmLand.River, baseWall: 5000, baseTroops: 1150, baseTrain: 70, baseTech: 100, attackFromCityId: "xiapi"),
            // 진양은 업(ye)과만 맞닿아 있다(원작 LINKS: ye-jinyang) — 업을
            // 함락해야 열리는 셋째 단계 목표, 여덟 중 가장 어렵다.
            [JinyangId] = new RealmEnemyCityDef(JinyangId, "진양", RealmLand.Plain, baseWall: 5200, baseTroops: 1200, baseTrain: 75, baseTech: 100, attackFromCityId: "ye"),
            // 한중은 장안(changan)과만 맞닿아 있다(원작 LINKS: changan-hanzhong,
            // "촉으로 드는 문") — 장안을 함락해야 열리는 넷째 단계 목표.
            [HanzhongId] = new RealmEnemyCityDef(HanzhongId, "한중", RealmLand.Plain, baseWall: 5600, baseTroops: 1300, baseTrain: 80, baseTech: 100, attackFromCityId: "changan"),
            // 여남은 수춘(shouchun)과만 맞닿아 있다(원작 LINKS: shouchun-runan) —
            // 수춘을 함락해야 열리는 넷째 단계 목표, 열 중 가장 어렵다.
            [RunanId] = new RealmEnemyCityDef(RunanId, "여남", RealmLand.Plain, baseWall: 4200, baseTroops: 950, baseTrain: 85, baseTech: 100, attackFromCityId: "shouchun"),
            // 성도는 한중(hanzhong)과만 맞닿아 있다(원작 LINKS: hanzhong-chengdu,
            // 촉의 심장부) — 한중을 함락해야 열리는 다섯째 단계 목표.
            [ChengduId] = new RealmEnemyCityDef(ChengduId, "성도", RealmLand.Plain, baseWall: 6000, baseTroops: 1400, baseTrain: 95, baseTech: 100, attackFromCityId: "hanzhong"),
            // 강하는 여남(runan)과만 맞닿아 있다(원작 LINKS: runan-jiangxia,
            // 형주 방면 첫걸음) — 여남을 함락해야 열리는 다섯째 단계 목표,
            // 열둘 중 가장 어렵다.
            [JiangxiaId] = new RealmEnemyCityDef(JiangxiaId, "강하", RealmLand.River, baseWall: 4800, baseTroops: 1100, baseTrain: 100, baseTech: 100, attackFromCityId: "runan"),
            // 강주는 성도(chengdu)와만 맞닿아 있다(원작 LINKS: chengdu-jiangzhou,
            // 촉의 동쪽 자물쇠) — 성도를 함락해야 열리는 여섯째 단계 목표.
            [JiangzhouId] = new RealmEnemyCityDef(JiangzhouId, "강주", RealmLand.River, baseWall: 4600, baseTroops: 1050, baseTrain: 110, baseTech: 100, attackFromCityId: "chengdu"),
            // 양양은 강하(jiangxia)와만 맞닿아 있다(원작 LINKS: xiangyang-jiangxia,
            // 형주의 머리) — 강하를 함락해야 열리는 여섯째 단계 목표, 열넷
            // 중 가장 어렵다.
            [XiangyangId] = new RealmEnemyCityDef(XiangyangId, "양양", RealmLand.River, baseWall: 6200, baseTroops: 1450, baseTrain: 115, baseTech: 100, attackFromCityId: "jiangxia"),
            // 영안은 강주(jiangzhou)와만 맞닿아 있다(원작 LINKS:
            // jiangzhou-yongan, 삼협의 입구) — 강주를 함락해야 열리는
            // 일곱째 단계 목표.
            [YonganId] = new RealmEnemyCityDef(YonganId, "영안", RealmLand.Plain, baseWall: 5000, baseTroops: 1150, baseTrain: 125, baseTech: 100, attackFromCityId: "jiangzhou"),
            // 강릉은 양양(xiangyang)과만 맞닿아 있다(원작 LINKS:
            // xiangyang-jiangling, 형주의 곳간) — 양양을 함락해야 열리는
            // 일곱째 단계 목표, 열여섯 중 가장 어렵다.
            [JianglingId] = new RealmEnemyCityDef(JianglingId, "강릉", RealmLand.River, baseWall: 5400, baseTroops: 1250, baseTrain: 130, baseTech: 100, attackFromCityId: "xiangyang"),
            // 장사는 강릉(jiangling)과만 맞닿아 있다(원작 LINKS:
            // jiangling-changsha, 강남 사군의 맏이) — 강릉을 함락해야
            // 열리는 여덟째 단계 목표, 열일곱 중 가장 어렵다. 영안(yongan)은
            // 이웃(강주·강릉)이 전부 이미 우리 성이라 이번엔 다음 목표를 못
            // 붙였다(진양과 같은 막다른 가지).
            [ChangshaId] = new RealmEnemyCityDef(ChangshaId, "장사", RealmLand.Plain, baseWall: 4400, baseTroops: 1000, baseTrain: 145, baseTech: 100, attackFromCityId: "jiangling"),
            // 시상은 장사(changsha)와만 맞닿아 있다(원작 LINKS:
            // changsha-chaisang, "강동의 서쪽 문, 여기서 배를 내면
            // 형주다") — 장사를 함락해야 열리는 아홉째 단계 목표, 열여덟
            // 중 가장 어렵다. 원작 LINKS엔 수춘·강하도 시상과 맞닿지만
            // 그 둘은 이미 각자 목표(여남·양양)를 갖고 있어 이번엔
            // 장사에서만 이어 붙였다.
            [ChaisangId] = new RealmEnemyCityDef(ChaisangId, "시상", RealmLand.River, baseWall: 4600, baseTroops: 1050, baseTrain: 160, baseTech: 100, attackFromCityId: "changsha"),
            // 건업은 시상(chaisang)과만 맞닿아 있다(원작 LINKS:
            // chaisang-jianye, 훗날 오나라 도읍) — 시상을 함락해야 열리는
            // 열째 단계 목표, 열아홉 중 가장 어렵다. 원작 LINKS엔 회계
            // (kuaiji)도 건업과 맞닿지만 이번엔 시상 쪽에서만 이어 붙였다.
            [JianyeId] = new RealmEnemyCityDef(JianyeId, "건업", RealmLand.River, baseWall: 5200, baseTroops: 1200, baseTrain: 175, baseTech: 100, attackFromCityId: "chaisang"),
            // 회계는 건업(jianye)과만 맞닿아 있다(원작 LINKS: jianye-kuaiji,
            // 강동의 끝) — 건업을 함락해야 열리는 열한째 단계 목표, 스물 중
            // 가장 어렵다. 원작 LINKS엔 장사(changsha)도 회계와 맞닿지만
            // 장사는 이미 시상을 목표로 갖고 있어 이번엔 건업에서만 이어
            // 붙였다. 이 사슬의 마지막 칸(회계는 원작 LINKS상 더 이상
            // 이웃이 없다).
            [KuaijiId] = new RealmEnemyCityDef(KuaijiId, "회계", RealmLand.Plain, baseWall: 4400, baseTroops: 1000, baseTrain: 190, baseTech: 100, attackFromCityId: "jianye"),
            // 운중은 진양(jinyang)과만 맞닿아 있다(원작 LINKS: jinyang-yunzhong,
            // 막북의 첫 관문) — 진양을 함락해야 열리는 복양 사슬의 새 넷째
            // 단계 목표. 4차 확장 때 진양을 막다른 가지로 적었던 건 화북
            // 본토 LINKS만 본 오판이었다(위 클래스 주석 참고).
            [YunzhongId] = new RealmEnemyCityDef(YunzhongId, "운중", RealmLand.Plain, baseWall: 3400, baseTroops: 800, baseTrain: 90, baseTech: 100, attackFromCityId: "jinyang"),
            // 상군은 운중(yunzhong)과만 맞닿아 있다(원작 LINKS:
            // yunzhong-shangjun, 막북 둘째 관문) — 운중을 함락해야 열리는
            // 복양 사슬의 새 다섯째 단계 목표. 운중의 다른 이웃(안문·정양)은
            // 둘 다 잎사귀(다른 LINKS 없음)라 이번엔 계속 뻗을 수 있는
            // 상군을 골랐다.
            [ShangjunId] = new RealmEnemyCityDef(ShangjunId, "상군", RealmLand.Plain, baseWall: 3200, baseTroops: 750, baseTrain: 105, baseTech: 100, attackFromCityId: "yunzhong"),
            // 삭방은 상군(shangjun)과만 맞닿아 있다(원작 LINKS:
            // shangjun-shuofang, 막북 셋째 관문) — 상군을 함락해야 열리는
            // 복양 사슬의 새 여섯째 단계 목표. 상군의 다른 이웃(북지)은
            // 잎사귀라 이번엔 계속 뻗을 수 있는 삭방을 골랐다.
            [ShuofangId] = new RealmEnemyCityDef(ShuofangId, "삭방", RealmLand.Plain, baseWall: 2900, baseTroops: 650, baseTrain: 120, baseTech: 100, attackFromCityId: "shangjun"),
            // 오원은 삭방(shuofang)과만 맞닿아 있다(원작 LINKS:
            // shuofang-wuyuan, 막북 넷째 관문) — 삭방을 함락해야 열리는
            // 복양 사슬의 새 일곱째 단계 목표. 오원엔 다른 LINKS가 없어
            // (잎사귀) 이 사슬의 마지막 칸이다.
            [WuyuanId] = new RealmEnemyCityDef(WuyuanId, "오원", RealmLand.Plain, baseWall: 2700, baseTroops: 600, baseTrain: 135, baseTech: 100, attackFromCityId: "shuofang"),
            // 북지는 상군(shangjun)과만 맞닿아 있다(원작 LINKS: shangjun-beidi,
            // "농서와 이어지는 변경") — 33차 확장, 상군의 둘째 자식(삭방과
            // 형제 가지, 14차가 안 골랐던 이웃을 이번에 채운다 — 상군이 목표
            // 둘로 늘어난 첫 사례). train은 상군 자신의 105+15=120(삭방과
            // 동률). land는 원작 그대로 plain(보정 불필요). 원작에 더 뻗는
            // LINKS 없어(잎사귀) 이 가지는 여기서 끝 — 상군 갈래가 전부 닫힌다.
            [BeidiId] = new RealmEnemyCityDef(BeidiId, "북지", RealmLand.Plain, baseWall: 3000, baseTroops: 690, baseTrain: 120, baseTech: 100, attackFromCityId: "shangjun"),
            // 안문은 운중(yunzhong)과만 맞닿아 있다(원작 LINKS: yunzhong-yanmen,
            // "기러기도 넘기 힘들다는 고개") — 34차 확장, 운중의 둘째 자식
            // (상군과 형제 가지, 13차가 안 골랐던 두 이웃 안문·정양 중 이번엔
            // 안문을 골랐다 — 운중이 목표 둘로 늘어난 첫 사례). train은 운중
            // 자신의 90+15=105(상군과 동률). land는 원작 mount를 Plain으로
            // 보정(건타라·대하·서권·구속과 같은 이유). 원작에 더 뻗는 LINKS
            // 없어(잎사귀) 이 가지는 여기서 끝.
            [YanmenId] = new RealmEnemyCityDef(YanmenId, "안문", RealmLand.Plain, baseWall: 3000, baseTroops: 690, baseTrain: 105, baseTech: 100, attackFromCityId: "yunzhong"),
            // 정양은 운중(yunzhong)과만 맞닿아 있다(원작 LINKS:
            // yunzhong-dingxiang, "초원의 첫 저자") — 35차 확장, 운중의
            // 셋째이자 마지막 자식(상군·안문과 형제 가지, 운중이 목표 셋으로
            // 늘어난 첫 사례). train은 운중 자신의 90+15=105(상군·안문과 동률).
            // land는 원작 그대로 plain(보정 불필요). 원작에 더 뻗는 LINKS
            // 없어(잎사귀) 이걸로 운중 갈래, 즉 막북 전체가 완전히 닫힌다.
            [DingxiangId] = new RealmEnemyCityDef(DingxiangId, "정양", RealmLand.Plain, baseWall: 2800, baseTroops: 644, baseTrain: 105, baseTech: 100, attackFromCityId: "yunzhong"),
            // 천수는 장안(changan)과 맞닿아 있다(원작 LINKS: changan-tianshui,
            // "농서의 요충") — 16차 확장, 장안의 둘째 목표(장안은 이미
            // 한중을 갖고 있다 — 성 하나당 목표 하나 제약을 이번에 풀었다,
            // 위 클래스 주석 참고). train은 장안 자신의 65+15=80(한중과 같은
            // 깊이의 형제 가지).
            [TianshuiId] = new RealmEnemyCityDef(TianshuiId, "천수", RealmLand.Plain, baseWall: 4400, baseTroops: 1000, baseTrain: 80, baseTech: 100, attackFromCityId: "changan"),
            // 남해는 장사(changsha)와 맞닿아 있다(원작 LINKS:
            // changsha-nanhai, 교주로 드는 첫 관문) — 16차 확장, 장사의
            // 둘째 목표(장사는 이미 시상을 갖고 있다). train은 장사 자신의
            // 145+15=160(시상과 같은 깊이의 형제 가지).
            [NanhaiId] = new RealmEnemyCityDef(NanhaiId, "남해", RealmLand.Plain, baseWall: 4400, baseTroops: 1000, baseTrain: 160, baseTech: 100, attackFromCityId: "changsha"),
            // 주제는 강주(jiangzhou)와 맞닿아 있다(원작 LINKS:
            // jiangzhou-zhuti, 남중으로 드는 첫 관문, "노수를 건너야
            // 닿는다") — 16차 확장, 강주의 둘째 목표(강주는 이미 영안을
            // 갖고 있다). train은 강주 자신의 110+15=125(영안과 같은 깊이의
            // 형제 가지).
            [ZhutiId] = new RealmEnemyCityDef(ZhutiId, "주제", RealmLand.River, baseWall: 3200, baseTroops: 750, baseTrain: 125, baseTech: 100, attackFromCityId: "jiangzhou"),
            // 창오는 남해(nanhai)와만 맞닿아 있다(원작 LINKS: nanhai-cangwu,
            // "산과 강이 겹치는 안쪽 땅, 길이 하나뿐") — 17차 확장, 남해를
            // 함락해야 열리는 교주 사슬의 다음 단계. train은 남해 자신의
            // 160+15=175(정상적인 한 단계 더 깊은 자식 — 16차의 "형제 가지"
            // 규칙과는 다르다).
            [CangwuId] = new RealmEnemyCityDef(CangwuId, "창오", RealmLand.Plain, baseWall: 3600, baseTroops: 850, baseTrain: 175, baseTech: 100, attackFromCityId: "nanhai"),
            // 건녕은 주제(zhuti)와만 맞닿아 있다(원작 LINKS: zhuti-jianning,
            // "남중 여러 부족을 아우르는 다스림의 중심") — 17차 확장, 주제를
            // 함락해야 열리는 남중 사슬의 다음 단계. train은 주제 자신의
            // 125+15=140. 월수·장가·운남 셋으로 더 뻗는 허브라 다음 확장
            // 후보로 남긴다.
            [JianningId] = new RealmEnemyCityDef(JianningId, "건녕", RealmLand.Plain, baseWall: 3800, baseTroops: 850, baseTrain: 140, baseTech: 100, attackFromCityId: "zhuti"),
            // 울림은 창오(cangwu)와만 맞닿아 있다(원작 LINKS: cangwu-yulin,
            // "숲이 짙은 산골, 코끼리가 짐을 나른다") — 18차 확장, 창오를
            // 함락해야 열리는 교주 사슬의 다음 단계. train은 창오 자신의
            // 175+15=190. 교지(jiaozhi)로 더 뻗을 수 있어 다음 확장 후보로
            // 남긴다.
            [YulinId] = new RealmEnemyCityDef(YulinId, "울림", RealmLand.Plain, baseWall: 3400, baseTroops: 800, baseTrain: 190, baseTech: 100, attackFromCityId: "cangwu"),
            // 월수는 건녕(jianning)과만 맞닿아 있다(원작 LINKS:
            // jianning-yuexi, "서쪽 산길, 강족과 맞닿은 변경") — 18차
            // 확장, 건녕을 함락해야 열리는 남중 사슬의 다음 단계. train은
            // 건녕 자신의 140+15=155. 원작 LINKS상 더 이상 이웃이 없어
            // (잎사귀) 이 사슬은 여기서 끝난다.
            [YuexiId] = new RealmEnemyCityDef(YuexiId, "월수", RealmLand.Plain, baseWall: 2800, baseTroops: 650, baseTrain: 155, baseTech: 100, attackFromCityId: "jianning"),
            // 교지는 울림(yulin)과만 맞닿아 있다(원작 LINKS: yulin-jiaozhi,
            // "붉은 강이 바다로 드는 삼각주, 교주에서 가장 큰 저자") —
            // 19차 확장, 울림을 함락해야 열리는 교주 사슬의 다음 단계.
            // train은 울림 자신의 190+15=205. 구진(jiuzhen)으로 더 뻗을
            // 수 있어 다음 확장 후보로 남긴다.
            [JiaozhiId] = new RealmEnemyCityDef(JiaozhiId, "교지", RealmLand.River, baseWall: 4600, baseTroops: 1050, baseTrain: 205, baseTech: 100, attackFromCityId: "yulin"),
            // 장가는 건녕(jianning)과 맞닿아 있다(원작 LINKS:
            // jianning-zangke, "협곡을 낀 물길") — 19차 확장, 건녕의
            // 둘째 목표(건녕은 이미 월수를 갖고 있다 — 16차 "형제 가지"
            // 규칙을 원래 세 국경 성 밖으로 처음 확장). train은 건녕
            // 자신의 140+15=155(월수와 같은 깊이의 형제 가지).
            [ZangkeId] = new RealmEnemyCityDef(ZangkeId, "장가", RealmLand.Plain, baseWall: 3000, baseTroops: 700, baseTrain: 155, baseTech: 100, attackFromCityId: "jianning"),
            // 구진은 교지(jiaozhi)와만 맞닿아 있다(원작 LINKS:
            // jiaozhi-jiuzhen, "벼가 두 번 여무는 들") — 20차 확장,
            // 교지를 함락해야 열리는 교주 사슬의 다음 단계. train은
            // 교지 자신의 205+15=220. 일남(rinan)으로 더 뻗을 수 있어
            // 다음 확장 후보로 남긴다.
            [JiuzhenId] = new RealmEnemyCityDef(JiuzhenId, "구진", RealmLand.Plain, baseWall: 3000, baseTroops: 700, baseTrain: 220, baseTech: 100, attackFromCityId: "jiaozhi"),
            // 합포는 남해(nanhai)와 맞닿아 있다(원작 LINKS: nanhai-hepu,
            // "진주가 나는 바닷가") — 20차 확장, 남해의 둘째 목표(남해는
            // 이미 창오를 갖고 있다 — 19차 장가와 같은 결로 형제 가지
            // 규칙을 또 한 번 확장). train은 남해 자신의 160+15=175
            // (창오와 같은 깊이의 형제 가지).
            [HepuId] = new RealmEnemyCityDef(HepuId, "합포", RealmLand.River, baseWall: 3200, baseTroops: 750, baseTrain: 175, baseTech: 100, attackFromCityId: "nanhai"),
            // 일남은 구진(jiuzhen)과만 맞닿아 있다(원작 LINKS:
            // jiuzhen-rinan, "한(漢)의 땅이라 부르는 가장 남쪽 끝") —
            // 21차 확장, 구진을 함락해야 열리는 교주 사슬의 다음 단계.
            // train은 구진 자신의 220+15=235. 향림(xianglin)으로 더
            // 뻗을 수 있어 다음 확장 후보로 남긴다.
            [RinanId] = new RealmEnemyCityDef(RinanId, "일남", RealmLand.Plain, baseWall: 2800, baseTroops: 650, baseTrain: 235, baseTech: 100, attackFromCityId: "jiuzhen"),
            // 운남은 건녕(jianning)과 맞닿아 있다(원작 LINKS:
            // jianning-yunnan, "구름 남쪽의 큰 호수") — 21차 확장, 건녕의
            // 셋째 목표(건녕은 이미 월수·장가를 갖고 있다 — 형제 가지가
            // 셋으로 늘어난 첫 사례). train은 건녕 자신의 140+15=155
            // (월수·장가와 같은 깊이의 형제 가지).
            [YunnanId] = new RealmEnemyCityDef(YunnanId, "운남", RealmLand.Plain, baseWall: 2900, baseTroops: 650, baseTrain: 155, baseTech: 100, attackFromCityId: "jianning"),
            // 상림은 일남(rinan)과만 맞닿아 있다(원작 LINKS:
            // rinan-xianglin, 임읍국이 일어난 바로 그 현) — 22차 확장,
            // 일남을 함락해야 열리는 교주 사슬의 다음 단계. train은
            // 일남 자신의 235+15=250. 노용·전충 둘로 더 뻗을 수 있어
            // 다음 확장 후보로 남긴다.
            [XianglinId] = new RealmEnemyCityDef(XianglinId, "상림", RealmLand.Plain, baseWall: 3200, baseTroops: 750, baseTrain: 250, baseTech: 100, attackFromCityId: "rinan"),
            // 영창은 운남(yunnan)과만 맞닿아 있다(원작 LINKS:
            // yunnan-yongchang, "머나먼 서쪽 땅, 천축의 물건도 이 길을
            // 거쳐 온다") — 22차 확장, 운남을 함락해야 열리는 남중 사슬의
            // 다음 단계. train은 운남 자신의 155+15=170. 신독(shendu)으로
            // 더 뻗을 수 있어 다음 확장 후보로 남긴다.
            [YongchangId] = new RealmEnemyCityDef(YongchangId, "영창", RealmLand.Plain, baseWall: 3400, baseTroops: 800, baseTrain: 170, baseTech: 100, attackFromCityId: "yunnan"),
            // 전충은 상림(xianglin)과만 맞닿아 있다(원작 LINKS:
            // xianglin-dianchong, "임읍국의 도성") — 23차 확장, 상림을
            // 함락해야 열리는 교주 사슬의 다음 단계. train은 상림 자신의
            // 250+15=265. 비경·서권·구속 셋으로 더 뻗는 허브라 다음 확장
            // 후보로 남긴다. 상림의 다른 이웃(노용)은 이번엔 안 골랐다.
            [DianchongId] = new RealmEnemyCityDef(DianchongId, "전충", RealmLand.Plain, baseWall: 3800, baseTroops: 850, baseTrain: 265, baseTech: 100, attackFromCityId: "xianglin"),
            // 신독은 영창(yongchang)과만 맞닿아 있다(원작 LINKS:
            // yongchang-shendu, "한서가 '신독'이라 적은 땅") — 23차 확장,
            // 영창을 함락해야 열리는 남중 사슬의 다음 단계. train은 영창
            // 자신의 170+15=185. 건타라·대하·목건타·사이 넷으로 더 뻗는
            // 허브라 다음 확장 후보로 남긴다.
            [ShenduId] = new RealmEnemyCityDef(ShenduId, "신독", RealmLand.Plain, baseWall: 4000, baseTroops: 900, baseTrain: 185, baseTech: 100, attackFromCityId: "yongchang"),
            // 비경은 전충(dianchong)과만 맞닿아 있다(원작 LINKS:
            // dianchong-bijing, "진주조개를 캐는 배가 나가는 해안 현") —
            // 24차 확장, 전충을 함락해야 열리는 교주 사슬의 다음 단계.
            // train은 전충 자신의 265+15=280. land는 원작이 river.
            // 다른 이웃(서권·구속)은 셋 다 잎사귀라 이번엔 임의로 비경을
            // 골랐다 — 이 사슬은 여기서 끝(더 뻗을 LINKS 없음).
            [BijingId] = new RealmEnemyCityDef(BijingId, "비경", RealmLand.River, baseWall: 3000, baseTroops: 690, baseTrain: 280, baseTech: 100, attackFromCityId: "dianchong"),
            // 건타라는 신독(shendu)과만 맞닿아 있다(원작 LINKS:
            // shendu-jiantuoluo, "간다라의 저자") — 24차 확장, 신독을
            // 함락해야 열리는 남중 사슬의 다음 단계. train은 신독 자신의
            // 185+15=200. land는 원작 hill이라 Plain으로 보정(이 트랙
            // enum엔 Hill이 없음, 상군과 같은 보정). 계빈(jibin)으로 한
            // 단계 더 뻗을 수 있어 다음 확장 후보로 남긴다. 다른 이웃
            // (대하·마게타·사위) 중 대하도 한 단계 더 뻗지만 이번엔
            // 건타라를 골랐다.
            [JiantuoluoId] = new RealmEnemyCityDef(JiantuoluoId, "건타라", RealmLand.Plain, baseWall: 3400, baseTroops: 782, baseTrain: 200, baseTech: 100, attackFromCityId: "shendu"),
            // 노용은 상림(xianglin)과만 맞닿아 있다(원작 LINKS:
            // xianglin-luorong, "상림과 나란한 옛 현") — 25차 확장,
            // 전충과 형제 가지(둘 다 상림의 자식, train은 상림 자신의
            // 250+15=265로 전충과 동률). 22차가 안 골랐던 쪽을 이번에
            // 채운다. 원작에 더 뻗는 LINKS 없어 여기서 끝(주오는 노용이
            // 아니라 상림의 또 다른 자식이라 별개 후보로 남는다).
            [LuorongId] = new RealmEnemyCityDef(LuorongId, "노용", RealmLand.Plain, baseWall: 2800, baseTroops: 644, baseTrain: 265, baseTech: 100, attackFromCityId: "xianglin"),
            // 계빈은 건타라(jiantuoluo)와만 맞닿아 있다(원작 LINKS:
            // jiantuoluo-jibin, "카슈미르의 옛 이름") — 25차 확장, 건타라를
            // 함락해야 열리는 남중 사슬의 다음 단계이자 이 갈래의 끝(원작에
            // 더 뻗는 LINKS 없음). train은 건타라 자신의 200+15=215.
            // land는 원작 mount라 Plain으로 보정(hill과 같은 이유).
            [JibinId] = new RealmEnemyCityDef(JibinId, "계빈", RealmLand.Plain, baseWall: 2800, baseTroops: 644, baseTrain: 215, baseTech: 100, attackFromCityId: "jiantuoluo"),
            // 대하는 신독(shendu)과만 맞닿아 있다(원작 LINKS:
            // shendu-daxia, "박트리아의 옛 이름") — 26차 확장, 건타라와
            // 형제 가지(둘 다 신독의 자식, train은 신독 자신의 185+15=200으로
            // 건타라와 동률). 24차가 안 골랐던 쪽을 이번에 채운다. land는
            // 원작 hill이라 Plain으로 보정(건타라와 같은 이유). 오익산리로
            // 한 단계 더 뻗을 수 있어 다음 확장 후보로 남긴다. 다른 이웃
            // (마게타·사위)은 둘 다 잎사귀.
            [DaxiaId] = new RealmEnemyCityDef(DaxiaId, "대하", RealmLand.Plain, baseWall: 3200, baseTroops: 736, baseTrain: 200, baseTech: 100, attackFromCityId: "shendu"),
            // 오익산리는 대하(daxia)와만 맞닿아 있다(원작 LINKS:
            // daxia-wuyishanli, "알렉산드리아라 불리던 땅의 한역 이름") —
            // 27차 확장, 대하를 함락해야 열리는 남중 사슬의 다음 단계이자
            // 이 갈래의 끝(원작에 더 뻗는 LINKS 없음). train은 대하 자신의
            // 200+15=215. land는 원작 hill이라 Plain으로 보정.
            [WuyishanliId] = new RealmEnemyCityDef(WuyishanliId, "오익산리", RealmLand.Plain, baseWall: 2600, baseTroops: 598, baseTrain: 215, baseTech: 100, attackFromCityId: "daxia"),
            // 마게타는 신독(shendu)과만 맞닿아 있다(원작 LINKS:
            // shendu-moqietuo, "항하 유역의 크고 오래된 나라") — 28차
            // 확장, 건타라·대하와 형제 가지(셋 다 신독의 자식, train은
            // 신독 자신의 185+15=200으로 둘과 동률 — 신독이 목표 셋으로
            // 늘어난 첫 사례, 건녕과 같은 패턴). 원작에 더 뻗는 LINKS
            // 없어 여기서 끝. land는 원작이 이미 plain이라 보정 불필요.
            // 다른 이웃(사위)도 잎사귀라 다음 확장 후보로 남긴다.
            [MoqietuoId] = new RealmEnemyCityDef(MoqietuoId, "마게타", RealmLand.Plain, baseWall: 3600, baseTroops: 828, baseTrain: 200, baseTech: 100, attackFromCityId: "shendu"),
            // 사위는 신독(shendu)과만 맞닿아 있다(원작 LINKS: shendu-sheyi,
            // "순례자들이 마지막으로 닿는 저자") — 29차 확장, 건타라·대하·
            // 마게타와 형제 가지(넷 다 신독의 자식, train은 신독 자신의
            // 185+15=200으로 나머지 셋과 동률 — 신독이 목표 넷으로 늘어난
            // 첫 사례). 원작에 더 뻗는 LINKS 없어 신독 갈래가 이걸로
            // 전부 닫힌다. land는 원작이 이미 plain이라 보정 불필요.
            [SheyiId] = new RealmEnemyCityDef(SheyiId, "사위", RealmLand.Plain, baseWall: 3000, baseTroops: 690, baseTrain: 200, baseTech: 100, attackFromCityId: "shendu"),
            // 주오는 노용(luorong)과만 맞닿아 있다(원작 LINKS: luorong-zhuwu,
            // "한(漢)의 문서에 남은 가장 남쪽 현") — 30차 확장, 노용을
            // 함락해야 열리는 교주 사슬의 다음 단계이자 이 갈래의 끝(원작에
            // 더 뻗는 LINKS 없음). train은 노용 자신의 265+15=280. 노용은
            // 자식이 하나뿐이라 enemyId 불필요. land는 원작 그대로 river.
            [ZhuwuId] = new RealmEnemyCityDef(ZhuwuId, "주오", RealmLand.River, baseWall: 2600, baseTroops: 598, baseTrain: 280, baseTech: 100, attackFromCityId: "luorong"),
            // 서권은 전충(dianchong)과만 맞닿아 있다(원작 LINKS: dianchong-xiquan,
            // "산을 낀 서쪽 현, 코끼리가 짐을 나른다") — 31차 확장, 전충의
            // 둘째 자식(비경과 형제 가지, 24차가 안 골랐던 두 이웃 서권·구속
            // 중 이번엔 서권을 골랐다 — 구속은 다음 확장 후보로 남긴다).
            // train은 전충 자신의 265+15=280(비경과 동률). land는 원작
            // hill을 Plain으로 보정(건타라·대하와 같은 이유). 원작에 더
            // 뻗는 LINKS 없어(잎사귀) 이 가지는 여기서 끝.
            [XiquanId] = new RealmEnemyCityDef(XiquanId, "서권", RealmLand.Plain, baseWall: 2700, baseTroops: 621, baseTrain: 280, baseTech: 100, attackFromCityId: "dianchong"),
            // 구속은 전충(dianchong)과만 맞닿아 있다(원작 LINKS: dianchong-quzu,
            // "지도 위 가장 남쪽 이름, 여기서부터는 기록도 흐릿하다") — 32차
            // 확장, 전충의 셋째이자 마지막 자식(비경·서권과 형제 가지, 전충이
            // 목표 셋으로 늘어난 첫 사례). train은 전충 자신의 265+15=280
            // (비경·서권과 동률). land는 원작 hill을 Plain으로 보정(서권과
            // 같은 이유). 원작에 더 뻗는 LINKS 없어(잎사귀) 전충 갈래가
            // 이걸로 전부 닫힌다.
            [QuzuId] = new RealmEnemyCityDef(QuzuId, "구속", RealmLand.Plain, baseWall: 2500, baseTroops: 575, baseTrain: 280, baseTech: 100, attackFromCityId: "dianchong"),
        };

        public static RealmEnemyCityDef Get(string id) => Catalog.TryGetValue(id, out var d) ? d : null;

        /// <summary>이 성에서 칠 수 있는 적 성 id 전부 — 51장 16차 확장
        /// (2026-09-18, PLAN.md Q-U2) "성 하나당 목표 하나" 제약을 풀면서
        /// 옛 `TargetFrom()`(단수)을 대체한다. 없으면 빈 리스트. 대부분
        /// 성은 여전히 하나뿐이라 `Count`로 UI가 "바로 공격" vs "고르기"를
        /// 가른다(`RealmCommandUi.ExecuteAttack()` 참고).</summary>
        public static List<string> TargetsFrom(string ourCityId)
        {
            var result = new List<string>();
            foreach (var def in Catalog.Values)
            {
                if (def.AttackFromCityId == ourCityId) result.Add(def.Id);
            }
            return result;
        }

        /// <summary>옛 호출부 호환용 — 목표가 여럿이면 그중 하나(순서는
        /// `Catalog` 내부 순서, 정해서 고르는 화면이 필요하면 `TargetsFrom`
        /// 을 직접 쓸 것). 목표가 하나뿐인 성이 압도적으로 많아 대부분
        /// 호출부는 이 메서드로 충분하다.</summary>
        public static string TargetFrom(string ourCityId)
        {
            var list = TargetsFrom(ourCityId);
            return list.Count > 0 ? list[0] : null;
        }

        /// <summary>적국 성의 웹 지역(`data-city.js` prov — fu 균열·pf 폐허·xi 서역·jiao 교주 …, tasks U-0026 목표 성 고르기가 쓴다). 웹 표에 없는 성(정도)은 "".
        /// 이 트랙 성 55 가운데 균열·폐허·서역 성은 없어 그 지역 우선은 교주(남해)만 걸린다.</summary>
        public static string ProvOf(string id) => ProvTable.TryGetValue(id ?? "", out var p) ? p : "";

        private static readonly Dictionary<string, string> ProvTable = new Dictionary<string, string>
        {
            ["xiaopei"] = "xu",
            ["luoyang"] = "si",
            ["xiapi"] = "xu",
            ["ye"] = "ji",
            ["changan"] = "si",
            ["shouchun"] = "yang",
            ["jinyang"] = "bing",
            ["hanzhong"] = "yi",
            ["runan"] = "yu",
            ["chengdu"] = "yi",
            ["jiangxia"] = "jing",
            ["jiangzhou"] = "yi",
            ["xiangyang"] = "jing",
            ["yongan"] = "yi",
            ["jiangling"] = "jing",
            ["changsha"] = "jing",
            ["chaisang"] = "yang",
            ["jianye"] = "yang",
            ["kuaiji"] = "yang",
            ["yunzhong"] = "mb",
            ["shangjun"] = "mb",
            ["shuofang"] = "mb",
            ["wuyuan"] = "mb",
            ["tianshui"] = "yong",
            ["nanhai"] = "jiao",
            ["zhuti"] = "nz",
            ["cangwu"] = "jiao",
            ["jianning"] = "nz",
            ["yulin"] = "jiao",
            ["yuexi"] = "nz",
            ["jiaozhi"] = "jiao",
            ["zangke"] = "nz",
            ["jiuzhen"] = "jiao",
            ["hepu"] = "jiao",
            ["rinan"] = "jiao",
            ["yunnan"] = "nz",
            ["xianglin"] = "cp",
            ["yongchang"] = "nz",
            ["dianchong"] = "cp",
            ["shendu"] = "tz",
            ["bijing"] = "cp",
            ["jiantuoluo"] = "tz",
            ["luorong"] = "cp",
            ["jibin"] = "tz",
            ["daxia"] = "tz",
            ["wuyishanli"] = "tz",
            ["moqietuo"] = "tz",
            ["sheyi"] = "tz",
            ["zhuwu"] = "cp",
            ["xiquan"] = "cp",
            ["quzu"] = "cp",
            ["beidi"] = "mb",
            ["yanmen"] = "mb",
            ["dingxiang"] = "mb",
        };

        public static RealmEnemyRecord NewRecord(string id)
        {
            var d = Get(id);
            if (d == null) return null;
            return new RealmEnemyRecord
            {
                Wall = d.BaseWall, MaxWall = d.BaseWall,
                Troops = d.BaseTroops, Train = d.BaseTrain, Tech = d.BaseTech,
                Captured = false,
            };
        }
    }
}
