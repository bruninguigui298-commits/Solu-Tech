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
        const result = await itemrepository.delete(id);
        return result;
    }
};

export default itemService;