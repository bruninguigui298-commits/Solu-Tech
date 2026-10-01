import pool from '../configs/database.js'

const userRepository = {
    select: async() => {
        const sql = 'SELECT * FROM users;'
        const [rows] = await pool.execute(sql)
        return rows
    },
    selectId: async(userId) => {
        const sql = 'SELECT * FROM user WHERE id;'
        const [rows] = await pool.execute(sql, [userId])
        return rows
    },
    delete: async (userId) => {
        const sql = 'DELETE FROM users WHERE id = ?;'
        const [rows] = await pool.execute(sql, [userId])
        return rows
    },
    
    create: async (email, name , password) => {
        console.log(email, name, password);
        
        const sql = 'INSERT INTO users VALUES(null, ?, ?, ?);'
        const [rows] = await pool.execute(sql, [email, name, password])
        return rows
    },
    
    update: async (email, name, password,userId) => {
        const sql = 'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?;'
        const [rows] = await pool.execute(sql, [email, name, password,userId])
        return rows
    },
    
    selectEmail: async (email) => {
        const sql = 'SELECT * FROM users WHERE email = ?;'
        const [rows] = await pool.execute(sql, [email])
        return rows
    }



}

export default userRepository;
