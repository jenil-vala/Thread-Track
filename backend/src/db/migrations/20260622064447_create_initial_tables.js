/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('mobile', 15).notNullable().unique();
    table.string('email', 100).unique().nullable();
    table.string('password_hash', 255).notNullable();
    table.string('role', 20).defaultTo('User'); // 'Admin', 'User'
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true); // created_at, updated_at
  });

  // Vendors table
  await knex.schema.createTable('vendors', (table) => {
    table.increments('vendor_id').primary();
    table.string('vendor_name', 150).notNullable();
    table.string('vendor_type', 50).notNullable(); // 'Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding'
    table.string('mobile', 15).notNullable();
    table.text('address').nullable();
    table.string('gst_number', 15).nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // Sarees table
  await knex.schema.createTable('sarees', (table) => {
    table.increments('saree_id').primary();
    table.integer('lot_number').notNullable().unique();
    table.string('design_name', 100).notNullable();
    table.integer('quantity').notNullable();
    table.string('current_stage', 50).notNullable(); // 'Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding', 'Completed'
    table.integer('current_vendor_id').unsigned().references('vendor_id').inTable('vendors').onDelete('SET NULL').nullable();
    table.string('status', 20).defaultTo('In Process'); // 'In Process', 'Completed', 'Hold'
    table.text('remarks').nullable();
    table.timestamps(true, true);
  });

  // Workflow history table
  await knex.schema.createTable('workflow_history', (table) => {
    table.increments('history_id').primary();
    table.integer('saree_id').unsigned().references('saree_id').inTable('sarees').onDelete('CASCADE').notNullable();
    table.string('stage_name', 50).notNullable(); // 'Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding'
    table.integer('vendor_id').unsigned().references('vendor_id').inTable('vendors').onDelete('RESTRICT').notNullable();
    table.timestamp('sent_date').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('received_date').nullable();
    table.decimal('work_cost', 12, 2).defaultTo(0.00).notNullable();
    table.text('remarks').nullable();
    table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Payments table
  await knex.schema.createTable('payments', (table) => {
    table.increments('payment_id').primary();
    table.integer('vendor_id').unsigned().references('vendor_id').inTable('vendors').onDelete('RESTRICT').notNullable();
    table.timestamp('payment_date').defaultTo(knex.fn.now()).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.string('payment_method', 50).notNullable(); // 'Cash', 'UPI', 'Bank Transfer', 'Cheque'
    table.text('remarks').nullable();
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Audit Logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('log_id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    table.string('user_name', 100).nullable();
    table.string('action', 150).notNullable();
    table.text('details').nullable();
    table.string('ip_address', 45).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Settings table
  await knex.schema.createTable('settings', (table) => {
    table.string('key', 100).primary();
    table.text('value').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('workflow_history');
  await knex.schema.dropTableIfExists('sarees');
  await knex.schema.dropTableIfExists('vendors');
  await knex.schema.dropTableIfExists('users');
};
