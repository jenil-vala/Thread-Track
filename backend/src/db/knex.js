const { storage, baseDb } = require('./manager');

/**
 * A Proxy around the base Knex instance that dynamically routes all calls
 * and property lookups to the tenant-specific Knex connection pool if active
 * in AsyncLocalStorage.
 */
const dbProxy = new Proxy(baseDb, {
  // When db is called as a function: e.g. db('sarees')
  apply(target, thisArg, argumentsList) {
    const currentDb = storage.getStore() || baseDb;
    return Reflect.apply(currentDb, thisArg, argumentsList);
  },
  // When accessing properties: e.g. db.transaction, db.raw, db.fn
  get(target, prop, receiver) {
    const currentDb = storage.getStore() || baseDb;
    const value = Reflect.get(currentDb, prop);
    if (typeof value === 'function') {
      // Bind the function to the current active Knex instance so it executes on the correct pool
      return value.bind(currentDb);
    }
    return value;
  }
});

module.exports = dbProxy;
