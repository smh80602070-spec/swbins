using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 107-4 "보물 상자" — 다가가면(4m) 저절로 열리는 상자. 등급마다 쇠·구리·은청·금 띠와 은은한 빛,
    /// 잠긴 상자는 뚜껑에 검은 사슬이 X 로 걸려 있고 다가가면 푸는 법을 알려 준다.
    /// 잠금: 무리(`FieldEnemy.GroupId` 적이 한꺼번에 모두 쓰러짐) · 석등(둘레 석등을 제 원소 스킬·폭발로
    /// 20초 안에 전부 밝힘). 풀린 잠금은 판 안에서만 기억하고(세이브 안 함), 연 상자만 `chest_<id>` 로 남는다.
    /// </summary>
    public class TreasureChest : MonoBehaviour
    {
        private static readonly Color WoodColor = new Color(0.42f, 0.27f, 0.14f);
        private const float LidOpenDeg = -105f;
        private const float LidOpenSec = 0.6f;

        public GoTreasure.Chest Data { get; private set; }
        public bool Opened { get; private set; }
        public bool Unlocked { get; private set; }
        public readonly List<ElementTorch> Torches = new List<ElementTorch>();
        /// <summary>석등 창이 열려 있으면 남은 초(0 = 안 열림).</summary>
        public float TorchTimeLeft { get; private set; }
        public float LidAngle => _lidPivot != null ? _lidAngle : 0f;

        private Transform _lidPivot;
        private float _lidAngle;
        private GameObject _chains;
        private Light _glow;
        private bool _hinted;
        private float _check;

        public static TreasureChest Spawn(GoTreasure.Chest c, Transform parent, Material stone)
        {
            var go = new GameObject($"Chest_{c.Id}");
            go.transform.SetParent(parent, false);
            go.transform.position = GoTreasure.Position(c);
            var t = go.AddComponent<TreasureChest>();
            t.Data = c;
            t.Build(stone);
            return t;
        }

        private void Build(Material stone)
        {
            var wood = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ChestWood (generated)" };
            wood.color = WoodColor;
            wood.SetFloat("_Smoothness", 0.25f);
            Color gc = GoTreasure.GradeColor(Data.Grade);
            var metal = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ChestMetal (generated)" };
            metal.color = gc;
            metal.SetFloat("_Metallic", 0.85f);
            metal.SetFloat("_Smoothness", 0.6f);
            if (Data.Grade >= GoTreasure.Grade.Precious)
            {
                metal.EnableKeyword("_EMISSION");
                metal.SetColor("_EmissionColor", gc * 0.35f);
            }

            // 몸통(충돌체 유지 — 밟고 서거나 부딪힌다) + 띠 셋 + 자물쇠 판
            Part(transform, PrimitiveType.Cube, "Body", new Vector3(0f, 0.6f, 0f), new Vector3(2.2f, 1.2f, 1.4f), wood, true);
            for (int i = -1; i <= 1; i++)
                Part(transform, PrimitiveType.Cube, "Band", new Vector3(i * 0.85f, 0.6f, 0f), new Vector3(0.14f, 1.24f, 1.44f), metal, false);
            Part(transform, PrimitiveType.Cube, "LockPlate", new Vector3(0f, 1.0f, 0.73f), new Vector3(0.4f, 0.5f, 0.08f), metal, false);

            // 뚜껑 — 뒤쪽 윗모서리를 축으로 젖혀진다
            var pivot = new GameObject("LidPivot").transform;
            pivot.SetParent(transform, false);
            pivot.localPosition = new Vector3(0f, 1.2f, -0.7f);
            _lidPivot = pivot;
            Part(pivot, PrimitiveType.Cube, "Lid", new Vector3(0f, 0.25f, 0.7f), new Vector3(2.2f, 0.5f, 1.4f), wood, false);
            for (int i = -1; i <= 1; i++)
                Part(pivot, PrimitiveType.Cube, "LidBand", new Vector3(i * 0.85f, 0.25f, 0.7f), new Vector3(0.14f, 0.54f, 1.44f), metal, false);

            // 잠금 사슬(X) — 잠금 있는 상자만
            if (Data.Lock != GoTreasure.Lock.None)
            {
                var chainMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ChestChain (generated)" };
                chainMat.color = new Color(0.12f, 0.12f, 0.13f);
                chainMat.SetFloat("_Metallic", 0.7f);
                _chains = new GameObject("Chains");
                _chains.transform.SetParent(transform, false);
                for (int s = -1; s <= 1; s += 2)
                {
                    var bar = Part(_chains.transform, PrimitiveType.Cube, "Chain", new Vector3(0f, 0.9f, 0.76f), new Vector3(2.5f, 0.12f, 0.1f), chainMat, false);
                    bar.transform.localRotation = Quaternion.Euler(0f, 0f, s * 24f);
                }
            }

            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = new Vector3(0f, 2f, 0f);
            _glow = lightGo.AddComponent<Light>();
            _glow.type = LightType.Point;
            _glow.color = Color.Lerp(gc, new Color(1f, 0.85f, 0.45f), 0.5f);
            _glow.range = 7f + (int)Data.Grade * 2f;
            _glow.intensity = 1.2f + (int)Data.Grade * 0.4f;

            if (Data.Lock == GoTreasure.Lock.Torches && Data.Torches != null)
            {
                for (int i = 0; i < Data.Torches.Length; i++)
                    Torches.Add(ElementTorch.Spawn(GoTreasure.TorchPosition(Data, i), Data.Torches[i], transform, stone, $"Torch_{i}"));
            }
            SyncOpened(true);
        }

        private GameObject Part(Transform parent, PrimitiveType type, string name, Vector3 local, Vector3 scale, Material mat, bool keepCollider)
        {
            var p = GameObject.CreatePrimitive(type);
            p.name = name;
            if (!keepCollider) Destroy(p.GetComponent<Collider>());
            p.transform.SetParent(parent, false);
            p.transform.localPosition = local;
            p.transform.localScale = scale;
            if (mat != null) p.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return p;
        }

        private void OnEnable()
        {
            FieldEnemy.Killed += OnEnemyKilled;
            FieldCombat.ElementPulse += OnElementPulse;
        }

        private void OnDisable()
        {
            FieldEnemy.Killed -= OnEnemyKilled;
            FieldCombat.ElementPulse -= OnElementPulse;
        }

        private void Update()
        {
            var fc = FieldCombat.Instance;
            Tick(Time.deltaTime, fc != null ? fc.transform.position : new Vector3(0f, -9999f, 0f));
        }

        /// <summary>한 틱 — 석등 창·뚜껑 애니메이션·다가감 판정. 진단이 직접 부른다.</summary>
        public void Tick(float dt, Vector3 playerPos)
        {
            if (Opened && _lidAngle > LidOpenDeg)
            {
                _lidAngle = Mathf.Max(LidOpenDeg, _lidAngle + LidOpenDeg / LidOpenSec * dt);
                _lidPivot.localRotation = Quaternion.Euler(_lidAngle, 0f, 0f);
            }
            if (TorchTimeLeft > 0f && !Unlocked)
            {
                TorchTimeLeft -= dt;
                if (TorchTimeLeft <= 0f) ExtinguishAll(true);
            }
            _check -= dt;
            if (_check > 0f) return;
            _check = 0.2f;
            SyncOpened(false);
            if (Opened) return;
            if (!Unlocked && Data.Lock == GoTreasure.Lock.Group && GroupCleared()) Unlock(true);
            TryApproach(playerPos);
        }

        /// <summary>세이브를 불러와 `chest_<id>` 가 바뀌었으면 겉모습을 맞춘다(불러오기는 이벤트를 안 쏜다).</summary>
        private void SyncOpened(bool force)
        {
            bool open = GoTreasure.IsOpened(Data);
            if (!force && open == Opened) return;
            Opened = open;
            _lidAngle = open ? LidOpenDeg : 0f;
            if (_lidPivot != null) _lidPivot.localRotation = Quaternion.Euler(_lidAngle, 0f, 0f);
            if (!open)
            {
                Unlocked = Data.Lock == GoTreasure.Lock.None;
                ExtinguishAll(false);
            }
            RefreshLook();
        }

        private void RefreshLook()
        {
            if (_chains != null) _chains.SetActive(!Opened && !Unlocked);
            if (_glow != null) _glow.enabled = !Opened;
            if (Opened || Unlocked)
                foreach (var t in Torches) t.SetLit(true);
        }

        /// <summary>다가갔으면 연다(열리면 true). 잠겼으면 한 번 푸는 법을 알려 준다. 진단도 부른다.</summary>
        public bool TryApproach(Vector3 playerPos)
        {
            if (Opened) return false;
            Vector3 d = playerPos - transform.position;
            float dy = Mathf.Abs(d.y);
            d.y = 0f;
            float dist = d.magnitude;
            if (dist > GoTreasure.HintRadius + 6f) _hinted = false;
            if (!Unlocked)
            {
                if (!_hinted && dist <= GoTreasure.HintRadius && dy <= GoTreasure.HintRadius)
                {
                    _hinted = true;
                    Toast(HintText(), 4f);
                }
                return false;
            }
            if (dist > GoTreasure.OpenRadius || dy > GoTreasure.OpenHeight) return false;
            return Open();
        }

        public string HintText()
        {
            string grade = GoTreasure.GradeName(Data.Grade);
            if (Data.Lock == GoTreasure.Lock.Group)
                return string.Format(GoLocalization.T("chest.hint_group", "{0} — 둘레 무리를 모두 쓰러뜨리면 열린다 (남은 적 {1})"), grade, AliveInGroup());
            if (Data.Lock == GoTreasure.Lock.Torches)
            {
                var sb = new System.Text.StringBuilder();
                foreach (var el in Data.Torches) { if (sb.Length > 0) sb.Append('·'); sb.Append(GoElements.NameOf(el)); }
                return string.Format(GoLocalization.T("chest.hint_torch", "{0} — 석등 {1}개({2})를 제 원소 스킬(E)·폭발(Q)로 {3}초 안에 모두 밝혀라"),
                    grade, Data.Torches.Length, sb, Mathf.RoundToInt(GoTreasure.TorchWindowSec));
            }
            return grade;
        }

        private bool Open()
        {
            if (!WorldEventState.TryTrigger(GoTreasure.EventKey(Data))) { SyncOpened(true); return false; }
            Opened = true;
            int g = (int)Data.Grade;
            int exp = GoTreasure.ExpByGrade[g], gold = GoTreasure.GoldByGrade[g];
            PlayerStats.AddExp(exp);
            GoldState.Add(gold);
            string mats = TalentState.Add(GoTalent.ChestMats[g]); // 109-14-4 무예 재료
            string gear = WeaponState.OnChest(Data.Id, Data.Grade); // 109-14-5a 강화석·무기
            if (gear.Length > 0) mats += (mats.Length > 0 ? " · " : "") + gear;
            string arts = ArtifactState.OnChest(Data.Grade); // 109-14-5b 보패(무늬 ★4 · 옻칠 ★5 · 금박 ★5 둘)
            if (arts.Length > 0) mats += (mats.Length > 0 ? " · " : "") + arts;
            string itemPart = "";
            if (!string.IsNullOrEmpty(Data.ItemId))
            {
                Inventory.AddItem(Data.ItemId);
                var item = ItemData.Get(Data.ItemId);
                if (item != null) itemPart = string.Format(GoLocalization.T("chest.item", " · {0}"), item.Name);
            }
            FieldRingFx.Spawn(transform.position, 5f + g * 1.5f, GoTreasure.GradeColor(Data.Grade), 0.8f);
            Toast(string.Format(GoLocalization.T("chest.opened", "{0}를 열었다 — 경험치 +{1} · 돈 +{2}냥{3}  (보물 상자 {4}/{5})"),
                GoTreasure.GradeName(Data.Grade), exp, gold, itemPart, GoTreasure.OpenedCount, GoTreasure.Chests.Length) + (mats.Length > 0 ? "\n" + mats : ""), 4f);
            RefreshLook();
            return true;
        }

        private void Unlock(bool announce)
        {
            if (Unlocked) return;
            Unlocked = true;
            TorchTimeLeft = 0f;
            RefreshLook();
            if (!announce) return;
            FieldRingFx.Spawn(transform.position, 6f, GoTreasure.GradeColor(Data.Grade), 0.8f);
            string key = Data.Lock == GoTreasure.Lock.Group ? "chest.unlock_group" : "chest.unlock_torch";
            string ko = Data.Lock == GoTreasure.Lock.Group ? "무리를 물리쳤다 — {0}의 사슬이 풀렸다" : "석등이 모두 밝혀졌다 — {0}의 사슬이 풀렸다";
            Toast(string.Format(GoLocalization.T(key, ko), GoTreasure.GradeName(Data.Grade)), 3.5f);
        }

        // ---- 무리 잠금 ---------------------------------------------------------------------

        private void OnEnemyKilled(FieldEnemy e)
        {
            if (Opened || Unlocked || Data.Lock != GoTreasure.Lock.Group || e.GroupId != Data.GroupId) return;
            if (GroupCleared()) Unlock(true);
        }

        public int AliveInGroup()
        {
            int n = 0;
            foreach (var e in FieldEnemy.All) if (e.GroupId == Data.GroupId && e.Alive) n++;
            return n;
        }

        /// <summary>무리가 한꺼번에 모두 쓰러져 있나. 그 무리가 아예 없으면(적 없는 씬) 막히지 않게 풀린 걸로 본다.</summary>
        private bool GroupCleared()
        {
            foreach (var e in FieldEnemy.All) if (e.GroupId == Data.GroupId && e.Alive) return false;
            return true;
        }

        // ---- 석등 잠금 ---------------------------------------------------------------------

        private void OnElementPulse(Vector3 center, float radius, GoElement el) => Pulse(center, radius, el);

        /// <summary>원소 원 하나 — 새로 밝힌 석등 수. 진단이 직접 부른다.</summary>
        public int Pulse(Vector3 center, float radius, GoElement el)
        {
            if (Opened || Unlocked || Torches.Count == 0) return 0;
            int lit = 0;
            bool wrong = false;
            foreach (var t in Torches)
            {
                if (t.Lit || !t.InPulse(center, radius)) continue;
                if (t.Element != el) { wrong = true; continue; }
                t.SetLit(true);
                lit++;
            }
            if (lit == 0)
            {
                if (wrong)
                    Toast(string.Format(GoLocalization.T("chest.torch_wrong", "이 석등은 {0} 원소로만 밝혀진다"), GoElements.NameOf(FirstUnlitElementNear(center, radius))), 2f);
                return 0;
            }
            if (TorchTimeLeft <= 0f) TorchTimeLeft = GoTreasure.TorchWindowSec;
            int on = LitCount;
            if (on >= Torches.Count) { Unlock(true); return lit; }
            Toast(string.Format(GoLocalization.T("chest.torch_progress", "석등 {0}/{1} — {2}초 안에 나머지를"), on, Torches.Count, Mathf.CeilToInt(TorchTimeLeft)), 2f);
            return lit;
        }

        public int LitCount
        {
            get
            {
                int n = 0;
                foreach (var t in Torches) if (t.Lit) n++;
                return n;
            }
        }

        private GoElement FirstUnlitElementNear(Vector3 center, float radius)
        {
            foreach (var t in Torches) if (!t.Lit && t.InPulse(center, radius)) return t.Element;
            return GoElement.Physical;
        }

        private void ExtinguishAll(bool announce)
        {
            bool any = TorchTimeLeft > 0f || LitCount > 0;
            TorchTimeLeft = 0f;
            foreach (var t in Torches) t.SetLit(false);
            if (announce && any) Toast(GoLocalization.T("chest.torch_out", "석등이 꺼졌다 — 다시 처음부터 밝혀라"), 2.5f);
        }

        private static void Toast(string text, float sec)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(text, sec);
        }
    }
}
