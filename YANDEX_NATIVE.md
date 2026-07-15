# Нативный вход через Yandex ID (выбор аккаунта)

Экран «Выберите аккаунт для входа» (аккаунты из установленных приложений Яндекса,
без телефона/кодов) даёт нативный **Yandex ID SDK**. Клиентский JS уже готов:
`signInYandex()` сначала пробует нативный плагин `YandexAuth`, а если его нет —
уходит в веб-OAuth (фолбэк). Edge-функция `yandex-auth` уже принимает `token`.

Осталось добавить нативную часть (в Android Studio / Xcode). Ниже — всё по шагам.

> ⚠ Версии SDK и точные сигнатуры меняются между релизами — сверяйся с актуальной
> докой Яндекса. Ниже помечены места «сверить».

---

## 0. Регистрация приложения в Yandex OAuth
Консоль https://oauth.yandex.ru → твоё приложение (или создать):
- Права: «Доступ к email», «Доступ к логину, имени, аватарке».
- Платформа **Android**: package `app.padelpack` + SHA-256 отпечаток(и) подписи
  (debug и release keystore). Отпечаток: `keytool -list -v -keystore <ключ> | grep SHA256`.
- Платформа **iOS**: Bundle ID `app.padelpack`.
- Забрать **client_id (ID приложения)** и **callback URL-схему** (для iOS).

---

## 1. Android

**build.gradle** (`android/app/build.gradle`, в `dependencies`):
```gradle
implementation "com.yandex.android:authsdk:3.1.0"   // сверить актуальную версию
```

**AndroidManifest.xml** — если версия требует client_id в манифесте:
```xml
<meta-data android:name="com.yandex.auth.CLIENT_ID" android:value="ВАШ_CLIENT_ID"/>
```

**MainActivity.java** — зарегистрировать плагин ДО super.onCreate:
```java
package app.padelpack;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YandexAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

**Плагин** — `android/app/src/main/java/app/padelpack/YandexAuthPlugin.java`:
```java
package app.padelpack;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.authsdk.YandexAuthLoginOptions;
import com.yandex.authsdk.YandexAuthOptions;
import com.yandex.authsdk.YandexAuthResult;
import com.yandex.authsdk.YandexAuthSdk;
import com.yandex.authsdk.YandexAuthToken;

@CapacitorPlugin(name = "YandexAuth")
public class YandexAuthPlugin extends Plugin {
    private YandexAuthSdk sdk;

    @Override
    public void load() {
        sdk = YandexAuthSdk.create(new YandexAuthOptions(getContext())); // конструктор — сверить
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        Intent intent = sdk.getContract().createIntent(getContext(), new YandexAuthLoginOptions());
        startActivityForResult(call, intent, "yandexResult");
    }

    @ActivityCallback
    private void yandexResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        YandexAuthResult res = sdk.getContract().parseResult(result.getResultCode(), result.getData());
        if (res instanceof YandexAuthResult.Success) {
            YandexAuthToken token = ((YandexAuthResult.Success) res).getToken();
            JSObject ret = new JSObject();
            ret.put("token", token.getValue());
            call.resolve(ret);
        } else if (res instanceof YandexAuthResult.Failure) {
            call.reject("yandex_failure");
        } else {
            call.reject("cancelled");
        }
    }
}
```

---

## 2. iOS

**Podfile** (`ios/App/Podfile`, target `App`):
```ruby
pod 'YandexLoginSDK'   # сверить актуальную версию
```
Затем `cd ios/App && pod install`.

**AppDelegate.swift** — активировать SDK и пробросить open-url:
```swift
import YandexLoginSDK
// в didFinishLaunchingWithOptions:
try? YandexLoginSDK.shared.activate(with: "ВАШ_CLIENT_ID")
// в application(_:open:options:) ПЕРЕД return:
try? YandexLoginSDK.shared.handleOpenURL(url)
```

**Info.plist** — добавить callback URL-схему из консоли Яндекса в существующий
`CFBundleURLTypes` (рядом с `padelpack` и google-схемой).

**Плагин** — `ios/App/App/YandexAuthPlugin.swift`:
```swift
import Foundation
import Capacitor
import YandexLoginSDK

@objc(YandexAuthPlugin)
public class YandexAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "YandexAuthPlugin"
    public let jsName = "YandexAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?

    override public func load() {
        YandexLoginSDK.shared.add(observer: self)
    }

    @objc func authorize(_ call: CAPPluginCall) {
        pendingCall = call
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("no_view_controller"); self.pendingCall = nil; return
            }
            do {
                try YandexLoginSDK.shared.authorize(with: vc, authorizationStrategy: .default)
            } catch {
                call.reject("authorize_failed: \(error.localizedDescription)")
                self.pendingCall = nil
            }
        }
    }
}

extension YandexAuthPlugin: YandexLoginSDKObserver {
    public func didFinishLogin(with result: Result<LoginResult, YandexLoginSDKError>) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        switch result {
        case .success(let login):
            call.resolve(["token": login.token])   // имя свойства токена — сверить
        case .failure(let error):
            call.reject("yandex_failure: \(error.localizedDescription)")
        }
    }
}
```
(iOS-плагин Capacitor находит по `@objc`/`CAPBridgedPlugin` сам — ручная регистрация не нужна.)

---

## 3. Сервер
`yandex-auth` уже принимает `{ token }` (нативный путь) наряду с `{ code }` (веб).
Просто **редеплой**: `supabase functions deploy yandex-auth`.

---

## 4. Проверка
1. `npm run build && npx cap sync` (после добавления зависимостей).
2. На устройстве с установленным приложением Яндекса → тап «Yandex» → должен открыться
   нативный экран «Выберите аккаунт» (как на скрине), без телефона/кода.
3. На устройстве БЕЗ приложений Яндекса → плагин откроет webview / уйдёт в веб-фолбэк —
   это ок, вход всё равно проходит.
4. Веб (padelpack.app) — без изменений, там был и остаётся веб-OAuth.

Если плагин не подключён/сломан — JS сам уходит в веб-OAuth, вход не ломается.
