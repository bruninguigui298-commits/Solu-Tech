import itemModel from '../models/itemModel.js';
import itemService from '../services/itemService.js';

const itemController = {
    listItems: async (req, res) => {
        try {
            const items = await itemService.recoverItems();
            return res.json({
                message: "Items retrieved successfully",
                data: items
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    itemsId: async (req, res) => {
        const { id } = req.params;
        try {
            const item = await itemService.recoverItemsbyID(id);
            if (!item) {
                return res.status(404).json({ message: "Item not found" });
            }
            return res.json({
                message: "Item retrieved successfully",
                data: item
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    createItems: async (req, res) => {
        const {quantity, value, subtotal, id_products, id_services } = req.body;
        try {
            const item = new itemModel(null, quantity, value, subtotal, id_products, id_services);
            const result = await itemService.createItem(item);
            return res.status(200).json({
                message: "item created successfully",
                data: result
            });
        } catch(error){
            return res.status(500).json({ error: error.message})
        }
    },
    updateItem: async (req, res) =>{

    }
}