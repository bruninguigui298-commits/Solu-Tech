import pool from "../configs/database.js";

const itemRepository = {

    select: async () => {
        const sql = `
        SELECT i.*,
               p.name AS products_name,
               p.description AS products_description,
               p.quantity AS products_quantity,
               p.value AS products_value,
               s.name AS services_name,
               s.description AS services_description,
               s.duration AS services_duration,
               s.value AS services_value
        FROM items AS i
        LEFT JOIN products AS p ON i.id_products = p.id
        LEFT JOIN services AS s ON i.id_services = s.id;
    `;
        const [result] = await pool.query(sql);
        return result;
    },
    selectbyId: async (id) => {
        const sql = `
        SELECT i.*,
               p.name AS products_name,
               p.description AS products_description,
               p.quantity AS products_quantity,
               p.value AS products_value,
               s.name AS services_name,
               s.description AS services_description,
               s.duration AS services_duration,
               s.value AS services_value
        FROM items AS i
        INNER JOIN products AS p ON i.id_products = p.id
        INNER JOIN services AS s ON i.id_services = s.id
        WHERE i.id = ?;
    `;
        const [result] = await pool.query(sql, [id]);
        return result[0];
    },
    create: async (item) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            console.log("ITEM RECEBIDO NO CREATE:", item);
            const sql = `INSERT INTO items (quantity, value, subtotal, id_sales, id_products, id_services)
                     VALUES (?, ?, ?, ?, ?, ?);`;
            const [result] = await conn.query(sql, [
                item.quantity,
                item.value,
                item.subtotal,
                item.id_sales,
                item.id_products ?? null,
                item.id_services ?? null
            ]);
            await conn.commit();
            return result.insertId;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    },
    updateItem: async (quantity, value, subtotal, id_sales, id_products, id_services) => {
        try {
          const sql = 'UPDATE item SET quantity = ?, value = ?, subtotal = ?, id_sales =?, id_products = ?, id_services = ? WHERE id = ?;'
        const [rows] = await pool.execute(sql, [quantity, value, subtotal, id_sales, id_products, id_services])
        return rows
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    deleteItem: async (id) => {
        try {
            const sql = "DELETE FROM items WHERE id = ?"
        const [rows] = await pool.query(sql, [id]);
        return rows;
        }
         catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};

export default itemRepository;

