const db = require('../db/knex');

/**
 * Logs an action to the audit_logs database table
 * @param {number|null} userId - The user ID performing the action
 * @param {string|null} userName - The name of the user performing the action
 * @param {string} action - Action description (e.g. 'LOGIN', 'ADD_SAREE')
 * @param {string|object|null} details - Additional contextual details
 * @param {string|null} ipAddress - Client IP address
 */
async function logAction(userId, userName, action, details = null, ipAddress = null) {
  try {
    await db('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      action,
      details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

module.exports = { logAction };
