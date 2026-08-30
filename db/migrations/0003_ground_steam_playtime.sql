-- Playtime accrued before grate existed was recorded against the first sync.
-- Split each such record in two at the last session Steam reports, so the
-- backlog lands on the day it was last played.
INSERT INTO `SteamGamePlaytime` (
  `steamAppId`,
  `timestampStart`,
  `timestampEnd`,
  `playtimeForever`,
  `playtime2weeks`,
  `playtimeWindowsForever`,
  `playtimeMacForever`,
  `playtimeLinuxForever`,
  `playtimeDeckForever`,
  `playtimeDisconnected`,
  `rTimeLastPlayed`
)
SELECT
  `steamAppId`,
  NULL,
  `rTimeLastPlayed` * 1000,
  `playtimeForever`,
  `playtime2weeks`,
  `playtimeWindowsForever`,
  `playtimeMacForever`,
  `playtimeLinuxForever`,
  `playtimeDeckForever`,
  `playtimeDisconnected`,
  `rTimeLastPlayed`
FROM `SteamGamePlaytime`
WHERE `timestampStart` IS NULL
  AND `rTimeLastPlayed` > 0
  AND `rTimeLastPlayed` * 1000 < `timestampEnd`;
--> statement-breakpoint
UPDATE `SteamGamePlaytime`
SET `timestampStart` = `rTimeLastPlayed` * 1000
WHERE `timestampStart` IS NULL
  AND `rTimeLastPlayed` > 0
  AND `rTimeLastPlayed` * 1000 < `timestampEnd`;
