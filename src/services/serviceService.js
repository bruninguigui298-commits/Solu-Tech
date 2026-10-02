import serviceRepository from "../repositories/serviceRepository.js";

const serviceService = {
    recoverServices: async () => {
        const result = await serviceRepository.listServices();
        return result;
    },
    recoverServicesbyID: async (ID) => {
        const result = await serviceRepository.servicesId(ID);
        return result;
    },
    createService: async (service) => {
        const result = await serviceRepository.createServices(
            service.name, service.description, service.value, service.duration
        );
        return result;
    },
    updateService: async (service) => {
        console.log('test: ', service.name, service.description, service.duration, service.value, service.id)
        const result = await serviceRepository.updateServices(
            service.name, service.description, service.duration, service.value, service.id
        );
        console.log(result)
        return result;
    },
    deleteService: async (ID) => {
        const result = await serviceRepository.delete(ID);
        return result;
    }
};

export default serviceService;