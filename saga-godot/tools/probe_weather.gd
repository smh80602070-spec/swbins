extends SceneTree

## GO 날씨·계절·시각 규칙(data/weather.gd · season.gd · time_of_day.gd — 전부 화면 없는 순수 규칙) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_weather.gd
## ① 표: 날씨 여섯 모두 KINDS 에 있고 값이 갖춰짐 · 계절 넷의 달이 1~12 를 겹침 없이 덮음 · 계절 가중치 표가 날씨 여섯을 다 가짐
## ② 결정성: 같은 3시간 슬롯 안에서는 같은 날씨 · 같은 입력 같은 출력 ③ 분포: 계절을 고정하고 슬롯 2만 개를 뽑아 날씨 비율이 가중치 비율과
## 3%p 안에서 맞음 · 여름엔 눈 0(가중치 0) · 겨울 눈 비율이 여름 비 비율보다 낮지 않다는 식의 계절 성격 ④ 강제: force 가 먹고 틀린 키는 해제 ·
## 경험치 배율 = 1 + exp_pct/100 ⑤ 시각: TimeOfDay.force 가 먹고 null 이면 실제 시각(밤 21~04시 판정은 시스템 시계라 여기선 강제값만).
## 끝에 "PROBE weather OK" 또는 "PROBE weather FAIL n". 강제 상태는 끝에 풀어 둔다.

const SLOTS := 20000

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _freq(season_key: String) -> Dictionary:
	Season.force(season_key)
	var counts := {}
	for k in Weather.ORDER:
		counts[k] = 0
	for slot in SLOTS:
		counts[Weather.key_at(slot * Weather.SPAN_MS + 12345)] += 1
	for k in counts:
		counts[k] = float(counts[k]) / SLOTS
	return counts


func _initialize() -> void:
	# ① 표
	var kinds_ok := Weather.ORDER.size() == 6 and Weather.KINDS.size() == 6
	for k in Weather.ORDER:
		var d: Dictionary = Weather.KINDS.get(k, {})
		kinds_ok = kinds_ok and d.has("name") and d.has("emoji") and d.has("exp_pct") and float(d.fog_density_mul) > 0.0
	check(kinds_ok, "날씨 여섯 — 이름·이모지·경험치%·안개 배수 갖춤")
	var months := {}
	var dup := 0
	for s in Season.ORDER:
		for m in Season.TABLE[s].months:
			if months.has(m):
				dup += 1
			months[m] = s
	check(months.size() == 12 and dup == 0 and Season.key_at_month(1) == "winter" and Season.key_at_month(4) == "spring" and Season.key_at_month(7) == "summer" and Season.key_at_month(10) == "autumn", "계절 넷이 1~12월을 겹침 없이 덮음")
	var wx_ok := true
	for s in Season.ORDER:
		for k in Weather.ORDER:
			wx_ok = wx_ok and Season.TABLE[s].wx.has(k)
	check(wx_ok and is_equal_approx(Season.weather_weight("nope"), 1.0), "계절 가중치 표가 날씨 여섯을 다 가짐 · 모르는 키 배수 1.0")

	# ② 결정성
	Season.force("spring")
	var base := 5000 * Weather.SPAN_MS
	var same_slot := Weather.key_at(base) == Weather.key_at(base + Weather.SPAN_MS - 1) and Weather.key_at(base) == Weather.key_at(base)
	check(same_slot, "같은 3시간 슬롯 안에서는 같은 날씨")
	var changes := 0
	for slot in 200:
		if Weather.key_at(slot * Weather.SPAN_MS) != Weather.key_at((slot + 1) * Weather.SPAN_MS):
			changes += 1
	check(changes > 40 and changes < 200, "슬롯이 바뀌면 날씨도 바뀐다 (200칸 중 %d번)" % changes)

	# ③ 분포
	var worst := 0.0
	var summer: Dictionary
	var winter: Dictionary
	for s in Season.ORDER:
		var f := _freq(s)
		if s == "summer":
			summer = f
		if s == "winter":
			winter = f
		var total := 0.0
		for k in Weather.ORDER:
			total += float(Season.TABLE[s].wx[k])
		for k in Weather.ORDER:
			worst = maxf(worst, absf(f[k] - float(Season.TABLE[s].wx[k]) / total))
	check(worst < 0.03, "계절별 날씨 비율이 가중치 비율과 3%%p 안 (최대 오차 %.3f)" % worst)
	check(summer["snow"] == 0.0 and winter["snow"] > 0.3 and summer["rain"] > winter["rain"] * 2.0, "계절 성격 — 여름 눈 0 · 겨울 눈 %.2f · 여름 비 %.2f > 겨울 비 %.2f" % [winter["snow"], summer["rain"], winter["rain"]])

	# ④ 강제·경험치 배율
	Weather.force("rain")
	var rain_ok := Weather.current_key() == "rain" and is_equal_approx(Weather.exp_bonus_mul(), 1.0)
	Weather.force("clear")
	var clear_ok := Weather.current_key() == "clear" and is_equal_approx(Weather.exp_bonus_mul(), 1.10)
	Weather.force("snow")
	var snow_ok := is_equal_approx(Weather.exp_bonus_mul(), 1.0 + float(Weather.KINDS["snow"].exp_pct) / 100.0)
	check(rain_ok and clear_ok and snow_ok, "force 가 먹고 경험치 배율 = 1+exp_pct/100 (비 1.0·맑음 1.10)")
	Weather.force("nope")
	Season.force("nope")
	var real_ok := Weather.ORDER.has(Weather.current_key()) and Season.ORDER.has(Season.current_key())
	check(real_ok, "틀린 키는 강제를 풀고 실제 값으로")

	# ⑤ 시각
	TimeOfDay.force(true)
	var n1 := TimeOfDay.is_night()
	TimeOfDay.force(false)
	var n2 := TimeOfDay.is_night()
	TimeOfDay.force(null)
	var h: int = Time.get_time_dict_from_system()["hour"]
	check(n1 and not n2 and TimeOfDay.is_night() == (h >= 21 or h < 4), "TimeOfDay.force 가 먹고 null 이면 실제 시각(밤 21~04시)")

	Weather.force("")
	Season.force("")
	TimeOfDay.force(null)
	print("PROBE weather ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
