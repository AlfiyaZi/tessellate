import fs = require('fs');
import path = require('path');
import changeCase = require('change-case');
import { Logger, LoggerInstance, transports } from 'winston';

/**
 * Custom logger for Conf.ts only to avoid a cyclic dependency.
 */
const log: LoggerInstance = new Logger({
  transports: [new (transports.Console)({
    level: process.env.TESSELLATE_LOG_LEVEL
  })]
});

function readFile(file: string, parser: (s: string) => object): object {
  try {
    return parser(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`Unable to read ${file}`);
    return {};
  }
}

function readConfigFile(filePath: string): object {
  const extname = path.extname(filePath);

  switch (extname) {
    case '.yml':
    case '.yaml':
      return readFile(filePath, require('js-yaml').safeLoad);
    case '.json':
      return readFile(filePath, JSON.parse);
    default:
      log.error(`Unsupported file: ${filePath}\n`);
      return {};
  }
}

/**
 * A storage of configuration values.
 */
export type Store = { [key: string]: any };

function firstDefined<A, B>(a: A | undefined, b?: B): A | B | void {
  if (a !== undefined) return a;
  else return b;
}

/**
 * A hierarchical configuration provider that supports multiple sources.
 */
export class Conf {
  private readonly override: Store;
  private readonly stores: { [name: string]: Store };
  private readonly storeNames: string[];

  constructor() {
    this.override = {};
    this.stores = {};
    this.storeNames = [];
  }

  private resolve(name: string): any {
    if (name in this.override) {
      return this.override[name];
    }

    for (const key of this.storeNames) {
      if (name in this.stores[key]) {
        return this.stores[key][name];
      }
    }
  }

  private exists(name: string): boolean {
    if (name in this.override) {
      return true;
    }

    for (const key in this.stores) {
      if (name in this.stores[key]) {
        return true;
      }
    }
    return false;
  }

  private addStore(store: Store, name: string): void {
    this.stores[name] = store;
    this.storeNames.push(name);
  }

  /**
   * Use environment variables as a source. If a prefix is configured,
   * it will be prepended to configuration value names during lookup.
   *
   * When looking up environment variables, all names will be transformed
   * into CONSTANT_CASE. This means that environment variables must be
   * declared in CONSTANT_CASE.
   * @param prefix Prefix of environment variables.
   * @return This Conf instance.
   */
  public withEnv(prefix: string = ''): Conf {
    const prefixValue = changeCase.constant(prefix);
    const getEnvName = (name: string) => {
      const keyValue = changeCase.constant(name);
      return prefixValue ? `${prefixValue}_${keyValue}` : keyValue;
    };

    const store = new Proxy({}, {
      get: (_, name: string) => {
        return process.env[getEnvName(name)];
      },
      has: (_, name: string) => {
        return getEnvName(name) in process.env;
      }
    });

    const storeName = prefixValue ? `ENV_${prefixValue}` : 'ENV';
    this.addStore(store, storeName);
    return this;
  }

  /**
   * Use a configuration file as a source. JSON and YAML are supported.
   * @param file The absolute or relative file path.
   * @return This Conf instance.
   */
  public withFile(file: string): Conf {
    if (!file) {
      return this;
    }
    const filePath = path.resolve(process.cwd(), file);
    this.addStore(readConfigFile(filePath), filePath);
    return this;
  }

  /**
   * Use an object as a source.
   * @param store Object store to use.
   * @param name Optional name of the store.
   * @return This Conf instance.
   */
  public withStore(store: Store, name: string = 'default'): Conf {
    this.addStore(Object.assign({}, store), name);
    return this;
  }

  /**
   * Set an override value.
   * @param key Name of the value.
   * @param value Actual value.
   * @return This Conf instance.
   */
  public set(key: string, value: any): Conf {
    this.override[key] = value;
    return this;
  }

  /**
   * Return a stored value.
   * @param name Name of the value.
   * @param fallback optional fallback value.
   * @return The stored value.
   */
  public get(name: string, fallback?: any): any {
    return firstDefined(this.resolve(name), fallback);
  }

  /**
   * Return a stored value as a string.
   * @param name Name of the value.
   * @param fallback optional fallback value.
   * @return The stored value as a string.
   */
  public getString(name: string, fallback: string): string;
  public getString(name: string, fallback?: string): string | void;
  public getString(name: string, fallback?: string): string | void {
    const value = this.resolve(name);
    if (typeof value === 'string') {
      return value;
    } else {
      return firstDefined(JSON.stringify(value), fallback);
    }
  }

  /**
   * Return a stored value as a number.
   * @param name Name of the value.
   * @param fallback optional fallback value.
   * @return The stored value as a number.
   */
  public getNumber(name: string, fallback: number): number;
  public getNumber(name: string, fallback?: number): number | void;
  public getNumber(name: string, fallback?: number): number | void {
    const value = parseFloat(this.resolve(name));
    if (isNaN(value)) {
      if (fallback !== undefined) return fallback;
      else throw new Error(`Not a number: ${value}`);
    }
    return value;
  }

  /**
   * Return a stored value as a boolean.
   * @param name Name of the value.
   * @return The stored value as a boolean.
   */
  public getBoolean(name: string): boolean {
    const value = this.resolve(name);
    return value !== false && value !== 'false' && this.exists(name);
  }

  /**
   * Return a stored value as an object.
   * @param name Name of the value.
   * @param fallback optional fallback value.
   * @return The stored value as an object.
   */
  public getObject(name: string, fallback: object): object;
  public getObject(name: string, fallback?: object): object | void;
  public getObject(name: string, fallback?: object): object | void {
    const value = this.resolve(name);
    if (typeof value === 'string') {
      try {
        return firstDefined(JSON.parse(value), fallback);
      } catch (e) {
        throw new Error(`Not an object: ${value}`);
      }
    } else {
      return firstDefined(value, fallback);
    }
  }
}

const configFilePath = process.env.TESSELLATE_CONF || '';
if (!configFilePath) {
  log.warn('No config file provided. Consider setting TESSELLATE_CONF.');
}

/**
 * Default configuration instance for Tessellate services.
 */
export default new Conf().withEnv('tessellate').withFile(configFilePath);