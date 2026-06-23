/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Ensure 'db_name' column exists in users table (in public schema)
  const schemaResult = await knex.raw('SELECT current_schema()');
  const currentSchema = schemaResult.rows[0].current_schema;

  if (currentSchema === 'public') {
    const hasDbName = await knex.schema.hasColumn('users', 'db_name');
    if (!hasDbName) {
      await knex.schema.alterTable('users', (table) => {
        table.string('db_name', 100).nullable();
      });
      console.log('Added db_name column to users table.');
    }

    // 2. Safely drop any legacy foreign key constraints that reference the users table
    // to prevent user deletion/deactivation blockages.
    await knex.raw('ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_foreign');
    await knex.raw('ALTER TABLE workflow_history DROP CONSTRAINT IF EXISTS workflow_history_updated_by_foreign');
    await knex.raw('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_created_by_foreign');
    console.log('Successfully dropped legacy users foreign key constraints if they existed.');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // No rollback needed for constraint drops and safety columns
};
