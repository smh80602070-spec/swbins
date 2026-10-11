using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using Saga.Realm.Data;
using Saga.Realm.UI;
using T = Saga.Realm.Data.RealmTactics;

namespace Saga.Realm.World
{
    /// <summary>
    /// tasks U-0099 격자 전술판 3D — 웹 사가천하 `tactics-view3d.js`(W-0159)·고돗 G-0183 의 이 트랙 판.
    /// 출진 전 "♟ 전술판" 토글이 켜져 있으면 싸움터(`RealmBattlefield`)처럼 지도 밖 먼 자리(<see cref="Origin"/>)에 판을 짓고
    /// 제 카메라(깊이 50)로 덮는다. 칸 = 1m 상자(높이·색은 웹 그대로), 장수 = 싸움터 장수와 같은 몸(`RealmFigure`), 부대 = 작은 몸.
    /// **판정은 <see cref="RealmTactics"/> 하나** — 이 파일은 고르기·입력·연출만. 적 차례·맡기기는 규칙을 먼저 돌리고
    /// 전후 차이(자리·기록)를 유닛마다 "옮김 → 그 유닛의 공격" 순으로 재생한다(G-0183 연출 방식).
    /// 판이 열린 동안 다른 캔버스·성 카메라 입력을 멈추고, 닫을 때 되돌린다. 끝나면 보정값(물러나면 null)을 넘기고 통째로 지운다.
    /// 원시 도형·있는 몸만(새 에셋 없음).
    /// </summary>
    public class RealmTacticsView : MonoBehaviour
    {
        public static readonly Vector3 Origin = new Vector3(5000f, 0f, 5000f);
        public const float StepS = 0.25f, SwingS = 0.4f, PitchDeg = 50f, Fov = 40f, CamDist = 11.5f, EndHold = 1.2f;
        public const float OfficerHeight = 0.95f, TroopHeight = 0.66f;

        private static readonly Color Plain = Hex(0xc8b47a), Forest = Hex(0x5f8446), River = Hex(0x4f86b3), WallC = Hex(0x857563);
        private static readonly Color Me = Hex(0x3d8bd9), Foe = Hex(0xd24b3c);
        private static readonly Color MoveMark = new Color(0.55f, 0.82f, 1f), TargetMark = new Color(0.95f, 0.35f, 0.3f), SelMark = new Color(1f, 0.85f, 0.3f);
        private static readonly Color Field = new Color(0.4f, 0.5f, 0.32f), Sky = new Color(0.62f, 0.75f, 0.86f), TreeC = new Color(0.27f, 0.45f, 0.24f);

        public static RealmTacticsView Active { get; private set; }

        public T.Board Board { get; private set; }
        public Camera Cam { get; private set; }
        public string Selected { get; private set; }
        public bool Busy => _busy;
        public int FigureCount => _figs.Count;
        public int TargetCount => _targets.Count;
        public int MoveCellCount => _moveCells.Count;
        public string Info => _info != null ? _info.text : "";
        /// <summary>판을 여는 동안 멈춘 캔버스·성 카메라 수(닫으면 되돌린다) — 진단.</summary>
        public int PausedCount => _hidden.Count + _paused.Count;

        private Action<T.Bonus> _done;
        private bool _instant, _busy, _closing;
        private readonly Dictionary<string, RealmFigure> _figs = new Dictionary<string, RealmFigure>();
        private readonly Dictionary<string, TextMeshPro> _labels = new Dictionary<string, TextMeshPro>();
        private readonly Dictionary<string, int> _shownHp = new Dictionary<string, int>();
        private readonly HashSet<string> _targets = new HashSet<string>();
        private readonly HashSet<int> _moveCells = new HashSet<int>();
        private readonly List<GameObject> _marks = new List<GameObject>();
        private readonly List<Canvas> _hidden = new List<Canvas>();
        private readonly List<Behaviour> _paused = new List<Behaviour>();
        private Canvas _canvas;
        private TextMeshProUGUI _info;
        private static readonly Dictionary<Color, Material> Mats = new Dictionary<Color, Material>();
        private static Mesh _cone;

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);

        /* ── 순수 함수(진단) ── */

