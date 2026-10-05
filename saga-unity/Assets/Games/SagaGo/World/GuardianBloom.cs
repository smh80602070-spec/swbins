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
    /// 109-14-31 서리봉 고원 만년설 바위곰왕(웹 ⑲-31 `g_frost`)도 같은 틀 — 자리 둘(<see cref="Slot"/>): 망루 수호장 · 고원 곰왕(빙 빛, 금 100 × 위험 최고).
    /// 곰왕을 다시 세우는 일은 `FrostField.TickKing` 이 한다(고원에 들어서야 서니까).
    /// `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너.
    /// </summary>
    public class GuardianBloom : MonoBehaviour
    {
        public const int Cost = 30, ArtRarity = 4, GoldPerTier = 100;
        public const float ClaimR = 5.6f;

        public static GuardianBloom Instance { get; private set; }

        /// <summary>보상 꽃 하나 — 꽃 몸·카드·"둔다" 기억.</summary>
        private class Slot
        {
            public bool Frost;
            public GameObject Flower, Card;
            public TextMeshProUGUI CardText;
            public Button Claim, Keep;
            public bool Dismissed;
        }

        private Slot _tower, _frost;
        private float _wait;

        public bool FlowerShown => _tower.Flower != null && _tower.Flower.activeSelf;
        public bool CardShown => _tower.Card != null && _tower.Card.activeSelf;
        public string CardText => _tower.CardText.text;
        public Button ClaimButton => _tower.Claim;
        public Button KeepButton => _tower.Keep;
        public bool FrostFlowerShown => _frost.Flower != null && _frost.Flower.activeSelf;
        public bool FrostCardShown => _frost.Card != null && _frost.Card.activeSelf;
        public string FrostCardText => _frost.CardText.text;
        public Button FrostClaimButton => _frost.Claim;
        public Button FrostKeepButton => _frost.Keep;

        private void Awake()
        {
            Instance = this;
            _tower = new Slot();
            _frost = new Slot { Frost = true };
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            BuildFlower(_tower);
            BuildFlower(_frost);
            BuildCards();
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

        /// <summary>109-14-31 고원 곰왕이 쓰러진 자리(꺼져 있어도 집 = 서던 자리).</summary>
        public static Vector3 FrostSpot
        {
            get
            {
                var g = FieldEnemy.FrostKingInstance;
                return FolkWalker.Grounded(g != null ? g.Home : GoFrost.KingHome);
            }
        }

        public static int Tier => GoWorldMap.DangerOf(GoWorldMap.RegionAt(Spot));
        public static int GoldNow => Mathf.RoundToInt(GoldPerTier * Mathf.Max(1, Tier) * GoAdventure.LootMul(AdventureState.WorldLevel));
        /// <summary>고원 곰왕은 가장 센 수호자라 지역 위험을 최고(<see cref="GoWorldMap.MaxDanger"/>)로 친다.</summary>
        public static int FrostGoldNow => Mathf.RoundToInt(GoldPerTier * GoWorldMap.MaxDanger * GoAdventure.LootMul(AdventureState.WorldLevel));

        private void BuildFlower(Slot s)
        {
            s.Flower = new GameObject(s.Frost ? "FrostBossBloom" : "BossBloom");
            s.Flower.transform.SetParent(transform, false);
            var el = s.Frost ? FieldEnemy.FrostKingOuter : FieldEnemy.GuardianOuter;
            var c = GoElements.ColorOf(el);
            var petal = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BossBloom (generated)", color = c };
            petal.EnableKeyword("_EMISSION");
            petal.SetColor("_EmissionColor", c * 2.4f);
            var stem = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BossBloomStem (generated)", color = new Color(0.25f, 0.5f, 0.22f) };
            Prim(s, PrimitiveType.Cylinder, new Vector3(0f, 1f, 0f), new Vector3(0.25f, 1f, 0.25f), stem);
            for (int i = 0; i < 6; i++)
            {
                float a = i * Mathf.PI / 3f;
                var p = Prim(s, PrimitiveType.Sphere, new Vector3(Mathf.Cos(a) * 0.9f, 2.2f, Mathf.Sin(a) * 0.9f), new Vector3(1.1f, 0.35f, 0.7f), petal);
                p.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 20f);
            }
            Prim(s, PrimitiveType.Sphere, new Vector3(0f, 2.3f, 0f), Vector3.one * 0.7f, petal);
            s.Flower.SetActive(false);
        }

        private GameObject Prim(Slot s, PrimitiveType t, Vector3 local, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(s.Flower.transform, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        private void BuildCards()
        {
            var canvas = EncounterUiKit.NewCanvas("BossBloomUI");
            canvas.sortingOrder = 6;
            BuildCard(canvas, _tower);
            BuildCard(canvas, _frost);
        }

        private void BuildCard(Canvas canvas, Slot s)
        {
            var mid = new Vector2(0.5f, 0.5f);
            s.Card = new GameObject(s.Frost ? "FrostBloomCard" : "BloomCard", typeof(RectTransform));
            s.Card.transform.SetParent(canvas.transform, false);
            var r = (RectTransform)s.Card.transform;
            r.anchorMin = r.anchorMax = r.pivot = mid;
            r.sizeDelta = new Vector2(660f, 300f);
            s.Card.AddComponent<Image>().color = new Color(0.05f, 0.03f, 0.06f, 0.92f);
            var title = EncounterUiKit.NewText(s.Card.transform, GoLocalization.T("boss.title", "보상 꽃"), mid, new Vector2(0f, 110f), new Vector2(620f, 40f), 26);
            title.fontStyle = FontStyles.Bold;
            title.rectTransform.pivot = mid;
            s.CardText = EncounterUiKit.NewText(s.Card.transform, "", mid, new Vector2(0f, 30f), new Vector2(620f, 110f), 18);
            s.CardText.rectTransform.pivot = mid;
            s.Claim = EncounterUiKit.NewButton(s.Card.transform, "", mid, new Vector2(-150f, -95f), new Vector2(280f, 64f), null);
            ((RectTransform)s.Claim.transform).pivot = mid;
            s.Claim.onClick.AddListener(() => { Claim(s.Frost, out _); });
            s.Keep = EncounterUiKit.NewButton(s.Card.transform, GoLocalization.T("boss.btn_keep", "둔다"), mid, new Vector2(150f, -95f), new Vector2(280f, 64f), null);
            ((RectTransform)s.Keep.transform).pivot = mid;
            var slot = s;
            s.Keep.onClick.AddListener(() => { slot.Dismissed = true; slot.Card.SetActive(false); });
            s.Card.SetActive(false);
        }

        /// <summary>받는다 — 원기 30. 받았으면 알림 글, 아니면 null 과 까닭.</summary>
        public string Claim(out string why) => Claim(false, out why);

        /// <summary>109-14-31 고원 곰왕 꽃을 받는다.</summary>
        public string ClaimFrost(out string why) => Claim(true, out why);

        private string Claim(bool frost, out string why)
        {
            why = null;
            if (!(frost ? FrostBossState.Bloom : GuardianState.Bloom)) { why = GoLocalization.T("boss.why.none", "꽃이 없다"); return null; }
            if (!DomainState.Spend(Cost)) { why = string.Format(GoLocalization.T("domain.why.resin", "원기가 모자라다({0}/{1})"), DomainState.Resin, Cost); Toast(why); return null; }
            int gold = frost ? FrostGoldNow : GoldNow;
            GoldState.Add(gold);
            string art = GoArtifacts.Label(ArtifactState.Get(ArtifactState.Add(ArtRarity)));
            string egg = EggState.Drop("bloom", (frost ? "frost" : "guard") + "|" + DomainState.Claims); // U-0046 신수 알
            if (egg.Length > 0) art += " · " + egg;
            if (frost) FrostBossState.MarkPaid(); else GuardianState.MarkPaid();
            string text = string.Format(frost
                ? GoLocalization.T("boss.claimed_frost", "보상 꽃 — 원기 {0} · 금 +{1} · {2} — 150초 뒤 만년설 바위곰왕이 다시 선다")
                : GoLocalization.T("boss.claimed", "보상 꽃 — 원기 {0} · 금 +{1} · {2} — 150초 뒤 망루 수호장이 다시 선다"), Cost, gold, art);
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
            if (_tower.Flower == null) return;
            // 다시 서기 — 꽃을 받고 150초가 지났는데 쓰러진(꺼진) 채면 세운다(고원 곰왕은 `FrostField.TickKing` 이)
            var g = FieldEnemy.GuardianInstance;
            if (GuardianState.Standing && g != null && (!g.gameObject.activeSelf || !g.Alive))
            {
                g.gameObject.SetActive(true);
                g.ReviveNow();
                Toast(GoLocalization.T("boss.back", "망루 수호장이 다시 섰다"));
            }
            Refresh(_tower);
            Refresh(_frost);
        }

        private void Refresh(Slot s)
        {
            bool bloom = s.Frost ? FrostBossState.Bloom : GuardianState.Bloom;
            s.Flower.SetActive(bloom);
            Vector3 spot = s.Frost ? FrostSpot : Spot;
            if (bloom) s.Flower.transform.position = spot;
            var fc = FieldCombat.Instance;
            bool near = false;
            if (bloom && fc != null)
            {
                Vector3 d = fc.transform.position - spot;
                d.y = 0f;
                near = d.magnitude <= ClaimR;
            }
            if (!near) s.Dismissed = false;
            s.Card.SetActive(near && !s.Dismissed);
            if (s.Card.activeSelf)
            {
                int have = DomainState.Resin;
                s.CardText.text = string.Format(s.Frost
                    ? GoLocalization.T("boss.card_frost", "쓰러진 만년설 바위곰왕 자리에 꽃이 피었다.\n★{0} 보패 1 · 금 {1}\n원기 {2}/{3} · 받으면 150초 뒤 곰왕이 다시 선다")
                    : GoLocalization.T("boss.card", "쓰러진 망루 수호장 자리에 꽃이 피었다.\n★{0} 보패 1 · 금 {1}\n원기 {2}/{3} · 받으면 150초 뒤 수호장이 다시 선다"),
                    ArtRarity, s.Frost ? FrostGoldNow : GoldNow, have, GoDomain.ResinMax);
                s.Claim.GetComponentInChildren<TextMeshProUGUI>().text = have >= Cost
                    ? string.Format(GoLocalization.T("boss.btn_claim", "원기 {0} 쓰고 받는다"), Cost)
                    : GoLocalization.T("boss.btn_short", "원기가 모자라다 — 꽃은 남는다");
                s.Claim.interactable = have >= Cost;
            }
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 3.5f);
        }
    }
}
