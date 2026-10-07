# 사가만리 온라인 모드 서버

하는 일이 두 가지뿐이다.

1. 게임 파일을 내려 준다 (정적 서버)
2. `/dg-ai/*` 로 오는 요청을 Claude 에게 넘기고 **토큰 사용량을 돌려준다**

## 왜 서버가 있어야 하나

브라우저에서 Anthropic API 를 직접 부르면 **API 키가 그 자리에서 공개된다**
(개발자 도구로 다 보인다). 그래서 키는 이 서버에만 두고, 게임은 이 서버만 부른다.

## 실행

```
run-online.bat          더블클릭 (게임 폴더에 있다)
```

또는

```
cd server
npm install             # 처음 한 번
node dg-server.mjs      # http://127.0.0.1:8790/index.html
```

환경변수로 조절한다.

| | |
|---|---|
| `PORT` | 포트 (기본 8790) |
| `DG_MODEL` | 모델 (기본 `claude-opus-5`) |
| `DG_DAILY_CAP` | 하루 지출 한도(USD, 기본 0.5) |

## API 키

이 파일에 키를 적지 않는다. SDK 가 알아서 찾는다 —

- `ANTHROPIC_API_KEY` 환경변수, 또는
- `ant auth login` 으로 만든 프로필 (`~/.config/anthropic/`)

키가 없으면 서버는 그대로 뜨고 게임도 돌아가지만, 사관을 부를 때
`서버에 API 키가 없습니다` 가 뜬다. 게임은 오프라인 모드로 계속 쓸 수 있다.

## 엔드포인트

```
GET  /dg-ai/health   → { ok, model, cap, ledger:{day,cost,calls}, kinds, price }
POST /dg-ai/ask      → { kind, p:{...} }
                     ← { text, usage:{in,out,cacheRead,cacheWrite}, cost, ledger, cap }
```

`kind` 는 네 가지 — `advise`(군략) · `talk`(대화) · `appraise`(감정) · `omen`(천기).
프롬프트는 서버에 있고, 게임은 상태 요약만 보낸다.

## 돈이 새지 않게 해 둔 것

- **하루 한도** `DG_DAILY_CAP` — `server/usage.json` 에 그날 지출을 적어 두고,
  넘으면 429 로 거절한다. **한도는 서버가 잡는다** (클라이언트 숫자는 표시용).
- **짧은 응답** — 요청별 `max_tokens` 를 200~420 으로 못 박았다. 게임 대사는 그 정도면 충분하다.
- **낮은 노력** — `output_config.effort: 'low'`. 짧은 대사에는 이게 맞고 그만큼 싸다.
- **입력 길이 제한** — 클라이언트가 보낸 문자열은 항목당 1400자로 자른다.
- 정책 거절 시 서버가 다른 모델로 이어 답하게 해 두었다
  (`fallbacks: 'default'` + `server-side-fallback-2026-07-01`).

단가는 `dg-server.mjs` 의 `PRICE` 에 적어 두었다 (Claude Opus 5 = 입력 $5 / 출력 $25 per 1M).
모델을 바꾸면 이 값도 같이 바꿔야 게임 안 '천기' 잔량이 맞는다.

## 폰에서 쓰려면

기본은 `127.0.0.1` 로만 듣는다(일부러). 폰에서 붙일 때는 `HOST=0.0.0.0` 을 준다 —
`run-phone.bat` 이 그것까지 알아서 한다.

```
run-phone.bat        인증서 만들고 → 0.0.0.0 으로 https 서버를 띄운다
```

**https 여야 한다.** 아이폰 사파리는 안전하지 않은 출처(http)에서
`navigator.geolocation` 을 막기 때문에, http 로 열면 게임은 되지만 **GPS 산책이 안 된다.**
서비스 워커(오프라인 캐시)도 https 에서만 붙는다.

`server/certs/dg-server.{crt,key}` 가 있으면 서버가 **자동으로 https 로 뜬다.**
없으면 `node server/make-cert.mjs` 로 만든다 (SAN 에 이 PC 의 IP·호스트명이 들어간다).

인증서는 자체 서명이라, 폰에 **뿌리 CA 를 한 번 설치하고 신뢰**시켜야 한다.

1. `server/certs/dg-ca.crt` 를 폰으로 보낸다 (메일·카톡·AirDrop)
2. 파일을 열면 "프로파일 다운로드" → 설정 앱에서 설치
3. **설정 → 일반 → 정보 → 인증서 신뢰 설정 → "DeungyongGO Local CA" 켜기**
   (3번을 빼먹으면 https 경고가 계속 난다)

그 다음 사파리에서 `https://<이 PC IP>:8790/index.html` 을 열면 된다.
`certs/` 와 `usage.json` 은 저장소에 담지 않는다(비밀 키가 들어 있다).

사내망 사정으로 폰이 PC 에 닿지 못하면, **폰 핫스팟에 PC 를 붙이면** 같은 사설망이 되어 통한다.
