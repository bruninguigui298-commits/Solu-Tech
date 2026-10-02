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
    createServices: async (name, description, duration, value) => {
        const sql = "INSERT INTO services (name, description, duration, value) VALUES (?, ?, ?, ?)";
        const [rows] = await pool.query(sql, [name, description, duration, value]);
        return rows;
    }, 
    updateServices: async (name, description, duration, value, id) => {
        console.log(name, description, duration, value, id)
        const sql = "UPDATE services SET name = ?, description = ?, duration = ?, value = ? WHERE id = ?";
        const [rows] = await pool.query(sql, [name, description, duration, value, id]);
        return rows;
    },
    delete: async (ID) => {
        const sql = "DELETE FROM services WHERE id = ?";
        const [rows] = await pool.query(sql, [ID]);
        return rows;
    }
};

export default serviceRepository;