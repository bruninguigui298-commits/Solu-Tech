import pool from './database.js'

// Garante as colunas novas da tabela products (idempotente: pode rodar sempre)
export async function migrate() {
    try {
        const [cols] = await pool.query(
            `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products';`
        )
        const have = new Set(cols.map(c => c.name))

        if (!have.has('brand')) {
            await pool.query('ALTER TABLE products ADD COLUMN brand VARCHAR(100) NULL AFTER description;')
            console.log('Migração: coluna products.brand criada')
        }
        if (!have.has('model_3d')) {
            await pool.query('ALTER TABLE products ADD COLUMN model_3d VARCHAR(255) NULL;')
            console.log('Migração: coluna products.model_3d criada')
        }
    }
    catch (error) {
        console.error('Falha na migração da tabela products:', error.message)
    }
}
