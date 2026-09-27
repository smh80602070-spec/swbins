using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 109-12-1 "떠돌이 방문객"(웹 사가의숲 §5.9 `js/visitor.js`, 2026-09-27 이식) — 날짜 해시로 하루 한 명이 광장에 들른다.
    /// 퓨전 방향대로 사람만 오지 않는다(과거·현대·미래·신화):
    ///
    ///   🦊 여우 화상 호연    오늘만 귀한 가구 하나를 1.5배 값에 판다(물러났다 다시 다가서면 산다)
    ///   🧭 난파 선원 풍랑    나침반 조각 다섯이 존 넷에 흩어졌다 → 다 찾아 주면 선장의 궤짝
    ///   👻 도깨비불 반디     제 몸 조각 다섯 → 도깨비 등롱
    ///   🎣 낚시 명인 청파    (물이 없는 숲이라) 미끼 삼을 버섯 셋 → 명인의 어탁
    ///   🦋 곤충 박사 나비    곤충 셋 → 나비 표본 액자
    ///   🤖 시간 여행자 K-7   화석 둘과 꽃 하나 → 시간의 탁상시계
    ///
    /// **이 트랙 다름**: 금이 없어 값·보상은 과일(웹 금 ÷ 100 — 가구 값과 같은 비). 가방이 없어 웹 "가방에서 가져간다"는
    /// **손님을 만난 뒤 그날 그 갈래를 채집한 수**로 센다(채집 = 도감 기록이라 들고 다닐 수 없다). 물고기·광석 갈래가 없어
    /// 낚시 명인은 버섯, 시간 여행자는 화석·꽃을 청한다(대사도 그렇게). 웹 "바깥 숲 고리 다섯 자리"는 이 판 지도에
    /// 바깥 고리가 없어 **존 넷 안**(존마다 적어도 하나, 서로 8m 넘게, 물건·소품에서 2.5m 밖). 날짜는 실제 날짜.
    /// 웹 "두 번 말 걸면"은 이 판에 말 걸기 단추가 없어(가까이 가면 말한다) **물러났다 다시 다가서면**.
    /// 보상 가구 다섯은 가구전에서 안 판다(`FurnitureItem.VisitorGifts`). 세이브 v8 `visit*`.
    ///
    /// **109-12-2 새 손님 둘·단골·몸짓(웹 §5.10) + 이웃(§5.11)** — 👺 도깨비 대장 두두(존 넷 "흔들리는 덤불" 셋에 숨은 꼬마 —
    /// 찾으면 광장 대장 곁으로 뛰어와 춤춘다) · 👽 불시착 탐사원 루미(탐사선 부품 넷). 루미는 이 트랙에 이미 마을 사람(109-4
    /// surveyor)이라 손님 날엔 **그 사람이 광장에 나와** 부탁한다(평소 자리에선 숨음, `FolkId`). 웹 §5.13 현대 손님 둘
    /// (택배 기사 달음·사진작가 찰나)도 이 트랙엔 마을 사람으로 이미 있어 손님 표엔 안 넣었다.
    /// **단골**: 부탁을 마칠 때마다(여우는 사기) 정 +1, 셋 이상이면 마친 날 다시 다가서면 "눌러앉아도 되겠소?", 한 번 더
    /// 다가서면 눌러앉는다(여덟 자리까지). 눌러앉은 손님은 날마다 광장 둘레 제자리(`SettleSpots`)에 서서 하루 한 번 선물(과일
    /// 2~3, 웹 금 200~300 ÷ 100), 제 손님 날엔 광장 한가운데. **이웃**: 하나에 마을 평가 +6, 광장에 손님이 둘 이상이면 날짜
    /// 해시로 한 쌍이 마주 보고 수다(선물 뒤 다가서면 들린다). 세이브 v9.
    /// </summary>
    public static class ForestVisitors
    {
        public enum Kind { Shop, Collect, Bring }

        public struct Visitor
        {
            public string Key;
            public string NameKo;
            public string Emoji;
            public Kind Type;
            /// <summary>past·modern·future·myth — 표시·진단용(웹 era 그대로).</summary>
            public string Era;
            /// <summary>빌린 몸 이름(`ForestBootstrap.visitorBodyNames` 에서 찾는다). 빈 값이면 코드 그림(도깨비불 = 빛 구슬).</summary>
            public string Body;
            public string LineKo;
            public string PieceKo;
            public int N;
            public ForestMuseumState.Category Cat;
            public int N2;
            public ForestMuseumState.Category Cat2;
            /// <summary>보상 과일(웹 금 ÷ 100).</summary>
            public int Fruit;
            public string Furniture;
            /// <summary>109-12-2 — 찾은 조각(도깨비 꼬마)이 광장 대장 곁으로 돌아온다.</summary>
            public bool Back;
            /// <summary>109-12-2 — 이 손님이 곧 이 트랙 마을 사람(`ForestEras.FolkList` Id)이면 손님으로 나온 동안 그 사람은 숨는다.</summary>
            public string FolkId;
            public string NameKey => "visitor." + Key + ".name";
            public string LineKey => "visitor." + Key + ".line";
        }

        public static readonly Visitor[] List =
        {
            new Visitor { Key = "fox", NameKo = "여우 화상 호연", Emoji = "🦊", Type = Kind.Shop, Era = "myth", Body = "Arissa",
                LineKo = "눈이 밝은 손님만 알아보는 물건이 있지요 — 오늘 하루뿐이랍니다" },
            new Visitor { Key = "sailor", NameKo = "난파 선원 풍랑", Emoji = "🧭", Type = Kind.Collect, Era = "past", Body = "Heraklios",
                LineKo = "배가 뒤집혀 나침반이 산산이… 숲 어디에 조각이 떨어졌을 텐데", PieceKo = "🧭 나침반 조각", N = 5, Fruit = 8, Furniture = "visit_sailor" },
            new Visitor { Key = "wisp", NameKo = "도깨비불 반디", Emoji = "👻", Type = Kind.Collect, Era = "myth", Body = "",
                LineKo = "히잉… 놀라서 몸이 다섯 조각으로 흩어졌어. 숲에서 좀 찾아 줘", PieceKo = "👻 도깨비불 조각", N = 5, Fruit = 10, Furniture = "visit_wisp" },
            new Visitor { Key = "angler", NameKo = "낚시 명인 청파", Emoji = "🎣", Type = Kind.Bring, Era = "past", Body = "Brady",
                LineKo = "물 없는 숲이라 낚싯대가 심심하구먼 — 미끼 궁리나 하게 버섯 셋만 보여 주게", N = 3, Cat = ForestMuseumState.Category.Mushroom,
                Fruit = 7, Furniture = "visit_angler" },
            new Visitor { Key = "bugdoc", NameKo = "곤충 박사 나비", Emoji = "🦋", Type = Kind.Bring, Era = "modern", Body = "Leonard",
                LineKo = "표본이 모자라요! 곤충 세 마리만 보여 주실래요?", N = 3, Cat = ForestMuseumState.Category.Insect,
                Fruit = 7, Furniture = "visit_bug" },
            new Visitor { Key = "traveler", NameKo = "시간 여행자 K-7", Emoji = "🤖", Type = Kind.Bring, Era = "future", Body = "XBot",
                LineKo = "삐빗. 2387년에서 왔습니다. 화석 둘과 꽃 하나가 있으면 귀환 부품을 만들 수 있습니다", N = 2, Cat = ForestMuseumState.Category.Fossil,
                N2 = 1, Cat2 = ForestMuseumState.Category.Flower, Fruit = 9, Furniture = "visit_future" },
            // 109-12-2(웹 §5.10)
            new Visitor { Key = "dokkaebi", NameKo = "도깨비 대장 두두", Emoji = "👺", Type = Kind.Collect, Era = "myth", Body = "Demon",
                LineKo = "우리 꼬마 셋이 숨바꼭질하다 안 돌아와 — 숲 흔들리는 덤불 속 어딘가야", PieceKo = "🧒 도깨비 꼬마", N = 3, Fruit = 9,
                Furniture = "visit_dokkaebi", Back = true },
            new Visitor { Key = "alien", NameKo = "불시착 탐사원 루미", Emoji = "👽", Type = Kind.Collect, Era = "future", Body = "Jennifer",
                LineKo = "삐— 탐사선 부품 넷이 숲에 흩어졌어요. 찾아 주면 별 지도를 드릴게요", PieceKo = "🔩 탐사선 부품", N = 4, Fruit = 11,
                Furniture = "visit_alien", FolkId = "surveyor" },
        };

        // ── 109-12-2 단골·눌러앉기·이웃(웹 §5.10·5.11) ──────────────
        public const int SettleN = 3;
        public const int GuestBeauty = 6;
        public const float KidHeight = 0.95f;
        /// <summary>눌러앉은 손님 i 번째 자리(world XZ) — 광장 둘레, 물건 3m·사람 길 2.5m 밖(진단).</summary>
        public static readonly Vector2[] SettleSpots =
        {
            new Vector2(8f, -1.5f), new Vector2(-3f, 4.5f), new Vector2(7f, 7f), new Vector2(-3f, -0.5f),
            new Vector2(3f, 8.5f), new Vector2(8.5f, -4.5f), new Vector2(-0.5f, 8.5f), new Vector2(9.5f, 2f),
        };
        /// <summary>하루 선물(과일) — 웹 금 ÷ 100 을 웹 반올림으로.</summary>
        private static readonly Dictionary<string, int> Gift = new Dictionary<string, int>
        {
            ["fox"] = 3, ["sailor"] = 3, ["wisp"] = 2, ["angler"] = 2, ["bugdoc"] = 2, ["traveler"] = 3, ["dokkaebi"] = 2, ["alien"] = 3,
        };
        private static readonly Dictionary<string, string> SettleLineKo = new Dictionary<string, string>
        {
            ["fox"] = "이 마을 손님들 눈이 밝아 장사할 맛이 나오", ["sailor"] = "바다는 멀어도 여기 바람이 좋구려",
            ["wisp"] = "히히, 밤마다 마을 등불 옆에서 놀아", ["angler"] = "물은 없어도 기다리는 맛은 여기도 있네",
            ["bugdoc"] = "이 숲의 곤충 도감을 새로 쓰는 중이에요", ["traveler"] = "삐빗. 귀환 일정을 무기한 미뤘습니다",
            ["dokkaebi"] = "꼬마들이 마을 아이들이랑 잘 논다", ["alien"] = "이 별, 정착지로 등록했어요",
        };
        private static readonly Dictionary<string, string> ChatOpenKo = new Dictionary<string, string>
        {
            ["fox"] = "요즘 바다 건너 물건값이 부쩍 올랐다오", ["sailor"] = "어젯밤 바람 냄새가 폭풍 전날 같았소",
            ["wisp"] = "히히, 어제 등불 셋을 몰래 껐다 켰어", ["angler"] = "버섯 미끼로 못 낚을 고기는 없다네",
            ["bugdoc"] = "이 숲 나비 날개 무늬가 도감이랑 달라요", ["traveler"] = "삐빗. 이 시대 달력은 계산이 어렵습니다",
            ["dokkaebi"] = "우리 꼬마들이 마을 아이들 신발을 숨겼대", ["alien"] = "이 별 사람들은 밥을 하루 세 번이나 먹어요",
        };
        private static readonly Dictionary<string, string> ChatReplyKo = new Dictionary<string, string>
        {
            ["fox"] = "그런 건 내가 싸게 구해 주리다, 수수료만 조금", ["sailor"] = "허허, 뱃사람 앞에서 그런 얘기를",
            ["wisp"] = "헤에, 그럼 오늘 밤에 같이 보러 가자", ["angler"] = "기다리는 게 반이지, 서두르지 말게",
            ["bugdoc"] = "어머, 그거 새 종일지도 몰라요!", ["traveler"] = "삐빗. 기록해 두겠습니다",
            ["dokkaebi"] = "크하하, 그 정도는 장난도 아니지", ["alien"] = "제 별에선 그걸 \"우정\" 이라고 불러요",
        };

        public static string SettleLine(string key) => SettleLineKo.TryGetValue(key, out var t) ? ForestLocalization.T("visitor." + key + ".settled", t) : "";
        public static string ChatOpen(string key) => ChatOpenKo.TryGetValue(key, out var t) ? ForestLocalization.T("visitor." + key + ".chat_open", t) : "…";
        public static string ChatReply(string key) => ChatReplyKo.TryGetValue(key, out var t) ? ForestLocalization.T("visitor." + key + ".chat_reply", t) : "…";
        public static int GiftOf(string key) => Gift.TryGetValue(key, out var g) ? g : 2;

        private static readonly Dictionary<string, int> Bonds = new Dictionary<string, int>();
        private static readonly List<string> Settled = new List<string>();
        private static int _giftDay = int.MinValue;
        private static readonly HashSet<string> GiftGot = new HashSet<string>();

        public static int BondOf(string key) => Bonds.TryGetValue(key, out var n) ? n : 0;
        public static IReadOnlyList<string> SettledList => Settled;
        public static bool IsSettled(string key) => Settled.Contains(key);
        /// <summary>마을 평가 "이웃 손님" 몫(§5.11).</summary>
        public static int GuestPoints() => Settled.Count * GuestBeauty;

        private static void BondUp(string key) => Bonds[key] = BondOf(key) + 1;

        /// <summary>오늘 수다 한 쌍 — 광장에 선 손님(키 목록, 오늘 손님 먼저) 둘 이상일 때 날짜 해시로. 없으면 (-1,-1).</summary>
        public static (int A, int B) ChatPair(IList<string> people, int day)
        {
            int n = people.Count;
            if (n < 2) return (-1, -1);
            int i = (int)(Hash01(day * 23 + 5, 331) * n) % n;
            int j = (i + 1 + (int)(Hash01(day * 29 + 9, 557) * (n - 1)) % (n - 1)) % n;
            return (i, j);
        }

        public static string ChatText(string a, string b)
        {
            var va = List[IndexOf(a)];
            var vb = List[IndexOf(b)];
            return $"{va.Emoji} \"{ChatOpen(a)}\" — {vb.Emoji} \"{ChatReply(b)}\"";
        }

        /// <summary>눌러앉은 손님에게 다가섰다 — 하루 한 번 선물, 그 뒤엔 한마디(수다 중이면 그 대화).</summary>
        public static string TalkSettled(string key, string chat = null)
        {
            int i = IndexOf(key);
            if (i < 0) return null;
            var v = List[i];
            string who = $"{v.Emoji} {Name(v)}";
            if (_giftDay != Today) { _giftDay = Today; GiftGot.Clear(); }
            if (GiftGot.Contains(key))
                return chat != null ? $"{who} — " + string.Format(ForestLocalization.T("visitor.chatting", "(수다 중) {0}"), chat) : $"{who} — {SettleLine(key)}";
            GiftGot.Add(key);
            int g = GiftOf(key);
            ForestState.AddFruit(g);
            Touch();
            return who + " — " + string.Format(ForestLocalization.T("visitor.gift", "이웃 좋다는 게 이런 거지 — 과일 {0}개 받아 두시오"), g);
        }

        public static bool GiftTakenToday(string key) => _giftDay == Today && GiftGot.Contains(key);

        public static string KidLine() => ForestLocalization.T("visitor.kid_line", "🧒 헤헤, 들켰다! 다음엔 더 꼭꼭 숨을 거야");
        public static string KidName() => ForestLocalization.T("visitor.kid_name", "도깨비 꼬마");

        /// <summary>부탁을 마친 날 단골이면 눌러앉기를 청한다(한 번 더 다가서면 허락). 아니면 null.</summary>
        private static string SettleAsk(Visitor v, Record r, string who)
        {
            if (IsSettled(v.Key) || BondOf(v.Key) < SettleN || Settled.Count >= SettleSpots.Length) return null;
            if (!r.AskSettle)
            {
                r.AskSettle = true;
                Touch();
                return who + " — " + string.Format(ForestLocalization.T("visitor.settle_ask",
                    "벌써 {0}번째로구려… 이 마을에 눌러앉아도 되겠소? (물러났다 다시 오면 허락)"), BondOf(v.Key));
            }
            Settled.Add(v.Key);
            Touch();
            return who + " — " + ForestLocalization.T("visitor.settled_now", "고맙소! 내일부터는 광장 곁에서 지내겠소 — 들르면 작은 선물을 드리리다");
        }

        public const float FoxMul = 1.5f;
        /// <summary>손님이 서는 광장 자리(world XZ) — 판·창구·나무·사람 길에서 3m 밖(`PlaytestForestVisitors`).</summary>
        public static readonly Vector2 Spot = new Vector2(3f, 2f);
        public const float TalkRadius = 2.5f;
        /// <summary>다시 말하려면 이만큼 물러났다 와야 한다(웹 "한 번 더 말 걸기").</summary>
        public const float LeaveRadius = 4f;
        public const float PickRadius = 1.6f;
        public const float PieceMinGap = 8f, PieceClear = 2.5f, PieceMinR = 4f, PieceMaxR = 10f;
        public const float Height = 1.75f;
        public const float LineSec = 4.5f;

        private static readonly string[] Dirs = { "동", "남동", "남", "남서", "서", "북서", "북", "북동" };
        private static readonly string[] DirKeys = { "e", "se", "s", "sw", "w", "nw", "n", "ne" };

        // ── 날짜 ────────────────────────────────────────────────
        private static int? _forcedDay;
        /// <summary>진단 — 날짜를 고정한다(null = 실제 날짜).</summary>
        public static void ForceDayForTest(int? day) => _forcedDay = day;
        public static int Today => _forcedDay ?? (int)(DateTime.Now.Date - new DateTime(2000, 1, 1)).TotalDays;

        /// <summary>FNV-1a 로 두 정수를 섞어 [0,1) — 같은 날이면 늘 같다.</summary>
        public static float Hash01(int a, int b)
        {
            unchecked
            {
                uint h = 2166136261u;
                foreach (int v in new[] { a, b })
                    for (int k = 0; k < 4; k++) { h ^= (uint)((v >> (8 * k)) & 0xff); h *= 16777619u; }
                return (h & 0xffffff) / (float)0x1000000;
            }
        }

        /// <summary>그날의 손님.</summary>
        public static Visitor WhoOn(int day) => List[(int)(Hash01(day * 13 + 7, 911) * List.Length) % List.Length];
        public static Visitor TodayVisitor => WhoOn(Today);
        public static int IndexOf(string key)
        {
            for (int i = 0; i < List.Length; i++) if (List[i].Key == key) return i;
            return -1;
        }

        public static string Name(Visitor v) => ForestLocalization.T(v.NameKey, v.NameKo);
        public static string Line(Visitor v) => ForestLocalization.T(v.LineKey, v.LineKo);
        public static string PieceName(Visitor v) => ForestLocalization.T("visitor." + v.Key + ".piece", v.PieceKo);

        /// <summary>여우 화상의 오늘 물건 — 가구전 물건 중 비싼 쪽(웹 값 1400 이상)에서 날짜 해시로.</summary>
        public static FurnitureItem FoxItem(int day)
        {
            var pool = new List<FurnitureItem>();
            foreach (var f in FurnitureItem.Catalog) if (f.Value >= 1400) pool.Add(f);
            return pool[(int)(Hash01(day * 7 + 3, 577) * pool.Count) % pool.Count];
        }

        public static int FoxPrice(FurnitureItem item) => Mathf.RoundToInt(item.FruitCost * FoxMul);

        /// <summary>광장 가운데(원점)에서 본 방위(웹 DIRS — 동부터 시계 방향, +z = 북).</summary>
        public static int DirIndex(Vector2 p)
        {
            float a = Mathf.Atan2(-p.y, p.x);
            return ((Mathf.RoundToInt(a / (Mathf.PI / 4f)) % 8) + 8) % 8;
        }

        public static string DirName(int i) => ForestLocalization.T("visitor.dir." + DirKeys[i], Dirs[i]);

        /// <summary>
        /// 조각 자리 — 존 넷 안(가운데서 4~10m), 조각 i 는 존 (해시 + i) % 4 라 존마다 적어도 하나,
        /// 서로 8m 넘게, avoid(물건·소품 자리)에서 2.5m 밖. 같은 날·같은 avoid 면 늘 같다.
        /// </summary>
        public static List<Vector2> PieceSpots(int day, int n, IList<Vector2> avoid)
        {
            var outList = new List<Vector2>();
            var zones = ForestBiomeData.Zones;
            int z0 = (int)(Hash01(day * 5 + 1, 71) * zones.Length) % zones.Length;
            for (int i = 0; i < n; i++)
            {
                var zc = zones[(z0 + i) % zones.Length].Center;
                Vector2 best = zc;
                bool found = false;
                for (int t = 0; t < 400 && !found; t++)
                {
                    float ang = Hash01(day * 31 + i * 7 + t * 13, 3 + t) * Mathf.PI * 2f;
                    float r = Mathf.Lerp(PieceMinR, PieceMaxR, Hash01(day * 17 + i * 11 + t * 5, 29 + t));
                    var p = zc + new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * r;
                    if (Mathf.Abs(p.x) > World.ForestGroundBuilder.VillageWidth * 0.5f - 3f || Mathf.Abs(p.y) > World.ForestGroundBuilder.VillageDepth * 0.5f - 3f) continue;
                    bool ok = true;
                    foreach (var q in outList) if (Vector2.Distance(p, q) <= PieceMinGap) { ok = false; break; }
                    if (ok && avoid != null) foreach (var q in avoid) if (Vector2.Distance(p, q) < PieceClear) { ok = false; break; }
                    if (ok) { best = p; found = true; }
                }
                outList.Add(best);
            }
            return outList;
        }

        // ── 오늘 기록(세이브) ────────────────────────────────────
        public class Record
        {
            public int Day = int.MinValue;
            public string Key = "";
            /// <summary>주운 조각 비트(조각 i = 1 &lt;&lt; i).</summary>
            public int GotMask;
            public bool Done, Offered, Met;
            /// <summary>109-12-2 — 눌러앉기를 물었다(다음 다가서면 허락).</summary>
            public bool AskSettle;
            /// <summary>만난 뒤 채집한 수(가져오기 손님 — 갈래 둘).</summary>
            public int Bring1, Bring2;
            public int GotCount
            {
                get { int c = 0; for (int m = GotMask; m != 0; m &= m - 1) c++; return c; }
            }
        }

        private static Record _rec = new Record();

        /// <summary>오늘 기록 — 날이나 손님이 바뀌었으면 새로.</summary>
        public static Record Rec
        {
            get
            {
                var v = TodayVisitor;
                if (_rec.Day != Today || _rec.Key != v.Key) _rec = new Record { Day = Today, Key = v.Key };
                return _rec;
            }
        }

        public static event Action Changed;
        private static void Touch() => Changed?.Invoke();

        /// <summary>조각을 줍는다 — 결과 한 줄(이미 주웠거나 오늘 조각 손님이 아니면 null).</summary>
        public static string Pick(int index)
        {
            var v = TodayVisitor;
            var r = Rec;
            if (v.Type != Kind.Collect || r.Done || index < 0 || index >= v.N || (r.GotMask & (1 << index)) != 0) return null;
            r.GotMask |= 1 << index;
            int n = r.GotCount;
            Touch();
            return n >= v.N
                ? string.Format(ForestLocalization.T("visitor.piece_all", "{0} ({1}/{2}) — 다 모았다! 광장의 {3}에게 가져가자"), PieceName(v), n, v.N, Name(v))
                : string.Format(ForestLocalization.T("visitor.piece_some", "{0} ({1}/{2}) — 아직 {3}개 남았다"), PieceName(v), n, v.N, v.N - n);
        }

        /// <summary>채집 한 번(`ForestCollectSpot`) — 가져오기 손님을 만났고 아직이면 센다. 막 다 채웠으면 알림 한 줄.</summary>
        public static string OnGather(ForestMuseumState.Category cat)
        {
            var v = TodayVisitor;
            var r = Rec;
            if (v.Type != Kind.Bring || !r.Met || r.Done) return null;
            bool before = BringReady(v, r);
            if (cat == v.Cat && r.Bring1 < v.N) r.Bring1++;
            else if (v.N2 > 0 && cat == v.Cat2 && r.Bring2 < v.N2) r.Bring2++;
            else return null;
            Touch();
            return !before && BringReady(v, r)
                ? string.Format(ForestLocalization.T("visitor.bring_ready", "{0} {1}에게 보여 줄 것을 다 모았다 — 광장으로!"), v.Emoji, Name(v))
                : null;
        }

        public static bool BringReady(Visitor v, Record r) => r.Bring1 >= v.N && (v.N2 <= 0 || r.Bring2 >= v.N2);

        /// <summary>
        /// 말을 건다(다가설 때마다 한 번) — 대사 한 줄. pieceDirs 는 남은 조각 방위(조각 손님만, 호출부가 자리로 계산).
        /// </summary>
        public static string Talk(IList<int> pieceDirs = null)
        {
            var v = TodayVisitor;
            var r = Rec;
            string who = $"{v.Emoji} {Name(v)}";
            bool firstMeet = !r.Met;
            r.Met = true;
            if (r.Done)
            {
                string ask = SettleAsk(v, r, who);
                if (ask != null) return ask;
                Touch();
                return who + " — " + ForestLocalization.T("visitor.thanks", "오늘 고마웠소 — 또 들르리다");
            }
            if (v.Type == Kind.Shop)
            {
                var it = FoxItem(Today);
                int price = FoxPrice(it);
                if (!r.Offered)
                {
                    r.Offered = true;
                    Touch();
                    return who + " — " + string.Format(ForestLocalization.T("visitor.fox_offer",
                        "오늘의 물건은 「{0}」 — 과일 {1}개. 마음에 들면 물러났다 다시 오시오"), it.Name, price);
                }
                if (!ForestState.SpendFruit(price))
                {
                    Touch();
                    return who + " — " + string.Format(ForestLocalization.T("visitor.fox_short",
                        "과일 {0}개가 있어야 하오(지금 {1}개) — 오늘 해 지기 전에 다시 오시오"), price, ForestState.FruitCount);
                }
                ForestHomeState.AddStock(it.Id, 1);
                r.Done = true;
                BondUp(v.Key);
                Touch();
                return who + " — " + string.Format(ForestLocalization.T("visitor.fox_sold", "좋은 눈이시오 — 「{0}」은(는) 집 창고에 넣어 두었소"), it.Name);
            }
            if (v.Type == Kind.Collect)
            {
                int n = r.GotCount;
                if (n < v.N)
                {
                    Touch();
                    string dirs = "";
                    if (pieceDirs != null && pieceDirs.Count > 0)
                    {
                        var names = new List<string>();
                        foreach (int d in pieceDirs) names.Add(DirName(d));
                        dirs = " — " + string.Format(ForestLocalization.T("visitor.dirs", "마을 {0}쪽 숲 어딘가"), string.Join("·", names));
                    }
                    return $"{who} — {Line(v)} ({n}/{v.N}){dirs}";
                }
                return who + " — " + Reward(v, r);
            }
            // 가져오기 — 만난 뒤 그 갈래를 채집한 수.
            if (!BringReady(v, r))
            {
                Touch();
                string prog = $"{ForestMuseumState.CategoryName(v.Cat)} {Mathf.Min(r.Bring1, v.N)}/{v.N}";
                if (v.N2 > 0) prog += $" · {ForestMuseumState.CategoryName(v.Cat2)} {Mathf.Min(r.Bring2, v.N2)}/{v.N2}";
                string hint = firstMeet ? " " + ForestLocalization.T("visitor.bring_hint", "(지금부터 채집한 것만 보여 줄 수 있다)") : "";
                return $"{who} — {Line(v)} ({prog}){hint}";
            }
            return who + " — " + Reward(v, r);
        }

        private static string Reward(Visitor v, Record r)
        {
            r.Done = true;
            BondUp(v.Key);
            ForestState.AddFruit(v.Fruit);
            var f = FurnitureItem.Get(v.Furniture);
            if (f != null) ForestHomeState.AddStock(f.Id, 1);
            Touch();
            return string.Format(ForestLocalization.T("visitor.reward", "고맙소! 과일 {0}개 · 「{1}」(집 창고에)"), v.Fruit, f != null ? f.Name : "");
        }

        // ── 세이브(v8) ───────────────────────────────────────────
        public static (int Day, string Key, int Got, bool Done, bool Offered, bool Met, int B1, int B2) Snapshot()
        {
            var r = _rec;
            return (r.Day, r.Key, r.GotMask, r.Done, r.Offered, r.Met, r.Bring1, r.Bring2);
        }

        public static void Restore(int day, string key, int got, bool done, bool offered, bool met, int b1, int b2)
        {
            _rec = new Record { Day = day, Key = key ?? "", GotMask = got, Done = done, Offered = offered, Met = met, Bring1 = b1, Bring2 = b2 };
            Touch();
        }

        public static void ResetForTest() => _rec = new Record();

        /// <summary>v9 — 정·눌러앉은 손님·오늘 선물·눌러앉기 물음.</summary>
        public static (string[] BondKeys, int[] BondCounts, string[] Settled, int GiftDay, string[] GiftGot, bool AskSettle) SnapshotBonds()
        {
            var keys = new List<string>(Bonds.Keys);
            var counts = new List<int>();
            foreach (var k in keys) counts.Add(Bonds[k]);
            return (keys.ToArray(), counts.ToArray(), Settled.ToArray(), _giftDay, new List<string>(GiftGot).ToArray(), _rec.AskSettle);
        }

        public static void RestoreBonds(string[] bondKeys, int[] bondCounts, string[] settled, int giftDay, string[] giftGot, bool askSettle)
        {
            Bonds.Clear();
            if (bondKeys != null && bondCounts != null)
                for (int i = 0; i < bondKeys.Length && i < bondCounts.Length; i++) if (IndexOf(bondKeys[i]) >= 0) Bonds[bondKeys[i]] = bondCounts[i];
            Settled.Clear();
            if (settled != null) foreach (var k in settled) if (IndexOf(k) >= 0 && !Settled.Contains(k) && Settled.Count < SettleSpots.Length) Settled.Add(k);
            _giftDay = giftDay;
            GiftGot.Clear();
            if (giftGot != null) foreach (var k in giftGot) GiftGot.Add(k);
            _rec.AskSettle = askSettle;
            Touch();
        }
    }
}
