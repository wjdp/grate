import { defineCronHandler } from '#nuxt/cron'
import { updateUser } from '~/lib/steam/service'

export default defineCronHandler('everyFifteenMinutes', async () => {
  await updateUser()
  console.log('Updated steam user')
})
