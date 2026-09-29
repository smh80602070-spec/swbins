using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// char-forge 단계 3(`tools/char-forge/README.md` §7) — 지금 몸(Mixamo, 로컬 전용)과 공방 사실 몸
    /// (`Assets/Art/CharactersForge/*.fbx`, MakeHuman·UAL 전부 CC0)을 짝(주역 Maria · Goblin · 두목 Brute · 숲 괴물 Warrok·Parasite·Nightshade)마다 같은 빛·같은 키로
    /// 나란히 세우는 비교 장면.
    /// 교체 문턱: 사람이 "못하지 않다"고 판정한 짝만 게임 몸을 바꾼다 — 이 장면은 그 판정용이고, 게임 씬은 안 건드린다.
    /// 몸마다 가진 동작을 같은 순서(서기 → 걷기 → 달리기 → 베기 → 맞기 → 구르기 → 줍기 → 쓰러짐)로 저절로 돈다(런타임 스크립트 없음).
    /// 피부는 Maria 와 같은 FakeSSS(`BuildMariaSssShaderGraph.BuildGraph`)에 공방 피부 그림을 바탕색으로 이은 그래프
    /// (`Generated/ForgeSkin.shadergraph`, 없으면 짓는다) — 둘이 같은 피부 셰이더로 비교된다. 그 밖엔 다른 saga 편집기 코드에
    /// 기대지 않는다. 지금 몸 파일이 없는 PC 는 공방 몸만 선다.
    /// </summary>
    public static class BuildCharCompareRealScene
    {
        private const string ForgeDir = "Assets/Art/CharactersForge/";
        public const string SkinGraph = ForgeDir + "Generated/ForgeSkin.shadergraph";
        private const string ScenePath = "Assets/Scenes/CharCompareReal.unity";
        private const string AnimDir = "Assets/Animators/CharForge/";
        private const string NowRoot = "Assets/Art/CharactersRealistic/";
        // BuildMariaSkinSplit.cs 가 구운 피부/기타 분리(있으면 게임과 같게 물린다)
        private const string MariaSplit = NowRoot + "Generated/Maria_Split.asset";
        private const string MariaSkin = NowRoot + "Generated/MariaSkin.mat";
        private const string MariaRest = NowRoot + "Generated/MariaRest.mat";

        /// <summary>비교 짝 — 지금 Mixamo 몸(로컬 전용 파일, 없으면 공방 몸만)과 공방 몸. 짝마다 키를 같게 맞춘다
        /// (게임도 CharacterVisual 이 목표 키로 맞추니 모양·결만 본다). 지금 몸 클립은 SetupNpcCharacterImports·
        /// SetupBruteCharacterImport·SetupMixamoCharacterImport 가 붙인 이름 그대로({상태: (파일 접미어, 클립 이름)}).</summary>
        private sealed class Pair
        {
            public string Key, NowBody, ForgeId;
            public float Height;
            public Dictionary<string, (string file, string clip)> NowClips;
        }

        private static readonly Pair[] Pairs =
        {
            new Pair
            {
                Key = "Maria", NowBody = NowRoot + "Maria WProp J J Ong.fbx", ForgeId = "_cmp_real_hero_f_01", Height = 1.70f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Action Idle To Fight Idle", "idle") }, { "walk", ("Walking", "walk") }, { "run", ("Running", "run") },
                    { "attack", ("Sword And Shield Slash", "attack") }, { "hit", ("Hit Reaction", "hit") }, { "dodge", ("Stand To Roll", "dodge") },
                    { "interaction", ("Picking Up", "interaction") }, { "death", ("Two Handed Sword Death", "death") },
                    // 이동 기술(GO 107-2, BuildMariaTraversal) — 공방은 등반·활공이 자체 키프레임(char-forge keyframes.py), 헤엄·점프는 UAL
                    { "climb", ("Climbing", "climb") }, { "glide", ("Gliding", "glide") }, { "swim", ("Swimming", "swim") },
                    { "tread", ("Floating", "tread") }, { "jump", ("Jumping", "jump") },
                },
            },
            new Pair
            {
                Key = "Goblin", NowBody = NowRoot + "Goblin/Goblin.fbx", ForgeId = "_cmp_real_goblin_01", Height = 1.25f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                },
            },
            new Pair
            {
                Key = "Brute", NowBody = NowRoot + "Brute/Brute.fbx", ForgeId = "_cmp_real_brute_01", Height = 2.40f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walk") }, { "attack", ("SlashAdvance", "attack") },
                    { "hit", ("HitReaction", "hit") }, { "death", ("Dying", "death") },
                },
            },
            // 사가의숲 괴물 셋 — 키는 SetupForestCreatureModels 표(무쇠도깨비·포자괴물·안개유령)와 같다
            new Pair
            {
                Key = "Warrok", NowBody = NowRoot + "Warrok/Warrok.fbx", ForgeId = "_cmp_real_warrok_01", Height = 1.75f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                    { "attack", ("Attack", "attack") },
                },
            },
            new Pair
            {
                Key = "Parasite", NowBody = NowRoot + "Parasite/Parasite.fbx", ForgeId = "_cmp_real_parasite_01", Height = 1.60f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                    { "attack", ("Attack", "attack") },
                },
            },
            new Pair
            {
                Key = "Nightshade", NowBody = NowRoot + "Nightshade/Nightshade.fbx", ForgeId = "_cmp_real_nightshade_01", Height = 1.60f,
                NowClips = new Dictionary<string, (string, string)> { { "idle", ("Idle", "idle") } },
            },
            new Pair
            {
                Key = "Hulk", NowBody = NowRoot + "Hulk/Hulk.fbx", ForgeId = "_cmp_real_rockgiant_01", Height = 1.85f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                },
            },
            // 동행 무사(106-6) — 공방은 살을 본뜬 껍데기(누비옷·가죽·쇠판·투구)로 입힌다
            new Pair
            {
                Key = "Paladin", NowBody = NowRoot + "Paladin/Paladin.fbx", ForgeId = "_cmp_real_paladin_01", Height = 1.80f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                    { "attack", ("Attack", "attack") }, { "hit", ("HitReaction", "hitreaction") }, { "death", ("Dying", "dying") },
                    // 방패 도발·막기 중 피격(106-6) — 공방은 자체 키프레임
                    { "taunt", ("Taunt", "taunt") }, { "blocked", ("Blocked", "blocked") },
                },
            },
            // 동행 술사(106-6, 마을 아낙·포로 겸) · STORY 유격(106-10)
            new Pair
            {
                Key = "PeasantGirl", NowBody = NowRoot + "PeasantGirl/PeasantGirl.fbx", ForgeId = "_cmp_real_mage_f_01", Height = 1.65f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                    { "attack", ("Cast", "cast") },
                    // 치유 시전·포로 무릎 꿇기(106-6) — 공방은 자체 키프레임
                    { "heal", ("Heal", "heal") }, { "kneel", ("Kneel", "kneel") },
                },
            },
            new Pair
            {
                Key = "Archer", NowBody = NowRoot + "Archer/Archer.fbx", ForgeId = "_cmp_real_archer_f_01", Height = 1.70f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                    { "attack", ("Attack", "attack") },
                },
            },
            // 해골 — 공방은 뼈를 코드로 짓는다(사람 몸 비틀기가 아니다)
            new Pair
            {
                Key = "Skeleton", NowBody = NowRoot + "Skeleton/Skeleton.fbx", ForgeId = "_cmp_real_skeleton_01", Height = 1.80f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "attack", ("Attack", "attack") },
                    { "hit", ("HitReaction", "hitreaction") }, { "death", ("Dying", "dying") },
                },
            },
            // 잎 옷 요정 — 게임은 숲 정령 셋(0.85~0.95m 로 줄임)과 STORY 전직관(1.75m)에 같은 몸. 비교는 전직관 키로 크게 본다
            new Pair
            {
                Key = "Jolleen", NowBody = NowRoot + "Jolleen/Jolleen.fbx", ForgeId = "_cmp_real_fairy_01", Height = 1.75f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "run", ("Running", "running") },
                },
            },
            // 두목 전용 몸 여섯(SetupNpcCharacterImports.BossBodies) — 공방은 껍데기 옷·뿔·엄니로. 키는 게임 자리 쯤
            // (망루 수호장·능묘지기·살수·층 주인·기계화 정찰병·황건 두목 2.24m)
            BossPair("Maw", "_cmp_real_maw_01", 2.20f),
            BossPair("Ganfaul", "_cmp_real_ganfaul_01", 1.90f),
            BossPair("Ninja", "_cmp_real_ninja_01", 1.80f),
            BossPair("Demon", "_cmp_real_demon_01", 2.40f),
            BossPair("AlienSoldier", "_cmp_real_aliensoldier_01", 1.85f),
            BossPair("Morak", "_cmp_real_morak_01", 2.24f),
            // GO 세 시대(109-1) — 들판 적 셋(다섯 상태 몸)과 역참 사람 여섯(서기·걷기만)
            BossPair("GasMask", "_cmp_real_gasmask_01", 1.75f),
            BossPair("Copzombie", "_cmp_real_copzombie_01", 1.75f),
            BossPair("ExoRed", "_cmp_real_exored_01", 1.90f),
            FolkPair("Remy", "_cmp_real_tourist_01", 1.75f),
            FolkPair("Megan", "_cmp_real_courier_f_01", 1.65f),
            FolkPair("SwatGuy", "_cmp_real_patrol_01", 1.80f),
            FolkPair("ExoGray", "_cmp_real_surveyor_01", 1.78f),
            FolkPair("Vanguard", "_cmp_real_mechanic_01", 1.70f),
            FolkPair("Crypto", "_cmp_real_chrononaut_f_01", 1.72f),
            // DUNGEON 세 시대(109-2) — 층 단계별 잡졸 여섯(다섯 상태 몸)과 행상 둘(서기만)
            BossPair("Brian", "_cmp_real_rioter_01", 1.75f),
            BossPair("XBot", "_cmp_real_testbot_01", 1.80f),
            BossPair("Swat", "_cmp_real_riotswat_01", 1.82f),
            BossPair("YBot", "_cmp_real_steelbot_01", 1.95f),
            BossPair("Boss", "_cmp_real_enforcer_01", 1.85f),
            BossPair("Zlorp", "_cmp_real_visitor_01", 1.60f),
            IdlePair("Leonard", "_cmp_real_junkpeddler_01", 1.70f),
            IdlePair("Astra", "_cmp_real_timepeddler_f_01", 1.68f),
            // STORY 세 시대(109-3) — 비경 단계별 적 여덟(다섯 상태 몸, 키는 HeightMul 쯤)과 들머리 사람 둘·정찰병(서기)
            BossPair("Racer", "_cmp_real_rider_01", 1.75f),
            BossPair("Dummy", "_cmp_real_crashdummy_01", 1.75f),
            BossPair("Warzombie", "_cmp_real_warzombie_01", 1.75f),
            BossPair("Mremireh", "_cmp_real_starguest_01", 1.84f),
            BossPair("Jody", "_cmp_real_punk_f_01", 1.65f),
            BossPair("Yaku", "_cmp_real_plasma_01", 1.84f),
            BossPair("Steve", "_cmp_real_merc_01", 1.80f),
            BossPair("Mannequin", "_cmp_real_colossus_01", 2.28f),
            FolkPair("Olivia", "_cmp_real_phototourist_f_01", 1.65f),
            FolkPair("Ely", "_cmp_real_chrononaut_02", 1.75f),
            IdlePair("PeasantMan", "_cmp_real_scout_01", 1.75f),
            // FOREST 마을 사람 여섯(109-4, ForestEraFolk — 서기·걷기)
            FolkPair("CastleGuard", "_cmp_real_sentry_01", 1.80f),
            FolkPair("Pelegrini", "_cmp_real_pilgrim_01", 1.78f),
            FolkPair("Pete", "_cmp_real_courier_02", 1.68f),
            FolkPair("Sophie", "_cmp_real_photographer_f_02", 1.70f),
            FolkPair("Uriel", "_cmp_real_goldexo_f_01", 1.78f),
            FolkPair("Jennifer", "_cmp_real_castaway_f_01", 1.68f),
            // GO 인물 105 몸 여덟(109-7, SetupNpcCharacterImports.HeroBodies — 지금 몸은 서기만)
            IdlePair("Dreyar", "_cmp_real_blackknight_01", 1.85f),
            IdlePair("CastleGuard02", "_cmp_real_castleguard_02", 1.80f),
            IdlePair("Heraklios", "_cmp_real_furchief_01", 1.88f),
            IdlePair("Brady", "_cmp_real_martialist_01", 1.72f),
            IdlePair("Joe", "_cmp_real_suit_01", 1.75f),
            IdlePair("Kachujin", "_cmp_real_swordmaiden_f_01", 1.66f),
            IdlePair("Arissa", "_cmp_real_hoodedcloak_f_01", 1.68f),
            IdlePair("Eve", "_cmp_real_leatherknight_f_01", 1.70f),
            // 맨몸 잡졸(DUNGEON·STORY)·GO 산적 동료 — 클립 파일 이름이 다르다(Punching)
            new Pair
            {
                Key = "Abe", NowBody = NowRoot + "Abe/Abe.fbx", ForgeId = "_cmp_real_brawler_01", Height = 1.80f,
                NowClips = new Dictionary<string, (string, string)>
                {
                    { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walk") }, { "attack", ("Punching", "attack") },
                    { "hit", ("HitReaction", "hit") }, { "death", ("Dying", "death") },
                },
            },
        };

        /// <summary>행상 짝 — 지금 몸은 서기 하나뿐이다.</summary>
        private static Pair IdlePair(string key, string forgeId, float height) => new Pair
        {
            Key = key, NowBody = NowRoot + key + "/" + key + ".fbx", ForgeId = forgeId, Height = height,
            NowClips = new Dictionary<string, (string, string)> { { "idle", ("Idle", "idle") } },
        };

        /// <summary>역참·마을 사람 짝 — 지금 몸은 서기·걷기뿐이다(`FolkWalker`).</summary>
        private static Pair FolkPair(string key, string forgeId, float height) => new Pair
        {
            Key = key, NowBody = NowRoot + key + "/" + key + ".fbx", ForgeId = forgeId, Height = height,
            NowClips = new Dictionary<string, (string, string)> { { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") } },
        };

        /// <summary>두목·들판 적 몸 짝 — 지금 몸은 다섯 상태(대기·걷기·공격·피격·쓰러짐)가 같은 이름이다.</summary>
        private static Pair BossPair(string key, string forgeId, float height) => new Pair
        {
            Key = key, NowBody = NowRoot + key + "/" + key + ".fbx", ForgeId = forgeId, Height = height,
            NowClips = new Dictionary<string, (string, string)>
            {
                { "idle", ("Idle", "idle") }, { "walk", ("Walking", "walking") }, { "attack", ("Attack", "attack") },
                { "hit", ("HitReaction", "hitreaction") }, { "death", ("Dying", "dying") },
            },
        };
        private const float DefaultHeight = 1.70f;

        private static readonly string[] Cycle = { "idle", "walk", "run", "attack", "hit", "dodge", "interaction",
            "climb", "glide", "swim", "tread", "jump", "taunt", "blocked", "heal", "kneel", "death" };
        private static readonly HashSet<string> Loops = new HashSet<string> { "idle", "walk", "run", "climb", "glide", "swim", "tread", "kneel", "strafe_l", "strafe_r" };

        [MenuItem("Saga/Char Forge/Build Compare Real Scene")]
        public static void Build()
        {
            var forge = Directory.Exists(ForgeDir)
                ? Directory.GetFiles(ForgeDir, "*.fbx").Select(p => p.Replace('\\', '/')).OrderBy(p => p).ToList()
                : new List<string>();
            foreach (var fbx in forge) SetupForgeImport(fbx);

            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var scene = EditorSceneManager.GetActiveScene();
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.35f, 0.35f, 0.35f);
            var light = new GameObject("Directional Light", typeof(Light)).GetComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
            light.shadows = LightShadows.Soft;
            light.transform.rotation = Quaternion.Euler(40f, 30f, 0f);

            // 짝(지금 | 공방)을 왼쪽부터 — 표에 없는 공방 FBX 는 뒤에 혼자 선다
            var groups = new List<(float height, List<(string label, GameObject go)> figs)>();
            var forgeIds = forge.Select(Path.GetFileNameWithoutExtension).ToList();
            foreach (var pair in Pairs)
            {
                var figs = new List<(string, GameObject)>();
                var nowAsset = AssetDatabase.LoadAssetAtPath<GameObject>(pair.NowBody);
                if (nowAsset != null)
                {
                    var dir = Path.GetDirectoryName(pair.NowBody).Replace('\\', '/') + "/";
                    var body = Path.GetFileNameWithoutExtension(pair.NowBody);
                    var clips = pair.NowClips.ToDictionary(kv => kv.Key, kv => ClipIn(dir + body + "@" + kv.Value.file + ".fbx", kv.Value.clip));
                    var now = (GameObject)PrefabUtility.InstantiatePrefab(nowAsset);
                    now.name = "NOW_" + pair.Key;
                    if (pair.Key == "Maria") ApplyMariaSkinSplit(now);
                    Animate(now, pair.Key, clips);
                    figs.Add(("NOW  " + pair.Key, now));
                }
                else
                {
                    Debug.LogWarning("[CharCompareReal] 지금 몸 파일이 없다(로컬 전용): " + pair.NowBody);
                }
                if (forgeIds.Remove(pair.ForgeId)) figs.Add(("FORGE  " + pair.Key, ForgeFigure(pair.ForgeId)));
                if (figs.Count > 0) groups.Add((pair.Height, figs));
            }
            foreach (var id in forgeIds) groups.Add((DefaultHeight, new List<(string, GameObject)> { ("FORGE  " + id, ForgeFigure(id)) }));

            // 짝 사이 간격은 큰 몸일수록 넓게. 키 맞추기 → 자리 → 카메라를 보게 → 이름표
            float x = 0f, maxH = 0f;
            var placed = new List<(string label, GameObject go, float h)>();
            foreach (var (h, figs) in groups)
            {
                float step = 0.45f * h + 0.35f;
                for (int i = 0; i < figs.Count; i++)
                {
                    var (label, go) = figs[i];
                    FitHeight(go, h);
                    go.transform.position = new Vector3(x, go.transform.position.y, 0f);
                    go.transform.rotation = Quaternion.Euler(0f, 180f, 0f); // 카메라(-Z 쪽)를 보게
                    Label(label, new Vector3(x, h + 0.25f, 0f));
                    placed.Add((label, go, h));
                    x += step;
                }
                x += 0.6f;
                maxH = Mathf.Max(maxH, h);
            }
            float width = x - 0.6f - (placed.Count > 0 ? 0.45f * groups.Last().height + 0.35f : 0f);
            foreach (var p in placed) p.go.transform.position += Vector3.left * (width * 0.5f);
            foreach (var t in Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None)) t.transform.position += Vector3.left * (width * 0.5f);

            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.localScale = new Vector3(Mathf.Max(2f, width * 0.2f + 1f), 1f, 2f);
            ground.GetComponent<Renderer>().sharedMaterial = Lit("CharCompareGround", new Color(0.55f, 0.55f, 0.55f));

            var cam = new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.5f, 0.6f, 0.7f);
            cam.fieldOfView = 35f;
            float dist = Mathf.Max(width * 1.05f + 1.2f, maxH * 2.4f);
            cam.transform.position = new Vector3(0f, maxH * 0.55f, -dist);
            cam.transform.rotation = Quaternion.Euler(4f, 0f, 0f);

            if (!AssetDatabase.IsValidFolder("Assets/Scenes")) AssetDatabase.CreateFolder("Assets", "Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log("[CharCompareReal] built " + ScenePath + " — " + string.Join(" | ", placed.Select(r => r.label)));
        }

        private static GameObject ForgeFigure(string id)
        {
            var fbx = ForgeDir + id + ".fbx";
            var go = (GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(fbx));
            go.name = "FORGE_" + id;
            var clips = AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>()
                .Where(c => !c.name.StartsWith("__preview")).ToDictionary(c => c.name, c => c);
            Animate(go, id, clips);
            return go;
        }

        /// <summary>검사용 — 몸 이름(NOW_<짝>·FORGE_<id>)으로 짝 키를 찾는다.</summary>
        private static float ExpectedHeight(string name)
        {
            var p = Pairs.FirstOrDefault(x => name == "NOW_" + x.Key || name == "FORGE_" + x.ForgeId);
            return p != null ? p.Height : DefaultHeight;
        }

        /// <summary>검사용 — 공방 몸은 동작 셋 이상, 지금 몸은 가진 클립 수까지(지금 Nightshade 는 서기 하나뿐).</summary>
        private static int MinStates(string name)
        {
            var p = Pairs.FirstOrDefault(x => name == "NOW_" + x.Key);
            return p != null ? Mathf.Min(3, p.NowClips.Count) : 3;
        }

        /// <summary>배치 모드: 짓고 → 검사 → 종료 코드(0 통과 · 3 실패).</summary>
        public static void BuildAndVerifyBatch()
        {
            Build();
            EditorApplication.Exit(Verify() ? 0 : 3);
        }

        /// <summary>열린 비교 장면 검사 — 몸마다 짝 키·발 y=0·카메라 쪽·동작 셋 이상, 공방 피부는 FakeSSS 그래프 + 그림, 부품은 색.
        /// 결과는 `CMP …` 줄로 찍는다(배치 로그를 grep).</summary>
        [MenuItem("Saga/Char Forge/Verify Compare Real Scene")]
        public static bool Verify()
        {
            var anims = Object.FindObjectsByType<Animator>(FindObjectsSortMode.None).OrderBy(a => a.transform.position.x).ToArray();
            bool ok = anims.Length >= 1;
            foreach (var a in anims)
            {
                var ctl = a.runtimeAnimatorController as AnimatorController;
                var states = ctl ? ctl.layers[0].stateMachine.states.Select(s => s.state.name + (s.state.motion ? "" : "!")).ToArray() : new string[0];
                var smrs = a.GetComponentsInChildren<SkinnedMeshRenderer>();
                float lo = float.MaxValue, hi = float.MinValue;
                foreach (var r in smrs)
                {
                    var mesh = new Mesh();
                    r.BakeMesh(mesh, true);
                    foreach (var v in mesh.vertices) { var w = r.transform.localToWorldMatrix.MultiplyPoint3x4(v); lo = Mathf.Min(lo, w.y); hi = Mathf.Max(hi, w.y); }
                    Object.DestroyImmediate(mesh);
                }
                var foot = a.GetBoneTransform(HumanBodyBones.LeftFoot);
                var toe = a.GetBoneTransform(HumanBodyBones.LeftToes);
                var faceZ = foot && toe ? (toe.position - foot.position).normalized.z : 0f;
                var mats = smrs.SelectMany(r => r.sharedMaterials).Where(m => m).Distinct().ToList();
                Debug.Log("CMP " + a.name + " h=" + (hi - lo).ToString("0.000") + " lo=" + lo.ToString("0.000") + " faceZ=" + faceZ.ToString("0.00")
                          + " states=" + string.Join(",", states) + " mats=" + string.Join(" ", mats.Select(m =>
                              m.name + ":" + m.shader.name.Replace("Universal Render Pipeline/", "URP/") + (m.HasProperty("_BaseMap") && m.GetTexture("_BaseMap") ? "+tex" : ""))));
                var want = ExpectedHeight(a.name);
                ok &= states.Length >= MinStates(a.name) && !states.Any(s => s.EndsWith("!")) && Mathf.Abs(hi - lo - want) < 0.02f && Mathf.Abs(lo) < 0.01f && faceZ < -0.3f;
                if (a.name.StartsWith("FORGE_"))
                {
                    var skin = mats.FirstOrDefault(m => m.name.EndsWith("_skin"));
                    // 해골(공방 skeleton.py)은 살이 없다 — 피부 대신 뼈 칸(bone)이 있어야 한다.
                    // 온몸 쇠 인형(시험 기동·강철 인형)은 껍데기가 살을 다 덮어 지웠다 — 쇠 칸(metal) · 충돌 시험 인형은 합성수지 칸(plastic)
                    ok &= skin != null
                        ? skin.shader == AssetDatabase.LoadAssetAtPath<Shader>(SkinGraph) && skin.GetTexture("_BaseMap") != null
                        : mats.Any(m => m.name.EndsWith("_bone") || m.name.EndsWith("_metal") || m.name.EndsWith("_plastic"));
                    // 그림 없는 부품 재질(뿔 등)은 FBX 의 바탕색을 옮겨 받아야 한다 — 흰색이면 옮기기가 빠진 것
                    foreach (var m in mats.Where(m => !m.GetTexture("_BaseMap")))
                    {
                        var c = m.GetColor("_BaseColor");
                        Debug.Log("CMP_PART " + m.name + " color=" + ColorUtility.ToHtmlStringRGB(c));
                        ok &= !(c.r > 0.99f && c.g > 0.99f && c.b > 0.99f);
                    }
                }
            }
            Debug.Log("CMP_RESULT " + (ok ? "OK" : "FAIL"));
            return ok;
        }

        /// <summary>공방 FBX 를 Humanoid 로 — 클립 이름의 "뼈대|" 앞머리를 떼고 이동 셋은 반복, 텍스처를 꺼내 URP Lit 재질로 바꿔 끼운다.</summary>
        public static void SetupForgeImport(string fbx)
        {
            var mi = (ModelImporter)AssetImporter.GetAtPath(fbx);
            if (mi == null) return;
            mi.animationType = ModelImporterAnimationType.Human;
            mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            // 재질은 FBX 안(재질 이름 그대로)에 두고 아래에서 이름으로 바꿔 끼운다 — .meta 에 칸이 없으면 기본값 0 이 옛 방식
            // (External·텍스처 이름)이라 재질이 밖에 텍스처 이름으로 생기고 .fbm 폴더가 생긴다(2026-09-25 겪음)
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            mi.materialLocation = ModelImporterMaterialLocation.InPrefab;
            foreach (var kv in mi.GetExternalObjectMap().ToList()) mi.RemoveRemap(kv.Key); // 전 실행의 연결을 비우고 새로 잇는다
            mi.SaveAndReimport();
            // 아바타가 깨졌으면 .meta 의 뼈 짝을 비우고 한 번 더 자동으로 맞춘다 — 한 번 실패한 가져오기의 불완전한 짝
            // (LeftFoot 빠짐)이 .meta 에 남아, 몸을 고쳐 다시 넣어도 그 짝을 그대로 써서 계속 실패했다(09-25 유령 몸)
            var avatar = AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<Avatar>().FirstOrDefault();
            if (avatar == null || !avatar.isValid || !avatar.isHuman)
            {
                var hd = mi.humanDescription;
                hd.human = new HumanBone[0];
                hd.skeleton = new SkeletonBone[0];
                mi.humanDescription = hd;
                mi.SaveAndReimport();
            }
            var id = Path.GetFileNameWithoutExtension(fbx);
            var texDir = ForgeDir + "Textures/";
            mi.ExtractTextures(texDir);
            AssetDatabase.Refresh();

            var clips = mi.defaultClipAnimations.Select(c =>
            {
                var n = c.name.Contains("|") ? c.name.Substring(c.name.LastIndexOf('|') + 1) : c.name;
                c.name = n;
                c.loopTime = Loops.Contains(n);
                c.lockRootRotation = c.lockRootHeightY = c.lockRootPositionXZ = true;
                c.keepOriginalOrientation = c.keepOriginalPositionY = c.keepOriginalPositionXZ = true;
                return c;
            }).ToArray();
            mi.clipAnimations = clips;
            mi.SaveAndReimport();

            // 재질: 가져온 것(읽기 전용)의 그림을 URP Lit 새 재질로 옮겨 이름으로 바꿔 끼운다
            var matDir = ForgeDir + "Materials/";
            if (!AssetDatabase.IsValidFolder(matDir.TrimEnd('/'))) AssetDatabase.CreateFolder(ForgeDir.TrimEnd('/'), "Materials");
            var sss = ForgeSkinShader();
            foreach (var src in AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<Material>().ToList())
            {
                var path = matDir + id + "_" + src.name + ".mat";
                var m = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (m == null)
                {
                    m = Lit(id + "_" + src.name, Color.white);
                    AssetDatabase.CreateAsset(m, path);
                }
                var baseTex = src.mainTexture;
                m.SetTexture("_BaseMap", baseTex);
                // 그림이 있으면 흰 바탕(그림 그대로), 없으면(공방 부품 — 뿔·허리 천) FBX 의 바탕색을 옮긴다
                m.SetColor("_BaseColor", baseTex != null ? Color.white : src.color);
                var bump = src.HasProperty("_BumpMap") ? src.GetTexture("_BumpMap") : null;
                if (bump != null) { m.SetTexture("_BumpMap", bump); m.EnableKeyword("_NORMALMAP"); }
                // 칸별 손질 — 이름은 build_real.py 가 표준 칸으로 붙인다(skin·eye·hair·hair_brow·hair_lash·teeth·cloth_*)
                float smooth = src.name.StartsWith("eye") ? 0.85f : src.name.StartsWith("skin") ? 0.4f
                    : src.name.StartsWith("hair") ? 0.3f : src.name.StartsWith("teeth") ? 0.6f
                    : src.name.StartsWith("metal") ? 0.62f : src.name.StartsWith("plastic") ? 0.5f : src.name.StartsWith("leather") ? 0.35f : 0.2f;
                m.SetFloat("_Smoothness", smooth);
                m.SetFloat("_Metallic", src.name.StartsWith("metal") ? 0.85f : 0f); // 공방 껍데기 쇠판(shell slot metal)
                if (sss != null && src.name.StartsWith("skin"))
                {
                    // Maria 피부와 같은 FakeSSS(웜톤 역광 글로우) — 매끈함도 Maria 값(BuildMariaSkinSplit 0.35)에 맞춘다
                    m.shader = sss;
                    if (baseTex != null) m.SetTexture("_BaseMap", baseTex);
                    m.SetFloat("_Smoothness", 0.35f);
                }
                else if (m.shader.name != "Universal Render Pipeline/Lit")
                {
                    m.shader = Shader.Find("Universal Render Pipeline/Lit");
                }
                if (src.name.StartsWith("hair"))
                {
                    m.SetFloat("_AlphaClip", 1f);
                    m.SetFloat("_Cutoff", src.name == "hair" ? 0.35f : 0.5f);
                    m.EnableKeyword("_ALPHATEST_ON");
                    m.SetFloat("_Cull", 0f); // 머리카락 띠는 양면
                    m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
                }
                EditorUtility.SetDirty(m);
                mi.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material), src.name), m);
            }
            mi.SaveAndReimport();
        }

        /// <summary>공방 피부 그래프 — 없으면 Maria 와 같은 빌더로 짓는다(피부 그림 `_BaseMap` → 바탕색, FakeSSS → 발광).
        /// 컴파일 오류면 null(피부는 URP Lit 으로 남는다). 메뉴로 다시 지으려면 그래프 파일을 지우고 장면을 다시 짓는다.</summary>
        public static Shader ForgeSkinShader()
        {
            var shader = AssetDatabase.LoadAssetAtPath<Shader>(SkinGraph);
            if (shader == null)
            {
                var dir = Path.GetDirectoryName(SkinGraph).Replace('\\', '/');
                if (!AssetDatabase.IsValidFolder(dir)) AssetDatabase.CreateFolder(ForgeDir.TrimEnd('/'), "Generated");
                if (!BuildMariaSssShaderGraph.BuildGraph(SkinGraph, "_BaseMap")) return null;
                AssetDatabase.ImportAsset(SkinGraph, ImportAssetOptions.ForceSynchronousImport);
                shader = AssetDatabase.LoadAssetAtPath<Shader>(SkinGraph);
            }
            if (shader == null || ShaderUtil.ShaderHasError(shader) || shader.FindPropertyIndex("_BaseMap") < 0)
            {
                Debug.LogError("[CharCompareReal] 공방 피부 그래프가 없거나 오류 — 피부는 URP Lit 으로 둔다: " + SkinGraph);
                return null;
            }
            return shader;
        }

        private static AnimationClip ClipIn(string fbx, string name) =>
            AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>().FirstOrDefault(c => c.name == name);

        /// <summary>Cycle 순서로 저절로 넘어가는 컨트롤러 — 이동 셋은 두 바퀴, 쓰러짐은 잠깐 머문 뒤 처음으로.</summary>
        private static void Animate(GameObject go, string key, Dictionary<string, AnimationClip> clips)
        {
            if (!AssetDatabase.IsValidFolder(AnimDir.TrimEnd('/')))
            {
                if (!AssetDatabase.IsValidFolder("Assets/Animators")) AssetDatabase.CreateFolder("Assets", "Animators");
                AssetDatabase.CreateFolder("Assets/Animators", "CharForge");
            }
            var path = AnimDir + key + "_cycle.controller";
            AssetDatabase.DeleteAsset(path);
            var ctl = AnimatorController.CreateAnimatorControllerAtPath(path);
            var sm = ctl.layers[0].stateMachine;
            var states = new List<AnimatorState>();
            foreach (var n in Cycle)
            {
                if (!clips.TryGetValue(n, out var clip) || clip == null) continue;
                var st = sm.AddState(n);
                st.motion = clip;
                states.Add(st);
            }
            if (states.Count == 0) { Debug.LogWarning("[CharCompareReal] 클립 없음: " + key); return; }
            sm.defaultState = states[0];
            for (int i = 0; i < states.Count; i++)
            {
                var n = states[i].name;
                var t = states[i].AddTransition(states[(i + 1) % states.Count]);
                t.hasExitTime = true;
                t.exitTime = Loops.Contains(n) ? 2f : n == "death" ? 1.6f : 1f;
                t.duration = 0.2f;
            }
            var anim = go.GetComponent<Animator>() ?? go.AddComponent<Animator>();
            anim.runtimeAnimatorController = ctl;
            anim.applyRootMotion = false;
        }

        /// <summary>쉼 자세 메시를 실제로 구워(BakeMesh) 잰 키로 맞추고 발바닥을 땅(y=0)에 — 스킨 경계 상자는 넉넉해서 안 쓴다.</summary>
        private static void FitHeight(GameObject go, float height)
        {
            Bounds? B(GameObject g)
            {
                Bounds? acc = null;
                foreach (var r in g.GetComponentsInChildren<SkinnedMeshRenderer>())
                {
                    var mesh = new Mesh();
                    r.BakeMesh(mesh, true);
                    var m = r.transform.localToWorldMatrix;
                    foreach (var v in mesh.vertices)
                    {
                        var w = m.MultiplyPoint3x4(v);
                        if (acc == null) acc = new Bounds(w, Vector3.zero);
                        else { var a = acc.Value; a.Encapsulate(w); acc = a; }
                    }
                    Object.DestroyImmediate(mesh);
                }
                return acc;
            }
            var b = B(go);
            if (b == null || b.Value.size.y < 0.01f) return;
            go.transform.localScale *= height / b.Value.size.y;
            b = B(go);
            go.transform.position += Vector3.down * b.Value.min.y;
        }

        private static void ApplyMariaSkinSplit(GameObject maria)
        {
            var split = AssetDatabase.LoadAssetAtPath<Mesh>(MariaSplit);
            var skin = AssetDatabase.LoadAssetAtPath<Material>(MariaSkin);
            var rest = AssetDatabase.LoadAssetAtPath<Material>(MariaRest);
            var smr = maria.GetComponentsInChildren<SkinnedMeshRenderer>(true).FirstOrDefault(r => r.name == "Maria_J_J_Ong");
            if (split == null || skin == null || rest == null || smr == null) return;
            smr.sharedMesh = split;
            smr.sharedMaterials = new[] { skin, rest };
        }

        private static void Label(string text, Vector3 at)
        {
            var go = new GameObject("Label_" + text.Split(' ')[0]);
            go.transform.position = at;
            go.transform.rotation = Quaternion.Euler(0f, 0f, 0f);
            var tm = go.AddComponent<TextMesh>();
            tm.text = text;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.characterSize = 0.035f;
            tm.fontSize = 48;
            tm.color = Color.white;
        }

        private static Material Lit(string name, Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = name };
            mat.SetColor("_BaseColor", color);
            mat.SetFloat("_Metallic", 0f);
            mat.SetFloat("_Smoothness", 0.2f);
            return mat;
        }
    }
}
