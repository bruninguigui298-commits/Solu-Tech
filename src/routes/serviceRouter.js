import {Router} from "express";
import serviceController from "../controllers/serviceController.js";

const serviceRouter = Router();

serviceRouter.get("/services", serviceController.listServices);
serviceRouter.get("/services/:id", serviceController.servicesId);
serviceRouter.post("/services", serviceController.createServices);
serviceRouter.put("/services/:id", serviceController.updateServices);
serviceRouter.delete("/services/:id", serviceController.deleteServices);

export default serviceRouter;