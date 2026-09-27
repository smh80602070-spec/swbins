using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// saga-dungeon 웹판 PLAN.md 28-1절 "지도 UI — 디아블로 M키 방식"을
    /// 옮겼다. `Minimap.cs`(늘 화면 구석에 방·마을 점만 찍는 작은 개략도)
    /// 와는 목적이 다르다 — M키를 누르면 화면 중앙에 지역 지도가
    /// 펼쳐져 "지금 어느 지역에 있고 다른 마을이 어느 방향에 있는지"를
    /// 보여준다. **텔레포트 없음 — 보기만 하는 창**(웹판과 같은 결).
    /// PLAN.md 109-10-4(웹 §5.12 "큰 지도 지역빛·이름") — 나침반 다섯 칸 → **3×3 지역 아홉 칸**
    /// (<see cref="DungeonWorldMap"/>): 칸마다 이름·한자·자리, 바탕은 그 지역 땅빛, 지금 선 칸은 금빛.
    /// 칸은 Play 때 짓는다(씬에 남은 예전 다섯 칸은 끈다 — 씬 재빌드 없이).
    /// </summary>
    public class OverworldMapUI : MonoBehaviour
    {
        private const float CellSize = 140f;
        private const float CellGap = 150f;
        private static readonly Color HighlightColor = new Color(1f, 0.85f, 0.35f, 0.7f);

        [SerializeField] private GameObject panel;

        private Transform _player;
        private bool _visible;
        private Image[] _cells;
        private TextMeshProUGUI _where;
        private TextMeshProUGUI _sagaCount;
        public string SagaCountText => _sagaCount != null ? _sagaCount.text : "";
        private int _shown = -2;

        public bool Visible => _visible;
        public int CellCount => _cells != null ? _cells.Length : 0;
        public string WhereText => _where != null ? _where.text : "";
        public Color CellColor(int i) => _cells[i].color;
        public string CellText(int i) => _cells[i].GetComponentInChildren<TextMeshProUGUI>().text;

        private void Awake()
        {
            var go = GameObject.FindWithTag("Player");
            _player = go != null ? go.transform : null;
            BuildRegionCells();
            if (panel != null) panel.SetActive(false);
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.mKey.wasPressedThisFrame) SetVisible(!_visible);
            if (_visible) Refresh();
        }

        public void SetVisible(bool on)
        {
            _visible = on;
            if (panel != null) panel.SetActive(on);
            _shown = -2;
            if (on) { RefreshCellTexts(); Refresh(); }
        }

        /// <summary>지금 선 칸을 금빛으로(바뀐 때만 다시 칠한다).</summary>
        public void Refresh()
        {
            if (_cells == null) return;
            int cur = _player != null ? DungeonWorldMap.IndexAt(_player.position) : -1;
            if (cur == _shown) return;
            _shown = cur;
            for (int i = 0; i < _cells.Length; i++) _cells[i].color = i == cur ? HighlightColor : IdleColor(i);
            if (_where != null)
                _where.text = cur >= 0
                    ? string.Format(DungeonLocalization.T("region.map_here", "지금 — {0} {1}"), DungeonWorldMap.Name(cur), DungeonWorldMap.All[cur].Hanja)
                    : DungeonLocalization.T("region.map_outside", "지금 — 지역 밖(던전 속)");
            // PLAN.md 109-10-6 — 사연 평정 수(웹 퀘스트 탭 "📜 지역 사연 n/9 평정").
            if (_sagaCount != null) _sagaCount.text = string.Format(DungeonLocalization.T("saga.map_count", "📜 지역 사연 {0}/{1} 평정"),
                RegionSagaState.DoneCount(), DungeonWorldMap.All.Length);
        }

        /// <summary>칸 바탕 = 그 지역 땅빛(웹 ground 그대로, 반투명).</summary>
        public static Color IdleColor(int i)
        {
            var g = DungeonWorldMap.All[i].Ground;
            return new Color(g.r, g.g, g.b, 0.75f);
        }

        private void BuildRegionCells()
        {
            if (panel == null) return;
            var prt = (RectTransform)panel.transform;
            prt.sizeDelta = new Vector2(480f, 600f);
            var grid = panel.transform.Find("Grid");
            if (grid == null) return;
            foreach (Transform old in grid) old.gameObject.SetActive(false); // 예전 나침반 다섯 칸.
            var gridRect = (RectTransform)grid;
            gridRect.anchoredPosition = new Vector2(0f, -45f);

            var title = panel.transform.Find("Title");
            _where = NewText(panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -72f), new Vector2(440f, 36f), 22);
            _where.gameObject.name = "Where";
            // 판 맨 아래(칸 밑 35px 틈) — 사연 평정 수.
            _sagaCount = NewText(panel.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 8f), new Vector2(440f, 26f), 18);
            _sagaCount.gameObject.name = "SagaCount";
            if (title != null) title.SetAsLastSibling();

            _cells = new Image[DungeonWorldMap.All.Length];
            for (int i = 0; i < _cells.Length; i++)
            {
                var r = DungeonWorldMap.All[i];
                var cellGo = new GameObject("Region_" + r.Key, typeof(RectTransform));
                cellGo.transform.SetParent(grid, false);
                var crt = (RectTransform)cellGo.transform;
                crt.anchorMin = crt.anchorMax = crt.pivot = new Vector2(0.5f, 0.5f);
                crt.anchoredPosition = new Vector2(r.GridX * CellGap, r.GridZ * CellGap);
                crt.sizeDelta = new Vector2(CellSize, CellSize);
                var img = cellGo.AddComponent<Image>();
                img.color = IdleColor(i);
                _cells[i] = img;
                var t = NewText(cellGo.transform, "", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(CellSize - 8f, CellSize - 8f), 20);
                t.text = CellLabel(i);
            }
        }

        /// <summary>칸 글 — 이름·한자·자리 + PLAN.md 109-10-5 우두머리 줄(☠ 이름, 토벌했으면 ✔, 쉬는 중이면 흐리게 — 웹 큰 지도 결).</summary>
        public static string CellLabel(int i)
        {
            var r = DungeonWorldMap.All[i];
            string boss = "☠ " + DungeonRegionFoes.BossName(i) + (RegionBossState.Kills(i) > 0 ? " ✔" : "");
            if (RegionBossState.IsResting(i)) boss = $"<color=#8c8c8c>{boss}</color>";
            return $"{Saga.Dungeon.World.RegionSagaRunner.MapMark(i)} {DungeonWorldMap.Name(i)}\n<size=17>{r.Hanja}</size>\n<size=15>{DungeonWorldMap.Place(i)}</size>\n<size=14>{boss}</size>";
        }

        /// <summary>펼칠 때 칸 글을 다시 — 우두머리 토벌·쉼이 바뀌었을 수 있다.</summary>
        public void RefreshCellTexts()
        {
            if (_cells == null) return;
            for (int i = 0; i < _cells.Length; i++) _cells[i].GetComponentInChildren<TextMeshProUGUI>().text = CellLabel(i);
        }

        private static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var t = go.AddComponent<TextMeshProUGUI>();
            t.fontSize = fontSize;
            t.alignment = TextAlignmentOptions.Center;
            t.color = Color.white;
            t.richText = true;
            t.textWrappingMode = TextWrappingModes.Normal;
            t.overflowMode = TextOverflowModes.Overflow;
            t.raycastTarget = false;
            t.text = content;
            Saga.Core.TmpEffect.Add(go, Saga.Core.TmpEffect.Kind.Outline, new Color(0f, 0f, 0f, 0.8f), 0.18f);
            return t;
        }
    }
}
