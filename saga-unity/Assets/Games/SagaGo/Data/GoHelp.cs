using System.Collections.Generic;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0043 도움말 표(saga-godot `data/help.gd`) — 유니티 사가고의 **실제 키**만 갈래 셋(이동·싸움·화면)으로 적는다.
    /// 고돗 표를 베끼지 않는다: 알 I·마당 T·회차 N·사진 P·주간 Z 는 이 트랙에 없고 쉼터 마당은 J·사냥 기록은 K·탈것은 H.
    /// 줄 하나 = 현지화 키 하나(`help.&lt;갈래&gt;.&lt;번호&gt;`, 값은 "키 | 설명"). <see cref="Line.Code"/> 는 그 줄이 코드에서 읽는
    /// Input System 키 속성 이름(`jKey` 등) — 진단이 소스에서 정말 읽는지 확인한다(빈 배열 = 액션 맵·마우스라 코드 키 없음).
    /// 새 키가 생기면 여기도 한 줄 더한다.
    /// </summary>
    public static class GoHelp
    {
        public readonly struct Line
        {
            public readonly string Key, Fallback;
            public readonly string[] Code;
            public Line(string key, string fallback, params string[] code) { Key = key; Fallback = fallback; Code = code; }
        }

        public readonly struct Section
        {
            public readonly string NameKey, NameFallback;
            public readonly Line[] Lines;
            public Section(string nameKey, string nameFallback, params Line[] lines) { NameKey = nameKey; NameFallback = nameFallback; Lines = lines; }
        }

        public static readonly Section[] Sections =
        {
            new Section("help.move", "이동",
                new Line("help.move.1", "W A S D · 방향키 | 걷기"),
                new Line("help.move.2", "Shift | 달리기(스태미나가 닳는다) · 물속에선 빠른 헤엄"),
                new Line("help.move.3", "Space | 점프 · 공중에서 한 번 더 누르면 활공(발밑 4m 이상) · 등반 중엔 도약", "spaceKey"),
                new Line("help.move.4", "벽으로 계속 밀기 | 가파른 면에 붙어 오른다(스태미나) · 강에 들어가면 저절로 헤엄"),
                new Line("help.move.5", "H · Shift+H | 탈것 타기·내리기 · Shift 를 같이 누르면 탈것 고르기 · 나는 탈것은 Space 위·Z 아래", "hKey", "zKey"),
                new Line("help.move.6", "M | 지도 — 켜 둔 순간이동 지점을 눌러 이동", "mKey")),
            new Section("help.fight", "싸움",
                new Line("help.fight.1", "J | 기본 공격 3타 · 길게 누르면 강공격 · 활공 중이면 낙하 공격", "jKey"),
                new Line("help.fight.2", "E | 원소 스킬(인물마다 모양이 다르다) — 다른 원소를 이어 맞히면 반응", "eKey"),
                new Line("help.fight.3", "Q | 원소 해방(기력 100)", "qKey"),
                new Line("help.fight.4", "L · Ctrl | 회피 — 적 머리 위 \"!\" 가 뜰 때", "lKey", "leftCtrlKey"),
                new Line("help.fight.5", "1 ~ 4 | 인물 교체(주인공 + 등용한 동료) — 몸이 그 인물로 바뀐다", "digit1Key", "digit2Key", "digit3Key", "digit4Key"),
                new Line("help.fight.6", "R | 활 조준(활을 든 인물만)", "rKey"),
                new Line("help.fight.7", "V | 원소 시야 — 누르는 동안 보물 상자·적이 빛난다", "vKey")),
            new Section("help.screen", "화면",
                new Line("help.screen.1", "B | 도감 — 등용한 인물과 시대 탭", "bKey"),
                new Line("help.screen.2", "Y | 업적", "yKey"),
                new Line("help.screen.3", "G | 요리·음식 화면", "gKey"),
                new Line("help.screen.4", "K | 사냥 기록 — 적 종마다 쓰러뜨린 수와 단계 보상", "kKey"),
                new Line("help.screen.5", "J | 쉼터 마당 꾸미기(마당 둘레에서)", "jKey"),
                new Line("help.screen.6", "O | 이야기 임무 목록", "oKey"),
                new Line("help.screen.7", "F | 가까이 있는 것과 상호작용 — 대화·낚시·탐사 게시판·비경 입구", "fKey"),
                new Line("help.screen.8", "T | 낚시 중 미끼 바꾸기", "tKey"),
                new Line("help.screen.9", "F1 · Esc | 이 도움말 열기·닫기(열린 창은 Esc 로 닫는다)", "f1Key", "escapeKey")),
        };

        /// <summary>표의 줄 키 전부(진단용 — 중복·누락 검사).</summary>
        public static IEnumerable<string> AllKeys()
        {
            foreach (var s in Sections)
            {
                yield return s.NameKey;
                foreach (var l in s.Lines) yield return l.Key;
            }
        }

        /// <summary>줄을 (키 글, 설명) 둘로 가른다 — 번역된 값이 "키 | 설명" 이 아니면 통째로 설명에 둔다.</summary>
        public static (string keys, string text) Split(string line)
        {
            int i = line.IndexOf('|');
            return i < 0 ? ("", line.Trim()) : (line.Substring(0, i).Trim(), line.Substring(i + 1).Trim());
        }

        public static string SectionName(Section s) => GoLocalization.T(s.NameKey, s.NameFallback);
        public static (string keys, string text) Read(Line l) => Split(GoLocalization.T(l.Key, l.Fallback));
    }
}
