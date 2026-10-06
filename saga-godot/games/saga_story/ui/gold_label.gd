extends Label

## story_merchant.gd(2절 "제외" 목록의 "장비 나머지" 첫 걸음 — 상점)가 쓰는
## 지갑을 상시 표시한다. DUNGEON gold_label.gd와 같은 폴링 패턴.

const NumberFormat := preload("res://saga_core/ui/number_format.gd")

func _process(_delta: float) -> void:
	text = "💰 %s" % NumberFormat.comma(StorySaveState.gold)
