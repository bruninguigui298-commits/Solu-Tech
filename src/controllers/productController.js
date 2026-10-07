import productModel from "../models/productModel.js";
import productService from "../services/productService.js";
import productRepository from "../repositories/productRepository.js";
import fs from "fs/promises";
import path from "path";
import { MODELS_DIR, thumbName, removeModelFiles } from "../configs/models.js";

const productControllers = {
    listProducts: async (req, res) => {
        try {
            const result = await productService.recoverproducts();
            return res.status(200).json({
                message: "Product list by suproducts listed successfully",
                data: result
            });
        }

        catch (error) {
            return res.status(500).json({
                message: "Error listing products",
                data: error.message
            });
        }

    },
    productsId: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await productService.recoverproductsbyID(id);
            return res.status(200).json({
                message: "Product listed successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(500).json({
                message: "Error listing product",
                data: error.message
            });
        }
    },
    createProducts: async (req, res) => {
        try {
            const { name, description, quantity, value, brand } = req.body;
            const product = new productModel(null, name, description, quantity, value, brand);
            const result = await productService.createProduct(product);
            return res.status(201).json({
                message: "Product created successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(500).json({
                message: "Error creating product",
                data: error.message
            });
        }
    },
    updateProducts: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, quantity, value, brand } = req.body;
            const product = new productModel(id, name, description, quantity, value, brand);
            const result = await productService.updateProduct(product);
            return res.status(200).json({
                message: "Product updated successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(500).json({
                message: "Error updating product",
                data: error.message
            });
        }
    },
    updateProduct: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, quantity, value, brand } = req.body;
            const product = new productModel(id, name, description, quantity, value, brand);
            const result = await productService.updateID(product);
            return res.status(200).json({
                message: "Product updated successfully",
                data: result
            });
        }

        catch (error) {
            return res.status(500).json({
                message: "Error updating product",
                data: error.message
            });
        }
    },

    // POST /product/:id/model  (corpo = arquivo .glb bruto)
    uploadModel: async (req, res) => {
        try {
            const id = Number(req.params.id);
            const buf = req.body;
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ message: "ID inválido" });
            }
            // cabeçalho GLB: magic "glTF", versão 2, tamanho coerente
            if (!Buffer.isBuffer(buf) || buf.length < 20 ||
                buf.readUInt32LE(0) !== 0x46546C67 || buf.readUInt32LE(4) !== 2 ||
                buf.readUInt32LE(8) > buf.length) {
                return res.status(400).json({ message: "Formato inválido: envie um modelo 3D no formato .glb" });
            }
            const old = await productRepository.getModel(id);
            if (old === undefined) {
                return res.status(404).json({ message: "Produto não encontrado" });
            }
            await fs.mkdir(MODELS_DIR, { recursive: true });
            const file = `product-${id}-${Date.now()}.glb`;
            await fs.writeFile(path.join(MODELS_DIR, file), buf);
            await productRepository.setModel(id, file);
            await removeModelFiles(old);
            return res.status(200).json({ message: "Modelo 3D salvo", data: { model_3d: file } });
        }
        catch (error) {
            return res.status(500).json({ message: "Erro ao salvar modelo 3D", data: error.message });
        }
    },

    // POST /product/:id/model/thumb  (corpo = PNG da miniatura)
    uploadThumb: async (req, res) => {
        try {
            const id = Number(req.params.id);
            const buf = req.body;
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ message: "ID inválido" });
            }
            if (!Buffer.isBuffer(buf) || buf.length < 16 || buf.length > 2 * 1024 * 1024 ||
                buf.readUInt32BE(0) !== 0x89504E47) {
                return res.status(400).json({ message: "Miniatura inválida (PNG de até 2 MB)" });
            }
            const glb = await productRepository.getModel(id);
            if (!glb) {
                return res.status(409).json({ message: "Envie o modelo 3D antes da miniatura" });
            }
            await fs.writeFile(path.join(MODELS_DIR, thumbName(glb)), buf);
            return res.status(200).json({ message: "Miniatura salva" });
        }
        catch (error) {
            return res.status(500).json({ message: "Erro ao salvar miniatura", data: error.message });
        }
    },

    // DELETE /product/:id/model
    deleteModel: async (req, res) => {
        try {
            const id = Number(req.params.id);
            const old = await productRepository.getModel(id);
            if (old === undefined) {
                return res.status(404).json({ message: "Produto não encontrado" });
            }
            await productRepository.setModel(id, null);
            await removeModelFiles(old);
            return res.status(200).json({ message: "Modelo 3D removido" });
        }
        catch (error) {
            return res.status(500).json({ message: "Erro ao remover modelo 3D", data: error.message });
        }
    },

    deleteProducts: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await productService.deleteProducts(id);
            return res.status(200).json({
                message: "Product deleted successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(500).json({
                message: "Error deleting product",
                data: error.message
            });
        }
    }
}

export default productControllers;
