import itemModel from '../models/ItemModel.js'
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
        try {
            const { id } = req.params;
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
        try {
            const {
                quantity,
                value,
                subtotal,
                id_sales,
                id_products,
                id_services
            } = req.body;

            const item = new itemModel(null, quantity, value, subtotal, id_sales, id_products, id_services);

            const result = await itemService.createItem(item);
            return res.status(200).json({
                message: "item created successfully",
                data: result
            });
        } catch (error) {
            return res.status(500).json({ error: error.message })
        }
    },
    updateItem: async (req, res) => {
        try {
            const itemID = Number(req.params.id);
            const { quantity, value, subtotal, id_products, id_services } = req.body;
            const item = new itemModel(itemID, quantity, value, subtotal, id_products, id_services);
            const result = await itemService.updateItem(item);
            return res.status(200).json({
                message: "item update successflly",
                data: result
            })
        }
        catch (error) {
            return res.status(500).json({ error: error.message })
        }
    },
    deleteItem: async (req, res) => {
        try {
            const id = Number(req.params.id)
            const result = await itemService.deleteItem(id);
            return res.status(200).json({
                message: "Item deleted successfully.",
                data: result
            })
        }
        catch (error) {
            return res.status(500).json({ error: error.message })
        }
    }
}

export default itemController;