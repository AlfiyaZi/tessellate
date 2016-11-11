// @flow

import { Observer } from 'rx'

import type { Context } from '../server'

export default async function health({ctx}: Context) {
  ctx.body = 'OK'
}
