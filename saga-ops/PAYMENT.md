# 캐시템 결제 설계 (W-0326 ⑤ — 사용자 10-19 "아직 멀었으니 설계만")

코드는 `server.mjs` 의 `PAY` 어댑터(toss·google·mock, apple 자리)와 `receipt()` 까지 있다. 실결제·샌드박스 실측은 상용화 때. 이 문서는 그때 바로 이어가기 위한 정본.

## 원칙

1. **지급은 서버만**: 클라이언트는 "샀다"고 주장만 하고(`POST /v1/receipt`), 서버가 플랫폼에 확인한 뒤 **우편**으로 준다. 판 코드는 우편을 받을 때만 아이템을 넣는다(`DG.ops.onMail`).
2. **금액은 상품 표가 정본**: 클라이언트가 보낸 amount 는 비교용. 상품 표(`product`)의 price 와 다르면 거절.
3. **한 영수증 한 번**: `receipt(provider, order_id)` 유일 — 다시 보내면 `already`(지급 없음). 환불·취소는 아래.
4. 열쇠·시크릿은 서버 `.dev.vars` 에만. 클라이언트에는 공개 키(클라이언트 키)만.

## 플랫폼별 흐름

| 플랫폼 | 클라이언트 | 서버 확인 | 상태 |
|---|---|---|---|
| PC 웹 — 토스페이먼츠 | 결제창(클라이언트 키) → 성공 시 `{paymentKey, orderId, amount}` → `/v1/receipt provider:'toss'` | `POST api.tosspayments.com/v1/payments/confirm`(시크릿 Basic) → `status DONE`·`totalAmount == price` | 코드 있음 · 키 없이 거절 확인 · 실측 안 함 |
| 안드로이드 — Google Play Billing | TWA 안 Digital Goods API(`getDigitalGoodsService`) 또는 네이티브 포장 → `purchaseToken` | Play Developer API `purchases.products.get`(서비스 계정 JWT) → `purchaseState 0` · 지급 뒤 `acknowledge`(**미구현** — 3일 안 안 하면 자동 환불) | 코드 있음(ack 빼고) · 실측 안 함 |
| iOS — App Store | 네이티브 포장(Capacitor 등) → StoreKit 2 서명 영수증(JWS) | App Store Server API `transactions/{id}` 또는 JWS 검증 | 자리만(`apple` → 거절) |
| 시험 — mock | `{orderId, amount}` | `OPS_PAY_MOCK=1` 일 때만 금액 비교 | 끝(QC 한 바퀴) |

## 상품 표

`product`: id(`<판>_<종류>_<양>` 예 `go_gem_100`) · game · name · price(최소 단위: KRW 원·USD 센트) · currency · items(`[{kind,id,n}]`) · store_ids(`{google:'sku', apple:'sku'}`) · on_sale. 콘솔 "상품" 탭에서 만든다. 판은 `GET /v1/flags` 의 products 로 판매 중인 것만 받는다. **가격 변경은 새 id** 로(옛 영수증 금액 비교가 깨지지 않게).

## 환불·취소·분쟁 (후속 코드)

- 토스: 웹훅(`PAYMENT_STATUS_CHANGED`) 또는 콘솔 취소 → `receipt.status = 'refund'` + 회수 우편(마이너스 items 는 안 둔다 — 판이 회수 규칙을 모른다) → **회수는 운영자 수동**(플레이어 탭 세이브 수정, 감사 기록). 자동 회수는 하지 않는다.
- Google: Voided Purchases API 를 하루 한 번 당겨 같은 처리.
- 분쟁 대비: receipt.raw 에 플랫폼 응답 요약 보관(4KB), audit 에 수동 조치 전후.

## 샌드박스 → 실결제 전환 점검표

1. 토스 `test_sk_` → `live_sk_`(사업자 등록·계약 뒤) · `OPS_PAY_MOCK` 비움 · `OPS_ORIGINS` 를 Pages 주소로.
2. HTTPS 종단(reverse proxy) · 결제창 리다이렉트 URL 을 Pages 주소로 등록.
3. Play: 테스트 트랙 라이선스 테스터로 1건 → 프로덕션 · 서비스 계정에 "재무 데이터 보기" 권한.
4. 지급 뒤 ack(Google) · 영수증 보관 기간(국내 전자상거래 5년) 은 DB 백업(W-0334 ⑥) 으로.
5. 환불 정책·사업자 정보·개인정보 처리방침 — 스토어 자료(`saga-unity/docs/STORE_CHECKLIST.md` 와 같은 칸).

## 판 쪽 할 일 (판별 티켓)

`DG.ops.products()` 로 상점 창 · `DG.ops.buy(id, provider, payload)` 호출 전에 플랫폼 결제창 띄우기 · `DG.ops.onMail` 에서 items 지급 · 구매 이벤트 `track('buy')` 는 ops-client 가 이미 보낸다.
