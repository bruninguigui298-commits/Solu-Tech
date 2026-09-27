class itemModel {
    #id;
    #quantity;
    #value;
    #subtotal;
    #id_products;
    #id_services;

    constructor(id, quantity, value, subtotal, id_products, id_services) {
        this.#id = id;
        this.#quantity = quantity;
        this.#value = value;
        this.#subtotal = subtotal;
        this.#id_products = id_products;
        this.#id_services = id_services;
    }
    get id() {
        return this.#id;
    }
    get quantity() {
        return this.#quantity;
    }
    set quantity(quantity) {
        this.#quantity = quantity;
    }
    get value() {
        return this.#value;
    }
    set value(value) {
        this.#value = value;
    }
    get subtotal() {
        return this.#subtotal;
    }
    set subtotal(subtotal) {
        this.#subtotal = subtotal;
    }
    get id_products() {
        return this.#id_products;
    }
    get id_services() {
        return this.#id_services;
    }
}

export default itemModel;