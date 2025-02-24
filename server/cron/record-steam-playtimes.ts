import { defineCronHandler } from '#nuxt/cron'
import { recordPlaytimes } from '~/lib/steam/service'

export default defineCronHandler('hourly', async () => {
  await recordPlaytimes()
  console.log('Recorded steam playtimes')
})
