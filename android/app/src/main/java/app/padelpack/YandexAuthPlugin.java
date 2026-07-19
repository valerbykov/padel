package app.padelpack;

// Нативный вход через Yandex ID SDK: системный экран «Выберите аккаунт для входа»
// (аккаунты из установленных приложений Яндекса, без телефона/кодов).
// JS: const { token } = await Capacitor.Plugins.YandexAuth.authorize()
// → edge-функция yandex-auth (path token) → сессия Supabase.
// client_id задаётся в build.gradle (manifestPlaceholders YANDEX_CLIENT_ID).
// Сигнатуры соответствуют authsdk 3.x — при обновлении SDK сверить.

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
import com.yandex.authsdk.internal.strategy.LoginType;

@CapacitorPlugin(name = "YandexAuth")
public class YandexAuthPlugin extends Plugin {

    private YandexAuthSdk sdk;

    @Override
    public void load() {
        sdk = YandexAuthSdk.Companion.create(new YandexAuthOptions(getContext()));
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        try {
            // loginType обязателен из Java (data class без @JvmOverloads). NATIVE =
            // app-to-app через установленное приложение Яндекса (иначе SDK сам уводит
            // в Chrome Tab / web). Это дефолт SDK, задаём явно для Java.
            Intent intent = sdk.getContract().createIntent(getContext(), new YandexAuthLoginOptions(LoginType.NATIVE));
            startActivityForResult(call, intent, "yandexResult");
        } catch (Exception e) {
            call.reject("yandex_start_failed: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void yandexResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            YandexAuthResult res = sdk.getContract().parseResult(result.getResultCode(), result.getData());
            if (res instanceof YandexAuthResult.Success) {
                YandexAuthToken token = ((YandexAuthResult.Success) res).getToken();
                JSObject ret = new JSObject();
                ret.put("token", token.getValue());
                call.resolve(ret);
            } else if (res instanceof YandexAuthResult.Failure) {
                call.reject("yandex_failure: " + ((YandexAuthResult.Failure) res).getException().getMessage());
            } else { // YandexAuthResult.Cancelled
                call.reject("cancelled");
            }
        } catch (Exception e) {
            call.reject("yandex_parse_failed: " + e.getMessage());
        }
    }
}
