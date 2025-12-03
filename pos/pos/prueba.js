function addProduct(product) {

    $("#searchOptions").empty();
    $("#dynamic-list").css("opacity", "1");
    $("#dynamic-list-2").css("opacity", "1");
    $("#inputSearch").val("");

    var date = (new Date()).getTime();
    var color,
        backgroundColor;

    if(product.existencia == "siHay") {
        color = "#EEEEEE";
        backgroundColor = "#111111";
    }
    else if(product.existencia == "noHay") {
        color = "rgba(216, 61, 52, 95%)";
        backgroundColor = "#111111";
    }
    else if(product.existencia == "pedido") {
        color = "rgba(51, 204, 51, 80%)";
        backgroundColor = "#111111";
    }

    var totalCost = "";
    var dataTotal = "";
    if($("#quantityInput").val() != "") {
        totalCost = $("#quantityInput").val() * product.costo;
        totalCost = "$" + Math.round(totalCost * 10) / 10;
        dataTotal = round($("#quantityInput").val() * product.costo);
    }

    /*
    if(product.pesoN != undefined && product.pesoN != "") {
        totalCost = $("#quantityInput").val() * (product.costo / product.pesoN);
        totalCost = "$" + Math.round(totalCost * 10) / 10;
        dataTotal = round($("#quantityInput").val() * (product.costo / product.pesoN));
        product.unidad = "KILO";
    }
    */

    console.log("addProduct: agregado");
    console.log(product);

    var productListItem =
        '<li class="list-group-item row product-row product-total" style= "background-color: ' + backgroundColor + '; color: ' + color + '; border-color: #555555;" data-id="' + product.clave + '" data-date="' + date + '" data-total="' + dataTotal + '">' +
            '<div class="col-sm-1 product-quantity">' +
                '<input class="form-control" type="number" min="0" style= "color: ' + color + '; background-color: ' + backgroundColor + '; border-color: #555555; height: 30px; margin-top: 2.5px; padding-top: 1px; padding-bottom: 0px; line-height: 4px;"></input>' +
            '</div>' +
            '<div class="col-sm-1 product-info">' + product.unidad + '</div>' +
            '<div class="col-sm-6 product-info">' + product.descripcion + '</div>' +
            '<div id="localCost" class="col-sm-1 product-info">' + totalCost + '</div>' +
            '<div class="col-sm-2 product-notes-container">' +
                '<input class="form-control product-notes" type="input" style= "color: ' + color + '; background-color: ' + backgroundColor + '; height: 30px; margin-top: 2.5px; padding-top: 1px; padding-bottom: 0px; line-height: 4px;" oninput="this.value = this.value.toUpperCase()" maxlength="48" placeholder="NOTAS" value="AGREGADO"></input>' +
            '</div>' +
            '<button class="btn btn-default btn-sm col-sm-1 remove-button cross" type="button" style="background-color: ' + backgroundColor + '; border-color: ' + backgroundColor + ';">' +
                '<span class="glyphicon glyphicon-remove cross" style="color:grey; padding-top: 2.5px;"></span>' +
            '</button>' +
        '</li>';

    //add list element
    $('#dynamic-list').prepend(productListItem);
    updateTotal();

    deleteSuggestedProduct(product.clave);
    
    //populate quantity and clean original (outter) input
    var outterQuantity = $("#quantityInput").val();
    var inputQuantity = $('#dynamic-list').find('input').first();
    inputQuantity.val(outterQuantity);
    $("#quantityInput").val("");
    
    updateWT();

    productCounter++;
    updateNP(productCounter);

    //inputSearch sequence
    $('#dynamic-list').find('input').eq(1).focus();

    $('#dynamic-list').find('input').first().on('change', function (e) {
        let thisRow = $("#dynamic-list").find("[data-date='" + $(this).parent().parent().data("date") + "']");
        if(product.pesoN == undefined || product.pesoN == "") {
            thisRow.data("total", (round($(this).val() * product.costo)));
            thisRow.children().eq(3).text("$" + round($(this).val() * product.costo));
        } else {
            thisRow.data("total", (round($(this).val() * (product.costo / product.pesoN))));
            thisRow.children().eq(3).text("$" + round($(this).val() * (product.costo / product.pesoN)));
        }
        updateTotal();
        updateWT();
    })

    //inputQuantity enter sequence (to notes)
    $('#dynamic-list').find('input').first().on('keyup', function (e) {
        let thisRow = $("#dynamic-list").find("[data-date='" + $(this).parent().parent().data("date") + "']");
        if(product.pesoN == undefined || product.pesoN == "") {
            thisRow.data("total", (round($(this).val() * product.costo)));
            thisRow.children().eq(3).text("$" + round($(this).val() * product.costo));
        } else {
            thisRow.data("total", (round($(this).val() * (product.costo / product.pesoN))));
            thisRow.children().eq(3).text("$" + round($(this).val() * (product.costo / product.pesoN)));
        }
        updateTotal();
        updateWT();
        if (e.keyCode == 13)
            $(this).parent().nextAll().eq(3).children().focus();
    });

    //inputNotes enter sequence with shortcuts (to outter quantity)
    var inputNotes = $('#dynamic-list').find('input').eq(1);
    inputNotes.on('keyup', function (e) {
        if (e.keyCode == 13) {
            if (inputNotes.val() == "S")
                inputNotes.val("SURTIDO");
            else if (inputNotes.val() == "K")
                inputNotes.val("EN KILOS");
            else if (inputNotes.val() == "M")
                inputNotes.val("EN MEDIOS");
            else if (inputNotes.val() == "C")
                inputNotes.val("EN CUARTOS");
            else if (inputNotes.val() == "2")
                inputNotes.val("2-2");
            else if (inputNotes.val() == "3")
                inputNotes.val("3-3");
            else if (inputNotes.val() == "4")
                inputNotes.val("4-4");
            else if (inputNotes.val() == "5")
                inputNotes.val("5-5");
            else if (inputNotes.val() == "J")
                inputNotes.val("JUNTA");
            $("#quantityInput").focus();
        }
    });

    //upload or update order item
    uploadOrderProduct(date, outterQuantity, product.unidad, product.descripcion, "", product.costo, product.existencia, product.tipo, product.clave);
    inputQuantity.focusout(function () {updateOrderProductQuantity(date, inputQuantity.val())});
    inputNotes.focusout(function () {updateOrderProductNotes(date, inputNotes.val())});

    $('#dynamic-list').children().first().on("mouseup", "button", function (e) {
        e.preventDefault();
        
        removeOrderProduct($(this).parent().data("date"));
        $(this).parent().remove();
        
        updateTotal();
        updateWT();
        productCounter--;
        updateNP(productCounter);
    });
}