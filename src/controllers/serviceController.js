import serviceModel from "../models/serviceModel.js";
import serviceService from "../services/serviceService.js";

const serviceController = {
    listServices: async (req, res) => {
        try {
            const result = await serviceService.recoverServices();
            return res.json({
                message: "Services retrieved successfully",
                data: result
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    servicesId: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await serviceService.recoverServicesbyID(id);
            return res.json({
                message: "Service retrieved successfully",
                data: result
            });
        }
         catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    createServices: async (req, res) => {
        try {
            const { name, description, value, duration } = req.body;
            const servico = await serviceService.createService({ name, description, value, duration });
            const result = await serviceService.recoverServicesbyID(servico);
            return res.status(201).json({
                message: "Service created successfully",
                data:result
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    updateServices: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, value, duration } = req.body;
            const result = await serviceService.updateService({ id, name, description, value, duration });
            return res.json({
                message: "Service updated successfully",
                data: result
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    deleteServices: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await serviceService.deleteService(id);
            return res.json({
                message: "Service deleted successfully",
                data: result
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};
export default serviceController;