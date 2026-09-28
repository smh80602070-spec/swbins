using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    public enum KitSkillType { Dash, Shells, Guard, Zone }
    public enum KitBurstType { Infuse, Rally, Ward, Haste, Vortex }

    /// <summary>원소 스킬 한 가지 — 값은 웹 척도(거리 m · 배율 · 기력 60), 쓸 때 이 트랙 크기로(<see cref="GoKits"/>).</summary>
    public class KitSkill
    {
        public KitSkillType Type;
        public string Name;
        public float Cd, Len, W, Mul, Reach, Delay, R, Shield, Sec, Every, Energy, Heal, Team, ShieldAdd;
        public int N;
    }

    public class KitBurst
    {
        public KitBurstType Type;
        public string Name;
        public float R, Mul, Sec, NMul, Atk, Taken, Energy, Ahead, Every, Tick, Pull, Heal, Team;
    }

    public class HeroKit
    {
        public string Family; // sig · might · command · virtue
        public bool Sig;
        public string Label;
        public KitSkill Skill;
        public KitBurst Burst;
    }

    /// <summary>
    /// PLAN.md 109-14-11 "고유·갈래 스킬"(웹 사가고 ⑲-11 `kits.js` · saga-godot 106 ㉔㉖) — 인물마다 원소 스킬(E)·원소 해방(Q)이 다르다.
    /// 고유 다섯(주인공 · 팔괘진 인물 · 일제 포격 인물 · 결사 방진 인물 · 화살비 인물 — id 는 웹과 같다) — 그 갈래 "대표"라 갈래보다 한 단 위.
    /// 갈래 = 도감 기질: 무용 돌격(돌진)/검기(원소 부여) · 통솔 호령(늦게 떨어지는 탄)/군기(명단 공격) · 인덕 방패(명단 보호막)/맹세(받는 피해).
    /// 원소 덧붙임 하나(불꽃 해방 ×1.15 · 물결 회복 · 번개 다른 인물 기력 · 바람 대기 −1.5초 · 서리 스킬 ×1.15 · 바위 보호막 +12% · 덩굴 해방 +3초).
    /// 지략·도감 밖(산적)은 null → 109-8 모양(장판·소환)·해방 기본 그대로(웹과 같다). 웹 이야기 동료(story_*)는 이 트랙에 없어 뺐다.
    /// 척도: 거리 × 1.85(GO 사람 키) · 스킬 배율 × 1.8/2.2 · 해방 배율 × 4/4.5 · 기력 × 100/60. 옛 진단은 `OffForTest` 로 옛 모양 그대로 돈다.
    /// </summary>
    public static class GoKits
    {
        public const float Dist = 1.85f, SkillScale = 1.8f / 2.2f, BurstScale = 4f / 4.5f, EnergyScale = 100f / 60f;
        /// <summary>진단 — 켜면 모든 인물이 옛 모양(웹 손잡이 `field.kits` 0 과 같다).</summary>
        public static bool OffForTest;

        private static KitSkill S(KitSkillType t, string key, string ko, float cd, float mul) =>
            new KitSkill { Type = t, Name = GoLocalization.T(key, ko), Cd = cd, Mul = mul };
        private static KitBurst B(KitBurstType t, string key, string ko, float r, float mul) =>
            new KitBurst { Type = t, Name = GoLocalization.T(key, ko), R = r, Mul = mul };

        private static HeroKit Sig(string id)
        {
            KitSkill s;
            KitBurst b;
            switch (id)
            {
                case FieldCombat.HeroId:
                    s = S(KitSkillType.Dash, "kit.sig.hero.skill", "불꽃 돌진", 6f, 3.0f); s.Len = 5.5f; s.W = 2f;
                    b = B(KitBurstType.Infuse, "kit.sig.hero.burst", "불새 깃", 6f, 3.8f); b.Sec = 8f; b.NMul = 1.2f;
                    break;
                case "sg_zhugeliang":
                    s = S(KitSkillType.Zone, "kit.sig.zhuge.skill", "팔괘진", 12f, 1.0f); s.R = 4.5f; s.Sec = 10f; s.Every = 1.5f; s.N = 2; s.Energy = 1.2f;
                    b = B(KitBurstType.Haste, "kit.sig.zhuge.burst", "천기 뇌우", 7f, 3.0f); b.Sec = 12f; b.Energy = 9f;
                    break;
                case "kr_yisunsin":
                    s = S(KitSkillType.Shells, "kit.sig.yisun.skill", "일제 포격", 7f, 2.4f); s.Reach = 12f; s.N = 3; s.Delay = 0.6f; s.R = 2.5f;
                    b = B(KitBurstType.Rally, "kit.sig.yisun.burst", "학날개 진", 8f, 3.4f); b.Sec = 10f; b.Atk = 1.2f;
                    break;
                case "kr_gyebaek":
                    s = S(KitSkillType.Guard, "kit.sig.gyebaek.skill", "결사 방진", 12f, 1.9f); s.R = 3.5f; s.Shield = 0.25f; s.Sec = 12f;
                    b = B(KitBurstType.Ward, "kit.sig.gyebaek.burst", "오천의 맹세", 7f, 3.0f); b.Sec = 10f; b.Taken = 0.7f;
                    break;
                case "sg_huangzhong":
                    s = S(KitSkillType.Shells, "kit.sig.huang.skill", "화살비", 8f, 1.9f); s.Reach = 14f; s.N = 4; s.Delay = 0.5f; s.R = 1.8f;
                    b = B(KitBurstType.Vortex, "kit.sig.huang.burst", "돌개 화살", 5f, 2.4f); b.Ahead = 7f; b.Sec = 8f; b.Every = 0.5f; b.Tick = 0.5f; b.Pull = 5f;
                    break;
                default:
                    return null;
            }
            return new HeroKit { Family = "sig", Sig = true, Label = GoLocalization.T("kit.label.sig", "고유"), Skill = s, Burst = b };
        }

        private static string Word(GoElement el) => el switch
        {
            GoElement.Pyro => GoLocalization.T("kit.word.pyro", "불꽃"),
            GoElement.Hydro => GoLocalization.T("kit.word.hydro", "물결"),
            GoElement.Electro => GoLocalization.T("kit.word.electro", "번개"),
            GoElement.Anemo => GoLocalization.T("kit.word.anemo", "바람"),
            GoElement.Cryo => GoLocalization.T("kit.word.cryo", "서리"),
            GoElement.Geo => GoLocalization.T("kit.word.geo", "바위"),
            GoElement.Dendro => GoLocalization.T("kit.word.dendro", "덩굴"),
            _ => "",
        };

        /// <summary>갈래 × 원소 → 한 벌(웹 `familyKit`).</summary>
        public static HeroKit Family(HeroTrait trait, GoElement el)
        {
            KitSkill s;
            KitBurst b;
            string fam, label, sn, bn;
            switch (trait)
            {
                case HeroTrait.Might:
                    fam = "might"; label = GoLocalization.T("kit.label.might", "무용");
                    sn = GoLocalization.T("kit.noun.charge", "돌격"); bn = GoLocalization.T("kit.noun.edge", "검기");
                    s = new KitSkill { Type = KitSkillType.Dash, Cd = 7f, Len = 5f, W = 1.8f, Mul = 2.6f };
                    b = new KitBurst { Type = KitBurstType.Infuse, R = 6f, Mul = 3.6f, Sec = 8f, NMul = 1.15f };
                    break;
                case HeroTrait.Command:
                    fam = "command"; label = GoLocalization.T("kit.label.command", "통솔");
                    sn = GoLocalization.T("kit.noun.order", "호령"); bn = GoLocalization.T("kit.noun.banner", "군기");
                    s = new KitSkill { Type = KitSkillType.Shells, Cd = 8f, Reach = 10f, N = 2, Delay = 0.6f, R = 2.2f, Mul = 2.2f };
                    b = new KitBurst { Type = KitBurstType.Rally, R = 7f, Mul = 3.0f, Sec = 10f, Atk = 1.15f };
                    break;
                case HeroTrait.Virtue:
                    fam = "virtue"; label = GoLocalization.T("kit.label.virtue", "인덕");
                    sn = GoLocalization.T("kit.noun.shield", "방패"); bn = GoLocalization.T("kit.noun.oath", "맹세");
                    s = new KitSkill { Type = KitSkillType.Guard, Cd = 12f, R = 3f, Mul = 1.6f, Shield = 0.2f, Sec = 12f };
                    b = new KitBurst { Type = KitBurstType.Ward, R = 6.5f, Mul = 2.8f, Sec = 10f, Taken = 0.8f };
                    break;
                default:
                    return null;
            }
            string w = Word(el);
            s.Name = (w + " " + sn).Trim();
            b.Name = (w + " " + bn).Trim();
            switch (el)
            {
                case GoElement.Pyro: b.Mul *= 1.15f; break;
                case GoElement.Hydro: s.Heal = 0.04f; b.Heal = 0.08f; break;
                case GoElement.Electro: s.Team = 2f; b.Team = 6f; break;
                case GoElement.Anemo: s.Cd -= 1.5f; break;
                case GoElement.Cryo: s.Mul *= 1.15f; break;
                case GoElement.Geo: s.ShieldAdd = 0.12f; break;
                case GoElement.Dendro: b.Sec += 3f; break;
            }
            return new HeroKit { Family = fam, Sig = false, Label = label, Skill = s, Burst = b };
        }

        private static readonly System.Collections.Generic.Dictionary<string, HeroKit> _cache = new System.Collections.Generic.Dictionary<string, HeroKit>();

        /// <summary>인물 → 한 벌, 지략·도감 밖·진단 스위치면 null(109-8 모양 그대로). 이름이 번역이라 언어까지 키로 묶어 둔다(HUD 가 매 프레임 부른다).</summary>
        public static HeroKit KitOf(string id, GoElement el)
        {
            if (OffForTest || string.IsNullOrEmpty(id)) return null;
            string key = id + "|" + (int)el + "|" + GoLocalization.CurrentLanguage;
            if (_cache.TryGetValue(key, out var k)) return k;
            k = Sig(id) ?? (GoHeroes.TryGet(id, out var h) ? Family(h.Trait, el) : null);
            _cache[key] = k;
            return k;
        }

        /// <summary>도감에 붙이는 갈래 이름 — 고유·무용·통솔·인덕·지략(도감 밖은 빈 글).</summary>
        public static string LabelOf(string id, GoElement el)
        {
            var k = KitOf(id, el);
            if (k != null) return k.Label;
            return GoHeroes.TryGet(id, out _) ? GoLocalization.T("kit.label.wisdom", "지략") : "";
        }
    }
}
