// @flow

import path from 'path'
import Koa from 'koa'
import morgan from 'koa-morgan'
import nconf from './nconf'
import logger from './logger'
import error from './error'
import { Observable, Observer } from 'rx'
import { router, routes } from './routes'
import * as actions from './actions'
import * as fragment from './actions/fragment'

export type Context = {
  ctx: Object;
}

const log = logger('server')

export function init(): Koa {
  const app = new Koa()
  const morganFormat = nconf.get('MORGAN_FORMAT')
  const morganSkip = (req, res) => res.statusCode < nconf.get('MORGAN_THRESHOLD')

  // Initialize route logic.
  routes.health.get(observable => observable.flatMap(actions.health))
  routes.metrics.get(observable => observable.flatMap(actions.metrics))
  routes.fragment.get(observable => observable.flatMap(fragment.onFetchBundle)
                                              .flatMap(fragment.onRenderBundle))

  return app
    .use(morgan(morganFormat, {skip: morganSkip}))
    .use(error)
    .use(router.routes())
    .use(router.allowedMethods())
}

function start(port: number | string = nconf.get('APP_PORT')) {
  init().listen(port)
  log.info('listening on port %d', port)
}

// $FlowIssue https://github.com/facebook/flow/issues/1362
if (require.main === module) {
  try {
    start()
  } catch(e) {
    log.error(e)
  }
}
