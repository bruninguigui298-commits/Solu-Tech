import "dotenv/config";
import express from 'express'
import itemRoutes from './routes/itemRoutes.js'
import productRoutes from "./routes/productRouter.js";

const app = express();
const port = 3000;

app.use(express.json());
app.use("/item", itemRoutes);
app.use("/product", productRoutes);

const PORT = process.env.SERVER_PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

