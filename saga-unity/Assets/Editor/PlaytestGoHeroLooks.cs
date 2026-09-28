using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;
using Gear = Saga.Go.Data.GoHeroLooks.Gear;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-7 "몸 배정" 진단 — `PlaytestHeadless` 가 도감 화면 진단 뒤에 부른다.
    /// 표(105 모두 겉모습·몸 열일곱 중 열여섯 이상 씀·여자 인물 = 여자 몸·손으로 박은 근대 인물 = 양복·한 몸 최대 인원·
    /// **같은 몸 두 사람은 모양 다섯 축 중 둘 이상 다름**·투구·두건 몸엔 머리 꾸밈 없음·꾸밈 종류 고루) ·
    /// 몸 105 벌을 실제로 만들어 입혀 보기(표의 몸 프리팹·키 = 3.4m × 칸 배율 ±4%·몸 너비 배율·꾸밈 수·등 무기는 가슴 뒤·
    /// 허리 소품은 엉덩이 뒤 오른쪽·모자는 머리 위·안경은 얼굴 앞·꾸밈이 몸에서 날아가지 않음) ·
    /// 동행 교체(표의 몸 + 꾸밈이 뼈를 따라 걷는 동안 붙어 있음 → 주인공으로 되돌림) · 들판에 선 인물·겨루기 상대도 같은 꾸밈.
    /// 몸이 없는 PC(로컬 전용)는 표 검사만 하고 경고.
    /// </summary>
    public static class PlaytestGoHeroLooks
    {
        private const float Dt = 0.02f;
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            string table = CheckTable();
            var fc = FieldCombat.Instance;
            var bodies = fc != null ? fc.GetComponent<PartyBodies>() : null;
            if (bodies == null) { Fail("플레이어에 PartyBodies 가 없음"); return false; }
            string made = CheckAllDressed(bodies);
            string swap = CheckSwap(fc, bodies);
            string field = CheckField(bodies);
            if (_ok) Debug.Log($"[{_tag}] hero looks OK - {table} | {made} | {swap} | {field}");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] hero looks: {msg}");
            _ok = false;
        }

        // ---- 표 ------------------------------------------------------------------

        private static string CheckTable()
        {
            var looks = GoHeroLooks.All.ToList();
            if (looks.Count != GoHeroes.All.Length) Fail($"겉모습 {looks.Count} ≠ 인물 {GoHeroes.All.Length}");
            var byBody = new Dictionary<string, List<GoHeroLooks.Look>>();
            var gearUse = new Dictionary<Gear, int>();
            foreach (var l in looks)
            {
                var body = GoHeroLooks.BodyNamed(l.Body);
                if (body == null) { Fail($"{l.HeroId} 몸 {l.Body} 이 표에 없음"); continue; }
                if (body.Female != GoHeroLooks.IsFemale(l.HeroId)) Fail($"{l.HeroId} 성별과 몸 {l.Body} 이 안 맞음");
                if (GoHeroLooks.BodyOverride.TryGetValue(l.HeroId, out var forced) && forced != l.Body) Fail($"{l.HeroId} 손으로 박은 몸 {forced} ≠ {l.Body}");
                if (body.Covered && l.Head != Gear.None) Fail($"{l.HeroId} 투구·두건 몸 {l.Body} 에 머리 꾸밈 {l.Head}");
                if (body.JapanOnly && GoHeroes.TryGet(l.HeroId, out var h) && h.Era != HeroEra.Japan) Fail($"{l.HeroId} 일본사 전용 몸 {l.Body}");
                if (l.Back != Gear.None && !GoHeroLooks.IsBack(l.Back)) Fail($"{l.HeroId} 등 칸에 {l.Back}");
                if (l.Hip != Gear.None && !GoHeroLooks.IsHip(l.Hip)) Fail($"{l.HeroId} 허리 칸에 {l.Hip}");
                if (l.Head != Gear.None && !GoHeroLooks.IsHead(l.Head)) Fail($"{l.HeroId} 머리 칸에 {l.Head}");
                if (!byBody.TryGetValue(l.Body, out var list)) byBody[l.Body] = list = new List<GoHeroLooks.Look>();
                list.Add(l);
                foreach (var g in new[] { l.Back, l.Hip, l.Head })
                    if (g != Gear.None) { gearUse.TryGetValue(g, out int n); gearUse[g] = n + 1; }
            }
            if (byBody.Count < GoHeroLooks.Bodies.Length - 1) Fail($"쓰인 몸 {byBody.Count} < {GoHeroLooks.Bodies.Length - 1}");
            int worst = int.MaxValue, maxOnBody = 0;
            foreach (var kv in byBody)
            {
                maxOnBody = Mathf.Max(maxOnBody, kv.Value.Count);
                for (int i = 0; i < kv.Value.Count; i++)
                    for (int j = i + 1; j < kv.Value.Count; j++)
                    {
                        int d = GoHeroLooks.ShapeDiff(kv.Value[i], kv.Value[j]);
                        worst = Mathf.Min(worst, d);
                        if (d < GoHeroLooks.MinShapeDiff) Fail($"같은 몸 {kv.Key} 의 {kv.Value[i].HeroId}·{kv.Value[j].HeroId} 모양 차 {d} 축");
                    }
            }
            if (maxOnBody > 10) Fail($"한 몸에 {maxOnBody}명(>10)");
            foreach (var g in GoHeroLooks.AllGear)
                if (!gearUse.ContainsKey(g)) Fail($"꾸밈 {g} 을 아무도 안 씀");
            int bare = looks.Count(l => l.Back == Gear.None && l.Hip == Gear.None && l.Head == Gear.None);
            if (bare > looks.Count / 5) Fail($"꾸밈 없는 인물 {bare}명(>1/5)");
            // 한 사람 = 몸 + 다섯 축이 105 모두 다르다(위 쌍 검사의 결과이지만 따로 셈을 남긴다)
            int unique = looks.Select(l => $"{l.Body}|{l.Height}|{l.Build}|{l.Back}|{l.Hip}|{l.Head}").Distinct().Count();
            if (unique != looks.Count) Fail($"겉모습 겹침 — 다른 모습 {unique}/{looks.Count}");
            string dist = string.Join(" ", byBody.OrderByDescending(kv => kv.Value.Count).Select(kv => $"{kv.Key}{kv.Value.Count}"));
            Debug.Log($"[{_tag}] hero looks table: " + string.Join(" / ", byBody.Select(kv => kv.Key + ": " +
                string.Join(", ", kv.Value.Select(x => $"{x.HeroId}[{x.Height}{x.Build} {x.Back} {x.Hip} {x.Head}]")))));
            return $"표 105 몸 {byBody.Count}({dist}) 같은 몸 최소 차 {worst}축 꾸밈 없음 {bare} 모습 {unique}";
        }

        // ---- 몸 105 벌 ----------------------------------------------------------

        private static string CheckAllDressed(PartyBodies bodies)
        {
            var root = new GameObject("HeroLooksProbe").transform;
            root.position = new Vector3(0f, -500f, 0f);
            int made = 0, missing = 0, gearCount = 0, ownBodies = 0;
            float worstH = 0f;
            try
            {
                foreach (var l in GoHeroLooks.All)
                {
                    // char-forge 제 몸 — 레시피 키(1.75m 에 대한 비) 그대로·체격 배율 없음·머리 꾸밈 없음
                    var forge = PartyBodies.ForgeHero(l.HeroId);
                    if (forge != null)
                    {
                        if (bodies.PrefabFor(l.HeroId) != forge) Fail($"{l.HeroId} PrefabFor 가 제 몸이 아님");
                        var fi = Object.Instantiate(forge, root);
                        fi.transform.localPosition = Vector3.zero;
                        fi.transform.localRotation = Quaternion.identity;
                        float own = HeroDresser.MeasureHeight(fi);
                        bodies.Dress(fi, l.HeroId, CharacterVisual.HumanHeight);
                        float fwant = CharacterVisual.HumanHeight * own / HeroDresser.RealHuman;
                        float fh = HeroDresser.MeasureHeight(BodyOnly(fi));
                        worstH = Mathf.Max(worstH, Mathf.Abs(fh / fwant - 1f));
                        if (Mathf.Abs(fh / fwant - 1f) > 0.04f) Fail($"{l.HeroId}(제 몸) 키 {fh:F2} ≠ {fwant:F2}");
                        if (own < 1.3f || own > 2.3f) Fail($"{l.HeroId}(제 몸) 프리팹 키 {own:F2}m 가 사람 키가 아님");
                        var lf = l;
                        lf.Head = Gear.None;
                        gearCount += CheckGear(fi, lf, fwant);
                        Object.DestroyImmediate(fi);
                        made++;
                        ownBodies++;
                        continue;
                    }
                    var prefab = bodies.LookBody(l.Body);
                    if (prefab == null) { missing++; continue; }
                    if (bodies.PrefabFor(l.HeroId) != prefab) Fail($"{l.HeroId} PrefabFor 가 표의 몸 {l.Body} 이 아님");
                    var inst = Object.Instantiate(prefab, root);
                    inst.transform.localPosition = Vector3.zero;
                    inst.transform.localRotation = Quaternion.identity;
                    Vector3 s0 = inst.transform.localScale;
                    float ratio0 = s0.x / s0.y;
                    bodies.Dress(inst, l.HeroId, CharacterVisual.HumanHeight);
                    float want = CharacterVisual.HumanHeight * l.HeightScale;
                    float h = HeroDresser.MeasureHeight(BodyOnly(inst));
                    worstH = Mathf.Max(worstH, Mathf.Abs(h / want - 1f));
                    if (Mathf.Abs(h / want - 1f) > 0.04f) Fail($"{l.HeroId}({l.Body}) 키 {h:F2} ≠ {want:F2}");
                    var s = inst.transform.localScale;
                    if (Mathf.Abs(s.x / s.y / ratio0 - l.WidthScale) > 0.01f || Mathf.Abs(s.z / s.y - s.x / s.y) > 0.01f)
                        Fail($"{l.HeroId} 몸 너비 배율 {s.x / s.y / ratio0:F2} ≠ {l.WidthScale:F2}");
                    gearCount += CheckGear(inst, l, want);
                    Object.DestroyImmediate(inst);
                    made++;
                }
            }
            finally
            {
                Object.DestroyImmediate(root.gameObject);
            }
            if (missing > 0) Debug.LogWarning($"[{_tag}] hero looks: 이 PC 에 몸 프리팹이 없는 인물 {missing}명(로컬 전용 — Saga/Setup NPC Character Imports)");
            if (made == 0) return "몸 없음(표만 확인)";
            return $"입혀 봄 {made}(제 몸 {ownBodies} · 없음 {missing}) 꾸밈 {gearCount} 키 오차 ≤{worstH * 100f:F1}%";
        }

        /// <summary>꾸밈을 뺀 몸만 — 키는 살만 잰다(모자가 키를 늘리지 않게).</summary>
        private static GameObject BodyOnly(GameObject inst)
        {
            foreach (Transform t in inst.GetComponentsInChildren<Transform>(true))
                if (t.name.StartsWith(HeroDresser.GearPrefix)) t.gameObject.SetActive(false);
            return inst;
        }

        private static Bounds RendererBounds(Transform t, bool includeInactive)
        {
            var rs = t.GetComponentsInChildren<Renderer>(includeInactive);
            var b = rs.Length > 0 ? rs[0].bounds : new Bounds(t.position, Vector3.zero);
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b;
        }

        /// <summary>꾸밈 자리 — 루트가 제자리·정면(+Z)이라 월드 축으로 잰다. 돌려준 값 = 붙은 꾸밈 수.</summary>
        private static int CheckGear(GameObject inst, GoHeroLooks.Look l, float H)
        {
            var gear = new Dictionary<string, Transform>();
            foreach (Transform t in inst.GetComponentsInChildren<Transform>(true))
                if (t.name.StartsWith(HeroDresser.GearPrefix)) gear[t.name.Substring(HeroDresser.GearPrefix.Length)] = t;
            foreach (var t in gear.Values) t.gameObject.SetActive(true);
            var body = ExcludeGear(inst, gear.Values);
            var anim = inst.GetComponentInChildren<Animator>();
            Vector3 fwd = inst.transform.forward, right = inst.transform.right;
            int want = 0;
            foreach (var g in new[] { l.Back, l.Hip, l.Head })
            {
                if (g == Gear.None) continue;
                want++;
                if (!gear.TryGetValue(g.ToString(), out var t)) { Fail($"{l.HeroId} 꾸밈 {g} 이 안 붙음"); continue; }
                var b = RendererBounds(t, true);
                var grown = body; grown.Expand(0.5f * H);
                if (!grown.Contains(b.center)) Fail($"{l.HeroId} 꾸밈 {g} 이 몸에서 떨어짐({b.center - body.center})");
                if (b.size.magnitude < 0.02f * H) Fail($"{l.HeroId} 꾸밈 {g} 이 너무 작음({b.size.magnitude:F3})");
                if (GoHeroLooks.IsBack(g))
                {
                    var chest = anim.GetBoneTransform(HumanBodyBones.UpperChest) ?? anim.GetBoneTransform(HumanBodyBones.Chest);
                    if (chest != null && Vector3.Dot(b.center - chest.position, fwd) > -0.02f * H) Fail($"{l.HeroId} 등 꾸밈 {g} 이 가슴 뒤가 아님({Vector3.Dot(b.center - chest.position, fwd):F2})");
                    if (t.parent == null || !IsUnder(t, anim.GetBoneTransform(HumanBodyBones.Spine))) Fail($"{l.HeroId} 등 꾸밈이 등뼈에 안 붙음");
                }
                else if (GoHeroLooks.IsHip(g))
                {
                    var hips = anim.GetBoneTransform(HumanBodyBones.Hips);
                    var d = b.center - hips.position;
                    if (Vector3.Dot(d, fwd) > 0f || Vector3.Dot(d, right) < 0f) Fail($"{l.HeroId} 허리 꾸밈 {g} 이 오른쪽 뒤가 아님({d})");
                    if (Mathf.Abs(d.y) > 0.12f * H) Fail($"{l.HeroId} 허리 꾸밈 {g} 높이가 엉덩이에서 멂({d.y:F2})");
                }
                else
                {
                    var head = anim.GetBoneTransform(HumanBodyBones.Head);
                    if (t.parent != head) Fail($"{l.HeroId} 머리 꾸밈이 머리 뼈에 안 붙음");
                    if (g == Gear.Hat && b.center.y < head.position.y + 0.05f * H) Fail($"{l.HeroId} 모자가 머리 위가 아님({b.center.y - head.position.y:F2})");
                    if (g == Gear.Spectacles && Vector3.Dot(b.max - head.position, fwd) < 0.02f * H) Fail($"{l.HeroId} 안경이 얼굴 앞이 아님");
                    if (g == Gear.Spectacles && Mathf.Abs(b.center.x - head.position.x) > 0.02f * H) Fail($"{l.HeroId} 안경이 얼굴 가운데가 아님");
                }
            }
            if (gear.Count != want) Fail($"{l.HeroId} 꾸밈 {gear.Count} ≠ {want}");
            return gear.Count;
        }

        private static Bounds ExcludeGear(GameObject inst, IEnumerable<Transform> gear)
        {
            var skip = new HashSet<Renderer>();
            foreach (var t in gear) foreach (var r in t.GetComponentsInChildren<Renderer>(true)) skip.Add(r);
            Bounds? b = null;
            foreach (var r in inst.GetComponentsInChildren<Renderer>())
            {
                if (skip.Contains(r)) continue;
                if (b == null) b = r.bounds; else { var x = b.Value; x.Encapsulate(r.bounds); b = x; }
            }
            return b ?? new Bounds(inst.transform.position, Vector3.zero);
        }

        private static bool IsUnder(Transform t, Transform ancestor)
        {
            if (ancestor == null) return true;
            for (var p = t.parent; p != null; p = p.parent) if (p == ancestor) return true;
            return false;
        }

        /// <summary>붙어야 할 꾸밈 수 — char-forge 제 몸은 머리 꾸밈을 안 씌운다(<see cref="HeroDresser.DressOwn"/>).</summary>
        private static int WantGear(GoHeroLooks.Look l) =>
            (l.Back != Gear.None ? 1 : 0) + (l.Hip != Gear.None ? 1 : 0) + (l.Head != Gear.None && PartyBodies.ForgeHero(l.HeroId) == null ? 1 : 0);

        // ---- 동행 교체 ----------------------------------------------------------

        private static string CheckSwap(FieldCombat fc, PartyBodies bodies)
        {
            var pc = fc.GetComponent<PlayerController>();
            var l = GoHeroLooks.All.FirstOrDefault(x => x.Back != Gear.None && x.Head != Gear.None && bodies.LookBody(x.Body) != null);
            if (l.HeroId == null) return "교체 건너뜀(몸 없음)";
            var hero = bodies.HeroVisual;
            try
            {
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                if (!bodies.Show(l.HeroId)) { Fail($"{l.HeroId} 몸이 안 보임"); return ""; }
                var body = pc.Visual;
                if (body == hero) { Fail("교체했는데 주인공 몸"); return ""; }
                int n = body.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith(HeroDresser.GearPrefix));
                if (n != WantGear(l)) Fail($"동행 몸 꾸밈 {n} ≠ {WantGear(l)}");
                var anim = pc.Animator;
                var backGear = body.GetComponentsInChildren<Transform>(true).First(t => t.name == HeroDresser.GearPrefix + l.Back);
                var chest = anim.GetBoneTransform(HumanBodyBones.UpperChest) ?? anim.GetBoneTransform(HumanBodyBones.Chest);
                float before = Vector3.Distance(backGear.position, chest.position);
                pc.SetTestInput(new Vector2(0f, 1f), false);
                for (int i = 0; i < 30; i++) pc.Step(Dt);
                pc.ClearTestInput();
                float after = Vector3.Distance(backGear.position, chest.position);
                if (Mathf.Abs(after - before) > 0.02f * CharacterVisual.HumanHeight) Fail($"걷는 동안 등 꾸밈이 가슴에서 벌어짐({before:F2} → {after:F2})");
                return $"교체 {l.HeroId}({l.Body}) 꾸밈 {n} 걷기 뒤 등 거리 {before:F2}→{after:F2}";
            }
            finally
            {
                bodies.Show(PartyBodies.HeroId);
                pc.ClearTestInput();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                if (pc.Visual != hero) Fail("진단 뒤 주인공 몸으로 안 돌아옴");
            }
        }

        // ---- 들판 ---------------------------------------------------------------

        private static string CheckField(PartyBodies bodies)
        {
            var heroes = FieldHeroes.Instance;
            if (heroes == null) { Fail("FieldHeroes 없음"); return ""; }
            int idleDressed = 0;
            foreach (var s in heroes.Slots)
            {
                if (s.Idle == null || !GoHeroLooks.TryGet(s.HeroId, out var l) || bodies.LookBody(l.Body) == null) continue;
                int want = WantGear(l);
                int n = s.Idle.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith(HeroDresser.GearPrefix));
                if (n != want) Fail($"들판에 선 {s.HeroId} 꾸밈 {n} ≠ {want}");
                else idleDressed++;
            }
            // 겨루기 상대 — 같은 몸·같은 꾸밈
            var la = GoHeroLooks.All.FirstOrDefault(x => x.Back != Gear.None && bodies.LookBody(x.Body) != null);
            if (la.HeroId == null || !GoHeroes.TryGet(la.HeroId, out var hero)) return $"선 인물 {idleDressed}";
            var e = FieldEnemy.SpawnHero(hero, new Vector3(0f, -500f, 0f), bodies.PrefabFor(hero.Id), bodies.BodyController, null, bodies);
            try
            {
                int n = e.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith(HeroDresser.GearPrefix));
                int want = WantGear(la);
                if (n != want) Fail($"겨루기 상대 {hero.Id} 꾸밈 {n} ≠ {want}");
                return $"선 인물 {idleDressed} · 겨루기 상대 꾸밈 {n}";
            }
            finally
            {
                Object.DestroyImmediate(e.gameObject);
            }
        }
    }
}
