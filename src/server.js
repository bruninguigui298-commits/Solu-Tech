import express from 'express'
import itemRoutes from './routes/itemRoutes.js'

const app = express();
const port = 3000;

app.use(express.json());
app.use("/item", itemRoutes);

const PORT = process.env.SERVER_PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

