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

    // How much of the screen the keyboard covers, tracked from the keyboard's own notifications rather than
    // keyboardLayoutGuide, which sometimes stays "open" after the keyboard closes (closing it while switching apps,
    // opening the photo picker, a call…) and left the page cut short with an empty band at the bottom.
    private var keyboardLimit: NSLayoutConstraint!
    private var keyboardShowing = false

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
        let pageBottom = webContent.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor)
        pageBottom.priority = .defaultHigh
        NSLayoutConstraint.activate([
            webContent.topAnchor.constraint(equalTo: safeArea.topAnchor),
            pageBottom,
            webContent.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            webContent.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
            bottomBand.topAnchor.constraint(equalTo: safeArea.bottomAnchor),
            bottomBand.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomBand.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBand.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        // The page ends at the top of the on-screen keyboard while it's open (and at the safe area otherwise),
        // so the web app's visible bottom is exactly where the keyboard starts.
        keyboardLimit = webContent.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor)
        keyboardLimit.isActive = true
        bridgeController.didMove(toParent: self)

        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(keyboardWillChange(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        center.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        center.addObserver(self, selector: #selector(keyboardDidShow), name: UIResponder.keyboardDidShowNotification, object: nil)
        center.addObserver(self, selector: #selector(keyboardDidHide), name: UIResponder.keyboardDidHideNotification, object: nil)
        // Coming back to the app: if the keyboard isn't up, the page is full height again.
        center.addObserver(self, selector: #selector(resetIfNoKeyboard), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(resetIfNoKeyboard), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    private func cover(_ height: CGFloat, from notification: Notification?) {
        keyboardLimit.constant = -max(0, height)
        let info = notification?.userInfo
        let duration = (info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0
        let curve = (info?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt) ?? 7
        UIView.animate(withDuration: duration, delay: 0, options: UIView.AnimationOptions(rawValue: curve << 16)) { self.view.layoutIfNeeded() }
    }

    @objc private func keyboardWillChange(_ notification: Notification) {
        guard let end = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        // The part of the keyboard that overlaps this screen (zero when it's off screen or undocked and floating).
        let frame = view.convert(end, from: nil)
        let overlap = frame.minY < view.bounds.maxY && frame.maxY >= view.bounds.maxY - 1 ? view.bounds.maxY - frame.minY : 0
        cover(overlap, from: notification)
    }

    @objc private func keyboardWillHide(_ notification: Notification) { cover(0, from: notification) }
    @objc private func keyboardDidShow() { keyboardShowing = true }
    @objc private func keyboardDidHide() { keyboardShowing = false; if keyboardLimit.constant != 0 { cover(0, from: nil) } }
    @objc private func resetIfNoKeyboard() { if !keyboardShowing && keyboardLimit.constant != 0 { cover(0, from: nil) } }

    deinit { NotificationCenter.default.removeObserver(self) }
}
