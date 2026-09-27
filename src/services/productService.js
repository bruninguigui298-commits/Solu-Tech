import productRepositorys from "../repositories/productRepository.js";

const productService = {
    recoverproducts: async () => {
        const result = await productRepositorys.listProducts();
        return result;
    },
    recoverproductsbyID: async (ID) => {
        const result = await productRepositorys.productsId(ID);
        return result;
    },
    createProduct: async (products) => {
        const result = await productRepositorys.createProducts(
            products.name, products.description, products.quantity, products.value
        );
        return result;
    },
    updateProduct: async (products) => {
        const result = await productRepositorys.updateProducts(
            products.name, products.description, products.quantity, products.value, products.id
        );
    },
    updateID: async (product) => {
        const result = await productRepositorys.update(product);
        return result;
    },
    deleteProducts: async (ID) => {
        const result = await productRepositorys.delete(ID);
        return result
    }
}

export default productService;