using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0080 — 움직임 판정 시트. `SAGA_SHOT_SEQ=<장수>,<간격 프레임>`(예 `8,6`)이면 대상마다 같은 자리(움직이면 따라가며) N 장을
    /// 간격마다 찍어 가로 4칸 시트 한 장(`<대상>_seq.png`, 칸 왼쪽 위에 프레임 번호)으로 붙인다. 없으면 지금 그대로(정지 사진).
    /// 대상 문법은 기존 + `gamecam`(실제 게임 카메라 그대로 — 컷·월드맵·따라오는 카메라) · `player`(주인공을 3/4 앞에서 따라감).
    /// `SAGA_SHOT_ACT` — 첫 장 직전에 움직임을 일으킨다(촬영 도구 안에서만, 게임 코드 무변경 · 그 기능 진단이 이미 부르는 공개 함수만):
    /// `walk`(가상 조이스틱 앞으로) · `attack`(사가만리 FieldCombat.Attack / 사가나락 PlayerCombat.TriggerAttack) · `swap`(다음 동료로 교체) ·
    /// `skill:<n>`(n 번 동료로 교체 뒤 Skill) · `roof`(마을집 지붕 남쪽에서 북으로 걷기) · `bossintro`(사가나락 = 진단의 두목 더미, 사가종횡 = 두목 6m 앞으로) ·
    /// `bossroom`(U-0115 사가나락 — 러너가 진짜 두목 방을 짓고 주인공을 두목 9m 밖에 세워 걸려 들어가게, 8m 달려듦·컷은 게임이 연다) ·
    /// `gesture`(동료 환호) · `worldmap`(사가천하 지도 열기) · `party`·`party2`(모양별 동료 편성 — 스킬 진단과 같은 동료). `realmeras`(U-0091 사가천하 — 시간 틈 사람 묻힌 성 들여 수색·훈련·지도 켬) · `realmtactics`(U-0099 전술판 열고 첫 장수 고름) · `realmannals`(U-0101 열전 넷 심고 서고) · `realmzoom`(U-0102 지도 40m) · `hurt`(U-0105 2나락·4종횡 — 체력 35% 에서 한 대 → 첫 장 가장자리 번쩍·붉은 숫자, 끝 장 30% 밑 맥박) · `weatherprobe`(U-0117 — 장마다 날씨 입자 상태 한 줄 로그: 카메라·뿌리 위치·눈 입자 수/방출·보임·레이어·timeScale) · `weaponglow:<n>`(U-0120 1만리 — 주인공 무기 기록을 빛 단계 n 이 되는 강화·벼림으로 두고, `gamecam` 을 무기 곁 1.8m 에서 무기로 — U-0121 장마다·`swap` 뒤에도 숫자 한 줄). 대상 `screen` = 화면 그대로 첫·끝 장(오버레이 UI 포함). 판에 없는 동작은 로그에 SKIP. 여러 개는 `+` 로(`walk+attack`).
    /// </summary>
    public static partial class PlaytestShowcaseGui
    {
        private const int CellW = 640, CellH = 360, SheetCols = 4;
        private static int _seqN, _seqGap, _seqTaken, _seqNextAt;
        private static List<(string name, Transform target)> _seqTargets;
        private static List<List<Texture2D>> _seqFrames;
        private static bool _seqWalk;
        private static bool _wxProbe;   // U-0117 weatherprobe — 장마다 WeatherProbe() 한 줄
        private static Saga.Go.Player.WeaponVisual _wpnCam;   // U-0120 weaponglow — gamecam 을 이 무기 곁에서
        private static bool _seqScreen;   // U-0091 `screen` 대상 — 화면 그대로(ScreenCapture, 오버레이 UI 포함)
        private static bool _kitsWas, _kitsSet;
        private static int _skillRetry = -1, _skillTries;   // U-0090 순간이동 직후엔 공중이라 Skill() 이 거절(-1) — 땅에 설 때까지 다시 쓰고 그 뒤에 찍는다   // U-0090 party 동작이 켠 GoKits.OffForTest — 시트를 다 쓰면 되돌린다

        private static bool SeqActive
        {
            get
            {
                var s = System.Environment.GetEnvironmentVariable("SAGA_SHOT_SEQ");
                if (string.IsNullOrEmpty(s)) return false;
                var p = s.Split(',');
                return p.Length == 2 && int.TryParse(p[0], out _seqN) && int.TryParse(p[1], out _seqGap) && _seqN > 0 && _seqGap > 0;
            }
        }

        private static void SeqBegin()
        {
            _seqWalk = false; _wxProbe = false; _wpnCam = null;
            // 1만리 주인공은 물가(강물 속)에서 시작한다 — 지붕 말고는 진단과 같은 안전한 땅(FieldCombat.SafePoint)으로 옮겨 놓고 시작
            var acts = System.Environment.GetEnvironmentVariable("SAGA_SHOT_ACT") ?? "";
            var gofc = Saga.Go.Combat.FieldCombat.Instance;
            var hero = GameObject.FindWithTag("Player");
            if (gofc != null && hero != null && acts.Length > 0 && !acts.Contains("roof")) { Teleport(hero.transform, gofc.SafePoint); Debug.Log($"[ShowcaseGui] 주인공 → 안전한 땅 {gofc.SafePoint}"); }
            // U-0091 동작을 대상 찾기보다 먼저 — 지도 위 배우(Actor_)처럼 동작이 켜야 생기는 것도 `name:` 대상으로 잡힌다
            foreach (var act in acts.Split(new[] { '+' }, System.StringSplitOptions.RemoveEmptyEntries))
                Act(act.Trim());
            _seqTargets = new List<(string, Transform)>();
            _seqScreen = false;
            foreach (var spec in _targets)
            {
                if (spec == "gamecam") { _seqTargets.Add(("gamecam", null)); continue; }
                if (spec == "screen") { _seqScreen = true; continue; }   // U-0091 화면 그대로(오버레이 UI 포함) — 첫·끝 장만 따로 PNG
                if (spec == "player")   // 주인공을 3/4 앞에서 따라간다(게임 카메라는 내려다봐 걸음새가 안 보인다)
                {
                    var pl = GameObject.FindWithTag("Player");
                    if (pl != null) _seqTargets.Add(("player", pl.transform)); else Debug.Log("[ShowcaseGui] seq player → 0개 SKIP");
                    continue;
                }
                var t = Find(spec).FirstOrDefault();
                string safe = new string(spec.Where(char.IsLetterOrDigit).ToArray());
                if (t == null) Debug.Log($"[ShowcaseGui] seq {spec} → 0개 SKIP");
                else _seqTargets.Add((safe, t));
            }
            _seqFrames = _seqTargets.Select(_ => new List<Texture2D>()).ToList();
            foreach (var a in Object.FindObjectsByType<Animator>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)) a.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            _seqTaken = 0; _seqNextAt = _frame + 2;
            Debug.Log($"[ShowcaseGui] seq 시작 — 대상 {_seqTargets.Count}·{_seqN}장·{_seqGap}프레임 간격");
        }

        /// <summary>한 틱 — 다 찍었으면 시트를 쓰고 참.</summary>
        private static bool SeqTick()
        {
            if (_seqWalk) SetJoystick(new Vector2(0f, 1f));
            if (_approachBoss != null) ApproachTick();
            if (_skillRetry >= 0)
            {
                if (TrySkill(_skillRetry) == -1 && ++_skillTries < 120) { _seqNextAt = _frame + 2; return false; }
                _skillRetry = -1;
                _seqNextAt = _frame + 1;
            }
            if (_frame < _seqNextAt) return false;
            if (_wxProbe) WeatherProbe();
            if (_wpnCam != null) GlowLog($"장 {_seqTaken + 1}");   // U-0121 장마다 무기 빛 숫자(교체 뒤 외곽선이 0 이 아닌지)
            var main = Camera.main;
            for (int i = 0; i < _seqTargets.Count; i++)
            {
                var (name, t) = _seqTargets[i];
                Vector3 pos; Quaternion rot;
                if (t == null) { var c = GameCam(); if (c == null) continue; pos = c.transform.position; rot = c.transform.rotation; if (_wpnCam != null) WeaponCam(ref pos, ref rot); _seqFrames[i].Add(ShootTex(c, pos, rot)); continue; }
                if (main == null) continue;
                var lpz = t.GetComponent<Saga.Core.LifePose>();   // U-0146 장마다 몸짓 상태
                if (lpz != null)
                {
                    var an = t.GetComponentInChildren<Animator>();
                    var ua = an != null && an.isHuman ? an.GetBoneTransform(HumanBodyBones.RightUpperArm) : null;
                    var la = an != null && an.isHuman ? an.GetBoneTransform(HumanBodyBones.RightLowerArm) : null;
                    float armDeg = ua != null && la != null ? Vector3.Angle(la.position - ua.position, Vector3.down) : -1f;
                    Debug.Log($"[ShowcaseGui] lifepose {name} 장 {_seqTaken + 1} still {lpz.StillT:F1} sit {lpz.SitW:F2} act {lpz.Current} {lpz.ActT:F2} hold {lpz.HoldNow} 사람 {lpz.Humanoid} 오른윗팔 아래서 {armDeg:F0}° · 애니 {(an != null ? an.name + " 켜짐 " + an.isActiveAndEnabled : "없음")} · 자리 {t.position}");
                }
                if (name == "player")
                {
                    // 몸 위치 기준 옆(오른쪽) 3.4m·높이 2m 에서 가슴을 본다 — 걸음새·무기가 옆에서 보이게. 그 자리가 땅(둑·절벽) 속이면 지면 위 1.5m 로 올린다
                    var side = t.right; side.y = 0f; if (side.sqrMagnitude < 0.01f) side = Vector3.right;
                    var look = t.position + Vector3.up * 1.0f;
                    pos = t.position + side.normalized * 3.4f + Vector3.up * 2.0f;
                    if (Physics.Raycast(pos + Vector3.up * 60f, Vector3.down, out var hit, 120f, ~0, QueryTriggerInteraction.Ignore) && hit.point.y + 1.5f > pos.y) pos.y = hit.point.y + 1.5f;
                    rot = Quaternion.LookRotation(look - pos, Vector3.up);
                }
                else if (!Frame(t, out pos, out rot)) continue;
                _seqFrames[i].Add(ShootTex(main, pos, rot));
            }
            if (_seqScreen && (_seqTaken == 0 || _seqTaken == _seqN - 1))
            {
                ScreenCapture.CaptureScreenshot(_dir + $"screen_{_seqTaken + 1}.png");   // 프레임 끝에 비동기로 쓴다(게임 창 크기 그대로)
                Debug.Log($"[ShowcaseGui] screen_{_seqTaken + 1}.png");
            }
            _seqTaken++;
            _seqNextAt = _frame + _seqGap;
            if (_seqTaken < _seqN) return false;
            if (_seqWalk) SetJoystick(Vector2.zero);
            if (_kitsSet) { Saga.Go.Combat.GoKits.OffForTest = _kitsWas; _kitsSet = false; }
            for (int i = 0; i < _seqTargets.Count; i++) WriteSheet(_seqTargets[i].name, _seqFrames[i]);
            Debug.Log($"[ShowcaseGui] 찍음 시트 {_seqTargets.Count}장({_seqN}칸) → {_dir}");
            return true;
        }

        /// <summary>지금 화면을 그리는 카메라 — 켜진 메인 카메라(시네머신 컷도 이 카메라로 그린다), 없으면 켜진 것 중 깊이가 가장 큰 것.
        /// (깊이 순 먼저였더니 4종횡에서 전경용 카메라가 잡혀 컷을 못 봤다)</summary>
        private static Camera GameCam()
        {
            var m = Camera.main;
            if (m != null && m.isActiveAndEnabled) return m;
            return Camera.allCameras.Where(c => c.enabled && c.targetTexture == null).OrderByDescending(c => c.depth).FirstOrDefault();
        }

        private static void Act(string act)
        {
            try
            {
                var fc = Saga.Go.Combat.FieldCombat.Instance;
                var dcombat = Object.FindFirstObjectByType<Saga.Dungeon.Player.PlayerCombat>();
                switch (act.Split(':')[0])
                {
                    case "walk": _seqWalk = Object.FindFirstObjectByType<Saga.Core.VirtualJoystick>() != null; break;
                    case "party":
                    case "party2":
                        // 스킬 진단(PlaytestGoSkillShapes)처럼 모양별 첫 동료로 편성 — party = 찌르기·돌진·장판, party2 = 찌르기·돌진·소환(새 세이브는 주인공 혼자). 들판 칸은 목록 뒤부터(PartyState.FieldIds) → party 칸 1 장판·2 돌진·3 찌르기, party2 칸 1 소환
                        // U-0090 진단과 같은 스위치(GoKits.OffForTest) — 끄면 무용·통솔·덕망·고유 인물은 109-14-11 갈래 스킬이 나가 모양 효과가 안 찍혔다
                        if (fc == null) { Skip(act); return; }
                        if (!_kitsSet) { _kitsWas = Saga.Go.Combat.GoKits.OffForTest; _kitsSet = true; }
                        Saga.Go.Combat.GoKits.OffForTest = true;
                        string First(Saga.Go.Combat.SkillShape sh) => Saga.Go.Data.GoHeroes.All.First(h => Saga.Go.Combat.GoSkillShapes.ShapeOf(h.Id) == sh).Id;
                        var third = act == "party" ? Saga.Go.Combat.SkillShape.Field : Saga.Go.Combat.SkillShape.Summon;
                        Saga.Go.Data.PartyState.Restore(new[] { First(Saga.Go.Combat.SkillShape.Thrust), First(Saga.Go.Combat.SkillShape.Dash), First(third) });
                        fc.RebuildParty();
                        break;
                    case "partywise":
                    {
                        // U-0090 게임 그대로(스위치 없이) 모양 길을 타는 인물 — 지략·고유 없음(갈래 스킬 null) 첫 사람 하나(동료 칸 1)
                        if (fc == null) { Skip(act); return; }
                        string wise = Saga.Go.Data.GoHeroes.All.Where(h => h.Trait == Saga.Go.Data.HeroTrait.Wisdom && Saga.Go.Combat.GoKits.KitOf(h.Id, Saga.Go.Combat.GoElements.ForMember(h.Id)) == null).Select(h => h.Id).FirstOrDefault();
                        if (wise == null) { Skip(act); return; }
                        Saga.Go.Data.PartyState.Restore(new[] { wise });
                        fc.RebuildParty();
                        Debug.Log($"[ShowcaseGui] partywise {wise} 모양 {Saga.Go.Combat.GoSkillShapes.ShapeOf(wise)}");
                        break;
                    }
                    case "attack":
                        if (fc != null) fc.Attack();
                        else if (dcombat != null) dcombat.TriggerAttack();
                        else { Skip(act); return; }
                        break;
                    case "swap":
                        if (fc == null || fc.Party.Count < 2) { Skip(act); return; }
                        fc.TickTimers(Saga.Go.Combat.FieldCombat.SwapCooldownSec + 0.05f);
                        fc.Swap((fc.ActiveIndex + 1) % fc.Party.Count);
                        if (_wpnCam != null) GlowLog($"swap → 칸 {fc.ActiveIndex}");   // U-0121 교체 뒤 무기 빛 숫자
                        break;
                    case "skill":
                        if (fc == null || !int.TryParse(act.Substring(6), out int n) || n >= fc.Party.Count) { Skip(act); return; }
                        fc.TickTimers(Saga.Go.Combat.FieldCombat.SwapCooldownSec + 0.05f);
                        if (fc.ActiveIndex != n) fc.Swap(n);
                        fc.TickTimers(Saga.Go.Combat.FieldCombat.SwapCooldownSec + 0.05f);
                        if (TrySkill(n) == -1) { _skillRetry = n; _skillTries = 0; }
                        break;
                    case "roof":
                        var roof = Object.FindObjectsByType<Saga.Go.World.CameraOccluder>(FindObjectsSortMode.InstanceID).FirstOrDefault(o => o.GetComponentInParent<Saga.Go.World.GoHouseInterior>() == null);   // 마을 지붕만(방 천장 트리거 U-0086 빼고)
                        var pl = GameObject.FindWithTag("Player");
                        if (roof == null || pl == null) { Skip(act); return; }
                        var rb = roof.GetComponentInChildren<Collider>()?.bounds ?? new Bounds(roof.transform.position, Vector3.one * 8f);
                        Teleport(pl.transform, new Vector3(rb.center.x, pl.transform.position.y, rb.min.z - 3f));
                        _seqWalk = true;
                        break;
                    case "bossintro":
                        if (Saga.Dungeon.Cinematics.DungeonCutscenes.Instance != null) DungeonBossIntro();
                        else if (Saga.Story.Cinematics.StoryCutscenes.Instance != null) StoryBossIntro();
                        else { Skip(act); return; }
                        break;
                    case "bossroom":   // U-0115 2나락 — 진짜 두목 방(BuildRoomForTest("boss"))·진짜 달려듦(8m)으로 컷을 연다(Tick 직접 안 부름)
                        if (Saga.Dungeon.Cinematics.DungeonCutscenes.Instance == null || !DungeonBossRoom()) { Skip(act); return; }
                        break;
                    case "gesture":
                        if (!Saga.Dungeon.Data.GestureState.Start(Saga.Dungeon.Data.GestureState.AllyKey, Saga.Dungeon.Data.GestureState.Kind.Cheer, Time.time)) { Skip(act); return; }
                        break;
                    case "worldmap":
                        if (!Saga.Realm.Data.RealmMapState.ViewingMap) Saga.Realm.Data.RealmMapState.Toggle();
                        break;
                    case "die":   // U-0092 사가나락 — 출처 있는 피해로 쓰러뜨려 사망 카드(세 줄·「은총에서 다시」)
                        if (Saga.Dungeon.World.DungeonFloorRunner.Instance == null) { Skip(act); return; }
                        Saga.Dungeon.Data.HeroState.Invulnerable = false;
                        Saga.Dungeon.Data.HeroState.TakeDamage(Saga.Dungeon.Data.HeroState.HpMax * 10f, "황건적 두목", "근접 타격");
                        break;
                    case "pick":   // U-0093 사가종횡 — 전직한 Lv.12 로 두고 3택 장 하나 → 창
                        if (Object.FindFirstObjectByType<Saga.Story.UI.StoryPickUi>() == null) { Skip(act); return; }
                        if (!Saga.Story.Data.StoryJobState.HasJob) Saga.Story.Data.StoryJobState.Restore(Mathf.Max(12, Saga.Story.Data.StoryJobState.Level), 0f, "warrior");
                        Saga.Story.Data.StorySkillState.RestorePicks(Saga.Story.Data.StoryJobState.Level, 0, 0, 1);
                        Debug.Log($"[ShowcaseGui] pick 창 {Saga.Story.UI.StoryPickUi.Instance?.IsShowing} · 셋 {string.Join(", ", Saga.Story.UI.StoryPickUi.Instance?.Offer.Select(o => o.Key) ?? new string[0])}");
                        break;
                    case "realmnews":   // U-0094 사가천하 — 영내 소식 카드가 뜰 때까지 달 굴림(사건 카드면 비우고 다시)
                    {
                        if (Object.FindFirstObjectByType<Saga.Realm.World.RealmMapViewSwitcher>() == null) { Skip(act); return; }
                        Saga.Realm.Data.RealmScenario.Enabled = false;   // 때가 된 시나리오 카드가 먼저 뜨면 소식이 안 나온다(촬영 프로세스 안에서만)
                        for (int i = 0; i < 300; i++)
                        {
                            Saga.Realm.Data.RealmEventState.ClearForTest();
                            Saga.Realm.Data.RealmEventState.RollForMonth();
                            var cur = Saga.Realm.Data.RealmEventState.Current;
                            if (cur.HasValue && cur.Value.Kind == Saga.Realm.Data.RealmEventState.Kind.News) { Debug.Log($"[ShowcaseGui] realmnews {cur.Value.OfficerId}(굴림 {i + 1})"); break; }
                        }
                        break;
                    }
                    case "craft":   // U-0095 사가마을 — 주인공을 제작대 곁으로, 열매를 채워 창을 열고 승급(3택이 뜬 채)
                    {
                        var wb = Saga.Forest.World.ForestWorkbench.Instance;
                        var who = GameObject.FindWithTag("Player");
                        if (wb == null || who == null) { Skip(act); return; }
                        Teleport(who.transform, wb.transform.position + new Vector3(0f, 0.2f, -2f));
                        Saga.Forest.Data.ForestState.Restore(Mathf.Max(200, Saga.Forest.Data.ForestState.FruitCount));
                        wb.Toggle();
                        wb.PressUpgrade();
                        Debug.Log($"[ShowcaseGui] craft 창 {wb.IsOpen} · 3택 {(wb.Offer != null ? string.Join(", ", wb.Offer) : "없음")} · Lv.{Saga.Forest.Data.ForestHandState.Level}");
                        break;
                    }
                    case "track":   // U-0096 사가만리 — 첫 흔적 곁으로(3m 남쪽) 옮겨 둘레 흔적을 세우고, 둘을 읽어 목표판 줄이 "흔적 2/3" 이 되게
                    {
                        var tf = Saga.Go.World.TrackField.Instance;
                        var who = GameObject.FindWithTag("Player");
                        var traces = Saga.Go.Data.GoTrack.All;
                        if (tf == null || who == null || traces.Count < 3) { Skip(act); return; }
                        Teleport(who.transform, traces[0].Pos + new Vector3(0f, 1f, -3f));
                        tf.ReadAt(traces[1].Key); tf.ReadAt(traces[2].Key);
                        tf.Tick(traces[0].Pos);
                        Debug.Log($"[ShowcaseGui] track 흔적 {traces.Count}곳 · 둘레 {tf.ShownCount} · 첫 흔적 {traces[0].Key} {traces[0].Kind} @ {traces[0].Pos} · 줄 {Saga.Go.Data.GoTrack.Line(traces[0].Pos)}");
                        break;
                    }
                    case "frosttrack":   // U-0103 사가만리 — 서리봉 고원 첫 흔적 곁(3m 남쪽)으로, 고원 흔적 하나를 읽어 목표판 줄이 "흔적 1/3"
                    {
                        var tf = Saga.Go.World.TrackField.Instance;
                        var who = GameObject.FindWithTag("Player");
                        var frost = Saga.Go.Data.GoTrack.All.Where(t => t.Region == Saga.Go.Data.GoFrost.RegionId).ToList();
                        if (tf == null || who == null || frost.Count < 2) { Skip(act); return; }
                        Teleport(who.transform, frost[0].Pos + new Vector3(0f, 1f, -3f));
                        tf.ReadAt(frost[1].Key);
                        tf.Tick(frost[0].Pos);
                        Debug.Log($"[ShowcaseGui] frosttrack 고원 흔적 {frost.Count}곳 · 둘레 {tf.ShownCount} · 첫 {frost[0].Key} {frost[0].Kind} @ {frost[0].Pos} · 줄 {Saga.Go.Data.GoTrack.Line(frost[0].Pos)}");
                        break;
                    }
                    case "realmeras":
                        if (Object.FindFirstObjectByType<Saga.Realm.World.RealmMapViewSwitcher>() == null) { Skip(act); return; }
                        RealmEras();
                        break;
                    case "realmzoom":   // U-0102 사가천하 — 지도를 켜고 지금 성 둘레 40m·기울기 0.6(태수·재야·이름표)
                    {
                        if (!Saga.Realm.Data.RealmMapState.ViewingMap) Saga.Realm.Data.RealmMapState.Toggle();
                        var mc = Object.FindFirstObjectByType<Saga.Realm.Player.RealmWorldMapCamera>();
                        if (mc == null) { Skip(act); return; }
                        mc.SetView(Saga.Realm.Player.RealmWorldMapCamera.MinRadius, 0.6f);
                        mc.Tick(10f);
                        var card = GameObject.Find("SessionCard");   // 끝난 판 세이브면 승리 카드가 한가운데를 가린다(촬영 프로세스 안에서만 숨김)
                        if (card != null) card.SetActive(false);
                        Debug.Log($"[ShowcaseGui] realmzoom {Saga.Realm.Data.RealmCityState.CurrentCity} 중심 {mc.DebugPivot} 거리 {mc.DebugRadius}");
                        break;
                    }
                    case "realmannals":   // U-0101 사가천하 — 열전 넷을 심고 서고를 연다
                    {
                        var ui = Object.FindFirstObjectByType<Saga.Realm.UI.RealmCommandUi>();
                        if (ui == null) { Skip(act); return; }
                        PlaytestRealmTactics.SeedAnnals(4);
                        typeof(Saga.Realm.UI.RealmCommandUi).GetMethod("ToggleArchivePanel", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(ui, null);
                        break;
                    }
                    case "realmtactics":   // U-0099 사가천하 — 격자 전술판을 열고 첫 장수를 고른 채(갈 칸·칠 적 표시)
                        if (Object.FindFirstObjectByType<Saga.Realm.World.RealmMapViewSwitcher>() == null || PlaytestRealmTactics.OpenForShot() == null) { Skip(act); return; }
                        break;
                    case "dgranged":   // U-0106 2나락 — 명단 첫 활 잡졸을 주인공 앞 7m 에 세워 겨눔 → 쏨, 탄이 날아오는 중부터 찍는다(촬영 프로세스 안에서만)
                    {
                        var pc = Object.FindFirstObjectByType<Saga.Dungeon.Player.PlayerController>();
                        var runner = Object.FindFirstObjectByType<Saga.Dungeon.World.DungeonFloorRunner>();
                        if (pc == null) { Skip(act); return; }
                        Saga.Dungeon.Data.DungeonScenario.AbortScene(); Saga.Dungeon.UI.DungeonScenarioUi.Instance?.Hide();
                        Saga.Dungeon.Data.HeroState.Invulnerable = false; Saga.Dungeon.Data.HeroState.DamageHold = 0;
                        var foe = Saga.Dungeon.Data.DungeonFoeRoster.All.First(f => f.Weapon == Saga.Dungeon.Data.FoeWeapon.Bow);
                        Vector3 fwd = pc.transform.forward; fwd.y = 0f; fwd = fwd.sqrMagnitude > 1e-4f ? fwd.normalized : Vector3.forward;
                        var go = new GameObject("Enemy_FoeArcher");
                        go.SetActive(false);
                        go.transform.position = pc.transform.position + fwd * 7f;
                        var e = go.AddComponent<Saga.Dungeon.World.DungeonEnemy>();
                        e.SetSpawnContext("shot_ranged", runner != null ? runner.GruntModel : null);
                        e.ConfigureCombat(500f, 1f, 1, 1, null, null, false, foe.NameKo, foe.Color, 1f);
                        e.SetWeapon(foe.Weapon, 0f);
                        go.SetActive(true);
                        for (int i = 0; i < 20 && Saga.Dungeon.World.DungeonFoeShot.Active.Count == 0; i++) e.Tick(0.05f);
                        foreach (var s in Saga.Dungeon.World.DungeonFoeShot.Active) s.Tick(0.12f);
                        Debug.Log($"[ShowcaseGui] dgranged {foe.NameKo}({foe.Weapon}) @ {go.transform.position} · 탄 {Saga.Dungeon.World.DungeonFoeShot.Active.Count} · 이름 {e.DisplayName}");
                        break;
                    }
                    case "sit":    // U-0146 — 나를 곧장 앉힌다(가만히 8초 건너뜀)
                    {
                        var pg = GameObject.FindWithTag("Player");
                        var lp = pg != null ? pg.GetComponent<Saga.Core.LifePose>() : null;
                        if (lp == null) { Skip(act); return; }
                        lp.ForceSitForTest();
                        Debug.Log($"[ShowcaseGui] sit {pg.name} 사람 몸 {lp.Humanoid}");
                        break;
                    }
                    case "greet":  // U-0146 — 사람 몸 주민 하나를 인사시키고 그 이름을 남긴다(대상 name:LifeGreet)
                    {
                        Saga.Core.LifePose lp = null;
                        foreach (var p in Object.FindObjectsByType<Saga.Core.LifePose>(FindObjectsSortMode.None))
                        {
                            if (!p.Npc) continue;
                            p.Bind();
                            if (p.Humanoid) { lp = p; break; }
                        }
                        if (lp == null) { Skip(act); return; }
                        lp.gameObject.name = "LifeGreet_" + lp.gameObject.name;
                        lp.Play(Saga.Core.LifePose.Act.Wave);
                        Debug.Log($"[ShowcaseGui] greet {lp.gameObject.name}");
                        break;
                    }
                    case "hurt":   // U-0105 "내가 맞았다" — 체력 35% 로 두고 최대치 10% 한 대(→ 약 25%): 첫 장 = 가장자리 번쩍·붉은 숫자, 끝 장 = 30% 밑 맥박
                        if (Object.FindFirstObjectByType<Saga.Dungeon.Player.PlayerController>() != null)
                        {
                            Saga.Dungeon.Data.DungeonScenario.AbortScene(); Saga.Dungeon.UI.DungeonScenarioUi.Instance?.Hide();
                            typeof(Saga.Dungeon.Data.HeroState).GetProperty(nameof(Saga.Dungeon.Data.HeroState.Hp)).SetValue(null, Mathf.RoundToInt(Saga.Dungeon.Data.HeroState.HpMax * 0.35f));
                            Saga.Dungeon.Data.HeroState.Invulnerable = false; Saga.Dungeon.Data.HeroState.DamageHold = 0;
                            Saga.Dungeon.Data.HeroState.TakeDamage(Saga.Dungeon.Data.HeroState.HpMax * 0.1f * Saga.Dungeon.Data.BlessingState.DefMultiplier, "황건적", "근접 타격");
                            Debug.Log($"[ShowcaseGui] hurt 2나락 {Saga.Dungeon.Data.HeroState.Hp}/{Saga.Dungeon.Data.HeroState.HpMax} −{Saga.Dungeon.Data.HeroState.LastDealt} · 번쩍 {Saga.Core.HurtVignette.FlashCount} 알파 {Saga.Core.HurtVignette.Alpha:F2}");
                        }
                        else if (Object.FindFirstObjectByType<Saga.Story.Player.StoryPlayerVitals>() != null)
                        {
                            Saga.Story.Data.StoryScenario.AbortScene(); Saga.Story.UI.StoryScenarioUi.Instance?.Hide();
                            Saga.Story.Data.StoryPlayerHp.HoldForPick = false;
                            Saga.Story.Data.StoryPlayerHp.SetForTest(Saga.Story.Data.StoryPlayerHp.HpMax * 0.35f);
                            Saga.Story.Data.StoryPlayerHp.Hurt(Saga.Story.Data.StoryPlayerHp.HpMax * 0.1f);
                            Debug.Log($"[ShowcaseGui] hurt 4종횡 {Saga.Story.Data.StoryPlayerHp.Hp:F0}/{Saga.Story.Data.StoryPlayerHp.HpMax:F0} · 번쩍 {Saga.Core.HurtVignette.FlashCount} 알파 {Saga.Core.HurtVignette.Alpha:F2}");
                        }
                        else { Skip(act); return; }
                        break;
                    case "weatherprobe": _wxProbe = true; WeatherProbe(); break;
                    case "weaponglow": if (!WeaponGlow(act)) { Skip(act); return; } break;   // U-0120 1만리 무기 빛 단계 n — 기록을 그 단계로, 무기 곁에서 찍는다   // U-0117 4종횡 눈 안 보임 — 촬영 프로세스 안에서 입자 상태를 숫자로
                    default: Skip(act); return;
                }
                Debug.Log($"[ShowcaseGui] act {act}");
            }
            catch (System.Exception e) { Debug.Log($"[ShowcaseGui] act {act} SKIP — {e.GetType().Name}: {e.Message}"); }
        }

        /// <summary>U-0120 — 주인공 장착 무기 기록을 빛 단계 n(`GoTrack.GlowTier` = 강화/5 + 벼림)이 되게 둔다. 공개 `WeaponState.Restore`(스냅숏 + 이 무기 한 줄)만 쓴다 —
        /// Restore 가 `Changed` 를 쏴 `WeaponVisual` 이 다시 칠한다. 무기는 주인공 종류의 희귀도 2 이상 중 가장 낮은 것(두 판 같은 모델).</summary>
        private static bool WeaponGlow(string act)
        {
            var parts = act.Split(':');
            if (parts.Length < 2 || !int.TryParse(parts[1], out int n)) return false;
            n = Mathf.Clamp(n, 0, 11);
            var hero = GameObject.FindWithTag("Player");
            var wv = hero != null ? hero.GetComponent<Saga.Go.Player.WeaponVisual>() : null;
            if (wv == null) return false;
            const string who = "hero";
            var type = Saga.Go.Data.GoWeapons.TypeOf(who);
            var cands = Saga.Go.Data.GoWeapons.All.Where(x => x.Type == type && x.Rarity > 1).OrderBy(x => x.Rarity).ToList();
            if (cands.Count == 0) return false;
            var w = cands[0];
            // 강화 상한(Cap = 10 + 4×벼림) 안에서 lv/5 + asc = n: asc ≥ (5n − 10)/9
            int asc = Mathf.Clamp(Mathf.CeilToInt((5f * n - 10f) / 9f), 0, Saga.Go.Data.GoWeapons.MaxAsc);
            int lv = Mathf.Clamp(5 * (n - asc), 1, Saga.Go.Data.GoWeapons.MaxLv);
            var inv = Saga.Go.Data.WeaponState.SnapshotInv().Where(e => e.wid != w.Id).ToList();
            inv.Add(new Saga.Go.Data.WeaponState.InvEntry { wid = w.Id, lv = lv, asc = asc, refine = 1 });
            var eq = Saga.Go.Data.WeaponState.SnapshotEquip().Where(e => e.hero != who).ToList();
            eq.Add(new Saga.Go.Data.WeaponState.EquipEntry { hero = who, wid = w.Id });
            Saga.Go.Data.WeaponState.Restore(inv, eq, Saga.Go.Data.WeaponState.Ore);
            wv.RefreshModel(who);
            _wpnCam = wv;
            var rec = Saga.Go.Data.WeaponState.RecOf(w.Id);
            GlowLog($"요청 {n} · {w.Id}★{w.Rarity} Lv.{rec.lv} 벼림 {rec.asc}");
            return wv.ModelInstance != null;
        }

        /// <summary>U-0120·0121 — 지금 손 무기(첫 렌더러)의 빛 블록 숫자 한 줄. 교체 뒤·장마다 다시 불러 외곽선이 꺼지지 않았는지 본다.</summary>
        private static void GlowLog(string tag)
        {
            var wv = _wpnCam;
            if (wv == null) return;
            string shader = "-", ow = "-", rim = "-", rs = "-", rp = "-", scl = "-";
            int rn = 0;
            if (wv.ModelInstance != null)
            {
                var mpb = new MaterialPropertyBlock();
                foreach (var r in wv.ModelInstance.GetComponentsInChildren<Renderer>())
                {
                    var m = r.sharedMaterial; if (m == null) continue;
                    rn++;
                    if (rn > 1) continue;
                    r.GetPropertyBlock(mpb);
                    shader = m.shader != null ? m.shader.name : "null";
                    if (m.HasProperty("_OutlineWidth")) ow = (mpb.HasFloat("_OutlineWidth") ? mpb.GetFloat("_OutlineWidth") : m.GetFloat("_OutlineWidth")).ToString("F4");
                    if (m.HasProperty("_RimColor")) { var c = mpb.HasColor("_RimColor") ? mpb.GetColor("_RimColor") : m.GetColor("_RimColor"); rim = "#" + ColorUtility.ToHtmlStringRGB(c); }
                    if (m.HasProperty("_RimStrength")) rs = (mpb.HasFloat("_RimStrength") ? mpb.GetFloat("_RimStrength") : m.GetFloat("_RimStrength")).ToString("F2");
                    if (m.HasProperty("_RimPower")) rp = (mpb.HasFloat("_RimPower") ? mpb.GetFloat("_RimPower") : m.GetFloat("_RimPower")).ToString("F2");
                    scl = r.transform.lossyScale.x.ToString("F3");
                }
            }
            Debug.Log($"[ShowcaseGui] weaponglow tier={wv.GlowTier} shader={shader} outlineW={ow} rim={rim} rimS={rs} rimP={rp} scale={scl} — {tag} · 모델 {wv.ModelName} 렌더러 {rn}");
        }

        /// <summary>U-0120 — 게임 카메라 대신 무기 곁 1.8m(주인공 몸 반대쪽·조금 앞·조금 위)에서 무기 가운데를 본다.</summary>
        private static void WeaponCam(ref Vector3 pos, ref Quaternion rot)
        {
            var model = _wpnCam.ModelInstance;
            if (model == null) return;
            Bounds b = default; bool any = false;
            foreach (var r in model.GetComponentsInChildren<Renderer>()) { if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds); }
            if (!any) return;
            var body = _wpnCam.transform;
            var side = b.center - body.position; side.y = 0f;
            if (side.sqrMagnitude < 0.04f) side = body.right;
            var dir = (side.normalized + body.forward * 0.6f).normalized;
            pos = b.center + dir * 1.8f + Vector3.up * 0.4f;
            if (Physics.Raycast(pos + Vector3.up * 60f, Vector3.down, out var hit, 120f, ~0, QueryTriggerInteraction.Ignore) && hit.point.y + 0.5f > pos.y) pos.y = hit.point.y + 0.5f;
            rot = Quaternion.LookRotation(b.center - pos, Vector3.up);
        }

        /// <summary>U-0117 — 날씨 입자 상태 한 줄(게임 코드에 공개 칸 안 만듦: SkyWeather.Instance 아래 `Fx_Snow` 를 이름으로).</summary>
        private static void WeatherProbe()
        {
            var m = Camera.main; var gc = GameCam();
            string cam = m == null ? "null" : $"{m.name}@{m.transform.position:F1} on={m.isActiveAndEnabled} near={m.nearClipPlane:F2} far={m.farClipPlane:F0}";
            string g = gc == null ? "null" : gc == m ? "=main" : $"{gc.name}@{gc.transform.position:F1}";
            var sw = Saga.Core.SkyWeather.Instance;
            if (sw == null) { Debug.Log($"[ShowcaseGui] weatherprobe cam={cam} gc={g} root=null ts={Time.timeScale:F2}"); return; }
            var st = sw.transform.Find("Fx_Snow");
            var ps = st != null ? st.GetComponent<ParticleSystem>() : null;
            var r = st != null ? st.GetComponent<ParticleSystemRenderer>() : null;
            int layer = st != null ? st.gameObject.layer : -1;
            bool inMask = m != null && layer >= 0 && (m.cullingMask & (1 << layer)) != 0;
            string snow = ps == null ? "null" : $"{ps.particleCount}/{sw.SnowRate:F0} play={ps.isPlaying} act={st.gameObject.activeInHierarchy} at={st.position:F1}";
            string vis = r == null ? "null" : $"{r.isVisible} en={r.enabled} b={r.bounds.center:F1}~{r.bounds.size:F1}";
            // U-0118 — 안개 칸: 씬 안개(켜짐/모드/농도) · 덩이 입자 수@방출 상자 월드 높이 · 카메라 내려다보는 각
            var ft = sw.transform.Find("Fx_FogPuff");
            var fps = ft != null ? ft.GetComponent<ParticleSystem>() : null;
            string puff = fps == null ? "null" : $"{fps.particleCount}@{ft.position.y:F1}";
            string fog = $"fog={RenderSettings.fog}/{RenderSettings.fogMode}/{RenderSettings.fogDensity:F4} puff={puff} pitch={(m != null ? m.transform.eulerAngles.x : -1f):F0}";
            Debug.Log($"[ShowcaseGui] weatherprobe cam={cam} gc={g} root={sw.transform.position:F1} kind={sw.Kind} snow={snow} vis={vis} layer={layer}∈mask={inMask} ts={Time.timeScale:F2} dt={Time.deltaTime:F3} sky={(m != null ? m.clearFlags.ToString() : "-")} {fog}");
        }

        /// <summary>U-0090 — n 번 동료로 스킬. 결과·모양·만든 효과 수를 로그(거절이면 이유 칸도).</summary>
        private static int TrySkill(int n)
        {
            var fc = Saga.Go.Combat.FieldCombat.Instance;
            if (fc == null) return 0;
            if (fc.ActiveIndex != n) { fc.TickTimers(Saga.Go.Combat.FieldCombat.SwapCooldownSec + 0.05f); fc.Swap(n); }
            int got = fc.Skill();
            var pc = fc.GetComponent<Saga.Go.Player.PlayerController>();
            if (got != -1 || _skillTries == 0 || _skillTries >= 119)
                Debug.Log($"[ShowcaseGui] skill:{n} {fc.Active?.Id} → {got}(시도 {_skillTries + 1}) 모양 {fc.LastShape} · 선 효과 {Object.FindObjectsByType<Saga.Go.Combat.FieldLineFx>(FindObjectsSortMode.None).Length} · 정령 {Object.FindObjectsByType<Saga.Go.Combat.SkillSpirit>(FindObjectsSortMode.None).Length} · 장판 {fc.Zones.Count} · 갈래 끔 {Saga.Go.Combat.GoKits.OffForTest}"
                    + (got == -1 ? $" | 거절: 발 {pc?.OnFoot}({pc?.Mode}) 결투 {Saga.Go.Combat.DuelGate.Active} 낚시 {Saga.Go.World.FishingField.Busy} 쓰러짐 {fc.Active?.Down} 쿨 {fc.Active?.SkillCd:F1}" : ""));
            return got;
        }

        /// <summary>U-0091 사가천하 — 진단(PlaytestRealmEras·PlaytestRealmActors)이 쓰는 공개 함수만으로: 지도를 먼저 켜고(꺼진 지도는 Changed 를 안 듣는다)
        /// 아직 안 들인 시간 틈 사람 하나의 묻힌 성을 들여 그 성에서 수색(그 사람이 나올 때까지 달을 넘기며) → 결과 글을 토스트로,
        /// 새 달에 우리 첫 성에서 훈련(태수 칼 휘두름) → 지도 다시 짓기(태수·재야 배우). 상태는 촬영 프로세스 안에서만 — 세이브는 촬영 뒤 복원.</summary>
        private static void RealmEras()
        {
            if (!Saga.Realm.Data.RealmMapState.ViewingMap) Saga.Realm.Data.RealmMapState.Toggle();
            var roster = Saga.Realm.Data.RealmCityState.RosterIds;
            var t = Saga.Realm.Data.RealmEras.TimeOfficers.FirstOrDefault(x => !roster.Contains(x.Id));
            if (t.Id == null) { Skip("realmeras(시간 틈 사람 전원 합류)"); return; }
            string home = Saga.Realm.Data.RealmCityState.ActiveCityIds.FirstOrDefault(c => roster.Any(id => Saga.Realm.Data.RealmCityState.OfficerCityId(id) == c));
            var def = Saga.Realm.Data.RealmCityData.Get(t.CityId);
            if (!Saga.Realm.Data.RealmCityState.OwnsCity(t.CityId)) Saga.Realm.Data.RealmCityState.AbsorbCity(t.CityId, 40, 0, 0, 0);
            Saga.Realm.Data.RealmCityState.SetCurrentCity(t.CityId);
            string found = null;
            for (int i = 0; i < 24 && !Saga.Realm.Data.RealmCityState.FoundIds.Contains(t.Id); i++)
            {
                Saga.Realm.Data.RealmCityState.AddGold(200);
                var r = Saga.Realm.Data.RealmCityState.ExecuteOrder("search");
                Debug.Log($"[ShowcaseGui] realmeras 수색 {i + 1} — {r.Ok} {r.Message}");
                if (Saga.Realm.Data.RealmCityState.FoundIds.Contains(t.Id)) found = r.Message;
                else Saga.Realm.Data.RealmCityState.NextMonth();
            }
            Saga.Realm.Data.RealmCityState.NextMonth();
            if (home != null)
            {
                Saga.Realm.Data.RealmCityState.SetCurrentCity(home);
                Saga.Realm.Data.RealmCityState.AddGold(200);
                var tr = Saga.Realm.Data.RealmCityState.ExecuteOrder("train");
                Debug.Log($"[ShowcaseGui] realmeras 훈련 {home} — {tr.Ok} {tr.Message} · 태수 {Saga.Realm.Data.RealmActorPlan.GovernorOf(home)}");
            }
            Object.FindFirstObjectByType<Saga.Realm.World.RealmWorldMap>()?.Rebuild();
            if (found != null) Saga.Realm.UI.RealmToast.Instance?.Show(found, 60f);
            var plan = Saga.Realm.Data.RealmActorPlan.FromState();
            Debug.Log($"[ShowcaseGui] realmeras {t.Id}({t.Era}) 묻힌 성 {t.CityId}({def?.Name}) 찾음 {found != null} · 배우 {string.Join(", ", plan.Select(a => $"{a.Kind}:{a.OfficerId}@{a.CityId}/{a.Clip}"))} · 이름 {Saga.Realm.Data.RealmOfficerPool.Get(t.Id)?.Name}");
        }

        private static void Skip(string act) => Debug.Log($"[ShowcaseGui] act {act} SKIP(이 판에 없음)");

        private static void SetJoystick(Vector2 v)
        {
            var j = Object.FindFirstObjectByType<Saga.Core.VirtualJoystick>();
            var f = typeof(Saga.Core.VirtualJoystick).GetField("<Value>k__BackingField", BindingFlags.NonPublic | BindingFlags.Instance);
            if (j != null && f != null) f.SetValue(j, v);
        }

        private static void Teleport(Transform t, Vector3 p)
        {
            var cc = t.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            t.position = p;
            t.rotation = Quaternion.LookRotation(Vector3.forward);
            if (cc != null) cc.enabled = true;
        }

        /// <summary>사가나락 — 층 두목(`DungeonFloorRunner.SpawnSolo`)과 같은 몸(EliteModel)·색·크기 2·월드 보스로 주인공 앞 4m 에 세우고 다른 적은 끈다 → 첫 Tick 이 등장 컷을 연다.
        /// 러너·몸이 없는 PC 는 진단(PlaytestDungeonBossIntro)과 같은 더미로 되돌아간다(tasks U-0114).</summary>
        private static void DungeonBossIntro()
        {
            var pl = GameObject.FindWithTag("Player");
            foreach (var e in new List<Saga.Dungeon.World.DungeonEnemy>(Saga.Dungeon.World.DungeonEnemy.Active)) if (e != null) e.gameObject.SetActive(false);
            Saga.Dungeon.World.DungeonEnemy.ResetIntroSeenForTest();
            var pos = pl.transform.position + pl.transform.forward * 4f;
            var runner = Object.FindFirstObjectByType<Saga.Dungeon.World.DungeonFloorRunner>();
            var model = runner != null ? runner.EliteModel : null;
            Saga.Dungeon.World.DungeonEnemy boss;
            if (model != null)
            {
                var go = new GameObject("ShowcaseFloorBoss");
                go.SetActive(false);
                go.transform.position = pos;
                boss = go.AddComponent<Saga.Dungeon.World.DungeonEnemy>();
                boss.SetSpawnContext("showcase", model);
                boss.ConfigureCombat(500f, 0f, 0, 0, null, null, true, "황건적 두목", new Color(0.45f, 0.08f, 0.08f), 2f, true);
                go.SetActive(true);
            }
            else
            {
                Debug.Log("[ShowcaseGui] bossintro: elite model 없음 — 더미");
                var dummy = typeof(PlaytestDungeonBossIntro).GetMethod("Dummy", BindingFlags.NonPublic | BindingFlags.Static);
                boss = (Saga.Dungeon.World.DungeonEnemy)dummy.Invoke(null, new object[] { pos, "황건적 두목", true, true, 2f, false });
            }
            boss.Tick(0.01f);
        }

        private static Transform _approachBoss;   // U-0115 bossroom — 컷이 열릴 때까지 주인공을 이 두목 쪽으로 걸린다
        private static int _approachSteps;

        /// <summary>사가나락 — 다른 적을 끄고 러너가 진짜 두목 방을 짓게 한 뒤(`Enemy_Floor_Boss`·호위 둘), 주인공을 두목에서 방 안쪽으로 9m
        /// (방 경계 안에서 안 되면 되는 만큼, 최소 8.2m)에 두목을 보게 세운다. 컷은 게임이 연다 — `ApproachTick` 이 주인공을 두목 쪽으로 걸려
        /// aggroRadius 8m 안에 드는 순간 `DungeonEnemy` 가 스스로 달려듦·등장 컷(tasks U-0115).</summary>
        private static bool DungeonBossRoom()
        {
            var pl = GameObject.FindWithTag("Player");
            var runner = Object.FindFirstObjectByType<Saga.Dungeon.World.DungeonFloorRunner>();
            if (pl == null || runner == null) return false;
            foreach (var e in new List<Saga.Dungeon.World.DungeonEnemy>(Saga.Dungeon.World.DungeonEnemy.Active)) if (e != null) e.gameObject.SetActive(false);
            runner.BuildRoomForTest("boss");
            var boss = Saga.Dungeon.World.DungeonEnemy.Active.FirstOrDefault(e => e != null && e.gameObject.activeInHierarchy && e.name == "Enemy_Floor_Boss");
            if (boss == null) return false;
            var rt = runner.transform;
            Vector3 b = boss.transform.position;
            Vector3 dir = rt.position - b; dir.y = 0f;
            dir = dir.sqrMagnitude > 0.01f ? dir.normalized : -rt.right;
            float half = Saga.Dungeon.World.DungeonRoomBuilder.RoomWidth * 0.5f - 0.8f;   // 방 20×20 — 벽 안쪽 0.8m 여유
            bool Inside(Vector3 q) { var l = rt.InverseTransformPoint(q); return Mathf.Abs(l.x) <= half && Mathf.Abs(l.z) <= half; }
            float dist = 9f;
            while (dist > 8.2f && !Inside(b + dir * dist)) dist -= 0.1f;
            Vector3 p = b + dir * dist; p.y = b.y;
            Teleport(pl.transform, p);
            pl.transform.rotation = Quaternion.LookRotation(-dir, Vector3.up);
            Saga.Dungeon.World.DungeonEnemy.ResetIntroSeenForTest();
            _approachBoss = boss.transform; _approachSteps = 0;
            Debug.Log($"[ShowcaseGui] bossroom 두목 {b} · 주인공 {p} · {dist:0.0}m · 호위 {Saga.Dungeon.World.DungeonEnemy.Active.Count(e => e != null && e.gameObject.activeInHierarchy) - 1}");
            return true;
        }

        /// <summary>U-0115 — 컷이 열릴 때까지 한 틱 0.06m 씩 두목 쪽으로(CharacterController.Move). 열리면 멈추고 그때 거리를 남긴다.</summary>
        private static void ApproachTick()
        {
            var pl = GameObject.FindWithTag("Player");
            if (pl == null) { _approachBoss = null; return; }
            Vector3 d = _approachBoss.position - pl.transform.position; d.y = 0f;
            if (Saga.Dungeon.Cinematics.DungeonCutscenes.Playing || ++_approachSteps > 400)
            {
                Debug.Log($"[ShowcaseGui] bossroom {(Saga.Dungeon.Cinematics.DungeonCutscenes.Playing ? "컷 열림" : "컷 안 열림(시간 초과)")} — 두목까지 {d.magnitude:0.00}m · {_approachSteps}틱");
                _approachBoss = null;
                return;
            }
            var cc = pl.GetComponent<CharacterController>();
            Vector3 step = d.normalized * 0.06f;
            if (cc != null && cc.enabled) cc.Move(step); else pl.transform.position += step;
            pl.transform.rotation = Quaternion.LookRotation(d.normalized, Vector3.up);
        }

        /// <summary>사가종횡 — 진단(PlaytestStoryBossIntro)처럼 두목 6m 앞으로 옮겨 CheckIntro.</summary>
        private static void StoryBossIntro()
        {
            var pl = GameObject.FindWithTag("Player");
            var boss = Saga.Story.World.StoryEnemy.All.FirstOrDefault(e => e != null && e.IsBoss);
            if (pl == null || boss == null) { Skip("bossintro"); return; }
            Teleport(pl.transform, new Vector3(boss.transform.position.x - 6f, pl.transform.position.y, 0f));
            pl.transform.rotation = Quaternion.LookRotation(Vector3.right);
            boss.CheckIntro();
        }

        private static Texture2D ShootTex(Camera template, Vector3 pos, Quaternion rot)
        {
            var go = new GameObject("ShowcaseCam");
            var cam = go.AddComponent<Camera>();
            cam.CopyFrom(template);
            cam.transform.SetPositionAndRotation(pos, rot);
            if (template == Camera.main && _seqTargets != null) { cam.fieldOfView = template.fieldOfView; }
            var rt = new RenderTexture(CellW, CellH, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(CellW, CellH, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, CellW, CellH), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            cam.targetTexture = null; rt.Release(); Object.DestroyImmediate(rt); Object.DestroyImmediate(go);
            return tex;
        }

        private static void WriteSheet(string name, List<Texture2D> frames)
        {
            if (frames.Count == 0) { Debug.Log($"[ShowcaseGui] seq {name} 0장"); return; }
            int rows = (frames.Count + SheetCols - 1) / SheetCols;
            var sheet = new Texture2D(CellW * SheetCols, CellH * rows, TextureFormat.RGB24, false);
            var black = Enumerable.Repeat(Color.black, sheet.width * sheet.height).ToArray();
            sheet.SetPixels(black);
            for (int i = 0; i < frames.Count; i++)
            {
                int cx = (i % SheetCols) * CellW, cy = (rows - 1 - i / SheetCols) * CellH;   // 위 왼쪽부터 읽는 순서
                sheet.SetPixels(cx, cy, CellW, CellH, frames[i].GetPixels());
                DrawNumber(sheet, cx + 8, cy + CellH - 8, i + 1);
                Object.DestroyImmediate(frames[i]);
            }
            sheet.Apply();
            File.WriteAllBytes(_dir + name + "_seq.png", sheet.EncodeToPNG());
            Object.DestroyImmediate(sheet);
        }

        // 3×5 숫자 글꼴(비트 위→아래), 칸 왼쪽 위에 6배로
        private static readonly string[] Digits = { "111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111" };

        private static void DrawNumber(Texture2D tex, int x, int yTop, int n)
        {
            string s = n.ToString();
            const int k = 6;
            for (int bx = x - 3; bx < x + s.Length * 4 * k + 3; bx++)
                for (int by = yTop - 5 * k - 3; by < yTop + 3; by++) tex.SetPixel(bx, by, Color.black);
            for (int c = 0; c < s.Length; c++)
            {
                var bits = Digits[s[c] - '0'];
                for (int r = 0; r < 5; r++)
                    for (int col = 0; col < 3; col++)
                        if (bits[r * 3 + col] == '1')
                            for (int dx = 0; dx < k; dx++)
                                for (int dy = 0; dy < k; dy++)
                                    tex.SetPixel(x + c * 4 * k + col * k + dx, yTop - r * k - dy, Color.white);
            }
        }
    }
}
