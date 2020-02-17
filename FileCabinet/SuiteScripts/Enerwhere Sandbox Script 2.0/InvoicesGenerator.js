/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', 'N/ui/dialog', 'N/ui/message', 'N/error', 'N/search', 'N/file'],
    /**
     * @param {record} record
     * @param {runtime} runtime
     * @param {dialog} dialog
     * @param {message} message
     */
    function(record, runtime, dialog, message, error, search, file) {

        function getFixedDieselPrice(fileName, startDate) {
            //##### Search for file #####
            var fileID;

            var fileSearch = search.create({
                type: "file"
            });
            var filters = [];

            filters.push(["name","haskeywords",fileName]);

            fileSearch.filterExpression = filters;

            fileSearch.run().each(function (result) {
                fileID = result.id;
                return true;
            });

            if(fileID == null || fileID == undefined){
                sendErrorMessage({code: "Missing Information", message: "No file found with name " + fileName});
            }


            //##### Get diesel price from file #####
            const fileObject = file.load({id: fileID});
            var fileContent = fileObject.getContents();
            var date = getMonthAndYear(startDate);
            fileContent = fileContent.split("\r\n");


            for(var i = 0; i < fileContent.length; i++)
            {
                fileContent[i] = fileContent[i].split(";");
                if(fileContent[i][0] == date){return parseFloat(fileContent[i][1])}
            }

            sendErrorMessage({code: "Missing Information", message: "No diesel price data found in file for " + date});
        }

        function beforeSubmit(scriptContext) {
            try {
                var invoiceRecord = scriptContext.newRecord;
                var creatorCheck = invoiceRecord.getValue("custbody_ew_inv_creator");
                if(creatorCheck == null || creatorCheck == undefined || creatorCheck == "")
                {
                    invoiceRecord.setValue("custbody_ew_inv_creator",runtime.getCurrentUser().email);
                }

                const custform = invoiceRecord.getValue("customform");

                if (custform != 109 && custform != 118 && custform != 120 && custform != 125) {
                    return true;
                }

                var calcMinOff = invoiceRecord.getValue("custbody_ew_minofftakeauto"); //Calculate Minimum Off Take //delete
                if (calcMinOff == false) {
                    return true;
                }

                const project = invoiceRecord.getValue("job");
                var linesCount = invoiceRecord.getLineCount("item");
                var consumption_sum = 0, consumption_sum2 = 0;
                var offtake = false;
                var linesCount_tmp = 0;
                var itemValue;
                var endDate, startDate;
                var otherCharges = 0;
                var total;

                startDate = invoiceRecord.getValue("startdate");
                endDate = invoiceRecord.getValue("enddate");

                //check if start date or end date are empty, if true, return error
                if (startDate == null || startDate == undefined || startDate == "" || endDate == null || endDate == undefined || endDate == "")
                    sendErrorMessage({code: "Invalid Data Input", message: "Start Date or/and End Date are missing."});

                //start date and end date must be in the same month, otherwise return error
                if (startDate.getMonth() !== endDate.getMonth())
                    sendErrorMessage({code: "Invalid Input", message: "Start and end date must be in the same month."});


                for (var i = 0; i < linesCount; i++) {
                    itemValue = invoiceRecord.getSublistValue('item', 'item', i);

                    if (itemValue != '417' && itemValue != '479')
                    {
                        otherCharges += parseFloat(invoiceRecord.getSublistValue('item', 'amount', i));
                        linesCount_tmp++;
                        continue; //change 2
                    }

                    consumption_sum = parseFloat(consumption_sum) + parseFloat(invoiceRecord.getSublistValue('item', 'quantity', i))
                }


                const siteID = invoiceRecord.getValue("custbody_ew_inv_site");
                const siteRecord = record.load({type: "customrecord_ew_site_form", id: siteID[0]});
                const fileName = siteRecord.getValue("name");
                var minOT, min_tmp; //Minimum Off Take
                var slab2from, slab3from;
                var slab1to, slab2to, slab3to;
                var slab1rate, slab2rate, slab3rate;
                var discount, discountType;
                var fixedDieselPrice, fixedRateCheck;
                var fuelByCustomer, fuelPreNeg;
                var equiRate, equiRate2, equiRate3;
                var numOfDays; //how many days between startDate and endDate
                var one_day = 1000 * 60 * 60 * 24; //One day in milliseconds
                var checkFullMonth = true; //check if startDate to endDate is a full month
                var rate, rate_tmp;
                var tax;
                var l_class;
                var diff; //difference between minimum and consumption
                var ttlprice_s1;
                var subtotal;
                var filterExpression;
                var dieselSearch = search.create({type: "customrecord_ew_official_diesel_price",
                    columns: [search.createColumn({name: "custrecord_ew_diesel_price", label: "Price"})
                    ]});
                filterExpression = [];
                filterExpression.push(["isinactive", "is", "F"]);
                filterExpression.push("AND");
                filterExpression.push(["name", "is", getMonthAndYear(startDate)]);
                dieselSearch.filterExpression = filterExpression;

                slab1to = parseFloat(siteRecord.getValue("custrecord_ew_site_slab1_to"));
                slab1rate = parseFloat(siteRecord.getValue("custrecord_ew_site_slab1_rate"));

                if (slab1rate == undefined || slab1rate == null || slab1rate == "" || slab1to == undefined || slab1to == null || slab1to == "")
                    sendErrorMessage({name: "Site Data Incomplete", message: "Please check Base Price Slab"});

                equiRate = parseFloat(siteRecord.getValue('custrecord_ew_site_equirate'));
                discount = parseFloat(siteRecord.getValue('custrecord_ew_site_discountamnt'));
                if(isNaN(discount)){discount = null;}
                else{discountType = siteRecord.getValue('custrecord_ew_site_discounttype');}
                minOT = parseFloat(siteRecord.getValue("custrecord_ew_site_minimum"));
                min_tmp = minOT;
                slab2from = parseFloat(siteRecord.getValue("custrecord_ew_site_slab2_from"));
                slab2to = parseFloat(siteRecord.getValue("custrecord_ew_site_slab2_to"));
                slab2rate = parseFloat(siteRecord.getValue("custrecord_ew_site_slab2_rate"));
                slab3from = parseFloat(siteRecord.getValue("custrecord_ew_site_slab3_from"));
                slab3to = parseFloat(siteRecord.getValue("custrecord_ew_site_slab3_to"));
                slab3rate = parseFloat(siteRecord.getValue("custrecord_ew_site_slab3_rate"));

                fixedRateCheck = siteRecord.getValue("custrecord_ew_site_fxdrate");
                fuelByCustomer = siteRecord.getValue("custrecord_ew_site_fuelcustomer");
                fuelPreNeg = siteRecord.getValue("custrecord_ew_site_fuel_negotated");
                if(fixedRateCheck == true || fuelPreNeg == true || fuelByCustomer == true)
                {fixedRateCheck = true;}


                if (fixedRateCheck == true) {
                    fixedDieselPrice = getFixedDieselPrice(fileName,startDate);
                    //TODO: Create fuel rate file system
                }

                if (minOT == null || minOT == undefined || minOT == "" || isNaN(minOT)) {
                    minOT = 1;
                    min_tmp = 1;
                }

                numOfDays = Math.floor(((endDate.getTime() - startDate.getTime()) / one_day)) + 1;

                var month_31_days = false;

                if(startDate.getMonth() == 0 || startDate.getMonth() == 2 || startDate.getMonth() == 4 ||
                    startDate.getMonth() == 6 || startDate.getMonth() == 7 ||  startDate.getMonth() == 9 ||
                    startDate.getMonth() == 11){month_31_days = true;}

                //February is 28 days, not leap year
                if (startDate.getMonth() === 1 && startDate.getFullYear() % 4 !== 0 && numOfDays !== 28) {
                    checkFullMonth = false;
                }
                //February is 29 days, leap year
                else if (startDate.getMonth() === 1 && startDate.getFullYear() % 4 === 0 && numOfDays !== 29) {
                    checkFullMonth = false;
                }
                //Months that are 31 days
                else if (startDate.getMonth() !== 1 && month_31_days && numOfDays !== 31) {
                    checkFullMonth = false;
                }
                //Months that are 30 days
                else if (startDate.getMonth() !== 1 && !month_31_days && numOfDays !== 30) {
                    checkFullMonth = false;
                }

                if (!checkFullMonth) {
                    minOT = minOT / 30;
                    minOT = minOT.toFixed(1);
                    minOT = parseFloat(minOT) * parseFloat(numOfDays);

                    slab1to = Math.floor((slab1to / 30) * parseFloat(numOfDays));
                    slab2to = Math.floor((slab2to / 30) * parseFloat(numOfDays));
                    slab1to = parseFloat(slab1to.toFixed(0));
                    slab2to = parseFloat(slab2to.toFixed(0)); // change 1
                } // endif checkFullMonth

                invoiceRecord.setValue("custbody_ew_slab1to_hidden", slab1to);

                rate = invoiceRecord.getSublistValue({sublistId: "item", fieldId: "rate", line: 0});
                tax = invoiceRecord.getSublistValue({sublistId: "item", fieldId: "taxcode", line: 0});
                l_class = invoiceRecord.getSublistValue({sublistId: "item", fieldId: "class", line: 0});

                if (consumption_sum < minOT) {
                    diff = minOT - consumption_sum;
                    //min = Math.round(min); change 3
                    diff = parseFloat(diff.toFixed(0));

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        line: linesCount,
                        value: "479"});

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_ew_item_filter",
                        line: linesCount,
                        value: "479"});

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        line: linesCount,
                        value: diff
                    });

                    invoiceRecord.setSublistValue({sublistId: "item",
                        fieldId: "units",
                        line: linesCount,
                        value: "1"});

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        line: linesCount,
                        value: rate});

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        line: linesCount,
                        value: tax
                    });
                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "class",
                        line: linesCount,
                        value: l_class
                    });
                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_ew_jrn_proj",
                        line: linesCount,
                        value: project
                    });

                    invoiceRecord.setSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        line: linesCount,
                        value: 'Minimum off-take'
                    });

                    linesCount++;

                    invoiceRecord.setValue("custbody_ew_minofftakeauto", false);
                    invoiceRecord.setValue("custbody_ew_ttl_consump", minOT);
                    invoiceRecord.setValue("custbody_ew_inv_consumslab1", minOT);
                    ttlprice_s1 = parseFloat(minOT) * parseFloat(rate);
                    ttlprice_s1 = ttlprice_s1.toFixed(2);
                    ttlprice_s1 = parseFloat(ttlprice_s1);
                    invoiceRecord.setValue("custbody_ew_inv_ttlprice_s1", ttlprice_s1);

                    offtake = true;
                    rate_tmp = rate;
                }

                if (consumption_sum > slab1to && consumption_sum < slab2to) {
                    equiRate2 = parseFloat(siteRecord.getValue("custrecord_ew_site_equieat1"));
                    equiRate3 = parseFloat(siteRecord.getValue("custrecord_ew_site_equirate2"));

                    if (fixedRateCheck == false) {


                        dieselSearch.run().each(function (result) {
                            fixedDieselPrice = parseFloat(result.getValue('custrecord_ew_diesel_price'));
                            return true;
                        });

                        fixedDieselPrice = (parseFloat(fixedDieselPrice) * 100) / 105; // Net Official Diesel price
                        fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));

                        if (discount != null && discount != undefined && discount != "") {
                            if (discountType == 2) {
                                fixedDieselPrice = fixedDieselPrice - discount;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            } else if (discountType == 3) {
                                fixedDieselPrice = parseFloat(fixedDieselPrice) * (100 - discount) / 100;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            }
                        }
                    } //enid fixedRateCheck = false
                    // Loop over all line items Electricity
                    for(var i = 0; i < linesCount; i++)
                    {
                        itemValue = invoiceRecord.getSublistValue('item', 'item', i);
                        if (itemValue != '417' && itemValue != '479') {
                            continue;
                        }

                        var tmp;

                        tmp = invoiceRecord.getSublistValue('item', 'quantity', i);
                        consumption_sum2 = parseFloat(consumption_sum2) + parseFloat(tmp);

                        if(consumption_sum2 > slab1to) {
                            tax = invoiceRecord.getSublistValue({sublistId: 'item', fieldId: 'taxcode', line: i});
                            var rate2 = equiRate2 + (parseFloat(fixedDieselPrice) * parseFloat(slab2rate));
                            rate2 = parseFloat(rate2.toFixed(3));
                            //invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'rate', line: i, value: rate2});

                            if(offtake == false)
                                invoiceRecord.setValue("custbody_ew_ttl_consump", consumption_sum2);

                            invoiceRecord.setValue("custbody_ew_minofftakeauto", false);
                        }
                    }

                    if(consumption_sum2 > slab1to) {
                        if(discount != null) {
                            if(discountType == 2)
                            {
                                fixedDieselPrice = fixedDieselPrice - discount;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            }else if(discountType == 3){
                                fixedDieselPrice = fixedDieselPrice - (100 - discount) / 100;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            }
                        }

                        rate_tmp = equiRate + (parseFloat(fixedDieselPrice) * parseFloat(slab1rate));
                        rate_tmp = parseFloat(rate_tmp.toFixed(3));

                        ttlprice_s1 = parseFloat(slab1to) * (rate_tmp);
                        ttlprice_s1 = ttlprice_s1.toFixed(2);
                        ttlprice_s1 = parseFloat(ttlprice_s1);

                        var consumslab2 = parseFloat(consumption_sum2) - parseFloat(slab1to);
                        var ttlprice_s2 = parseFloat(consumslab2) * parseFloat(rate2);
                        ttlprice_s1 = parseFloat(ttlprice_s1.toFixed(2));
                        ttlprice_s1 = ttlprice_s1.toFixed(2);
                        ttlprice_s1 = parseFloat(ttlprice_s1);
                        ttlprice_s2 = parseFloat(ttlprice_s2.toFixed(2));
                        ttlprice_s2 = ttlprice_s2.toFixed(2);
                        ttlprice_s2 = parseFloat(ttlprice_s2);

                        var subtotal = ttlprice_s1 + ttlprice_s2 + otherCharges;

                        if(offtake == false)
                        {
                            invoiceRecord.setValue("custbody_ew_inv_consumslab1", slab1to);
                            invoiceRecord.setValue("custbody_ew_inv_ttlprice_s1", ttlprice_s1);
                        }
                        invoiceRecord.setValue("custbody_ew_inv_consumslab2", consumslab2.toFixed(0));
                        invoiceRecord.setValue("custbody_ew_inv_ttlprice_s2", ttlprice_s2);
                        invoiceRecord.setValue("custbody_ew_invpr_rate1", rate_tmp);
                        invoiceRecord.setValue("custbody_ew_invpr_rate2", rate2);
                    } else // just set slab1 consumption
                    {
                        if(discount != null) {
                            if(discountType == 2)
                            {
                                fixedDieselPrice = fixedDieselPrice - discount;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            }else if(discountType == 3){
                                fixedDieselPrice = fixedDieselPrice - (100 - discount) / 100;
                                fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));
                            }
                        }

                        rate = equiRate + (parseFloat(fixedDieselPrice) * parseFloat(slab1rate));
                        rate = parseFloat(rate.toFixed(3));

                        if(offtake == false){
                            ttlprice_s1 = parseFloat(slab1to) * parseFloat(rate);

                        }else {
                            ttlprice_s1 = minOT * rate;

                        }

                        ttlprice_s1 = parseFloat(ttlprice_s1.toFixed(2));

                        if(offtake == false)
                        {
                            invoiceRecord.setValue("custbody_ew_inv_consumslab1", consumption_sum2);
                            invoiceRecord.setValue("custbody_ew_inv_ttlprice_s1", parseFloat(consumption_sum2) * parseFloat(rate));
                        }else{
                            invoiceRecord.setValue("custbody_ew_inv_ttlprice_s1", parseFloat(minOT) * parseFloat(rate));
                        }

                        invoiceRecord.setValue("custbody_ew_invpr_rate1", rate);

                        if (offtake == false){
                            subtotal = ttlprice_s1 + otherCharges;
                        } else {
                            var subtotal_tmp = invoiceRecord.getValue('subtotal');
                            if (subtotal_tmp < ttlprice_s1){
                                subtotal = ttlprice_s1 + otherCharges;
                            } else {
                                subtotal = subtotal_tmp + otherCharges;
                            }
                        }
                    }

                    // ttlprice_s1 = parseFloat(ttlprice_s1.toFixed(2));



                    var vat = parseFloat(subtotal) * 0.05;
                    vat = parseFloat(vat.toFixed(2));
                    var total = subtotal + vat;
                    invoiceRecord.setValue("custbody_ew_inv_subtotal_hidden", subtotal);
                    invoiceRecord.setValue("custbody_ew_inv_vat_hidden", vat);
                    invoiceRecord.setValue("custbody_ew_inv_total_hidden", total.toFixed(2));

                    // info Field

                    if(slab1to != 99999999){
                        var info = 'Electricity Tariff <= ' + slab1to
                            + ': Electricity Charge {' + equiRate
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab1rate
                            + '}) = Tariff per kWh AED ' + rate;
                    } else {
                        var info = 'Electricity Tariff'
                            + ': Electricity Charge {' + equiRate
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab1rate
                            + '}) = Tariff per kWh AED ' + rate;
                    }

                    if (slab2from != null && !isNaN(slab2from)) {
                        if(isNaN(equiRate2)){sendErrorMessage({name: "Wrong Input", message: "Equipment rate 2 is empty while slab2 from is not"});}
                        var rate2_tmp = equiRate2 + (parseFloat(fixedDieselPrice) * parseFloat(slab2rate));
                        rate2_tmp = parseFloat(rate2_tmp.toFixed(3));
                        info += String.fromCharCode(13)
                            + 'Electricity Tariff > ' + slab1to
                            + ': Electricity Charge {' + equiRate2
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab2rate
                            + '}) = Tariff per kWh AED ' + rate2_tmp;
                    }

                    if (slab3from != null && !isNaN(slab3from)) {
                        if(isNaN(equiRate3)){sendErrorMessage({name: "Wrong Input", message: "Equipment rate 3 is empty while slab3 from is not"});}
                        var rate3_tmp = equiRate3 + (parseFloat(fixedDieselPrice) * parseFloat(slab3rate));
                        rate3_tmp = parseFloat(rate3_tmp.toFixed(3));
                        info += String.fromCharCode(13)
                            + 'Electricity Tariff < ' + slab3to
                            + ': Electricity Charge {' + equiRate3
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab3rate
                            + '}) = Tariff per kWh AED ' + rate3_tmp;
                    }

                    if (min_tmp != null && min_tmp > 1) {
                        info += String.fromCharCode(13) + 'Minimum Off take: '
                            + min_tmp + ' kWh per month';
                    }

                    invoiceRecord.setValue("custbody_ew_inv_custinfo", info);

                    var lines_tmp = linesCount; //delete
                    linesCount = linesCount - linesCount_tmp;

                    if(linesCount != 1){
                        var subtotal_tmp = invoiceRecord.getValue("subtotal")
                    }

                    subtotal_tmp = parseFloat(subtotal_tmp);
                    if (linesCount == 1){
                        var rate3 =  subtotal_tmp;
                    } else {
                        rate3 = subtotal - subtotal_tmp;
                    }
                    rate3 = parseFloat(rate3.toFixed(2));

                    if (rate3 != 0 && !isNaN(rate3)) {
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'item', line: lines_tmp, value: '896'});
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_ew_item_filter', line: lines_tmp, value: '896'});
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'quantity', line: lines_tmp, value: '1'});
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'units', line: lines_tmp, value: '1'});

                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'rate', line: lines_tmp, value: rate3});
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'taxcode', line: lines_tmp, value: tax});
                        invoiceRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_ew_jrn_proj', line: lines_tmp, value: project});

                        linesCount++;
                    }
                }
                else {
                    var fixedRate = siteRecord.getValue('custrecord_ew_site_fxdrate');
                    var fuelByCustomer = siteRecord.getValue('custrecord_ew_site_fuelcustomer');
                    var fuePreNeg = siteRecord.getValue('custrecord_ew_site_fuel_negotated');
                    if(fixedRate == true || fuelByCustomer == true || fuePreNeg == true){fixedRate = true}
                    if (fixedRate == false) {

                        dieselSearch.run().each(function (result) {
                            fixedDieselPrice = parseFloat(result.getValue('custrecord_ew_diesel_price'));
                            return true;
                        });

                        fixedDieselPrice = (parseFloat(fixedDieselPrice) * 100) / 105; // Net Official Diesel price
                        fixedDieselPrice = parseFloat(fixedDieselPrice.toFixed(2));

                    } // end of fixedRate

                    if (discount != null) {
                        if (discountType == 2) {
                            fixedDieselPrice = fixedDieselPrice - discount;
                        } else if (discountType == 3) {
                            fixedDieselPrice = parseFloat(fixedDieselPrice)
                                * (100 - parseFloat(discount)) / 100;
                        }
                    }

                    rate = equiRate + (parseFloat(fixedDieselPrice) * parseFloat(slab1rate));
                    rate = parseFloat(rate.toFixed(3));
                    equiRate2 = parseFloat(siteRecord.getValue('custrecord_ew_site_equieat1'));
                    equiRate3 = parseFloat(siteRecord.getValue('custrecord_ew_site_equirate2'));

                    // info Field
                    slab1rate = parseFloat(slab1rate);

                    if (slab1to != 99999999) {
                        var info = 'Electricity Tariff <= ' + slab1to
                            + ': Electricity Charge {' + equiRate
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab1rate
                            + '}) = Tariff per kWh AED ' + rate;
                    } else {
                        var info = 'Electricity Tariff'
                            + ': Electricity Charge {' + equiRate
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab1rate
                            + '}) = Tariff per kWh AED ' + rate;
                    }

                    if (slab2from != null && !isNaN(slab2from)) {
                        if(isNaN(equiRate2)){sendErrorMessage({name: "Wrong Input", message: "Equipment rate 2 is empty while slab2 from is not"});}
                        var l_rate2 = equiRate2 + (parseFloat(fixedDieselPrice) * parseFloat(slab2rate));
                        l_rate2 = parseFloat(l_rate2.toFixed(3));
                        info += String.fromCharCode(13)
                            + 'Electricity Tariff > ' + slab1to
                            + ': Electricity Charge {' + equiRate2
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab2rate
                            + '}) = Tariff per kWh AED ' + l_rate2;
                    }
                    if (slab3from != null && !isNaN(slab3from)) {
                        if(isNaN(equiRate3)){sendErrorMessage({name: "Wrong Input", message: "Equipment rate 3 is empty while slab3 from is not"});}
                        var l_rate3 = equiRate3 + (parseFloat(fixedDieselPrice) * parseFloat(slab3rate));
                        l_rate3 = parseFloat(l_rate3.toFixed(3));
                        info += String.fromCharCode(13)
                            + 'Electricity Tariff < ' + slab3to
                            + ': Electricity Charge {' + equiRate3
                            + '} + (Diesel price {' + fixedDieselPrice
                            + '} x Fuel rate {' + slab3rate
                            + '}) = Tariff per kWh AED ' + l_rate3;
                    }

                    if (min_tmp != null && min_tmp > 1) {
                        info += String.fromCharCode(13) + 'Minimum Off take: '
                            + min_tmp + ' kWh per month';
                    }

                    invoiceRecord.setValue('custbody_ew_inv_custinfo', info);

                    if (offtake == false) {
                        subtotal = parseFloat(((consumption_sum * rate) + otherCharges).toFixed(2));
                    } else {
                        var t_subtotal = parseFloat(invoiceRecord.getValue('subtotal'));
                        if (t_subtotal < ttlprice_s1) {
                            var h = ttlprice_s1 - t_subtotal;
                            h = parseFloat(h.toFixed(2));
                            subtotal = parseFloat(t_subtotal) + parseFloat(h) + otherCharges;
                        } else {
                            subtotal = ttlprice_s1 + otherCharges;
                        }
                    }
                    var vat = parseFloat(subtotal) * 0.05;
                    vat = parseFloat(vat.toFixed(2));
                    total = parseFloat(subtotal) + parseFloat(vat);

                    
                    invoiceRecord.setValue('custbody_ew_inv_subtotal_hidden', subtotal);
                    invoiceRecord.setValue('custbody_ew_inv_vat_hidden', vat);
                    invoiceRecord.setValue('custbody_ew_inv_total_hidden', total.toFixed(2));
                    if (offtake == false) {
                        invoiceRecord.setValue('custbody_ew_inv_consumslab1', consumption_sum);
                        invoiceRecord.setValue('custbody_ew_inv_ttlprice_s1', parseFloat(consumption_sum) * parseFloat(rate));
                    }

                        invoiceRecord.setValue('custbody_ew_invpr_rate1', rate);
                        if (offtake == false) {
                            invoiceRecord.setValue('custbody_ew_ttl_consump', consumption_sum);
                        }
                        invoiceRecord.setValue('custbody_ew_invpr_rate1', rate);
                        invoiceRecord.setValue('custbody_ew_minofftakeauto', false);

                   // }
                }
            }
            catch(error){
                throw error.name + "\n\n" + error.message;
            }
        }

        function sendErrorMessage(params){
            const err = error.create({
                "name": params.name,
                "message": params.message,
                "notifyOff": true});

            throw err;
        }

        function getMonthAndYear(date) {
            switch(date.getMonth()){
                case 0:
                    return "January " + date.getFullYear();
                case 1:
                    return "February " + date.getFullYear();
                case 2:
                    return "March " + date.getFullYear();
                case 3:
                    return "April " + date.getFullYear();
                case 4:
                    return "May " + date.getFullYear();
                case 5:
                    return "June " + date.getFullYear();
                case 6:
                    return "July " + date.getFullYear();
                case 7:
                    return "August " + date.getFullYear();
                case 8:
                    return "September " + date.getFullYear();
                case 9:
                    return "October " + date.getFullYear();
                case 10:
                    return "November " + date.getFullYear();
                case 11:
                    return "December " + date.getFullYear();
            }
            return "";
        }


        return {
            beforeSubmit: beforeSubmit
        };

    });
