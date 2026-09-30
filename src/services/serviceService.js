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
        const result = await serviceRepository.updateServices(
            service.name, service.description, service.value, service.duration,
 service.id
        );
        return result;
    },
    deleteService: async (ID) => {
        const result = await serviceRepository.delete(ID);
        return result;
    }
};

export default serviceService;