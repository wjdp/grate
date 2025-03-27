# GOG API

## Getting authenticated

1. Login in the browser using
   https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient&response_type=code&layout=client2
2. Copy the `code` parameter from the URL, be quick because it expires pretty fast
3. Call the `/token` endpoint with the `code` parameter
4. Extract the `access_token` and `refresh_token` from the response

## References

- https://gogapidocs.readthedocs.io/en/latest/index.html
- https://www.gog.com/forum/general/unofficial_gog_api_documentation
- https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/blob/main/src/backend/storeManagers/gog/games.ts
