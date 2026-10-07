import express, { Router } from "express";
import jwt from "jsonwebtoken";
import productController from "../controllers/productController.js";

const productRoutes = Router();

// upload/remoção de arquivos exige o token do login
const requireAuth = (req, res, next) => {
    try {
        const token = (req.headers.authorization || "").split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: "TOKEN INVALIDO !!!!" });
    }
};
const raw = express.raw({ type: () => true, limit: "30mb" });

productRoutes.get("/", productController.listProducts);
productRoutes.get("/:id", productController.productsId);
productRoutes.post("/", productController.createProducts);
productRoutes.put("/:id", productController.updateProducts);
productRoutes.patch("/:id", productController.updateProduct);
productRoutes.delete("/:id", productController.deleteProducts);

productRoutes.post("/:id/model", requireAuth, raw, productController.uploadModel);
productRoutes.post("/:id/model/thumb", requireAuth, raw, productController.uploadThumb);
productRoutes.delete("/:id/model", requireAuth, productController.deleteModel);

export default productRoutes;
