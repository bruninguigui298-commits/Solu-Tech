import pool from '../configs/database.js'

const saleRepository = {

    select: async () => {

        const sql = `
            SELECT
                s.*,
                c.name AS client_name,
                c.email AS client_email,
                u.email AS user_email
            FROM sales AS s
            INNER JOIN clients AS c
                ON s.id_clients = c.id
            INNER JOIN users AS u
                ON s.id_users = u.id;
        `

        const [rows] = await pool.execute(sql)

        return rows
    },


    selectId: async (saleId) => {

        const sql = `
            SELECT
                s.*,
                c.name AS client_name,
                c.email AS client_email,
                u.email AS user_email
            FROM sales AS s
            INNER JOIN clients AS c
                ON s.id_clients = c.id
            INNER JOIN users AS u
                ON s.id_users = u.id
            WHERE s.id = ?;
        `

        const [rows] = await pool.execute(
            sql,
            [saleId]
        )

        return rows
    },


    create: async (sale) => {

        const conn = await pool.getConnection()

        try {

            await conn.beginTransaction()

            const sqlSale = `
                INSERT INTO sales
                (
                    total,
                    payment_method,
                    id_clients,
                    id_users
                )
                VALUES (?, ?, ?, ?);
            `

            const [rowsSale] = await conn.execute(
                sqlSale,
                [
                    sale.total,
                    sale.payment_method,
                    sale.id_clients,
                    sale.id_users
                ]
            )


            await conn.commit()

            return {
                sale: rowsSale
            }

        }
        catch (error) {

            console.log(
                "Erro ao criar venda no repository:",
                error
            )

            await conn.rollback()

            throw error
        }
        finally {

            conn.release()
        }
    },


    update: async (sale) => {

        const conn = await pool.getConnection()

        try {

            await conn.beginTransaction()

            const sqlSale = `
                UPDATE sales
                SET
                    total = ?,
                    payment_method = ?,
                    id_clients = ?,
                    id_users = ?
                WHERE id = ?;
            `

            const [rowsSale] = await conn.execute(
                sqlSale,
                [
                    sale.total,
                    sale.payment_method,
                    sale.id_clients,
                    sale.id_users,
                    sale.id
                ]
            )


            await conn.commit()

            return {
                sale: rowsSale
            }

        }
        catch (error) {

            console.log(
                "Erro ao atualizar venda no repository:",
                error
            )

            await conn.rollback()

            throw error
        }
        finally {

            conn.release()
        }
    },


    delete: async (saleId) => {

        const conn = await pool.getConnection()

        try {

            await conn.beginTransaction()

            const sqlSale = `
                DELETE FROM sales
                WHERE id = ?;
            `

            const [rowsSale] = await conn.execute(
                sqlSale,
                [saleId]
            )


            await conn.commit()

            return {
                sale: rowsSale
            }

        }
        catch (error) {

            console.log(
                "Erro ao deletar venda no repository:",
                error
            )

            await conn.rollback()

            throw error
        }
        finally {

            conn.release()
        }
    }

}

export default saleRepository