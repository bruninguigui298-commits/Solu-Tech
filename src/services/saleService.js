import saleRepository from '../repositories/saleRepository.js'

const saleService = {

    select: async () => {

        const sales = await saleRepository.select()

        return sales
    },


    selectId: async (saleId) => {

        if (!saleId) {
            throw new Error('ID da venda não informado')
        }

        const sale = await saleRepository.selectId(saleId)

        if (sale.length === 0) {
            throw new Error('Venda não encontrada')
        }

        return sale
    },


    create: async (sale, items = []) => {

        if (!Array.isArray(items)) {
            throw new Error('Os itens da venda devem ser uma lista')
        }

        for (const item of items) {

            if (!item.id_products && !item.id_services) {
                throw new Error(
                    'Cada item precisa de um produto ou serviço'
                )
            }

            if (!Number.isInteger(Number(item.quantity)) ||
                Number(item.quantity) <= 0) {
                throw new Error(
                    'A quantidade de cada item deve ser um inteiro maior que zero'
                )
            }
        }

        // com itens, o total é recalculado no repository
        if (items.length > 0) {
            sale.total = sale.total > 0 ? sale.total : 1
        }

        if (!sale.total) {
            throw new Error(
                'O valor total da venda é obrigatório'
            )
        }

        if (sale.total <= 0) {
            throw new Error(
                'O valor total deve ser maior que zero'
            )
        }

        if (!sale.payment_method) {
            throw new Error(
                'O método de pagamento é obrigatório'
            )
        }

        if (!sale.id_clients) {
            throw new Error(
                'O cliente é obrigatório'
            )
        }

        if (!sale.id_users) {
            throw new Error(
                'O usuário responsável pela venda é obrigatório'
            )
        }

        return await saleRepository.create(sale, items)
    },


    update: async (sale) => {

        if (!sale.id) {
            throw new Error(
                'ID da venda é obrigatório'
            )
        }

        if (!sale.total || sale.total <= 0) {
            throw new Error(
                'O valor total deve ser maior que zero'
            )
        }

        if (!sale.payment_method) {
            throw new Error(
                'O método de pagamento é obrigatório'
            )
        }

        if (!sale.id_clients) {
            throw new Error(
                'O cliente é obrigatório'
            )
        }

        if (!sale.id_users) {
            throw new Error(
                'O usuário responsável pela venda é obrigatório'
            )
        }

        const existingSale =
            await saleRepository.selectId(sale.id)

        if (existingSale.length === 0) {
            throw new Error(
                'Venda não encontrada'
            )
        }

        return await saleRepository.update(sale)
    },


    delete: async (saleId) => {

        if (!saleId) {
            throw new Error(
                'ID da venda não informado'
            )
        }

        const existingSale =
            await saleRepository.selectId(saleId)

        if (existingSale.length === 0) {
            throw new Error(
                'Venda não encontrada'
            )
        }

        return await saleRepository.delete(saleId)
    }

}

export default saleService