using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-6b 도감 화면 진단 — `PlaytestHeadless` 가 도감 105·싸워서 등용 진단 뒤에 부른다.
    /// 빈 판(동행·만남 없음) → 진짜 "도감" 버튼으로 열림 · 모은 수 0/105 · 시대 넷 탭(22/26/20/37 칸)·진짜 탭 버튼 · 전부 그림자(검은 칸·이름 없음·"? ? ?") ·
    /// 겨루기를 열면 만남(이름·회색) · 동행이면 등용(원소 빛깔·원소·기질·한마디) · 진짜 칸 버튼 → 자세히(서는 지역) · 탭·제목 수 ·
    /// 가로 PC 캔버스(1080×607)에 들어가는 배치 · 지도와 서로 닫힘 · 닫기 버튼 · 세이브 v18 왕복·v16 로드(동행만 만남).
    /// 끝나면 동행·인연·만남·들판 인물·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoHeroDex
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var ui = HeroDexUi.Instance;
            var heroes = FieldHeroes.Instance;
            if (ui == null || heroes == null) { Fail("HeroDexUi/FieldHeroes 없음"); return false; }

            var startMembers = new List<string>(PartyState.MemberIds);
            var startWalked = BondState.SnapshotWalked(PartyState.MemberIds);
            var startWins = BondState.SnapshotWins(PartyState.MemberIds);
            var startSeen = HeroDexState.Snapshot();
            int enemies = FieldEnemy.All.Count;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string savedJson = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string metrics = "";
            try
            {
                var keep = new List<string>();
                foreach (var m in startMembers) if (!GoHeroes.TryGet(m, out _)) keep.Add(m); // 도감 밖 동행(산적)은 둔다
                PartyState.Restore(keep);
                HeroDexState.Restore(null);
                metrics = CheckEmpty(ui);
                CheckStates(ui, heroes, enemies);
                CheckLayout(ui);
                CheckMapExclusive(ui);
                CheckSave(savePath);
                ui.CloseButton.onClick.Invoke();
                if (ui.IsOpen) Fail("닫기 버튼이 안 닫는다");
            }
            finally
            {
                PartyState.Restore(startMembers);
                BondState.Restore(PartyState.MemberIds, startWalked, startWins);
                HeroDexState.Restore(startSeen);
                foreach (var s in heroes.Slots) { s.Skip = 0; s.Wait = 0f; heroes.Refresh(s); }
                ui.Close();
                if (WorldMapUi.Instance != null) WorldMapUi.Instance.Close();
                if (savedJson != null) System.IO.File.WriteAllText(savePath, savedJson);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
            }
            if (FieldEnemy.All.Count != enemies) Fail($"끝난 뒤 들판 적 {FieldEnemy.All.Count} ≠ {enemies}");
            if (_ok) Debug.Log($"[{_tag}] hero dex OK - 버튼 열림·0/105·탭 넷 칸 {metrics}·그림자·겨루기→만남·동행→등용·칸 버튼 자세히·탭 수·가로 배치·지도와 서로 닫힘·닫기·v18 왕복·v16 로드");
            return _ok;
        }

        private static string CheckEmpty(HeroDexUi ui)
        {
            if (ui.IsOpen) Fail("처음부터 열려 있다");
            if (ui.DexButton == null) { Fail("도감 버튼 없음"); return ""; }
            ui.DexButton.onClick.Invoke();
            if (!ui.IsOpen) Fail("도감 버튼이 안 연다");
            if (!ui.TitleText.Contains("0/105")) Fail($"빈 판 제목 {ui.TitleText}");
            if (ui.TabCount != 5) Fail($"시대 탭 {ui.TabCount}"); // 109-14-15 다섯째 = 이야기 동료
            var want = new[] { 22, 26, 20, 37, 7 }; // 이야기 동료 일곱(109-14-15 둘 + 109-14-17 둘 + 109-14-20 해솔 + 109-14-30 하람 + 109-14-36 달음)
            string counts = "";
            for (int t = 0; t < ui.TabCount; t++)
            {
                ui.TabButton(t).onClick.Invoke();
                if ((int)ui.Era != t) Fail($"탭 {t} 이 시대 {ui.Era}");
                if (ui.CardCount != want[t]) Fail($"{ui.Era} 칸 {ui.CardCount} ≠ {want[t]}");
                if (!ui.TabText(t).Contains($"0/{want[t]}")) Fail($"탭 글 {ui.TabText(t)}");
                counts += (t > 0 ? "/" : "") + ui.CardCount;
                for (int i = 0; i < ui.CardCount; i++)
                {
                    if (ui.StateOfCard(i) != HeroDexUi.CardState.Unseen) Fail($"{ui.CardHeroId(i)} 빈 판인데 {ui.StateOfCard(i)}");
                    GoHeroes.TryGet(ui.CardHeroId(i), out var h);
                    if (h.Era != ui.Era) Fail($"{h.Id} 가 {ui.Era} 탭에");
                    string txt = ui.CardText(i);
                    if (txt.Contains(GoHeroes.Name(h)) || !txt.Contains("? ? ?") || !txt.StartsWith(GoHeroes.Stars(h.Rarity))) Fail($"{h.Id} 그림자 칸 글 {txt}");
                    var c = ui.CardColor(i);
                    if (Mathf.Max(c.r, Mathf.Max(c.g, c.b)) > 0.1f) Fail($"{h.Id} 그림자 칸이 밝다 {c}");
                }
            }
            ui.TabButton(0).onClick.Invoke();
            if (!ui.DetailText.Contains("?") && ui.DetailText.Length < 10) Fail("고르기 전 안내 줄 빔");
            return counts;
        }

        private static int CardOf(HeroDexUi ui, string id)
        {
            for (int i = 0; i < ui.CardCount; i++) if (ui.CardHeroId(i) == id) return i;
            return -1;
        }

        private static void CheckStates(HeroDexUi ui, FieldHeroes heroes, int enemies)
        {
            // 겨루기를 열면 만남 — 마을 들판 첫 사람(★3)
            FieldHeroes.Slot village = null;
            foreach (var s in heroes.Slots) if (s.Stand.RegionId == "village") village = s;
            if (village == null || village.HeroId == null) { Fail("마을 들판 자리 없음"); return; }
            string metId = village.HeroId;
            GoHeroes.TryGet(metId, out var met);
            heroes.StartDuel(village);
            if (!HeroDexState.IsSeen(metId)) Fail($"{metId} 겨뤘는데 만남이 아니다");
            heroes.Refresh(village); // 겨루기 치움(같은 사람이 다시 선다)
            if (FieldEnemy.All.Count != enemies) Fail($"겨루기 치운 뒤 들판 적 {FieldEnemy.All.Count}");
            ui.SelectEra(met.Era);
            int k = CardOf(ui, metId);
            if (k < 0) { Fail($"{metId} 칸 없음"); return; }
            if (ui.StateOfCard(k) != HeroDexUi.CardState.Seen) Fail($"{metId} 칸 {ui.StateOfCard(k)} ≠ Seen");
            if (!ui.CardText(k).Contains(GoHeroes.Name(met))) Fail($"만남 칸에 이름이 없다 {ui.CardText(k)}");
            if (!ui.TitleText.Contains("0/105") || !ui.TitleText.Contains(" 1")) Fail($"만남 뒤 제목 {ui.TitleText}");
            ui.CardButton(k).onClick.Invoke();
            string region = GoWorldMap.RegionName("village");
            if (!ui.DetailText.Contains(GoHeroes.Name(met)) || !ui.DetailText.Contains(region)) Fail($"만남 자세히 {ui.DetailText}");

            // 동행이면 등용 — 같은 시대 다른 사람을 곧바로 등용(겨룬 적 없어도 동행이면 만난 셈)
            string gotId = null;
            foreach (var h in GoHeroes.All) if (h.Era == met.Era && h.Id != metId) { gotId = h.Id; break; }
            PartyState.Recruit(gotId);
            GoHeroes.TryGet(gotId, out var got);
            int g = CardOf(ui, gotId);
            if (ui.StateOfCard(g) != HeroDexUi.CardState.Got) Fail($"{gotId} 동행인데 {ui.StateOfCard(g)}");
            var el = GoHeroes.ElementOf(got);
            string gt = ui.CardText(g);
            if (!gt.Contains(GoHeroes.Name(got)) || !gt.Contains(GoElements.NameOf(el)) || !gt.Contains(GoHeroes.TraitName(got.Trait))) Fail($"등용 칸 글 {gt}");
            var c = ui.CardColor(g);
            if (Mathf.Max(c.r, Mathf.Max(c.g, c.b)) < 0.2f) Fail($"등용 칸이 어둡다 {c}");
            int tab = (int)met.Era;
            if (!ui.TabText(tab).StartsWith(GoHeroes.EraName(met.Era)) || !ui.TabText(tab).Contains("1/")) Fail($"등용 뒤 탭 {ui.TabText(tab)}");
            if (!ui.TitleText.Contains("1/105") || !ui.TitleText.Contains(" 2")) Fail($"등용 뒤 제목 {ui.TitleText}");
            ui.CardButton(g).onClick.Invoke();
            if (!ui.DetailText.Contains(GoHeroes.Quote(got)) || !ui.DetailText.Contains(got.Might.ToString())) Fail($"등용 자세히 {ui.DetailText}");

            // 안 만난 사람 자세히 — 이름은 숨고 서는 지역만
            for (int i = 0; i < ui.CardCount; i++)
            {
                if (ui.StateOfCard(i) != HeroDexUi.CardState.Unseen) continue;
                GoHeroes.TryGet(ui.CardHeroId(i), out var u);
                ui.CardButton(i).onClick.Invoke();
                string r = GoWorldMap.RegionName(GoHeroes.RegionOf(u.Id));
                if (ui.DetailText.Contains(GoHeroes.Name(u)) || !ui.DetailText.Contains(r)) Fail($"그림자 자세히 {ui.DetailText}");
                break;
            }
            foreach (var h in GoHeroes.All) if (GoHeroes.RegionOf(h.Id) == null) Fail($"{h.Id} 서는 지역 없음");
        }

        private static void CheckLayout(HeroDexUi ui)
        {
            // 가로 PC 캔버스 1080×607 — 가운데 ±300 안, 칸 줄 끝이 자세히 줄 위
            ui.SelectEra(HeroEra.World);
            float minY = 999f, maxX = 0f;
            for (int i = 0; i < ui.CardCount; i++)
            {
                var r = (RectTransform)ui.CardButton(i).transform;
                minY = Mathf.Min(minY, r.anchoredPosition.y - r.sizeDelta.y * 0.5f);
                maxX = Mathf.Max(maxX, Mathf.Abs(r.anchoredPosition.x) + r.sizeDelta.x * 0.5f);
            }
            var close = (RectTransform)ui.CloseButton.transform;
            float bottom = close.anchoredPosition.y - close.sizeDelta.y * 0.5f;
            if (maxX > 530f) Fail($"칸이 가로 {maxX:F0} 까지 — 1080 폭 밖");
            if (bottom < -300f) Fail($"닫기 버튼 아래 끝 {bottom:F0} — 607 높이 밖");
            if (minY < -196f + 48f) Fail($"칸 줄 끝 {minY:F0} 이 자세히 줄과 겹친다");
            var title = ui.TabButton(0).transform as RectTransform;
            if (title.anchoredPosition.y + title.sizeDelta.y * 0.5f > 300f) Fail("탭이 607 높이 밖");
        }

        private static void CheckMapExclusive(HeroDexUi ui)
        {
            var map = WorldMapUi.Instance;
            if (map == null) { Fail("WorldMapUi 없음"); return; }
            ui.Open();
            map.Open();
            if (ui.IsOpen || !map.IsOpen) Fail($"지도 열면 도감이 닫혀야(도감 {ui.IsOpen}·지도 {map.IsOpen})");
            ui.Open();
            if (map.IsOpen || !ui.IsOpen) Fail($"도감 열면 지도가 닫혀야(도감 {ui.IsOpen}·지도 {map.IsOpen})");
        }

        private static void CheckSave(string path)
        {
            // 지금 판: 만남 1(마을 첫 사람)·등용 1
            var seen = HeroDexState.Snapshot();
            if (seen.Count != 1) { Fail($"만남 기록 {seen.Count} ≠ 1"); return; }
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(path);
            if (!json.Contains("\"version\":28") || !json.Contains($"\"heroesSeen\":[\"{seen[0]}\"]")) Fail("세이브 v18 에 만남이 없다");
            HeroDexState.Restore(null);
            if (!SaveState.TryLoad() || !HeroDexState.IsSeen(seen[0])) Fail("v18 왕복 뒤 만남이 사라졌다");
            string v16 = Regex.Replace(json.Replace("\"version\":28", "\"version\":16"), ",\"heroesSeen\":\\[[^\\]]*\\]", "");
            if (v16.Contains("heroesSeen")) { Fail("v16 모양 만들기 실패"); return; }
            System.IO.File.WriteAllText(path, v16);
            if (!SaveState.TryLoad()) { Fail("v16 파일 TryLoad 실패"); return; }
            if (HeroDexState.IsSeen(seen[0])) Fail("v16 을 읽었는데 겨루기만 한 사람이 만남으로 남았다");
            string got = null;
            foreach (var m in PartyState.MemberIds) if (GoHeroes.TryGet(m, out _)) got = m;
            if (got == null || !HeroDexState.IsSeen(got)) Fail("v16 을 읽었는데 동행이 만남이 아니다");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] hero dex FAIL - {msg}");
        }
    }
}
