class Sale {
    #id
    #date
    #total
    #payment_method
    #itens
    #id_clients
    #id_users

    constructor(
        total,
        payment_method,
        id_clients,
        id_users,
        itens,
        date = null,
        id = null
    ) {
        this.#id = id
        this.#date = date
        this.#total = total
        this.#payment_method = payment_method
        this.#id_clients = id_clients
        this.#id_users = id_users
        this.#itens = itens
    }

    get id() {
        return this.#id
    }

    get date() {
        return this.#date
    }

    set date(value) {
        this.#date = value
    }

    get total() {
        return this.#total
    }

    set total(value) {
        this.#total = value
    }

    get payment_method() {
        return this.#payment_method
    }

    set payment_method(value) {
        this.#payment_method = value
    }

    get id_clients() {
        return this.#id_clients
    }

    set id_clients(value) {
        this.#id_clients = value
    }

    get id_users() {
        return this.#id_users
    }

    set id_users(value) {
        this.#id_users = value
    }

    get itens() {
        return this.#itens
    }

    set itens(value) {
        this.#itens = value
    }
}

export default Sale