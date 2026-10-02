import ItemModel from '../models/ItemModel.js'
import Sale from '../models/Sale.js'
import productService from '../services/productService.js'
import saleService from '../services/saleService.js'
import serviceService from '../services/serviceService.js'

const saleController = {

    select: async (req, res) => {

        try {

            const sales =
                await saleService.select()

            return res.status(200).json({
                success: true,
                sales
            })

        }
        catch (error) {

            console.error(
                'Erro ao buscar vendas:',
                error
            )

            return res.status(500).json({
                success: false,
                message: error.message
            })
        }
    },


    selectId: async (req, res) => {

        try {

            const saleId =
                Number(req.params.id)

            const sale =
                await saleService.selectId(saleId)

            return res.status(200).json({
                success: true,
                sale
            })

        }
        catch (error) {

            console.error(
                'Erro ao buscar venda:',
                error
            )

            return res.status(404).json({
                success: false,
                message: error.message
            })
        }
    },


    create: async (req, res) => {

        try {

            const {
                number,
                payment_method,
                id_client,
                itens
            } = req.body

            const idUser = req.user.id;

            const itensObj = await Promise.all(
                itens.map(async (item) => {
                    if (item.id_product) {
                        const product = await productService.recoverproductsbyID(
                            item.id_product
                        );

                        return new ItemModel(
                            null,
                            item.quantity,
                            product[0].value,
                            0,
                            null,
                            product[0].id,
                            null
                        );
                    } else {
                        const service = await serviceService.recoverServicesbyID(
                            item.id_service
                        );

                        return new ItemModel(
                            null,
                            item.quantity,
                            service[0].value,
                            0,
                            null,
                            null,
                            service[0].id
                        );
                    }
                })
            );

            const sale = new Sale(
                0,
                payment_method,
                id_client,
                idUser,
                itensObj,
                null,
                null
            )

            const result =
                await saleService.create(sale)


            return res.status(201).json({
                success: true,
                message: 'Venda criada com sucesso',
                result
            })

        }
        catch (error) {

            console.error(
                'Erro ao criar venda:',
                error
            )

            return res.status(400).json({
                success: false,
                message: error.message
            })
        }
    },


    update: async (req, res) => {

        try {

            const saleId =
                Number(req.params.id)

            const {
                total,
                payment_method,
                id_clients,
                id_users
            } = req.body


            const sale = new Sale(
                Number(total),
                payment_method,
                Number(id_clients),
                Number(id_users),
                null,
                saleId
            )


            const result =
                await saleService.update(sale)


            return res.status(200).json({
                success: true,
                message: 'Venda atualizada com sucesso',
                result
            })

        }
        catch (error) {

            console.error(
                'Erro ao atualizar venda:',
                error
            )

            return res.status(400).json({
                success: false,
                message: error.message
            })
        }
    },


    delete: async (req, res) => {

        try {

            const saleId =
                Number(req.params.id)


            const result =
                await saleService.delete(saleId)


            return res.status(200).json({
                success: true,
                message: 'Venda deletada com sucesso',
                result
            })

        }
        catch (error) {

            console.error(
                'Erro ao deletar venda:',
                error
            )

            return res.status(400).json({
                success: false,
                message: error.message
            })
        }
    }

}

export default saleController