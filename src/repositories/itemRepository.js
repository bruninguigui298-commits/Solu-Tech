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
        LEFT JOIN products AS p ON i.id_products = p.id
        LEFT JOIN services AS s ON i.id_services = s.id
        WHERE i.id = ?;
    `;
        const [result] = await pool.query(sql, [id]);
        return result[0];
    },
    create: async (item) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const sql = `INSERT INTO items (quantity, value, subtotal, id_products, id_services)
                     VALUES (?, ?, ?, ?, ?);`;
            const [result] = await conn.query(sql, [
                item.quantity,
                item.value,
                item.subtotal,
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
    updateItem: async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: "Invalid id" });
            }
            const { quantity, value, subtotal, id_products, id_services } = req.body;
            const item = new itemModel(id, quantity, value, subtotal, id_products, id_services);
            const affectedRows = await itemService.updateItem(item);
            if (affectedRows === 0) {
                return res.status(404).json({ message: "Item not found" });
            }
            return res.status(200).json({ message: "Item updated successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    deleteItem: async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: "Invalid id" });
            }
            const affectedRows = await itemService.deleteItem(id);
            if (affectedRows === 0) {
                return res.status(404).json({ message: "Item not found" });
            }
            return res.status(200).json({ message: "Item deleted successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};

export default itemRepository;

