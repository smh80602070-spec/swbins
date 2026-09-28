using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 106-4 "캐릭터 통일" — Kenney 블록·캡슐로 남아 있던 DUNGEON NPC·능묘 파수꾼을 Mixamo 사실
    /// 모델로. `SetupAbeCharacterImport` 를 캐릭터마다 한 벌씩 더 복사하는 대신 표 하나로 넷을 굽는다
    /// (몸체 T-pose FBX + `이름@클립.fbx` → Humanoid 리깅 → `Assets/Animators/<이름>.controller` →
    /// `<폴더>/<이름>Animated.prefab`). 원본은 `tools/mixamo_automation`(README 레시피 표)으로 받고,
    /// `CharactersRealistic/` 는 gitignore 라 **PC 마다 받은 뒤 이 메뉴를 한 번** 돌린다. 폴더가 없는
    /// 캐릭터는 건너뛰고, 씬 빌더는 프리팹이 없으면 예전 모델로 폴백한다.
    ///
    /// 컨트롤러 규칙은 Abe 와 같다: `Speed`(0 서기 · &gt;0.1 걷기 · &gt;0.6 달리기) + 트리거 `Attack`·`Hit`·`Death`
    /// (클립이 있을 때만). 걷기·달리기는 Mixamo "In Place" 로 받아 제자리 — 위치는 스크립트가 옮긴다.
    /// 추가 대기 상태(`extraIdles`)는 트리거 없이 `NpcIdle`(런타임)이 이름으로 튼다. 추가 트리거(`ExtraTriggers`, 트리거 이름 = 파일
    /// 접미사, 끝나면 대기로)는 PLAN.md 106-6 동료 전용 클립 — 무사 `Taunt`(방패 치켜듦)·`Blocked`(방패로 받음), 술사 `Heal`(치유 시전).
    /// </summary>
    public static class SetupNpcCharacterImports
    {
        private const string Root = "Assets/Art/CharactersRealistic/";

        private sealed class Spec
        {
            public string Name;
            public string Idle, Walk, Run, Attack, Hit, Death;
            public string[] ExtraIdles = new string[0];
            public string[] ExtraTriggers = new string[0];
        }

        private static readonly Spec[] Specs =
        {
            new Spec { Name = "Skeleton", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // 106-6 동행 무사 — 피격·쓰러짐·도발·방패 피격은 2026-09-24 Mixamo(README 레시피 표).
            new Spec { Name = "Paladin", Idle = "Idle", Walk = "Walking", Run = "Running", Attack = "Attack", Hit = "HitReaction", Death = "Dying",
                ExtraTriggers = new[] { "Taunt", "Blocked" } },
            new Spec { Name = "PeasantMan", Idle = "Idle" },
            // 106-6 동행 술사 몸 겸 마을 아낙·포로 — 걷기·달리기·빛살 시전(Attack = Cast)·치유 시전은 2026-09-24 Mixamo.
            new Spec { Name = "PeasantGirl", Idle = "Idle", Walk = "Walking", Run = "Running", Attack = "Cast", ExtraIdles = new[] { "Kneel" },
                ExtraTriggers = new[] { "Heal" } },
            // PLAN.md 108 후속 — FOREST 짐승 여덟의 몸(2026-09-24 Mixamo, README 레시피 표). 빛깔·꾸밈은
            // `SetupForestCreatureModels` 가 이 프리팹 위에 굽는다. 포자괴물만 덤벼서 Attack(포효)이 있다.
            new Spec { Name = "Goblin", Idle = "Idle", Walk = "Walking", Run = "Running" },
            new Spec { Name = "Hulk", Idle = "Idle", Walk = "Walking", Run = "Running" },
            new Spec { Name = "Warrok", Idle = "Idle", Walk = "Walking", Run = "Running", Attack = "Attack" }, // Attack = STORY 소환 내려찍기(106-10)
            new Spec { Name = "Parasite", Idle = "Idle", Walk = "Walking", Run = "Running", Attack = "Attack" },
            new Spec { Name = "Nightshade", Idle = "Idle" },
            new Spec { Name = "Jolleen", Idle = "Idle", Walk = "Walking", Run = "Running" },
            // PLAN.md 106-10 STORY 유격(궁수) 몸 — 활 대기·걷기·달리기(In Place)·쏘기(Attack).
            new Spec { Name = "Archer", Idle = "Idle", Walk = "Walking", Run = "Running", Attack = "Attack" },
            // 두목 전용 몸(2026-09-24) — GO 망루 수호장(107-7) Maw J Laygo · DUNGEON 능묘지기(106-4) Ganfaul M Aure.
            // Brute 컨트롤러와 같은 다섯 상태(대기·걷기·공격·피격·쓰러짐)라 두목 코드는 그대로.
            new Spec { Name = "Maw", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Ganfaul", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // 두목 전용 몸 둘째 묶음(2026-09-24) — DUNGEON 황건 살수 Ninja · 층 주인 Demon T Wiezzorek · 기계화 정찰병 Alien Soldier,
            // STORY 황건 두목 Morak. 다섯 상태 그대로(층 두목·황건적 두목은 원래 배역 Brute).
            new Spec { Name = "Ninja", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Demon", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "AlienSoldier", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Morak", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // PLAN.md 109-1 GO 세 시대(2026-09-25 Mixamo, README 레시피 표) — 다른 시대 들판 적 몸: 현대 방독면 약탈자 Gas Mask·
            // 떠도는 망자 Copzombie L Actisdato, 미래 강철 경비병 Exo Red(+ 위 Alien Soldier). 다섯 상태(산적·해골과 같은 코드).
            new Spec { Name = "GasMask", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Copzombie", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "ExoRed", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // 역참 둘레 사람 — 현대 여행자 Remy·택배 기사 Megan·순찰 대원 Swat Guy, 미래 탐사 대원 Exo Gray·수리 기사 Vanguard·
            // 시간 여행자 Crypto. 서기·걷기만(`FolkWalker` 가 Speed 로 오간다).
            new Spec { Name = "Remy", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Megan", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "SwatGuy", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "ExoGray", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Vanguard", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Crypto", Idle = "Idle", Walk = "Walking" },
            // PLAN.md 109-2 DUNGEON 세 시대(2026-09-25) — 전투 방 잡졸의 층 단계별 현대·미래 몸(GasMask·ExoRed 는 위 GO 몫을 같이 쓴다):
            // 폭주 청년 Brian·시험 기동 인형 X Bot·진압 특공대 Swat·강철 인형 병정 Y Bot·암흑가 해결사 The Boss·별 너머 방문자 Zlorp
            // (Prisoner B Styperek·Survivor A Lusth 는 휴머노이드 자동 매핑이 "RightLowerArm 없음"으로 실패해 바꿨다).
            new Spec { Name = "Brian", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "XBot", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Swat", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "YBot", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Boss", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Zlorp", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // 행상 — 고물 행상 Leonard · 시간 행상 Astra(서기만).
            new Spec { Name = "Leonard", Idle = "Idle" },
            new Spec { Name = "Astra", Idle = "Idle" },
            // PLAN.md 109-3 STORY 세 시대(2026-09-25 Mixamo, README 레시피 표) — 단계 넷 × 현대·미래 적:
            // 폭주 라이더 Racer·시험 인형 Dummy / 떠도는 망자 Warzombie F Pedroso·별바다 손님 Mremireh O Desbiens /
            // 뒷골목 불량배 Jody·플라즈마 변이체 Yaku J Ignite / 용병 돌격대 Steve·강철 거신 Mannequin. 다섯 상태.
            new Spec { Name = "Racer", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Dummy", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Warzombie", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Mremireh", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Jody", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Yaku", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Steve", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            new Spec { Name = "Mannequin", Idle = "Idle", Walk = "Walking", Attack = "Attack", Hit = "HitReaction", Death = "Dying" },
            // 들판 손님 — 사진 찍는 여행자 Olivia · 시간 여행자 Ely By K.Atienza(서기·걷기).
            new Spec { Name = "Olivia", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Ely", Idle = "Idle", Walk = "Walking" },
            // PLAN.md 109-4 FOREST 세 시대 마을 사람(2026-09-25 Mixamo, README 레시피 표) — 과거 길 잃은 성 파수병 Castle Guard 01(Pirate By P. Konstantinov 는 의족이라 LeftFoot 이 없어 휴머노이드 실패)·
            // 붉은 두건 순례 기사 Knight D Pelegrini / 현대 택배 기사 Pete·사진작가 Sophie / 미래 금빛 외골격 시간 여행자 Uriel A Plotexia·
            // 불시착 탐사원 Jennifer. 서기·걷기(`ForestEraFolk` 가 Speed 로 오간다).
            new Spec { Name = "CastleGuard", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Pelegrini", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Pete", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Sophie", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Uriel", Idle = "Idle", Walk = "Walking" },
            new Spec { Name = "Jennifer", Idle = "Idle", Walk = "Walking" },
            // PLAN.md 109-7 GO 인물 105 몸 배정(2026-09-25 Mixamo, README 레시피 표) — 역사풍 몸 여덟: 여 Kachujin G Rosales·Arissa·
            // Eve By J.Gonzales / 남 Dreyar By M.Aure·Castle Guard 02·Heraklios By A. Dizon·Brady·Joe(근대 인물 양복).
            // 대기만 받는다 — 인물 몸은 동행·겨루기 모두 주인공 Maria.controller 로 리타깃해 쓴다(`GoHeroLooks`).
            new Spec { Name = "Kachujin", Idle = "Idle" },
            new Spec { Name = "Arissa", Idle = "Idle" },
            new Spec { Name = "Eve", Idle = "Idle" },
            new Spec { Name = "Dreyar", Idle = "Idle" },
            new Spec { Name = "CastleGuard02", Idle = "Idle" },
            new Spec { Name = "Heraklios", Idle = "Idle" },
            new Spec { Name = "Brady", Idle = "Idle" },
            new Spec { Name = "Joe", Idle = "Idle" },
        };

        private static readonly string[] HeroBodies = { "Kachujin", "Arissa", "Eve", "Dreyar", "CastleGuard02", "Heraklios", "Brady", "Joe" };

        /// <summary>109-7 인물 몸 여덟만 굽는다(배치 `-executeMethod` 용).</summary>
        public static void SetupHeroBodies()
        {
            var built = new List<string>();
            foreach (var name in HeroBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] hero bodies {string.Join(" ", built)}");
        }

        private static readonly string[] ForestEraBodies = { "CastleGuard", "Pelegrini", "Pete", "Sophie", "Uriel", "Jennifer" };

        /// <summary>109-4 FOREST 세 시대 마을 사람 몸만 굽는다(배치 `-executeMethod` 용).</summary>
        public static void SetupForestEraBodies()
        {
            var built = new List<string>();
            foreach (var name in ForestEraBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] forest era bodies {string.Join(" ", built)}");
        }

        private static readonly string[] StoryEraBodies = { "Racer", "Dummy", "Warzombie", "Mremireh", "Jody", "Yaku", "Steve", "Mannequin", "Olivia", "Ely" };

        /// <summary>109-3 STORY 세 시대 몸만 굽는다(배치 `-executeMethod` 용).</summary>
        public static void SetupStoryEraBodies()
        {
            var built = new List<string>();
            foreach (var name in StoryEraBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] story era bodies {string.Join(" ", built)}");
        }

        private static readonly string[] DungeonEraBodies = { "Brian", "XBot", "Swat", "YBot", "Boss", "Zlorp", "Leonard", "Astra" };

        /// <summary>109-2 DUNGEON 세 시대 몸만 굽는다(배치 `-executeMethod` 용).</summary>
        public static void SetupDungeonEraBodies()
        {
            var built = new List<string>();
            foreach (var name in DungeonEraBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] dungeon era bodies {string.Join(" ", built)}");
        }

        private static readonly string[] EraBodies = { "GasMask", "Copzombie", "ExoRed", "Remy", "Megan", "SwatGuy", "ExoGray", "Vanguard", "Crypto" };

        /// <summary>109-1 세 시대 몸만 굽는다(배치 `-executeMethod` 용).</summary>
        public static void SetupEraBodies()
        {
            var built = new List<string>();
            foreach (var name in EraBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] era bodies {string.Join(" ", built)}");
        }

        private static readonly string[] BossBodies = { "Maw", "Ganfaul", "Ninja", "Demon", "AlienSoldier", "Morak" };

        public static string PrefabPath(string name) => $"{Root}{name}/{name}Animated.prefab";

        private const string ForgeDir = "Assets/Art/CharactersForge/";

        /// <summary>
        /// char-forge 교체 표(09-27 밤 결정 "게임 몸 교체부터") — 사용자가 Mixamo ↔ 공방 비교(HOW_TO_PLAYTEST §9)에서
        /// "바꿔도 된다" 한 몸만 여기 올린다. 올린 몸은 같은 자리(`PrefabPath`, GUID 그대로라 씬은 다시 안 지어도 된다)에
        /// 공방 FBX(`CharactersForge/<id>.fbx`)로 프리팹을 굽는다 — Mixamo 원본이 없는 PC 에서도 선다.
        /// 공방 FBX 에 이 몸의 상태 클립(idle·walk·run·attack·hit·death·덧붙임 소문자)이 하나라도 없으면 Mixamo 로 굽는다.
        /// </summary>
        public static readonly Dictionary<string, string> ForgeSwap = new Dictionary<string, string>
        {
        };

        public static bool IsForgeSwapped(string name) => ForgeSwap.ContainsKey(name);

        /// <summary>교체 표의 몸만 다시 굽는다(배치 `-executeMethod` 용). 로그 `FORGE_SWAP <이름>=forge|mixamo|fail`.</summary>
        [MenuItem("Saga/Char Forge/Apply Forge Swaps")]
        public static void SetupForgeSwaps()
        {
            var built = new List<string>();
            foreach (var name in ForgeSwap.Keys)
            {
                var spec = Specs.FirstOrDefault(x => x.Name == name);
                if (spec == null) { built.Add($"{name}=fail(표에 없음)"); continue; }
                bool forge = SetupForge(spec, ForgeSwap[name]);
                built.Add($"{name}={(forge ? "forge" : Setup(spec) ? "mixamo" : "fail")}");
            }
            AssetDatabase.SaveAssets();
            Debug.Log($"FORGE_SWAP {string.Join(" ", built)}");
        }

        /// <summary>표에서 한 캐릭터만 굽는다(`SetupForestCreatureModels` 가 제 몸 여섯만 부른다).</summary>
        public static bool SetupOne(string name)
        {
            foreach (var spec in Specs)
            {
                if (spec.Name == name) return Setup(spec);
            }
            Debug.LogError($"[SetupNpcCharacterImports] 표에 {name} 없음");
            return false;
        }

        /// <summary>두목 전용 몸만 굽는다(배치 `-executeMethod` 용 — 나머지 컨트롤러를 다시 굽지 않는다).</summary>
        public static void SetupBossBodies()
        {
            var built = new List<string>();
            foreach (var name in BossBodies) built.Add($"{name}={SetupOne(name)}");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] boss bodies {string.Join(" ", built)}");
        }

        [MenuItem("Saga/Setup NPC Character Imports")]
        public static void SetupAll()
        {
            int built = 0;
            foreach (var spec in Specs)
            {
                if (Setup(spec)) built++;
            }
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupNpcCharacterImports] {built}/{Specs.Length} 캐릭터 프리팹을 구움");
        }

        private static bool Setup(Spec spec)
        {
            if (ForgeSwap.TryGetValue(spec.Name, out var forgeId))
            {
                if (SetupForge(spec, forgeId)) return true;
                Debug.LogWarning($"[SetupNpcCharacterImports] {spec.Name} 공방 몸 {forgeId} 로 못 구움 — Mixamo 로 굽는다");
            }
            string dir = $"{Root}{spec.Name}/";
            string body = $"{spec.Name}.fbx";
            if (!File.Exists(dir + body))
            {
                Debug.LogWarning($"[SetupNpcCharacterImports] {dir}{body} 없음 — 건너뜀(tools/mixamo_automation README 레시피로 받는다)");
                return false;
            }

            var map = new List<MixamoRigUtil.AnimMapping>();
            void Add(string suffix, bool loop)
            {
                if (!string.IsNullOrEmpty(suffix)) map.Add(new MixamoRigUtil.AnimMapping($"@{suffix}.fbx", Clip(suffix), loop));
            }
            Add(spec.Idle, true);
            Add(spec.Walk, true);
            Add(spec.Run, true);
            Add(spec.Attack, false);
            Add(spec.Hit, false);
            Add(spec.Death, false);
            foreach (var extra in spec.ExtraIdles) Add(extra, true);
            foreach (var extra in spec.ExtraTriggers) Add(extra, false);

            string tag = $"SetupNpcCharacterImports:{spec.Name}";
            if (MixamoRigUtil.RigCharacter(dir, body, map.ToArray(), tag) == null) return false;

            var controller = BuildController(spec, state => LoadClip($"{dir}{spec.Name}@{state.suffix}.fbx", Clip(state.suffix)));
            if (controller == null) return false;
            return BuildPrefab(spec, AssetDatabase.LoadAssetAtPath<GameObject>(dir + body), controller);
        }

        /// <summary>공방 몸으로 굽기 — 클립은 공방 FBX 안의 상태 이름(소문자)으로 찾는다(Mixamo 접미사 Cast·Walking 과 무관).</summary>
        private static bool SetupForge(Spec spec, string forgeId)
        {
            string fbx = $"{ForgeDir}{forgeId}.fbx";
            if (!File.Exists(fbx))
            {
                Debug.LogWarning($"[SetupNpcCharacterImports] {fbx} 없음 — tools/char-forge README §3 새 PC 순서로 뽑는다");
                return false;
            }
            var avatar = AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<Avatar>().FirstOrDefault();
            if (avatar == null || !avatar.isHuman) BuildCharCompareRealScene.SetupForgeImport(fbx);
            var clips = AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>()
                .Where(c => !c.name.StartsWith("__preview")).GroupBy(c => c.name).ToDictionary(g => g.Key, g => g.First());

            var missing = StateSlots(spec).Select(x => x.state.ToLowerInvariant()).Where(n => !clips.ContainsKey(n)).ToList();
            if (missing.Count > 0)
            {
                Debug.LogWarning($"[SetupNpcCharacterImports] {forgeId} 에 클립 없음: {string.Join(",", missing)}");
                return false;
            }

            string dir = $"{Root}{spec.Name}";
            if (!AssetDatabase.IsValidFolder(dir))
            {
                if (!AssetDatabase.IsValidFolder(Root.TrimEnd('/'))) AssetDatabase.CreateFolder("Assets/Art", "CharactersRealistic");
                AssetDatabase.CreateFolder(Root.TrimEnd('/'), spec.Name);
            }
            var controller = BuildController(spec, state => clips.TryGetValue(state.name.ToLowerInvariant(), out var c) ? c : null);
            if (controller == null) return false;
            bool ok = BuildPrefab(spec, AssetDatabase.LoadAssetAtPath<GameObject>(fbx), controller);
            if (ok) Debug.Log($"[SetupNpcCharacterImports] {spec.Name} = 공방 몸 {forgeId}");
            return ok;
        }

        /// <summary>이 몸이 가진 상태(이름, Mixamo 접미사) — 빈 칸은 뺀다.</summary>
        private static IEnumerable<(string state, string suffix)> StateSlots(Spec spec)
        {
            var slots = new List<(string, string)>
            {
                ("Idle", spec.Idle), ("Walk", spec.Walk), ("Run", spec.Run), ("Attack", spec.Attack), ("Hit", spec.Hit), ("Death", spec.Death),
            };
            foreach (var extra in spec.ExtraIdles) slots.Add((extra, extra));
            foreach (var extra in spec.ExtraTriggers) slots.Add((extra, extra));
            return slots.Where(x => !string.IsNullOrEmpty(x.Item2));
        }

        private static string Clip(string suffix) => suffix.ToLowerInvariant();

        private static AnimatorController BuildController(Spec spec, Func<(string name, string suffix), AnimationClip> clipFor)
        {
            if (!AssetDatabase.IsValidFolder("Assets/Animators")) AssetDatabase.CreateFolder("Assets", "Animators");
            string path = $"Assets/Animators/{spec.Name}.controller";
            if (AssetDatabase.LoadAssetAtPath<AnimatorController>(path) != null) AssetDatabase.DeleteAsset(path);

            var controller = AnimatorController.CreateAnimatorControllerAtPath(path);
            controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
            var sm = controller.layers[0].stateMachine;

            var idle = State(sm, "Idle", spec.Idle, spec.Name, clipFor);
            if (idle == null)
            {
                Debug.LogError($"[SetupNpcCharacterImports] {spec.Name} 대기 클립이 없다");
                return null;
            }
            sm.defaultState = idle;

            var walk = State(sm, "Walk", spec.Walk, spec.Name, clipFor);
            var run = State(sm, "Run", spec.Run, spec.Name, clipFor);
            if (walk != null)
            {
                Speed(idle, walk, AnimatorConditionMode.Greater, 0.1f);
                Speed(walk, idle, AnimatorConditionMode.Less, 0.1f);
            }
            if (run != null)
            {
                var from = walk ?? idle;
                Speed(from, run, AnimatorConditionMode.Greater, 0.6f);
                Speed(run, from, AnimatorConditionMode.Less, 0.6f);
            }

            Trigger(controller, sm, idle, "Attack", State(sm, "Attack", spec.Attack, spec.Name, clipFor), back: true);
            Trigger(controller, sm, idle, "Hit", State(sm, "Hit", spec.Hit, spec.Name, clipFor), back: true);
            // Death 는 마지막 프레임에 머문다(Abe·Maria 관례).
            Trigger(controller, sm, idle, "Death", State(sm, "Death", spec.Death, spec.Name, clipFor), back: false);

            foreach (var extra in spec.ExtraIdles) State(sm, extra, extra, spec.Name, clipFor);
            foreach (var extra in spec.ExtraTriggers) Trigger(controller, sm, idle, extra, State(sm, extra, extra, spec.Name, clipFor), back: true);

            EditorUtility.SetDirty(controller);
            return controller;
        }

        private static AnimatorState State(AnimatorStateMachine sm, string stateName, string suffix, string charName,
            Func<(string name, string suffix), AnimationClip> clipFor)
        {
            if (string.IsNullOrEmpty(suffix)) return null;
            var clip = clipFor((stateName, suffix));
            if (clip == null)
            {
                Debug.LogWarning($"[SetupNpcCharacterImports] {charName} {stateName}({suffix}) 클립 없음 — 상태를 뺀다");
                return null;
            }
            var s = sm.AddState(stateName);
            s.motion = clip;
            return s;
        }

        private static void Speed(AnimatorState from, AnimatorState to, AnimatorConditionMode mode, float threshold)
        {
            var t = from.AddTransition(to);
            t.hasExitTime = false;
            t.duration = 0.15f;
            t.AddCondition(mode, threshold, "Speed");
        }

        private static void Trigger(AnimatorController controller, AnimatorStateMachine sm, AnimatorState idle,
            string trigger, AnimatorState to, bool back)
        {
            if (to == null) return;
            controller.AddParameter(trigger, AnimatorControllerParameterType.Trigger);
            var t = sm.AddAnyStateTransition(to);
            t.hasExitTime = false;
            t.duration = 0.1f;
            t.canTransitionToSelf = false;
            t.AddCondition(AnimatorConditionMode.If, 0, trigger);
            if (!back) return;
            var r = to.AddTransition(idle);
            r.hasExitTime = true;
            r.exitTime = 0.9f;
            r.duration = 0.15f;
        }

        private static bool BuildPrefab(Spec spec, GameObject bodyAsset, AnimatorController controller)
        {
            if (bodyAsset == null) return false;
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(bodyAsset);
            instance.name = spec.Name;
            var animator = instance.GetComponent<Animator>();
            if (animator == null) animator = instance.AddComponent<Animator>();
            animator.runtimeAnimatorController = controller;
            animator.applyRootMotion = false; // 위치는 스크립트가 옮긴다(걷기·달리기는 In Place 클립).
            animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
            PrefabUtility.SaveAsPrefabAsset(instance, PrefabPath(spec.Name));
            UnityEngine.Object.DestroyImmediate(instance);
            Debug.Log($"[SetupNpcCharacterImports] saved {PrefabPath(spec.Name)}");
            return true;
        }

        private static AnimationClip LoadClip(string path, string clipName)
        {
            foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(path))
            {
                if (asset is AnimationClip clip && clip.name == clipName) return clip;
            }
            return null;
        }
    }
}
