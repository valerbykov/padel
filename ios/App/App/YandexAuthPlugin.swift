import Foundation
import Capacitor

// Нативный вход через Yandex ID SDK (экран «Выберите аккаунт»).
// JS: const { token } = await Capacitor.Plugins.YandexAuth.authorize()
// → edge-функция yandex-auth (path token) → сессия Supabase.
//
// Пакет добавляется через SPM (проект на CapApp-SPM, CocoaPods нет):
//   Xcode → File → Add Package Dependencies… → https://github.com/yandex/YandexLoginSDK-iOS
//   (URL сверить с актуальной докой https://yandex.ru/dev/id/doc/ru/mobile-sdk/)
// Весь код под #if canImport — проект СОБИРАЕТСЯ и до добавления пакета:
// без него плагин просто не регистрируется, JS уходит в веб-OAuth фолбэк.

#if canImport(YandexLoginSDK)
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
                // authorizationStrategy — сверить с версией SDK (.default / .primaryOnly)
                try YandexLoginSDK.shared.authorize(with: vc, authorizationStrategy: .default)
            } catch {
                call.reject("authorize_failed: \(error.localizedDescription)")
                self.pendingCall = nil
            }
        }
    }
}

extension YandexAuthPlugin: YandexLoginSDKObserver {
    public func didFinishLogin(with result: Result<LoginResult, Error>) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        switch result {
        case .success(let login):
            call.resolve(["token": login.token])   // имя свойства токена — сверить (login.token)
        case .failure(let error):
            call.reject("yandex_failure: \(error.localizedDescription)")
        }
    }
}
#endif
