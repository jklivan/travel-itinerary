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
    // Registers Postcard's own plugins (trip photos); see PostcardPhotos.swift.
    private let bridgeController = PostcardBridgeViewController()

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Match the web app: the status bar band uses the page colour (paper, #f7f3ec) and the band under
        // the home indicator uses the bottom bar's colour (cream, #faf7f1), so neither shows as a stripe.
        view.backgroundColor = UIColor(red: 247 / 255, green: 243 / 255, blue: 236 / 255, alpha: 1)
        let bottomBand = UIView()
        bottomBand.backgroundColor = UIColor(red: 250 / 255, green: 247 / 255, blue: 241 / 255, alpha: 1)
        bottomBand.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomBand)
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
            bottomBand.topAnchor.constraint(equalTo: safeArea.bottomAnchor),
            bottomBand.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomBand.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBand.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }
}
