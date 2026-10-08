import Foundation
import Capacitor
import Photos
import UIKit

// Photos from a trip's dates, for adding to its places without hunting through albums. The web app calls these
// (as PostcardPhotos) when it runs in the iPhone app; the system photo picker can't be opened at an album or date.
// Needs photo library access (Info.plist: NSPhotoLibraryUsageDescription); "Limited" access shows only the
// photos the person shared.
@objc(PostcardPhotosPlugin)
public class PostcardPhotosPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PostcardPhotosPlugin"
    public let jsName = "PostcardPhotos"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "photosBetween", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "thumbnails", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "photo", returnType: CAPPluginReturnPromise),
    ]
    private let iso = ISO8601DateFormatter()

    private func withAccess(_ then: @escaping (PHAuthorizationStatus) -> Void) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if status == .notDetermined {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { then($0) }
        } else {
            then(status)
        }
    }

    // Photos taken from start (inclusive) to end (exclusive), oldest first: id, date and where they were taken.
    @objc func photosBetween(_ call: CAPPluginCall) {
        guard let startText = call.getString("start"), let endText = call.getString("end"),
              let start = iso.date(from: startText), let end = iso.date(from: endText) else {
            call.reject("start and end dates are required")
            return
        }
        let limit = call.getInt("limit") ?? 600
        withAccess { status in
            guard status == .authorized || status == .limited else {
                call.resolve(["access": "denied", "photos": [] as [Any]])
                return
            }
            let options = PHFetchOptions()
            options.predicate = NSPredicate(format: "mediaType == %d AND creationDate >= %@ AND creationDate < %@",
                                            PHAssetMediaType.image.rawValue, start as NSDate, end as NSDate)
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
            options.fetchLimit = limit
            var photos: [[String: Any]] = []
            PHAsset.fetchAssets(with: options).enumerateObjects { asset, _, _ in
                var item: [String: Any] = ["id": asset.localIdentifier]
                if let date = asset.creationDate { item["date"] = self.iso.string(from: date) }
                if let location = asset.location {
                    item["lat"] = location.coordinate.latitude
                    item["lng"] = location.coordinate.longitude
                }
                photos.append(item)
            }
            call.resolve(["access": status == .limited ? "limited" : "all", "photos": photos])
        }
    }

    // Small square previews (base64 JPEG) for up to 60 photos at a time.
    @objc func thumbnails(_ call: CAPPluginCall) {
        let ids = Array((call.getArray("ids", String.self) ?? []).prefix(60))
        let size = CGFloat(call.getInt("size") ?? 240)
        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHImageRequestOptions()
            options.isSynchronous = true
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = true
            var thumbnails: [String: String] = [:]
            PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil).enumerateObjects { asset, _, _ in
                PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: size, height: size),
                                                      contentMode: .aspectFill, options: options) { image, _ in
                    if let data = image?.jpegData(compressionQuality: 0.7) {
                        thumbnails[asset.localIdentifier] = data.base64EncodedString()
                    }
                }
            }
            call.resolve(["thumbnails": thumbnails])
        }
    }

    // One photo at up to maxSize pixels on its long side (base64 JPEG), downloading it from iCloud if needed.
    @objc func photo(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("Photo not found")
            return
        }
        let maxSize = CGFloat(call.getInt("maxSize") ?? 2048)
        let scale = min(1, maxSize / CGFloat(max(asset.pixelWidth, asset.pixelHeight, 1)))
        let target = CGSize(width: CGFloat(asset.pixelWidth) * scale, height: CGFloat(asset.pixelHeight) * scale)
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(for: asset, targetSize: target, contentMode: .aspectFit, options: options) { image, _ in
            guard let data = image?.jpegData(compressionQuality: 0.85) else {
                call.reject("Could not load this photo")
                return
            }
            call.resolve(["data": data.base64EncodedString(), "mimeType": "image/jpeg"])
        }
    }
}

// The app's web view, with Postcard's own plugins registered.
class PostcardBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PostcardPhotosPlugin())
    }
}
