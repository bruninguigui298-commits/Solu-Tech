import {Router} from 'express';
import userController from '../controllers/userController.js'
import authMiddleware from '../middlewares/authMiddleware.js';


const userRoutes = Router()

userRoutes.get("/", userController.select)
userRoutes.post("/", userController.create)
userRoutes.delete("/:id", authMiddleware,userController.delete)
userRoutes.patch("/:id", userController.update)


export default userRoutes;
