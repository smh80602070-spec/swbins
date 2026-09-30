using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-1b "새 원소 괴물 넷"(웹 회오리매·눈여우·바위곰·덩굴뱀) — `PlaytestHeadless` 가 고원 진단 뒤에 부른다.
    /// 표(이름·원소·체력·공격·방패) · 옛 원소 적 + 새 원소 덧씌움 → 제 괴물로 옮김 · 몸(있으면 리타깃 컨트롤러와 트리거 셋) ·
    /// 인물 졸개(풍·빙·암·초 → 제 괴물) · 고원 무리. 세운 적은 다 치운다(경험·세이브는 안 건드린다).
    /// </summary>
    public static class PlaytestGoBeasts
    {
        private static string _tag;
        private static bool _ok;

        private struct Row { public FieldEnemy.Kind Kind; public string Name; public GoElement El; public float Hp, Atk, Shield; }
        private static readonly Row[] Table =
        {
            new Row { Kind = FieldEnemy.Kind.WindHawk, Name = "회오리매", El = GoElement.Anemo, Hp = 200f, Atk = 22f, Shield = 140f },
            new Row { Kind = FieldEnemy.Kind.IceFox, Name = "눈여우", El = GoElement.Cryo, Hp = 240f, Atk = 24f, Shield = 170f },
            new Row { Kind = FieldEnemy.Kind.RockBear, Name = "바위곰", El = GoElement.Geo, Hp = 380f, Atk = 33f, Shield = 230f },
            new Row { Kind = FieldEnemy.Kind.GrassSnake, Name = "덩굴뱀", El = GoElement.Dendro, Hp = 250f, Atk = 22f, Shield = 160f },
        };

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var spawner = Object.FindFirstObjectByType<FieldSpawner>();
            if (fc == null || spawner == null) { Fail("FieldCombat/FieldSpawner 없음"); return false; }
            var made = new List<FieldEnemy>();
            var parts = new List<string>();
            try
            {
                CheckMapping();
                CheckTable(spawner, made, parts);
                CheckStandIns(spawner, made);
                CheckHeroMinions(spawner, made);
                CheckFrostWild();
            }
            finally
            {
                foreach (var e in made) if (e != null) Object.DestroyImmediate(e.gameObject);
            }
            if (_ok) Debug.Log($"[{_tag}] beasts OK - 새 원소 괴물 4(표·이름·원소·체력·공격·방패)·옛 적 + 새 원소 → 제 괴물·인물 졸개 제 괴물·고원 무리 제 괴물 · 몸 {string.Join(" ", parts)}");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] beasts: {msg}");
            _ok = false;
        }

        private static void CheckMapping()
        {
            var to = new (FieldEnemy.Kind from, GoElement over, FieldEnemy.Kind want)[]
            {
                (FieldEnemy.Kind.DrownedGhost, GoElement.Cryo, FieldEnemy.Kind.IceFox),
                (FieldEnemy.Kind.StormWraith, GoElement.Anemo, FieldEnemy.Kind.WindHawk),
                (FieldEnemy.Kind.EmberImp, GoElement.Geo, FieldEnemy.Kind.RockBear),
                (FieldEnemy.Kind.DrownedGhost, GoElement.Dendro, FieldEnemy.Kind.GrassSnake),
                (FieldEnemy.Kind.DrownedGhost, GoElement.Physical, FieldEnemy.Kind.DrownedGhost),
                (FieldEnemy.Kind.StormWraith, GoElement.Electro, FieldEnemy.Kind.StormWraith),
                (FieldEnemy.Kind.Bandit, GoElement.Cryo, FieldEnemy.Kind.Bandit),
                (FieldEnemy.Kind.Skeleton, GoElement.Geo, FieldEnemy.Kind.Skeleton),
            };
            foreach (var t in to)
                if (FieldEnemy.BeastFor(t.from, t.over) != t.want) Fail($"BeastFor({t.from},{t.over}) = {FieldEnemy.BeastFor(t.from, t.over)} ≠ {t.want}");
            foreach (var k in FieldEnemy.BeastKinds) if (!FieldEnemy.IsBeastKind(k)) Fail($"{k} 가 괴물이 아님");
            if (FieldEnemy.IsBeastKind(FieldEnemy.Kind.Hero) || FieldEnemy.IsBeastKind(FieldEnemy.Kind.Bandit)) Fail("괴물이 아닌 종류가 괴물");
        }

        private static FieldEnemy Make(FieldSpawner sp, List<FieldEnemy> made, FieldEnemy.Kind kind, GoElement over = GoElement.Physical)
        {
            var e = FieldEnemy.Spawn(kind, Vector3.up * 400f, null, "test_beast", sp.transform, GoEra.Past, null, over);
            made.Add(e);
            return e;
        }

        private static void CheckTable(FieldSpawner sp, List<FieldEnemy> made, List<string> parts)
        {
            foreach (var r in Table)
            {
                var e = Make(sp, made, r.Kind);
                float hm = GoAdventure.HpMul(e.WorldLevel), am = GoAdventure.AtkMul(e.WorldLevel);
                if (e.EnemyKind != r.Kind || e.DisplayName != r.Name) Fail($"{r.Kind} 이름 {e.DisplayName} ≠ {r.Name}");
                if (e.Element != r.El) Fail($"{r.Name} 원소 {e.Element} ≠ {r.El}");
                if (Mathf.Abs(e.MaxHp - r.Hp * hm) > 0.5f) Fail($"{r.Name} 체력 {e.MaxHp} ≠ {r.Hp * hm}");
                if (Mathf.Abs(e.Atk - r.Atk * am) > 0.05f) Fail($"{r.Name} 공격 {e.Atk} ≠ {r.Atk * am}");
                if (Mathf.Abs(e.ShieldMax - r.Shield * hm) > 0.5f) Fail($"{r.Name} 방패 {e.ShieldMax} ≠ {r.Shield * hm}");
                if (!e.Shielded) Fail($"{r.Name} 방패 없이 섬");
                if (!e.IsElemental) Fail($"{r.Name} 원소 적이 아님");
                if (e.BodyTop < 0.5f) Fail($"{r.Name} 몸 높이 {e.BodyTop}");

                var vis = e.transform.Find("Visual");
                var model = FieldEnemy.BeastModel(r.Kind);
                if (model == null) { parts.Add($"{r.Kind}=폴백"); continue; }
                if (vis == null) { Fail($"{r.Name} 몸(Visual)이 없음"); continue; }
                var an = vis.GetComponentInChildren<Animator>();
                if (an == null) { Fail($"{r.Name} Animator 없음"); continue; }
                if (an.isHuman)
                {
                    if (an.runtimeAnimatorController == null || an.runtimeAnimatorController.name != "Skeleton") Fail($"{r.Name} 컨트롤러 {(an.runtimeAnimatorController != null ? an.runtimeAnimatorController.name : "없음")} ≠ Skeleton(리타깃)");
                    var names = new HashSet<string>();
                    foreach (var p in an.parameters) names.Add(p.name);
                    foreach (var need in new[] { "Speed", "Attack", "Hit", "Death" }) if (!names.Contains(need)) Fail($"{r.Name} 컨트롤러에 {need} 없음");
                    parts.Add($"{r.Kind}=리타깃");
                }
                else
                {
                    // 저폴리 동물(Quaternius CC0, `Art/Creatures`) — 사람 키가 아니라 몸 길이로 크기를 맞추고 제 컨트롤러를 쓴다(뱀은 피격·쓰러짐 클립이 없다)
                    if (!e.IsAnimalBody) Fail($"{r.Name} 동물 몸인데 크기를 길이로 안 맞춤");
                    if (an.runtimeAnimatorController == null) { Fail($"{r.Name} 컨트롤러 없음"); continue; }
                    var names = new HashSet<string>();
                    foreach (var p in an.parameters) names.Add(p.name);
                    foreach (var need in new[] { "Speed", "Attack" }) if (!names.Contains(need)) Fail($"{r.Name} 컨트롤러에 {need} 없음");
                    if (e.BodyTop < 0.8f || e.BodyTop > 4f) Fail($"{r.Name} 동물 몸 높이 {e.BodyTop:F2}");
                    // 컨트롤러가 실제로 도는지 — Speed 0.3 → 걷기, 공격 트리거 → 공격 상태(손으로 애니메이터를 굴린다)
                    an.Rebind();
                    an.Update(0f);
                    an.SetFloat("Speed", 0.3f);
                    Run(an, 1f);
                    if (!an.GetCurrentAnimatorStateInfo(0).IsName("Walk")) Fail($"{r.Name} Speed 0.3 인데 걷기가 아님 ({StateNow(an)})");
                    an.SetFloat("Speed", 0f);
                    Run(an, 1f);
                    an.SetTrigger("Attack");
                    Run(an, 0.4f);
                    if (!an.GetCurrentAnimatorStateInfo(0).IsName("Attack")) Fail($"{r.Name} 공격 트리거 뒤 공격 상태가 아님 ({StateNow(an)})");
                    parts.Add($"{r.Kind}=동물({an.runtimeAnimatorController.name})");
                }
            }
        }

        /// <summary>애니메이터를 잘게 나눠 굴린다(한 번에 크게 굴리면 전이가 다음 갱신에서야 시작돼 상태가 한 박자 늦다).</summary>
        private static void Run(Animator an, float sec)
        {
            for (int i = 0; i < 10; i++) an.Update(sec / 10f);
        }

        private static string StateNow(Animator an)
        {
            var clips = an.GetCurrentAnimatorClipInfo(0);
            return clips.Length > 0 ? clips[0].clip.name : "(없음)";
        }

        private static void CheckStandIns(FieldSpawner sp, List<FieldEnemy> made)
        {
            var e = Make(sp, made, FieldEnemy.Kind.DrownedGhost, GoElement.Cryo);
            if (e.EnemyKind != FieldEnemy.Kind.IceFox || e.DisplayName != "눈여우" || e.Element != GoElement.Cryo) Fail($"물귀신+빙 → {e.EnemyKind}·{e.DisplayName}·{e.Element}");
            var g = Make(sp, made, FieldEnemy.Kind.DrownedGhost);
            if (g.EnemyKind != FieldEnemy.Kind.DrownedGhost || g.Element != GoElement.Hydro) Fail("물귀신(덧씌움 없음)이 바뀜");
            var b = Make(sp, made, FieldEnemy.Kind.IceFox, GoElement.Anemo); // 괴물은 제 원소 — 덧씌움을 무시
            if (b.Element != GoElement.Cryo || b.DisplayName != "눈여우") Fail($"눈여우+풍 {b.Element}·{b.DisplayName}");
        }

        private static void CheckHeroMinions(FieldSpawner sp, List<FieldEnemy> made)
        {
            var want = new Dictionary<GoElement, FieldEnemy.Kind>
            {
                { GoElement.Anemo, FieldEnemy.Kind.WindHawk }, { GoElement.Cryo, FieldEnemy.Kind.IceFox },
                { GoElement.Geo, FieldEnemy.Kind.RockBear }, { GoElement.Dendro, FieldEnemy.Kind.GrassSnake },
                { GoElement.Pyro, FieldEnemy.Kind.EmberImp }, { GoElement.Hydro, FieldEnemy.Kind.DrownedGhost }, { GoElement.Electro, FieldEnemy.Kind.StormWraith },
            };
            foreach (var kv in want)
            {
                var m = sp.SpawnHeroMinion(kv.Key, Vector3.up * 400f, "test_minion", GoEra.Past, 0);
                made.Add(m);
                if (m.EnemyKind != kv.Value || m.Element != kv.Key) Fail($"{kv.Key} 인물 졸개 {m.EnemyKind}·{m.Element} ≠ {kv.Value}");
            }
        }

        private static void CheckFrostWild()
        {
            var seen = new HashSet<FieldEnemy.Kind>();
            foreach (var g in GoFrost.Wild)
                foreach (var f in g.Foes)
                {
                    if (!FieldEnemy.IsBeastKind(f.Kind)) Fail($"{g.Id} 무리에 괴물 아닌 {f.Kind}");
                    seen.Add(f.Kind);
                }
            if (!seen.Contains(FieldEnemy.Kind.IceFox) || !seen.Contains(FieldEnemy.Kind.RockBear) || !seen.Contains(FieldEnemy.Kind.WindHawk)) Fail("고원 무리에 눈여우·바위곰·회오리매가 다 안 섬");
        }
    }
}
