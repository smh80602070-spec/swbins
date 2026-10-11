extends RefCounted

## G-0207 — 2나락 잡몹 명단. 웹 saga-web/saga-dungeon/js/data-enemy.js ENEMIES 134종에서 뽑음(2026-10-11, 일회용 node 스크립트 — 손으로 고치지 말고 웹 표를 고치면 함께 다시 뽑는다).
## 이름은 웹에서 이미 이름 정책을 거친 표시 글자. kind human|beast · form(짐승 몸 모양, 사람이면 "") · weapon(사람 무기 — 2차에서 리듬·원거리)
## tier 1: 1~5층 · 2: 6~12 · 3: 13~25 · 4: 26~ · resist 는 결별 저항 % · atk_el(원소 공격, 2차) · biome(들판용 — 던전은 안 씀).

const ENEMIES: Array[Dictionary] = [
	{"name": "황건적", "kind": "human", "color": "#c9a83a", "form": "", "weapon": "club", "tier": 1, "resist": {}, "atk_el": "", "biome": "ruins"},
	{"name": "산적", "kind": "human", "color": "#6b5030", "form": "", "weapon": "axe", "tier": 1, "resist": {}, "atk_el": "", "biome": "mountain"},
	{"name": "도적떼", "kind": "human", "color": "#5a4a58", "form": "", "weapon": "sword", "tier": 1, "resist": {}, "atk_el": "", "biome": "forest"},
	{"name": "들개", "kind": "beast", "color": "#8a7358", "form": "quad", "weapon": "", "tier": 1, "resist": {"chi": 25.0}, "atk_el": "", "biome": "forest"},
	{"name": "떠돌이 병졸", "kind": "human", "color": "#6a6a74", "form": "", "weapon": "spear", "tier": 1, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "멧돼지", "kind": "beast", "color": "#4a3a2a", "form": "quad", "weapon": "", "tier": 1, "resist": {"phys": 15.0}, "atk_el": "", "biome": "swamp"},
	{"name": "해골졸개", "kind": "beast", "color": "#b8b0a0", "form": "ogre", "weapon": "", "tier": 1, "resist": {"phys": 10.0}, "atk_el": "", "biome": "ruins"},
	{"name": "원혼", "kind": "beast", "color": "#d8d0e0", "form": "ogre", "weapon": "", "tier": 1, "resist": {"phys": 15.0}, "atk_el": "", "biome": "shrine"},
	{"name": "독사", "kind": "beast", "color": "#4a6a3a", "form": "serpent", "weapon": "", "tier": 1, "resist": {}, "atk_el": "pois", "biome": "swamp"},
	{"name": "말벌떼", "kind": "beast", "color": "#d9c020", "form": "bird", "weapon": "", "tier": 1, "resist": {}, "atk_el": "pois", "biome": "forest"},
	{"name": "들쥐떼", "kind": "beast", "color": "#8a7a6a", "form": "quad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "ruins"},
	{"name": "청개구리", "kind": "beast", "color": "#5a9a5a", "form": "toad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "swamp"},
	{"name": "홍슬라임", "kind": "beast", "color": "#d97a9a", "form": "quad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "mountain"},
	{"name": "늪슬라임", "kind": "beast", "color": "#4a8a6a", "form": "quad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "swamp"},
	{"name": "애기버섯", "kind": "beast", "color": "#8a5aa0", "form": "ogre", "weapon": "", "tier": 1, "resist": {}, "atk_el": "pois", "biome": "forest"},
	{"name": "이끼괴물", "kind": "beast", "color": "#3a6a3a", "form": "quad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "forest"},
	{"name": "동굴슬라임", "kind": "beast", "color": "#6a5a8a", "form": "quad", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": "mountain"},
	{"name": "왜구", "kind": "human", "color": "#8a4a4a", "form": "", "weapon": "sword", "tier": 2, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "마적", "kind": "human", "color": "#7a5a3a", "form": "", "weapon": "sword", "tier": 2, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "오랑캐 궁수", "kind": "human", "color": "#7a6a4a", "form": "", "weapon": "bow", "tier": 2, "resist": {}, "atk_el": "pois", "biome": ""},
	{"name": "거란 기병", "kind": "human", "color": "#5a6a8a", "form": "", "weapon": "spear", "tier": 2, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "남만 코끼리병", "kind": "beast", "color": "#8a8a92", "form": "quad", "weapon": "", "tier": 2, "resist": {"chi": 35.0, "phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "해골무사", "kind": "beast", "color": "#c9c2a8", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "원귀", "kind": "beast", "color": "#bfe0f0", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 35.0}, "atk_el": "", "biome": ""},
	{"name": "산도깨비", "kind": "beast", "color": "#5a7a3a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "해골도둑", "kind": "beast", "color": "#a89ac9", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "탐귀", "kind": "beast", "color": "#6a3a4a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"chi": 15.0}, "atk_el": "", "biome": ""},
	{"name": "해골귀", "kind": "beast", "color": "#d8d8e8", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 30.0}, "atk_el": "", "biome": ""},
	{"name": "은신 첩자", "kind": "beast", "color": "#3a3a3a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "늪 왕슬라임", "kind": "beast", "color": "#2a6a4a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "왕버섯도깨비", "kind": "beast", "color": "#7a4a90", "form": "ogre", "weapon": "", "tier": 2, "resist": {"chi": 10.0}, "atk_el": "pois", "biome": ""},
	{"name": "회오리 정령", "kind": "beast", "color": "#8ac9d9", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "산짐승 요괴", "kind": "beast", "color": "#7a5a3a", "form": "quad", "weapon": "", "tier": 2, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "가시귀", "kind": "beast", "color": "#4a8a3a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "먹물 요괴", "kind": "beast", "color": "#3a3a6a", "form": "fish", "weapon": "", "tier": 2, "resist": {"chi": 15.0}, "atk_el": "", "biome": ""},
	{"name": "왕거미", "kind": "beast", "color": "#2a2a2a", "form": "quad", "weapon": "", "tier": 2, "resist": {}, "atk_el": "pois", "biome": ""},
	{"name": "가시슬라임", "kind": "beast", "color": "#3a7a2a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "여진 궁수", "kind": "human", "color": "#6a7a5a", "form": "", "weapon": "bow", "tier": 3, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "몽골 기병", "kind": "human", "color": "#8a7a5a", "form": "", "weapon": "spear", "tier": 3, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "왜군 조총병", "kind": "human", "color": "#7a4a4a", "form": "", "weapon": "staff", "tier": 3, "resist": {}, "atk_el": "fire", "biome": ""},
	{"name": "위군 창병", "kind": "human", "color": "#31609f", "form": "", "weapon": "spear", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "수군 척후선", "kind": "human", "color": "#3a6a8a", "form": "", "weapon": "bow", "tier": 3, "resist": {"chi": 30.0}, "atk_el": "", "biome": ""},
	{"name": "산군", "kind": "beast", "color": "#c9772f", "form": "quad", "weapon": "", "tier": 3, "resist": {"chi": 25.0, "phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "해골법사", "kind": "beast", "color": "#8a6ac9", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 30.0}, "atk_el": "lit", "biome": ""},
	{"name": "진흙귀신", "kind": "beast", "color": "#7a6a52", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "설인", "kind": "beast", "color": "#cfe6f0", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "cold", "biome": ""},
	{"name": "독버섯 요괴", "kind": "beast", "color": "#9a6ac0", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 15.0}, "atk_el": "pois", "biome": ""},
	{"name": "청귀", "kind": "beast", "color": "#3a6a9a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 25.0}, "atk_el": "cold", "biome": ""},
	{"name": "그림자 자객", "kind": "beast", "color": "#1a1a2a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "요술사", "kind": "beast", "color": "#5a3a8a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 25.0}, "atk_el": "fire", "biome": ""},
	{"name": "이무기", "kind": "beast", "color": "#3a5a4a", "form": "dragon", "weapon": "", "tier": 3, "resist": {"phys": 20.0, "chi": 20.0}, "atk_el": "", "biome": ""},
	{"name": "독개구리", "kind": "beast", "color": "#6a9a3a", "form": "toad", "weapon": "", "tier": 3, "resist": {"chi": 15.0}, "atk_el": "pois", "biome": ""},
	{"name": "산야인", "kind": "beast", "color": "#6a4a3a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "가시왕", "kind": "beast", "color": "#3a7a2a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "왕도깨비", "kind": "beast", "color": "#3a5a2a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "뿔공룡", "kind": "beast", "color": "#7a6a3a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "철갑 중장병", "kind": "human", "color": "#6a6a7a", "form": "", "weapon": "halberd", "tier": 4, "resist": {"phys": 40.0}, "atk_el": "", "biome": ""},
	{"name": "근위 기병", "kind": "human", "color": "#8a3a4a", "form": "", "weapon": "spear", "tier": 4, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "연노 사수", "kind": "human", "color": "#5a5a6a", "form": "", "weapon": "bow", "tier": 4, "resist": {}, "atk_el": "lit", "biome": ""},
	{"name": "수군 함대", "kind": "human", "color": "#3a5a7a", "form": "", "weapon": "sword", "tier": 4, "resist": {"chi": 40.0, "phys": 15.0}, "atk_el": "cold", "biome": ""},
	{"name": "흑기병", "kind": "human", "color": "#3a3a44", "form": "", "weapon": "halberd", "tier": 4, "resist": {"phys": 30.0, "chi": 20.0}, "atk_el": "", "biome": ""},
	{"name": "강시", "kind": "beast", "color": "#6a7a5a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "화염귀", "kind": "beast", "color": "#8a2a2a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 30.0}, "atk_el": "fire", "biome": ""},
	{"name": "왕진흙귀신", "kind": "beast", "color": "#5a4a3a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 35.0}, "atk_el": "", "biome": ""},
	{"name": "대설인", "kind": "beast", "color": "#b8d8e8", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "cold", "biome": ""},
	{"name": "거인", "kind": "beast", "color": "#6a6a6a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 40.0}, "atk_el": "", "biome": ""},
	{"name": "왕멧돼지", "kind": "beast", "color": "#2a1c10", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "해골척후", "kind": "beast", "color": "#9a9080", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "구천혼", "kind": "beast", "color": "#b8a8d8", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "흑사", "kind": "beast", "color": "#2a3a1a", "form": "serpent", "weapon": "", "tier": 2, "resist": {"chi": 15.0}, "atk_el": "pois", "biome": ""},
	{"name": "왕말벌떼", "kind": "beast", "color": "#a89010", "form": "bird", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "pois", "biome": ""},
	{"name": "역병쥐떼", "kind": "beast", "color": "#5a4a3a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "pois", "biome": ""},
	{"name": "괴이두꺼비", "kind": "beast", "color": "#3a6a3a", "form": "toad", "weapon": "", "tier": 2, "resist": {"chi": 15.0}, "atk_el": "", "biome": ""},
	{"name": "대홍슬라임", "kind": "beast", "color": "#a83a5a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "묵늪슬라임", "kind": "beast", "color": "#2a4a3a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 15.0, "chi": 10.0}, "atk_el": "", "biome": ""},
	{"name": "홀씨버섯", "kind": "beast", "color": "#5a3a70", "form": "ogre", "weapon": "", "tier": 2, "resist": {"chi": 10.0}, "atk_el": "pois", "biome": ""},
	{"name": "고목이끼괴물", "kind": "beast", "color": "#1a3a1a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "결정슬라임", "kind": "beast", "color": "#4a3a6a", "form": "quad", "weapon": "", "tier": 2, "resist": {"chi": 15.0}, "atk_el": "", "biome": ""},
	{"name": "전상코끼리병", "kind": "beast", "color": "#5a5a62", "form": "quad", "weapon": "", "tier": 3, "resist": {"chi": 40.0, "phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "해골대장", "kind": "beast", "color": "#8a8270", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "악귀", "kind": "beast", "color": "#7a9ab0", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 40.0}, "atk_el": "", "biome": ""},
	{"name": "노산도깨비", "kind": "beast", "color": "#3a5a1a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "해골암살자", "kind": "beast", "color": "#6a5a8a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "탐욕귀왕", "kind": "beast", "color": "#4a1a2a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 20.0}, "atk_el": "", "biome": ""},
	{"name": "백골귀왕", "kind": "beast", "color": "#8a80a0", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 35.0}, "atk_el": "", "biome": ""},
	{"name": "심야 첩자", "kind": "beast", "color": "#0a0a12", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "심연늪슬라임", "kind": "beast", "color": "#0a3a2a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "포자군주", "kind": "beast", "color": "#5a2a70", "form": "ogre", "weapon": "", "tier": 3, "resist": {"chi": 15.0}, "atk_el": "pois", "biome": ""},
	{"name": "폭풍 정령", "kind": "beast", "color": "#5a89a0", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "노괴 산짐승", "kind": "beast", "color": "#4a3a1a", "form": "quad", "weapon": "", "tier": 3, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "철가시귀", "kind": "beast", "color": "#2a5a1a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "심해 먹물귀", "kind": "beast", "color": "#1a1a4a", "form": "fish", "weapon": "", "tier": 3, "resist": {"chi": 20.0}, "atk_el": "", "biome": ""},
	{"name": "독왕거미", "kind": "beast", "color": "#0a0a0a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "pois", "biome": ""},
	{"name": "대가시슬라임", "kind": "beast", "color": "#1a5a0a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "백두산군", "kind": "beast", "color": "#e0e0e0", "form": "quad", "weapon": "", "tier": 4, "resist": {"chi": 30.0, "phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "해골대법사", "kind": "beast", "color": "#5a4a90", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 35.0}, "atk_el": "lit", "biome": ""},
	{"name": "심연진흙귀신", "kind": "beast", "color": "#3a2a1a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 30.0}, "atk_el": "", "biome": ""},
	{"name": "설산군주", "kind": "beast", "color": "#8ac0e0", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "cold", "biome": ""},
	{"name": "독버섯 대군주", "kind": "beast", "color": "#6a3a80", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 20.0}, "atk_el": "pois", "biome": ""},
	{"name": "대청귀", "kind": "beast", "color": "#1a3a6a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 30.0}, "atk_el": "cold", "biome": ""},
	{"name": "칠흑 자객", "kind": "beast", "color": "#0a0a10", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "대요술사", "kind": "beast", "color": "#3a1a5a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 30.0}, "atk_el": "fire", "biome": ""},
	{"name": "흑이무기", "kind": "beast", "color": "#1a2a2a", "form": "dragon", "weapon": "", "tier": 4, "resist": {"phys": 25.0, "chi": 25.0}, "atk_el": "", "biome": ""},
	{"name": "왕독개구리", "kind": "beast", "color": "#3a6a10", "form": "toad", "weapon": "", "tier": 4, "resist": {"chi": 20.0}, "atk_el": "pois", "biome": ""},
	{"name": "노산야인", "kind": "beast", "color": "#3a2a1a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "대가시왕", "kind": "beast", "color": "#1a5a0a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "노왕도깨비", "kind": "beast", "color": "#1a3a0a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "왕뿔공룡", "kind": "beast", "color": "#4a3a1a", "form": "quad", "weapon": "", "tier": 4, "resist": {"phys": 30.0}, "atk_el": "", "biome": ""},
	{"name": "역병강시", "kind": "beast", "color": "#3a5a2a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "pois", "biome": ""},
	{"name": "겁화귀", "kind": "beast", "color": "#a81a1a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"chi": 35.0}, "atk_el": "fire", "biome": ""},
	{"name": "태고진흙귀신", "kind": "beast", "color": "#2a2018", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 40.0}, "atk_el": "", "biome": ""},
	{"name": "빙하대설인", "kind": "beast", "color": "#d8f0f8", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 30.0}, "atk_el": "cold", "biome": ""},
	{"name": "폭풍거인", "kind": "beast", "color": "#4a4a5a", "form": "ogre", "weapon": "", "tier": 4, "resist": {"phys": 45.0}, "atk_el": "lit", "biome": ""},
	{"name": "쾌조룡", "kind": "beast", "color": "#6a7a3a", "form": "quad", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "볏공룡", "kind": "beast", "color": "#a0895a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "판갑룡", "kind": "beast", "color": "#5a6a4a", "form": "quad", "weapon": "", "tier": 3, "resist": {"phys": 30.0}, "atk_el": "", "biome": ""},
	{"name": "폭룡", "kind": "beast", "color": "#6a2a1a", "form": "quad", "weapon": "", "tier": 4, "resist": {"phys": 25.0}, "atk_el": "", "biome": ""},
	{"name": "삼각뿔룡", "kind": "beast", "color": "#8a5a3a", "form": "quad", "weapon": "", "tier": 4, "resist": {"phys": 35.0}, "atk_el": "", "biome": ""},
	{"name": "장경룡", "kind": "beast", "color": "#5a7a6a", "form": "quad", "weapon": "", "tier": 4, "resist": {"phys": 40.0}, "atk_el": "", "biome": ""},
	{"name": "풋귀", "kind": "beast", "color": "#5a8a3a", "form": "ogre", "weapon": "", "tier": 1, "resist": {}, "atk_el": "", "biome": ""},
	{"name": "집게괴", "kind": "beast", "color": "#a8503a", "form": "quad", "weapon": "", "tier": 1, "resist": {"phys": 10.0}, "atk_el": "", "biome": "swamp"},
	{"name": "고목정", "kind": "beast", "color": "#4a6a3a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"phys": 10.0}, "atk_el": "", "biome": "forest"},
	{"name": "외눈귀", "kind": "beast", "color": "#7a6a5a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"phys": 15.0}, "atk_el": "", "biome": "mountain"},
	{"name": "심연촉수귀", "kind": "beast", "color": "#2a3a4a", "form": "dragon", "weapon": "", "tier": 4, "resist": {"chi": 20.0}, "atk_el": "", "biome": ""},
	{"name": "강철랑", "kind": "beast", "color": "#aab4bd", "form": "quad", "weapon": "", "tier": 1, "resist": {"emp": 30.0}, "atk_el": "", "biome": ""},
	{"name": "동합귀", "kind": "beast", "color": "#b87333", "form": "ogre", "weapon": "", "tier": 1, "resist": {"emp": 30.0}, "atk_el": "", "biome": ""},
	{"name": "철갑해", "kind": "beast", "color": "#8a95a0", "form": "quad", "weapon": "", "tier": 1, "resist": {"emp": 25.0, "phys": 10.0}, "atk_el": "", "biome": "swamp"},
	{"name": "강철익수", "kind": "beast", "color": "#7a8a94", "form": "quad", "weapon": "", "tier": 2, "resist": {"emp": 35.0, "phys": 10.0}, "atk_el": "", "biome": ""},
	{"name": "동력파룡", "kind": "beast", "color": "#9aa8b4", "form": "quad", "weapon": "", "tier": 2, "resist": {"emp": 35.0}, "atk_el": "emp", "biome": ""},
	{"name": "청동거목", "kind": "beast", "color": "#5f8a7a", "form": "ogre", "weapon": "", "tier": 2, "resist": {"emp": 35.0, "phys": 10.0}, "atk_el": "", "biome": "forest"},
	{"name": "강철판갑", "kind": "beast", "color": "#6a7480", "form": "quad", "weapon": "", "tier": 3, "resist": {"emp": 40.0, "phys": 20.0}, "atk_el": "", "biome": ""},
	{"name": "기계외안", "kind": "beast", "color": "#8a8f9a", "form": "ogre", "weapon": "", "tier": 3, "resist": {"emp": 40.0}, "atk_el": "emp", "biome": "mountain"},
	{"name": "초강폭룡", "kind": "beast", "color": "#5a626e", "form": "quad", "weapon": "", "tier": 4, "resist": {"emp": 45.0, "phys": 15.0}, "atk_el": "", "biome": ""},
	{"name": "강철촉수귀", "kind": "beast", "color": "#4a5a68", "form": "dragon", "weapon": "", "tier": 4, "resist": {"emp": 45.0, "chi": 10.0}, "atk_el": "emp", "biome": ""},
]


## data-enemy.js tierOf(stage) 그대로.
static func tier_of(floor_num: int) -> int:
	if floor_num <= 5:
		return 1
	if floor_num <= 12:
		return 2
	if floor_num <= 25:
		return 3
	return 4


## data-enemy.js poolFor(stage, boss=false) 의 던전 갈래 그대로 — 그 단계(tier)만(지역 명단·biome 은 들판용이라 뺌).
static func pool_for(floor_num: int) -> Array:
	var t := tier_of(floor_num)
	var out: Array = ENEMIES.filter(func(e: Dictionary) -> bool: return int(e.tier) == t)
	return out if not out.is_empty() else ENEMIES


static func by_name(n: String) -> Dictionary:
	for e: Dictionary in ENEMIES:
		if String(e.name) == n:
			return e
	return {}
