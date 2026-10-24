using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0108 대상 적 카드(웹 사가나락 `dungeon-view.js` renderFoe · `css/diablo.css` #d2-foe) — 화면 위 가운데 한 장에 지금 겨누는 적의 이름·체력 막대.
    /// 원작처럼 적 머리 위엔 아무것도 띄우지 않고, 락온한 적(없으면 가장 가까운 산 적 — 10.8m 안) 하나만 올린다. 정예는 이름 앞 "정예 "·푸른 이름, 두목은 노란 이름.
    /// 보여 주기만 한다(판정 없음) · 누름을 막지 않게 레이캐스트 없음 · 컷신·일시정지 창·시나리오 장면 중엔 숨김. `GameBootstrap` 이 Play 때 짓는다(씬 재빌드 없이).
    /// </summary>
    public class DungeonFoeCard : MonoBehaviour
    {
        /// <summary>웹 260px ÷ 24 = 10.8m — 이보다 멀면 숨김(`DungeonFoeRoster.RangedMax` 와 같은 값).</summary>
        public const float ShowRange = DungeonFoeRoster.RangedMax;
        public const float BarWidth = 400f, BarHeight = 12f; // 1600×900 기준 — 520 이면 16:9 에서 비결 단추(오른쪽 위 둘째 줄) 머리와 겹친다(웹 min(46vw, 360px))
        public static readonly Color NameNormal = new Color32(0xd9, 0xcf, 0xb4, 0xff);
        public static readonly Color NameElite = new Color32(0x6f, 0x6f, 0xff, 0xff);
        public static readonly Color NameBoss = new Color32(0xff, 0xff, 0x64, 0xff);
        private static readonly Color BarBack = new Color32(0x0a, 0x06, 0x04, 0xe6);
        private static readonly Color FillTop = new Color32(0xe0, 0x53, 0x3c, 0xff);
        private static readonly Color FillBottom = new Color32(0x8d, 0x0f, 0x08, 0xff);

        public static DungeonFoeCard Instance { get; private set; }

        private GameObject _root;
        private TextMeshProUGUI _name;
        private RectTransform _fill;
        private DungeonEnemy _target;
        private string _key = "";
        private float _fillValue;
        private Transform _hero;
        private PlayerLockOn _lockOn;

        /// <summary>진단 — 카드가 떠 있나 · 올린 적 · 이름 글 · 이름 색 · 막대 채움(0~1).</summary>
        public bool IsShown => _root != null && _root.activeSelf;
        public DungeonEnemy Target => IsShown ? _target : null;
        public string NameText => _name != null ? _name.text : null;
        public Color NameColor => _name != null ? _name.color : Color.clear;
        public float Fill => _fillValue;
        /// <summary>진단 — 이름 글자 중 실제로 그려지는 수(줄 높이가 모자라 Ellipsis 가 줄을 지우면 0).</summary>
        public int NameInkChars
        {
            get
            {
                if (_name == null || !IsShown) return 0;
                _name.ForceMeshUpdate();
                int n = 0;
                for (int i = 0; i < _name.textInfo.characterCount; i++) if (_name.textInfo.characterInfo[i].isVisible) n++;
                return n;
            }
        }

        /// <summary>없으면 짓는다(`GameBootstrap.Start`).</summary>
        public static DungeonFoeCard Install()
        {
            if (Instance != null) return Instance;
            var found = Object.FindFirstObjectByType<DungeonFoeCard>();
            if (found != null) return found;
            return new GameObject("DungeonFoeCard").AddComponent<DungeonFoeCard>();
        }

        /// <summary>
        /// 고르기 규칙(웹 renderFoe) — 활성·산 적 중 락온한 적이 있으면 거리와 상관없이 그 적, 아니면 평면 거리가 가장 가까운 적.
        /// 그 적이 10.8m 넘으면 null. 방 id 는 안 본다(방 갈이마다 옛 적은 지워지고 앞 방들은 자리가 떨어져 거리로 갈린다).
        /// </summary>
        public static DungeonEnemy Pick(Vector3 hero, DungeonEnemy locked)
        {
            if (Usable(locked)) return locked;
            DungeonEnemy best = null;
            float bestD = float.MaxValue;
            foreach (var e in DungeonEnemy.Active)
            {
                if (!Usable(e)) continue;
                float d = FlatDistance(hero, e.transform.position);
                if (d < bestD) { bestD = d; best = e; }
            }
            return best != null && bestD <= ShowRange ? best : null;
        }

        private static bool Usable(DungeonEnemy e) => e != null && e.IsAlive && e.isActiveAndEnabled;

        private static float FlatDistance(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }

        private void Awake()
        {
            Instance = this;
            Build();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (_hero == null)
            {
                var p = GameObject.FindWithTag("Player");
                if (p == null) { Hide(); return; }
                _hero = p.transform;
                _lockOn = p.GetComponent<PlayerLockOn>();
            }
            Refresh(_hero.position, _lockOn != null ? _lockOn.Target : null);
        }

        /// <summary>한 번 고쳐 그린다(매 프레임 `Update` · 진단이 직접 부른다). 값이 바뀔 때만 글을 새로 쓴다(웹 foeKey).</summary>
        public void Refresh(Vector3 hero, DungeonEnemy locked)
        {
            if (DungeonCutscenes.Playing || SagaPauseMenu.IsOpen) { Hide(); return; }
            // U-0209 — 시나리오 장면 상자도 모달(1300×720 가운데) — 적이 10.8m 안이면 카드가 판 제목 자리(위 −104)에 겹쳐 남았다(지역 배너와 같이 숨김)
            var scene = DungeonScenarioUi.Instance;
            if (scene != null && scene.IsOpen) { Hide(); return; }
            var e = Pick(hero, locked);
            if (e == null) { Hide(); return; }
            float fill = e.MaxHp > 0f ? Mathf.Clamp01(e.CurrentHp / e.MaxHp) : 0f;
            string key = e.GetInstanceID() + "|" + Mathf.RoundToInt(fill * 1000f) + "|" + (e.IsElite ? 1 : 0) + "|" + (e.IsBoss ? 1 : 0) + "|" + e.DisplayName;
            _target = e;
            if (!_root.activeSelf) _root.SetActive(true);
            if (key == _key) return;
            _key = key;
            _name.text = e.IsElite && !e.IsBoss ? DungeonLocalization.T("foe.elite_prefix", "정예 ") + e.DisplayName : e.DisplayName;
            _name.color = e.IsBoss ? NameBoss : e.IsElite ? NameElite : NameNormal;
            _fillValue = fill;
            _fill.sizeDelta = new Vector2(BarWidth * fill, 0f);
        }

        private void Hide()
        {
            _target = null;
            _key = "";
            if (_root != null && _root.activeSelf) _root.SetActive(false);
        }

        private void Build()
        {
            var canvasGo = new GameObject("DungeonFoeCardCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 12;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            // 레이캐스터 없음 — 누름을 막지 않는다.

            _root = new GameObject("FoeCard", typeof(RectTransform));
            _root.transform.SetParent(canvasGo.transform, false);
            var rt = (RectTransform)_root.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 1f);
            rt.anchoredPosition = new Vector2(0f, -104f); // 목표 줄(GoalBoard, 위 가운데) 바로 밑
            rt.sizeDelta = new Vector2(BarWidth, 58f);

            var nameGo = new GameObject("Name", typeof(RectTransform));
            nameGo.transform.SetParent(_root.transform, false);
            var nrt = (RectTransform)nameGo.transform;
            nrt.anchorMin = nrt.anchorMax = nrt.pivot = new Vector2(0.5f, 1f);
            nrt.anchoredPosition = Vector2.zero;
            nrt.sizeDelta = new Vector2(BarWidth, 42f); // 줄 높이(Noto 1.45em ≈ 38)보다 커야 Ellipsis 가 줄을 통째로 지우지 않는다
            _name = nameGo.AddComponent<TextMeshProUGUI>();
            _name.fontSize = 26;
            _name.alignment = TextAlignmentOptions.Center;
            _name.textWrappingMode = TextWrappingModes.NoWrap;
            _name.overflowMode = TextOverflowModes.Ellipsis;
            _name.color = NameNormal;
            _name.raycastTarget = false;
            _name.outlineWidth = 0.18f;
            _name.outlineColor = new Color32(0, 0, 0, 220);

            var back = NewBox(_root.transform, "Bar", BarBack);
            back.anchorMin = back.anchorMax = back.pivot = new Vector2(0.5f, 0f);
            back.anchoredPosition = new Vector2(0f, 2f);
            back.sizeDelta = new Vector2(BarWidth, BarHeight);

            _fill = NewBox(back, "Fill", FillTop);
            _fill.anchorMin = new Vector2(0f, 0f);
            _fill.anchorMax = new Vector2(0f, 1f);
            _fill.pivot = new Vector2(0f, 0.5f);
            _fill.anchoredPosition = Vector2.zero;
            _fill.sizeDelta = new Vector2(BarWidth, 0f);
            // 웹 linear-gradient(#e0533c → #8d0f08) 대신 아래 반을 짙은 색으로
            var shade = NewBox(_fill, "Shade", FillBottom);
            shade.anchorMin = new Vector2(0f, 0f);
            shade.anchorMax = new Vector2(1f, 0.5f);
            shade.offsetMin = shade.offsetMax = Vector2.zero;

            _root.SetActive(false);
        }

        private static RectTransform NewBox(Transform parent, string name, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return (RectTransform)go.transform;
        }
    }
}