        /// <summary>칸 (x, y) 가운데 — 판 로컬, 내 편(x 작음)이 왼쪽·0행이 먼 쪽.</summary>
        public static Vector3 CellCenter(int x, int y) => new Vector3(x - (T.Cols - 1) / 2f, 0f, (T.Rows - 1) / 2f - y);

        /// <summary>판 로컬 점 → 칸. 판 밖이면 (−1, −1).</summary>
        public static Vector2Int CellOf(Vector3 local)
        {
            int x = Mathf.FloorToInt(local.x + T.Cols / 2f), y = Mathf.FloorToInt(T.Rows / 2f - local.z);
            return x < 0 || y < 0 || x >= T.Cols || y >= T.Rows ? new Vector2Int(-1, -1) : new Vector2Int(x, y);
        }

        public static float Height(T.Cell c) => c == T.Cell.Forest ? 0.2f : c == T.Cell.River ? -0.3f : c == T.Cell.Wall ? 0.8f : 0f;

        /* ── 열기·닫기 ── */

        /// <summary>판을 연다 — 칠 수 없는 출진(목표 없음·함락·장수·병력 500·군량)이면 null(부르는 쪽이 그냥 출진해 Attack 이 이유를 말한다).
        /// done = 끝나면 보정값, 물러나면 null. instant = 연출 없이(진단).</summary>
        public static RealmTacticsView Open(string fromCityId, string enemyId, Action<T.Bonus> done, bool instant = false)
        {
            var city = RealmCityState.CityRecord(fromCityId);
            if (city == null || city.Troops < 500) return null;
            int need = Mathf.RoundToInt(city.Troops / 1000f * RealmCityState.FoodPer1000 * 2f); // RealmWarState.Attack 과 같은 문턱
            if (city.Food < need) return null;
            var b = T.Open(fromCityId, enemyId);
            if (b == null) return null;
            Close();
            var go = new GameObject("RealmTacticsView");
            go.transform.position = Origin;
            var v = go.AddComponent<RealmTacticsView>();
            v.Board = b; v._done = done; v._instant = instant;
            Active = v;
            v.Build();
            v.Refresh();
            return v;
        }

        /// <summary>열린 판을 보정 없이 닫는다(콜백 없음).</summary>
        public static void Close()
        {
            if (Active == null) return;
            var v = Active;
            v._done = null;
            v.Teardown();
        }

        private void Teardown()
        {
            if (Active == this) Active = null;
            foreach (var c in _hidden) if (c != null) c.enabled = true;
            foreach (var b in _paused) if (b != null) b.enabled = true;
            _hidden.Clear(); _paused.Clear();
            if (Application.isPlaying) Destroy(gameObject); else DestroyImmediate(gameObject);
        }

