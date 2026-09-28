using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    public enum KitSkillType { Dash, Shells, Guard, Zone, Blink, Gust, Wave }
    public enum KitBurstType { Infuse, Rally, Ward, Haste, Vortex, Lore, Echo, Feast, Rain }

    /// <summary>원소 스킬 한 가지 — 값은 웹 척도(거리 m · 배율 · 기력 60), 쓸 때 이 트랙 크기로(<see cref="GoKits"/>).</summary>
    public class KitSkill
    {
        public KitSkillType Type;
        public string Name;
        public float Cd, Len, W, Mul, Reach, Delay, R, Shield, Sec, Every, Energy, Heal, Team, ShieldAdd;
        public int N;
        /// <summary>109-14-15 그림자 걸음 — 적 뒤로 넘어서는 거리 · 표식 초 · 표식 난 적이 받는 피해 배율.</summary>
        public float Back, Mark, MarkMul;
        /// <summary>109-14-17 부채 바람(앞 부채꼴 — 내적 Arc 이상)·노 물결 — 맞은 적을 Knock m 밀어낸다.</summary>
        public float Arc, Knock;
    }

    public class KitBurst
    {
        public KitBurstType Type;
        public string Name;
        public float R, Mul, Sec, NMul, Atk, Taken, Energy, Ahead, Every, Tick, Pull, Heal, Team;
        /// <summary>109-14-15 옛 글자 풀이(반응 피해 배율 RMul) · 가면 벗기(메아리 — Reach 안 표식 난 적마다 N 번, EMul).</summary>
        public float RMul, Reach, EMul;
        public int N;
        /// <summary>109-14-17 잔칫날 순풍(바람 자리 — Every 초마다 안에 선 지금 인물 FHeal 회복·안의 적 EMul)·뱃노래(Sec 초 동안 기본·강·낙하 공격 뒤 Gap 초에 한 번 Reach 안 가까운 N 에 RMul).</summary>
        public float FHeal, Gap;
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
    /// 지략·도감 밖(산적)은 null → 109-8 모양(장판·소환)·해방 기본 그대로(웹과 같다). 이야기 동료 다섯(은비·나그네 109-14-15, 촌장·사공 109-14-17, 해솔 109-14-20)은 고유로 붙였다.
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
                // 109-14-15 이야기 동료(웹 kits.js story_*)
                case "story_scholar":
                    s = S(KitSkillType.Zone, "kit.sig.scholar.skill", "비문 탁본", 10f, 0.7f); s.R = 4.5f; s.Sec = 9f; s.Every = 1.5f; s.N = 4; s.Energy = 1.5f;
                    b = B(KitBurstType.Lore, "kit.sig.scholar.burst", "옛 글자 풀이", 7.5f, 2.8f); b.Sec = 12f; b.RMul = 1.4f;
                    break;
                case "story_wanderer":
                    s = S(KitSkillType.Blink, "kit.sig.wanderer.skill", "그림자 걸음", 8f, 3.2f); s.Reach = 10f; s.Back = 1.5f; s.R = 2.5f; s.Mark = 8f; s.MarkMul = 1.25f; s.Len = 4f;
                    b = B(KitBurstType.Echo, "kit.sig.wanderer.burst", "가면 벗기", 6f, 3.4f); b.Reach = 15f; b.N = 3; b.Every = 0.3f; b.EMul = 1.5f;
                    break;
                // 109-14-17 치유·협동 공격(웹 kits.js story_elder·story_ferryman)
                case "story_elder":
                    s = S(KitSkillType.Gust, "kit.sig.elder.skill", "부채 바람", 8f, 2.3f); s.R = 6f; s.Arc = 0.2f; s.Knock = 7f; s.Heal = 0.06f;
                    b = B(KitBurstType.Feast, "kit.sig.elder.burst", "잔칫날 순풍", 6f, 2.5f); b.Sec = 10f; b.Every = 1f; b.FHeal = 0.05f; b.EMul = 0.5f;
                    break;
                case "story_ferryman":
                    s = S(KitSkillType.Wave, "kit.sig.ferryman.skill", "노 물결", 9f, 2.9f); s.Len = 9f; s.W = 2f; s.Knock = 6f;
                    b = B(KitBurstType.Rain, "kit.sig.ferryman.burst", "뱃노래", 5f, 2.3f); b.Sec = 15f; b.Reach = 8f; b.N = 2; b.Gap = 1f; b.RMul = 0.85f;
                    break;
                // 109-14-20 해솔(웹 kits.js story_haesol) — 있는 틀(탄·원소 부여)만
                case "story_haesol":
                    s = S(KitSkillType.Shells, "kit.sig.haesol.skill", "먹구름 벼락", 8f, 2.3f); s.Reach = 12f; s.N = 3; s.Delay = 0.5f; s.R = 2.4f;
                    b = B(KitBurstType.Infuse, "kit.sig.haesol.burst", "가면 없는 노래", 6.5f, 3.6f); b.Sec = 10f; b.NMul = 1.2f;
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
