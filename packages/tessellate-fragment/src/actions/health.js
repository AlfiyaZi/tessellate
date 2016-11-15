// @flow

import type { Context } from '../routes'

export default async function health({ctx}: Context) {
  ctx.body = 'OK'
}
