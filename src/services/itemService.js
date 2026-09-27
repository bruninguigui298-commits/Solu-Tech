import itemrepository from '../repositories/itemRepository.js';

const itemService = {
    recoverItems: async () => {
        const result = await itemrepository.select();
        return result;
    },
    recoverItemsbyID: async (id) => {
        if (!id) {
            throw new Error("ID is required");
        }
        const result = await itemrepository.selectbyId(id); 
        return result;
    },
    createItem: async (item) => {
        if (!item.id_products || !item.id_services) {
            throw new Error("Both id_products and id_services are required");
        }
        const result = await itemrepository.create(item);
        return result;
    },
    updateItem: async (item) => {
        if (!item.id) {
            throw new Error("ID is required");
        }
        const result = await itemrepository.update(item);
        return result;
    },
    deleteItem: async (id) => {
        if (!id) {
            throw new Error("ID is required");
        }
        const result = await itemrepository.delete(id);
        return result;
    }
};

export default itemService;