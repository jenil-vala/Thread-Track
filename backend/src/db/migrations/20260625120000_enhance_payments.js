/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Alter payments table
  const hasHistoryId = await knex.schema.hasColumn('payments', 'history_id');
  if (!hasHistoryId) {
    await knex.schema.alterTable('payments', (table) => {
      table.integer('history_id').unsigned().references('history_id').inTable('workflow_history').onDelete('SET NULL').nullable();
      table.decimal('discount', 12, 2).defaultTo(0.00).notNullable();
      table.text('discount_reason').nullable();
      table.timestamp('discount_date').nullable();
      table.integer('discount_by_user').unsigned().nullable();
    });
    console.log('Added history_id and discount columns to payments table.');
  }

  // 2. Create payment_history table
  if (!await knex.schema.hasTable('payment_history')) {
    await knex.schema.createTable('payment_history', (table) => {
      table.increments('payment_history_id').primary();
      table.integer('payment_id').nullable();
      table.integer('vendor_id').nullable();
      table.string('vendor_name', 150).nullable();
      table.string('vendor_type', 50).nullable();
      table.integer('lot_number').nullable();
      table.string('challan_number', 50).nullable();
      table.decimal('amount', 12, 2).nullable();
      table.decimal('discount', 12, 2).nullable();
      table.string('payment_method', 50).nullable();
      table.timestamp('payment_date').nullable();
      table.string('created_by_name', 100).nullable();
      table.integer('created_by_id').unsigned().nullable();
      table.string('action_type', 50).nullable(); // 'INSERT', 'UPDATE', 'DELETE'
      table.text('remarks').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created payment_history table.');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('payment_history');
  
  const hasHistoryId = await knex.schema.hasColumn('payments', 'history_id');
  if (hasHistoryId) {
    await knex.schema.alterTable('payments', (table) => {
      table.dropColumn('history_id');
      table.dropColumn('discount');
      table.dropColumn('discount_reason');
      table.dropColumn('discount_date');
      table.dropColumn('discount_by_user');
    });
    console.log('Dropped history_id and discount columns from payments table.');
  }
};
