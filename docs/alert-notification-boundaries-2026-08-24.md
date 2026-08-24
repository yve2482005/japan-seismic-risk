# Alert and Notification Boundaries — 24 August 2026

## Intended scope

The system can create **earthquake detection alerts** from newly accepted, source-attributed USGS live records. These alerts are not earthquake predictions and are not official warnings. They must remain available as in-app history even when browser notification permission is unavailable.

## Browser push boundary

The Push API can support background delivery after a user opts in, but it requires an active service worker and a distinct push subscription. Subscription endpoints are capability URLs and must be treated as secrets. [1]

This project can prepare a secure browser-notification permission and subscription foundation, but reliable server-to-device background push needs a separate push sender, VAPID credentials, durable subscription storage, and a delivery service. Those are not currently configured and must not be represented as active.

## Sound and vibration boundary

Browser/device support differs. Vibration is limited in availability; devices can suppress vibration in silent or Do Not Disturb modes. The app may request a supported local vibration pattern while open, but cannot claim to override silent mode, DND, or operating-system notification policies. [2]

## Safe default behavior

| Capability | Default implementation stance |
|---|---|
| New-event detection | Source-aware, thresholded, deduplicated in-app alert history. |
| In-app display | Available whenever the dashboard can read the live USGS dataset. |
| Browser notification | Opt-in only; clearly display `not enabled` until permission and subscription are active. |
| Background push | Unavailable until a push sender and VAPID secrets are explicitly configured. |
| Sound / vibration | Best-effort only while supported; never claims silent/DND bypass. |
| JMA historical archive | Excluded from live alert generation. |

## References

[1] [MDN, Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

[2] [MDN, Navigator: vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate)
