using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-10 들판 보스(웹 사가고 ⑲-10 `fieldboss.js`) — 새 보스를 세우지 않고 망루 수호장(107-7)이 들판 보스다.
    /// 쓰러뜨리면 그 자리에 보상 꽃(수호장 겉 원소 빛, 도형) — 5.6m 안(웹 3m × 1.85)에 서면 카드: 원기 30 을 쓰고 받는다(★4 보패 1 · 금 100 × 지역 위험 × 천하 전리품 배율),
    /// 모자라면 꽃이 남는다. 받으면 150초 뒤 수호장이 다시 선다(이 컴포넌트가 켜고 되살린다). 웹 보스 재료(인물 승급용)·부대 경험은 이 트랙에 승급·인물 경험이 없어 뺐다.
    /// `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너.
    /// </summary>
    public class GuardianBloom : MonoBehaviour
    {
        public const int Cost = 30, ArtRarity = 4, GoldPerTier = 100;
        public const float ClaimR = 5.6f;

        public static GuardianBloom Instance { get; private set; }

        private GameObject _flower, _card;
        private TextMeshProUGUI _cardText;
        private float _wait;
        private bool _dismissed;

        public bool FlowerShown => _flower != null && _flower.activeSelf;
        public bool CardShown => _card != null && _card.activeSelf;
        public string CardText => _cardText.text;
        public Button ClaimButton { get; private set; }
        public Button KeepButton { get; private set; }

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            BuildFlower();
            BuildCard();
            Refresh();
        }

        public static Vector3 Spot
        {
            get
            {
                var g = FieldEnemy.GuardianInstance;
                Vector3 p = g != null ? g.Home : TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                return FolkWalker.Grounded(p);
            }
        }

        public static int Tier => GoWorldMap.DangerOf(GoWorldMap.RegionAt(Spot));
        public static int GoldNow => Mathf.RoundToInt(GoldPerTier * Mathf.Max(1, Tier) * GoAdventure.LootMul(AdventureState.WorldLevel));

        private void BuildFlower()
        {
            _flower = new GameObject("BossBloom");
            _flower.transform.SetParent(transform, false);
            var el = FieldEnemy.GuardianOuter;
            var c = GoElements.ColorOf(el);
            var petal = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BossBloom (generated)", color = c };
            petal.EnableKeyword("_EMISSION");
            petal.SetColor("_EmissionColor", c * 2.4f);
            var stem = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BossBloomStem (generated)", color = new Color(0.25f, 0.5f, 0.22f) };
            Prim(PrimitiveType.Cylinder, new Vector3(0f, 1f, 0f), new Vector3(0.25f, 1f, 0.25f), stem);
            for (int i = 0; i < 6; i++)
            {
                float a = i * Mathf.PI / 3f;
                var p = Prim(PrimitiveType.Sphere, new Vector3(Mathf.Cos(a) * 0.9f, 2.2f, Mathf.Sin(a) * 0.9f), new Vector3(1.1f, 0.35f, 0.7f), petal);
                p.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 20f);
            }
            Prim(PrimitiveType.Sphere, new Vector3(0f, 2.3f, 0f), Vector3.one * 0.7f, petal);
            _flower.SetActive(false);
        }

        private GameObject Prim(PrimitiveType t, Vector3 local, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(_flower.transform, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        private void BuildCard()
        {
            var canvas = EncounterUiKit.NewCanvas("BossBloomUI");
            canvas.sortingOrder = 6;
            var mid = new Vector2(0.5f, 0.5f);
            _card = new GameObject("BloomCard", typeof(RectTransform));
            _card.transform.SetParent(canvas.transform, false);
            var r = (RectTransform)_card.transform;
            r.anchorMin = r.anchorMax = r.pivot = mid;
            r.sizeDelta = new Vector2(660f, 300f);
            _card.AddComponent<Image>().color = new Color(0.05f, 0.03f, 0.06f, 0.92f);
            var title = EncounterUiKit.NewText(_card.transform, GoLocalization.T("boss.title", "보상 꽃"), mid, new Vector2(0f, 110f), new Vector2(620f, 40f), 26);
            title.fontStyle = FontStyles.Bold;
            title.rectTransform.pivot = mid;
            _cardText = EncounterUiKit.NewText(_card.transform, "", mid, new Vector2(0f, 30f), new Vector2(620f, 110f), 18);
            _cardText.rectTransform.pivot = mid;
            ClaimButton = EncounterUiKit.NewButton(_card.transform, "", mid, new Vector2(-150f, -95f), new Vector2(280f, 64f), null);
            ((RectTransform)ClaimButton.transform).pivot = mid;
            ClaimButton.onClick.AddListener(() => { Claim(out _); });
            KeepButton = EncounterUiKit.NewButton(_card.transform, GoLocalization.T("boss.btn_keep", "둔다"), mid, new Vector2(150f, -95f), new Vector2(280f, 64f), null);
            ((RectTransform)KeepButton.transform).pivot = mid;
            KeepButton.onClick.AddListener(() => { _dismissed = true; _card.SetActive(false); });
            _card.SetActive(false);
        }

        /// <summary>받는다 — 원기 30. 받았으면 알림 글, 아니면 null 과 까닭.</summary>
        public string Claim(out string why)
        {
            why = null;
            if (!GuardianState.Bloom) { why = GoLocalization.T("boss.why.none", "꽃이 없다"); return null; }
            if (!DomainState.Spend(Cost)) { why = string.Format(GoLocalization.T("domain.why.resin", "원기가 모자라다({0}/{1})"), DomainState.Resin, Cost); Toast(why); return null; }
            int gold = GoldNow;
            GoldState.Add(gold);
            string art = GoArtifacts.Label(ArtifactState.Get(ArtifactState.Add(ArtRarity)));
            GuardianState.MarkPaid();
            string text = string.Format(GoLocalization.T("boss.claimed", "보상 꽃 — 원기 {0} · 금 +{1} · {2} — 150초 뒤 망루 수호장이 다시 선다"), Cost, gold, art);
            Toast(text);
            Refresh();
            return text;
        }

        private void Update()
        {
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = 0.25f;
            Refresh();
        }

        /// <summary>꽃·카드·다시 세우기를 지금 상태로 — 진단도 부른다.</summary>
        public void Refresh()
        {
            if (_flower == null) return;
            bool bloom = GuardianState.Bloom;
            _flower.SetActive(bloom);
            if (bloom) _flower.transform.position = Spot;
            // 다시 서기 — 꽃을 받고 150초가 지났는데 쓰러진(꺼진) 채면 세운다
            var g = FieldEnemy.GuardianInstance;
            if (GuardianState.Standing && g != null && (!g.gameObject.activeSelf || !g.Alive))
            {
                g.gameObject.SetActive(true);
                g.ReviveNow();
                Toast(GoLocalization.T("boss.back", "망루 수호장이 다시 섰다"));
            }
            // 카드
            var fc = FieldCombat.Instance;
            bool near = false;
            if (bloom && fc != null)
            {
                Vector3 d = fc.transform.position - Spot;
                d.y = 0f;
                near = d.magnitude <= ClaimR;
            }
            if (!near) _dismissed = false;
            _card.SetActive(near && !_dismissed);
            if (_card.activeSelf)
            {
                int have = DomainState.Resin;
                _cardText.text = string.Format(GoLocalization.T("boss.card", "쓰러진 망루 수호장 자리에 꽃이 피었다.\n★{0} 보패 1 · 금 {1}\n원기 {2}/{3} · 받으면 150초 뒤 수호장이 다시 선다"),
                    ArtRarity, GoldNow, have, GoDomain.ResinMax);
                ClaimButton.GetComponentInChildren<TextMeshProUGUI>().text = have >= Cost
                    ? string.Format(GoLocalization.T("boss.btn_claim", "원기 {0} 쓰고 받는다"), Cost)
                    : GoLocalization.T("boss.btn_short", "원기가 모자라다 — 꽃은 남는다");
                ClaimButton.interactable = have >= Cost;
            }
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 3.5f);
        }
    }
}
