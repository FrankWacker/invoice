/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/auth', 'N/currency', 'N/email', 'N/error', 'N/file', 'N/format', 'N/record', 'N/runtime', 'N/search', 'N/ui', 'N/ui/dialog', 'N/ui/serverWidget'],
    /**
     * @param {auth} auth
     * @param {currency} currency
     * @param {email} email
     * @param {error} error
     * @param {file} file
     * @param {format} format
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {serverWidget} serverWidget
     */
    function(auth, currency, email, error, file, format, record, runtime, search, ui, dialog, serverWidget) {

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
        var line = scriptContext.line;
        var currentRecord = scriptContext.currentRecord;
        var sublistName = scriptContext.sublistId;
        if(sublistName != 'item') return true;
        var field = scriptContext.fieldId;
        if (field === 'item'){
            if (currentRecord.getCurrentSublistValue({
                sublistId: sublistName,
                fieldId: field
            }) === '417'){
                var custform = currentRecord.getValue('customform');
                if (custform == 109 || custform == 118|| custform == 120) {
                    debugger;
                    var l_startdate = currentRecord.getValue('startdate');
                    var l_enddate = currentRecord.getValue('enddate');
                    var l_site = currentRecord.getValue('custbody_ew_inv_site');
                    var rs_site = record.load('customrecord_ew_site_form', l_site);
                    var fixedRate = rs_site.getFieldValue('custrecord_ew_site_fxdrate');
                    var fixeddieselprice = rs_site.getFieldValue('custrecord_ew_site_fixeddieselp');
                    var equirate = rs_site.getFieldValue('custrecord_ew_site_equirate');
                    var discount = rs_site.getFieldValue('custrecord_ew_site_discountamnt');
                    var discounttype = rs_site.getFieldValue('custrecord_ew_site_discounttype');
                    var slab1From = rs_site.getFieldValue('custrecord_ew_site_slab1_from');
                    var slab1To = rs_site.getFieldValue('custrecord_ew_site_slab1_to');
                    slab1To = parseFloat(slab1To);
                    var slab1Rate = rs_site.getFieldValue('custrecord_ew_site_slab1_rate');
                    var slab2From = rs_site.getFieldValue('custrecord_ew_site_slab2_from');
                    var slab2To = rs_site.getFieldValue('custrecord_ew_site_slab2_to');
                    slab2To = parseFloat(slab2To);
                    var slab2Rate = rs_site.getFieldValue('custrecord_ew_site_slab2_rate');
                    var slab3From = rs_site.getFieldValue('custrecord_ew_site_slab3_from');
                    var slab3To = rs_site.getFieldValue('custrecord_ew_site_slab3_to');
                    var slab3Rate = rs_site.getFieldValue('custrecord_ew_site_slab3_rate');
                    var MinOT = rs_site.getFieldValue('custrecord_ew_site_minimum')
                } //  endif custform

            } // endif Item is 417 electricity provided
        } // endif field is item
        }


        return {
            fieldChanged: fieldChanged,
            sublistChanged: sublistChanged,
            validateLine: validateLine
        };

    });
