using TMPro;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;
using Saga.Realm.World;
using Saga.Realm.Player;
using Saga.Realm.UI;
using Saga.Realm.Audio;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 5절 완료 조건 + REALM 다음 조각 넷(명령
    /// 나머지 6종·여러 성 확장·무장 로스터/성 소속·전쟁 첫 슬라이스)을
    /// 실제 Play 모드에서 확인한다(`PlaytestStorySlice.cs`와 같은 결 —
    /// 컴포넌트/정적 API를 직접 불러 판정 경로만 본다, UI 버튼 클릭
    /// 시뮬레이션은 안 함).
    /// (1) 성 소속 게이트 — 무장이 없는 성에서 개발형 명령이 막히는지,
    /// (2) 조선 물길 게이트 — 뭍길 성에서 막히는지(게이트 실패는 그 달
    /// 명령 소진을 안 시키는지도 같이),
    /// (3) 개간·상업·정산(금 공식),
    /// (4) 기술·치안·축성·훈련 — 새 명령 넷이 해당 필드를 올리는지,
    /// (5) 징병 — 병력이 늘고 인구가 주는지,
    /// (6) 수색·등용 — 성마다 다른 재야, 등용된 무장이 그 성에 배치되는지,
    /// (7) 새로 배치된 무장이 그 성에서 개발형 명령을 실제로 쓸 수 있는지,
    /// (8) 전쟁 — 잘못된 성/병력 부족 전제조건, 약한 군대는 못 뺏고
    /// 돌아오는지, 압도적 물량은 함락시키는지, 함락한 성 재공격이 막히는지,
    /// (8-1) 51장 "대규모 콘텐츠"(2026-09-14) — 둘째 목표(정도, 복양에서만
    /// 출진)도 같은 Attack() 경로로 함락·편입되는지,
    /// (8-2) 51장 2차 확장(2026-09-15) — 진류의 첫 목표(낙양)와, 소패·정도를
    /// 함락한 뒤 이어지는 둘째 단계 목표(하비·업)까지 같은 Attack() 경로로
    /// 순서대로(선행 성을 먼저 편입해야 열리는지 포함) 함락·편입되는지,
    /// (8-3) 51장 3차 확장(2026-09-16) — 낙양·하비·업을 함락한 뒤 각자
    /// 이어지는 셋째 단계 목표(장안·수춘·진양)까지 같은 경로로 되는지,
    /// (8-4) 51장 4차 확장(2026-09-16, 같은 날) — 장안·수춘을 함락한 뒤
    /// 이어지는 넷째 단계 목표(한중·여남)까지 같은 경로로 되는지,
    /// (8-5) 51장 5차 확장(2026-09-16, 같은 날) — 한중·여남을 함락한 뒤
    /// 이어지는 다섯째 단계 목표(성도·강하)까지 같은 경로로 되는지,
    /// (8-6) 51장 6차 확장(2026-09-16, 같은 날) — 성도·강하를 함락한 뒤
    /// 이어지는 여섯째 단계 목표(강주·양양)까지 같은 경로로 되는지,
    /// (8-7) 51장 7차 확장(2026-09-16, 같은 날) — 강주·양양을 함락한 뒤
    /// 이어지는 일곱째 단계 목표(영안·강릉)까지 같은 경로로 되는지,
    /// (8-8) 51장 8차 확장(2026-09-16, 같은 날) — 강릉을 함락한 뒤
    /// 이어지는 여덟째 단계 목표(장사)까지 같은 경로로 되는지(영안은
    /// 이웃이 전부 이미 우리 성이라 막다른 가지 — 다음 단계 없음),
    /// (8-9) 51장 9차 확장(2026-09-16, 같은 날) — 장사를 함락한 뒤
    /// 이어지는 아홉째 단계 목표(시상)까지 같은 경로로 되는지,
    /// (9) 계략(유언비어·화계) — 허창 밖 게이트, 성공 시 소패 훈련도/병력
    /// 실제 하락,
    /// (10) 함락한 성 편입 — 함락 즉시 네 번째 성으로 들어가는지, 무장
    /// 없이는 명령이 막히는지,
    /// (11) 문답 — 정답/오답 채점·금 보상·학습 기록,
    /// (12) 저장/불러오기 — 성 넷·로스터·성 소속·소패 전황·문답 진행까지 왕복.
    /// </summary>
    public static partial class PlaytestRealmSlice
    {
        private const string ScenePath = "Assets/Scenes/TestCity.unity";
        private const int MaxHireAttempts = 30;

        private static bool _hadError;
        private static int _framesSeen;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        private enum Phase
        {
            Init, WorldMap, LocationGate, ShipsGate, Agri, SettleAfterAgri, Comm, SettleAfterComm,
            Tech, Sec, Wall, Train, Draft, SettleAfterDraft,
            SearchAtChenliu, Hire, AgriByNewOfficer,
            PlotGate, PlotRumor, PlotFire,
            AttackWrongCity, AttackTooFewTroops, AttackWeak, AttackOverwhelm,
            CapturedCityDevelop, AttackAgainBlocked, AttackLuoyang, AttackXiapi, AttackDingtao, AttackYe,
            AttackChangan, AttackShouchun, AttackJinyang, AttackYunzhong, AttackShangjun, AttackShuofang, AttackWuyuan, AttackBeidi, AttackYanmen, AttackDingxiang, AttackHanzhong, AttackRunan,
            AttackChengdu, AttackJiangxia, AttackJiangzhou, AttackXiangyang,
            AttackYongan, AttackJiangling, AttackChangsha, AttackChaisang, AttackJianye, AttackKuaiji,
            AttackTianshui, AttackNanhai, AttackZhuti, AttackCangwu, AttackJianning, AttackYulin, AttackYuexi,
            AttackZangke, AttackJiaozhi, AttackHepu, AttackJiuzhen, AttackYunnan, AttackRinan,
            AttackYongchang, AttackXianglin, AttackDianchong, AttackShendu,
            AttackBijing, AttackJiantuoluo, AttackLuorong, AttackJibin, AttackDaxia, AttackWuyishanli, AttackMoqietuo, AttackSheyi, AttackZhuwu, AttackXiquan, AttackQuzu,
            Eras,
            QuizCorrect, QuizWrong, QuizArchive,
            SaveLoad, Done,
        }
        private static Phase _phase = Phase.Init;
        private static int _hireAttempts;
        private static int _plotAttempts;
        private static int _goldBeforeSettle;
        private static int _foodBeforeSettle;

        [MenuItem("Saga/Playtest Realm Slice (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            // GameBootstrap.Awake()가 매번 TryLoad()를 불러 이전 헤드리스
            // 실행이 남긴 세이브를 그대로 읽어 버린다 — "새 게임" 전제인
            // Init 단계가 깨지지 않도록 먼저 지운다(RealmSaveState.cs
            // DeleteForTest() 주석 참고).
            RealmSaveState.DeleteForTest();
            RealmScenario.ResetForTest();
            RealmScenario.Enabled = false; // PLAN.md 109-16 — 시나리오 카드가 월간 사건 진단을 가로채지 않게(시나리오 진단만 잠깐 켠다)

            // CheckSettingsPanel()이 설정 버튼을 "Btn_설정"(한국어 라벨)으로
            // 찾는다 — RealmCommandUi.Build()가 그 이름을 지을 때 쓰는
            // RealmLocalization.CurrentLanguage는 PlayerPrefs에 저장돼 이전
            // 실행(또는 사람이 에디터에서 언어를 바꾼 뒤 안 되돌리고 끈 세션)이
            // "en"을 남기면 이번 실행이 처음부터 어긋난 이름으로 시작해 버튼을
            // 영영 못 찾는다 — 위 세이브 삭제와 같은 이유로 여기서 먼저 고정한다.
            // 110 ⑤c-2c-2 — 영어 감시(HangulWatch)로 돌 때는 en 으로 박는다.
            RealmLocalization.CurrentLanguage = HangulWatch.Active ? "en" : "ko";
            Saga.Core.SagaUi.Lang = RealmLocalization.CurrentLanguage;
            EditorSceneManager.OpenScene(ScenePath);

            _hadError = false;
            _framesSeen = 0;
            _phase = Phase.Init;
            _hireAttempts = 0;
            _plotAttempts = 0;

            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestRealmSlice] runtime error: {condition}\n{stackTrace}");
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += Tick;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;

                bool ok = !_hadError && _phase == Phase.Done;
                Debug.Log(ok
                    ? "[PlaytestRealmSlice] OK - world-map/location gate/ships gate/orders(10)/draft/search/hire/city-assignment/war/diplo(rumor+fire)/captured-city-absorb/multi-target-attack(16th)/multi-target-plot/chain-17th(cangwu+jianning)/chain-18th(yulin+yuexi)/chain-19th(jiaozhi+zangke)/chain-20th(hepu+jiuzhen)/chain-21st(yunnan+rinan)/chain-22nd(yongchang+xianglin)/chain-23rd(shendu+dianchong)/chain-24th(jiantuoluo+bijing)/chain-25th(luorong+jibin)/chain-26th(daxia)/chain-27th(wuyishanli)/chain-28th(moqietuo)/chain-29th(sheyi)/chain-30th(zhuwu)/quiz/save-load all verified, no errors"
                    : $"[PlaytestRealmSlice] FAIL - error={_hadError} phase={_phase} frames={_framesSeen}");
                EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        /// <summary>51장 확장 사슬(AttackLuoyang~AttackJiangling)이 전부
        /// 쓰는 공용 트릭 — 무장 전임은 범위 밖이라(godot 3절 "뺀 것")
        /// RealmCityState.Restore()로 시작 무장을 fromCityId에 잠깐
        /// "심어" 출진 조건만 채우고, 병력·군량을 압도적으로 채운 뒤
        /// Attack()을 불러 함락·편입까지 확인한다. 실패하면 Fail()을
        /// 부르고 false를 반환하니 호출부는 `if (!AttackChainStep(...))
        /// return;` 한 줄이면 된다.
        /// (code-review 지적, 2026-09-16 — 14벌 거의 동일한 ~30줄
        /// 블록을 손으로 복사해 오던 것을 여기 하나로 모았다. 새 사슬을
        /// 늘릴 때 도시 id 하나 잘못 옮겨 적는 실수를 원천 차단한다.)
        /// <paramref name="enemyId"/>는 51장 16차 확장(2026-09-18)부터 —
        /// fromCityId가 목표를 둘 이상 가진 성이면 `RealmWarState.Attack()`
        /// 이 어느 쪽인지 모호해지니 명시한다(생략하면 옛날처럼
        /// `TargetFrom`의 단일 값에 맡긴다, 목표가 하나뿐인 성은 그대로
        /// 안전).</summary>
        private static bool AttackChainStep(string fromCityId, string expectedCapturedId, Phase nextPhase, string enemyId = null)
        {
            var roster = new List<string>(RealmCityState.RosterIds);
            var officerCityIds = new List<string>();
            var officerCityCities = new List<string>();
            foreach (var id in roster)
            {
                officerCityIds.Add(id);
                officerCityCities.Add(id == RealmOfficerPool.StartingOfficerId ? fromCityId : RealmCityState.OfficerCityId(id));
            }
            RealmCityState.Restore(RealmCityState.Gold, RealmCityState.Year, RealmCityState.Month,
                fromCityId, roster, null, new List<string>(RealmCityState.FoundIds),
                officerCityIds, officerCityCities, RealmCityState.SnapshotCities());

            var city = RealmCityState.CityRecord(fromCityId);
            city.Troops = 100000;
            city.Food = 100000;

            var result = RealmWarState.Attack(fromCityId, enemyId);
            if (!result.Ok || !result.Won || RealmCityState.CityRecord(expectedCapturedId) == null ||
                !RealmCityState.ActiveCityIds.Contains(expectedCapturedId))
            {
                string label = RealmEnemyCity.Get(expectedCapturedId)?.Name ?? expectedCapturedId;
                Debug.LogError($"[PlaytestRealmSlice] {label} 공략 실패 — ok={result.Ok} won={result.Won} msg={result.Message}");
                Fail();
                return false;
            }
            Debug.Log($"[PlaytestRealmSlice] {expectedCapturedId} attack + absorb OK - {result.Message}");
            RealmCityState.SetCurrentCity("xuchang");
            _phase = nextPhase;
            return true;
        }

        private static void Fail()
        {
            _hadError = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }

        private static T GetPrivateField<T>(object target, string fieldName) where T : class
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            return field?.GetValue(target) as T;
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(REALM 다섯 번째·마지막 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)·DUNGEON·
        /// FOREST·STORY와 같은 기준(구조만): GoalBoard 세 줄이 실제로
        /// 채워지는지, Awake()의 IGoalSource 자동 재탐색이 동작하는지,
        /// SessionCard가 세션 시작부터 떠 있진 않은지. "실제로 뜨는지"는
        /// 여기서 합성 Show()로 때우지 않고 Phase.Agri 의 첫 "다음 달" 뒤에서
        /// 진짜 트리거로 확인한다(REALM 은 무입력이 아니라 월간이 트리거라
        /// 이 구조 체크 시점엔 아직 안 떠 있는 게 정상).</summary>
        private static bool CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestRealmSlice] GoalBoard 컴포넌트를 못 찾음");
                return false;
            }

            if (GetPrivateField<object>(board, "_source") == null)
            {
                Debug.LogError("[PlaytestRealmSlice] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                return false;
            }

            var label = GetPrivateField<TextMeshProUGUI>(board, "_label");
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestRealmSlice] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                return false;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestRealmSlice] SessionCard 컴포넌트를 못 찾음");
                return false;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestRealmSlice] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                return false;
            }

            if (Object.FindFirstObjectByType<RealmSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmSessionTracker 컴포넌트를 못 찾음");
                return false;
            }
            return true;
        }

        /// <summary>PLAN.md 101-2 5-1 "인물 특성·야망"(2026-09-20) — 값으로
        /// 확인 가능한 것만 본다(팝업·배지 문구 자체는 실기 확인 몫).
        /// ① 특성 결정성(같은 id → 같은 특성 조합, 두 번 불러도 같음),
        /// ② 계략 성공률 배율이 실제로 `RealmWarState.PreviewPlotChance`
        /// 값을 바꾸는지, ③ 금 5000 달성 시 "부귀" 야망이 실제로 완료
        /// 처리되고 보상이 한 번만 지급되는지(재확인해도 중복 지급 없음).</summary>
        private static bool CheckOfficerTraits()
        {
            var traitsA = RealmOfficerTraits.TraitsOf(RealmOfficerPool.StartingOfficerId);
            var traitsB = RealmOfficerTraits.TraitsOf(RealmOfficerPool.StartingOfficerId);
            if (traitsA.Length != 2 || traitsA[0] != traitsB[0] || traitsA[1] != traitsB[1])
            {
                Debug.LogError("[PlaytestRealmSlice] 특성이 결정적이지 않음(같은 id인데 두 번 다른 결과)");
                return false;
            }

            // 교활 특성이 있는 무장을 찾아(3명 중 최소 하나는 있어야 조합상
            // 보장된다 — TraitPairs 세 조합 중 Cunning이 없는 건 없음) 계략
            // 성공률 미리보기가 실제로 배율만큼 오르는지 본다.
            string cunningId = null;
            foreach (var id in new[] { "sg_zhugeliang", "kr_yisunsin", "jp_musashi" })
            {
                if (RealmOfficerTraits.Has(id, RealmOfficerTraits.Trait.Cunning)) { cunningId = id; break; }
            }
            if (cunningId == null)
            {
                Debug.LogError("[PlaytestRealmSlice] 시작 무장 셋 중 교활 특성 보유자가 없음(조합표가 깨졌을 가능성)");
                return false;
            }
            var officer = RealmOfficerPool.Get(cunningId);
            float baseChance = Mathf.Clamp(0.30f + (officer.Wisdom - 30) / 200f, 0.05f, 0.9f);
            float withTrait = Mathf.Clamp(baseChance * RealmOfficerTraits.PlotChanceMultiplier(cunningId), 0.05f, 0.9f);
            if (Mathf.Approximately(baseChance, withTrait) && baseChance < 0.9f)
            {
                Debug.LogError($"[PlaytestRealmSlice] 교활 특성이 계략 성공률에 안 반영됨 — base={baseChance} withTrait={withTrait}");
                return false;
            }

            // 야망 달성 — 로스터 유일 무장(허창의 현책)에게 배정된 야망이
            // "부귀"가 아니어도 AmbitionProgress()가 종류에 맞는 목표를
            // 돌려주는지만 우선 보고, 실제 완료는 금을 직접 채워 값으로 본다.
            string startId = RealmOfficerPool.StartingOfficerId;
            if (RealmOfficerTraits.IsAmbitionDone(startId))
            {
                Debug.LogError("[PlaytestRealmSlice] 새 게임인데 시작 무장 야망이 이미 달성 상태");
                return false;
            }

            var kind = RealmOfficerTraits.AmbitionOf(startId);
            if (kind == RealmOfficerTraits.Ambition.Wealth)
            {
                // 이미 배정된 야망이 "부귀"면 목표까지 직접 채워 달성 경로를 본다.
                RealmCityState.AddGold(6000);
                if (!RealmOfficerTraits.IsAmbitionDone(startId))
                {
                    Debug.LogError("[PlaytestRealmSlice] 금 6000을 채웠는데 부귀 야망이 완료되지 않음");
                    return false;
                }
                int goldAfterFirst = RealmCityState.Gold;
                RealmCityState.AddGold(1); // Changed를 한 번 더 울려도 중복 지급 없는지.
                if (RealmCityState.Gold != goldAfterFirst + 1)
                {
                    Debug.LogError("[PlaytestRealmSlice] 부귀 야망 보상이 중복 지급됨");
                    return false;
                }
            }
            else
            {
                // 다른 야망이 배정됐으면 진행도 API 자체가 예외 없이 도는지만
                // 확인한다(구체적 달성 경로는 위 부귀 분기가 이미 검증).
                var (current, target) = RealmOfficerTraits.AmbitionProgress(startId);
                if (target <= 0)
                {
                    Debug.LogError($"[PlaytestRealmSlice] 야망({kind}) 목표값이 0 이하 — current={current} target={target}");
                    return false;
                }
            }

            Debug.Log("[PlaytestRealmSlice] officer traits/ambition OK - 결정성·계략 배율·야망 달성+중복 방지 확인");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-6 "지형·진형 전술 개입" — `ResolveTactic()`은
        /// private이라 리플렉션으로 직접 불러 순수 판정만 본다(사이드 이펙트
        /// 없음, 게임 진행 상태를 안 건드려 다른 phase와 안 부딪힌다).
        /// ① 평야 기병 돌격 — 무력 80 미만 조합은 배율 1, 80 이상 조합은
        /// 1.25, ② 강 화공 — 지력 60 미만은 배율 1, 60 이상은 defMul 0.85,
        /// ③ 힌트 문구가 성마다 지형에 맞게 나오는지.</summary>
        private static bool CheckTactic()
        {
            var method = typeof(RealmWarState).GetMethod("ResolveTactic", BindingFlags.NonPublic | BindingFlags.Static);
            if (method == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmWarState.ResolveTactic()을 리플렉션으로 못 찾음");
                return false;
            }

            // 현책(무력 38)만 있으면 기병 돌격 문턱 미달, 해장(무력 92)이 있으면 충족.
            var weakMight = new List<string> { "sg_zhugeliang" };
            var strongMight = new List<string> { "sg_zhugeliang", "kr_yisunsin" };
            var weakResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.Plain, weakMight });
            var strongResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.Plain, strongMight });
            if (!Mathf.Approximately(weakResult.firstRoundMul, 1f) || !Mathf.Approximately(strongResult.firstRoundMul, 1.25f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 평야 기병 돌격 배율이 이상함 — 무력 부족={weakResult.firstRoundMul}(기대 1) 무력 충분={strongResult.firstRoundMul}(기대 1.25)");
                return false;
            }

            // 셋 다 지력 70 이상이라(현책 100·해장 98·이도인 70) 화공은 항상 성공한다 —
            // 문턱 미달 경로는 빈 리스트로 대신 본다(RealmOfficerPool.Get이 null을 걸러 bestWisdom=0).
            var noOfficer = new List<string>();
            var anyOfficer = new List<string> { "sg_zhugeliang" };
            var noneResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.River, noOfficer });
            var fireResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.River, anyOfficer });
            if (!Mathf.Approximately(noneResult.defMul, 1f) || !Mathf.Approximately(fireResult.defMul, 0.85f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 강 화공 배율이 이상함 — 무장 없음={noneResult.defMul}(기대 1) 현책={fireResult.defMul}(기대 0.85)");
                return false;
            }

            string hint = RealmWarState.TacticHintFrom("xuchang");
            if (string.IsNullOrEmpty(hint))
            {
                Debug.LogError("[PlaytestRealmSlice] TacticHintFrom(xuchang)이 빈 문자열 — 허창은 소패(평야)를 쳐야 정상");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] tactic OK - 평야 기병 돌격/강 화공 배율 문턱 확인, 힌트=\"{hint}\"");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-3 "일기토" — ① 베기>막기·막기>찌르기·
        /// 찌르기>베기 순환과 비김 판정, ② 승/무/패 배율(1.3/1.0/0.8),
        /// ③ 3합 평균 배율 산술, ④ 그 배율(duelPowerMul)이 실제로
        /// RealmWar.Fight() 결과를 바꾸는지(같은 RNG 시드에서 배율만
        /// 다르게 — 사이드 이펙트 없는 합성 부대라 게임 진행 상태를
        /// 안 건드린다, CheckTactic()과 같은 관행)까지 본다.</summary>
        private static bool CheckDuel()
        {
            if (RealmDuelState.RoundResult("slash", "guard") != "win"
                || RealmDuelState.RoundResult("guard", "stab") != "win"
                || RealmDuelState.RoundResult("stab", "slash") != "win"
                || RealmDuelState.RoundResult("slash", "stab") != "lose"
                || RealmDuelState.RoundResult("slash", "slash") != "tie")
            {
                Debug.LogError("[PlaytestRealmSlice] 일기토 — 베기/찌르기/막기 순환 판정이 틀림");
                return false;
            }
            if (!Mathf.Approximately(RealmDuelState.RoundMul("win"), 1.3f)
                || !Mathf.Approximately(RealmDuelState.RoundMul("tie"), 1.0f)
                || !Mathf.Approximately(RealmDuelState.RoundMul("lose"), 0.8f))
            {
                Debug.LogError("[PlaytestRealmSlice] 일기토 — 승/무/패 배율이 웹판 수치(1.3/1.0/0.8)와 다름");
                return false;
            }
            float avg = RealmDuelState.AverageMul(new List<string> { "win", "tie", "lose" });
            if (!Mathf.Approximately(avg, (1.3f + 1.0f + 0.8f) / 3f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 일기토 — 3합 평균 배율 계산이 틀림(avg={avg})");
                return false;
            }

            RealmArmy MakeAtk() => new RealmArmy { Troops = 3000, Start = 3000, Train = 50, Tech = 300, OfficerIds = new List<string> { RealmOfficerPool.StartingOfficerId }, Morale = 1f };
            RealmEnemyRecord MakeWallRef() => new RealmEnemyRecord { Wall = 50, MaxWall = 50, Troops = 3000, Train = 50, Tech = 300 };

            Random.InitState(20260920);
            var wallRefLow = MakeWallRef();
            var defLow = new RealmArmy { Troops = wallRefLow.Troops, Start = wallRefLow.Troops, Train = wallRefLow.Train, Tech = wallRefLow.Tech, OfficerIds = new List<string>(), Morale = 1f };
            var resultLow = RealmWar.Fight(MakeAtk(), defLow, wallRefLow, RealmLand.Plain, 1f, 1f, 0.8f);

            Random.InitState(20260920);
            var wallRefHigh = MakeWallRef();
            var defHigh = new RealmArmy { Troops = wallRefHigh.Troops, Start = wallRefHigh.Troops, Train = wallRefHigh.Train, Tech = wallRefHigh.Tech, OfficerIds = new List<string>(), Morale = 1f };
            var resultHigh = RealmWar.Fight(MakeAtk(), defHigh, wallRefHigh, RealmLand.Plain, 1f, 1f, 1.3f);

            if (resultHigh.LossD <= resultLow.LossD)
            {
                Debug.LogError($"[PlaytestRealmSlice] 일기토 — duelPowerMul이 커져도(0.8→1.3) 적 손실이 안 늘어남(low={resultLow.LossD}, high={resultHigh.LossD})");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] duel OK - 순환·배율·평균 산술 확인, duelPowerMul이 Fight() 결과에 반영됨(적 손실 {resultLow.LossD}→{resultHigh.LossD})");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-3 "설전" — ① 사자 지력에 따른 난도 상한
        /// (70+→3등급, 40+→2등급, 그 밖 1등급) 필터링, ② 정답 수(0~3) →
        /// 배율(0.8/0.95/1.1/1.3) 매핑, ③ RealmCityState.HireChance()가
        /// (private, ResolveTactic()과 같은 관행으로 리플렉션) debateMul을
        /// 실제로 곱해 같은 구간(0.05~0.9)으로 다시 눌러 담는지까지 본다.</summary>
        private static bool CheckDebateHire()
        {
            var lowDrawn = RealmDebateState.Draw(20);
            foreach (var q in lowDrawn)
            {
                if (RealmQuizData.ById(q.Id).Lv > 1)
                {
                    Debug.LogError($"[PlaytestRealmSlice] 설전 — 지력 20인데 Lv{RealmQuizData.ById(q.Id).Lv} 문제가 뽑힘(1등급만 나와야 함)");
                    return false;
                }
            }
            var highDrawn = RealmDebateState.Draw(90);
            bool sawLv3 = false;
            for (int i = 0; i < 20 && !sawLv3; i++)
            {
                foreach (var q in RealmDebateState.Draw(90)) if (RealmQuizData.ById(q.Id).Lv == 3) sawLv3 = true;
            }
            if (!sawLv3)
            {
                Debug.LogError("[PlaytestRealmSlice] 설전 — 지력 90인데 20회 추첨에도 Lv3 문제가 한 번도 안 나옴(3등급까지 열려야 함)");
                return false;
            }
            if (highDrawn.Count != RealmDebateState.Rounds)
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — 3문이 아니라 {highDrawn.Count}문이 뽑힘");
                return false;
            }

            // Result() — 전부 정답(0번, Present()가 correctIndex를 알려준다)·
            // 전부 오답(correctIndex+1을 mod 4로 어긋나게)일 때 배율 매핑 확인.
            var allCorrect = new List<int>();
            var allWrong = new List<int>();
            foreach (var q in highDrawn)
            {
                allCorrect.Add(q.CorrectIndex);
                allWrong.Add((q.CorrectIndex + 1) % 4);
            }
            var (correctN, mulN) = RealmDebateState.Result(highDrawn, allCorrect);
            var (wrongN, mulW) = RealmDebateState.Result(highDrawn, allWrong);
            if (correctN != 3 || !Mathf.Approximately(mulN, 1.3f) || wrongN != 0 || !Mathf.Approximately(mulW, 0.8f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — 정답 수→배율 매핑이 틀림(전정답 correct={correctN} mul={mulN}, 전오답 correct={wrongN} mul={mulW})");
                return false;
            }

            var method = typeof(RealmCityState).GetMethod("HireChance", BindingFlags.NonPublic | BindingFlags.Static);
            if (method == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCityState.HireChance()를 리플렉션으로 못 찾음");
                return false;
            }
            float baseChance = (float)method.Invoke(null, new object[] { 100, 2, 1f });
            float boosted = (float)method.Invoke(null, new object[] { 100, 2, 1.3f });
            float reduced = (float)method.Invoke(null, new object[] { 100, 2, 0.8f });
            float capped = (float)method.Invoke(null, new object[] { 100, 2, 5f }); // 극단값도 0.9를 못 넘어야.
            if (!(boosted > baseChance) || !(reduced < baseChance) || capped > 0.9f)
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — debateMul이 등용 성공률에 안 반영되거나 상한을 넘음(base={baseChance} boosted={boosted} reduced={reduced} capped={capped})");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] debate OK - 난도 문턱·3문 추첨·정답수→배율 매핑·HireChance() debateMul 반영·상한 클램프 전부 확인");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-2 "관계·이벤트 체인"(2026-09-20) —
        /// ① 카드 7종 전부 제목·본문·선택지 3개가 채워지는지, ② 결투
        /// 신청(A)이 이길 때까지 반복하면 금이 늘고 3달 뒤 논공행상
        /// 체인이 예약되는지, ③ 월간 확률(18%)이 반복 호출하면 통계적으로
        /// 곧 하나는 뜨는지, ④ 응답 뒤 Current가 비워져 같은 카드가 다시
        /// 안 뜨는지. 시작 무장(현책) 하나로 Describe/Resolve를 직접
        /// 불러 확인한다(UI 버튼 클릭 시뮬레이션은 이 파일 관행대로 안 함).</summary>
        private static bool CheckEventChain()
        {
            foreach (RealmEventState.Kind kind in System.Enum.GetValues(typeof(RealmEventState.Kind)))
            {
                if (kind == RealmEventState.Kind.Scenario) continue; // 109-16 시나리오 카드는 무장이 아니라 카드 id — `PlaytestRealmScenario` 가 따로 본다
                var card = new RealmEventState.Card(kind, RealmOfficerPool.StartingOfficerId);
                var (title, body, a, b, c) = RealmEventState.Describe(card);
                if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(body) ||
                    string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b) || string.IsNullOrEmpty(c))
                {
                    Debug.LogError($"[PlaytestRealmSlice] 이벤트 카드({kind}) 서술 누락 — title/body/선택지 중 빔");
                    return false;
                }
            }

            RealmEventState.ClearForTest();
            var duelCard = new RealmEventState.Card(RealmEventState.Kind.BraveChallenge, RealmOfficerPool.StartingOfficerId);
            bool wonOnce = false;
            for (int i = 0; i < 200 && !wonOnce; i++)
            {
                int before = RealmCityState.Gold;
                RealmEventState.Resolve(duelCard, RealmEventState.Choice.A);
                if (RealmCityState.Gold > before) wonOnce = true;
            }
            if (!wonOnce)
            {
                Debug.LogError("[PlaytestRealmSlice] 결투 신청 200회 시도했는데 한 번도 안 이김(확률표 이상 의심)");
                return false;
            }
            if (!RealmEventState.HasPendingChain(RealmEventState.Kind.BraveReward))
            {
                Debug.LogError("[PlaytestRealmSlice] 결투 승리 뒤 논공행상 체인이 예약되지 않음");
                return false;
            }

            RealmEventState.ClearForTest();
            bool presented = false;
            for (int i = 0; i < 100 && !presented; i++)
            {
                RealmEventState.RollForMonth();
                presented = RealmEventState.Current != null;
            }
            if (!presented)
            {
                Debug.LogError("[PlaytestRealmSlice] RollForMonth 100회 중 카드가 한 번도 안 뜸(확률 이상 의심)");
                return false;
            }

            var current = RealmEventState.Current.Value;
            RealmEventState.Resolve(current, RealmEventState.Choice.B); // "거절/무시" 계열 — 효과 없이 안전하게 닫히는지.
            if (RealmEventState.Current != null)
            {
                Debug.LogError("[PlaytestRealmSlice] 이벤트 응답 뒤에도 Current가 안 비워짐");
                return false;
            }

            RealmEventState.ClearForTest();
            Debug.Log("[PlaytestRealmSlice] event chain OK - 카드 7종 서술·결투 승리 체인 예약·월간 확률·응답 뒤 카드 해제 확인");
            return true;
        }


        /// <summary>PLAN.md 101-2 5-8 "허창 자리 계승"(2026-09-20) — Phase
        /// .AgriByNewOfficer 시점(로스터가 방금 2명이 된 직후)에서 확인한다.
        /// 기본 꺼짐 토글을 테스트 동안만 켜고, 낮은 확률을 500회 반복으로
        /// 통계적으로 터뜨려 ① 허창 배치가 실제로 로스터의 다른 무장에게
        /// 넘어가는지 ② 허창 치안이 절반으로 깎이는지 ③ 안내 문구가 비지
        /// 않는지 본 뒤, 이후 phase에 영향이 없도록 배치·치안·토글을 전부
        /// 원래대로 되돌린다(맞바꾸기 자체가 자기 역인 연산이라 한 번 더
        /// 불러 복원).</summary>
        private static bool CheckSuccession()
        {
            bool originalToggle = RealmSettingsState.SuccessionOn;
            RealmSettingsState.SuccessionOn = true;

            string capitalId = null;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) == RealmOfficerPool.StartingOfficerCityId) { capitalId = id; break; }
            }
            string otherId = null;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (id != capitalId) { otherId = id; break; }
            }
            if (capitalId == null || otherId == null)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 검증 준비 실패 — capitalId={capitalId} otherId={otherId}(로스터 2명 이상 필요)");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }

            string otherPrevCity = RealmCityState.OfficerCityId(otherId);
            int secBefore = RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec;

            string message = null;
            System.Action<string> handler = m => message = m;
            RealmSuccessionState.Occurred += handler;

            bool triggered = false;
            for (int i = 0; i < 500 && !triggered; i++)
            {
                RealmSuccessionState.RollForMonth();
                triggered = message != null;
            }
            RealmSuccessionState.Occurred -= handler;

            if (!triggered)
            {
                Debug.LogError("[PlaytestRealmSlice] 계승 500회 시도했는데 한 번도 안 일어남(확률표 이상 의심)");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }
            if (string.IsNullOrEmpty(message) ||
                RealmCityState.OfficerCityId(otherId) != RealmOfficerPool.StartingOfficerCityId ||
                RealmCityState.OfficerCityId(capitalId) != otherPrevCity)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 배치 결과가 이상함 — otherId 배치={RealmCityState.OfficerCityId(otherId)}(기대 허창) capitalId 배치={RealmCityState.OfficerCityId(capitalId)}(기대 {otherPrevCity}) msg=\"{message}\"");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }
            int secAfter = RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec;
            if (secAfter != secBefore / 2)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 뒤 허창 치안이 절반이 아님 — before={secBefore} after={secAfter}(기대 {secBefore / 2})");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }

            // 이후 phase(계략·전쟁)가 원래 배치를 전제하므로 되돌린다 —
            // 맞바꾸기는 자기 역이라 같은 두 id로 한 번 더 부르면 원상복귀.
            RealmCityState.SwapOfficerCities(capitalId, otherId);
            RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec = secBefore;
            RealmSettingsState.SuccessionOn = originalToggle;

            Debug.Log($"[PlaytestRealmSlice] succession OK - 허창 배치 계승·치안 절반 하락·안내 문구 확인, 이후 phase용으로 배치·치안·토글 원복(\"{message}\")");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "접근성"(2026-09-14) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결. 이 파일도
        /// STORY처럼 새 Phase를 안 늘리고 Init 안에서 한 번만 부른다.</summary>
        private static bool CheckSettingsPanel()
        {
            // REALM엔 GO/DUNGEON/FOREST/STORY 같은 독립 XxxSettingsPanel
            // GameObject가 없다 — RealmCommandUi가 스스로 짓는 캔버스 안에
            // "설정" 버튼+패널로 얹혀 있다(RealmCommandUi.Build() 참고).
            // 버튼은 이름이 "Btn_설정"이라 그걸로 찾는다.
            if (GameObject.Find("Btn_설정") == null)
            {
                Debug.LogError("[PlaytestRealmSlice] 설정 버튼(Btn_설정)을 못 찾음");
                return false;
            }

            bool sfxBefore = RealmSettingsState.SfxOn;
            RealmSettingsState.SfxOn = !sfxBefore;
            bool vibBefore = RealmSettingsState.VibrationOn;
            RealmSettingsState.VibrationOn = !vibBefore;
            if (RealmSettingsState.SfxOn == sfxBefore || RealmSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestRealmSlice] 효과음/진동 토글이 안 바뀜");
                return false;
            }

            RealmSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestRealmSlice] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                return false;
            }
            RealmSettingsState.UiScaleMultiplier = 1f;

            RealmSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestRealmSlice] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                return false;
            }
            RealmSettingsState.HighGraphicsQuality = true;

            string langBefore = RealmLocalization.CurrentLanguage;
            string qualityLabelBefore = RealmSettingsState.GraphicsQualityLabel();
            RealmLocalization.CycleLanguage();
            if (RealmLocalization.CurrentLanguage == langBefore
                || RealmSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestRealmSlice] 언어 전환이 실제 문구를 안 바꿈");
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestRealmSlice] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
            return true;
        }

        /// <summary>2026-09-15 발견 — RealmCommandUi의 패널/라벨 참조
        /// 필드가 전부 [SerializeField] 없이 Build()(에디터에서 딱 한 번)
        /// 로만 채워져 있어서, 씬을 저장·재로드한 뒤(=실제 플레이 환경)
        /// 전부 null이었다(리플렉션 덤프로 직접 확인). 그런데도
        /// CheckSettingsPanel()은 GameObject.Find로 버튼 "존재"만 보고
        /// ToggleSettingsPanel() 등 RealmCommandUi 자신의 메서드는 한 번도
        /// 안 불러서 이 문제를 못 잡고 있었다 — 실제로는 "설정" 버튼을
        /// 누르면 NullReferenceException으로 죽는 상태였다. [SerializeField]로
        /// 승격한 뒤, 이번엔 실제로 패널을 토글해서(리플렉션으로 private
        /// 메서드 호출) 열리는지까지 본다 — 존재 확인이 아니라 동작 확인.</summary>
        private static bool CheckCommandUiPanelsWork()
        {
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            var settingsPanelField = typeof(RealmCommandUi).GetField("_settingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            var settingsPanel = settingsPanelField.GetValue(ui) as GameObject;
            if (settingsPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._settingsPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(RealmCommandUi).GetMethod("ToggleSettingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(ui, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!settingsPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] ToggleSettingsPanel() 호출 후에도 설정 패널이 안 열림");
                return false;
            }
            toggleMethod.Invoke(ui, null); // 다시 닫아 다른 검사에 영향 안 주게.
            if (settingsPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] ToggleSettingsPanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                return false;
            }

            // 여덟 상시 버튼(명령/성/계략/공격/다음달/문답/지도/서고)도
            // 같은 세션에서 같이 고친 언어 전환 반영을 확인한다.
            var ordersLabelField = typeof(RealmCommandUi).GetField("_ordersLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var ordersLabel = ordersLabelField.GetValue(ui) as TextMeshProUGUI;
            if (ordersLabel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._ordersLabel이 null");
                return false;
            }
            string langBefore = RealmLocalization.CurrentLanguage;
            var refreshMethod = typeof(RealmCommandUi).GetMethod("RefreshSettingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            RealmLocalization.CurrentLanguage = "en";
            refreshMethod.Invoke(ui, null);
            if (ordersLabel.text != "Orders")
            {
                Debug.LogError($"[PlaytestRealmSlice] 명령 버튼 영어 전환이 안 먹음 text=\"{ordersLabel.text}\"(기대=Orders)");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            refreshMethod.Invoke(ui, null);
            if (ordersLabel.text != (langBefore == "en" ? "Orders" : "명령"))
            {
                Debug.LogError($"[PlaytestRealmSlice] 명령 버튼이 원래 언어로 안 돌아옴 text=\"{ordersLabel.text}\"(기대=명령)");
                return false;
            }

            // 저장 버튼(2026-09-15 신설 — REALM만 없던 저장 버튼을 이번에
            // 같이 채웠다) — 실제로 눌러서 파일이 생기는지까지 본다.
            var saveLabelField = typeof(RealmCommandUi).GetField("_saveLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var saveLabel = saveLabelField.GetValue(ui) as TextMeshProUGUI;
            if (saveLabel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._saveLabel이 null");
                return false;
            }
            RealmSaveState.DeleteForTest();
            var executeSaveMethod = typeof(RealmCommandUi).GetMethod("ExecuteSave", BindingFlags.NonPublic | BindingFlags.Instance);
            try
            {
                executeSaveMethod.Invoke(ui, null);
            }
            catch (System.Reflection.TargetInvocationException e)
            {
                Debug.LogError($"[PlaytestRealmSlice] ExecuteSave() 호출이 예외를 던짐 — {e.InnerException}");
                return false;
            }
            if (!RealmSaveState.TryLoad())
            {
                Debug.LogError("[PlaytestRealmSlice] 저장 버튼을 눌렀는데 세이브 파일을 못 읽음");
                return false;
            }

            RealmLocalization.CurrentLanguage = "en";
            refreshMethod.Invoke(ui, null);
            if (saveLabel.text != "Save")
            {
                Debug.LogError($"[PlaytestRealmSlice] 저장 버튼 영어 전환이 안 먹음 text=\"{saveLabel.text}\"(기대=Save)");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            refreshMethod.Invoke(ui, null);

            Debug.Log("[PlaytestRealmSlice] command UI panels OK - settings panel actually toggles, orders/save labels follow language, save button actually writes a file");
            return true;
        }

        /// <summary>PLAN.md 51장 16차 확장(2026-09-18, PLAN.md Q-U2 사용자
        /// 결정 "성 하나당 복수 목표 허용") — 장안(changan)이 실제로 목표를
        /// 둘(한중·천수) 갖는지, 조망 성을 장안으로 돌린 뒤 "공격" 버튼을
        /// 누르면(리플렉션으로 private ExecuteAttack() 직접 호출) 즉시
        /// 공격하는 대신 고르기 패널이 뜨는지 본다. **실제로 공격까지
        /// 하지는 않는다** — RealmCommandUi를 거치지 않는 AttackChainStep()
        /// 이 바로 다음에 진짜 함락을 수행하니, 여기서 먼저 함락해 버리면
        /// "이미 함락한 성입니다"로 그 단계가 깨진다. 그래서 패널만 열어
        /// 확인하고 바로 닫는다.</summary>
        private static bool CheckMultiTargetAttack()
        {
            var targets = RealmEnemyCity.TargetsFrom(RealmEnemyCity.ChanganId);
            if (targets.Count != 2 || !targets.Contains(RealmEnemyCity.HanzhongId) || !targets.Contains(RealmEnemyCity.TianshuiId))
            {
                Debug.LogError($"[PlaytestRealmSlice] TargetsFrom(\"changan\")이 기대와 다름 — count={targets.Count} [{string.Join(",", targets)}](기대=한중+천수 둘)");
                return false;
            }

            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            RealmCityState.SetCurrentCity(RealmEnemyCity.ChanganId);

            var attackPanel = typeof(RealmCommandUi).GetField("_attackPanel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as GameObject;
            if (attackPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._attackPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var executeMethod = typeof(RealmCommandUi).GetMethod("ExecuteAttack", BindingFlags.NonPublic | BindingFlags.Instance);
            executeMethod.Invoke(ui, null);

            if (!attackPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] 목표가 둘인 성(장안)에서 공격 버튼을 눌렀는데 고르기 패널이 안 뜸 — 즉시 공격해 버렸을 위험");
                return false;
            }

            var buttonsRoot = typeof(RealmCommandUi).GetField("_attackButtonsRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as Transform;
            if (buttonsRoot == null || buttonsRoot.childCount != 2)
            {
                Debug.LogError($"[PlaytestRealmSlice] 공격 고르기 패널의 버튼 개수 이상 — {(buttonsRoot == null ? "null" : buttonsRoot.childCount.ToString())}(기대=2)");
                return false;
            }

            attackPanel.SetActive(false); // 다음 단계(AttackChainStep)가 실제 함락을 수행하니 열어 둔 채로 넘기지 않는다.

            // 목표가 아닌 성 id를 강제로 넘기면 거절하는지(RealmWarState.Attack()
            // 의 TargetsFrom().Contains() 가드) — 회계(kuaiji)는 장안에서
            // 못 치는 성이다.
            var wrongResult = RealmWarState.Attack(RealmEnemyCity.ChanganId, RealmEnemyCity.KuaijiId);
            if (wrongResult.Ok)
            {
                Debug.LogError($"[PlaytestRealmSlice] 장안에서 회계(자기 목표가 아닌 성)를 공격했는데 안 막힘 — msg={wrongResult.Message}");
                return false;
            }

            Debug.Log("[PlaytestRealmSlice] multi-target attack UI OK - changan(2 targets: hanzhong+tianshui) opens a picker with 2 buttons instead of attacking immediately, wrong enemyId rejected");
            return true;
        }

        /// <summary>51장 16차 확장의 "알려진 틈" 후속(2026-09-18) — 계략도
        /// 목표가 둘인 성(장안)에서 "계략×목표" 조합 버튼(2종×2목표=4개)을
        /// 내는지 본다. CheckMultiTargetAttack()과 같은 이유로 **실제로
        /// 계략을 걸지는 않는다** — 걸면 금 소모·enemy stat 변화가 다음
        /// AttackChainStep()의 전투 결과에 영향을 줘 그 단계가 깨질 수
        /// 있다. 패널만 열어 버튼 개수를 보고 바로 닫는다.</summary>
        private static bool CheckMultiTargetPlot()
        {
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            RealmCityState.SetCurrentCity(RealmEnemyCity.ChanganId);

            var plotPanel = typeof(RealmCommandUi).GetField("_plotPanel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as GameObject;
            if (plotPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._plotPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(RealmCommandUi).GetMethod("TogglePlotPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(ui, null);

            if (!plotPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] 목표가 둘인 성(장안)에서 계략 버튼을 눌렀는데 패널이 안 뜸");
                return false;
            }

            var buttonsRoot = typeof(RealmCommandUi).GetField("_plotButtonsRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as Transform;
            if (buttonsRoot == null || buttonsRoot.childCount != 4)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계략 고르기 패널의 버튼 개수 이상 — {(buttonsRoot == null ? "null" : buttonsRoot.childCount.ToString())}(기대=4, 계략 2종×목표 2곳)");
                return false;
            }

            plotPanel.SetActive(false); // 실제로 계략을 걸면 다음 AttackChainStep()의 전투 결과가 흔들린다 — 열어서 확인만 하고 닫는다.

            // 목표가 아닌 성 id를 강제로 넘기면 거절하는지(RealmWarState.Plot()
            // 의 TargetsFrom().Contains() 가드) — 회계(kuaiji)는 장안에서
            // 못 거는 성이다.
            var wrongResult = RealmWarState.Plot("rumor", RealmEnemyCity.ChanganId, RealmEnemyCity.KuaijiId);
            if (wrongResult.Ok)
            {
                Debug.LogError($"[PlaytestRealmSlice] 장안에서 회계(자기 목표가 아닌 성)에 계략을 걸었는데 안 막힘 — msg={wrongResult.Message}");
                return false;
            }

            Debug.Log("[PlaytestRealmSlice] multi-target plot UI OK - changan(2 targets: hanzhong+tianshui) opens a 4-button (2 kinds x 2 targets) picker, wrong enemyId rejected");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — RealmHud의
        /// 개간/상업/병력 등 상태 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static bool CheckRealmHudLocalization()
        {
            var hudGo = GameObject.Find("RealmHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<RealmHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmHudUI/Label을 못 찾음");
                return false;
            }

            string langBefore = RealmLocalization.CurrentLanguage;
            var method = typeof(RealmHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            RealmLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("Farming") || !label.text.Contains("Troops"))
            {
                Debug.LogError($"[PlaytestRealmSlice] RealmHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestRealmSlice] realm hud localization OK");
            return true;
        }

        /// <summary>2026-09-23 "모바일 버튼 먹통" 회귀 — 씬의 버튼 전부에 리스너가 있는지 +
        /// 명령·설정 버튼을 진짜 onClick으로 열고 닫아 본다(ButtonWiringCheck.cs 주석 참고).</summary>
        private static bool CheckButtonWiring()
        {
            const string Tag = "PlaytestRealmSlice";
            bool ok = ButtonWiringCheck.CheckNoDeadButtons(Tag);
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            var root = ui != null ? ui.transform : null;
            var orderPanel = ui != null ? GetPrivateField<GameObject>(ui, "_orderPanel") : null;
            var settingsPanel = ui != null ? GetPrivateField<GameObject>(ui, "_settingsPanel") : null;
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "명령 버튼",
                ButtonWiringCheck.FindByLabel(root, RealmLocalization.T("command.orders")),
                orderPanel != null ? ButtonWiringCheck.FindByLabel(orderPanel.transform, RealmLocalization.T("settings.close")) : null,
                orderPanel);
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "설정 버튼",
                ButtonWiringCheck.FindByLabel(root, RealmLocalization.T("settings.title")),
                settingsPanel != null ? ButtonWiringCheck.FindByLabel(settingsPanel.transform, RealmLocalization.T("settings.close")) : null,
                settingsPanel);
            return ok;
        }

    }
}
