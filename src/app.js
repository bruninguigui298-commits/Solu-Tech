import 'dotenv/config'
import express from 'express'
import clienteRoutes from './routes/clienteRoutes.js';

const app = express();

const port = process.env.SERVER_PORT

app.use(express.json())
app.use("/clients", clienteRoutes)

app.listen(port, () => {
    console.log('SERVIDOR RODANDO NA PORTA 3000')
})
