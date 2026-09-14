import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AppViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Keep the web viewport inside the device's usable screen, including on rotation.
// The web content must not draw underneath the status bar or home indicator.
class AppViewController: UIViewController {
    private let bridgeController = CAPBridgeViewController()

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 240 / 255, green: 232 / 255, blue: 217 / 255, alpha: 1)
        addChild(bridgeController)
        let webContent = bridgeController.view!
        webContent.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webContent)
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webContent.topAnchor.constraint(equalTo: safeArea.topAnchor),
            webContent.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
            webContent.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            webContent.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }
}
