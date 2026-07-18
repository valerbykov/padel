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
        pendingCall = call
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("no_view_controller"); self.pendingCall = nil; return
            }
            do {
                try YandexLoginSDK.shared.authorize(with: vc, authorizationStrategy: .default)
            } catch {
                // ДИАГНОСТИКА: печатаем ПОЛНУЮ ошибку (domain/code/userInfo) — там
                // реальная причина, а localizedDescription даёт лишь «error 5».
                let ns = error as NSError
                NSLog("YandexAuth: authorize threw: %@", String(describing: ns))
                call.reject("authorize_failed: domain=\(ns.domain) code=\(ns.code) desc=\(ns.localizedDescription) info=\(ns.userInfo)")
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
            let ns = error as NSError
            NSLog("YandexAuth: didFinishLogin failure: %@", String(describing: ns))
            call.reject("yandex_failure: domain=\(ns.domain) code=\(ns.code) desc=\(ns.localizedDescription) info=\(ns.userInfo)")
        }
    }
}
