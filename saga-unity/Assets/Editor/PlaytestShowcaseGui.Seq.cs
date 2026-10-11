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
    /// `gesture`(동료 환호) · `worldmap`(사가천하 지도 열기) · `party`·`party2`(모양별 동료 편성 — 스킬 진단과 같은 동료). `realmeras`(U-0091 사가천하 — 시간 틈 사람 묻힌 성 들여 수색·훈련·지도 켬). 대상 `screen` = 화면 그대로 첫·끝 장(오버레이 UI 포함). 판에 없는 동작은 로그에 SKIP. 여러 개는 `+` 로(`walk+attack`).
    /// </summary>
    public static partial class PlaytestShowcaseGui
    {
        private const int CellW = 640, CellH = 360, SheetCols = 4;
        private static int _seqN, _seqGap, _seqTaken, _seqNextAt;
        private static List<(string name, Transform target)> _seqTargets;
        private static List<List<Texture2D>> _seqFrames;
        private static bool _seqWalk;
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
            _seqWalk = false;
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
            if (_skillRetry >= 0)
            {
                if (TrySkill(_skillRetry) == -1 && ++_skillTries < 120) { _seqNextAt = _frame + 2; return false; }
                _skillRetry = -1;
                _seqNextAt = _frame + 1;
            }
            if (_frame < _seqNextAt) return false;
            var main = Camera.main;
            for (int i = 0; i < _seqTargets.Count; i++)
            {
                var (name, t) = _seqTargets[i];
                Vector3 pos; Quaternion rot;
                if (t == null) { var c = GameCam(); if (c == null) continue; pos = c.transform.position; rot = c.transform.rotation; _seqFrames[i].Add(ShootTex(c, pos, rot)); continue; }
                if (main == null) continue;
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
                    case "gesture":
                        if (!Saga.Dungeon.Data.GestureState.Start(Saga.Dungeon.Data.GestureState.AllyKey, Saga.Dungeon.Data.GestureState.Kind.Cheer, Time.time)) { Skip(act); return; }
                        break;
                    case "worldmap":
                        if (!Saga.Realm.Data.RealmMapState.ViewingMap) Saga.Realm.Data.RealmMapState.Toggle();
                        break;
                    case "realmeras":
                        if (Object.FindFirstObjectByType<Saga.Realm.World.RealmMapViewSwitcher>() == null) { Skip(act); return; }
                        RealmEras();
                        break;
                    default: Skip(act); return;
                }
                Debug.Log($"[ShowcaseGui] act {act}");
            }
            catch (System.Exception e) { Debug.Log($"[ShowcaseGui] act {act} SKIP — {e.GetType().Name}: {e.Message}"); }
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

        /// <summary>사가나락 — 진단(PlaytestDungeonBossIntro)과 같은 두목 더미를 주인공 앞 4m 에 세우고 다른 적은 끈다 → 첫 Tick 이 등장 컷을 연다.</summary>
        private static void DungeonBossIntro()
        {
            var pl = GameObject.FindWithTag("Player");
            foreach (var e in new List<Saga.Dungeon.World.DungeonEnemy>(Saga.Dungeon.World.DungeonEnemy.Active)) if (e != null) e.gameObject.SetActive(false);
            Saga.Dungeon.World.DungeonEnemy.ResetIntroSeenForTest();
            var dummy = typeof(PlaytestDungeonBossIntro).GetMethod("Dummy", BindingFlags.NonPublic | BindingFlags.Static);
            var boss = (Saga.Dungeon.World.DungeonEnemy)dummy.Invoke(null, new object[] { pl.transform.position + pl.transform.forward * 4f, "황건적 두목", true, true, 2f, false });
            boss.Tick(0.01f);
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
