using System.Collections.Generic;
using TMPro;
using UnityEngine;
using Saga.Core;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0168 1만리 모닥불 쉼터(웹 W-0297 · 고돗 G-0305 짝) — 몸·앉기. 자리·지핌·부활 자리는 <see cref="GoRestSites"/>.
    /// 적이 서는 지역마다 모닥불 하나(자체툴 `campfire_logs_01`, 없으면 통나무 셋). 주인공이 <see cref="SitR"/> 안에 들고 싸움 중이 아니고
    /// 한 번 <see cref="LeaveR"/> 밖에 나갔다 왔으면 앉는다: 처음이면 불을 지핌 · 동료 모두 회복(쓰러진 이도)·기운 가득 · 부활 자리 = 이 불 옆 ·
    /// 그 지역의 쓰러진 잡몹이 바로 다시 선다(수호장·숨은 터·임무 적은 그대로). 지핀 불만 타오른다(빛·불꽃).
    /// 다 쓰러지면 `FieldCombat.SafePoint`(= 마지막으로 앉은 불 옆)에서 일어난다 — FieldCombat 은 안 고친다(SafePoint 만 옮김).
    /// 이름은 "모닥불" — U-0032 "쉼터 마당"(꾸미기)과 섞이지 않게. `WorldMapBuilder` 가 붙인다.
    /// </summary>
    public class RestSiteField : MonoBehaviour
    {
        public const float SitR = 3.5f, LeaveR = 12f, TickSec = 0.4f;

        public static RestSiteField Instance { get; private set; }

        private class Fire
        {
            public GoRestSites.Site Site;
            public Transform Root;
            public Light Glow;
            public GameObject Flame;
            public TextMeshPro Label;
            public bool Armed;
        }

        private readonly List<Fire> _fires = new List<Fire>();
        private float _tick;
        private bool _wipeToast;
        private Vector3 _home;
        private bool _homeKnown;

        /// <summary>진단 — 마지막으로 앉은 불·그때 다시 세운 잡몹 수.</summary>
        public string LastSat { get; private set; }
        public int LastRevived { get; private set; }

        private void Awake() => Instance = this;

        private void OnEnable() => FieldCombat.Wiped += OnWiped;

        private void OnDisable() => FieldCombat.Wiped -= OnWiped;

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            foreach (var s in GoRestSites.Sites) _fires.Add(Build(s));
            Refresh();
        }

        private Fire Build(GoRestSites.Site s)
        {
            var root = new GameObject("RestFire_" + s.Id).transform;
            root.SetParent(transform, false);
            root.position = Grounded(s.Pos);
            if (WorldModels.Spawn("campfire_logs_01", root, 1.4f) == null)
            {
                for (int i = 0; i < 3; i++)
                {
                    var log = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    Object.DestroyImmediate(log.GetComponent<Collider>());
                    log.name = "Log";
                    log.transform.SetParent(root, false);
                    log.transform.localScale = new Vector3(0.18f, 0.55f, 0.18f);
                    log.transform.localPosition = new Vector3(0f, 0.12f, 0f);
                    log.transform.localRotation = Quaternion.Euler(80f, i * 120f, 0f);
                    log.GetComponent<Renderer>().material.color = new Color(0.35f, 0.22f, 0.12f);
                }
            }
            var flame = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.DestroyImmediate(flame.GetComponent<Collider>());
            flame.name = "Flame";
            flame.transform.SetParent(root, false);
            flame.transform.localPosition = new Vector3(0f, 0.45f, 0f);
            flame.transform.localScale = new Vector3(0.45f, 0.7f, 0.45f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "RestFlame (generated)" };
            mat.color = new Color(1f, 0.55f, 0.15f);
            flame.GetComponent<Renderer>().sharedMaterial = mat;
            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(root, false);
            lightGo.transform.localPosition = new Vector3(0f, 1.2f, 0f);
            var glow = lightGo.AddComponent<Light>();
            glow.type = LightType.Point;
            glow.range = 9f;
            glow.intensity = 2.2f;
            glow.color = new Color(1f, 0.6f, 0.3f);
            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(root, false);
            labelGo.transform.localPosition = new Vector3(0f, 2.2f, 0f);
            var label = labelGo.AddComponent<TextMeshPro>();
            label.fontSize = 3.5f;
            label.alignment = TextAlignmentOptions.Center;
            label.rectTransform.sizeDelta = new Vector2(8f, 1.2f);
            return new Fire { Site = s, Root = root, Glow = glow, Flame = flame, Label = label, Armed = true };
        }

        private static Vector3 Grounded(Vector3 p)
        {
            Physics.SyncTransforms();
            var from = new Vector3(p.x, p.y + 60f, p.z);
            return Physics.Raycast(from, Vector3.down, out var hit, 200f, ~0, QueryTriggerInteraction.Ignore) ? hit.point : p;
        }

        /// <summary>지핀 불만 타오름 · 표지 글.</summary>
        public void Refresh()
        {
            foreach (var f in _fires)
            {
                bool lit = GoRestSites.IsLit(f.Site.Id);
                f.Glow.enabled = lit;
                f.Flame.SetActive(lit);
                f.Label.text = "🔥 " + GoWorldMap.RegionName(f.Site.Id) + (lit ? "" : GoLocalization.T("rest.unlit", " · 꺼짐"));
                f.Label.color = lit ? new Color(1f, 0.85f, 0.55f) : new Color(0.7f, 0.7f, 0.72f);
            }
            ApplySafePoint();
        }

        /// <summary>부활 자리 — 마지막으로 앉은 불 옆(없으면 처음 자리 그대로).</summary>
        public void ApplySafePoint()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            if (!_homeKnown) { _home = fc.SafePoint; _homeKnown = true; }
            var at = GoRestSites.Get(GoRestSites.At);
            Fire f = null;
            if (at != null) foreach (var x in _fires) if (x.Site.Id == at.Value.Id) f = x;
            fc.SafePoint = f != null ? f.Root.position + GoRestSites.WakeOffset : _home;
        }

        private void Update()
        {
            if (_wipeToast)
            {
                _wipeToast = false;
                DialogueLabel.Instance?.Show(GoLocalization.T("rest.wipe", "모두 쓰러졌다 — 마지막 모닥불 곁에서 기운을 차렸다(잃은 것 없음)"), 3f);
            }
            _tick -= Time.deltaTime;
            if (_tick > 0f) return;
            _tick = TickSec;
            Tick();
        }

        /// <summary>한 번 — 다가간 불이 있으면 앉는다(진단이 부른다). 앉았으면 그 지역 id.</summary>
        public string Tick()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return null;
            Vector3 me = fc.transform.position;
            foreach (var f in _fires)
            {
                Vector3 d = f.Root.position - me; d.y = 0f;
                float m = d.magnitude;
                if (m > LeaveR) { f.Armed = true; continue; }
                if (m > SitR || !f.Armed || fc.InCombat()) continue;
                f.Armed = false;
                Sit(f, fc);
                return f.Site.Id;
            }
            return null;
        }

        private void Sit(Fire f, FieldCombat fc)
        {
            bool first = GoRestSites.Sit(f.Site.Id);
            foreach (var m in fc.Party) m.Hp = m.MaxHp;
            GoStamina.ResetFull();
            int revived = 0;
            foreach (var e in FieldEnemy.All)
                if (e != null && GoWorldMap.RegionAt(e.Home) == f.Site.Id && e.ReviveSoon()) revived++;
            LastSat = f.Site.Id;
            LastRevived = revived;
            Refresh();
            string where = GoWorldMap.RegionName(f.Site.Id);
            DialogueLabel.Instance?.Show((first
                ? string.Format(GoLocalization.T("rest.lit", "🔥 {0} 모닥불을 지폈다 — 쓰러지면 여기서 일어난다"), where)
                : string.Format(GoLocalization.T("rest.sat", "🔥 {0} 모닥불 곁에서 쉬었다"), where))
                + (revived > 0 ? "\n" + string.Format(GoLocalization.T("rest.revive", "들판에 적 {0}이 다시 섰다"), revived) : ""), 3f);
        }

        private void OnWiped()
        {
            if (!string.IsNullOrEmpty(GoRestSites.At)) _wipeToast = true; // FieldCombat 이 "마을에서" 토스트를 띄운 다음 프레임에 덮는다
        }
    }
}
