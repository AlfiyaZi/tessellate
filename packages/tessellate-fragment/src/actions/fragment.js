// @flow

import path from 'path'
import logger from '../logger'
import { Observer, Observable, Subject } from 'rx'
import { Problem } from '../error'
import * as bundleService from '../bundle-service'
import renderToString from 'tessellate-render'

import type { Context } from '../server'

type FetchBundleResponse = Context & { bundle: Object; }

const log = logger('actions:fragment')

class FragmentProblem extends Problem {
  constructor(detail: string) {
    super({title: 'Fragment Error.', detail, status: 404})
  }
}

export async function onFetchBundle({ctx}: Context): Promise<FetchBundleResponse> {
  log.info('onFetchBundle')

  const bundleName = parseBundleName(ctx.request.headers['x-zalando-request-uri'])
  const bundle = await bundleService.fetchBundle(bundleName)

  return {ctx, bundle}
}

export async function onRenderBundle({ctx, bundle}: FetchBundleResponse) {
  log.info('onRenderBundle')

  ctx.set({
    'Content-Type': 'text/html;charset=utf-8',
    'Link': [
      `<${bundle.links.css}>; rel="stylesheet"`,
      `<${bundle.links.js}>; rel="fragment-script"`
    ]
  })
  ctx.body = renderToString(bundle.source, ctx.request.headers)
}

function parseBundleName(requestURI: ?string): string {
  if (!requestURI) throw new FragmentProblem('Request URI not present.')

  const {hostname, pathname} = url.parse(requestURI)

  if (hostname && pathname) return path.join(hostname.replace(/^www\./, ''), pathname)
  else throw new FragmentProblem(`Illegal URI '${requestURI}'`)
}
