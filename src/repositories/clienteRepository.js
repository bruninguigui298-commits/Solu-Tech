import pool from '../configs/database.js'
import Addresses from '../models/Addresses.js'

const clienteRepository = {
    select: async() => {
        const sql = `SELECT 
                        c.*,
                        p.id AS "id_tel", p.ddd, p.number, p.observation,
                        a.id As "id_end", a.street, a.number, a.district, a.city, a.state, a.cep
                    FROM clients AS c
                    INNER JOIN phones AS p
                        ON c.id = p.id_clients
                    INNER JOIN addresses AS a ON c.id = a.id_clients;`
        const [rows] = await pool.execute(sql)
        return rows
    },
    selectId: async(clientId) => {
        const sql = 'SELECT * FROM clients WHERE id = ?;'
        const [rows] = await pool.execute(sql, [clientId])
        return rows
    },
    delete: async (clientId) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const sqlTel = 'DELETE FROM phones WHERE id_clients = ?;'
            const [rowsTel] = await conn.execute(sqlTel, [clientId]);

            const sqlEnd = 'DELETE FROM addresses WHERE id_clients = ?;'
            const [rowsEnd] = await conn.execute(sqlEnd, [clientId]);

            const sqlCli = 'DELETE FROM clients WHERE id = ?;';
            const [rowsCli] = await conn.execute(sqlCli, [clientId]);
            
            await conn.commit();

            return {
                cliente: rowsCli,
                phone: rowsTel,
                addresses: rowsEnd
            };
        }
        catch(error) {
            console.error("Erro ao deletar cliente no repository:", error);
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
    },
    create: async (cliente) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            const sqlCli = 'INSERT INTO clients (name, email, cpf) VALUES(?, ?, ?);'
            const [rowsCli] = await conn.execute(sqlCli, [cliente.name, cliente.email, cliente.cpf]);

            const idCliente = rowsCli.insertId;
            
           
            const sqlTel = 'INSERT INTO phones VALUES(null, ?, ?, ?, ?);'
            const [rowsTel] = await conn.execute(sqlTel, [cliente.phone.observation, cliente.phone.number, cliente.phone.ddd, idCliente]);
            
    
            const sqlEnd = 'INSERT INTO addresses VALUES(null, ?, ?, ?, ?, ?, ?, ?);'
            const [rowsEnd] = await conn.execute(sqlEnd, [cliente.addresses.street, cliente.addresses.number, cliente.addresses.district, cliente.addresses.city, cliente.addresses.state, cliente.addresses.cep, idCliente])
            await conn.commit();

            return {
                cliente: rowsCli,
                phone: rowsTel,
                addresses: rowsEnd
            };
        }
        catch(error){
            console.log(error);
            await conn.rollback();
            throw error;
        }
        finally{
            conn.release();
        }
    },
    
    update: async (client) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

    
            const sqlCli = 'UPDATE clients SET name = ?, email = ?, cpf = ? WHERE id = ?;';
            const [rowsCli] = await conn.execute(sqlCli, [
                client.name || null, 
                client.email || null, 
                client.cpf || null, 
                client.id
            ]);

            const sqlTel = 'UPDATE phones SET observation = ?, number = ?, ddd = ? WHERE id_clients = ?;'; 
            const [rowsTel] = await conn.execute(sqlTel, [
                client.phone?.observation || null,
                client.phone?.number || null,
                client.phone?.ddd || null,
                client.id 
            ]);

    
            const sqlEnd = 'UPDATE addresses SET street = ?, number = ?, district = ?, city = ?, state = ?, cep = ? WHERE id_clients = ?;';
            const [rowsEnd] = await conn.execute(sqlEnd, [
                client.addresses?.street || null,
                client.addresses?.number || null,
                client.addresses?.district || null,
                client.addresses?.city || null,
                client.addresses?.state || null,
                client.addresses?.cep || null,
                client.id 
            ]);

            await conn.commit();
            
            return {
                cliente: rowsCli,
                phone: rowsTel,
                addresses: rowsEnd
            };
        }
        catch(error){
            console.log(error);
            await conn.rollback();
            throw error;
        }
        finally{
            conn.release();
        }
    }
}

export default clienteRepository;
