"""char-forge 옷 짓기 — 공방이 옷 메시를 지어 MakeHuman 옷(.mhclo)으로 내보낸다(README §8-1 09-26: CC0 옷장에 동양 역사 옷이 없다).

    export BLENDER_USER_RESOURCES="$PWD/tools/char-forge/_blender"
    "$B" -b --factory-startup -P tools/char-forge/garments.py -- <옷 id> [<옷 id> …]      # GARMENTS 의 열쇠, all = 전부

껍데기(shell)와 다른 점: 살을 복제해 띄우지 않고 **옷의 모양을 따로 짓는다**. 옷 하나 = 부품 여럿(`parts`):
  tube    몸통 통 — 위(목·가슴·허리)에서 아래(발목·무릎·엉덩이)까지. `arc`(가운데 도, 폭 도)면 앞(270)·뒤(90) 한쪽 판(겉옷판·망토, 살 안 지움). 가랑이 아래는 치마 도우미(helper-skirt)에 붙어 다리 사이가 안 갈라진다.
          `over` 만큼 밖에 겹쳐 입는다(저고리 위 치마 끝, 갑옷 위 비늘 치마). `mono` 면 아래로 좁아지지 않는다(가슴에서 시작하는 치마). `teeth`·`tooth` 면 끝단이 톱니(잎 옷·해진 옷자락).
  sleeves 소매 — `length` 팔 몫(1 = 손목, 0.35 = 어깨 갑옷), `start` 시작(0.6 = 팔꿈치 아래 팔 가리개, 윗팔 살은 안 지운다), `drop` 처짐, `flare` 끝 넓힘
          `arc`(도) = 팔 바깥쪽만 두르는 판(소데), `bag` = 팔꿈치부터 네모나게 늘어진 자루(기모노)
  band    띠 — 그 높이 통 둘레 바깥(`ease` 면 통 대신 몸 볼록 둘레 + ease — 앞뒤 판만 있는 겉옷판 위 허리띠)
  crown·visor 천 모자 몸통(머리 따라 둥글게, `cuff` 접은 단)·앞챙(`taper` 크면 가운데만 길다) — 챙 모자·비니, beret 은 `tilt_a` 로 쏠림 방향(270 = 앞, 납작 모자)
  backpack 등 짐 — 등판 뒤 둥근 모서리 상자(width·depth, top·bottom 높이) + 어깨끈 둘(strap 폭, 끈 칸 strap_slot·색 paint.strap)
  collar  목 깃(목폴라) — 목 살을 따라 목 밑에서 턱 밑까지, 밑단은 윗줄보다 `taper` 배 넘게 안 퍼진다(셔츠 깃 속으로)
  leggings 다리 통(정강이 가리개·바지) — `ease_bottom` 발목 여유(위로 곧게 ease 까지)·`smooth` 세로 다듬기·`wmin` 허벅지 무게 문턱(바지 0.15 — 엉덩이 옆 살까지) · discs 가슴 둥근 판(호심경) · bow 등 매듭(오비) · sash 비스듬한 띠(토가)
  mangeon·topknot·gat·helmet·neckguard·kuwagata·tassel·samo·boktu·myeollyu·beads·eboshi·turban·beret·hairdome·mage  머리 부품 — 머리 살에 붙는다
색 변형: `<id>@<헥스>[,<헥스>]` — 틀의 `colors`(C1·C2)를 바꾼 cf_<id>_<헥스>… (메시·맞춤은 기본 옷을 베끼고 그림만 새로)
그다음 MPFB MakeClothes 와 같은 순서(`mesh_is_valid_as_clothes` → `create_mhclo_from_clothes_matching` → `write_mhclo`)로 기본 몸에 맞춘
.mhclo 를 쓰므로 어느 체형에나 MakeHuman 이 맞춰 입힌다. 레시피에서는 받은 CC0 옷과 똑같이 `"clothes": ["cf_dopo/cf_dopo.mhclo"]`.
옷 정점은 옷 지을 때만 만드는 맞춤 무리(cf_torso·cf_arm_l/r·cf_head)에만 붙인다 — 'body' 전체면 A 자세 손(허리 옆)에 띠가 붙어 튄다.

천 그림(바탕 무늬 weave·lamellar·quilt·brocade + 깃·단·끝동·고름)과 **노멀 그림**도 여기서 굽는다. 부품마다 UV 칸(`slot`)이 있다.
만든 옷은 MPFB 사용자 데이터 `clothes/cf_<id>/`(gitignore 된 _blender 안) — 생성기가 정본이라 다른 PC 는 이 스크립트를 다시 돌린다.
좌표: 미터, Z 위, 앞 = -Y(둘레 각 270° = UV s 0.75).
"""
import bpy, bmesh, math, os, sys, uuid, random
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_real  # noqa: E402

TEX = 2048
SEG = 48       # 몸통 둘레 칸
SSEG = 24      # 소매 둘레 칸
HSEG = 32      # 머리 부품 둘레 칸
# UV 칸 (u0, v0, u1, v1)
SLOTS = [(0.00, 0.00, 0.36, 1.00), (0.36, 0.00, 0.60, 1.00), (0.60, 0.00, 0.78, 1.00),
         (0.78, 0.00, 1.00, 0.25), (0.78, 0.25, 1.00, 0.50), (0.78, 0.50, 1.00, 0.75), (0.78, 0.75, 1.00, 1.00)]

NAVY, IVORY, BROWN, BLACK = '#1f2a44', '#e9e4d6', '#3a2e28', '#141416'
STEEL, LACE = '#8d949b', '#4a2a1a'
LACQUER, GOLD, BRONZE, WHITE = '#1c1714', '#c9a64a', '#a87a43', '#f4f1e8'
METAL_PATTERNS = ('lamellar', 'plate', 'scale', 'ribs', 'mail')

