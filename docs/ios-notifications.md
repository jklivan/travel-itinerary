# iPhone notifications

Comments (including replies) and heart/saves create activity for the trip owner. Self-actions are excluded. One save notification is created per person/trip, even after an unsave/resave. Deleting a comment or trip cascades to its activity. The inbox is available at `/notifications`; alerts link to the trip, with comments scrolled into view.

## Apple build status

The local Xcode archive from August 10, 2026 records a successful upload to Apple at 16:44 UTC, version 1.0, build 1. App Store Connect app ID: `6800008568`. Bundle ID: `com.joshuaklivan.travelitineraryapp`. Team: `P53B7VTVQ6`. This confirms upload, not the current TestFlight processing or tester distribution status. Check https://appstoreconnect.apple.com/apps/6800008568/testflight .

## Enable delivery

1. Deploy the web changes and migration `0032_notifications` (the existing build command runs `prisma migrate deploy`). Do not push the migration manually into a different database.
2. In Apple Developer, enable Push Notifications for the existing app identifier and create an APNs authentication key. Refresh the app's signing profile in Xcode.
3. Configure these **server-only** Vercel environment variables:
   - `APNS_KEY_ID`: the Apple push key identifier.
   - `APNS_TEAM_ID`: `P53B7VTVQ6`.
   - `APNS_PRIVATE_KEY`: the complete `.p8` contents, with actual newlines or escaped `\n`.
   - `APNS_BUNDLE_ID`: `com.joshuaklivan.travelitineraryapp`.
   - `APNS_ENVIRONMENT`: `production` for TestFlight/App Store. Use `sandbox` only with locally signed development builds and a separate backend/database so environments do not mix device tokens.
4. Run `npm run ios:sync`, open Xcode, archive build 2, and upload it to the existing App Store Connect app. Xcode uses the push entitlement and adjusts the APNs environment for distribution signing.
5. Install the updated build via TestFlight, sign in, open Notifications or Settings, and choose **Enable notifications**. Old iOS builds continue to use the inbox but cannot register for push.

No permission prompt is shown automatically. Registration is refreshed on signed-in app startup after permission was granted. Disabling alerts removes this device from the server. Signing out also removes its registration. Other devices are unaffected.

## Validation before release

- With two accounts, comment on and save the other account's published trip. Check unread activity, then background the owner's iPhone and verify the alert arrives and opens the matching trip.
- Verify self-actions and repeated saves do not generate alerts; deleted comments disappear from the inbox.
- Verify disabling notifications and signing out stop new alerts on that device, including after switching accounts.
- Push sends run after the action response. APNs failures do not roll back the comment/save or inbox item. The provider uses an eight-second timeout; there is currently no persistent retry queue. APNs delivery is best effort. HTTP 410 removes stale device registrations.
- Never commit the `.p8` key or send a test alert to real users. Use test accounts/devices.

References: https://capacitorjs.com/docs/apis/push-notifications and https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns .

## Xcode Cloud dependency setup

`ios/App/ci_scripts/ci_post_clone.sh` runs after checkout, before Swift package resolution. It installs Node 22 using Homebrew and restores the exact npm lockfile dependencies. This supplies `node_modules/@capacitor/push-notifications`, which the generated `CapApp-SPM/Package.swift` references as a local package. Keep the hook executable and beside `App.xcodeproj` in `ci_scripts`.

The hook skips npm lifecycle scripts because this archive uses the committed native shell and loads the live Vercel site; it does not need Prisma generation, database credentials, or a web build. When changing native plugins, run `npm run ios:sync` locally and commit the resulting iOS changes and npm lockfile together.

After pushing the hook, start an Xcode Cloud build from that commit. Confirm the **Post-Clone** step finishes before **Resolve Package Dependencies**. Retrying an older commit will still lack the hook.

Apple reference: https://developer.apple.com/documentation/xcode/writing-custom-build-scripts .