        private void Build()
        {
            Spawn("Field", PrimitiveType.Cube, new Vector3(0f, -0.55f, 0f), new Vector3(34f, 0.1f, 34f), Field);
            for (int y = 0; y < T.Rows; y++)
            {
                for (int x = 0; x < T.Cols; x++)
                {
                    var c = T.CellAt(Board, x, y).Value;
                    float h = Height(c);
                    var at = CellCenter(x, y);
                    var col = c == T.Cell.Forest ? Forest : c == T.Cell.River ? River : c == T.Cell.Wall ? WallC : Plain;
                    if (((x + y) & 1) == 1) col *= 0.94f; // 칸 경계가 보이게 바둑 무늬로 살짝
                    Spawn($"Cell_{x}_{y}", PrimitiveType.Cube, at + new Vector3(0f, h - 0.25f, 0f), new Vector3(0.97f, 0.5f, 0.97f), col);
                    if (c == T.Cell.Forest)
                    {
                        Cone("Tree", at + new Vector3(-0.2f, h, 0.18f), 0.17f, 0.62f, TreeC);
                        Cone("Tree", at + new Vector3(0.22f, h, -0.15f), 0.14f, 0.5f, TreeC);
                    }
                    else if (c == T.Cell.Wall)
                    {
                        Spawn("Merlon", PrimitiveType.Cube, at + new Vector3(-0.25f, h + 0.1f, 0f), new Vector3(0.25f, 0.2f, 0.9f), WallC * 0.9f);
                        Spawn("Merlon", PrimitiveType.Cube, at + new Vector3(0.25f, h + 0.1f, 0f), new Vector3(0.25f, 0.2f, 0.9f), WallC * 0.9f);
                    }
                }
            }

            foreach (var u in Board.Units)
            {
                bool me = u.Side == "me";
                var fig = RealmFigure.Create(u.Uid, transform, UnitPos(u), me ? 90f : -90f, me ? Me : Foe,
                    u.Kind == "officer" ? OfficerHeight : TroopHeight, (u.X * 7 + u.Y) * 0.13f,
                    u.Kind == "officer" ? RealmBodies.Role.Officer : RealmBodies.Role.Wanderer,
                    u.Kind == "officer" ? u.Id : Board.EnemyId + ":" + u.Uid);
                Spawn("Disc", PrimitiveType.Cylinder, new Vector3(0f, 0.02f, 0f), new Vector3(0.78f, 0.015f, 0.78f), me ? Me : Foe, fig.transform);
                _figs[u.Uid] = fig;
                _shownHp[u.Uid] = u.Hp;
            }

            var camGo = new GameObject("TacticsCam");
            camGo.transform.SetParent(transform, false);
            float p = PitchDeg * Mathf.Deg2Rad;
            camGo.transform.localPosition = new Vector3(0f, CamDist * Mathf.Sin(p), -CamDist * Mathf.Cos(p) - 0.4f);
            camGo.transform.LookAt(transform.position + new Vector3(0f, 0f, -0.4f));
            Cam = camGo.AddComponent<Camera>();
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = Sky;
            Cam.fieldOfView = Fov;
            Cam.nearClipPlane = 0.3f;
            Cam.farClipPlane = 80f;
            Cam.depth = 50f;

            // 다른 캔버스(명령·HUD·알림)와 성 카메라 입력을 멈춘다 — 판 위 클릭이 지도를 돌리거나 명령 단추를 누르지 않게.
            // 일시정지 메뉴(Esc)는 남긴다 — 숨기면 시간이 멈춘 채 메뉴가 안 보인다.
            var pause = Saga.Core.SagaPauseMenu.Instance != null ? Saga.Core.SagaPauseMenu.Instance.transform : null;
            foreach (var c in FindObjectsByType<Canvas>(FindObjectsSortMode.None))
                if (c.isRootCanvas && c.enabled && (pause == null || !c.transform.IsChildOf(pause))) { c.enabled = false; _hidden.Add(c); }
            foreach (var b in FindObjectsByType<Saga.Realm.Player.RealmOrbitCamera>(FindObjectsSortMode.None))
                if (b.enabled) { b.enabled = false; _paused.Add(b); }
            foreach (var b in FindObjectsByType<Saga.Realm.Player.RealmWorldMapCamera>(FindObjectsSortMode.None))
                if (b.enabled) { b.enabled = false; _paused.Add(b); }

            _canvas = RealmUiKit.NewCanvas("RealmTacticsUI");
            _canvas.transform.SetParent(transform, false);
            _canvas.sortingOrder = 60;
            var bar = RealmUiKit.NewPanel(_canvas.transform, new Vector2(0.5f, 1f), new Vector2(1180f, 96f), new Color(0f, 0f, 0f, 0.55f));
            ((RectTransform)bar.transform).anchoredPosition = new Vector2(0f, -16f);
            _info = RealmUiKit.NewText(bar.transform, "", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1150f, 90f), 26);
            RealmUiKit.NewButton(_canvas.transform, RealmLocalization.T("tactics.end_turn", "턴 끝"), new Vector2(1f, 0f), new Vector2(-24f, 24f), new Vector2(200f, 96f), PressEndTurn);
            RealmUiKit.NewButton(_canvas.transform, RealmLocalization.T("tactics.delegate", "맡기기"), new Vector2(1f, 0f), new Vector2(-240f, 24f), new Vector2(200f, 96f), PressDelegate);
            RealmUiKit.NewButton(_canvas.transform, RealmLocalization.T("tactics.retreat", "취소 — 물러남"), new Vector2(1f, 0f), new Vector2(-456f, 24f), new Vector2(200f, 96f), Retreat);

