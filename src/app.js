import express from 'express'
import saleRoutes from './routes/SaleRoutes.js'

const app = express()
const port = 3000

app.use(express.json())

app.use('/sales',saleRoutes)

app.listen(port, () => {
    console.log('SERVIDOR RODANDO NA PORTA 3000')
})

export default app