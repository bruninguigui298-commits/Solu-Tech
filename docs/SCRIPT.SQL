DROP DATABASE IF EXISTS solutech;

CREATE DATABASE solutech;

USE solutech;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    cpf VARCHAR(14) NOT NULL UNIQUE
);

CREATE TABLE address (
    id INT AUTO_INCREMENT PRIMARY KEY,
    street VARCHAR(100) NOT NULL,
    number VARCHAR(10) NOT NULL,
    district VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    cep VARCHAR(10) NOT NULL,
    id_clients INT NOT NULL,
    FOREIGN KEY (id_clients) REFERENCES clients(id)
);

CREATE TABLE phones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    observation VARCHAR(255),
    number VARCHAR(15) NOT NULL,
    ddd VARCHAR(5) NOT NULL,
    id_clients INT NOT NULL,
    FOREIGN KEY (id_clients) REFERENCES clients(id)
);

CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    id_clients INT NOT NULL,
    FOREIGN KEY (id_clients) REFERENCES clients(id),
    id_users INT NOT NULL,
    FOREIGN KEY (id_users) REFERENCES users(id)
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    quantity INT NOT NULL,
    value DECIMAL(10, 2) NOT NULL
);

CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    duration INT NOT NULL,
    value DECIMAL(10, 2) NOT NULL
);

CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quantity INT NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    id_sales INT NOT NULL,
    FOREIGN KEY (id_sales) REFERENCES sales(id),
    id_products INT NULL,
    FOREIGN KEY (id_products) REFERENCES products(id),  
    id_services INT NULL,
    FOREIGN KEY (id_services) REFERENCES services(id)
);