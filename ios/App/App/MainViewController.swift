import UIKit
import Capacitor

// Кастомные плагины, лежащие в таргете App (а не в отдельном пакете), Capacitor 8
// на SPM НЕ находит автоматически — он регистрирует только плагины-пакеты из
// сгенерированного Package.swift. Поэтому app-embedded YandexAuthPlugin нужно
// зарегистрировать вручную в capacitorDidLoad(). Этот контроллер назначен
// классом вью-контроллера в Main.storyboard (вместо CAPBridgeViewController).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(YandexAuthPlugin())
    }
}
