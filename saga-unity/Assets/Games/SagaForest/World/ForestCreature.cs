using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// FOREST "몬스터·퓨전 콘텐츠" 슬라이스(2026-09-12) — saga-godot
    /// `VERTICAL_SLICE_FOREST.md` 5절 "몬스터·퓨전 자유" 결정(다섯 판 중
    /// FOREST의 주민은 애초에 역사 인물이 아니라 역할 이름이라, "괴물·다른
    /// 시대 요소를 넣어도 된다"는 자유가 있다)을 saga-unity에도 그대로
    /// 적용한 것 — saga-godot FOREST 트랙이 이미 네 종(숲도깨비·바위도깨비·
    /// 버섯정령·꽃정령, `forest_creature.gd`)으로 검증해 둔 걸 개념만
    /// 참고해 Unity로 새로 짰다(코드는 안 베낀다, 다섯 판/두 엔진 트랙 공통
    /// 원칙). **2026-09-12, 네 종(포자괴물·안개유령·무쇠도깨비·나비정령)
    /// 추가** — saga-godot에 없던 종이라 saga-forest 웹판 `data-village.js`
    /// (ANIMALS.mushnub)·한국 설화 모티프(도깨비불)만 참고해 saga-unity가
    /// 처음 짰다. 여덟 종이 네 바이옴에 둘씩(`ForestBiomeData.Zones`
    /// 참고).
    ///
    /// 상태기계(Idle→Wander→Flee)도 GO `WanderingAnimal.cs`와 같은 구조지만
    /// **Group(무리 전파)는 없다** — godot 쪽 원본 설계에 없던 걸 새로 얹지
    /// 않는다. FOREST엔 GO의 타일 맵 같은 보행 가능 판정 데이터가 없어(단일
    /// 평면) 걸을 수 있는 자리 검사도 생략했다.
    ///
    /// **전투 콘텐츠 추가(2026-09-14)** — 위 "전투·포획·HP는 안 만든다"는
    /// 결정을 사용자가 명시적으로 뒤집었다("Forest 전투 콘텐츠 설계부터
    /// 시작"). 다만 GO/DUNGEON의 DuelRules(스탯·수식·파티·골드) 같은 무거운
    /// 인프라를 새로 짓지는 않았다 — FOREST는 순수 라이프심이라 그런
    /// 시스템 자체가 없고, 지금 지으면 "전투"가 아니라 "새 RPG 경제"가
    /// 된다. 대신 여덟 종 중 포자괴물(pojagoemul) 하나만 적대(Hostile)로
    /// 바꿔 대치하면 `Saga.Forest.UI.ForestHostileEncounterUi`가 뜨는 아주
    /// 가벼운 "밀어내기" 미니게임(연타로 게이지를 비움)을 겪게 한다.
    /// 결과와 무관하게 창조물은 물러난다(처벌 없음) — 원작(동물의 숲)의
    /// 비폭력 톤은 유지하면서 "적대 개체와 마주친다"는 손맛만 더한 것.
    /// 다른 일곱 종은 그대로 도주만 한다.
    /// </summary>
    public class ForestCreature : MonoBehaviour
    {
        private const float ArriveDist = 0.4f;
        private const float MinIdleSec = 1.5f;
        private const float MaxIdleSec = 3.5f;
        private const float ContactDist = 1.1f;    // 이 안이면 대치(Encounter) 시작.
        private const float AggroCooldownSec = 12f; // 대치가 끝난 뒤 다시 노려보기까지.

        private enum State { Idle, Wander, Flee, Aggro, Encounter }

        private Vector3 _origin;
        private Vector3 _target;
        private float _idleUntil;
        private State _state;

        private float _moveSpeed;
        private float _fleeSpeed;
        private float _fleeRadius;      // 이 안에 플레이어가 들어오면 놀라 달아난다(적대 종은 대신 다가온다).
        private float _fleeStopRadius;  // 이만큼 멀어져야 진정한다(히스테리시스).
        private float _wanderRadius;
        private float _fleeStepRadius;
        private bool _hostile;          // true면 pojagoemul — fleeRadius 안에서 도주 대신 추격.
        private float _aggroCooldownUntil;

        private Transform _player;

        public bool IsHostile => _hostile;

        /// <summary>PlaytestForestCreatures.cs가 상태 전이를 확인하려고 쓴다 —
        /// private State를 그대로 노출하지 않고 이름만 문자열로 준다.</summary>
        public string DebugStateName => _state.ToString();

        /// <summary>PLAN.md 108 ② — 종 표시 이름(존 짐승 명단). 이름은 전부 지어낸 것.</summary>
        public static string KindName(string kind)
        {
            switch (kind)
            {
                case "bawi": return ForestLocalization.T("creature.bawi", "바위도깨비");
                case "beoseot": return ForestLocalization.T("creature.beoseot", "버섯정령");
                case "kkot": return ForestLocalization.T("creature.kkot", "꽃정령");
                case "pojagoemul": return ForestLocalization.T("creature.pojagoemul", "포자괴물");
                case "angaeyuryeong": return ForestLocalization.T("creature.angaeyuryeong", "안개유령");
                case "musoetokkebi": return ForestLocalization.T("creature.musoetokkebi", "무쇠도깨비");
                case "nabijeongryeong": return ForestLocalization.T("creature.nabijeongryeong", "나비정령");
                default: return ForestLocalization.T("creature.dokkaebi", "숲도깨비");
            }
        }

        /// <summary>108 ② 진단 — 세운 종.</summary>
        public string Kind { get; private set; }
        public Vector3 Den => _origin;

        // PLAN.md 108 후속 — 사실 모델(`ForestCreatureBuilder.models`)이 있으면 그 몸이 선다.
        private Transform _modelVisual;
        private Animator _animator;
        private bool _hasAttackTrigger;
        private float _wingPhase;
        private Transform _wingL, _wingR;
        private Quaternion _wingLRest, _wingRRest;

        /// <summary>진단 — 사실 모델로 섰는지(없으면 예전 도형).</summary>
        public bool HasModel => _modelVisual != null;
        public Transform ModelVisual => _modelVisual;
        public Animator ModelAnimator => _animator;

        /// <summary>씬 빌더가 스폰 직후 한 번 부른다 — `kind`가 시각과 능력치를
        /// 함께 정한다(species별로 다른 속도·경계심). `model` 이 있으면 그 프리팹을 "Visual" 아래에 세우고,
        /// 없으면(다른 PC·에셋 안 받음) 예전 primitive 조합.</summary>
        public void Setup(string kind, Vector3 origin, GameObject model = null)
        {
            Kind = kind;
            _origin = origin;
            _target = origin;
            transform.position = origin;

            switch (kind)
            {
                case "bawi":
                    _moveSpeed = 0.9f; _fleeSpeed = 2.2f; _fleeRadius = 4.0f; _wanderRadius = 2.5f;
                    if (model == null) SpawnVisualBawi();
                    break;
                case "beoseot":
                    _moveSpeed = 2.0f; _fleeSpeed = 4.2f; _fleeRadius = 3.0f; _wanderRadius = 3.5f;
                    if (model == null) SpawnVisualBeoseot();
                    break;
                case "kkot":
                    _moveSpeed = 1.2f; _fleeSpeed = 3.0f; _fleeRadius = 5.0f; _wanderRadius = 5.0f;
                    if (model == null) SpawnVisualKkot();
                    break;
                case "pojagoemul":
                    // 다섯째 종(2026-09-12) — 넷 중 가장 좁게 돈다(새 초과, 기존
                    // 넷의 "가장 ~함" 주장과 안 겹치는 축). 2026-09-14 —
                    // 여덟 종 중 유일하게 적대(Hostile)로 바뀌었다(클래스
                    // 주석 "전투 콘텐츠 추가" 참고) — fleeRadius는 이제
                    // "노려보기 시작 거리"로 재해석된다.
                    _moveSpeed = 1.1f; _fleeSpeed = 2.8f; _fleeRadius = 4.5f; _wanderRadius = 1.8f;
                    _hostile = true;
                    if (model == null) SpawnVisualPojagoemul();
                    break;
                case "angaeyuryeong":
                    // 여섯째 종(2026-09-12) — 넷 중 가장 쉽게 놀란다(fleeRadius
                    // 최댓값, 새 초과). 땅에 안 붙어 사는 유일한 종 — Den의 y가
                    // 1.0이라 배회 내내 그 높이를 유지한다(MoveToward가 y는
                    // 안 건드리므로).
                    _moveSpeed = 1.8f; _fleeSpeed = 4.0f; _fleeRadius = 7.5f; _wanderRadius = 4.2f;
                    if (model == null) SpawnVisualAngaeyuryeong();
                    break;
                case "musoetokkebi":
                    // 일곱째 종(2026-09-12) — 여섯 중 가장 느리게 튄다(fleeSpeed
                    // 최솟값, 새 초과 축 — 이전까지 이 축엔 기록이 없었다).
                    // 바위 지대(무쇠처럼 단단한 껍질, 놀라도 안 서두른다).
                    _moveSpeed = 1.0f; _fleeSpeed = 1.8f; _fleeRadius = 4.5f; _wanderRadius = 2.2f;
                    if (model == null) SpawnVisualMusoetokkebi();
                    break;
                case "nabijeongryeong":
                    // 여덟째 종(2026-09-12) — 여섯 중 가장 급하게 튄다(fleeSpeed
                    // 최댓값, musoetokkebi와 같은 축의 반대쪽 끝). 꽃밭(팔랑이며
                    // 날듯 산다는 인상, 실제 이동 로직은 다른 종과 동일).
                    _moveSpeed = 1.6f; _fleeSpeed = 4.8f; _fleeRadius = 5.5f; _wanderRadius = 4.5f;
                    if (model == null) SpawnVisualNabijeongryeong();
                    break;
                default: // "dokkaebi" — 첫 종, 기본값.
                    _moveSpeed = 1.5f; _fleeSpeed = 3.5f; _fleeRadius = 6.0f; _wanderRadius = 4.0f;
                    if (model == null) SpawnVisualDokkaebi();
                    break;
            }
            _fleeStopRadius = _fleeRadius * 2f;
            _fleeStepRadius = _wanderRadius * 1.5f;

            if (model != null) UseModel(model);

            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            PickIdle();
        }

        private void Update()
        {
            if (_player == null) return;

            // Encounter 중엔 UI(ForestHostileEncounterUi)가 결과를 정할 때까지
            // 제자리에 멈춘다 — OnEncounterResolved가 다음 상태를 정한다.
            if (_state == State.Encounter) return;

            if (_state == State.Flee)
            {
                UpdateFlee();
                return;
            }

            if (_state == State.Aggro)
            {
                UpdateAggro();
                return;
            }

            float distSqr = FlatDistSqr(transform.position, _player.position);
            if (distSqr <= _fleeRadius * _fleeRadius && Time.time >= _aggroCooldownUntil)
            {
                if (_hostile) StartAggro(); else StartFlee();
                return;
            }

            if (_state == State.Idle)
            {
                if (Time.time >= _idleUntil) PickTarget();
                return;
            }

            MoveToward(_target, _moveSpeed);
            if (FlatDistSqr(transform.position, _target) <= ArriveDist * ArriveDist) PickIdle();
        }

        private void UpdateFlee()
        {
            if (FlatDistSqr(transform.position, _player.position) > _fleeStopRadius * _fleeStopRadius)
            {
                PickIdle();
                return;
            }

            MoveToward(_target, _fleeSpeed);
            if (FlatDistSqr(transform.position, _target) <= ArriveDist * ArriveDist) PickFleeTarget();
        }

        /// <summary>도주(UpdateFlee)의 반대 방향 — fleeSpeed로 플레이어에게
        /// 곧장 다가간다(위협감을 주려고 wander보다 빠른 속도 그대로 재사용).
        /// 접촉 거리 안이면 대치를 시작하고, 플레이어가 fleeStopRadius
        /// 밖으로 빠지면 추격을 포기한다(도주 히스테리시스와 대칭).</summary>
        private void UpdateAggro()
        {
            float distSqr = FlatDistSqr(transform.position, _player.position);
            if (distSqr <= ContactDist * ContactDist)
            {
                BeginEncounter();
                return;
            }
            if (distSqr > _fleeStopRadius * _fleeStopRadius)
            {
                PickIdle();
                return;
            }

            Vector3 toPlayer = _player.position - transform.position;
            toPlayer.y = 0f;
            if (toPlayer.sqrMagnitude > 0.0001f)
            {
                Vector3 dir = toPlayer.normalized;
                transform.position += dir * (_fleeSpeed * Time.deltaTime);
                transform.rotation = Quaternion.LookRotation(dir);
            }
        }

        private void StartFlee()
        {
            if (_state == State.Flee) return;
            _state = State.Flee;
            PickFleeTarget();
        }

        private void StartAggro()
        {
            if (_state == State.Aggro) return;
            _state = State.Aggro;
        }

        /// <summary>포자괴물이 접촉 거리 안까지 다가왔다 — 밀어내기 미니게임을
        /// 띄운다. UI가 없는 상황(씬에 `ForestHostileEncounterUi`가 아직 없는
        /// 다른 테스트 등)이면 곧바로 물러난 것으로 처리해 멈춰 있지 않게 한다.</summary>
        private void BeginEncounter()
        {
            _state = State.Encounter;
            if (_animator != null && _hasAttackTrigger) _animator.SetTrigger("Attack"); // 포효하며 막아선다.
            var ui = ForestHostileEncounterUi.Instance;
            if (ui != null)
            {
                ui.StartEncounter(OnEncounterResolved);
            }
            else
            {
                OnEncounterResolved(true);
            }
        }

        private void OnEncounterResolved(bool won)
        {
            _aggroCooldownUntil = Time.time + AggroCooldownSec;
            DialogueLabel.Instance?.Show(
                won ? ForestLocalization.T("encounter.won", "포자괴물을 몰아냈다!")
                    : ForestLocalization.T("encounter.lost", "포자괴물이 슬그머니 물러갔다."), 3f);
            StartFlee(); // 승패와 무관하게 물러난다 — 처벌 없음(클래스 주석 참고).
        }

        private void PickIdle()
        {
            _state = State.Idle;
            _idleUntil = Time.time + Random.Range(MinIdleSec, MaxIdleSec);
        }

        private void PickTarget()
        {
            Vector2 offset = Random.insideUnitCircle * _wanderRadius;
            _target = _origin + new Vector3(offset.x, 0f, offset.y);
            _state = State.Wander;
        }

        private void PickFleeTarget()
        {
            Vector3 fleeDir = transform.position - _player.position;
            fleeDir.y = 0f;
            if (fleeDir.sqrMagnitude < 0.01f)
            {
                Vector2 rand = Random.insideUnitCircle;
                fleeDir = new Vector3(rand.x, 0f, rand.y);
            }
            fleeDir.Normalize();
            _target = transform.position + fleeDir * _fleeStepRadius;
        }

        private void MoveToward(Vector3 target, float speed)
        {
            Vector3 toTarget = target - transform.position;
            toTarget.y = 0f;
            if (toTarget.sqrMagnitude <= ArriveDist * ArriveDist) return;

            Vector3 dir = toTarget.normalized;
            transform.position += dir * (speed * Time.deltaTime);
            transform.rotation = Quaternion.LookRotation(dir);
        }

        // ── PLAN.md 108 후속 — 사실 모델 ──
        // 몸은 Mixamo(Humanoid) + 빛깔·꾸밈을 편집기가 구운 프리팹이라 `ForestWorldCurve` 셰이더를 안 탄다 —
        // 명소(`ForestLandmark`)처럼 "Visual" 을 땅이 휘는 만큼(거리² × 0.004) 통째로 내린다.

        private void UseModel(GameObject model)
        {
            var visual = new GameObject("Visual").transform;
            visual.SetParent(transform, false);
            var body = Instantiate(model, visual, false);
            body.name = model.name;
            _modelVisual = visual;
            _animator = body.GetComponentInChildren<Animator>();
            if (_animator != null)
            {
                _animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
                foreach (var p in _animator.parameters)
                {
                    if (p.name == "Attack" && p.type == AnimatorControllerParameterType.Trigger) _hasAttackTrigger = true;
                }
            }
            _wingL = FindDeep(body.transform, "WingL");
            _wingR = FindDeep(body.transform, "WingR");
            if (_wingL != null) _wingLRest = _wingL.localRotation;
            if (_wingR != null) _wingRRest = _wingR.localRotation;
            _wingPhase = Random.value * 6.28f;
        }

        private void LateUpdate()
        {
            if (_modelVisual == null) return;
            if (_animator != null)
            {
                // 컨트롤러 규칙(SetupNpcCharacterImports): >0.1 걷기 · >0.6 달리기.
                float speed = _state == State.Wander ? 0.4f
                    : (_state == State.Flee || _state == State.Aggro) ? 1f : 0f;
                _animator.SetFloat("Speed", speed);
            }
            if (_wingL != null && _wingR != null)
            {
                bool hurried = _state == State.Flee;
                _wingPhase += Time.deltaTime * (hurried ? 22f : 9f);
                float flap = Mathf.Sin(_wingPhase) * 35f;
                // 날개 축은 편집기가 몸 방향에 맞춰 둔 것 — 제 앞(z)축을 돌면 위아래로 퍼덕인다.
                _wingL.localRotation = _wingLRest * Quaternion.Euler(0f, 0f, -flap);
                _wingR.localRotation = _wingRRest * Quaternion.Euler(0f, 0f, flap);
            }
            if (_player != null) FollowCurve(_player.position);
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다(`ForestLandmark.Follow` 와 같은 식). 진단도 부른다.</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_modelVisual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            _modelVisual.localPosition = new Vector3(0f, -(dx * dx + dz * dz) * ForestLandmark.CurveAmount, 0f);
        }

        private static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform child in root)
            {
                var hit = FindDeep(child, name);
                if (hit != null) return hit;
            }
            return null;
        }

        private static float FlatDistSqr(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x, dz = a.z - b.z;
            return dx * dx + dz * dz;
        }

        // ── 종별 시각(폴백) — 사실 모델(`UseModel`)이 없을 때만 선다. primitive 조합(PLAN.md 8장 placeholder),
        // `Saga/ForestWorldCurve` 머티리얼을 물려 땅과 같이 휘게 한다(안 그러면
        // 공중에 뜬 것처럼 보인다 — 셰이더 클래스 주석 "땅·나무·NPC 등" 참고).
        // 여덟 종 다 primitive 조합이 겹치지 않게 짰다(구+원기둥 / 상자+상자 /
        // 원기둥+구 / 구+납작구 / 구+작은구 셋 / 구+구 / 납작구+작은구 둘 /
        // 구+납작구 둘).

        private Material CurveMat(string name, Color color)
        {
            var mat = new Material(Shader.Find("Saga/ForestWorldCurve")) { name = name };
            mat.SetColor("_BaseColor", color);
            return mat;
        }

        private static GameObject Primitive(Transform parent, PrimitiveType type, string name,
            Vector3 localPos, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Saga.Core.Colliders.Strip(go);
            return go;
        }

        // 숲도깨비 — 구 몸통 + 원기둥 뿔(Unity 기본 도형엔 원뿔이 없어 DUNGEON
        // 바이옴 소품의 나무(줄기+수관)와 같은 이유로 원기둥을 기울여 대신함).
        private void SpawnVisualDokkaebi()
        {
            var bodyMat = CurveMat("Dokkaebi (generated)", new Color(0.30f, 0.42f, 0.28f));
            Primitive(transform, PrimitiveType.Sphere, "Body", new Vector3(0f, 0.5f, 0f), Vector3.one * 0.9f, bodyMat);
            var horn = Primitive(transform, PrimitiveType.Cylinder, "Horn", new Vector3(0f, 1.1f, 0.2f),
                new Vector3(0.12f, 0.35f, 0.12f), bodyMat);
            horn.transform.localRotation = Quaternion.Euler(-20f, 0f, 0f);
        }

        // 바위도깨비 — 상자 몸통 + 작은 상자 혹(돌빛 회갈색), 숲도깨비보다
        // 느리고 덜 겁내게 잡아 체감을 갈랐다.
        private void SpawnVisualBawi()
        {
            var bodyMat = CurveMat("Bawi (generated)", new Color(0.5f, 0.45f, 0.4f));
            Primitive(transform, PrimitiveType.Cube, "Body", new Vector3(0f, 0.45f, 0f), new Vector3(1.0f, 0.8f, 0.8f), bodyMat);
            Primitive(transform, PrimitiveType.Cube, "Hump", new Vector3(0f, 0.95f, -0.1f), new Vector3(0.5f, 0.35f, 0.5f), bodyMat);
        }

        // 버섯정령 — 원기둥 줄기 + 구 갓(청록, 장식 소품보다 크게 잡아 "움직이는
        // 것"이 갈리게 함). 넷 중 가장 빠르고 가장 안 겁낸다.
        private void SpawnVisualBeoseot()
        {
            var stemMat = CurveMat("BeoseotStem (generated)", new Color(0.85f, 0.8f, 0.65f));
            var capMat = CurveMat("BeoseotCap (generated)", new Color(0.2f, 0.55f, 0.55f));
            Primitive(transform, PrimitiveType.Cylinder, "Stem", new Vector3(0f, 0.35f, 0f), new Vector3(0.22f, 0.35f, 0.22f), stemMat);
            Primitive(transform, PrimitiveType.Sphere, "Cap", new Vector3(0f, 0.75f, 0f), new Vector3(0.7f, 0.44f, 0.7f), capMat);
        }

        // 꽃정령 — 구 몸통 + 납작구 꽃관(Unity 기본 도형엔 토러스가 없어 구를
        // Y로 눌러 화관을 대신함 — 원작(godot)의 토러스 관을 이렇게 재해석).
        private void SpawnVisualKkot()
        {
            var bodyMat = CurveMat("Kkot (generated)", new Color(0.95f, 0.93f, 0.88f));
            var crownMat = CurveMat("KkotCrown (generated)", new Color(0.92f, 0.55f, 0.68f));
            Primitive(transform, PrimitiveType.Sphere, "Body", new Vector3(0f, 0.5f, 0f), Vector3.one * 0.85f, bodyMat);
            Primitive(transform, PrimitiveType.Sphere, "Crown", new Vector3(0f, 1.0f, 0f), new Vector3(0.9f, 0.18f, 0.9f), crownMat);
        }

        // 포자괴물 — 다섯째 종(2026-09-12). 웹판 saga-forest `data-village.js`
        // ANIMALS.mushnub("포자괴물", 버섯숲 한정 몬스터)를 개념만 참고 —
        // saga-godot에도 없던 종을 saga-unity에서 처음 짠다(코드가 없으니
        // "베낀다"는 문제 자체가 없음). 버섯정령(줄기+갓, 청록)과 실루엣이
        // 안 겹치게 "찌그러진 몸통 + 삐죽한 포자 혹 셋"으로 짰다 — 병적인
        // 노란빛-녹색.
        private void SpawnVisualPojagoemul()
        {
            var bodyMat = CurveMat("Pojagoemul (generated)", new Color(0.62f, 0.72f, 0.22f));
            var spikeMat = CurveMat("PojagoemulSpike (generated)", new Color(0.4f, 0.42f, 0.15f));
            Primitive(transform, PrimitiveType.Sphere, "Body", new Vector3(0f, 0.42f, 0f), new Vector3(0.9f, 0.6f, 0.9f), bodyMat);
            for (int i = 0; i < 3; i++)
            {
                float ang = i * 120f * Mathf.Deg2Rad;
                var spike = Primitive(transform, PrimitiveType.Sphere, $"Spore{i}",
                    new Vector3(Mathf.Cos(ang) * 0.4f, 0.55f, Mathf.Sin(ang) * 0.4f),
                    Vector3.one * 0.28f, spikeMat);
                spike.transform.localRotation = Quaternion.identity;
            }
        }

        // 안개유령 — 여섯째 종(2026-09-12). 도깨비불(will-o'-the-wisp) 모티프 —
        // 땅에 안 붙어 사는 유일한 종(Den y=1.0, 위 Setup 주석 참고). 창백한
        // 겉불꽃 구 + 안쪽의 밝은 속불꽃 구로 "빛이 흔들린다"는 인상만 정적으로
        // 흉내(애니메이션 없음 — 이 슬라이스 범위 밖).
        private void SpawnVisualAngaeyuryeong()
        {
            var outerMat = CurveMat("AngaeyuryeongOuter (generated)", new Color(0.78f, 0.86f, 0.9f));
            var coreMat = CurveMat("AngaeyuryeongCore (generated)", new Color(0.95f, 0.9f, 0.55f));
            Primitive(transform, PrimitiveType.Sphere, "Body", Vector3.zero, Vector3.one * 0.7f, outerMat);
            Primitive(transform, PrimitiveType.Sphere, "Core", new Vector3(0.08f, 0.05f, 0f), Vector3.one * 0.32f, coreMat);
        }

        // 무쇠도깨비 — 일곱째 종(2026-09-12), 바위 지대(bawi와 공유). 납작하게
        // 웅크린 몸통(무쇠빛 청회색) + 눈 혹 둘(밝은 회백)로 "단단히 웅크린
        // 짐승" 인상을 준다 — bawi(상자+상자 혹, 돌빛 회갈)와 실루엣·색조
        // 둘 다 갈랐다(납작 구 vs 상자, 청회 vs 회갈).
        private void SpawnVisualMusoetokkebi()
        {
            var bodyMat = CurveMat("Musoetokkebi (generated)", new Color(0.42f, 0.46f, 0.55f));
            var eyeMat = CurveMat("MusoetokkebiEye (generated)", new Color(0.75f, 0.78f, 0.8f));
            Primitive(transform, PrimitiveType.Sphere, "Body", new Vector3(0f, 0.28f, 0f), new Vector3(1.1f, 0.5f, 1.0f), bodyMat);
            Primitive(transform, PrimitiveType.Sphere, "EyeL", new Vector3(-0.25f, 0.55f, 0.35f), Vector3.one * 0.16f, eyeMat);
            Primitive(transform, PrimitiveType.Sphere, "EyeR", new Vector3(0.25f, 0.55f, 0.35f), Vector3.one * 0.16f, eyeMat);
        }

        // 나비정령 — 여덟째 종(2026-09-12), 꽃밭(kkot과 공유). 작은 구 몸통 +
        // 납작구 날개 둘(파스텔 보라/청보라)로 kkot(구+화관, 크림/분홍)과
        // 갈랐다 — 날개는 화관처럼 Y로 누른 구를 좌우 대칭으로 붙였다.
        private void SpawnVisualNabijeongryeong()
        {
            var bodyMat = CurveMat("Nabijeongryeong (generated)", new Color(0.85f, 0.55f, 0.85f));
            var wingMat = CurveMat("NabijeongryeongWing (generated)", new Color(0.6f, 0.7f, 0.95f));
            Primitive(transform, PrimitiveType.Sphere, "Body", new Vector3(0f, 0.55f, 0f), Vector3.one * 0.4f, bodyMat);
            Primitive(transform, PrimitiveType.Sphere, "WingL", new Vector3(-0.32f, 0.62f, 0f), new Vector3(0.5f, 0.08f, 0.32f), wingMat);
            Primitive(transform, PrimitiveType.Sphere, "WingR", new Vector3(0.32f, 0.62f, 0f), new Vector3(0.5f, 0.08f, 0.32f), wingMat);
        }
    }
}
