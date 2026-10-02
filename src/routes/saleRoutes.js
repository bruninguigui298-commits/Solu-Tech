import { Router } from 'express'
import saleController from '../controllers/saleController.js'
import authMiddleware from '../middlewares/authMiddleware.js'

const saleRoutes = Router()


saleRoutes.get('/',saleController.select)
saleRoutes.get('/:id',saleController.selectId)
saleRoutes.post('/', authMiddleware, saleController.create)
saleRoutes.put('/:id',saleController.update)
saleRoutes.delete('/:id',saleController.delete)


export default saleRoutes