import { Router } from 'express'
import saleController from '../controllers/saleController.js'

const saleRoutes = Router()


saleRoutes.get('/',saleController.select)
saleRoutes.get('/:id',saleController.selectId)
saleRoutes.post('/',saleController.create)
saleRoutes.put('/:id',saleController.update)
saleRoutes.delete('/:id',saleController.delete)


export default saleRoutes