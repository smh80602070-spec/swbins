# 사가만리 모바일 앱 (Capacitor)

게임은 그냥 웹이다. 이 폴더는 그 웹을 **앱 껍데기에 담는 일**만 한다.
게임 코드를 고칠 일은 없다 — `build-www.mjs` 가 위 폴더의 파일을 `www/` 로 옮겨 담는다.

```
mobile/
  package.json          Capacitor 6 (이 PC에서 APK 빌드가 검증된 버전)
  capacitor.config.json appId com.swbin.deungyonggo · webDir www
  build-www.mjs         게임 파일 → www/ 복사 (서버·자가진단 페이지는 제외)
  build-apk.mjs         디버그 APK 빌드 (JDK 17 을 골라서 Gradle 에 넘긴다)
  android/              Capacitor 가 만든 안드로이드 프로젝트
  ios/                  Capacitor 가 만든 Xcode 프로젝트 (빌드는 Mac 에서)
```

## 안드로이드 — 이 PC 에서 바로 된다

```
cd mobile
npm install            # 처음 한 번
npm run apk            # www 복사 → cap sync → 디버그 APK
```

산출물: `android/app/build/outputs/apk/debug/app-debug.apk` (약 4.4MB)

폰에 넣는 법: USB 로 옮겨 설치(출처를 알 수 없는 앱 허용), 또는
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

**JDK 주의** — 이 PC 의 `JAVA_HOME` 은 JDK 8 을 가리키고 있어서 Gradle 이 죽는다.
`build-apk.mjs` 가 `release` 파일을 읽어 **17 이상만** 골라 쓴다
(`C:/Users/DAOU/dev-tools/jdk17-extract/jdk-17.0.19+10`). 다른 JDK 를 쓰려면
`JAVA_HOME` 을 17 이상으로 바꿔서 실행하면 된다.

권한은 `android/app/src/main/AndroidManifest.xml` 에 넣어 두었다 —
`ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` (GPS 산책이 이 게임의 핵심이므로).

## 아이폰 — 프로젝트는 준비됨, 빌드는 Mac 에서

이 PC(Windows)에서는 **바이너리를 만들 수 없다.** Xcode 와 CocoaPods 가 macOS 전용이고,
실기기 설치는 Apple 개발자 계정 서명이 필요하다. 그래서 여기서는 프로젝트만 만들어 두었다.

Mac 에 옮긴 뒤:

```
cd mobile
npm install
npx cap sync ios
cd ios/App && pod install
open App.xcworkspace          # Xcode 에서 서명 팀 지정 후 실행
```

이미 해 둔 것:

- `ios/App/App/Info.plist` — 위치 권한 문구(`NSLocationWhenInUseUsageDescription` 등) 한국어로
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` — 1024×1024 앱 아이콘(RGB)
- `@capacitor/geolocation` 플러그인 포함

**Mac 이 없어도 아이폰에서 지금 할 수 있는 것**: PWA 로 홈 화면에 추가한다.

```
run-phone.bat        (게임 폴더에서) https 서버를 띄운다
```

그 다음 사파리에서 `https://<이 PC IP>:8790/index.html` → 공유 → **홈 화면에 추가**.
전체화면으로 뜨고 GPS·오프라인 캐시까지 된다.

**http 로는 안 된다.** 아이폰 사파리는 안전하지 않은 출처에서 위치 API 를 막고,
서비스 워커(오프라인 캐시)도 https 나 localhost 에서만 붙는다.
그래서 `run-phone.bat` 이 자체 서명 인증서를 만들어 https 로 띄운다 —
폰에 **뿌리 CA(`server/certs/dg-ca.crt`)를 한 번 설치하고 신뢰**시켜야 한다
(설정 → 일반 → 정보 → 인증서 신뢰 설정). 자세한 절차는 `server/README.md`.

## 온라인 모드와 앱

앱 안에서는 페이지가 `https://localhost` 에서 열리므로, 같은 출처에 `/dg-ai/*` 가 없다.
그래서 앱에서 온라인 모드를 쓰려면 **사관 화면의 `주소 바꾸기`** 에
서버 주소(예: `http://192.168.0.10:8790/`)를 넣어 주면 된다.
`capacitor.config.json` 의 `allowMixedContent: true` 는 그 http 호출을 위한 것이다.

## 다시 만들 때

`android/` 와 `ios/` 는 Capacitor 가 만든 것이라 지우고 다시 만들어도 된다.

```
rm -rf android ios
npx cap add android
npx cap add ios
```

단, 다시 만들면 **위에 손으로 넣은 것들이 사라진다** — 위치 권한, 앱 아이콘,
Info.plist 문구. 이 README 를 보고 다시 넣어야 한다.
