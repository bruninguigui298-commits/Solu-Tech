import pool from "../configs/database.js";

const serviceRepository = {
    listServices: async () => {
        const sql = "SELECT * FROM services";
        const [rows] = await pool.query(sql);
        return rows;
    },
    servicesId: async (ID) => {
        const sql = "SELECT * FROM services WHERE id = ?";
        const [rows] = await pool.query(sql, [ID]);
        return rows[0];
    },
    createServices: async (name, description, value, duration) => {
        const sql = "INSERT INTO services (name, description, value, duration) VALUES (?, ?, ?, ?)";
        const [rows] = await pool.query(sql, [name, description, value, duration]);
        return rows.insertId;
    }, 
    updateServices: async (name, description, value, duration, id) => {
        const sql = "UPDATE services SET name = ?, description = ?, value = ?, duration = ? WHERE id = ?";
        const [rows] = await pool.query(sql, [name, description, value, duration, id]);
        return rows;
    },
    delete: async (ID) => {
        const sql = "DELETE FROM services WHERE id = ?";
        const [rows] = await pool.query(sql, [ID]);
        return rows;
    }
};

export default serviceRepository;