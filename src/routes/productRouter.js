import {Router} from "express";
import productController from "../controllers/productController.js";

const productRoutes = Router();

productRoutes.get("/product", productController.listProducts);
productRoutes.get("/product/:id", productController.productsId);
productRoutes.post("/product", productController.createProducts);
productRoutes.put("/product/:id", productController.updateProducts);
productRoutes.patch("/product/:id", productController.updateProduct);
productRoutes.delete("/product/:id", productController.deleteProducts);

export default productRoutes;
