import {Router} from "express";
import serviceController from "../controllers/serviceController.js";

const serviceRouter = Router();

serviceRouter.get("/", serviceController.listServices);
serviceRouter.get("/:id", serviceController.servicesId);
serviceRouter.post("/", serviceController.createServices);
serviceRouter.put("/:id", serviceController.updateServices);
serviceRouter.delete("/:id", serviceController.deleteServices);

export default serviceRouter;