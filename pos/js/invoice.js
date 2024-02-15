function creatNewClient(newClient) {
    Facturama.Clients.Create(newClient, function(result){ 
        client = result;
        console.log("creacion", result);    
    });
}