            foreach (var u in Board.Units)
            {
                var lgo = new GameObject("Label_" + u.Uid);
                lgo.transform.SetParent(transform, false);
                var t = lgo.AddComponent<TextMeshPro>();
                if (_info.font != null) t.font = _info.font;
                t.fontSize = 2.4f;
                t.alignment = TextAlignmentOptions.Center;
                t.textWrappingMode = TextWrappingModes.NoWrap;
                t.rectTransform.sizeDelta = new Vector2(3f, 1f);
                t.color = Color.white;
                t.outlineWidth = 0.2f;
                t.outlineColor = new Color32(0, 0, 0, 255);
                _labels[u.Uid] = t;
            }
            SnapToBoard();
        }

        /* ── 매 프레임 ── */

        private void Update()
        {
            if (_closing || _instant || Board == null) return;
            if (_busy || Board.Done != null) return;
            // Esc 는 공용 일시정지(SagaFlow)가 쓴다 — 물러남은 단추로.
            Vector2? press = null;
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame) press = Mouse.current.position.ReadValue();
            else if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.wasPressedThisFrame) press = Touchscreen.current.primaryTouch.position.ReadValue();
            if (!press.HasValue) return;
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) return; // 단추 위
            var ray = Cam.ScreenPointToRay(press.Value);
            if (Mathf.Abs(ray.direction.y) < 1e-4f) return;
            float d = (transform.position.y - ray.origin.y) / ray.direction.y;
            if (d <= 0f) return;
            var cell = CellOf(ray.origin + ray.direction * d - transform.position);
            if (cell.x >= 0) Tap(cell.x, cell.y);
        }

        private void LateUpdate()
        {
            if (Cam == null) return;
            foreach (var kv in _labels)
            {
                var u = T.UnitOf(Board, kv.Key);
                var fig = _figs[kv.Key];
                var t = kv.Value;
                bool show = fig != null && fig.gameObject.activeSelf;
                t.gameObject.SetActive(show);
                if (!show) continue;
                t.transform.position = fig.transform.position + Vector3.up * (u.Kind == "officer" ? 1.45f : 1.1f);
                t.transform.rotation = Cam.transform.rotation;
            }
        }

        /* ── 입력(진단도 부른다) ── */

        /// <summary>칸 하나를 눌렀다 — 내 장수면 고르기, 고른 장수의 갈 칸이면 옮기기, 칠 적이면 치기, 그 밖이면 고르기 풂.</summary>
        public void Tap(int x, int y)
        {
            if (Board.Done != null || _busy || _closing) return;
            T.Unit at = null;
            foreach (var u in Board.Units) if (u.Hp > 0 && u.X == x && u.Y == y) { at = u; break; }
            if (at != null && at.Side == "me")
            {
                if (!at.Acted) Select(at.Uid); else Deselect();
                return;
            }
            var s = Selected != null ? T.UnitOf(Board, Selected) : null;
            if (s != null)
            {
                if (at != null && _targets.Contains(at.Uid)) { DoAttack(s, at); return; }
                if (at == null && !s.Moved && _moveCells.Contains(y * T.Cols + x)) { DoMove(s, x, y); return; }
            }
            Deselect();
        }

        public void PressEndTurn()
        {
            if (Board.Done != null || _busy || _closing) return;
            Deselect();
            var snap = Snap();
            T.EndTurn(Board);
            Play(Diff(snap), AfterStep);
        }

        /// <summary>「맡기기」 — 남은 턴을 양쪽 AI 로(내 차례 → 적 차례 …). <see cref="RealmTactics.AutoPlay"/> 와 같은 수순.</summary>
        public void PressDelegate()
        {
            if (Board.Done != null || _busy || _closing) return;
            Deselect();
            if (_instant)
            {
                int guard = 0;
                while (Board.Done == null && guard++ < 20) { T.AutoTurn(Board); if (Board.Done != null) break; T.EndTurn(Board); }
                SnapToBoard();
                AfterStep();
                return;
            }
            Play(DelegateRun(), AfterStep);
        }

        /// <summary>물러남(단추) — 보정 없이 판을 닫는다(부르는 쪽은 그냥 출진).</summary>
        public void Retreat()
        {
            if (_closing) return;
            Complete(null);
        }

        private void Select(string uid)
        {
            Selected = uid;
            var u = T.UnitOf(Board, uid);
            _moveCells.Clear(); _targets.Clear();
            if (!u.Moved) foreach (var c in T.Moves(Board, uid)) if (c.x != u.X || c.y != u.Y) _moveCells.Add(c.y * T.Cols + c.x);
            if (!u.Acted)
                foreach (var f in T.Alive(Board, "foe"))
                    if (Mathf.Abs(f.X - u.X) + Mathf.Abs(f.Y - u.Y) <= u.Rng) _targets.Add(f.Uid);
            Refresh();
        }

        private void Deselect()
        {
            Selected = null;
            _moveCells.Clear(); _targets.Clear();
            Refresh();
        }

        private void DoMove(T.Unit s, int x, int y)
        {
            int fx = s.X, fy = s.Y;
            if (!T.Move(Board, s.Uid, x, y)) return;
            string uid = s.Uid;
            Play(Walk(uid, fx, fy, x, y), () => Select(uid));
        }

        private void DoAttack(T.Unit s, T.Unit t)
        {
            int n0 = Board.Log.Count;
            var r = T.Attack(Board, s.Uid, t.Uid);
            if (!r.Ok) return;
            Deselect();
            Play(Strikes(n0, null), AfterStep);
        }

        private void AfterStep()
        {
            if (Board.Done != null) { Finish(); return; }
            Refresh();
        }

        /* ── 연출 ── */

        private struct UnitSnap { public int X, Y, Hp; }

        /// <summary>규칙을 돌리기 전 판 — 유닛 자리·hp 와 그때의 기록 길이(기록은 덧붙기만 한다).</summary>
        private sealed class TurnSnap
        {
            public readonly Dictionary<string, UnitSnap> Units = new Dictionary<string, UnitSnap>();
            public int Log;
        }

        private TurnSnap Snap()
        {
            var d = new TurnSnap { Log = Board.Log.Count };
            foreach (var u in Board.Units) d.Units[u.Uid] = new UnitSnap { X = u.X, Y = u.Y, Hp = u.Hp };
            return d;
        }

        private void Play(IEnumerator anim, Action then)
        {
            if (_instant || !isActiveAndEnabled) { SnapToBoard(); then?.Invoke(); return; }
            StartCoroutine(Run(anim, then));
        }

        private IEnumerator Run(IEnumerator anim, Action then)
        {
            _busy = true;
            Refresh();
            yield return anim;
            _busy = false;
            SnapToBoard();
            then?.Invoke();
        }

        private IEnumerator DelegateRun()
        {
            int guard = 0;
            while (Board.Done == null && guard++ < 20)
            {
                var snap = Snap();
                T.AutoTurn(Board);
                yield return Diff(snap);
                if (Board.Done != null) break;
                snap = Snap();
                T.EndTurn(Board);
                yield return Diff(snap);
            }
        }

        /// <summary>규칙이 이미 바꾼 판 — 유닛 순서대로 "옮김 → 그 유닛의 공격"을 재생한다(판정 없음).</summary>
        private IEnumerator Diff(TurnSnap snap)
        {
            foreach (var kv in snap.Units)
            {
                _shownHp[kv.Key] = kv.Value.Hp;
                _figs[kv.Key].transform.localPosition = PosAt(kv.Value.X, kv.Value.Y); // 규칙이 이미 옮겼다 — 몸은 옛 자리에서 걷는다
                RefreshLabel(kv.Key, null);
            }
            foreach (var u in Board.Units)
            {
                var s = snap.Units[u.Uid];
                if (s.X != u.X || s.Y != u.Y) yield return Walk(u.Uid, s.X, s.Y, u.X, u.Y);
                for (int i = snap.Log; i < Board.Log.Count; i++)
                    if (Board.Log[i].A == u.Uid) yield return Strike(Board.Log[i]);
            }
        }

        private IEnumerator Strikes(int n0, string only)
        {
            for (int i = n0; i < Board.Log.Count; i++)
                if (only == null || Board.Log[i].A == only) yield return Strike(Board.Log[i]);
        }

        private IEnumerator Walk(string uid, int fx, int fy, int tx, int ty)
        {
            var fig = _figs[uid];
            var u = T.UnitOf(Board, uid);
            fig.Play("walk");
            int x = fx, y = fy;
            while (x != tx || y != ty)
            {
                int nx = x != tx ? x + Math.Sign(tx - x) : x, ny = x != tx ? y : y + Math.Sign(ty - y); // 가로 먼저(웹 그대로)
                var a = PosAt(x, y); var b = PosAt(nx, ny);
                Face(fig, b - a);
                for (float t = 0f; t < StepS; t += Time.deltaTime)
                {
                    fig.transform.localPosition = Vector3.Lerp(a, b, t / StepS);
                    yield return null;
                }
                x = nx; y = ny;
            }
            fig.transform.localPosition = PosAt(tx, ty);
            fig.Play("idle");
            Face(fig, new Vector3(u.Side == "me" ? 1f : -1f, 0f, 0f));
        }

        private IEnumerator Strike(T.LogEntry e)
        {
            if (!_figs.TryGetValue(e.A, out var a) || !_figs.TryGetValue(e.To, out var t)) yield break;
            Face(a, t.transform.localPosition - a.transform.localPosition);
            a.Play("attack");
            yield return Wait(SwingS * 0.6f);
            string pop;
            if (e.Hit)
            {
                t.Play("hit");
                _shownHp[e.To] = Mathf.Max(0, _shownHp[e.To] - e.Dmg);
                pop = $"<color=#ff6b5a>−{e.Dmg}</color>";
            }
            else pop = $"<color=#cfd8e3>{RealmLocalization.T("tactics.miss", "빗나감")}</color>";
            RefreshLabel(e.To, pop);
            yield return Wait(SwingS * 0.4f + 0.25f);
            a.Play("idle");
            if (_shownHp[e.To] <= 0)
            {
                t.Play("die");
                yield return Wait(0.8f);
                t.gameObject.SetActive(false);
            }
            else t.Play("idle");
            RefreshLabel(e.To, null);
        }

        private static IEnumerator Wait(float s) { for (float t = 0f; t < s; t += Time.deltaTime) yield return null; }

        private static void Face(RealmFigure f, Vector3 dir)
        {
            dir.y = 0f;
            if (dir.sqrMagnitude < 1e-4f) return;
            f.transform.localRotation = Quaternion.LookRotation(dir.normalized, Vector3.up);
        }

        private Vector3 PosAt(int x, int y)
        {
            var c = T.CellAt(Board, x, y);
            return CellCenter(x, y) + Vector3.up * (c.HasValue ? Height(c.Value) : 0f);
        }

        private Vector3 UnitPos(T.Unit u) => PosAt(u.X, u.Y);

        /// <summary>규칙의 판 그대로 몸·hp 를 맞춘다(연출 없이 / 연출 끝).</summary>
        private void SnapToBoard()
        {
            foreach (var u in Board.Units)
            {
                if (!_figs.TryGetValue(u.Uid, out var fig) || fig == null) continue;
                fig.transform.localPosition = UnitPos(u);
                _shownHp[u.Uid] = u.Hp;
                if (u.Hp <= 0) fig.gameObject.SetActive(false);
            }
            foreach (var u in Board.Units) RefreshLabel(u.Uid, null);
        }

        /* ── 끝 ── */

        private void Finish()
        {
            if (_closing) return;
            var o = T.OutcomeOf(Board);
            var g = T.Apply(o, Board.EnemyId);
            _info.text = string.Format(RealmLocalization.T("tactics.result", "♟️ 전술판 {0} — 공 위력 {1}{2}%{3}"), o.Name, o.WinPct >= 0 ? "+" : "", o.WinPct,
                o.LossMul != 1f ? string.Format(RealmLocalization.T("tactics.note_take", " · 받는 피해 ×{0}"), o.LossMul) : "");
            ClearMarks();
            if (_instant || !isActiveAndEnabled) { Complete(g); return; }
            _closing = true;
            StartCoroutine(Hold(g));
        }

        private IEnumerator Hold(T.Bonus g)
        {
            yield return Wait(EndHold);
            Complete(g);
        }

        private void Complete(T.Bonus g)
        {
            _closing = true;
            var done = _done;
            _done = null;
            Teardown();
            done?.Invoke(g);
        }

        /* ── 그리기 ── */

        private void Refresh()
        {
            if (_info == null || Board == null) return;
            string city = RealmEnemyCity.Get(Board.EnemyId)?.Name ?? Board.EnemyId;
            string head = string.Format(RealmLocalization.T("tactics.head", "♟️ 전술판 — {0} · {1}/{2}턴"), city, Mathf.Min(Board.Turn, T.Turns), T.Turns);
            string hint = _busy ? RealmLocalization.T("tactics.hint_busy", "움직이는 중…")
                : Selected == null ? RealmLocalization.T("tactics.hint_pick", "파랑 원 장수를 고르세요 · 다 두면 「턴 끝」")
                : RealmLocalization.T("tactics.hint_act", "하늘빛 칸 = 갈 곳 · 붉은 판 = 칠 적(명중 %)");
            _info.text = head + "\n" + hint;
            ClearMarks();
            if (Selected != null)
            {
                var s = T.UnitOf(Board, Selected);
                Mark(s.X, s.Y, SelMark);
                foreach (var k in _moveCells) Mark(k % T.Cols, k / T.Cols, MoveMark);
                foreach (var id in _targets) { var f = T.UnitOf(Board, id); Mark(f.X, f.Y, TargetMark); }
            }
            foreach (var u in Board.Units) RefreshLabel(u.Uid, null);
        }

        private void RefreshLabel(string uid, string pop)
        {
            if (!_labels.TryGetValue(uid, out var t)) return;
            var u = T.UnitOf(Board, uid);
            string name = u.Kind == "officer" ? (RealmOfficerPool.Get(u.Id)?.Name ?? u.Id) : RealmLocalization.T("tactics.troop", "부대");
            int hp = _shownHp.TryGetValue(uid, out var h) ? h : u.Hp;
            string line = $"{name}\n<size=80%>{hp}/{u.Max}</size>";
            if (pop != null) line += "\n" + pop;
            else if (_targets.Contains(uid) && Selected != null)
            {
                var s = T.UnitOf(Board, Selected);
                line += $"\n<color=#ffd94a>{RealmLocalization.T("tactics.hit", "명중")} {T.HitChance(s, u, T.CoverAt(Board, u.X, u.Y))}%</color>";
            }
            t.text = line;
        }

        private void Mark(int x, int y, Color c)
        {
            var go = Spawn("Mark", PrimitiveType.Cube, PosAt(x, y) + new Vector3(0f, 0.012f, 0f), new Vector3(0.86f, 0.02f, 0.86f), c);
            _marks.Add(go);
        }

        private void ClearMarks()
        {
            foreach (var m in _marks) if (m != null) { if (Application.isPlaying) Destroy(m); else DestroyImmediate(m); }
            _marks.Clear();
        }

        private GameObject Spawn(string name, PrimitiveType type, Vector3 localPos, Vector3 scale, Color color, Transform parent = null)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent != null ? parent : transform, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            var col = go.GetComponent<Collider>();
            if (col != null) { if (Application.isPlaying) Destroy(col); else DestroyImmediate(col); }
            go.GetComponent<MeshRenderer>().sharedMaterial = Mat(color);
            return go;
        }

        private void Cone(string name, Vector3 localPos, float radius, float height, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = new Vector3(radius, height, radius);
            go.AddComponent<MeshFilter>().sharedMesh = ConeMesh();
            go.AddComponent<MeshRenderer>().sharedMaterial = Mat(color);
        }

        private static Material Mat(Color c)
        {
            c.a = 1f;
            if (Mats.TryGetValue(c, out var m) && m != null) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Tactics (generated)", color = c };
            m.SetFloat("_Smoothness", 0.12f);
            Mats[c] = m;
            return m;
        }

        private static Mesh ConeMesh()
        {
            if (_cone != null) return _cone;
            const int n = 8;
            var v = new List<Vector3>();
            var tri = new List<int>();
            for (int i = 0; i < n; i++)
            {
                float a0 = i * Mathf.PI * 2f / n, a1 = (i + 1) * Mathf.PI * 2f / n;
                int b = v.Count;
                v.Add(new Vector3(Mathf.Cos(a0), 0f, Mathf.Sin(a0)));
                v.Add(new Vector3(0f, 1f, 0f));
                v.Add(new Vector3(Mathf.Cos(a1), 0f, Mathf.Sin(a1)));
                tri.Add(b); tri.Add(b + 1); tri.Add(b + 2);
            }
            _cone = new Mesh { name = "TacticsCone" };
            _cone.SetVertices(v);
            _cone.SetTriangles(tri, 0);
            _cone.RecalculateNormals();
            _cone.RecalculateBounds();
            return _cone;
        }
    }
}
