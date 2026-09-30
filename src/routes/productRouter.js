import {Router} from "express";
import productController from "../controllers/productController.js";

const productRoutes = Router();

productRoutes.get("/", productController.listProducts);
productRoutes.get("/:id", productController.productsId);
productRoutes.post("/", productController.createProducts);
productRoutes.put("/:id", productController.updateProducts);
productRoutes.patch("/:id", productController.updateProduct);
productRoutes.delete("/:id", productController.deleteProducts);

export default productRoutes;
