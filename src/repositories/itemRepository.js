import pool from '../config/db.js';

const itemRepository = {
    select: async () => {
        const sql = "SELECT i.*, p.name AS products_name, p.description AS products_description, p.duration AS products_duration, p.value AS products_value, s.name AS services_name, s.description AS services_description, s.duration AS services_duration, s.value AS services_value FROM items AS i INNER JOIN products AS p ON i.id_products = p.id INNER JOIN services AS s ON i.id_services = s.id;";
        const [rows] = await pool.query(sql);
        return rows;
    },
    selectbyId: async (id) => {
        const sql = "SELECT i.*, p.name AS products_name, p.description AS products_description, p.duration AS products_duration, p.value AS products_value, s.name AS services_name, s.description AS services_description, s.duration AS services_duration, s.value AS services_value FROM items AS i INNER JOIN products AS p ON i.id_products = p.id INNER JOIN services AS s ON i.id_services = s.id WHERE i.id = ?;";
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    },
    create: async (item) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const sql = "INSERT INTO items (id_products, id_services) VALUES (?, ?);";
            const [result] = await pool.query(sql, [item.id_products, item.id_services]);
            await conn.commit();
            return result.insertId;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            await conn.release();
        }
    },
    update: async (item) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const sql = "UPDATE items SET id_products = ?, id_services = ? WHERE id = ?;";
            const [result] = await pool.query(sql, [item.id_products, item.id_services, item.id]);
            await conn.commit();
            return result.affectedRows;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            await conn.release();
        }
    },
    delete: async (id) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const sql = "DELETE FROM items WHERE id = ?;";
            const [result] = await pool.query(sql, [id]);
            await conn.commit();
            return result.affectedRows;
        } catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            await conn.release();
        }
    }
};

export default itemRepository;

     