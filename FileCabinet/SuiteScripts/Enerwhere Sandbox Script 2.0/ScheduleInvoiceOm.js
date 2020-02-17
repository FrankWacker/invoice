/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/email', 'N/error', 'N/record', 'N/runtime', 'N/search', 'N/format', 'N/log'],
/**
 * @param {email} email
 * @param {error} error
 * @param {record} record
 * @param {runtime} runtime
 * @param {search} search
 */
function(email, error, record, runtime, search, format, log) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
    	/*
    	 * The Schedule Invoice O&M Script is running on every day
    	 * 
    	 *  Author: Frank Wacker
    	 *  Date: 16/1/2019
    	 *  Version 1.0
    	 */
    	// global variables
    	var site_id,site_name,customer;    	
    	// load saved search offGrid Site Search
    	var search_sites = search.load({
    		id: 'customsearch_ew_search_omsite'
    	});
    	search_sites.run().each(function(result){
    		// load site record
    		loadsite(result.id);
    		pause(5); //wait 5 seconds
//    		customer = result.getValue({
//    			name: 'custrecord_customername'
//    		});
//    		reloadInvoice(customer);
    		return true;
    	}); // end loop each site
    	
    	function loadsite(siteId){
    		var rs_site = record.load({
    			type: 'customrecord_ew_site_form',
    			id: siteId
    		});
//    		rs_site.setValue({
//    			fieldId: 'custrecord_ew_site_lastinvdate',
//    			value: true
//    		});
    		
    		rs_site.save();
    		
    	} // eof loadsite
    	
    	function reloadInvoice(customer){
			var dateOffset = (12*60*60*1000); //1 days UTC + 4
			var now = new Date();
    		now.setDate(now.getDate());
			now.setTime(now.getTime() - dateOffset);
    		now = format.format({value:now,type:format.Type.DATE});
    		var myInvoice = search.create({
    			type: search.Type.INVOICE,
    		
    			columns: [{
    			name: 'tranid'
    			}, {
    			name: 'entity'
    			}],
    			filters: [{
    			name: 'entity',
    			operator: 'is',
    			values: customer
    			}, {
    			name: 'asofdate',
    			operator: 'on',
    			values: now
    			}]
    			});
    		myInvoice.run().each(function(result){
//    			var tranid = result.getValue({name: 'tranid'});
//    			tranid = parseFloat(tranid);
    			var rs_invoice = record.load({
    				type:record.Type.INVOICE,
    				id: result.id
    			});
    			rs_invoice.save();
    			return true;
    		});
    		
    	}// eof reloadInvoice
    	
    	function pause(waitTime){ //seconds
    	// https://stackoverflow.com/questions/32570339/netsuite-scheduled-script-sleep
    	    try{
    	        var endTime = new Date().getTime() + waitTime * 1000;
    	        var now = null;
    	        do{
    	            //throw in an API call to eat time
    	            now = new Date().getTime(); //
    	        }while(now < endTime);
    	    }catch (e){
    	        log.debug({title: 'ERROR', details: 'not enough sleep'});
    	    }
    	} // eof pause
    } // end execute

    return {
        execute: execute
    };
    
});