# ---- 옷 틀 ----
# 색 칸 'C1'·'C2' 는 틀의 `colors` 기본값이고, `<id>@<헥스>[,<헥스>]` 로 부르면 그 색으로 바꾼 변형(cf_<id>_<헥스>)을 만든다(세력 색).
GARMENTS = {
    # 도포·심의·한푸 계열 — 선비·책사·임금 평상
    'dopo': dict(desc='교령 넓은 소매 긴 옷(도포·심의·한푸 계열)', tags=['robe', 'historical', 'east'], colors=dict(C1=IVORY, C2=NAVY), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.06), ease=0.022, flare=0.55, folds=0.02, slot=0,
             paint=dict(base='C1', trims=[('bottom', 0.04, 'C2'), ('top', 0.012, 'C2'), ('cross', 'C2')])),
        dict(kind='sleeves', length=1.0, ease=0.028, drop=0.13, cuff=0.035, slot=2,
             paint=dict(base='C1', trims=[('top', 0.05, 'C2')])),
        dict(kind='band', at=('waist', 0.02), width=0.05, over=0.012, slot=3, paint=dict(base=BROWN)),
    ]),
    # 저고리 + 치마 — 여자(조선·고려·삼국 공통 틀, 색은 레시피 tints 로 바꾸지 않고 틀마다 굽는다)
    'hanbok_f': dict(desc='저고리(교령·고름·끝동)와 가슴에서 떨어지는 긴 치마', tags=['hanbok', 'historical', 'east', 'female'],
                     colors=dict(C1='#a8323a', C2='#efd98c'), parts=[
        dict(kind='tube', top=('chest', 0.03), bottom=('ankle', 0.005), ease=0.035, flare=0.6, mono=True, folds=0.05, nfolds=14, slot=0,
             paint=dict(base='C1', pattern='weave')),
        dict(kind='tube', top=('neck', 0), bottom=('chest', -0.035), ease=0.016, over=0.012, slot=1,
             paint=dict(base='C2', trims=[('cross', WHITE, 0.6), ('top', 0.01, WHITE), ('ribbon', 'C1')])),
        dict(kind='sleeves', length=1.0, ease=0.012, drop=0.0, cuff=0.012, slot=2,
             paint=dict(base='C2', trims=[('top', 0.07, '#3c5aa8')])),
    ]),
    # 찰갑 무장 — 붉은 속옷(무릎) + 비늘 가슴갑옷 + 어깨 비늘 + 비늘 치마 + 띠
    'chalgap': dict(desc='찰갑 — 비늘 가슴갑옷·어깨·치마, 붉은 속옷', tags=['armor', 'historical', 'east'], colors=dict(C1='#7a2a24'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('knee', -0.06), ease=0.02, flare=0.15, folds=0.015, slot=0,
             paint=dict(base='C1', trims=[('cross', BLACK), ('top', 0.012, BLACK), ('bottom', 0.03, BLACK)])),
        dict(kind='sleeves', length=1.0, ease=0.02, drop=0.03, cuff=0.01, slot=2,
             paint=dict(base='C1', trims=[('top', 0.06, BLACK)])),
        dict(kind='tube', top=('chest', 0.07), bottom=('hip', -0.03), ease=0.02, over=0.024, slot=1,
             paint=dict(base=STEEL, pattern='lamellar', lace=LACE, trims=[('top', 0.012, LACE), ('bottom', 0.01, LACE)])),
        dict(kind='tube', top=('waist', 0.0), bottom=('knee', 0.04), ease=0.02, over=0.034, flare=0.16, mono=True, slot=5,
             paint=dict(base=STEEL, pattern='lamellar', lace=LACE, trims=[('bottom', 0.015, LACE), ('split', 0.008, BLACK)])),
        dict(kind='sleeves', length=0.36, ease=0.03, over=0.02, flare=0.55, drop=0.0, cuff=0.0, slot=4,
             paint=dict(base=STEEL, pattern='lamellar', lace=LACE, trims=[('top', 0.03, LACE)])),
        dict(kind='band', at=('waist', 0.0), width=0.04, over=0.045, slot=3, paint=dict(base='#2a1c14')),
    ]),
    # 망건 + 상투 + 갓 — 조선 선비 머리(도포와 같이)
    'gat': dict(desc='망건·상투·흑립(갓)', tags=['hat', 'historical', 'east'], parts=[
        dict(kind='mangeon', slot=3, paint=dict(base=BLACK, pattern='mesh')),
        dict(kind='topknot', slot=4, paint=dict(base='#1b1512', pattern='hair')),
        dict(kind='gat', slot=6, paint=dict(base=BLACK, pattern='mesh')),
    ]),
    # 투구 — 둥근 투구 + 비늘 목가리개 + 꼭지
    'helmet_east': dict(desc='둥근 투구·비늘 목가리개·꼭지', tags=['helmet', 'historical', 'east'], parts=[
        dict(kind='helmet', slot=0, paint=dict(base=STEEL, pattern='plate')),
        dict(kind='neckguard', slot=1, paint=dict(base=STEEL, pattern='lamellar', lace=LACE, trims=[('bottom', 0.02, LACE)])),
    ]),
    # ---- 일본 ----
    # 기모노 — 곧은 긴 옷·흰 깃·네모 자루 소매(후리소데 쪽)·넓은 오비·등 매듭
    'kimono': dict(desc='기모노 — 곧은 긴 옷·흰 깃·자루 소매·넓은 오비와 등 매듭', tags=['kimono', 'historical', 'east'],
                   colors=dict(C1='#7a2a4a', C2='#e2b85a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.004), ease=0.014, flare=0.14, folds=0.008, slot=0,
             paint=dict(base='C1', pattern='brocade', motif='C2', trims=[('cross', WHITE, 1.2), ('bottom', 0.012, '#2a1a24')])),
        dict(kind='sleeves', length=1.0, ease=0.016, drop=0.24, bag=True, cuff=0.0, slot=2,
             paint=dict(base='C1', pattern='brocade', motif='C2', trims=[('top', 0.01, '#2a1a24')])),
        dict(kind='band', at=('waist', 0.05), width=0.15, over=0.018, slot=3, paint=dict(base='C2', pattern='brocade', motif='#8a5a2a')),
        dict(kind='band', at=('waist', 0.05), width=0.012, over=0.03, slot=6, paint=dict(base='#c8324a')),   # 오비지메 끈
        dict(kind='bow', at=('waist', 0.07), width=0.28, height=0.16, depth=0.07, over=0.02, slot=4,
             paint=dict(base='C2', pattern='brocade', motif='#8a5a2a')),
    ]),
    # 고소데 + 하카마 — 무사·낭인 평상. 하카마는 주름 잡힌 넓은 치마로 보인다(다리 사이는 치마 도우미)
    'hakama': dict(desc='고소데(짧은 자루 소매)와 주름 하카마·허리끈', tags=['hakama', 'historical', 'east'],
                   colors=dict(C1='#e6dfcc', C2='#2a3450'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.05), ease=0.016, slot=1,
             paint=dict(base='C1', trims=[('cross', 'C2', 1.4)])),
        dict(kind='sleeves', length=1.0, ease=0.01, drop=0.1, bag=True, cuff=0.0, slot=2, paint=dict(base='C1')),
        dict(kind='tube', top=('waist', 0.03), bottom=('ankle', 0.01), ease=0.02, over=0.014, flare=0.25, folds=0.035, nfolds=16, slot=0,
             paint=dict(base='C2', pattern='stripes')),
        dict(kind='band', at=('waist', 0.03), width=0.05, over=0.03, slot=3, paint=dict(base='C2', pattern='weave')),
    ]),
    # 구소쿠 — 옻칠 판을 색 끈으로 엮은(오도시) 동·쿠사즈리·소데 + 히타타레·정강이 가리개
    'gusoku': dict(desc='구소쿠 — 오도시 동·쿠사즈리·큰 소데·정강이 가리개, 히타타레', tags=['armor', 'samurai', 'historical', 'east'],
                   colors=dict(C1='#a8322a', C2='#2a2622'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('knee', -0.04), ease=0.02, flare=0.35, folds=0.02, slot=0,
             paint=dict(base='C2', trims=[('cross', WHITE, 0.8)])),
        dict(kind='sleeves', length=1.0, ease=0.014, drop=0.02, cuff=0.0, slot=2, paint=dict(base='C2', pattern='quilt')),
        dict(kind='tube', top=('chest', 0.15), bottom=('waist', -0.03), ease=0.02, over=0.026, slot=1,
             paint=dict(base=LACQUER, pattern='odoshi', lace='C1', rows=9, trims=[('top', 0.012, LACQUER)])),
        dict(kind='tube', top=('waist', -0.02), bottom=('knee', 0.07), ease=0.02, over=0.036, flare=0.45, mono=True, slot=5,
             paint=dict(base=LACQUER, pattern='odoshi', lace='C1', rows=5, trims=[('panels', 7, 0.012, BLACK)])),
        dict(kind='sleeves', length=0.44, ease=0.03, over=0.04, flare=0.18, arc=150, cuff=0.0, slot=4,
             paint=dict(base=LACQUER, pattern='odoshi', lace='C1', rows=6)),
        dict(kind='leggings', top=('knee', 0.03), bottom=('ankle', 0.03), ease=0.012, flare=0.12, slot=3,
             paint=dict(base=LACQUER, pattern='ribs', ribs=10, trims=[('top', 0.01, 'C1'), ('bottom', 0.01, 'C1')])),
        dict(kind='band', at=('waist', -0.025), width=0.035, over=0.05, slot=6, paint=dict(base='C1')),
    ]),
    # 가부토 — 골 진 사발·앞챙·넓게 벌어진 시코로·금빛 쿠와가타
    'kabuto': dict(desc='가부토 — 골 진 사발·앞챙·벌어진 시코로·쿠와가타', tags=['helmet', 'samurai', 'historical', 'east'],
                   colors=dict(C1='#a8322a'), parts=[
        dict(kind='helmet', ease=0.024, knob=False, dome=0.04, visor=0.035, slot=0, paint=dict(base=LACQUER, pattern='ribs', ribs=32)),
        dict(kind='neckguard', drop=0.12, flare=0.6, open=70, slot=1, paint=dict(base=LACQUER, pattern='odoshi', lace='C1', rows=4)),
        dict(kind='kuwagata', slot=3, paint=dict(base=GOLD, pattern='plate')),
    ]),
    # ---- 삼국 ----
    # 장수 갑옷 — 발목 전포 위 어린갑 가슴·어깨·치마 + 가슴 호심경 둘
    'samguk_armor': dict(desc='삼국 장수 — 발목 전포 위 어린갑(물고기 비늘)·어깨·치마·호심경 둘', tags=['armor', 'general', 'historical', 'east'],
                         colors=dict(C1='#2f4a7a', C2=STEEL), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.07), ease=0.022, flare=0.5, folds=0.022, slot=0,
             paint=dict(base='C1', trims=[('cross', GOLD, 0.8), ('bottom', 0.012, GOLD)])),
        dict(kind='sleeves', length=1.0, ease=0.024, drop=0.06, cuff=0.02, slot=2, paint=dict(base='C1', trims=[('top', 0.04, GOLD)])),
        dict(kind='tube', top=('chest', 0.08), bottom=('hip', -0.04), ease=0.02, over=0.024, slot=1,
             paint=dict(base='C2', pattern='scale', trims=[('top', 0.014, LACE), ('bottom', 0.012, LACE)])),
        dict(kind='tube', top=('waist', 0.0), bottom=('knee', 0.02), ease=0.02, over=0.036, flare=0.4, mono=True, slot=5,
             paint=dict(base='C2', pattern='scale', trims=[('bottom', 0.016, LACE), ('split', 0.008, BLACK)])),
        dict(kind='sleeves', length=0.36, ease=0.03, over=0.024, flare=0.55, drop=0.0, cuff=0.0, slot=4,
             paint=dict(base='C2', pattern='scale', trims=[('top', 0.03, LACE)])),
        dict(kind='discs', at=('chest', -0.03), spread=24, radius=0.058, over=0.006, slot=6,
             paint=dict(base='#b4bbc2', pattern='plate', trims=[('top', 0.03, GOLD)])),
        dict(kind='band', at=('waist', 0.0), width=0.05, over=0.047, slot=3, paint=dict(base='#2a1c14', trims=[('top', 0.006, GOLD)])),
    ]),
    # 장수 투구 — 둥근 투구·비늘 목가리개·붉은 술
    'helmet_general': dict(desc='장수 투구 — 둥근 투구·목가리개·붉은 술', tags=['helmet', 'general', 'historical', 'east'],
                           colors=dict(C1='#b0282a', C2=STEEL), parts=[
        dict(kind='helmet', ease=0.022, knob=False, dome=0.045, visor=0.02, slot=0, paint=dict(base='C2', pattern='plate')),
        dict(kind='neckguard', drop=0.12, flare=0.5, slot=1, paint=dict(base='C2', pattern='scale', trims=[('bottom', 0.02, LACE)])),
        dict(kind='tassel', slot=4, paint=dict(base='C1', pattern='hair')),
    ]),
    # ---- 관복 ----
    # 단령 — 둥근 깃 관복·가슴과 등 흉배·각대
    'dallyeong': dict(desc='단령 — 둥근 깃 관복·흉배·각대', tags=['robe', 'official', 'historical', 'east'],
                      colors=dict(C1='#8a2a2a', C2='#2a3a6a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.03), ease=0.024, flare=0.5, folds=0.02, slot=0,
             paint=dict(base='C1', trims=[('top', 0.005, '#1a1414'), ('patch', 'C2', GOLD, 0.66, 0.83)])),
        dict(kind='sleeves', length=1.0, ease=0.026, drop=0.12, cuff=0.03, slot=2, paint=dict(base='C1')),
        dict(kind='band', at=('waist', 0.02), width=0.035, over=0.045, slot=3, paint=dict(base='#3a1a14', pattern='studs', motif=GOLD)),
    ]),
    # 사모 — 둥근 두 층 검은 모자·뒤 양옆 둥근 날개(조선 관리)
    'samo': dict(desc='사모 — 두 층 검은 모자·뒤 양옆 둥근 날개', tags=['hat', 'official', 'historical', 'east'], parts=[
        dict(kind='samo', slot=6, paint=dict(base=BLACK, pattern='mesh')),
    ]),
    # 곤룡포 — 둥근 깃 임금 옷·가슴·등·두 어깨 둥근 금빛 흉배(보)·옥대
    'gonryongpo': dict(desc='곤룡포 — 둥근 깃·가슴 등 어깨 둥근 금빛 보·옥대', tags=['robe', 'royal', 'historical', 'east'],
                       colors=dict(C1='#a8282a', C2=GOLD), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.02), ease=0.026, flare=0.6, folds=0.02, slot=0,
             paint=dict(base='C1', trims=[('top', 0.005, '#1a1414'), ('roundel', 'C2', 0.75)])),
        dict(kind='sleeves', length=1.0, ease=0.026, drop=0.12, cuff=0.03, slot=2, paint=dict(base='C1')),
        dict(kind='band', at=('waist', 0.02), width=0.04, over=0.05, slot=3, paint=dict(base='#1f2a44', pattern='studs', motif='#cfe3d0')),
    ]),
    # 익선관 — 사모 꼴에 뒤 날개 둘이 위로 선 임금 모자
    'ikseongwan': dict(desc='익선관 — 두 층 검은 모자·뒤에서 위로 선 날개 둘', tags=['hat', 'royal', 'historical', 'east'], parts=[
        dict(kind='samo', wing=(0.05, 0.03), tilt=62, slot=6, paint=dict(base='#1a1614', pattern='mesh')),
    ]),
    # 면류관 — 모자 위 앞뒤로 긴 판·앞뒤 끝에서 늘어진 구슬 줄
    'myeollyugwan': dict(desc='면류관 — 검은 관·위 긴 판·앞뒤 구슬 줄', tags=['hat', 'royal', 'historical', 'east'], parts=[
        dict(kind='myeollyu', slot=6, paint=dict(base=BLACK, pattern='weave', trims=[('top', 0.01, GOLD)])),
        dict(kind='beads', slot=4, paint=dict(base='#d8b04a', pattern='beads', motif='#b0282a')),
    ]),
    # 에보시 — 이마에서 높이 솟아 뒤로 기운 검은 옻칠 관(일본 귀족·무가)
    'eboshi': dict(desc='에보시 — 높이 솟아 뒤로 기운 검은 관', tags=['hat', 'historical', 'east'], parts=[
        dict(kind='eboshi', slot=6, paint=dict(base='#141214', pattern='weave')),
    ]),
    # ---- 서쪽·세계 ----
    # 토가 — 발목 긴 옷 + 왼어깨에서 오른허리로 두른 넓은 띠(원로원 자줏빛 단)
    'toga': dict(desc='토가 — 발목 흰 옷·짧은 소매·왼어깨에서 비스듬히 두른 띠', tags=['toga', 'historical', 'west'],
                 colors=dict(C1='#e6e0d0', C2='#5a2a6a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.04), ease=0.02, flare=0.4, folds=0.03, nfolds=13, slot=0,
             paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.01, 'C2')])),
        dict(kind='sleeves', length=0.32, ease=0.02, drop=0.0, cuff=0.0, slot=2, paint=dict(base='C1', pattern='weave')),
        dict(kind='sash', top=('shoulder', 0.02), bottom=('hip', -0.06), width=0.2, over=0.02, slot=1,
             paint=dict(base='C1', pattern='weave', trims=[('top', 0.012, 'C2'), ('bottom', 0.012, 'C2')])),
    ]),
    # 키톤 흉갑 — 허벅지 키톤·청동 흉갑·가죽 띠 치마(프테루게스)·청동 정강이
    'chiton_armor': dict(desc='그리스 보병 — 붉은 키톤·청동 흉갑·가죽 띠 치마·정강이 가리개', tags=['armor', 'historical', 'west'],
                         colors=dict(C1='#8a2a24', C2=BRONZE), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('crotch', -0.14), ease=0.018, flare=0.25, folds=0.02, slot=0, paint=dict(base='C1')),
        dict(kind='sleeves', length=0.26, ease=0.02, cuff=0.0, slot=2, paint=dict(base='C1')),
        dict(kind='tube', top=('shoulder', -0.05), bottom=('waist', -0.03), ease=0.018, over=0.024, slot=1,
             paint=dict(base='C2', pattern='plate', trims=[('top', 0.012, '#6a4a2a'), ('bottom', 0.012, '#6a4a2a')])),
        dict(kind='tube', top=('waist', -0.02), bottom=('crotch', -0.1), ease=0.02, over=0.036, flare=0.15, mono=True, slot=5,
             paint=dict(base='#6a4a2a', pattern='weave', trims=[('panels', 16, 0.1, '#2a1c14'), ('bottom', 0.02, 'C2')])),
        dict(kind='leggings', top=('knee', 0.05), bottom=('ankle', 0.04), ease=0.01, flare=0.1, slot=3, paint=dict(base='C2', pattern='plate')),
        dict(kind='band', at=('waist', -0.025), width=0.03, over=0.05, slot=6, paint=dict(base='#2a1c14')),
    ]),
    # 델 — 오른쪽으로 여미는 유목 긴 옷·좁은 긴 소매·넓은 허리띠
    'deel': dict(desc='델 — 비스듬히 여민 유목 긴 옷·좁은 소매·넓은 띠', tags=['robe', 'nomad', 'historical'],
                 colors=dict(C1='#3a5a8a', C2='#c9a64a', C3='#b0282a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.12), ease=0.024, flare=0.35, folds=0.02, slot=0,
             paint=dict(base='C1', pattern='brocade', motif='C1',
                        trims=[('cross', 'C2', 1.1), ('top', 0.012, 'C2'), ('bottom', 0.02, 'C2')])),
        dict(kind='sleeves', length=1.06, ease=0.012, drop=0.0, cuff=0.02, slot=2, paint=dict(base='C1', trims=[('top', 0.05, 'C2')])),
        dict(kind='band', at=('waist', 0.0), width=0.09, over=0.03, slot=3, paint=dict(base='C3', pattern='weave')),
    ]),
    # 장교 외투 — 무릎 외투·선 깃·단추 두 줄·금빛 견장·허리 띠 + 흰 바지(장화는 CC0)
    'officer_coat': dict(desc='장교 외투 — 무릎 외투·단추 두 줄·견장·허리띠·흰 바지', tags=['uniform', 'modern', 'west'],
                         colors=dict(C1='#2a3450', C2=GOLD, C3='#f0ece0'), parts=[
        dict(kind='leggings', top=('crotch', 0.0), bottom=('ankle', 0.02), ease=0.012, slot=3, paint=dict(base='C3', pattern='weave')),
        dict(kind='tube', top=('neck', 0), bottom=('knee', 0.03), ease=0.018, over=0.004, flare=0.18, slot=0,
             paint=dict(base='C1', pattern='weave', trims=[('top', 0.012, 'C2'), ('bottom', 0.008, 'C2'), ('buttons', 'C2', 0.52, 0.9)])),
        dict(kind='sleeves', length=1.0, ease=0.014, drop=0.0, cuff=0.02, slot=2, paint=dict(base='C1', trims=[('top', 0.05, 'C2')])),
        dict(kind='sleeves', length=0.14, ease=0.03, over=0.018, flare=0.7, arc=140, cuff=0.0, slot=4, paint=dict(base='C2', pattern='studs', motif='#f4e2a0')),
        dict(kind='band', at=('waist', 0.0), width=0.05, over=0.02, slot=6, paint=dict(base='#e8e2d0')),
    ]),
    # 드레스 — 몸에 붙는 윗몸·부푼 짧은 소매·허리에서 크게 퍼지는 금란 치마
    'gown': dict(desc='드레스 — 윗몸·부푼 소매·허리에서 퍼지는 금란 치마', tags=['dress', 'royal', 'historical', 'west', 'female'],
                 colors=dict(C1='#6a2a3a', C2='#e2c070'), parts=[
        dict(kind='tube', top=('waist', 0.02), bottom=('ankle', -0.02), ease=0.03, flare=1.3, mono=True, folds=0.05, nfolds=11, slot=0,
             paint=dict(base='C1', pattern='brocade', motif='C2', per=(22, 90), trims=[('bottom', 0.02, 'C2')])),
        dict(kind='tube', top=('neck', 0), bottom=('waist', -0.01), ease=0.012, over=0.01, slot=1,
             paint=dict(base='C1', trims=[('top', 0.02, 'C2'), ('front', 0.03, 'C2')])),
        dict(kind='sleeves', length=0.62, ease=0.03, drop=0.02, flare=0.35, cuff=0.02, slot=2, paint=dict(base='C1', trims=[('top', 0.03, 'C2')])),
        dict(kind='band', at=('waist', 0.02), width=0.03, over=0.03, slot=3, paint=dict(base='C2')),
    ]),
    # 카프탄 — 앞 가운데 띠가 긴 서역·세계 긴 옷·넓은 소매·허리띠
    'kaftan': dict(desc='카프탄 — 앞 가운데 띠 긴 옷·넓은 소매·허리 띠', tags=['robe', 'historical', 'world'],
                   colors=dict(C1='#2a6a4a', C2=GOLD), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', 0.03), ease=0.024, flare=0.45, folds=0.02, slot=0,
             paint=dict(base='C1', pattern='brocade', motif='C1', trims=[('front', 0.03, 'C2'), ('bottom', 0.015, 'C2'), ('top', 0.012, 'C2')])),
        dict(kind='sleeves', length=1.0, ease=0.024, drop=0.09, cuff=0.02, slot=2, paint=dict(base='C1', trims=[('top', 0.05, 'C2')])),
        dict(kind='band', at=('waist', 0.02), width=0.07, over=0.03, slot=3, paint=dict(base='C2', pattern='weave')),
    ]),
    # 바지저고리 — 엉덩이까지 저고리(고름)·통 넓은 바지·발목 대님
    'baji_jeogori': dict(desc='바지저고리 — 저고리·통 넓은 바지·대님', tags=['hanbok', 'historical', 'east'],
                         colors=dict(C1='#e6dfcc', C2='#6b5a48'), parts=[
        dict(kind='tube', top=('waist', 0.03), bottom=('crotch', 0.0), ease=0.02, slot=0, paint=dict(base='C2', pattern='weave')),
        dict(kind='leggings', top=('crotch', 0.01), bottom=('ankle', 0.03), ease=0.022, ease_bottom=0.008, smooth=6, wmin=0.15, tuck=(2, 0.004), round_bottom=0.6, slot=5, paint=dict(base='C2', pattern='weave',
             trims=[('bottom', 0.012, '#2a2a2a')])),
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.04), ease=0.012, over=0.01, slot=1,
             paint=dict(base='C1', trims=[('cross', WHITE, 0.7), ('ribbon', 'C2')])),
        dict(kind='sleeves', length=1.0, ease=0.01, drop=0.02, cuff=0.01, slot=2, paint=dict(base='C1')),
    ]),
    # 터번 — 이마 위로 두툼하게 감아 올린 천
    'turban': dict(desc='터번 — 두툼하게 감은 천', tags=['hat', 'historical', 'world'], colors=dict(C1='#e6e0d0'), parts=[
        dict(kind='turban', slot=6, paint=dict(base='C1', pattern='wrap')),
    ]),
    # 사슬 갑옷 + 겉옷 — 무릎 사슬 옷·사슬 소매 위 민소매 겉옷(서양 기사)
    'hauberk': dict(desc='사슬 갑옷·민소매 겉옷·허리띠(서양 기사)', tags=['armor', 'historical', 'west'],
                    colors=dict(C1='#e8e2d0', C2='#2a3a7a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('knee', -0.03), ease=0.018, flare=0.3, folds=0.015, slot=0, paint=dict(base='#8d949b', pattern='mail')),
        dict(kind='sleeves', length=1.0, ease=0.012, cuff=0.0, slot=2, paint=dict(base='#8d949b', pattern='mail')),
        dict(kind='tube', top=('neck', 0), bottom=('knee', 0.02), ease=0.02, over=0.014, flare=0.35, folds=0.02, slot=1,
             paint=dict(base='C1', pattern='weave', trims=[('front', 0.035, 'C2'), ('patch', 'C2', 'C2', 0.72, 0.84), ('bottom', 0.012, 'C2')])),
        dict(kind='band', at=('waist', 0.0), width=0.035, over=0.04, slot=3, paint=dict(base='#3a2a1e', pattern='studs', motif='#c0c4c8')),
        dict(kind='leggings', top=('knee', 0.06), bottom=('ankle', 0.02), ease=0.01, slot=5, paint=dict(base='#8d949b', pattern='mail')),
    ]),
    # 가죽 조끼 무사복 — 무릎 전포·좁은 소매·누빈 가죽 조끼·각반(동쪽 가죽 무장)
    'warrior_robe': dict(desc='무사복 — 무릎 전포·가죽 조끼·각반', tags=['armor', 'historical', 'east'],
                         colors=dict(C1='#8a2f2a', C2='#4a3526'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('knee', -0.02), ease=0.02, flare=0.3, folds=0.02, slot=0,
             paint=dict(base='C1', trims=[('cross', '#2a2a2a', 0.9), ('bottom', 0.012, '#2a2a2a')])),
        dict(kind='sleeves', length=1.0, ease=0.012, cuff=0.0, slot=2, paint=dict(base='C1', trims=[('top', 0.08, 'C2')])),
        dict(kind='tube', top=('chest', 0.12), bottom=('hip', -0.03), ease=0.02, over=0.02, slot=1,
             paint=dict(base='C2', pattern='quilt', trims=[('top', 0.01, '#2a1c14'), ('bottom', 0.01, '#2a1c14')])),
        dict(kind='leggings', top=('knee', 0.02), bottom=('ankle', 0.03), ease=0.012, slot=5, paint=dict(base='#d8d0bc', pattern='wrap')),
        dict(kind='band', at=('waist', 0.0), width=0.05, over=0.04, slot=3, paint=dict(base='#1f1a16')),
    ]),
    # 닌자복 — 몸에 붙는 윗옷·좁은 바지·정강이 감발·허리띠
    'shinobi': dict(desc='닌자복 — 붙는 윗옷·좁은 바지·감발·띠', tags=['ninja', 'historical', 'east'],
                    colors=dict(C1='#1e1e24', C2='#3a3a44'), parts=[
        dict(kind='tube', top=('waist', 0.02), bottom=('crotch', 0.0), ease=0.02, slot=0, paint=dict(base='C1', pattern='weave')),
        dict(kind='leggings', top=('crotch', 0.01), bottom=('knee', -0.02), ease=0.018, slot=5, paint=dict(base='C1', pattern='weave')),
        dict(kind='leggings', top=('knee', 0.0), bottom=('ankle', 0.02), ease=0.01, slot=4, paint=dict(base='C2', pattern='wrap')),
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.05), ease=0.014, over=0.012, slot=1, paint=dict(base='C1', pattern='weave',
             trims=[('cross', 'C2', 0.9)])),
        dict(kind='sleeves', length=1.0, ease=0.01, cuff=0.0, slot=2, paint=dict(base='C1', pattern='weave')),
        dict(kind='band', at=('waist', 0.02), width=0.05, over=0.03, slot=3, paint=dict(base='C2')),
    ]),
    # 복두 — 네모진 두 층 모자·뒤 양옆 긴 곧은 날개(당·송·고려 관리)
    'boktu': dict(desc='복두 — 네모진 두 층 모자·양옆 긴 곧은 날개', tags=['hat', 'official', 'historical', 'east'], parts=[
        dict(kind='boktu', slot=6, paint=dict(base=BLACK, pattern='weave')),
    ]),
    # ---- 09-26 셋째: 껍데기 남은 넷·맨머리 동쪽 남자 ----
    # 배자 바지저고리 — 바지저고리 위 엉덩이 길이 민소매 배자(앞 여밈 단) — 바지저고리(robe_short)와 가르는 덧옷
    'baeja': dict(desc='배자 바지저고리 — 저고리·통 넓은 바지 위 민소매 배자', tags=['hanbok', 'historical', 'east'],
                  colors=dict(C1='#3a4a6a', C2='#6b5a48'), parts=[
        dict(kind='tube', top=('waist', 0.03), bottom=('crotch', 0.0), ease=0.03, slot=0, paint=dict(base='C2', pattern='weave')),
        dict(kind='leggings', top=('crotch', 0.01), bottom=('ankle', 0.03), ease=0.045, flare=-0.25, slot=5, paint=dict(base='C2', pattern='weave',
             trims=[('bottom', 0.012, '#2a2a2a')])),
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.04), ease=0.018, over=0.014, slot=1,
             paint=dict(base='#e6dfcc', trims=[('cross', WHITE, 0.7)])),
        dict(kind='sleeves', length=1.0, ease=0.016, drop=0.03, cuff=0.01, slot=2, paint=dict(base='#e6dfcc')),
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.07), ease=0.02, over=0.03, slot=6,
             paint=dict(base='C1', pattern='quilt', trims=[('front', 0.03, '#e9e4d6'), ('top', 0.014, '#e9e4d6'), ('bottom', 0.012, '#e9e4d6')])),
    ]),
    # 가미시모 — 고소데 위 어깨가 옆으로 뻗은 견의(가타기누)와 같은 빛 하카마(에도 무가 예복)
    'kamishimo': dict(desc='가미시모 — 어깨 날개 견의와 같은 빛 하카마, 고소데', tags=['hakama', 'historical', 'east'],
                      colors=dict(C1='#2a3450', C2='#d8d2c0'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.05), ease=0.016, slot=1, paint=dict(base='C2', trims=[('cross', WHITE, 1.2)])),
        dict(kind='sleeves', length=1.0, ease=0.01, drop=0.1, bag=True, cuff=0.0, slot=2, paint=dict(base='C2')),
        dict(kind='tube', top=('waist', 0.03), bottom=('ankle', 0.01), ease=0.02, over=0.014, flare=0.25, folds=0.035, nfolds=16, slot=0,
             paint=dict(base='C1', pattern='stripes')),
        dict(kind='tube', top=('neck', 0), bottom=('waist', 0.02), ease=0.016, over=0.03, slot=5,
             paint=dict(base='C1', pattern='weave', trims=[('cross', 'C2', 1.6), ('top', 0.01, 'C2')])),
        dict(kind='sleeves', length=0.2, ease=0.035, over=0.035, flare=1.1, arc=170, drop=0.0, cuff=0.0, slot=4, paint=dict(base='C1', pattern='weave')),
        dict(kind='band', at=('waist', 0.03), width=0.045, over=0.036, slot=3, paint=dict(base='C1', pattern='weave')),
    ]),
    # 더블릿 — 허벅지 윗옷(앞 여밈·흰 깃·흰 끝동)·부푼 어깨 소매·허리띠·붙는 긴 양말바지(서유럽 르네상스 장인)
    'doublet': dict(desc='더블릿 — 허벅지 윗옷·부푼 어깨 소매·흰 깃·긴 양말바지', tags=['doublet', 'historical', 'west'],
                    colors=dict(C1='#5a3a2a', C2='#3a3a44'), parts=[
        dict(kind='leggings', top=('crotch', 0.0), bottom=('ankle', 0.02), ease=0.008, slot=5, paint=dict(base='C2', pattern='weave')),
        dict(kind='tube', top=('neck', 0), bottom=('crotch', -0.1), ease=0.016, flare=0.22, folds=0.012, slot=0,
             paint=dict(base='C1', pattern='weave', trims=[('front', 0.018, '#2a1c14'), ('top', 0.014, '#e9e4d6'), ('bottom', 0.012, '#2a1c14')])),
        dict(kind='sleeves', length=1.0, ease=0.012, drop=0.0, cuff=0.015, slot=2, paint=dict(base='C1', pattern='weave', trims=[('top', 0.025, '#e9e4d6')])),
        dict(kind='sleeves', length=0.3, ease=0.035, over=0.015, flare=0.25, drop=0.0, cuff=0.0, slot=4,
             paint=dict(base='C1', pattern='quilt', trims=[('top', 0.012, '#2a1c14')])),
        dict(kind='band', at=('waist', 0.0), width=0.03, over=0.02, slot=3, paint=dict(base='#2a1c14')),
    ]),
    # 카바 — 무릎 길이 비스듬히 여민 겉옷·끝동·허리 띠 + 헐렁한 바지(서역·페르시아 학자·의원)
    'qaba': dict(desc='카바 — 무릎 겉옷·비스듬한 여밈·허리 띠·헐렁한 바지', tags=['robe', 'historical', 'world'],
                 colors=dict(C1='#3a5a6a', C2=GOLD), parts=[
        # 바지는 자락 속 — 여유 4cm 면 허벅지에서 자락(2cm)을 뚫고 상아색 얼룩으로 보였다(09-26 렌더). 자락은 바지 위에 over 로 겹친다
        dict(kind='leggings', top=('crotch', 0.01), bottom=('ankle', 0.03), ease=0.022, flare=-0.1, slot=5, paint=dict(base='#e6dfcc', pattern='weave')),
        dict(kind='tube', top=('neck', 0), bottom=('knee', 0.02), ease=0.02, over=0.02, flare=0.3, folds=0.02, slot=0,
             paint=dict(base='C1', pattern='weave', trims=[('cross', 'C2', 1.0), ('top', 0.012, 'C2'), ('bottom', 0.015, 'C2')])),
        dict(kind='sleeves', length=1.0, ease=0.016, drop=0.03, cuff=0.015, slot=2, paint=dict(base='C1', pattern='weave', trims=[('top', 0.04, 'C2')])),
        dict(kind='band', at=('waist', 0.02), width=0.06, over=0.03, slot=3, paint=dict(base='C2', pattern='weave')),
    ]),
    # ---- 맨몸 위 아랫도리(단계 3 비교 짝 09-27) ----
    # 바지만 — 맨상체 잡졸·장사. 바지저고리 아랫도리 + 넓은 허리 천
    'baji': dict(desc='통 넓은 바지·대님·허리 천(맨상체)', tags=['pants', 'historical', 'east'],
                 colors=dict(C1=NAVY, C2='#9a1f1a'), parts=[
        dict(kind='tube', top=('waist', 0.03), bottom=('crotch', 0.0), ease=0.02, slot=0, paint=dict(base='C1', pattern='weave')),
        dict(kind='leggings', top=('crotch', 0.01), bottom=('ankle', 0.03), ease=0.022, ease_bottom=0.008, smooth=6, wmin=0.15, tuck=(2, 0.004), round_bottom=0.6, slot=5, paint=dict(base='C1', pattern='weave',
             trims=[('bottom', 0.012, '#2a2a2a')])),
        dict(kind='band', at=('waist', 0.03), width=0.065, over=0.012, slot=3, paint=dict(base='C2', pattern='weave')),   # 바지 윗단을 덮는다(맨살 위라 단이 턱으로 보였다)
    ]),
    # 바지 + 맨팔 가죽 조끼 — 도적 두목. 조끼는 배자 틀(민소매)을 저고리 없이 살 위에
    'baji_vest': dict(desc='통 넓은 바지·맨팔 위 누빈 가죽 조끼·허리 천', tags=['pants', 'armor', 'historical', 'east'],
                      colors=dict(C1='#5a4a36', C2='#4a3322', C3='#c9a227'), parts=[
        dict(kind='tube', top=('waist', 0.03), bottom=('crotch', 0.0), ease=0.02, slot=0, paint=dict(base='C1', pattern='weave')),
        dict(kind='leggings', top=('crotch', 0.01), bottom=('ankle', 0.03), ease=0.022, ease_bottom=0.008, smooth=6, wmin=0.15, tuck=(2, 0.004), round_bottom=0.6, slot=5, paint=dict(base='C1', pattern='weave',
             trims=[('bottom', 0.012, '#2a2a2a')])),
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.06), ease=0.016, over=0.012, slot=1,
             paint=dict(base='C2', pattern='quilt', trims=[('front', 0.03, '#2a1c14'), ('top', 0.012, '#2a1c14'), ('bottom', 0.012, '#2a1c14')])),
        dict(kind='band', at=('waist', 0.03), width=0.065, over=0.014, slot=3, paint=dict(base='C3', pattern='weave')),
    ]),
    # 둥근 쇠 투구 + 사슬 목가리개 — 서양 파수병·순례 기사(얼굴 트임)
    'helmet_round': dict(desc='둥근 쇠 투구·사슬 목가리개', tags=['helmet', 'historical', 'west'], colors=dict(C1=STEEL), parts=[
        dict(kind='helmet', ease=0.02, knob=False, dome=0.03, slot=0, paint=dict(base='C1', pattern='plate')),
        dict(kind='neckguard', drop=0.15, flare=0.45, open=60, slot=1, paint=dict(base='C1', pattern='mail')),
    ]),
    # ---- 맨몸 괴물 쇠붙이(남은 껍데기 17, 09-27) ----
    # 쇠 가슴판·어깨판 — 맨몸 괴물 두목(가슴·어깨만)
    'breastplate': dict(desc='쇠 가슴판·어깨판(맨몸 위)', tags=['armor', 'monster'], colors=dict(C1='#6b5646', C2='#3a2a1e'), parts=[
        dict(kind='tube', top=('shoulder', -0.05), bottom=('waist', -0.03), ease=0.02, slot=0,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.014, 'C2'), ('bottom', 0.014, 'C2')])),
        dict(kind='sleeves', length=0.32, ease=0.03, over=0.02, flare=0.5, arc=200, cuff=0.0, slot=4,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.02, 'C2')])),
    ]),
    # 어깨판·팔 가리개·정강이 가리개 — 맨몸 괴물(허리 천은 kitbash loincloth)
    'guards': dict(desc='쇠 어깨판·팔 가리개·정강이 가리개(맨몸 위)', tags=['armor', 'monster'], colors=dict(C1='#2f3034', C2='#141416'), parts=[
        dict(kind='sleeves', length=0.32, ease=0.03, over=0.02, flare=0.5, arc=200, cuff=0.0, slot=4,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.02, 'C2')])),
        dict(kind='sleeves', start=0.6, length=0.96, ease=0.016, flare=0.12, cuff=0.0, slot=2,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.012, 'C2')])),
        dict(kind='leggings', top=('knee', -0.02), bottom=('ankle', 0.04), ease=0.014, flare=0.1, slot=5,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.015, 'C2')])),
    ]),
    # ---- 몸에 붙는 옷 위에 얹는 판(09-27 빈칸 채우기 — tube arc) ----
    # 누빈 가죽 조끼 — 몸에 붙는 옷 위(fit: 오목한 곳을 안 메워 통으로 안 부푼다)
    'vest': dict(desc='누빈 가죽 조끼(붙는 옷 위)', tags=['vest', 'historical'], colors=dict(C1='#6a4a2e', C2='#2a1c14'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.03), ease=0.008, over=0.012, fit=True, slot=0,
             paint=dict(base='C1', pattern='quilt', trims=[('front', 0.02, 'C2'), ('top', 0.012, 'C2'), ('bottom', 0.012, 'C2')])),
    ]),
    # 방탄 조끼 — 두꺼운 재킷·셔츠 위(넉넉한 볼록 둘레 — 붙는 vest 는 재킷 속으로 들어가 등에 재킷이 얼룩처럼 비쳤다, 09-27)
    'tacvest': dict(desc='방탄 조끼(재킷 위)', tags=['vest', 'modern'], colors=dict(C1='#15171a', C2='#0a0b0c'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('hip', -0.02), ease=0.022, over=0.016, slot=0,
             paint=dict(base='C1', pattern='quilt', trims=[('front', 0.018, 'C2'), ('top', 0.02, 'C2'), ('bottom', 0.03, 'C2')])),
    ]),
    # 쇠 가슴판 — 몸에 붙는 옷 위(fit)
    'cuirass': dict(desc='쇠 가슴판(붙는 옷 위)', tags=['armor'], colors=dict(C1='#b08a3a', C2='#3a2e1a'), parts=[
        dict(kind='tube', top=('shoulder', -0.05), bottom=('waist', -0.02), ease=0.01, over=0.012, fit=True, slot=0,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.012, 'C2'), ('bottom', 0.012, 'C2')])),
    ]),
    # 목폴라 — 겉옷 깃 위로 턱 밑까지 올라오는 골진 목 깃(collar). 몸통은 겉옷이 덮는다
    'turtleneck': dict(desc='목폴라 — 턱 밑까지 올라오는 골진 목 깃(겉옷 밑)', tags=['sweater', 'modern'], colors=dict(C1='#18181b'), parts=[
        dict(kind='collar', bottom=-0.03, height=0.075, ease=0.01, slot=0, paint=dict(base='C1', pattern='knit')),
    ]),
    # 겉옷판(서코트) — 목부터 가슴까지 닫힌 요크 + 가슴 아래 앞·뒤로 갈라져 무릎까지 늘어진 판 + 허리띠.
    # 어깨에서 시작하는 앞판(tube arc 만)은 앞치마로 보였다(09-27) — 어깨를 덮는 요크가 겉옷판으로 읽히게 한다
    'tabard': dict(desc='겉옷판 — 어깨 요크·앞뒤로 갈라진 판·허리띠(붙는 옷 위)', tags=['tabard', 'historical'],
                   colors=dict(C1='#e6dcc4', C2='#8a6a2a'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('chest', -0.06), ease=0.01, over=0.018, slot=1,
             paint=dict(base='C1', pattern='weave', trims=[('top', 0.03, 'C2'), ('bottom', 0.02, 'C2')])),
        dict(kind='tube', top=('chest', -0.03), bottom=('knee', 0.02), ease=0.008, over=0.012, flare=0.08, folds=0.015,
             arc=(270, 120), slot=0, paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.02, 'C2'), ('front', 0.012, 'C2')])),
        dict(kind='tube', top=('chest', -0.03), bottom=('knee', 0.02), ease=0.008, over=0.012, flare=0.08, folds=0.015,
             arc=(90, 120), slot=5, paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.02, 'C2')])),
        dict(kind='band', at=('waist', -0.02), width=0.035, ease=0.027, slot=3, paint=dict(base='#3a2616', pattern='weave')),
    ]),
    # 등 짐 — 둥근 모서리 상자 + 어깨끈(배낭). 살 껍데기 배낭은 등 굴곡을 따라 구겨진 판이었다(09-27)
    'backpack': dict(desc='배낭 — 둥근 모서리 천 상자·덮개·어깨끈', tags=['bag', 'modern'], colors=dict(C1='#3d3324', C2='#2a2218'), parts=[
        dict(kind='backpack', top=('shoulder', -0.05), bottom=('waist', 0.02), width=0.29, depth=0.13, strap=0.04, slot=0, strap_slot=3,
             paint=dict(base='C1', pattern='weave', strap='C2', trims=[('top', 0.3, 'C2'), ('bottom', 0.04, 'C2')])),
    ]),
    # 큰 등 짐 — 고물 행상(어깨 위로 솟고 엉덩이까지)
    'pack_big': dict(desc='큰 등 짐 — 어깨 위로 솟은 천 상자·어깨끈', tags=['bag', 'modern'], colors=dict(C1='#6a5238', C2='#3a2a1a'), parts=[
        dict(kind='backpack', top=('shoulder', 0.08), bottom=('hip', -0.02), width=0.36, depth=0.2, strap=0.045, slot=0, strap_slot=3,
             paint=dict(base='C1', pattern='weave', strap='C2', trims=[('top', 0.18, 'C2'), ('bottom', 0.03, 'C2')])),
    ]),
    # 쇠 등 짐 — 탐사 대원·시간 행상·불시착 탐사원(판 상자·끈)
    'pack_metal': dict(desc='쇠 등 짐 — 판 상자·어깨끈', tags=['bag', 'future'], colors=dict(C1='#5d646b', C2='#2a2c30'), parts=[
        dict(kind='backpack', top=('shoulder', -0.03), bottom=('waist', 0.03), width=0.3, depth=0.12, strap=0.035, slot=0, strap_slot=3,
             paint=dict(base='C1', pattern='plate', strap='C2', trims=[('top', 0.08, 'C2'), ('bottom', 0.06, 'C2')])),
    ]),
    # 챙 모자 — 머리 따라 둥근 천 몸통 + 앞챙(제복·야구 모자). 살 껍데기 모자는 톱니·구김이었다(09-27)
    'cap_peaked': dict(desc='챙 모자 — 둥근 천 몸통·앞챙', tags=['hat', 'modern'], colors=dict(C1='#1f2638', C2='#141820'), parts=[
        dict(kind='crown', ease=0.022, brow=0.045, dome=0.045, slot=6, paint=dict(base='C1', pattern='weave')),
        dict(kind='visor', z=0.045, ease=0.024, length=0.075, droop=0.016, half=58, taper=1.6, slot=5, paint=dict(base='C2', pattern='weave')),
    ]),
    # 납작 모자(뉴스보이) — 앞으로 쏠려 처진 납작 몸통 + 짧은 챙
    'cap_flat': dict(desc='납작 모자 — 앞으로 쏠린 납작 몸통·짧은 챙', tags=['hat', 'modern'], colors=dict(C1='#3a3226', C2='#2a241c'), parts=[
        dict(kind='beret', z=0.05, ease=0.024, puff=0.022, dome=0.028, tilt=0.022, tilt_a=270, droop=0.014, slot=6,
             paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.1, 'C2')])),
        dict(kind='visor', z=0.05, ease=0.026, length=0.045, droop=0.01, half=70, slot=5, paint=dict(base='C2', pattern='weave')),
    ]),
    # 비니 — 머리에 붙는 뜨개 몸통 + 접어 올린 단
    'beanie': dict(desc='비니 — 뜨개 몸통·접어 올린 단', tags=['hat', 'modern'], colors=dict(C1='#b0206a'), parts=[
        dict(kind='crown', ease=0.02, brow=0.055, dome=0.035, cuff=0.032, slot=6, paint=dict(base='C1', pattern='knit')),
    ]),
    # 잎 옷 — 요정·정령. 몸에 붙는 윗판 + 허벅지까지 퍼지는 톱니 끝단
    'leafdress': dict(desc='잎 옷 — 톱니 끝단 민소매 짧은 옷', tags=['dress', 'fantasy'], colors=dict(C1='#5f8a3c'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('crotch', -0.16), ease=0.008, fit=True, flare=0.35, folds=0.03, nfolds=9, teeth=9, tooth=0.06, slot=0,
             paint=dict(base='C1', pattern='leaf', teeth=9, trims=[('top', 0.015, '#3e5e24')])),
    ]),
    # 해진 옷자락 — 안개유령. 목부터 발목 아래까지, 넓게 처진 소매, 해진 끝단(다리는 옷 밑에서 지운다)
    'wraith': dict(desc='해진 긴 옷자락·처진 넓은 소매', tags=['robe', 'fantasy'], colors=dict(C1='#4a5a70', C2='#2e3a4c'), parts=[
        dict(kind='tube', top=('neck', 0), bottom=('ankle', -0.02), ease=0.014, flare=0.5, folds=0.04, nfolds=11, teeth=14, tooth=0.08, slot=0,
             paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.025, 'C2'), ('top', 0.015, 'C2')])),
        dict(kind='sleeves', length=1.0, ease=0.02, drop=0.14, flare=0.5, cuff=0.0, slot=2, paint=dict(base='C1', pattern='weave')),
    ]),
    # 띠 — 허리(무도 띠)·엉덩이(연장 띠). 옷 면 껍데기 띠는 구겨진 고리였다(09-27)
    'belt': dict(desc='허리띠', tags=['belt'], colors=dict(C1='#141414'), parts=[
        dict(kind='band', at=('waist', 0.02), width=0.045, ease=0.03, slot=3, paint=dict(base='C1', pattern='weave')),
    ]),
    'belt_low': dict(desc='엉덩이 띠(연장 띠)', tags=['belt'], colors=dict(C1='#5a4028'), parts=[
        dict(kind='band', at=('hip', 0.04), width=0.05, ease=0.03, slot=3, paint=dict(base='C1', pattern='studs', motif='#9a9a9a')),
    ]),
    # 무릎 받이
    'kneepads': dict(desc='무릎 받이', tags=['armor', 'modern'], colors=dict(C1='#1f1f1f'), parts=[
        dict(kind='leggings', top=('knee', 0.045), bottom=('knee', -0.045), ease=0.022, smooth=2, slot=5, paint=dict(base='C1', pattern='plate')),
    ]),
    # 쇠 목 고리
    'neckring': dict(desc='쇠 목 고리', tags=['armor', 'future'], colors=dict(C1='#bcc2ca'), parts=[
        dict(kind='collar', bottom=-0.025, height=0.03, ease=0.014, roll=0.004, slot=1, paint=dict(base='C1', pattern='plate')),
    ]),
    # 베레모 — 한쪽으로 쏠려 처진 둥근 납작 모자(현대)
    'beret': dict(desc='베레모 — 한쪽으로 쏠린 둥근 납작 모자', tags=['hat', 'modern'], colors=dict(C1='#6a1f2a'), parts=[
        dict(kind='beret', slot=6, paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.1, '#4a141c')])),
    ]),
    # 쇠 어깨판만 — 몸에 붙는 옷 위
    'pauldrons': dict(desc='쇠 어깨판', tags=['armor', 'historical'], colors=dict(C1='#9aa0a8', C2='#4a4d52'), parts=[
        dict(kind='sleeves', length=0.3, ease=0.03, over=0.02, flare=0.45, arc=190, cuff=0.0, slot=4,
             paint=dict(base='C1', pattern='plate', trims=[('top', 0.015, 'C2')])),
    ]),
    # 등 망토 — 어깨에서 종아리까지 뒤로 늘어지며 넓어지는 천
    'cape': dict(desc='등 망토', tags=['cape', 'historical'], colors=dict(C1='#4a1418', C2='#2a0c0e'), parts=[
        dict(kind='tube', top=('shoulder', 0.0), bottom=('knee', -0.18), ease=0.03, over=0.02, mono=True, flare=0.35, folds=0.03,
             arc=(90, 170), slot=0, paint=dict(base='C1', pattern='weave', trims=[('bottom', 0.015, 'C2')])),
    ]),
    # 상투 — 빗어 올린 머리·망건·상투(갓 없는 선비·무장). 머리카락 메시 대신이다
    'sangtu': dict(desc='빗어 올린 머리·망건·상투', tags=['hair', 'historical', 'east'], colors=dict(C1='#1b1512'), parts=[
        dict(kind='hairdome', front=0.055, side=0.015, back=-0.03, ease=0.0045, slot=0, paint=dict(base='C1', pattern='sleek')),
        dict(kind='mangeon', tight=True, ease=0.0075, slot=3, paint=dict(base=BLACK, pattern='mesh')),
        dict(kind='topknot', r=0.02, tall=1.5, slot=4, paint=dict(base='C1', pattern='sleek')),
    ]),
    # 속발 — 빗어 올린 머리·정수리 상투(삼국 장수·의원, 망건 없음)
    'sangtu_bun': dict(desc='빗어 올린 머리·정수리 상투(속발)', tags=['hair', 'historical', 'east'], colors=dict(C1='#1b1512'), parts=[
        dict(kind='hairdome', front=0.06, side=0.015, back=-0.03, ease=0.0045, slot=0, paint=dict(base='C1', pattern='sleek')),
        dict(kind='topknot', r=0.023, tall=1.25, slot=4, paint=dict(base='C1', pattern='sleek')),
    ]),
    # 존마게 — 앞머리~정수리를 민 사카야키 + 뒤에서 묶어 앞으로 눕힌 상투
    'chonmage': dict(desc='사카야키·존마게', tags=['hair', 'historical', 'east'], colors=dict(C1='#1b1512'), parts=[
        dict(kind='hairdome', open=True, front=0.06, side=0.035, back=-0.03, ease=0.0045, slot=0, paint=dict(base='C1', pattern='sleek')),
        dict(kind='mage', slot=4, paint=dict(base='C1', pattern='sleek')),
    ]),
}


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def human(svc):
    """기본 몸(모프 0.5) + game_engine 뼈 — 뼈 무게로 살을 몸통·팔·다리·머리로 나누려고. 도우미는 켠 채(치마 도우미에 맞춘다)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bm = svc['HumanService'].create_human(mask_helpers=False, detailed_helpers=True, extra_vertex_groups=True,
                                          feet_on_ground=True, scale=0.1)
    svc['HumanService'].add_builtin_rig(bm, 'game_engine', import_weights=True)
    return bm, bm.parent


def part_sum(w, pats):
    return sum(x for n, x in w.items() if any(n == p or (p.endswith('*') and n.startswith(p[:-1])) for p in pats))


def ring_radii(pts, cx, cy, seg, ease, convex=True):
    """점들의 둘레 반지름(칸마다 가장 먼 점) → 빈 칸은 이웃으로 메우고, 오목한 곳을 볼록하게, 계단을 둥글게."""
    r = np.zeros(seg)
    for x, y in pts:
        k = int((math.atan2(y - cy, x - cx) % (2 * math.pi)) / (2 * math.pi) * seg) % seg
        r[k] = max(r[k], math.hypot(x - cx, y - cy))
    if not r.any():
        return None
    for _ in range(seg):
        z = np.where(r == 0)[0]
        if not len(z):
            break
        for k in z:
            r[k] = max(r[(k - 1) % seg], r[(k + 1) % seg])
    for _ in range(6 if convex else 2):   # convex=False(통 fit) — 몸에 붙는 옷 위 조끼·가슴판은 오목한 곳을 조금만 메운다(0 이면 등 골을 따라 들어가 속 몸 옷이 뚫는다)
        r = np.maximum(r, (np.roll(r, 1) + np.roll(r, -1)) / 2)
    ker = np.array([1, 2, 3, 2, 1], np.float64) / 9
    for _ in range(3):
        r = sum(ker[j] * np.roll(r, j - 2) for j in range(5))
    return r + ease


class Body:
    """기본 몸 측정 — 살 좌표·뼈 무게·높이 기준."""

    def __init__(self, bm, arm):
        self.bm, self.arm = bm, arm
        names = [g.name for g in bm.vertex_groups]
        self.W = [dict() for _ in bm.data.vertices]
        for v in bm.data.vertices:
            for g in v.groups:
                self.W[v.index][names[g.group]] = g.weight
        self.co = [bm.matrix_world @ v.co for v in bm.data.vertices]
        W = self.W
        self.body = [v.index for v in bm.data.vertices if 'body' in W[v.index]]
        self.torso = [i for i in self.body if part_sum(W[i], ['pelvis', 'spine_0*', 'clavicle_*', 'neck_01']) >= 0.5]
        self.legs = [i for i in self.body if part_sum(W[i], ['thigh_*', 'calf_*', 'pelvis']) >= 0.5]
        self.head = [i for i in self.body if W[i].get('head', 0) >= 0.6]
        for gname, idx in (('cf_torso', [i for i in self.body if part_sum(W[i], ['pelvis', 'spine_0*', 'clavicle_*', 'neck_01', 'thigh_*']) >= 0.6]),
                           ('cf_arm_l', [i for i in self.body if part_sum(W[i], ['upperarm_l', 'lowerarm_l', 'clavicle_l']) >= 0.6]),
                           ('cf_arm_r', [i for i in self.body if part_sum(W[i], ['upperarm_r', 'lowerarm_r', 'clavicle_r']) >= 0.6]),
                           ('cf_leg_l', [i for i in self.body if part_sum(W[i], ['thigh_l', 'calf_l']) >= 0.6]),
                           ('cf_leg_r', [i for i in self.body if part_sum(W[i], ['thigh_r', 'calf_r']) >= 0.6]),
                           ('cf_head', self.head)):
            if gname not in bm.vertex_groups:
                bm.vertex_groups.new(name=gname).add(idx, 1.0, 'REPLACE')
        b = lambda n: self.bone(n).z  # noqa: E731
        self.lv = {'shoulder': b('upperarm_l') + 0.03, 'neck': b('neck_01') + 0.01, 'chest': b('spine_03'), 'waist': b('spine_01'),
                   'hip': b('pelvis'), 'crotch': b('thigh_l') - 0.06, 'knee': b('calf_l'), 'ankle': b('foot_l')}
        self.cx, self.cy = 0.0, float(np.mean([self.co[i].y for i in self.torso]))
        hc = [self.co[i] for i in self.head]
        self.head_top = max(p.z for p in hc)
        self.head_cy = float(np.mean([p.y for p in hc]))
        eyes = [self.co[v.index] for v in bm.data.vertices if 'helper-l-eye' in W[v.index] or 'helper-r-eye' in W[v.index]]
        self.eye_z = float(np.mean([p.z for p in eyes])) if eyes else self.head_top - 0.11

    def bone(self, n, tail=False):
        b = self.arm.data.bones[n]
        return self.arm.matrix_world @ (b.tail_local if tail else b.head_local)

    def level(self, spec):
        return self.lv[spec[0]] + spec[1]

    def band_pts(self, idx, z, dz=0.025):
        return [(self.co[i].x, self.co[i].y) for i in idx if abs(self.co[i].z - z) < dz]


class Builder:
    """부품을 한 bmesh 에 쌓는다. 정점마다 맞춤 무리 하나, 면마다 (UV 칸, 기준점)."""

    def __init__(self, body):
        self.B = body
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.grp = {}
        self.ref = {}       # 면 → 바깥 판정 기준점(이 점에서 멀어지는 쪽이 바깥)
        self.tubes = []     # (z 목록, 반지름 목록) — 띠가 그 높이 통 둘레를 찾는다
        self.cover = []     # 지울 살 판정용 (종류, 범위)

    def vert(self, p, g):
        v = self.bm.verts.new(p)
        self.grp[v] = g
        return v

    def grid(self, rows, slot, refs, closed=True, uvs=None):
        """rows[k][s] 정점 격자 → 사각형. closed 면 둘레를 잇는다. UV 는 칸 안에서 (s/n, k/(K-1)) 또는 uvs[k] 높이."""
        u0, v0, u1, v1 = SLOTS[slot]
        K, n = len(rows), len(rows[0])
        span = n if closed else n - 1
        for k in range(K - 1):
            for s in range(span):
                s2 = (s + 1) % n
                f = self.bm.faces.new((rows[k][s], rows[k][s2], rows[k + 1][s2], rows[k + 1][s]))
                self.ref[f] = refs[k] if isinstance(refs, list) else refs
                for lp, (kk, ss) in zip(f.loops, ((k, s), (k, s + 1), (k + 1, s + 1), (k + 1, s))):
                    tv = uvs[kk] if uvs else kk / (K - 1)
                    lp[self.uv].uv = (u0 + (u1 - u0) * ss / span, v0 + (v1 - v0) * (0.02 + 0.96 * tv))

    # -- 부품 --
    def tube(self, p):
        B = self.B
        zt, zb = B.level(p['top']), B.level(p['bottom'])
        neck_top = p['top'][0] == 'neck'
        if neck_top:
            zt = B.lv['shoulder']
        z_cr = B.lv['crotch']
        NR = max(6, int((zt - zb) / 0.035) + 1)
        zs = [zb + (zt - zb) * k / (NR - 1) for k in range(NR)]
        ease = p.get('ease', 0.02) + p.get('over', 0.0)
        RR, prev, k_cr = [None] * NR, None, None
        for k in reversed(range(NR)):
            z = zs[k]
            src = B.torso if z > z_cr + 0.04 else B.torso + B.legs
            pts = B.band_pts(src, z)
            r = ring_radii(pts, B.cx, B.cy, SEG, ease, convex=not p.get('fit')) if pts else None
            if r is None:
                r = prev
            if prev is not None and (p.get('mono') or z < z_cr):
                r = np.maximum(r, prev)
            if z < z_cr and prev is not None and p.get('flare'):
                if k_cr is None:
                    k_cr = k + 1
                r = r * (1 + p['flare']) ** (1 / max(k_cr, 1))
            elif p.get('mono') and p.get('flare') and z >= z_cr and prev is not None and zb >= z_cr - 0.02:
                r = r * (1 + p['flare']) ** (1 / NR)  # 가랑이 위에서 끝나는 치마(비늘 치마)도 아래로 넓힌다
            RR[k] = prev = r
        for k, z in enumerate(zs):   # 가랑이 아래는 둘레를 평균 쪽으로 모은다 — 엉덩이 불룩이 끝단까지 번져 뒤가 혹처럼 튀지 않게
            if z < z_cr:
                al = p.get('round', 0.6) * min(1.0, (z_cr - z) / 0.25)
                RR[k] = np.maximum(RR[k], RR[k] * (1 - al) + al * float(np.max(RR[k])) * 0.92)   # 줄이지 않고 모자란 쪽만 늘린다
        for _ in range(3):
            RR = [RR[0]] + [(RR[k - 1] + 2 * RR[k] + RR[k + 1]) / 4 for k in range(1, NR - 1)] + [RR[-1]]
        rows, refs, ringz = [], [], []
        arc = p.get('arc')          # (가운데 도, 폭 도) — 앞(270)·뒤(90) 한쪽만 두르는 판(겉옷판·망토), 목 틀 없이 어깨부터
        assert not (arc and neck_top), 'arc 판은 top 을 neck 말고 shoulder 부터'
        if arc:
            n_a = max(3, int(SEG * arc[1] / 360) + 1)
            angs = [math.radians(arc[0] - arc[1] / 2 + arc[1] * j / (n_a - 1)) for j in range(n_a)]
        else:
            angs = [2 * math.pi * s / SEG for s in range(SEG)]
        for k, z in enumerate(zs):
            ring = []
            below = max(0.0, (z_cr - z) / max(z_cr - zb, 1e-3))
            for a in angs:
                rr = RR[k][int(round(a / (2 * math.pi) * SEG)) % SEG]
                fold = 1 + p.get('folds', 0.0) * below * math.sin(a * p.get('nfolds', 9) + 0.7)
                ring.append(self.vert((B.cx + rr * fold * math.cos(a), B.cy + rr * fold * math.sin(a), z),
                                      'helper-skirt' if z < z_cr - 0.02 else 'cf_torso'))
            rows.append(ring)
            refs.append(Vector((B.cx, B.cy, z)))
            ringz.append(z)
        if p.get('teeth'):   # 톱니 끝단(잎 옷·해진 옷자락) — 맨 아래 줄을 세모꼴로 내린다. 살 껍데기 옷자락(robe)은 거친 통이었다(09-27)
            nt, dep = p['teeth'], p.get('tooth', 0.05)
            for j, v in enumerate(rows[0]):
                t = (j * nt / len(rows[0])) % 1.0
                v.co.z -= dep * (1 - abs(2 * t - 1)) * (0.75 + 0.25 * math.sin(j * 2.3))
        if neck_top:  # 어깨 → 목둘레(목 살 둘레 + 여유)
            zn = B.lv['neck']
            npts = [(B.co[i].x, B.co[i].y) for i in B.body if abs(B.co[i].z - zn) < 0.02 and B.W[i].get('neck_01', 0) > 0.3]
            ncy = float(np.mean([q[1] for q in npts]))
            rn = ring_radii(npts, B.cx, ncy, SEG, 0.018 + p.get('over', 0.0) * 0.5)
            for k in range(1, 4):
                f = k / 3
                z = zt + (zn - zt) * f
                yy = B.cy * (1 - f) + ncy * f
                ring = []
                for s in range(SEG):
                    a = 2 * math.pi * s / SEG
                    rr = RR[-1][s] * (1 - f) + rn[s] * f
                    ring.append(self.vert((B.cx + rr * math.cos(a), yy + rr * math.sin(a), z), 'cf_torso'))
                rows.append(ring)
                refs.append(Vector((B.cx, yy, z)))
                ringz.append(z)
        z0, z1 = ringz[0], ringz[-1]
        self.grid(rows, p['slot'], refs, closed=not arc, uvs=[(z - z0) / (z1 - z0) for z in ringz])
        if arc:
            return                  # 판 옆으로 살이 보이니 안 지우고, 띠가 재는 통 목록에도 안 넣는다
        self.tubes.append((zs, RR))
        self.cover.append(('tube', zb, ringz[-1], neck_top))

    def collar(self, p):
        """목 깃(목폴라) — 목 살을 따라 목 밑(`bottom`)에서 턱 밑(`height`)까지 목만 두른다. 맨 위 줄은 접힌 단처럼 조금 두껍게.
        몸통 통의 어깨 → 목 원뿔은 붙는 겉옷 깃 밖으로 나와 톱니처럼 보여서(09-27) 목만 짓고 밑단은 겉옷 깃 속으로 넣는다."""
        B = self.B
        zb = B.lv['neck'] + p.get('bottom', -0.01)
        zt = min(B.lv['neck'] + p.get('height', 0.075), B.bone('head').z - 0.012)
        NR = max(4, int((zt - zb) / 0.015) + 1)
        rings = []
        for k in range(NR):
            z = zb + (zt - zb) * k / (NR - 1)
            cp = [(B.co[i].x, B.co[i].y) for i in B.body if abs(B.co[i].z - z) < 0.012 and B.W[i].get('neck_01', 0) > 0.25]
            if len(cp) >= 8:
                ccy = float(np.mean([q[1] for q in cp]))
                rings.append((z, ccy, ring_radii(cp, B.cx, ccy, SEG, p.get('ease', 0.01) + (p.get('roll', 0.005) if k == NR - 1 else 0.0))))
        for k in reversed(range(len(rings) - 1)):   # 목 밑은 승모근·쇄골로 퍼진다 — 윗줄보다 조금만 크게(밑단이 셔츠 깃 속에 든다)
            z, ccy, rc = rings[k]
            rings[k] = (z, ccy, np.minimum(rc, rings[k + 1][2] * p.get('taper', 1.04)))
        rows, refs, ringz = [], [], []
        for z, ccy, rc in rings:
            rows.append([self.vert((B.cx + rc[s] * math.cos(2 * math.pi * s / SEG), ccy + rc[s] * math.sin(2 * math.pi * s / SEG), z), 'cf_torso')
                         for s in range(SEG)])
            refs.append(Vector((B.cx, ccy, z)))
            ringz.append(z)
        assert len(rows) >= 3, 'collar: 목 살 둘레가 모자라다'
        self.grid(rows, p['slot'], refs, uvs=[(z - ringz[0]) / (ringz[-1] - ringz[0]) for z in ringz])
        self.cover.append(('collar', ringz[0], ringz[-1]))

    def backpack(self, p):
        """등 짐(배낭·짐틀) — 등판 뒤 둥근 모서리 상자(`width`·`depth`, 높이는 `top`·`bottom`) + 어깨끈 둘(`strap` 폭, 0 이면 없음).
        살을 띄운 껍데기 배낭은 등 굴곡을 따라 구겨진 판이 됐다(09-27 61벌 점검). 끈은 몸 세로 단면(x = ±strap_x)을 따라
        등 위 → 어깨 → 가슴 앞으로 내려오다 옆구리로 빠진다. 상자는 몸통 뼈에만 붙는다(cf_torso)."""
        B = self.B
        zt, zb = B.level(p['top']), B.level(p['bottom'])
        W2, D = p.get('width', 0.3) / 2, p.get('depth', 0.13)
        y0 = max(B.co[i].y for i in B.torso if zb <= B.co[i].z <= zt and abs(B.co[i].x) < W2) + p.get('gap', 0.012)
        yc, D2 = y0 + D / 2, D / 2
        ex = 0.5                     # 둥근 네모 단면(초타원 m=4)
        def sgn(v):
            return 1.0 if v >= 0 else -1.0
        prof = [(zb, 0.03, 0.03), (zb + 0.004, 0.72, 0.72), (zb + 0.018, 0.96, 0.96), (zb + 0.04, 1.0, 1.0),
                (zt - 0.05, 1.0, 0.94), (zt - 0.022, 0.96, 0.86), (zt - 0.006, 0.72, 0.62), (zt, 0.03, 0.03)]
        rows, refs = [], []
        for z, sw, sd in prof:
            ring = []
            for s in range(SEG):
                a = 2 * math.pi * s / SEG
                c, si = math.cos(a), math.sin(a)
                ring.append(self.vert((W2 * sw * sgn(c) * abs(c) ** ex, yc + D2 * sd * sgn(si) * abs(si) ** ex, z), 'cf_torso'))
            rows.append(ring)
            refs.append(Vector((0.0, yc, z)))
        self.grid(rows, p['slot'], refs, uvs=[(z - zb) / (zt - zb) for z, _, _ in prof])
        sw_ = p.get('strap', 0.04)
        if not sw_:
            return
        cy, cz = float(np.mean([B.co[i].y for i in B.torso if abs(B.co[i].z - B.lv['chest']) < 0.03])), B.lv['chest']
        a0, a1, K = math.radians(40), math.radians(245), 30
        for sx in (-1, 1):
            rows, refs = [], []
            for k in range(K):
                a = a0 + (a1 - a0) * k / (K - 1)
                x = sx * (p.get('strap_x', 0.085) + 0.07 * max(0.0, (a - math.radians(185)) / (a1 - math.radians(185))))
                dy, dz = math.cos(a), math.sin(a)
                cand = [(B.co[i].y - cy) * dy + (B.co[i].z - cz) * dz for i in B.torso
                        if abs(B.co[i].x - x) < 0.014 and abs((math.atan2(B.co[i].z - cz, B.co[i].y - cy) - a + math.pi) % (2 * math.pi) - math.pi) < 0.12]
                r = (max(cand) if cand else (rows and prev_r) or 0.12) + p.get('strap_ease', 0.008)
                prev_r = r
                rows.append([self.vert((x + e, cy + r * dy, cz + r * dz), 'cf_torso') for e in (-sw_ / 2, sw_ / 2)])
                refs.append(Vector((x, cy, cz)))
            self.grid(rows, p.get('strap_slot', p['slot']), refs, closed=False)

    def sleeves(self, p):
        """소매 — `arc`(도) 면 팔 바깥쪽만 두르는 판(소데·어깨판), `bag` 이면 팔꿈치부터 네모나게 늘어지는 자루(기모노)."""
        B = self.B
        arc = p.get('arc')
        for side in 'lr':
            outv = Vector((1.0 if side == 'l' else -1.0, 0, 0))   # 왼쪽 = +X
            S, E, Wr = B.bone(f'upperarm_{side}'), B.bone(f'lowerarm_{side}'), B.bone(f'hand_{side}')
            armv = [B.co[i] for i in B.body if part_sum(B.W[i], [f'upperarm_{side}', f'lowerarm_{side}']) >= 0.5]
            L1, L2 = (E - S).length, (Wr - E).length
            L = L1 + L2
            tend = p.get('length', 1.0) + p.get('cuff', 0.0) / L
            t0 = p.get('start', 0.02)           # 팔 가리개 = 팔꿈치 아래부터(start 0.6)
            NT = max(4, int(16 * (tend - t0 if 'start' in p else tend)))   # start 없으면 예전 칸 수 그대로
            down = Vector((0, 0, -1))
            rows, refs = [], []
            for k in range(NT + 1):
                t = t0 + (tend - t0) * k / NT
                d = t * L
                if d <= L1:
                    P, dirv = S + (E - S) * (d / L1), (E - S).normalized()
                else:
                    P, dirv = E + (Wr - E) * min((d - L1) / L2, 1.0) + (Wr - E).normalized() * max(d - L, 0), (Wr - E).normalized()
                v_ = down - dirv * down.dot(dirv)
                v_ = v_.normalized() if v_.length > 1e-4 else Vector((0, -1, 0))
                w_ = dirv.cross(v_)
                near = [q for q in armv if abs((q - P).dot(dirv)) < 0.025]
                r = max(((q - P) - dirv * (q - P).dot(dirv)).length for q in near) if near else 0.045
                r = min(r, 0.045 + 0.01 * min(1.0, t * 2)) + p.get('ease', 0.02) * min(1.0, 0.35 + t) + p.get('over', 0.0)
                r *= 1 + p.get('flare', 0.0) * (k / NT)
                if p.get('bag'):
                    tt = max(0.0, min(1.0, (t - 0.36) / 0.16))
                    drop, dpow = p.get('drop', 0.0) * (3 * tt * tt - 2 * tt * tt * tt), 1.0
                else:
                    tt = max(0.0, min(1.0, (t - 0.3) / 0.55))
                    drop, dpow = p.get('drop', 0.0) * (3 * tt * tt - 2 * tt * tt * tt), 2.0
                    if t > 0.85:
                        drop *= 1 - 0.5 * min(1.0, (t - 0.85) / 0.2)
                if arc:
                    o = outv - dirv * outv.dot(dirv)
                    ph0 = math.atan2(o.dot(v_), o.dot(w_) / 1.1)
                    na = SSEG // 2 + 1
                    phs = [ph0 + math.radians(arc) * (j / (na - 1) - 0.5) for j in range(na)]
                else:
                    phs = [2 * math.pi * s / SSEG for s in range(SSEG)]
                ring = []
                fo = p.get('folds', 0.0 if arc else 0.035) * min(1.0, t * 1.5)
                for ph in phs:
                    sv = math.sin(ph)
                    rf = r * (1 + fo * math.sin(ph * 5 + 2.2 * t))
                    off = w_ * (rf * 1.1 * math.cos(ph)) + v_ * (rf * sv + drop * ((1 + sv) / 2) ** dpow)
                    ring.append(self.vert(P + off, f'cf_arm_{side}'))
                rows.append(ring)
                refs.append(P)
            # 소매 격자는 둘레 방향이 반대(안쪽을 보게 지어진다) — 기준점으로 뒤집는다
            self.grid(rows, p['slot'], refs, closed=not arc)
        if t0 <= 0.05:                          # 팔 가리개 밑 윗팔 살은 드러나니 지우지 않는다
            self.cover.append(('sleeves', p.get('length', 1.0)))

    def band(self, p):
        """띠 — 그 높이 통 둘레 바깥 `over`. `ease` 가 있으면 통 대신 몸 둘레 + ease(겉옷판처럼 앞뒤 판만 있는 옷 위 허리띠)."""
        B = self.B
        z = B.level(p['at'])
        if 'ease' in p:
            rk = ring_radii(B.band_pts(B.torso, z), B.cx, B.cy, SEG, p['ease'])   # 볼록 둘레 — 앞뒤 판(tube arc)도 볼록하게 메워져 오목 둘레면 판 속에 묻혔다
        else:
            zs, RR = next(((zs, RR) for zs, RR in reversed(self.tubes) if zs[0] <= z <= zs[-1]), self.tubes[-1])
            k = min(range(len(zs)), key=lambda i: abs(zs[i] - z))
            z, rk = zs[k], RR[k] + p.get('over', 0.012)
        rows = []
        for dz in (-p['width'] / 2, p['width'] / 2):
            ring = []
            for s in range(SEG):
                a = 2 * math.pi * s / SEG
                r = rk[s]
                ring.append(self.vert((B.cx + r * math.cos(a), B.cy + r * math.sin(a), z + dz), 'cf_torso'))
            rows.append(ring)
        self.grid(rows, p['slot'], Vector((B.cx, B.cy, z)))

    def _tube_at(self, z):
        """그 높이를 지나는 가장 바깥(나중에 지은) 통의 둘레 반지름 배열."""
        zs, RR = next(((zs, RR) for zs, RR in reversed(self.tubes) if zs[0] <= z <= zs[-1]), self.tubes[-1])
        k = min(range(len(zs)), key=lambda i: abs(zs[i] - z))
        return RR[k]

    def leggings(self, p):
        """다리 통(정강이 가리개·각반·바지) — 다리마다 높이 칸의 살 둘레 + 여유, `flare` 만큼 발목 쪽을 넓힌다.
        `ease_bottom` 이면 여유가 발목(그 값) → 위(ease)로 곧게 바뀐다(대님 바지 — 같은 여유면 종아리·무릎까지 풍선처럼 부풀었다, 09-27),
        `smooth` 번 위아래 줄 반지름을 고르게 편다(무릎·종아리 굴곡이 천에 비치지 않게)."""
        B = self.B
        zt, zb = B.level(p['top']), B.level(p['bottom'])
        NR = max(4, int((zt - zb) / 0.03) + 1)
        e_top = p.get('ease', 0.012) + p.get('over', 0.0)
        e_bot = p['ease_bottom'] + p.get('over', 0.0) if 'ease_bottom' in p else e_top
        for side in 'lr':
            legv = [i for i in B.body if part_sum(B.W[i], [f'thigh_{side}', f'calf_{side}']) >= p.get('wmin', 0.5)]   # 바지는 낮춰 엉덩이 옆(골반 무게) 살까지 — 윗줄이 좁으면 엉덩이 통 밑단이 턱으로 튀었다
            ring, prev = [], None
            for k in range(NR):
                z = zb + (zt - zb) * k / (NR - 1)
                pts = B.band_pts(legv, z, 0.015)
                if pts:
                    c = (float(np.mean([q[0] for q in pts])), float(np.mean([q[1] for q in pts])))
                    r = ring_radii(pts, c[0], c[1], SSEG, e_bot + (e_top - e_bot) * k / (NR - 1))
                    prev = (c, r)
                c, r = prev
                ring.append((z, c, r * (1 + p.get('flare', 0.0) * (1 - k / (NR - 1)) ** 2)))
            for _ in range(p.get('smooth', 0)):   # 줄마다 뽑히는 살 정점이 달라 반지름·가운데가 번갈아 튀면 톱니 윤곽이 됐다 — 둘 다 평균
                ring = [ring[0]] + [(z, tuple((ring[k - 1][1][d] + 2 * c[d] + ring[k + 1][1][d]) / 4 for d in (0, 1)),
                                     (ring[k - 1][2] + 2 * r + ring[k + 1][2]) / 4) for k, (z, c, r) in enumerate(ring) if 0 < k < NR - 1] + [ring[-1]]
            if p.get('tuck'):   # 윗줄 n 줄을 살 쪽으로 좁혀 허리 통 속으로 — 엉덩이 옆 살까지 잡은 윗줄이 대기에서 다리 따라 벌어져 허리 통 밖에 턱(주머니 테두리)으로 튀었다(09-27)
                n, e_t = p['tuck']
                ring = [(z, c, r - max(0.0, e_top - e_t) * max(0.0, (k - (NR - 1 - n)) / n)) for k, (z, c, r) in enumerate(ring)]
            if p.get('round_bottom'):   # 아래 세 줄을 둥글게 — 발목 살 둘레(아킬레스·복사뼈)를 따르면 끝단이 뒤꿈치 쪽으로 뾰족했다(09-27)
                ring = [(z, c, r * (1 - al) + al * float(np.mean(r))) if (al := p['round_bottom'] * max(0.0, 1 - k / 3)) else (z, c, r)
                        for k, (z, c, r) in enumerate(ring)]
            rows, refs = [], []
            for z, c, r in ring:
                rows.append([self.vert((c[0] + r[s] * math.cos(2 * math.pi * s / SSEG), c[1] + r[s] * math.sin(2 * math.pi * s / SSEG), z),
                                       f'cf_leg_{side}') for s in range(SSEG)])
                refs.append(Vector((c[0], c[1], z)))
            self.grid(rows, p['slot'], refs)
        self.cover.append(('leggings', zb, zt))

    def discs(self, p):
        """가슴 둥근 판 둘(호심경) — 그 높이 바깥 통 위, 앞 가운데에서 ±spread 도."""
        B = self.B
        z = B.level(p['at'])
        R = self._tube_at(z)
        r = p.get('radius', 0.055)
        for sgn in (-1, 1):
            a = math.radians(270 + sgn * p.get('spread', 24))
            Rr = R[int(round(a / (2 * math.pi) * SEG)) % SEG] + p.get('over', 0.006)
            c = Vector((B.cx + Rr * math.cos(a), B.cy + Rr * math.sin(a), z))
            nrm, tu, tw = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0)), Vector((0, 0, 1))
            rows = []
            for f in (0.03, 0.35, 0.7, 0.9, 1.0):
                bulge = 0.01 * (1 - f * f)
                rows.append([self.vert(c + nrm * bulge + (tu * math.cos(b) + tw * math.sin(b)) * (r * f), 'cf_torso')
                             for b in (2 * math.pi * s / HSEG for s in range(HSEG))])
            self.grid(rows, p['slot'], c - nrm * 0.1)

    def bow(self, p):
        """등 매듭(오비) — 허리 뒤에 붙는 네모난 베개 꼴."""
        B = self.B
        z = B.level(p['at'])
        R = self._tube_at(z)
        y0 = B.cy + R[SEG // 4] + p.get('over', 0.02)
        Wd, Ht, D = p.get('width', 0.26), p.get('height', 0.14), p.get('depth', 0.06)
        n = 32
        sq = lambda x: math.copysign(abs(x) ** 0.45, x)  # noqa: E731  (둥근 네모)
        rows = []
        for yy, sc in ((y0 - 0.015, 0.8), (y0 + D * 0.3, 1.0), (y0 + D * 0.75, 0.97), (y0 + D, 0.7), (y0 + D + 0.006, 0.3), (y0 + D + 0.008, 0.02)):
            rows.append([self.vert((B.cx + Wd / 2 * sc * sq(math.cos(b)), yy, z + Ht / 2 * sc * sq(math.sin(b))), 'cf_torso')
                         for b in (2 * math.pi * s / n for s in range(n))])
        self.grid(rows, p['slot'], Vector((B.cx, y0 - 0.05, z)))

    def _head_ring(self, z, ease, cy=None):
        B = self.B
        pts = [(B.co[i].x, B.co[i].y) for i in B.head if abs(B.co[i].z - z) < 0.012]
        return ring_radii(pts, 0.0, B.head_cy if cy is None else cy, HSEG, ease)

    def _rings(self, specs, slot, cy, group='cf_head', closed_top=False, half=False):
        """specs = [(z, 반지름 배열 또는 수)] 아래→위 → 격자. closed_top 이면 꼭대기를 작은 고리로 오므린다(사각형만 — 가운데 1mm 구멍).
        half 면 칸 s 의 각을 칸 가운데(s + 0.5) — _scalp_r 로 잰 반지름과 맞춘다."""
        rows, refs = [], []
        h = 0.5 if half else 0.0
        for z, r in specs:
            rr = r if isinstance(r, np.ndarray) else np.full(HSEG, r)
            rows.append([self.vert((rr[s] * math.cos(2 * math.pi * (s + h) / HSEG), cy + rr[s] * math.sin(2 * math.pi * (s + h) / HSEG), z), group)
                         for s in range(HSEG)])
            refs.append(Vector((0, cy, z - 0.05)))
        self.grid(rows, slot, refs)

    def mangeon(self, p):
        """망건 — 이마 위 띠. `tight` 면 머리 앞뒤 한가운데로 쏜 광선으로 살에 붙인다(상투 — 빗어 올린 머리 위에 ease 만큼).
        기본(갓 속)은 옛 방식: 얼굴 쪽으로 쏠린 head_cy 둘레 가장 먼 점 — 09-26 상투에서 1cm 가까이 떠 두꺼운 띠로 보였다."""
        B = self.B
        z0, z1 = B.eye_z + 0.03, B.eye_z + 0.075
        if p.get('tight'):
            hy = [B.co[i].y for i in B.head]
            cy = (min(hy) + max(hy)) / 2
            specs = [(z, np.array([self._scalp_r(z, s, p.get('ease', 0.004), cy) or 0.09 for s in range(HSEG)])) for z in np.linspace(z0, z1, 4)]
            self._rings([(z, np.maximum(r, (np.roll(r, 1) + np.roll(r, -1)) / 2)) for z, r in specs], p['slot'], cy, half=True)
            return
        self._rings([(z, self._head_ring(z, p.get('ease', 0.004))) for z in np.linspace(z0, z1, 4)], p['slot'], B.head_cy)

    def _scalp_r(self, z, s, ease, cy=None):
        """머리 살의 (높이 z, 둘레 칸 s 가운데 각) 반지름 + ease — 바깥 0.35m 에서 머리 가운데 줄로 수평 광선을 쏴 처음 맞는 살 면
        (헬퍼 뺀 'body' 면만). 안 맞으면(정수리 위) None. cy = 광선이 향하는 앞뒤 가운데(기본 head_cy).
        09-26: 정점으로 재면 틀렸다 — 뒤통수 정점은 1.5cm 넘게 성겨 점 사이 볼록한 면을 놓쳐 덮개가 6~8mm 살 속으로 들어갔고,
        높이 창의 가장 먼 점만 쓰면 창에 안쪽 점(입안·눈구멍)만 걸린 줄은 반지름이 절반이 됐다."""
        if not hasattr(self, '_scalp_bvh'):
            B = self.B
            bs = set(B.body)
            polys = [list(pl.vertices) for pl in B.bm.data.polygons if all(i in bs for i in pl.vertices)]
            self._scalp_bvh = BVHTree.FromPolygons([tuple(c) for c in B.co], polys)
        a = 2 * math.pi * (s + 0.5) / HSEG
        d = Vector((math.cos(a), math.sin(a), 0.0))
        c = Vector((0.0, self.B.head_cy if cy is None else cy, z))
        hit = self._scalp_bvh.ray_cast(c + d * 0.35, -d, 0.35)
        if hit[0] is None:
            return None
        return (hit[0] - c).length + ease

    def hairdome(self, p):
        """빗어 올린 머리(상투·존마게 밑) — 머리 속 한 점(앞뒤 한가운데 · 눈 높이 + 2cm)에서 둘레 각 θ·올려본 각 φ 로 쏜 광선이
        바깥에서 처음 맞는 살 + 법선 쪽 여유. 머리선 높이는 둘레 각마다 다르다(눈 높이에서 m: 앞 `front`·옆 `side`·뒤 `back`) —
        그 높이에 닿는 φ 를 이분법으로 찾고, 거기서 정수리(φ 89.5°)까지 줄 14. `open` 이면 앞머리~정수리를 민다(사카야키 —
        앞 ±35° 는 비우고, 남은 띠는 정수리까지 가는 길의 뒤 0.9·옆 0.6 몫까지만, 머리 살이 드러난다). 무늬 결은 v(아래→위)로 선다.
        09-26: 처음엔 높이마다 수평 고리로 쌓고 정수리를 타원 뚜껑으로 닫았더니 넓고 평평한 뒤 정수리를 뚜껑이 파고들어
        입힌 몸에서 살이 비쳤다(수평 반지름 재기의 함정은 _scalp_r)."""
        B = self.B
        ease, opened = p.get('ease', 0.006), p.get('open', False)
        hy = [B.co[i].y for i in B.head]
        cy = (min(hy) + max(hy)) / 2        # 머리 앞뒤 한가운데 — head_cy 는 얼굴 점이 많아 앞으로 4.5cm 쏠린다
        C = Vector((0.0, cy, B.eye_z + 0.02))
        self._scalp_r(B.eye_z, 0, 0.0)      # BVH 준비
        bvh = self._scalp_bvh
        th = lambda s: 2 * math.pi * (s + 0.5) / HSEG  # noqa: E731
        dirv = lambda t, f: Vector((math.cos(f) * math.cos(t), math.cos(f) * math.sin(t), math.sin(f)))  # noqa: E731

        def hit(t, f):
            d = dirv(t, f)
            h = bvh.ray_cast(C + d * 0.35, -d, 0.35)
            if h[0] is None:
                return None
            n = h[1] if h[1].dot(d) >= 0 else -h[1]
            return h[0], n, (h[0] - C).length

        def z0(s):
            c = math.sin(th(s))              # -1 앞(270°) · +1 뒤(90°)
            return B.eye_z + p.get('side', 0.035) * (1 - abs(c)) + (p.get('front', 0.055) if c < 0 else p.get('back', -0.03)) * abs(c)

        def phi0(s):                         # 맞은 살 높이가 머리선이 되는 φ
            lo, hi = math.radians(-50), math.radians(80)
            for _ in range(24):
                mid = (lo + hi) / 2
                h = hit(th(s), mid)
                if h is not None and h[0].z < z0(s):
                    lo = mid
                else:
                    hi = mid
            return (lo + hi) / 2

        def reach(s):                        # 머리선 → 정수리 사이 어디까지 덮나
            if not opened:
                return 1.0
            c = math.sin(th(s))
            return 0.6 + 0.3 * c if c >= 0 else 0.6 * (1 + c) + 0.3 * (-c)
        cols = list(range(HSEG))
        if opened:
            cols = sorted((s for s in cols if abs((360 * (s + 0.5) / HSEG - 270 + 180) % 360 - 180) > 35),
                          key=lambda s: (360 * (s + 0.5) / HSEG - 305) % 360)
        top = math.radians(89.5)
        ref_ear = {}
        # 덮는 범위(칸마다 φ 아래·위) — delete_group 이 이 안의 두피 살을 지운다. 입힌 몸은 나이·몸무게 모프로 뒤통수가
        # 기본 몸보다 불룩해져 맞춤이 못 따라가 7mm 까지 살 속에 들었다(09-26 렌더 — 뒤통수에 살이 비침)
        self.scalp_cover = dict(C=C, opened=opened, cols={s: (phi0(s), phi0(s) + (top - phi0(s)) * reach(s)) for s in cols})
        NK = 14
        rows = []
        for k in range(NK):
            f = k / (NK - 1)
            row = []
            for j, s in enumerate(cols):
                t, f0 = th(s), phi0(s)
                ph = f0 + (top - f0) * f * reach(s)
                e = ease
                if opened:                   # 민 자리에 닿는 가장자리(윗단·앞 끝 두 칸)는 살에 붙인다 — 떠 있으면 관자놀이에 날개로 보였다
                    e *= min(1 - 0.5 * f ** 2, (0.4, 0.7)[j] if j < 2 else (0.4, 0.7)[len(cols) - 1 - j] if j >= len(cols) - 2 else 1.0)
                h = hit(t, ph)
                if h is None:                # 안 맞으면(생길 일은 없다) 가운데에서 9cm
                    q = C + dirv(t, ph) * 0.09
                else:
                    q = h[0] + h[1] * e
                    if abs(math.cos(t)) > 0.55 and h[0].z < B.eye_z + 0.05:   # 귀 — 옆 아래 광선이 귓바퀴에 맞아 뻗쳤다(09-26 렌더)
                        if s not in ref_ear:
                            lo, hi = f0, top
                            for _ in range(20):
                                mid = (lo + hi) / 2
                                hm = hit(t, mid)
                                lo, hi = (mid, hi) if hm is not None and hm[0].z < B.eye_z + 0.05 else (lo, mid)
                            hm = hit(t, (lo + hi) / 2)
                            ref_ear[s] = hm[2] if hm else None
                        if ref_ear[s] and h[2] > ref_ear[s] * 1.04:
                            q = C + dirv(t, ph) * (ref_ear[s] * 1.04 + e)
                row.append(self.vert(tuple(q), 'cf_head'))
            rows.append(row)
        self.grid(rows, p['slot'], C, closed=not opened)

    def mage(self, p):
        """존마게 — 뒤 정수리에서 묶어 앞으로 눕힌 짧은 상투(사카야키 위). 자리는 실제 정수리(머리 살 가장 높은 점)의 앞뒤 —
        head_cy 는 얼굴 점이 많아 앞으로 쏠려(09-26 첫판은 이마 위에 서서 뿔처럼 보였다). 뒤 끝만 머리에 묻히고 나머지는 거의 수평."""
        B = self.B
        crown = max(B.head, key=lambda i: B.co[i].z)
        cy, cz = B.co[crown].y, B.head_top
        top = {}
        def top_at(y):
            k = round(y, 3)
            if k not in top:
                zs = [B.co[i].z for i in B.head if abs(B.co[i].x) < 0.02 and abs(B.co[i].y - y) < 0.012]
                top[k] = max(zs) if zs else B.head_top
            return top[k]
        # (앞뒤 자리, 정수리 위 높이 — None 이면 그 자리 머리 살 + 4mm, 반지름)
        path = [(cy + 0.045, None, 0.004), (cy + 0.038, None, 0.009), (cy + 0.025, 0.010, 0.011), (cy + 0.008, 0.012, 0.010),
                (cy - 0.010, 0.011, 0.009), (cy - 0.025, 0.009, 0.008), (cy - 0.035, 0.007, 0.006), (cy - 0.040, 0.006, 0.002)]
        rows, refs = [], []
        for y, dz, r in path:
            c = Vector((0.0, y, top_at(y) + 0.004 if dz is None else max(top_at(y) + 0.006, cz + dz)))
            rows.append([self.vert(c + Vector((r * 1.15 * math.cos(b), 0.0, r * math.sin(b))), 'cf_head')
                         for b in (2 * math.pi * s / HSEG for s in range(HSEG))])
            refs.append(c)
        self.grid(rows, p['slot'], refs)

    def topknot(self, p):
        B = self.B
        cy, zt, R, tall = B.head_cy + 0.01, B.head_top - 0.012 - p.get('sink', 0.0), p.get('r', 0.03), p.get('tall', 1.0)
        specs = []
        for k in range(9):  # 아래는 머리에 묻히고 위로 둥근 혹(tall 만큼 위로 길쭉)
            ph = -0.2 + (math.pi / 2 + 0.2) * k / 8
            sz = math.sin(ph)
            specs.append((zt + R * (0.7 + sz * (tall if sz > 0 else 1.0)), max(0.002, R * math.cos(ph))))
        self._rings(specs, p['slot'], cy)

    def gat(self, p):
        B = self.B
        cy = B.head_cy
        zb = B.eye_z + 0.075                 # 갓 양태(챙) 높이 — 망건 위
        zc = B.head_top + 0.10               # 대우(모자 통) 꼭대기
        brim = [(zb - 0.012 * (k / 5) ** 2, 0.082 + (0.21 - 0.082) * k / 5) for k in range(6)]
        # 챙은 안쪽 → 바깥 고리(높이 거의 같음). _rings 는 z 로 기준점을 잡으니 아래에서 위로 볼 기준을 따로 준다
        rows = [[self.vert((r * math.cos(2 * math.pi * s / HSEG), cy + r * math.sin(2 * math.pi * s / HSEG), z), 'cf_head')
                 for s in range(HSEG)] for z, r in brim]
        self.grid(rows, p['slot'], Vector((0, cy, zb - 0.2)))
        crown = [(zb + (zc - zb) * k / 6, 0.078 - 0.006 * k / 6) for k in range(7)] + [(zc, 0.05), (zc, 0.02), (zc, 0.002)]
        self._rings(crown, p['slot'], cy)

    def _dome(self, ease, brow, dome, cy=None):
        """이마(눈 + brow)부터 머리 살을 따라 올라가 둥글게 닫는 고리들 → (고리, 꼭대기 높이)."""
        B = self.B
        specs = [(z, self._head_ring(z, ease, cy)) for z in np.linspace(B.eye_z + brow, B.head_top - 0.02, 5)]
        rtop = specs[-1][1]
        for k in range(1, 6):
            f = k / 5
            specs.append((B.head_top - 0.02 + dome * math.sin(f * math.pi / 2), rtop * math.cos(f * math.pi / 2) + 0.003))
        return specs, B.head_top - 0.02 + dome

    @staticmethod
    def _front_arc(half):
        """얼굴 앞(각 270°) ±half 도 안의 둘레 칸 — 왼쪽 끝부터 이어지게."""
        return sorted((s for s in range(HSEG) if abs(((360 * s / HSEG) - 270 + 180) % 360 - 180) <= half),
                      key=lambda s: ((360 * s / HSEG) - (270 - half)) % 360)

    def helmet(self, p):
        """투구 사발 — `knob` 꼭지, `visor` 앞챙 길이(m)."""
        B = self.B
        cy = B.head_cy
        specs, self.top_z = self._dome(p.get('ease', 0.02), p.get('brow', 0.04), p.get('dome', 0.035))
        if p.get('knob', True):
            specs += [(B.head_top + 0.02 + 0.04 * k / 3, 0.008 - 0.002 * k) for k in range(1, 4)]
            self.top_z = B.head_top + 0.06
        self._rings(specs, p['slot'], cy)
        if p.get('visor'):
            z0, r0 = specs[0]
            arc = self._front_arc(70)
            rows = []
            for f in (0.0, 0.6, 1.0):
                rows.append([self.vert(((r0[s] + p['visor'] * f) * math.cos(2 * math.pi * s / HSEG),
                                        cy + (r0[s] + p['visor'] * f) * math.sin(2 * math.pi * s / HSEG), z0 - 0.012 * f * f), 'cf_head')
                             for s in arc])
            self.grid(rows, p['slot'], Vector((0, cy, z0 + 0.2)), closed=False)

    def crown(self, p):
        """천 모자 몸통(챙 모자·비니) — 이마(눈 + brow)부터 머리를 따라 올라가 둥글게 닫는다(`ease` 는 머리카락 두께 넘게).
        `cuff`(높이 m) 면 밑단에 접어 올린 단(비니). 살 껍데기 모자는 가장자리가 톱니·구김으로 보였다(09-27 61벌 점검)."""
        B = self.B
        cy = B.head_cy + p.get('back', 0.0)
        specs, self.top_z = self._dome(p.get('ease', 0.022), p.get('brow', 0.05), p.get('dome', 0.028), cy)
        fixed, prev = [], None   # 머리 둘레를 그대로 따르면 중간에 턱이 져 두 층 머핀처럼 보였다 — 위로 갈수록 안 넓어지게, 둘레도 고르게
        for z, r in specs:
            r = np.asarray(r, dtype=float) if not np.isscalar(r) else np.full(HSEG, float(r))
            for _ in range(2):
                r = (np.roll(r, 1) + 2 * r + np.roll(r, -1)) / 4
            if prev is not None:
                r = np.minimum(r, prev)
            fixed.append((z, r))
            prev = r
        specs = fixed
        if p.get('cuff'):
            z0, r0 = specs[0]
            e = p.get('cuff_ease', 0.007)
            specs = [(z0 - 0.004, r0 + e * 0.6), (z0, r0 + e), (z0 + p['cuff'] * 0.5, self._head_ring(z0 + p['cuff'] * 0.5, p.get('ease', 0.022), cy) + e),
                     (z0 + p['cuff'], self._head_ring(z0 + p['cuff'], p.get('ease', 0.022), cy) + e * 0.7)] + specs[1:]
        self._rings(specs, p['slot'], cy)

    def visor(self, p):
        """모자 앞챙 — 이마(눈 + z) 둘레에서 앞으로 `length`(가운데, 옆으로 갈수록 짧다), 끝이 `droop` 만큼 처진다. 위·아래 두 겹(뒷면 안 그림 엔진)."""
        B = self.B
        cy = B.head_cy + p.get('back', 0.0)
        z0 = B.eye_z + p.get('z', 0.05)
        r0 = self._head_ring(z0, p.get('ease', 0.024), cy)
        arc = self._front_arc(p.get('half', 80))
        for dz, ref_dz in ((0.0, -0.3), (-p.get('thick', 0.004), 0.3)):
            rows = []
            for f in (0.0, 0.35, 0.7, 1.0):
                row = []
                for s in arc:
                    a = 2 * math.pi * s / HSEG
                    w = max(0.0, math.cos(a - math.radians(270)))
                    rr = r0[s] + p['length'] * (0.2 + 0.8 * w ** p.get('taper', 0.7)) * f   # taper 크면 가운데만 길다(챙 모자 — 옆까지 길면 버킷햇)
                    row.append(self.vert((rr * math.cos(a), cy + rr * math.sin(a), z0 + dz - p.get('droop', 0.012) * f * f), 'cf_head'))
                rows.append(row)
            self.grid(rows, p['slot'], Vector((0, cy, z0 + ref_dz)), closed=False)

    def neckguard(self, p):
        """뒤·옆 드림(비늘 목가리개·시코로) — 얼굴 앞 ±`open` 도는 튼다, `flare` 아래로 벌어짐, `drop` 길이."""
        B = self.B
        cy = B.head_cy + 0.01
        z0 = B.eye_z + p.get('z', 0.045)
        r0 = self._head_ring(z0, p.get('ease', 0.026))
        half = p.get('open', 75)
        arc = [s for s in range(HSEG) if abs(((360 * s / HSEG) - 270 + 180) % 360 - 180) > half]
        arc.sort(key=lambda s: ((360 * s / HSEG) - (270 + half)) % 360)  # 트인 곳 바로 뒤에서 시작해야 앞을 가로지르는 면이 안 생긴다
        rows, refs = [], []
        drop, flare = p.get('drop', 0.13), p.get('flare', 0.35)
        for k in range(6):
            z = z0 - drop * k / 5
            rr = r0 * (1 + flare * (k / 5) ** 1.3)
            rows.append([self.vert((rr[s] * math.cos(2 * math.pi * s / HSEG), cy + rr[s] * math.sin(2 * math.pi * s / HSEG), z), 'cf_head')
                         for s in arc])
            refs.append(Vector((0, cy, z)))
        self.grid(rows[::-1], p['slot'], refs[::-1], closed=False)
        self.cover.append(('neckguard',))

    def kuwagata(self, p):
        """이마 앞 V 자로 솟는 납작한 뿔 둘(가부토 앞장식)."""
        B = self.B
        z0 = B.eye_z + p.get('z', 0.05)
        r0 = self._head_ring(z0, 0.03)
        y0 = B.head_cy - r0[int(0.75 * HSEG)] - 0.008
        L, spread, wd = p.get('length', 0.17), p.get('spread', 0.1), p.get('width', 0.026)
        for sx in (-1, 1):
            rows, refs = [], []
            for k in range(11):
                t = k / 10
                P = Vector((sx * (0.01 + spread * t ** 1.5), y0 - 0.02 * t, z0 + L * t))
                d = Vector((sx * spread * 1.5 * max(t, 0.02) ** 0.5, -0.02, L)).normalized()
                wv = Vector((d.z, 0, -d.x)).normalized()   # 곡선에 수직(앞에서 본 판의 너비)
                w = wd * (1 - 0.6 * t) + 0.003
                rows.append([self.vert(P - wv * (w / 2), 'cf_head'), self.vert(P + wv * (w / 2), 'cf_head')])
                refs.append(P + Vector((0, 0.1, 0)))
            self.grid(rows, p['slot'], refs, closed=False)

    def tassel(self, p):
        """투구 꼭대기 붉은 술 — 위가 좁고 아래로 퍼져 늘어진 실 다발."""
        B = self.B
        z0 = getattr(self, 'top_z', B.head_top + 0.015)
        specs = [(z0 - 0.045, 0.085), (z0 - 0.02, 0.07), (z0 + 0.01, 0.048), (z0 + 0.04, 0.026), (z0 + 0.065, 0.012), (z0 + 0.08, 0.007),
                 (z0 + 0.1, 0.009), (z0 + 0.112, 0.006), (z0 + 0.115, 0.001)]
        self._rings(specs, p['slot'], B.head_cy)

    def _wing(self, c, a, b, slot, n=HSEG, tilt=0.0, sx=1):
        """앞뒤를 보는 납작한 타원 판(사모 날개) — 중심 c, 가로 반지름 a, 세로 b. tilt 도만큼 안쪽 끝을 축으로 바깥이 들린다."""
        ca, sa = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
        piv = c - Vector((sx * a, 0, 0))
        rows = []
        for f in (0.05, 0.45, 0.8, 1.0):
            ring = []
            for t in (2 * math.pi * s / n for s in range(n)):
                dx, dz = a + a * f * math.cos(t), b * f * math.sin(t)     # 안쪽 끝(piv)에서 잰 자리
                ring.append(self.vert(piv + Vector((sx * (dx * ca - dz * sa), 0, dx * sa + dz * ca)), 'cf_head'))
            rows.append(ring)
        self.grid(rows, slot, c + Vector((0, 0.1, 0)))

    def samo(self, p):
        """사모 — 앞이 낮고 뒤가 솟은 두 층 모자 + 뒤 양옆 둥근 날개."""
        B = self.B
        cy = B.head_cy
        specs, top = self._dome(0.013, 0.03, 0.02)
        self._rings(specs, p['slot'], cy)
        cb, rb = cy + 0.035, 0.07          # 뒤 높은 층
        back = [(B.head_top - 0.04, rb), (B.head_top + 0.02, rb * 0.98)]
        for k in range(1, 6):
            f = k / 5
            back.append((B.head_top + 0.02 + 0.035 * math.sin(f * math.pi / 2), rb * 0.98 * math.cos(f * math.pi / 2) + 0.002))
        self._rings(back, p['slot'], cb)
        wa, wb = p.get('wing', (0.078, 0.026))
        tilt = p.get('tilt', 0.0)
        for sx in (-1, 1):
            self._wing(Vector((sx * (rb - 0.01 + wa), cb + 0.02, B.head_top + 0.008 + (0.01 if tilt else 0))), wa, wb, p['slot'], tilt=tilt, sx=sx)

    def myeollyu(self, p):
        """면류관 — 머리를 감싼 검은 관 + 위 앞뒤로 긴 판(앞으로 살짝 숙임)."""
        B = self.B
        cy = B.head_cy
        specs = [(z, self._head_ring(z, 0.014)) for z in np.linspace(B.eye_z + 0.05, B.head_top - 0.01, 5)]
        rtop = specs[-1][1]
        specs += [(B.head_top + 0.04, rtop * 0.9), (B.head_top + 0.05, rtop * 0.6), (B.head_top + 0.052, rtop * 0.03)]
        self._rings(specs, p['slot'], cy)
        zb, hx, hy = B.head_top + 0.055, 0.085, 0.17
        self.board = (zb, hx, hy, cy)
        rows = []
        for f in (0.05, 0.5, 0.85, 1.0):
            ring = []
            for s in range(HSEG):
                t = 2 * math.pi * s / HSEG
                cx_, cy_ = math.cos(t), math.sin(t)
                m = max(abs(cx_), abs(cy_))
                x, y = hx * f * cx_ / m, hy * f * cy_ / m          # 둥근 원 → 네모 둘레
                ring.append(self.vert((x, cy + y, zb - 0.06 * y), 'cf_head'))   # 앞(-Y)이 내려간다
            rows.append(ring)
        self.grid(rows, p['slot'], Vector((0, cy, zb - 0.2)))

    def beads(self, p):
        """면류관 판 앞뒤 끝에서 늘어진 구슬 줄 — 줄마다 좁은 띠(앞을 보는 판)."""
        zb, hx, hy, cy = self.board
        n = p.get('count', 9)
        for yy in (-hy, hy):
            z0 = zb - 0.06 * yy
            for j in range(n):
                x = -hx * 0.9 + 1.8 * hx * j / (n - 1)
                L = p.get('length', 0.13)
                rows = [[self.vert((x - 0.0035, cy + yy, z0 - L * k / 4), 'cf_head'), self.vert((x + 0.0035, cy + yy, z0 - L * k / 4), 'cf_head')]
                        for k in range(5)]
                self.grid(rows, p['slot'], [Vector((x, cy + yy * 2, z0))] * 5, closed=False)

    def eboshi(self, p):
        """에보시 — 이마 둘레에서 위로 솟으며 뒤로 기울고 옆으로 납작해지는 관."""
        B = self.B
        cy = B.head_cy
        rows, refs = [], []
        base = self._head_ring(B.eye_z + 0.05, 0.012)
        H = p.get('height', 0.24)
        for k in range(12):
            f = k / 11
            z = B.eye_z + 0.05 + (B.head_top + H - B.eye_z - 0.05) * f
            yc = cy + 0.07 * f * f                       # 뒤로 기운다
            ring = []
            for s in range(HSEG):
                a = 2 * math.pi * s / HSEG
                r0 = base[s]
                rx = r0 * (1 - 0.45 * f) * abs(math.cos(a))
                ry = r0 * (1 - 0.15 * f) * abs(math.sin(a))
                rr = math.hypot(rx, ry) * (1 - 0.9 * max(0.0, f - 0.85) / 0.15)
                ring.append(self.vert((rr * math.cos(a), yc + rr * math.sin(a), z), 'cf_head'))
            rows.append(ring)
            refs.append(Vector((0, yc, z - 0.05)))
        self.grid(rows, p['slot'], refs)

    def sash(self, p):
        """비스듬한 띠(토가) — 왼쪽(+X) 위 `top` 에서 오른쪽 아래 `bottom` 으로 몸을 한 바퀴 두른다."""
        B = self.B
        zt, zb = B.level(p['top']), B.level(p['bottom'])
        zm, hh = (zt + zb) / 2, (zt - zb) / 2
        rows = []
        for dz in (-p['width'] / 2, 0.0, p['width'] / 2):
            ring = []
            for s in range(SEG):
                a = 2 * math.pi * s / SEG
                z = zm + hh * math.cos(a) + dz
                pts = B.band_pts(B.torso, z, 0.03)
                rr = ring_radii(pts, B.cx, B.cy, SEG, 0.0) if pts else None
                r = rr[s] if rr is not None else 0.15
                for zs, RR in self.tubes:
                    if zs[0] <= z <= zs[-1]:
                        k = min(range(len(zs)), key=lambda i: abs(zs[i] - z))
                        r = max(r, RR[k][s])
                r += p.get('over', 0.02) * (1.3 if dz == 0.0 else 1.0)
                ring.append(self.vert((B.cx + r * math.cos(a), B.cy + r * math.sin(a), z), 'cf_torso'))
            rows.append(ring)
        self.grid(rows, p['slot'], Vector((B.cx, B.cy, zm)))

    def beret(self, p):
        """베레모 — 이마 위 좁은 띠에서 머리 밖으로 둥글게 부풀어 납작하게 닫힌다. `tilt`(m) 만큼 부푼 몸이 +X 쪽으로 쏠리고 그쪽이 처진다.
        살 껍데기(shell) 모자는 가장자리가 톱니처럼 잘렸다(09-27 렌더)."""
        B = self.B
        cy, ease, tilt = B.head_cy + 0.005, p.get('ease', 0.028), p.get('tilt', 0.03)
        z0 = B.eye_z + p.get('z', 0.05)
        zt = B.head_top + p.get('dome', 0.035)
        band = self._head_ring(z0, ease)
        wide = self._head_ring(min(z0 + 0.03, B.head_top - 0.012), ease) + p.get('puff', 0.045)
        # (높이, 반지름, 쏠림 몫, 처짐 몫) — 띠 두 줄, 부푼 둘레(zw)부터 타원으로 닫는다(곧은 벽이면 원통 모자로 보였다)
        zw = z0 + 0.03
        specs = [(z0, band, 0.0, 0.0), (z0 + 0.012, self._head_ring(z0 + 0.012, ease + 0.001), 0.1, 0.1), (zw - 0.006, wide * 0.9 + band * 0.1, 0.6, 0.7)]
        for k in range(8):
            t = (math.pi / 2) * k / 7
            specs.append((zw + (zt - zw) * math.sin(t), wide * max(math.cos(t), 0.03), 1.0, 1.0 - 0.6 * math.sin(t)))
        rows, refs = [], []
        ta = math.radians(p.get('tilt_a', 0))   # 쏠림 방향(0 = +X 옆, 270 = 앞 — 납작 모자)
        for z, r, fs, fd in specs:
            dx, dy = tilt * fs * math.cos(ta), tilt * fs * math.sin(ta)
            ring = []
            for s in range(HSEG):
                a = 2 * math.pi * s / HSEG
                ring.append(self.vert((dx + r[s] * math.cos(a), cy + dy + r[s] * math.sin(a), z - p.get('droop', 0.025) * fd * max(0.0, math.cos(a - ta))), 'cf_head'))
            rows.append(ring)
            refs.append(Vector((dx, cy + dy, z - 0.05)))
        self.grid(rows, p['slot'], refs)
        self.top_z = zt

    def turban(self, p):
        """터번 — 이마부터 머리를 감싸며 부풀었다가 위에서 닫힌다."""
        B = self.B
        cy = B.head_cy
        z0, z1 = B.eye_z + 0.03, B.head_top + 0.07
        base = self._head_ring(z0, 0.02)
        specs = []
        for k in range(9):
            f = k / 8
            z = z0 + (z1 - z0) * f
            rh = self._head_ring(min(z, B.head_top - 0.01), 0.02)
            r = np.maximum(rh, base * 0.7) * (1 + 0.28 * math.sin(math.pi * min(1.0, f * 1.4)))
            if f > 0.75:
                r = r * math.cos((f - 0.75) / 0.25 * math.pi / 2) + 0.002
            specs.append((z, r))
        self._rings(specs, p['slot'], cy)

    def boktu(self, p):
        """복두 — 네모진 두 층 모자 + 뒤 양옆으로 길고 곧게 뻗은 날개."""
        B = self.B
        cy = B.head_cy
        sqz = np.array([1 + 0.1 * abs(math.cos(2 * (2 * math.pi * s / HSEG))) for s in range(HSEG)])   # 네 모서리를 부풀려 네모지게
        specs = [(z, self._head_ring(z, 0.014) * sqz) for z in np.linspace(B.eye_z + 0.05, B.head_top - 0.01, 5)]
        rtop = specs[-1][1]
        specs += [(B.head_top + 0.012, rtop * 0.96), (B.head_top + 0.02, rtop * 0.75), (B.head_top + 0.024, rtop * 0.4),
                  (B.head_top + 0.025, rtop * 0.03)]
        self._rings(specs, p['slot'], cy)
        cb, rb, zt = cy + 0.04, 0.066, B.head_top + 0.075
        back = [(B.head_top - 0.03, rb * sqz), (zt - 0.012, rb * sqz), (zt - 0.003, rb * 0.8 * sqz), (zt, rb * 0.4 * sqz), (zt, rb * 0.02 * sqz)]
        self._rings(back, p['slot'], cb)
        L, wd, zw, yw = p.get('length', 0.34), 0.03, B.head_top + 0.035, cb + 0.045
        for sx in (-1, 1):
            rows = []
            for k in range(12):
                x = sx * (0.05 + L * k / 11)
                w = wd * (1 - 0.25 * k / 11)
                rows.append([self.vert((x, yw, zw - w / 2), 'cf_head'), self.vert((x, yw, zw + w / 2), 'cf_head')])
            self.grid(rows, p['slot'], Vector((0, yw + 0.1, zw)), closed=False)

    # -- 마무리 --
    def finish(self):
        for f in self.bm.faces:
            f.smooth = True
        self.bm.normal_update()
        for f, c0 in self.ref.items():
            if f.normal.dot(f.calc_center_median() - c0) < 0:
                f.normal_flip()
        me = bpy.data.meshes.new('cf_garment')
        self.bm.to_mesh(me)
        ob = bpy.data.objects.new('cf_garment', me)
        bpy.context.scene.collection.objects.link(ob)
        vg = {n: ob.vertex_groups.new(name=n) for n in sorted(set(self.grp.values()))}
        for v, g in self.grp.items():
            vg[g].add([v.index], 1.0, 'REPLACE')
        self.bm.free()
        md = ob.modifiers.new('solid', 'SOLIDIFY')  # 두께(안쪽 면) — 소매 속·단 속이 비어 보이지 않게. 사각형만 남는다
        md.thickness, md.offset, md.use_rim = 0.004, -1.0, True
        with build_real.build.ctx(ob, [ob]):
            bpy.ops.object.modifier_apply(modifier=md.name)
        return ob

    def delete_group(self):
        """옷에 덮이는 살 — 빌드가 지워 뚫림을 막는다(목·손·발은 남기고, 머리는 hairdome 이 덮은 두피만)."""
        B = self.B
        idx = []
        tubes = [c for c in self.cover if c[0] == 'tube']
        legs = [c for c in self.cover if c[0] == 'leggings']
        full = any(c[0] == 'sleeves' and c[1] >= 0.95 for c in self.cover)
        wz = {s: B.bone(f'hand_{s}') for s in 'lr'}
        collars = [c for c in self.cover if c[0] == 'collar']
        for i in B.body:
            w, z = B.W[i], B.co[i].z
            if w.get('neck_01', 0) >= 0.25 and any(c[1] - 0.005 <= z <= c[2] - 0.012 for c in collars):   # 목폴라 깃 밑 목 살
                idx.append(i)
            elif part_sum(w, ['pelvis', 'spine_0*', 'clavicle_*', 'thigh_*', 'calf_*']) >= 0.5:
                top_ok = lambda c: z <= (B.lv['neck'] - 0.04 if c[3] else c[2] - 0.02)  # noqa: E731
                if any(c[1] + 0.03 <= z and top_ok(c) for c in tubes):
                    idx.append(i)
                elif part_sum(w, ['thigh_*', 'calf_*']) >= 0.5 and any(c[1] + 0.03 <= z <= c[2] - 0.02 for c in legs):
                    idx.append(i)
            elif full and part_sum(w, ['upperarm_*', 'lowerarm_*']) >= 0.5:
                if (B.co[i] - wz['l' if B.co[i].x > 0 else 'r']).length > 0.07:
                    idx.append(i)
        sc = getattr(self, 'scalp_cover', None)
        if sc:                                # 머리 덮개 밑 두피 — 머리선에서 0.1 rad(약 9mm) 안쪽부터, 귀는 남긴다
            for i in B.head:
                v = B.co[i] - sc['C']
                t = math.atan2(v.y, v.x) % (2 * math.pi)
                s = int(t / (2 * math.pi) * HSEG) % HSEG
                if s not in sc['cols'] or (abs(math.cos(t)) > 0.55 and B.co[i].z < B.eye_z + 0.05):
                    continue
                f = math.atan2(v.z, math.hypot(v.x, v.y))
                f0, f1 = sc['cols'][s]
                if f0 + 0.1 < f and (f < f1 - 0.1 or not sc['opened']):
                    idx.append(i)
        g = B.bm.vertex_groups.new(name='cf_delete')
        g.add(idx, 1.0, 'REPLACE')
        return g.name, len(idx)


# ---- 천 그림 ----
def paint(g, dpath, npath):
    rng = np.random.default_rng(20260926)
    H = W = TEX
    img = np.zeros((H, W, 3), np.float32) + 128
    hgt = np.zeros((H, W), np.float32)   # 노멀 그림용 높이
    yy, xx = np.mgrid[0:H, 0:W]
    U, V = xx / W, 1 - yy / H
    noise = rng.normal(0, 1, (H, W)).astype(np.float32)
    extra = [dict(slot=p['strap_slot'], paint=dict(base=p['paint'].get('strap', p['paint']['base']), pattern='weave'))   # 배낭 끈 칸
             for p in g['parts'] if p.get('strap_slot') is not None]
    for p in list(g['parts']) + extra:
        P = p['paint']
        u0, v0, u1, v1 = SLOTS[p['slot']]
        m = (U >= u0) & (U < u1) & (V >= v0) & (V < v1)
        s = (U - u0) / (u1 - u0)
        t = ((V - v0) / (v1 - v0) - 0.02) / 0.96
        base = hexrgb(P['base'])
        pat = P.get('pattern', 'weave')
        shade = np.ones((H, W), np.float32)
        h = np.zeros((H, W), np.float32)
        if pat in ('weave', 'mesh', 'hair'):
            f = 0.9 if pat == 'weave' else 0.5
            wv = np.sin(xx * f) * np.sin(yy * f)
            shade = 1 + 0.05 * wv + 0.035 * noise
            h = 0.3 * wv
            if pat == 'hair':
                shade = 1 + 0.12 * np.sin(xx * 0.35 + noise * 0.8)
                h = np.sin(xx * 0.35)
        elif pat == 'sleek':                         # 빗어 넘긴 머리 — 가는 결, 요철 약하게(hair 는 뜨개처럼 보였다)
            shade = 1 + 0.07 * np.sin(xx * 1.3 + np.sin(yy * 0.02) * 2.0) + 0.02 * noise
            h = 0.15 * np.sin(xx * 1.3)
        elif pat == 'quilt':
            ln = (np.abs(((t * 40) % 1) - 0.5) < 0.06)
            shade = 1 - 0.18 * ln + 0.03 * noise
            h = -ln.astype(np.float32)
        elif pat == 'brocade':                       # 금란 — 엇갈린 마름모 꽃 무늬(motif 색)
            px, py = P.get('per', (48, 48))
            cu, cv = (xx % px) / px, ((yy + py / 2 * ((xx // px) % 2)) % py) / py
            dia = np.abs(cu - 0.5) + np.abs(cv - 0.5)
            petal = (dia < 0.26) & (dia > 0.12) | (dia < 0.05)
            shade = 1 + 0.04 * np.sin(xx * 0.9) * np.sin(yy * 0.9) + 0.03 * noise
            h = 0.25 * np.sin(xx * 0.9) * np.sin(yy * 0.9) + 0.5 * petal
        elif pat == 'stripes':                       # 가는 세로 줄(하카마)
            ln = (xx % 22) < 3
            shade = 1 - 0.22 * ln + 0.03 * noise + 0.03 * np.sin(yy * 0.9)
            h = -0.4 * ln
        elif pat == 'leaf':                          # 잎 — 톱니마다 가운데 잎맥 + 비스듬한 곁맥(teeth 개수에 맞춘다)
            nt = P.get('teeth', 9)
            u = (s * nt) % 1.0
            mid = np.abs(u - 0.5) < 0.012
            side = np.abs(((np.abs(u - 0.5) * 2.2 + t * 6) % 1.0) - 0.5) < 0.03
            shade = 1 - 0.16 * mid - 0.08 * side + 0.04 * noise
            h = -0.6 * mid - 0.3 * side
        elif pat == 'knit':                          # 골진 뜨개(목폴라) — 가는 세로 골, 결 부드럽게
            cr = np.sin(xx * 0.6)
            shade = 1 + 0.07 * cr + 0.03 * noise
            h = 0.5 * cr
        elif pat == 'ribs':                          # 세로 골(투구 사발·정강이 판)
            n_ = P.get('ribs', 24)
            cr = np.cos(s * 2 * math.pi * n_)
            shade = 0.9 + 0.14 * cr + 0.03 * noise
            h = cr
        elif pat == 'odoshi':                        # 옻칠 판 줄마다 색 끈을 촘촘히 세로로 엮는다
            rows_ = P.get('rows', 7)
            tr = t * rows_
            fv = tr % 1
            fu = (s * P.get('cols', 64)) % 1
            lace_m = (fu < 0.58) & (fv > 0.1) & (fv < 0.9)
            gap = fv < 0.07
            shade = np.where(lace_m, 0.85 + 0.25 * np.sin(fu / 0.58 * math.pi), 0.75 + 0.35 * (1 - fv)) - 0.4 * gap + 0.03 * noise
            h = np.where(lace_m, 0.6 * np.sin(fu / 0.58 * math.pi), 0.3 * (1 - fv)) - gap
        elif pat == 'scale':                         # 어린갑 — 아래가 둥근 비늘을 엇갈려 겹친다
            rows_, cols_ = 30, 44
            tr = t * rows_
            row = np.floor(tr)
            sc = s * cols_ + 0.5 * (row % 2)
            fu, fv = sc % 1, tr % 1
            edge = np.clip(0.55 - np.hypot(fu - 0.5, np.maximum(0.62 - fv, 0) * 0.9), 0, None)
            plate = np.clip(edge / 0.1, 0, 1)
            shade = 0.5 + 0.45 * plate + 0.15 * fv * plate + 0.03 * noise
            h = plate * (0.4 + 0.6 * fv)
        elif pat == 'mail':                          # 사슬 — 엇갈린 작은 고리
            cu = (xx % 10) / 10
            cv = ((yy + 5 * ((xx // 10) % 2)) % 10) / 10
            rr_ = np.hypot(cu - 0.5, cv - 0.5)
            ring_ = (rr_ > 0.22) & (rr_ < 0.42)
            shade = np.where(ring_, 1.05 + 0.1 * noise, 0.45)
            h = ring_ * 1.0
        elif pat == 'wrap':                          # 감은 천 — 비스듬한 겹
            ph = (s * 14 + t * 5) % 1
            shade = 0.82 + 0.25 * np.sin(ph * math.pi) + 0.03 * noise
            h = np.sin(ph * math.pi)
        elif pat == 'beads':                         # 구슬 줄 — 세로로 구슬(motif 색 섞어)과 끈
            fb = (t * P.get('count', 9)) % 1
            bead = np.abs(fb - 0.5) < 0.38
            shade = np.where(bead, 0.8 + 0.4 * np.sin(fb * math.pi), 0.35)
            h = bead * np.sin(fb * math.pi)
        elif pat == 'studs':                         # 가죽 띠에 박은 둥근 장식(각대)
            cu = (xx % 90) / 90
            stud = np.hypot(cu - 0.5, (t - 0.5) * 2.2) < 0.18
            shade = 1 + 0.03 * noise
            h = stud * 1.0
        elif pat in ('lamellar', 'plate'):
            if pat == 'plate':
                shade = 1 + 0.025 * noise + 0.07 * np.sin(t * 5)
                h = 0.05 * noise
            else:
                rows_, cols_ = 26, 46
                tr = t * rows_
                row = np.floor(tr)
                sc = s * cols_ + 0.5 * (row % 2)
                fu, fv = sc % 1, tr % 1
                edge = np.minimum(np.minimum(fu, 1 - fu) * 1.6, np.minimum(fv, 1 - fv))   # 판 가장자리까지 거리
                plate = np.clip(edge / 0.12, 0, 1)
                shade = 0.55 + 0.45 * plate + 0.18 * (1 - fv) * plate + 0.03 * noise   # 판 위쪽이 밝다(겹친 비늘)
                h = plate * (1 - 0.6 * fv)
        col = base[None, None, :] * shade[..., None]
        img[m] = col[m]
        hgt[m] = h[m]
        if pat == 'lamellar':  # 비늘을 꿴 끈
            holes = m & (np.abs(fu - 0.5) < 0.06) & (np.abs(fv - 0.22) < 0.07)
            img[holes] = hexrgb(P.get('lace', LACE))
        elif pat == 'odoshi':
            lm = m & lace_m
            img[lm] = (hexrgb(P['lace'])[None, :] * shade[lm][:, None])
        elif pat == 'brocade':
            pm = m & petal
            img[pm] = hexrgb(P['motif'])[None, :] * (1 + 0.05 * noise[pm])[:, None]
        elif pat == 'beads':
            alt = m & bead & ((np.floor(t * P.get('count', 9)) % 2) == 1)
            img[alt] = hexrgb(P['motif'])[None, :] * shade[alt][:, None]
        elif pat == 'studs':
            sm = m & stud
            img[sm] = hexrgb(P['motif'])

        def fill(mask, colr):
            mm = m & mask
            img[mm] = hexrgb(colr) * (1 + 0.04 * noise[mm])[:, None]
            hgt[mm] = 0.4

        for tr_ in P.get('trims', []):
            k = tr_[0]
            if k == 'bottom':
                fill(t < tr_[1] * 4, tr_[2])       # 칸 높이 몫(4 = 1m 쯤)
            elif k == 'top':
                fill(t > 1 - tr_[1] * 4, tr_[2])
            elif k == 'split':                      # 앞뒤 트임 줄(비늘 치마)
                fill((np.abs(s - 0.75) < tr_[1]) | (np.abs(s - 0.25) < tr_[1]), tr_[2])
            elif k == 'panels':                     # 쿠사즈리 — n 장 판 사이 틈
                fu_ = (s * tr_[1] + 0.5) % 1
                fill((fu_ < tr_[2] * tr_[1]) | (fu_ > 1 - tr_[2] * tr_[1]), tr_[3])
            elif k == 'front':                      # 앞 가운데 세로 띠(카프탄 여밈·드레스 가슴)
                fill(np.abs(s - 0.75) < tr_[1], tr_[2])
            elif k == 'buttons':                    # 단추 두 줄(앞 가운데 ±0.035), t0~t1 사이 여섯 쌍
                for sc_ in (0.715, 0.785):
                    for j in range(6):
                        tc_ = tr_[2] + (tr_[3] - tr_[2]) * j / 5
                        fill(np.hypot((s - sc_) * 3.0, t - tc_) < 0.012, tr_[1])
            elif k == 'roundel':                    # 둥근 금빛 보 — 가슴·등(t = tr_[2])과 두 어깨
                for sc_, tc_, rr_ in ((0.75, tr_[2], 0.07), (0.25, tr_[2], 0.07), (0.0, 0.955, 0.04), (0.5, 0.955, 0.04)):
                    ds = np.minimum(np.abs(s - sc_), 1 - np.abs(s - sc_))
                    d = np.hypot(ds / rr_, (t - tc_) / (rr_ * 0.75))
                    fill(d < 1.0, tr_[1])
                    fill((d < 0.72) & (d > 0.6), '#7a1a1a')
                    fill(d < 0.25, '#7a1a1a')
            elif k == 'patch':                      # 흉배 — 가슴(s 0.75)·등(s 0.25) 네모, 금 테두리와 가운데 둥근 무늬
                t0, t1 = tr_[3], tr_[4]
                hw = (t1 - t0) * 0.7
                for sc_ in (0.75, 0.25):
                    inside = (np.abs(s - sc_) < hw) & (t > t0) & (t < t1)
                    fill(inside, tr_[2])
                    fill((np.abs(s - sc_) < hw * 0.85) & (t > t0 + hw * 0.3) & (t < t1 - hw * 0.3), tr_[1])
                    fill(np.hypot((s - sc_) / hw, (t - (t0 + t1) / 2) / (hw * 1.2)) < 0.35, tr_[2])
            elif k == 'cross':                      # 왼깃이 오른쪽으로 내려와 덮는다(교령 우임) — 앞 가운데 s 0.75
                wk = tr_[2] if len(tr_) > 2 else 1.0   # 너비 몫(저고리 동정은 가늘게)
                for (sa, ta), (sb, tb), wdt in (((0.70, 1.0), (0.83, 0.62), 0.022 * wk), ((0.80, 1.0), (0.755, 0.80), 0.017 * wk)):
                    q = np.clip(((s - sa) * (sb - sa) + (t - ta) * (tb - ta)) / ((sb - sa) ** 2 + (tb - ta) ** 2), 0, 1)
                    dist = np.hypot(s - (sa + q * (sb - sa)), (t - (ta + q * (tb - ta))) * 0.6)
                    fill(dist < wdt, tr_[1])
            elif k == 'ribbon':                     # 고름 — 깃 끝에서 늘어진 두 가닥
                for ds, ln in ((0.0, 0.55), (0.018, 0.45)):
                    fill((np.abs(s - (0.835 + ds)) < 0.009) & (t < 0.62) & (t > 0.62 - ln), tr_[1])
    # 노멀 그림 — 높이 기울기
    gy, gx = np.gradient(hgt)
    k = 2.0
    nx, ny = -gx * k, gy * k
    nz = np.ones_like(nx)
    ln_ = np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([nx / ln_, ny / ln_, nz / ln_], axis=2) * 0.5 + 0.5
    for arr, path in ((np.clip(img, 0, 255) / 255.0, dpath), (nrm, npath)):
        rgba = np.concatenate([arr, np.ones((H, W, 1), np.float32)], axis=2)[::-1]   # Blender 이미지는 아래 줄부터
        im = bpy.data.images.new(os.path.basename(path), W, H, alpha=False)
        if path == npath:
            im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(rgba.astype(np.float32).ravel())
        im.filepath_raw = path
        im.file_format = 'PNG'
        im.save()


def resolve(g, cols=None):
    """틀의 색 칸('C1'·'C2')을 헥스로 바꾼 부품 목록. cols = 변형 색(앞에서부터 C1, C2 …)."""
    cmap = dict(g.get('colors', {}))
    for k, c in zip(sorted(cmap), cols or []):
        cmap[k] = c
    sub = lambda v: cmap.get(v, v) if isinstance(v, str) else [sub(x) for x in v] if isinstance(v, (list, tuple)) else v  # noqa: E731
    return dict(g, parts=[dict(p, paint={k: sub(v) for k, v in p['paint'].items()}) for p in g['parts']])


def write_mhmat(path, name, g):
    pats = [p['paint'].get('pattern') for p in g['parts']]
    metal = any(x in METAL_PATTERNS for x in pats)
    rough = 0.55 if metal else 0.7 if 'odoshi' in pats else 0.9
    open(path, 'w', encoding='utf-8', newline='\n').write(f"""# char-forge garments.py material (CC0)
