// @flow

import prometheus from 'prom-client'

import type { Context } from '../routes'

export default async function metrics({ctx}: Context) {
  ctx.body = prometheus.register.getMetricsAsJSON()
}
