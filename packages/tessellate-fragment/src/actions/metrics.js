// @flow

import prometheus from 'prom-client'
import { Observer } from 'rx'

import type { Context } from '../server'

export default async function metrics({ctx}: Context) {
  ctx.body = prometheus.register.getMetricsAsJSON()
}
