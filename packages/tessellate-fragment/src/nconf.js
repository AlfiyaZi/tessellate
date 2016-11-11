// @flow

import fs from 'fs'
import path from 'path'
import nconf from 'nconf'
import yaml from 'js-yaml'
import logger from './logger'

const log = logger('nconf')

function readYamlFile(file: string): Object {
  try {
    return yaml.safeLoad(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    log.warn(`Unable to load ${file}`)
    return {}
  }
}

const configFile = path.resolve(process.cwd(), 'config.yaml')
const routesFile = path.resolve(process.cwd(), 'routes.yaml')

export default nconf.use('memory')
                    .argv()
                    .env()
                    .add('config', {type: 'literal', store: readYamlFile(configFile)})
                    .add('config', {type: 'literal', store: {ROUTES: readYamlFile(routesFile)}})
                    .defaults({
                      APP_PORT: 3002,
                      MORGAN_FORMAT: 'dev',
                      MORGAN_THRESHOLD: 0,
                      BUNDLE_SOURCE: 'http://localhost:3001'
                    })
