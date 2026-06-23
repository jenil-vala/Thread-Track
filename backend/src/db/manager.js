const knex = require('knex');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const baseConfig = require('../../knexfile');

const storage = new AsyncLocalStorage();
const instances = {};

const env = process.env.NODE_ENV || 'development';
const baseDb = knex(baseConfig[env]);

/**
 * Sanitizes a mobile number to create a safe PostgreSQL database name
 * @param {string} mobile - User's mobile number
 * @returns {string}
 */
function getTenantDbName(mobile) {
  const dbSuffix = mobile.replace(/[^a-zA-Z0-9]/g, '');
  return `thread_track_${dbSuffix}`;
}

/**
 * Retrieves or initializes a cached connection pool for the user's specific database
 * @param {string|null} dbNameOrMobile - User's database name or mobile number
 * @returns {import('knex').Knex}
 */
function getTenantDb(dbNameOrMobile) {
  if (!dbNameOrMobile) {
    return baseDb;
  }
  const dbName = dbNameOrMobile.startsWith('thread_track_')
    ? dbNameOrMobile
    : getTenantDbName(dbNameOrMobile);

  if (instances[dbName]) {
    return instances[dbName];
  }

  const config = { ...baseConfig[env] };
  config.connection = {
    ...config.connection,
    database: dbName
  };
  config.migrations = {
    directory: path.join(__dirname, 'migrations')
  };
  config.seeds = {
    directory: path.join(__dirname, 'seeds')
  };
  
  // Configure a smaller connection pool size for individual tenant databases to optimize resources
  config.pool = {
    min: 0,
    max: 3,
    idleTimeoutMillis: 30000 // Release connections when idle to avoid PG connection limit exhaustion
  };

  instances[dbName] = knex(config);
  return instances[dbName];
}

/**
 * Programmatically creates a new PostgreSQL database for a user and runs all migration files
 * @param {string} dbNameOrMobile - User's database name or mobile number
 */
async function createTenantDatabase(dbNameOrMobile) {
  if (!dbNameOrMobile) return;
  const dbName = dbNameOrMobile.startsWith('thread_track_')
    ? dbNameOrMobile
    : getTenantDbName(dbNameOrMobile);

  // 1. Check if database exists in PostgreSQL
  const checkDb = await baseDb.raw('SELECT 1 FROM pg_database WHERE datname = ?', [dbName]);
  if (checkDb.rows.length === 0) {
    // Run CREATE DATABASE. Since identifiers can't be parameterized, we safely interpolate the sanitized name
    await baseDb.raw(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully.`);
  } else {
    console.log(`Database "${dbName}" already exists.`);
  }

  // 2. Initialize schema by running migrations on the new database
  const config = { ...baseConfig[env] };
  config.connection = {
    ...config.connection,
    database: dbName
  };
  config.migrations = {
    directory: path.join(__dirname, 'migrations')
  };
  
  const tenantDb = knex(config);
  try {
    await tenantDb.migrate.latest();
    console.log(`Migrations executed successfully on database "${dbName}".`);
  } catch (error) {
    console.error(`Migrations failed on database "${dbName}":`, error);
    throw error;
  } finally {
    // Clean up temporary migration runner Knex instance
    await tenantDb.destroy();
  }
}

/**
 * Destroys and clears connection pools for old and new tenant database names when a mobile number is updated
 * @param {string} oldMobile 
 * @param {string} newMobile 
 */
function renameTenantDbCache(oldMobile, newMobile) {
  const oldDbName = getTenantDbName(oldMobile);
  const newDbName = getTenantDbName(newMobile);
  
  if (instances[oldDbName]) {
    instances[oldDbName].destroy().catch(err => console.error(`Error destroying db pool for "${oldDbName}":`, err));
    delete instances[oldDbName];
  }
  if (instances[newDbName]) {
    instances[newDbName].destroy().catch(err => console.error(`Error destroying db pool for "${newDbName}":`, err));
    delete instances[newDbName];
  }
}

module.exports = {
  storage,
  baseDb,
  getTenantDb,
  getTenantDbName,
  createTenantDatabase,
  renameTenantDbCache
};
