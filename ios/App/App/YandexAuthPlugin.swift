import Foundation
import Capacitor
import YandexLoginSDK

// Нативный вход через Yandex ID SDK (экран «Выберите аккаунт»).
// JS: const { token } = await Capacitor.Plugins.YandexAuth.authorize()
// → edge-функция yandex-auth (path token) → сессия Supabase.
//
// Пакет YandexLoginSDK добавляется через SPM и привязывается к таргету App.
// БЕЗ #if canImport: класс должен компилироваться всегда, иначе Capacitor его
// не регистрирует и JS уходит в веб-OAuth.

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
        // Защита от повторного входа: второй тап по «Yandex», пока первый вызов
        // ещё в полёте, не должен перезатирать pendingCall — иначе промис первого
        // вызова в JS зависнет навсегда. Отклоняем дубль, первый доигрывает сам.
        if pendingCall != nil {
            call.reject("busy")
            return
        }
        pendingCall = call
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("no_view_controller"); self.pendingCall = nil; return
            }
            // Страховка: гарантируем активацию перед authorize (идемпотентно —
            // повторная активация уже активного SDK безвредна). Реальную ошибку
            // активации логирует AppDelegate.
            try? YandexLoginSDK.shared.activate(with: "82bdbec842f948d49cdf25ee4d3877ae")
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
    public func didFinishLogin(with result: Result<LoginResult, any Error>) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        switch result {
        case .success(let login):
            call.resolve(["token": login.token])
        case .failure(let error):
            call.reject("yandex_failure: \(error.localizedDescription)")
        }
    }
}
