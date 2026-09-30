import { Router } from "express";
import itemController from "../controllers/itemController.js";

const itemRoutes = Router()

itemRoutes.get("/", itemController.listItems);
itemRoutes.get("/:id", itemController.itemsId);
itemRoutes.post("/", itemController.createItems);
itemRoutes.put("/:id", itemController.updateItem);
itemRoutes.delete("/:id", itemController.deleteItem);

export default itemRoutes;