# Steam APIs

This is a service layer for the Steam APIs. It provides a simple interface to interact with the Steam APIs.

## Auth

The poller runs on a Web API key (`SteamUser.apiKey`), the only mechanism Valve
sanctions for unattended use: `GetOwnedGames` for games and playtime, community
XML for the profile. `webSession.ts` holds an optional browser login (QR scan,
`EAuthTokenPlatformType.WebBrowser`) used only for rich data the key cannot
reach, such as owned DLC from `dynamicstore/userdata`. Steam cannot extend a web
refresh token, so it is re-scanned rather than renewed, and its absence never
affects library or playtime syncing. See `docs/32-Steam-Auth-After-The-Hijack-Flag.md`.

## Reference

- https://steamapi.xpaw.me/
- https://github.com/Revadike/InternalSteamWebAPI/wiki/Get-App-Details