name {name}
license CC0
author char-forge
diffuseColor 1.0 1.0 1.0
diffuseIntensity 1.0
diffuseTexture {name}_diffuse.png
normalmapTexture {name}_normal.png
normalmapIntensity 1.0
metallic {0.35 if metal else 0.0}
roughness {rough}
opacity 1.0
""")


def uuid_of(name):
    return str(uuid.UUID(int=random.Random(name).getrandbits(128)))


def make(gid, svc):
    g = resolve(GARMENTS[gid])
    bm, arm = human(svc)
    from bl_ext.user_default.mpfb.services import ClothesService, LocationService
    from bl_ext.user_default.mpfb.entities.meshcrossref import MeshCrossRef
    cache = LocationService.get_user_cache('basemesh_xref')
    if not os.path.exists(cache):
        os.makedirs(cache)
        MeshCrossRef(bm, after_modifiers=False, build_faces_by_group_reference=True, cache_dir=cache, write_cache=True, read_cache=False)
    body = Body(bm, arm)
    b = Builder(body)
    for p in g['parts']:
        getattr(b, p['kind'])(p)
    dg, ndel = b.delete_group()
    ob = b.finish()
    chk = ClothesService.mesh_is_valid_as_clothes(ob, bm)
    if not chk['all_checks_ok']:
        sys.exit(f'{gid}: 옷 검사 실패 {chk}')
    name = 'cf_' + gid
    out = os.path.join(LocationService.get_user_data('clothes'), name)
    os.makedirs(out, exist_ok=True)
    paint(g, os.path.join(out, name + '_diffuse.png'), os.path.join(out, name + '_normal.png'))
    props = dict(author='char-forge', name=name, license='CC0', description=g['desc'], homepage='', uuid=uuid_of(name))
    mh = ClothesService.create_mhclo_from_clothes_matching(bm, ob, properties_dict=props, delete_group=dg if ndel else None)
    mh.material = name + '.mhmat'
    mh.tags = ','.join(g['tags'])
    mh.write_mhclo(os.path.join(out, name + '.mhclo'), reference_scale=ClothesService.get_reference_scale(bm), also_export_mhmat=True)
    write_mhmat(os.path.join(out, name + '.mhmat'), name, g)  # material 줄만 쓰게 하고 내용은 우리 것
    print('GARMENT', gid, 'verts', len(ob.data.vertices), 'faces', len(ob.data.polygons), 'delete', ndel, '->', out)


def recolor(gid, cols, svc):
    """색 변형 — 기본 옷의 메시·맞춤(.obj·.mhclo)은 그대로 베끼고 이름·uuid·그림만 새로. 기본 옷이 없으면 먼저 짓는다."""
    from bl_ext.user_default.mpfb.services import LocationService
    root = LocationService.get_user_data('clothes')
    base = 'cf_' + gid
    src = os.path.join(root, base)
    if not os.path.exists(os.path.join(src, base + '.mhclo')):
        make(gid, svc)
    name = base + '_' + '_'.join(c.lstrip('#').lower() for c in cols)
    out = os.path.join(root, name)
    os.makedirs(out, exist_ok=True)
    g = resolve(GARMENTS[gid], ['#' + c.lstrip('#') for c in cols])
    lines = []
    for ln in open(os.path.join(src, base + '.mhclo'), encoding='utf-8').read().split('\n'):
        key = ln.split(' ', 1)[0]
        ln = {'name': f'name {name}', 'uuid': f'uuid {uuid_of(name)}', 'obj_file': f'obj_file {name}.obj',
              'material': f'material {name}.mhmat'}.get(key, ln)
        lines.append(ln)
    open(os.path.join(out, name + '.mhclo'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    with open(os.path.join(src, base + '.obj'), 'rb') as f:
        obj = f.read()
    with open(os.path.join(out, name + '.obj'), 'wb') as f:
        f.write(obj)
    paint(g, os.path.join(out, name + '_diffuse.png'), os.path.join(out, name + '_normal.png'))
    write_mhmat(os.path.join(out, name + '.mhmat'), name, g)
    print('GARMENT', gid, 'colors', cols, '->', out)


def main():
    ids = sys.argv[sys.argv.index('--') + 1:]
    if 'all' in ids:          # all = 기본 옷 전부(뒤에 변형 인자를 같이 줄 수 있다)
        i = ids.index('all')
        ids = ids[:i] + list(GARMENTS) + ids[i + 1:]
    svc = build_real.mpfb()
    for spec in ids:
        gid, _, cols = spec.partition('@')
        if cols:
            recolor(gid, cols.split(','), svc)
        else:
            make(gid, svc)


main()
