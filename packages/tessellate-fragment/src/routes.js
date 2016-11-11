// @flow

import Router from 'koa-router'
import logger from './logger'
import nconf from './nconf'
import { Observable, Subject } from 'rx'

type RouteDefinitions = { [name: string]: {| path: string; methods: Array<string>; |}; }
type RouteInitializerEntry = {| name: string; method: string; initializer: RouteInitializer; |}
type RouteInitializerIndex = { [name: string]: { [method: string]: RouteInitializer; }; }
type RouteInitializer = (init: (observable: Observable) => Observable) => Observable

const log = logger('routes')

const definitions: RouteDefinitions = nconf.get('ROUTES')

function createRouteInitializer(router: Router, name: string, path: string, method: string): RouteInitializer {

  return (init: (observable: Observable) => Observable) => {
    log.debug('initialize %s %s:%s', name, method, path)
    const subject = new Subject()
    const observable = init(subject).publish()

    router.register(path, [method], async (ctx, next) => {
      subject.onNext({ctx, next})
      await observable.first().toPromise()
    }, {
      name
    })

    observable.connect()
    return observable
  }
}

function *routeInitializerEntries(router: Router, definitions: RouteDefinitions): Iterable<RouteInitializerEntry> {
  for (let name of Object.keys(definitions)) {
    const route = definitions[name]
    for (let method of route.methods) {
      yield {
        name,
        method,
        initializer: createRouteInitializer(router, name, route.path, method)
      }
    }
  }
}

function initializeRoutes(router: Router, definitions: RouteDefinitions): RouteInitializerIndex {
  const observables = {}
  for (let route of routeInitializerEntries(router, definitions)) {
    observables[route.name] = {[route.method.toLowerCase()]: route.initializer}
  }
  return observables
}

export const router = new Router()
export const routes = initializeRoutes(router, definitions)
