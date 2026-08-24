# Background Web-Push Boundaries — 24 August 2026

The existing application can play sounds only while it is open. App-closed notifications require the browser’s Web Push mechanism, which is a separate capability: an active service worker, a user-granted subscription, a protected subscription endpoint and encryption keys, and a sender that delivers a push message when the scheduled collector detects a qualifying new USGS record. [1]

> “For an app to receive push messages, it has to have an active service worker… The resulting `PushSubscription` includes all the information that the application needs to send a push message: an endpoint and the encryption key needed for sending data.” — MDN [1]

The subscription endpoint is a capability URL and must be stored as sensitive data; it must not be exposed in client logs, public Sheets, or source control. [1]

For iPhone and iPad, Apple documents Web Push for Home Screen web apps on iOS/iPadOS 16.4 or later. Permission and subscription must be requested through a direct user gesture, and Safari requires an immediately visible notification for each push it receives. [2]

No browser implementation can bypass a user’s notification permission, device volume settings, Silent mode, or Do Not Disturb. Background push delivery should therefore be additive to the in-app alert history, not a substitute for official warnings or emergency information.

## Scheduled delivery authentication

The existing hourly GitHub Actions workflow can authenticate to the deployed application with a short-lived GitHub OIDC token instead of a long-lived shared webhook secret. The receiving endpoint must validate the GitHub issuer, a project-specific audience, and repository/workflow claims before accepting a delivery request. GitHub documents that OIDC tokens include issuer, audience, and subject claims, and that audience and subject should be used together for trust conditions. [3]

## References

[1] [MDN, Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

[2] [Apple Developer, Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

[3] [GitHub Docs, OpenID Connect reference](https://docs.github.com/actions/reference/openid-connect-reference)
