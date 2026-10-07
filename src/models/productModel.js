class Product{
    #id;
    #name;
    #description;
    #quantity;
    #value;
    #brand;

    constructor(id, name, description, quantity, value, brand){
        this.#id = id;
        this.#name = name;
        this.#description = description;
        this.#quantity = quantity;
        this.#value = value
        this.#brand = brand
    }

    get id(){
        return this.#id;
    }

    get name(){
        return this.#name
    }

    set name(value){
        return this.#name = value;
    }

    get description(){
        return this.#description;
    }

    set description(value){
        return this.#description = value;
    }

    get quantity(){
        return this.#quantity;
    }

    set quantity(value){
        return this.#quantity = value;
    }

    get brand(){
        return this.#brand;
    }

    set brand(value){
        return this.#brand = value;
    }

    get value(){
        return this.#value;
    }

    set value(value){
        return this.#value = value;
    }

}

export default Product;