import pool from '../configs/database.js'

const productRepository = {

    listProducts: async() => {
        const sql = "SELECT * FROM products;";
        const [rows] = await pool.execute(sql);
        return rows;
    },

    productsId: async(ID) =>{
        const sql = "SELECT * FROM products WHERE id;";
        const [rows] = await pool.execute(sql, [ID]);
        return rows;
    },

    createProducts: async (name, description, quantity, value, brand) =>{
        const sql = "INSERT INTO products (name, description, brand, quantity, value) VALUES (?, ?, ?, ?, ?);";
        const [rows] = await pool.execute(sql, [name, description, brand || null, quantity, value]);
        return rows;
    },

    updateProducts: async (name, description, quantity, value, ID, brand) =>{
        const sets = ["name = ?", "description = ?", "quantity = ?", "value = ?"];
        const vals = [name, description, quantity, value];
        if (brand !== undefined) { sets.push("brand = ?"); vals.push(brand || null); }
        vals.push(ID);
        const [rows] = await pool.execute(`UPDATE products SET ${sets.join(", ")} WHERE id = ?;`, vals);
        return rows;
    },

    update: async(dados) =>{
        const campo = [];
        const valores = [];

        if (dados.name !== undefined){
            campo.push("name = ?");
            valores.push(dados.name);
        }
        if(dados.description !== undefined){
            campo.push("description = ?");
            valores.push(dados.description);
        }
        if(dados.quantity !== undefined){
            campo.push("quantity = ?");
            valores.push(dados.quantity);
        }
        if(dados.value !== undefined){
            campo.push("value = ?");
            valores.push(dados.value);
        }
        if(dados.brand !== undefined){
            campo.push("brand = ?");
            valores.push(dados.brand || null);
        }

        valores.push(dados.id)

        const sql = `UPDATE products SET ${campo.join(",")} WHERE id = ?; `;
        const [rows] = await pool.execute(sql, valores);
        return rows;
    },

    // nome do arquivo 3D do produto: undefined = produto não existe, null = sem modelo
    getModel: async(ID) =>{
        const [rows] = await pool.execute("SELECT model_3d FROM products WHERE id = ?;", [ID]);
        return rows.length ? rows[0].model_3d : undefined;
    },

    setModel: async(ID, file) =>{
        const [rows] = await pool.execute("UPDATE products SET model_3d = ? WHERE id = ?;", [file, ID]);
        return rows;
    },

    delete: async(ID) =>{
        const sql = "DELETE FROM products WHERE id = ?;";
        const [rows] =  await pool.execute(sql, [ID]);
        return rows;
    }
}

export default productRepository;