/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currency', 'N/email', 'N/error', 'N/format', 'N/record', 'N/runtime', 'N/search', 'N/ui', 'N/ui/dialog', 'N/query'],
    /**
     * @param {currency} currency
     * @param {email} email
     * @param {error} error
     * @param {format} format
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param (query) query
     */
    function(currency, email, error, format, record, runtime, search, ui, dialog, query) {

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {
            // var line = scriptContext.line;
            var currentRecord = scriptContext.currentRecord;
            var sublistName = scriptContext.sublistId;
            if(sublistName != 'item') return true;
            var field = scriptContext.fieldId;
            //  if (field === 'item'){
            if (currentRecord.getCurrentSublistValue({
                sublistId: sublistName,
                fieldId: 'item'
            }) === '417'){
                var custform = currentRecord.getValue('customform');
                if (custform == 109 || custform == 118|| custform == 120) {
                    var l_startdate = currentRecord.getValue('startdate');
                    var l_enddate = currentRecord.getValue('enddate');
                    var l_site = currentRecord.getValue('custbody_ew_inv_site');

                    //    var rs_site = record.load('customrecord_ew_site_form', l_site[0]);
                    var rs_site = record.load({
                        type: 'customrecord_ew_site_form',
                        id: l_site[0]
                    });
                    var fileName = rs_site.id;
                    var fixedRate = rs_site.getValue('custrecord_ew_site_fxdrate');
                    var fixeddieselprice = rs_site.getValue('custrecord_ew_site_fixeddieselp');
                    var equirate = rs_site.getValue('custrecord_ew_site_equirate');
                    var discount = rs_site.getValue('custrecord_ew_site_discountamnt');
                    var discounttype = rs_site.getValue('custrecord_ew_site_discounttype');
                    var slab1From = rs_site.getValue('custrecord_ew_site_slab1_from');
                    var slab1To = rs_site.getValue('custrecord_ew_site_slab1_to');
                    slab1To = parseFloat(slab1To);
                    var slab1Rate = rs_site.getValue('custrecord_ew_site_slab1_rate');
                    var slab2From = rs_site.getValue('custrecord_ew_site_slab2_from');
                    var slab2To = rs_site.getValue('custrecord_ew_site_slab2_to');
                    slab2To = parseFloat(slab2To);
                    var slab2Rate = rs_site.getValue('custrecord_ew_site_slab2_rate');
                    var slab3From = rs_site.getValue('custrecord_ew_site_slab3_from');
                    var slab3To = rs_site.getValue('custrecord_ew_site_slab3_to');
                    var slab3Rate = rs_site.getValue('custrecord_ew_site_slab3_rate');
                    var MinOT = rs_site.getValue('custrecord_ew_site_minimum')
                    var ttl_consumption = currentRecord.getCurrentSublistValue('item', 'custcol_ew_curr_rdg_item') - currentRecord.getCurrentSublistValue('item', 'custcol_ew_prv_rdg_item');
                    var l_rate = 0.1

                    var fr1 = rs_site.getValue('custrecord_ew_site_fuelcustomer');
                    var fr2 = rs_site.getValue('custrecord_ew_site_fuel_negotated');
                    debugger;
                    if(fr1 == true || fr2 == true){
                        fixedRate = true
                    }

                    if(fixedRate == false){
                        debugger;
                        var searchdiesel = findDieselPrice(l_startdate, l_enddate);

                        var fixeddieselprice = searchdiesel[0];

                        fixeddieselprice = (fixeddieselprice * 100)/105; // Net Official Diesel price
                        fixeddieselprice = fixeddieselprice.toFixed(2);
                        fixeddieselprice = parseFloat(fixeddieselprice);
                        if (discount != null || discount != 0 ){
                            if(discounttype == 2){
                                fixeddieselprice = fixeddieselprice - discount;
                                fixeddieselprice = fixeddieselprice.toFixed(2);
                                fixeddieselprice = parseFloat(fixeddieselprice);
                            }else if (discounttype == 3) {
                                fixeddieselprice = fixeddieselprice * (100 - discount) / 100;
                            } else {
                                //throw nlapiCreateError('No discount type', 'Please fill data in site', true);
                            }
                        }
                    } // endif fixedRate is false
                    else {
                        fixeddieselprice = getFixedDieselPrice(fileName,l_startdate);
                        fixeddieselprice = parseFloat(fixeddieselprice);

                    } //fixedRate = true
                    equirate = parseFloat(equirate);
                    //fixeddieselprice = fixeddieselprice.toFixed(2);
                    fixeddieselprice = parseFloat(fixeddieselprice);
                    slab1Rate = parseFloat(slab1Rate);
                    slab2Rate = parseFloat(slab2Rate);
                    slab3Rate = parseFloat(slab3Rate);
                    //	debugger;
                    if(ttl_consumption < slab1To){
                        l_rate = equirate +(fixeddieselprice * slab1Rate);
                        l_rate = l_rate.toFixed(3); // toFixed returns a string so parseFloat again
                        l_rate = parseFloat(l_rate);
                    }else if (ttl_consumption > slab1To && ttl_consumption < slab2To) {
                        l_rate = equirate +(fixeddieselprice * slab2Rate);
                        l_rate = l_rate.toFixed(3); // toFixed returns a string so parseFloat again
                        l_rate = parseFloat(l_rate);
                    } else if (ttl_consumption > slab2To && ttl_consumption < slab3To) {
                        l_rate = equirate +(fixeddieselprice * slab3Rate);
                        l_rate = l_rate.toFixed(3); // toFixed returns a string so parseFloat again
                        l_rate = parseFloat(l_rate);
                    }   // endif consumption
                    debugger;
                    currentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: l_rate,
                        ignoreFieldChange: true
                    });
                    currentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: ttl_consumption,
                        ignoreFieldChange: true
                    });

                    var taxcode = currentRecord.getCurrentSublistValue('item', 'taxcode');// AE-S 5% VAT
                    currentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: taxcode,
                        ignoreFieldChange: true
                    });

                } //  endif custform

            } // endif Item is 417 electricity provided
            //  } // endif field is item
            return true;
        }
        function findDieselPrice(l_startdate, l_enddate) {
            debugger;
            var h_from = format.format({
                value: l_startdate,
                type: format.Type.DATE
            });
            var h_to = format.format({
                value: l_enddate,
                type: format.Type.DATE
            });
            var myQuery = query.create({
                type: 'customrecord_ew_official_diesel_price'
            });
            var firstCondition = myQuery.createCondition({
                fieldId: 'custrecord_ew_diesel_from',
                operator: query.Operator.ON_OR_BEFORE,
                values: h_from
            });
            var secondCondition = myQuery.createCondition({
                fieldId: 'custrecord_ew_diesel_to',
                operator: query.Operator.ON_OR_AFTER,
                values: h_to
            });
            myQuery.condition = myQuery.and(firstCondition,secondCondition);

            myQuery.columns =[
                myQuery.createColumn(({
                    fieldId: 'custrecord_ew_diesel_price'
                }))
            ];
            var resultSet = myQuery.run();
            var rs = resultSet.results;

            return rs[0].values;

        } //eof findDieselPrice

        function getFixedDieselPrice(fileName, startDate) {
            debugger;
            //##### Search for file #####
            var date = getMonthAndYear(startDate);

            var myQuery = query.create({
                type: 'customrecord_ew_fixeddiesel'
            });

            var firstCondition = myQuery.createCondition({
                fieldId: 'custrecord_ew_fixeddiesel_month',
                operator: query.Operator.IS,
                values: date
            });
            var secondCondition = myQuery.createCondition({
                fieldId: 'custrecord_ew_fixeddiesel_site',
                operator: query.Operator.ANY_OF,
                values: fileName
            });
            myQuery.condition = myQuery.and(firstCondition,secondCondition);

            myQuery.columns =[
                myQuery.createColumn(({
                    fieldId: 'custrecord_ew_fixeddiesel_rate'
                }))
            ];
            var resultSet = myQuery.run();
            var rs = resultSet.results;
            return rs[0].values[0];
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
            fieldChanged: fieldChanged,
            sublistChanged: sublistChanged,
            validateLine: validateLine
        };

    });
