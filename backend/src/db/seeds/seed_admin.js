const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries in users table
  // Clean order to prevent foreign key errors: delete from payments, workflow_history, sarees first
  await knex('audit_logs').del();
  await knex('payments').del();
  await knex('workflow_history').del();
  await knex('sarees').del();
  await knex('users').del();
  
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  await knex('users').insert([
    {
      name: 'Admin Developer',
      mobile: '9879312949',
      email: 'admin@threadtrack.com',
      password_hash: passwordHash,
      role: 'Admin',
      active: true
    }
  ]);

  console.log('Seeded database with default admin user: mobile "9879312949", password "admin123"');
};
