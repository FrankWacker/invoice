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

		var errors = [], recordErrors = [];
		function execute(scriptContext) {
			/*
             * The Schedule Invoice Script is running on every 1st of a month
             * It creates the Invoice from the Script createInvoice20.js and afterwards
             * loads the invoice from the record id so that the automatic calculation can start
             *
             *  Author: Frank Wacker
             *  Date: 25/12/2018
             *  Version 1.0
             */

			/*
				UPDATED
             * The Schedule Invoice Script runs every day.
             * the script checks if start date from the record is less than today's date and
           	 * what is the billing period. If the billing period is 1st and 15th. It checks if today
           	 * is the 1st or 15th. If true, it generates an invoice.

             *  Author: Shaheen Al-Qaraghuli
             *  Date: 07/07/2019
             *  Version 1.1
             */

			var customer;
			// load saved search offGrid Site Search
			var search_sites = search.load({
				id: 'customsearch_ew_search_offgridsite'
			});

			search_sites.run().each(function(result){
				// load site record
				if(loadsite(result.id)){
					pause(5); //wait 5 seconds
					customer = result.getValue({
						name: 'custrecord_customername'
					});
					reloadInvoice(customer);
				}
				return true;
			}); // end loop each site

			//send email if there are any errors
			if(errors.length > 0 || recordErrors.length > 0) {
				sendEmail();
			}
		} // end execute

		function loadsite(siteId){
			var rs_site = record.load({
				type: 'customrecord_ew_site_form',
				id: siteId
			});

			const billingPeriod = rs_site.getValue({fieldId: "custrecord_ew_site_ombillperiod"});
			const flag = checkStartDate(rs_site.getValue({fieldId: "custrecord_ew_site_ominvstartdate"}), siteId);
			var today = new Date(); // GMT - 7 (PDT)
			var dateOffset = 12 * 60 * 60 * 1000;
			today.setTime(today.getTime() + dateOffset);
			const day = today.getDate();

			if(flag){
				if(billingPeriod === "1" && day === 1){ //monthly

					rs_site.setValue({
						fieldId: 'custrecord_ew_site_flag_createinvoice',
						value: true
					});
					try {
						rs_site.save();
					}
					catch(err) {
						errors.push(err.message);
						return false;
					}

					return true;
				}
				else if(billingPeriod === "1" && day !== 1){ //monthly but not beginning of month
					return true;
					//do nothing
				}
				else if(billingPeriod === "4" && (day === 1 || day === 16)){ //1st and 15th
					rs_site.setValue({
						fieldId: 'custrecord_ew_site_flag_createinvoice',
						value: true
					});
					try {
						rs_site.save();
					}
					catch(err) {
						errors.push(err.message);
						return false;
					}

					return true;
				}
				else if(billingPeriod === "2" || billingPeriod === "3"){ //yearly and quarterly
					period = billingPeriod === "2" ? "Yearly" : "Monthly";
					recordErrors.push({siteID: siteId, billing: period});
				}
				else
				{
					recordErrors.push({siteID: siteId, billing: "Billing Period Empty"});
					return  false;
				}

				return true;
			}

		} // eof loadsite

		function reloadInvoice(customer){

			var now = new Date();
			now.setDate(now.getDate());
			var dateOffset = (12*60*60*1000); //1 days UTC + 4
			now.setTime(now.getTime() + dateOffset);
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

				var rs_invoice = record.load({
					type:record.Type.INVOICE,
					id: result.id
				});
				rs_invoice.save();
				return true;
			});

		}// eof reloadInvoice

		function pause(waitTime){ //seconds //https://stackoverflow.com/questions/32570339/netsuite-scheduled-script-sleep
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

		function checkStartDate(startDate, siteId){
			var today = new Date();
			var offset = dateOffset = (12*60*60*1000);
			today.setTime(today.getTime() + offset);
			const day = today.getDate(), month = today.getMonth(), year = today.getFullYear();

			if(startDate !== null && startDate !== "" && startDate !== undefined){
				if(year > startDate.getFullYear()){
					return true;
				}else if(year === startDate.getFullYear()){
					if(month > startDate.getMonth()){
						return true;
					}
					else if(month === startDate.getMonth()){
						if(day >= startDate.getDate()){
							return true;
						}
					}
				}
			}
			else{
				recordErrors.push({siteID: siteId, billing: "StartDate empty"})
			}
			return false;
		} //eof checkStartDate

		function sendEmail(){
			const subject = 'Errors in ScheduleInvoiceKwh';
			const authorId = -5;
			const recipientEmail = 'frank.w@enerwhere.com';

			var body = 'Error(s) occurred in script: ' + runtime.getCurrentScript().id + '\n';
			for(var i = 0; i < recordErrors.length; i++) {
				body = body +'\n\nSite ID: ' + recordErrors[i].siteID + '\nBilling: ' + recordErrors[i].billing;
			}

			if(recordErrors.length > 0){
				body = body + "\n\n";
			}

			for(var i = 0; i < errors.length; i++) {
				body = body +'\n\nError: ' + errors[i];
			}

			email.send({
				author: authorId,
				recipients: recipientEmail,
				subject: subject,
				body: body});
		}

		return {
			execute: execute
		};

	});
