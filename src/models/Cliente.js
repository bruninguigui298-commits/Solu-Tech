 class Cliente {
    #id
    #name
    #email
    #cpf
    #phone
    #addresses
   
    constructor(name, email, cpf, phone, addresses, id = null){
        this.#name = name
        this.#email = email
        this.#cpf = cpf
        this.#phone = phone;
        this.#addresses = addresses;
        this.#id = id
    }

    get id (){
        return this.#id;
    }

    get name(){
        return this.#name;
    }
    set name(value){    
        this.#name = value;
    }
    get email(){
        return this.#email;
    }
    set email(value){    
        this.#email = value;
    }
    get cpf(){
        return this.#cpf;
    }
    set cpf(value){    
        this.#cpf = value;
    }
    get phone(){
        return this.#phone;
    }
    set phone(value){    
        this.#phone = value;
    }
    get addresses(){
        return this.#addresses;
    }
    set addresses(value){    
        this.#addresses = value;
    }
    
}

export default Cliente