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


    create: async (sale, items = []) => {

        const conn = await pool.getConnection()

        try {

            await conn.beginTransaction()

            // Valida estoque e calcula valores com base no banco
            // (FOR UPDATE trava a linha: evita vender o mesmo estoque 2x)
            const rowsItems = []
            let total = 0

            for (const item of items) {

                const quantity = Number(item.quantity)
                let value

                if (item.id_products) {

                    const [prod] = await conn.execute(
                        'SELECT id, name, quantity, value FROM products WHERE id = ? FOR UPDATE;',
                        [item.id_products]
                    )

                    if (prod.length === 0) {
                        throw new Error('Produto não encontrado')
                    }

                    if (prod[0].quantity < quantity) {
                        throw new Error(
                            `Estoque insuficiente para ${prod[0].name} (disponível: ${prod[0].quantity})`
                        )
                    }

                    value = Number(prod[0].value)
                }
                else {

                    const [serv] = await conn.execute(
                        'SELECT id, value FROM services WHERE id = ?;',
                        [item.id_services]
                    )

                    if (serv.length === 0) {
                        throw new Error('Serviço não encontrado')
                    }

                    value = Number(serv[0].value)
                }

                const subtotal = +(value * quantity).toFixed(2)
                total += subtotal

                rowsItems.push({
                    id_products: item.id_products ?? null,
                    id_services: item.id_services ?? null,
                    quantity,
                    value,
                    subtotal
                })
            }

            const finalTotal = rowsItems.length > 0
                ? +total.toFixed(2)
                : sale.total

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
                    finalTotal,
                    sale.payment_method,
                    sale.id_clients,
                    sale.id_users
                ]
            )

            for (const it of rowsItems) {

                await conn.execute(
                    `INSERT INTO items
                        (quantity, value, subtotal, id_sales, id_products, id_services)
                     VALUES (?, ?, ?, ?, ?, ?);`,
                    [
                        it.quantity,
                        it.value,
                        it.subtotal,
                        rowsSale.insertId,
                        it.id_products,
                        it.id_services
                    ]
                )

                // baixa de estoque
                if (it.id_products) {
                    await conn.execute(
                        'UPDATE products SET quantity = quantity - ? WHERE id = ?;',
                        [it.quantity, it.id_products]
                    )
                }
            }

            await conn.commit()

            return {
                sale: rowsSale,
                total: finalTotal,
                items: rowsItems.length
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

            // devolve ao estoque os produtos da venda e remove os itens
            const [soldItems] = await conn.execute(
                'SELECT id_products, quantity FROM items WHERE id_sales = ? AND id_products IS NOT NULL;',
                [saleId]
            )

            for (const it of soldItems) {
                await conn.execute(
                    'UPDATE products SET quantity = quantity + ? WHERE id = ?;',
                    [it.quantity, it.id_products]
                )
            }

            await conn.execute(
                'DELETE FROM items WHERE id_sales = ?;',
                [saleId]
            )

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