using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// REALM 다음 조각 — 외교(js/diplo.js) 중 이 슬라이스에 실제로 적용되는
    /// 절반만 옮겼다. diplo.js는 "우호·동맹·화친·조공"(다른 세력과의 관계)과
    /// "계략"(이간·유언비어·매수·화계, 적 성에 거는 것) 둘로 나뉘는데, 이
    /// 슬라이스엔 상대할 다른 세력이 적 성뿐이고(소패·정도, RealmEnemyCity.cs
    /// 참고) 어느 쪽도 태수·무장이 없다(RealmEnemyRecord 참고) — 그래서
    /// **동맹/화친/조공(다른 세력 필요)과 이간/매수(적 무장 필요)는 대상
    /// 자체가 없어 범위 밖**이고, 성 자체를 겨냥하는 유언비어·화계 둘만
    /// 뜻이 선다. 원작 효과(치안↓·군량 소각)는 그대로 두면 아무 효과가
    /// 없다 — RealmWar.Fight()가
    /// 실제로 쓰는 건 Wall/Troops/Train/Tech뿐이라(치안·군량은 이 슬라이스의
    /// 적 성엔 필드 자체가 없다) **유언비어→훈련도 하락·화계→병력 손실로
    /// 재해석**했다(둘 다 다음 전투에서 실제로 체감되도록, RealmWarState.cs
    /// 참고). 계략은 "성공률을 숨기지 않는다"는 diplo.js 취지 그대로 UI가
    /// 걸기 전에 % 를 보여준다(RealmCommandUi.cs).
    /// </summary>
    public class RealmPlotData
    {
        public readonly string Key;
        private readonly string _name;
        private readonly string _desc;
        public string Name => RealmLocalization.T("plot." + Key + "_name", _name);
        public string Desc => RealmLocalization.T("plot." + Key + "_desc", _desc);
        public readonly string Emoji;
        public readonly int Gold;

        private RealmPlotData(string key, string name, string emoji, int gold, string desc)
        {
            Key = key;
            _name = name;
            Emoji = emoji;
            Gold = gold;
            _desc = desc;
        }

        public static readonly Dictionary<string, RealmPlotData> Catalog = new Dictionary<string, RealmPlotData>
        {
            ["rumor"] = new RealmPlotData("rumor", "유언비어", "🗣️", 150, "적국에 뜬소문을 놓아 군율을 흐트러뜨린다(훈련도 하락)."),
            ["fire"] = new RealmPlotData("fire", "화계", "🔥", 300, "적국의 병참에 불을 놓는다(병력 손실)."),
            // tasks U-0134 — 웹 W-0278 ✂️ 보급 끊기(250금). 이 트랙엔 적 진이 없어 그 적 성의 보급을 2달 끊는다(달마다 병력 −5%, RealmCamp).
            ["cut"] = new RealmPlotData("cut", "보급 끊기", "✂️", 250, "적 성으로 드는 보급로를 2달 끊는다(달마다 병력 −5%)."),
        };

        public static readonly string[] AllKeys = { "rumor", "fire", "cut" };

        public static RealmPlotData Get(string key) => Catalog.TryGetValue(key, out var p) ? p : null;
    }
}
