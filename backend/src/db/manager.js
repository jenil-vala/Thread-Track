const knex = require('knex');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const baseConfig = require('../../knexfile');

const storage = new AsyncLocalStorage();
const instances = {};

const env = process.env.NODE_ENV || 'development';
const baseDb = knex(baseConfig[env]);

let multiTenancyMode = 'schema';
const initializedTenants = new Set();

/**
 * Detects whether the database user has privileges to run CREATE DATABASE
 * to dynamically select between 'database' and 'schema' multi-tenancy.
 */
async function detectMultiTenancyMode() {
  try {
    // Try to query pg_database to see if we can read it
    await baseDb.raw('SELECT 1 FROM pg_database LIMIT 1');
    
    // Try to create a temporary test database to verify CREATE DATABASE privilege
    const testDbName = 'thread_track_test_connection_privilege';
    try {
      await baseDb.raw(`CREATE DATABASE "${testDbName}"`);
      await baseDb.raw(`DROP DATABASE "${testDbName}"`);
      multiTenancyMode = 'database';
      console.log('=========================================');
      console.log('Multi-Tenancy Mode: DATABASE (Separate PG databases)');
      console.log('=========================================');
    } catch (createErr) {
      console.log('=========================================');
      console.log('Multi-Tenancy Mode: SCHEMA (Fallback to schemas)');
      console.log('=========================================');
      multiTenancyMode = 'schema';
    }
  } catch (err) {
    console.log('=========================================');
    console.log('Multi-Tenancy Mode: SCHEMA (Fallback to schemas)');
    console.log('=========================================');
    multiTenancyMode = 'schema';
  }
}

function getMultiTenancyMode() {
  return multiTenancyMode;
}

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
 * Routes a connection configuration to the tenant-specific database.
 * If the connection is a string (e.g. DATABASE_URL) or has a connectionString,
 * it parses it as a URL and swaps the database name.
 * @param {string|object} connection
 * @param {string} dbName
 * @returns {string|object}
 */
function getRoutedConnection(connection, dbName) {
  if (typeof connection === 'string') {
    try {
      const parsedUrl = new URL(connection);
      parsedUrl.pathname = `/${dbName}`;
      return parsedUrl.toString();
    } catch (e) {
      console.error('Failed to parse database connection string URL:', e);
      return connection;
    }
  }
  if (connection && typeof connection === 'object') {
    if (connection.connectionString) {
      try {
        const parsedUrl = new URL(connection.connectionString);
        parsedUrl.pathname = `/${dbName}`;
        return {
          ...connection,
          connectionString: parsedUrl.toString()
        };
      } catch (e) {
        console.error('Failed to parse connectionString URL:', e);
      }
    }
    return {
      ...connection,
      database: dbName
    };
  }
  return connection;
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
  
  if (multiTenancyMode === 'database') {
    config.connection = getRoutedConnection(config.connection, dbName);
  } else {
    config.searchPath = [dbName];
  }
  
  config.migrations = {
    directory: path.join(__dirname, 'migrations')
  };
  config.seeds = {
    directory: path.join(__dirname, 'seeds')
  };
  
  // Configure a smaller connection pool size for individual tenant databases to optimize resources
  config.pool = {
    min: 0,
    max: 2,
    idleTimeoutMillis: 5000 // Release connections quickly to avoid PG connection limit exhaustion
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

  if (initializedTenants.has(dbName)) {
    return;
  }

  if (multiTenancyMode === 'database') {
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
    config.connection = getRoutedConnection(config.connection, dbName);
    config.migrations = {
      directory: path.join(__dirname, 'migrations')
    };
    
    const tenantDb = knex(config);
    try {
      await tenantDb.migrate.latest();
      console.log(`Migrations executed successfully on database "${dbName}".`);
      initializedTenants.add(dbName);
    } catch (error) {
      console.error(`Migrations failed on database "${dbName}":`, error);
      throw error;
    } finally {
      // Clean up temporary migration runner Knex instance
      await tenantDb.destroy();
    }
  } else {
    // 1. Create schema if it doesn't exist
    await baseDb.raw(`CREATE SCHEMA IF NOT EXISTS "${dbName}"`);
    console.log(`Schema "${dbName}" created successfully.`);

    // 2. Initialize schema by running migrations on the new schema
    const config = { ...baseConfig[env] };
    config.searchPath = [dbName];
    config.migrations = {
      directory: path.join(__dirname, 'migrations')
    };
    
    const tenantDb = knex(config);
    try {
      await tenantDb.migrate.latest();
      console.log(`Migrations executed successfully on schema "${dbName}".`);
      initializedTenants.add(dbName);
    } catch (error) {
      console.error(`Migrations failed on schema "${dbName}":`, error);
      throw error;
    } finally {
      await tenantDb.destroy();
    }
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
  renameTenantDbCache,
  getRoutedConnection,
  detectMultiTenancyMode,
  getMultiTenancyMode
};
