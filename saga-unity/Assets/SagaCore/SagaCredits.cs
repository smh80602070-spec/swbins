using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 110 ⑥ 크레딧 — 빌드에 들어가는 남의 것(에셋·글꼴·셰이더·엔진 패키지)의 출처 표 한 곳.
    /// 폴더 접두어(<see cref="Entry.Paths"/>)로 에셋을 출처에 잇는다. 에디터 점검 `SagaCreditsCheck` 가 빌드 씬·Resources 의
    /// 의존 에셋을 이 표에 맞춰 보고, 표에 없는 에셋이 하나라도 있으면 빌드 문지기(`SagaAssetGate`)가 빌드를 막는다 —
    /// 새 에셋을 들이면 여기에 한 줄 더하는 게 먼저다. 긴 줄이 이긴다(`Art/Props/PolyHaven/` 이 `Art/Props/` 보다 먼저).
    /// 점검이 만든 <see cref="LegalResource"/>(Resources)에 실제로 쓰인 출처 id 와 라이선스 전문(OFL·MIT·Apache·패키지 고지)이 들어 있어,
    /// 타이틀 크레딧 화면은 쓰인 출처만 보여 준다.
    /// </summary>
    public static class SagaCredits
    {
        public sealed class Entry
        {
            public string Id;
            public string[] Paths;
            public string TitleKo, TitleEn;
            public string BodyKo, BodyEn;
            /// <summary>빌드에 전문을 실어야 하는 라이선스 파일(OFL·MIT 등) — 점검이 법적 고지 파일에 붙인다.</summary>
            public string[] LicenseFiles;
            /// <summary>저작권 줄(라이선스 파일에 없을 때 — OFL 은 저작권 고지를 같이 실어야 한다). 글꼴은 name 표 0번에서 옮겼다.</summary>
            public string Copyright;
            /// <summary>우리가 만든 것(코드·씬·생성 에셋) — 화면에 안 적는다.</summary>
            public bool Own;
        }

        public const string LegalResource = "SagaLegal";
        public const string UsedPrefix = "USED:";

        public static readonly Entry[] Entries =
        {
            new Entry { Id = "own", Own = true, Paths = new[] {
                "Assets/Games/", "Assets/SagaCore/", "Assets/Scenes/", "Assets/Settings/", "Assets/Cinematics/", "Assets/Animators/",
                "Assets/InputSystem_Actions.inputactions", "Assets/Art/Icon/",
                "Assets/Art/Generated/", "Assets/Art/Props/Generated/", "Assets/Art/Shaders/", "Assets/Art/Rocks/Generated/" } },

            new Entry { Id = "mixamo", Paths = new[] { "Assets/Art/CharactersRealistic/" },
                TitleKo = "인물·동작", TitleEn = "Characters & animation",
                BodyKo = "Mixamo (Adobe) — Mixamo 이용 약관에 따라 이 게임 안에서만 씁니다.",
                BodyEn = "Mixamo (Adobe) — used within this game under the Mixamo terms." },

            new Entry { Id = "charforge", Paths = new[] { "Assets/Art/CharactersForge/" },
                TitleKo = "사람 몸·옷(공방)", TitleEn = "Bodies & clothing (workshop)",
                BodyKo = "MakeHuman 시스템 에셋 · Quaternius Universal Animation Library — CC0",
                BodyEn = "MakeHuman system assets · Quaternius Universal Animation Library — CC0" },

            new Entry { Id = "kenney", Paths = new[] {
                    "Assets/Art/Characters/", "Assets/Art/Buildings/", "Assets/Art/Dungeon/", "Assets/Art/Shrine/",
                    "Assets/Art/Props/", "Assets/Art/Rocks/", "Assets/Art/Audio/Kenney_InterfaceSounds/", "Assets/Art/Audio/Kenney_RPGSounds/" },
                TitleKo = "모델·효과음", TitleEn = "Models & sound effects",
                BodyKo = "Kenney (kenney.nl) — CC0", BodyEn = "Kenney (kenney.nl) — CC0" },

            new Entry { Id = "polyhaven", Paths = new[] { "Assets/Art/Environment/PBR/", "Assets/Art/Props/PolyHaven/" },
                TitleKo = "재질·스캔 소품", TitleEn = "Materials & scanned props",
                BodyKo = "Poly Haven (polyhaven.com) — CC0", BodyEn = "Poly Haven (polyhaven.com) — CC0" },

            new Entry { Id = "quaternius", Paths = new[] { "Assets/Art/Vegetation/QuaterniusNature/" },
                TitleKo = "숲 꾸밈", TitleEn = "Nature decorations",
                BodyKo = "Quaternius — Stylized Nature MegaKit — CC0", BodyEn = "Quaternius — Stylized Nature MegaKit — CC0" },

            new Entry { Id = "bgm", Paths = new[] { "Assets/Art/Audio/CC0_BGM/" },
                TitleKo = "배경음악", TitleEn = "Music",
                BodyKo = "\"Town Theme (RPG)\" cynicmusic · \"Dungeon Ambience\" yd · \"Peaceful Town\" aroachifoundonmypillow · \"It's time for a… Fight, run, breath deeply\" Komiku · \"War Theme\" spring-spring — OpenGameArt.org, CC0",
                BodyEn = "\"Town Theme (RPG)\" by cynicmusic · \"Dungeon Ambience\" by yd · \"Peaceful Town\" by aroachifoundonmypillow · \"It's time for a… Fight, run, breath deeply\" by Komiku · \"War Theme\" by spring-spring — OpenGameArt.org, CC0" },

            new Entry { Id = "noto", Paths = new[] { "Assets/Art/Fonts/NotoSansKR/", "Assets/Art/Fonts/NotoEmoji/" },
                TitleKo = "글꼴", TitleEn = "Fonts",
                BodyKo = "Noto Sans KR · Noto Emoji — SIL Open Font License 1.1 (전문은 아래)",
                BodyEn = "Noto Sans KR · Noto Emoji — SIL Open Font License 1.1 (full text below)",
                Copyright = "Noto Sans KR © 2014-2021 Adobe (http://www.adobe.com/). · Noto Emoji — Copyright 2013 Google LLC",
                LicenseFiles = new[] { "Assets/Art/Fonts/NotoSansKR/OFL.txt", "Assets/Art/Fonts/NotoEmoji/OFL.txt" } },

            new Entry { Id = "liberation", Paths = new[] { "Assets/TextMesh Pro/" },
                TitleKo = "기본 글꼴", TitleEn = "Fallback font",
                BodyKo = "Liberation Sans — SIL Open Font License 1.1 (전문은 아래)",
                BodyEn = "Liberation Sans — SIL Open Font License 1.1 (full text below)",
                Copyright = "Digitized data copyright (c) 2010 Google Corporation. Copyright (c) 2012 Red Hat, Inc.",
                LicenseFiles = new[] { "Assets/TextMesh Pro/Fonts/LiberationSans - OFL.txt" } },

            new Entry { Id = "sss", Paths = new[] { "Assets/Art/Shaders/Character/SSS_CiaranSimpson/" },
                TitleKo = "피부 셰이더", TitleEn = "Skin shader",
                BodyKo = "Subsurface Scattering for Unity URP — Ciaran Simpson, MIT (전문은 아래)",
                BodyEn = "Subsurface Scattering for Unity URP — Ciaran Simpson, MIT (full text below)",
                LicenseFiles = new[] { "Assets/Art/Shaders/Character/SSS_CiaranSimpson/LICENSE" } },

            new Entry { Id = "anisohair", Paths = new[] { "Assets/Art/Shaders/Character/AnisoHair_cathyhlshih/" },
                TitleKo = "머리칼 셰이더", TitleEn = "Hair shader",
                BodyKo = "Anisotropic hair — cathyhlshih, MIT (전문은 아래)",
                BodyEn = "Anisotropic hair — cathyhlshih, MIT (full text below)",
                LicenseFiles = new[] { "Assets/Art/Shaders/Character/AnisoHair_cathyhlshih/LICENSE" } },

            new Entry { Id = "haircards", Paths = new[] { "Assets/Art/Shaders/Character/HairCards_itsFulcrum/" },
                TitleKo = "머리칼 카드 셰이더", TitleEn = "Hair card shader",
                BodyKo = "itsFulcrum — CC0", BodyEn = "itsFulcrum — CC0" },

            new Entry { Id = "unity", Paths = new[] { "Packages/" },
                TitleKo = "엔진", TitleEn = "Engine",
                BodyKo = "Unity · Unity 패키지 — Unity Technologies (패키지 라이선스·제3자 고지는 아래)",
                BodyEn = "Unity and Unity packages — Unity Technologies (package licenses and third-party notices below)" },
        };

        /// <summary>에셋 경로 → 출처(가장 긴 접두어). 없으면 null.</summary>
        public static Entry Match(string path)
        {
            Entry best = null;
            int bestLen = -1;
            foreach (var e in Entries)
                foreach (var p in e.Paths)
                    if (p.Length > bestLen && path.StartsWith(p, System.StringComparison.Ordinal)) { best = e; bestLen = p.Length; }
            return best;
        }

        private static string _legal;

        /// <summary>점검이 만든 법적 고지(첫 줄 = 쓰인 출처 id). 없으면 빈 글.</summary>
        public static string Legal
        {
            get
            {
                if (_legal != null) return _legal;
                var ta = Resources.Load<TextAsset>(LegalResource);
                _legal = ta != null ? ta.text : "";
                return _legal;
            }
        }

        public static HashSet<string> UsedIds()
        {
            var set = new HashSet<string>();
            var legal = Legal;
            int nl = legal.IndexOf('\n');
            string first = nl >= 0 ? legal.Substring(0, nl) : legal;
            if (first.StartsWith(UsedPrefix))
                foreach (var id in first.Substring(UsedPrefix.Length).Split(','))
                    if (id.Trim().Length > 0) set.Add(id.Trim());
            return set;
        }

        /// <summary>법적 고지 본문(첫 줄 빼고).</summary>
        public static string LegalBody()
        {
            var legal = Legal;
            int nl = legal.IndexOf('\n');
            return nl >= 0 && legal.StartsWith(UsedPrefix) ? legal.Substring(nl + 1) : legal;
        }

        /// <summary>크레딧 화면 머리 — 쓰인 출처만(고지 파일이 없으면 전부).</summary>
        public static string Summary(bool en)
        {
            var used = UsedIds();
            var sb = new StringBuilder();
            foreach (var e in Entries)
            {
                if (e.Own || (used.Count > 0 && !used.Contains(e.Id))) continue;
                sb.Append("<color=#F2C760>").Append(en ? e.TitleEn : e.TitleKo).Append("</color>\n");
                sb.Append(en ? e.BodyEn : e.BodyKo).Append('\n');
                if (e.Copyright != null) sb.Append("<size=80%>").Append(e.Copyright).Append("</size>\n");
                sb.Append('\n');
            }
            return sb.ToString().TrimEnd();
        }
    }
}
