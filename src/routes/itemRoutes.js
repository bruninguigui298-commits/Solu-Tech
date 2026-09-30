import { Router } from "express";
import itemController from "../controllers/itemController.js";

const itemRoutes = Router()

itemRoutes.get("/", itemController.listItems);
itemRoutes.get("/item/:id", itemController.itemsId);
itemRoutes.post("/", itemController.createItems);
itemRoutes.put("/item/:id", itemController.updateItem);
itemRoutes.delete("/item/:id", itemController.deleteItem);

export default itemRoutes;