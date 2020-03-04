/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/email', 'N/error', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/format','N/file'],
	/**
	 * @param {email} email
	 * @param {error} error
	 * @param {https} https
	 * @param {record} record
	 * @param {runtime} runtime
	 * @param {search} search
	 * @param {format} format

	 */
	function(email, error, https, record, runtime, search, format,file) {
		/**
		 * Function definition to be triggered before record is loaded.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.newRecord - New record
		 * @param {string} scriptContext.type - Trigger type
		 * @param {Form} scriptContext.form - Current form
		 * @Since 2015.2
		 */

		// global function and variables

		var dateOffset = (12*60*60*1000); //1 days UTC + 4
		var todate = new Date();
		todate.setTime(todate.getTime() + dateOffset);
		todate.setHours(0,0,0,0);
		todate.setDate(todate.getDate() - 1);
		var fuelByCustomer, fuelPreNeg;


		function beforeSubmit(scriptContext) {
			var myrecord = scriptContext.newRecord;
			var create = myrecord.getValue({
				fieldId: 'custrecord_ew_site_flag_createinvoice'
			});
			if(create == false){
				return true;
			}
			var site_name = myrecord.getValue({
				fieldId: 'name'
			});
			var site = myrecord.id;

			var fromdate = myrecord.getValue({
				fieldId: 'custrecord_ew_site_lastinvdate'
			});
				fromdate = format.parse({
					value: fromdate,
					type: format.Type.DATE
				});

            var startReadings = getReadings(site, fromdate);
			var endReadings = getReadings(site, todate);
			// check the readings
			var chkReading = compareReading(startReadings,endReadings,site_name);
			if (chkReading == false){
				// TODO: Error handling global
			}
            fromdate.setDate(fromdate.getDate() + 1);
			createInvoice(myrecord, startReadings, endReadings);
			// check if we need a seperate invoice for cables that we rent monthly
			var ServiceInv = getServiceFlag(myrecord);
			if(ServiceInv == true){
				var lv_lastDay = isLastDay(todate);
				if(lv_lastDay == true){
					createServiceInvoice(myrecord);
				}
			}
			myrecord.setValue({
				fieldId: 'custrecord_ew_site_flag_createinvoice',
				value: false
			});
		} // EOF beforeSubmit

		function getReadings(site, l_date){
			var ar_reading = new Array();
			l_date = format.format({
				value: l_date,
				type: format.Type.DATE
			});
			var reading = search.create({
				type: 'customrecord_ew_meterreading_form',
				columns: ['name','id','custrecord_ew_mr_metername','custrecordmeternumber','custrecord_ew_mr_site','custrecord1','custrecord_ew_meterreading_value'],
				filters: [{
					name: 'custrecord_ew_mr_site',
					operator: search.Operator.IS,
					values: site
				},{
					name: 'custrecord1',
					operator: search.Operator.ON,
					values: l_date
				}] // end of filter*/
			});
			reading.run().each(function(result){
				ar_reading.push(result);
				return true;
			});
			return ar_reading;
		} // eof getReadings

		function createInvoice(myrecord, startReading, endReading) {
			try {
				var myrecord = myrecord;
				var startReading = startReading;
				var endReading = endReading;
				var custform = myrecord.getValue({
					fieldId: 'custrecord_ew_site_invtmpl'
				}); // KWH Invoice template
				// Jumeirah Gates needs another form #118
				if (custform == '' || custform == null) {
					custform = '109';
				}
				var ewbank = myrecord.getValue({
					fieldId: 'custrecord_ew_site_bankacc'
				});
				var customer = myrecord.getValue({
					fieldId: 'custrecord_customername'
				});
				var project = myrecord.getValue({
					fieldId: 'custrecord_ew_site_project'
				});
				var l_class = myrecord.getValue({
					fieldId: 'custrecord_ew_accounting_class_site'
				});
				var terms = myrecord.getValue({
					fieldId: 'custrecord_ew_site_term'
				});
				var lastinv = myrecord.getValue({
					fieldId: 'custrecord_ew_site_lastinvdate'
				});
				var site_name = myrecord.getValue({
					fieldId: 'name'
				});

				lastinv = format.parse({
					value: lastinv,
					type: format.Type.DATE
				});

				var fromDate;
				fromDate = lastinv;
				fromDate.setDate(fromDate.getDate() + 1);

				var itemname = '417';
				var ar_mtrdata = new Array();

				// add values to ar_mtrdata
				for (var k = 0; k < startReading.length; k++) {
					ar_mtrdata[k] = new Array();
					var l_meternumber = startReading[k].getValue('custrecordmeternumber');
					var mtrdtls = getMeterDetails(l_meternumber);
					ar_mtrdata[k][0] = mtrdtls.getValue('itemid'); // Meternumber
					ar_mtrdata[k][2] = startReading[k].getValue('custrecord_ew_meterreading_value'); //previous reading

					// get current reading
					for (var l = k; l < endReading.length; l++) {
						ar_mtrdata[k][1] = endReading[l].getValue('custrecord_ew_meterreading_value'); // current reading
						ar_mtrdata[k][3] = mtrdtls.getValue('displayname'); // Metername
                        ar_mtrdata[k][4] = mtrdtls.getText('custitem_ew_inventory_type');
						if (ar_mtrdata[k][3] == '') {
							var h_meterno = k + 1;
							ar_mtrdata[k][3] = 'Revenue Meter ' + h_meterno;
						}
						break;
					} // end of loop current reading
					ar_mtrdata.push();
				}
				// end of loop start readingDG meter in not taken into consideration
				if(custform == '122'){
					ar_mtrdata[0] = new Array();
					ar_mtrdata[0][0] = '00000'; // Meternumber
					ar_mtrdata[0][2] = ''; //previous reading
					ar_mtrdata[0][1] = ''; // current reading
					ar_mtrdata[0][3] = 'Area Charge'; // Metername
					ar_mtrdata[0][4] = '';
					ar_mtrdata.push();
				}
                if (custform == '120') {
                    // check for crane meters
                    var craneNo = 1;
                    for (var mc = 0; mc < ar_mtrdata.length; mc++) {

                        // check if the item is a subitem to get the correct serial number
                        if (ar_mtrdata[mc][4] == 'Crane Meter') {
                            ar_mtrdata[mc][3] = 'Crane Meter' + craneNo;
                            craneNo ++;
                        }
                    } // end of loop  caren meters
                }
				// get Customer details to find the right subsidiary
				var CustRecord = record.load({
					type: record.Type.CUSTOMER,
					id: customer
				})
				var subsidiary = myrecord.getValue({
					fieldId: 'custrecord_ew_site_subsidiary'
				});

				if (subsidiary == '8') {
					subsidiary = '12';
				}/* else {
					subsidiary = '5';
				}*/
				var objInvoice = record.create({
					type: record.Type.INVOICE,
					isDynamic: true
				});
				objInvoice.setValue({
					fieldId: 'customform',
					value: custform
				});
				objInvoice.setValue({
					fieldId: 'entity',
					value: customer
				});
				objInvoice.setValue({
					fieldId: 'subsidiary',
					value: subsidiary
				});
				objInvoice.setValue({
					fieldId: 'custbody_ew_inv_site',
					value: myrecord.id
				});
				objInvoice.setValue({
					fieldId: 'job',
					value: project
				});

				objInvoice.setValue({
					fieldId: 'terms',
					value: terms
				});
				objInvoice.setValue({
					fieldId: 'custbody_ew_inv_bankacc',
					value: ewbank
				});
				objInvoice.setValue({
					fieldId: 'class',
					value: l_class
				});
				objInvoice.setValue({
					fieldId: 'nextapprover',
					value: '580'
				}); // Alice
				objInvoice.setValue({
					fieldId: 'custbody_ew_minofftakeauto',
					value: true
				});
				objInvoice.setValue({
					fieldId: 'enddate',
					value: todate
				});
				objInvoice.setValue({
					fieldId: 'startdate',
					value: fromDate
				});
				objInvoice.setValue({
					fieldId: 'trandate',
					value: todate
				})
                var lv_duedate = new Date();
				lv_duedate.setDate(todate.getDate() + 30);
                var custduedate = new Date();
				custduedate.setDate(todate.getDate() + 32);
                objInvoice.setValue({
                    fieldId: 'custbody_ew_bill_estpayment',
                    value: lv_duedate
                });
                objInvoice.setValue({
                    fieldId: 'custbody_ew_inv_custduedate',
                    value: custduedate
                });
				// sort the Meter by Metername
				ar_mtrdata.sort(function (a, b) {
					var valueA = a[3].toLowerCase(), valueB = b[3].toLowerCase();
					if (valueA < valueB) //sort string ascending
						return -1;
					if (valueA > valueB)
						return 1;
					return 0; //default return value (no sorting)
				});

				// Crane invoice form = 120
				if (custform == '120') {
					ar_mtrdata.sort(function (a, b) {
						var valueA = a[3].toLowerCase(), valueB = b[3].toLowerCase();
						if (valueA > valueB) //sort string desending
							return -1;
						if (valueA > valueB)
							return 1;
						return 0; //default return value (no sorting)
					});
				} // endif sort for cranes

                // loop for line items
				for (var m = 0; m < ar_mtrdata.length; m++) {
					if(custform == '125' && ar_mtrdata[m][4] != 'Revenue Meter'){
						continue;
					}
					itemname = '417';
					// if the meter is a cranemeter, the number of working days must be checked

                    if (ar_mtrdata[m][4] == 'Crane Meter') {
                        itemname = '3775';
						objInvoice.setCurrentSublistValue('item', 'item', itemname);
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_item_filter', itemname);
                        var workingdays = getCraneDetail(ar_mtrdata[m][0],fromDate,todate);
						objInvoice.setCurrentSublistValue('item', 'quantity', workingdays.toString());
				//		objInvoice.setCurrentSublistValue('item', 'units', '15');
						var rate = getCraneRate(myrecord, objInvoice,m);
						rate = parseFloat(rate);
						objInvoice.setCurrentSublistValue('item', 'rate', rate);
						objInvoice.setCurrentSublistValue('item', 'taxcode', '8');
						var amnt = rate * workingdays;
						amnt = amnt.toFixed(2);
						objInvoice.setCurrentSublistValue('item', 'amount', amnt);
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_mtr_no_item', ar_mtrdata[m][0].toString()); // meternumber
					}

					if (itemname == '417') {
						objInvoice.setCurrentSublistValue('item', 'item', itemname);
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_item_filter', itemname);
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_mtr_no_item', ar_mtrdata[m][0].toString()); // meternumber
						objInvoice.setCurrentSublistValue('item', 'units', '1');
						objInvoice.setCurrentSublistValue('item', 'amount', '1');
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_curr_rdg_item', ar_mtrdata[m][1].toString()); // current reading
						objInvoice.setCurrentSublistValue('item', 'custcol_ew_prv_rdg_item', ar_mtrdata[m][2].toString()); // previous reading
					} // endif item is 417 electricity

					objInvoice.setCurrentSublistValue('item', 'custcol_ew_inv_item_metername', ar_mtrdata[m][3].toString()); // display name
					objInvoice.setCurrentSublistValue('item', 'class', l_class);
					objInvoice.setCurrentSublistValue('item', 'custcol_ew_jrn_proj', project);

					objInvoice.commitLine('item');
					//validate the new line
						validateLine(objInvoice, myrecord, m);
					} // end of loop array meter details

                // cooling Invoice form
				if (custform == '118') {
					var lineNumJG = objInvoice.selectNewLine({
						sublistId: 'item'
					});
					objInvoice.setCurrentSublistValue('item', 'item', '465');
					objInvoice.setCurrentSublistValue('item', 'custcol_ew_item_filter', '465');
					objInvoice.setCurrentSublistValue('item', 'units', '4'); // THR
					objInvoice.setCurrentSublistValue('item', 'quantity', myrecord.getValue({fieldId: 'custrecord_ew_site_coolingcapa'}));
					objInvoice.setCurrentSublistValue('item', 'rate', myrecord.getValue({fieldId: 'custrecord_ew_site_coolingcharge'}));
					objInvoice.setCurrentSublistValue('item', 'class', l_class);
					objInvoice.setCurrentSublistValue('item', 'custcol_ew_jrn_proj', project);
					objInvoice.setCurrentSublistValue('item', 'taxcode', '8');

					objInvoice.commitLine('item');
				} // endif Cooling
				if (custform == '125' ) {
					var lineNumEf = objInvoice.selectNewLine({
						sublistId: 'item'
					});
					itemname = '4112'; // Area Charge
					var arearate = efficencyInvoice(myrecord,objInvoice);
					var sqm = myrecord.getValue({
						fieldId: 'custrecord_ew_site_eff_sqm'
					});
					objInvoice.setCurrentSublistValue('item', 'item', itemname);
					objInvoice.setCurrentSublistValue('item', 'quantity', sqm.toString());
					objInvoice.setCurrentSublistValue('item', 'rate', arearate);
					var amnt = arearate * sqm;
					amnt = amnt.toFixed(2);
					objInvoice.setCurrentSublistValue('item', 'amount', amnt.toString());
					objInvoice.setCurrentSublistValue('item', 'taxcode', '8');
					objInvoice.setCurrentSublistValue('item', 'class', l_class);
					objInvoice.commitLine('item');
				} 		// endif efficency invoice

				var RecId = objInvoice.save({
					ignoreMandatoryFields: true
				});
				// set new invoice date
				if (RecId != null) {
					myrecord.setValue({
						fieldId: 'custrecord_ew_site_lastinvdate',
						value: todate
					});
				} // endif RecId != null
			} // end try
			catch (e) {
				var msg = e.message;
				var subject = 'Fatal Error creating invoice';
				var authorId = -5;
				var recipientEmail = 'frank.w@enerwhere.com';
				email.send({
					author: authorId,
					recipients: recipientEmail,
					subject: subject,
					body: 'Fatal Error Invoice creation : ' + runtime.getCurrentScript().id + '\n\n' + msg
				});
			}
			finally {
				return true;
			}

		} // EOF createInvoice

		function getMeterDetails(meternumber){
			var meternumber = meternumber;
			var mtrsearch = search.create({
				type: search.Type.SERIALIZED_INVENTORY_ITEM,
				columns:[{
					name: 'itemid'
				}, {
					name: 'parent'
				}, {
					name: 'internalid'
				}, {
					name: 'custitem_ew_item_location'
				}],
				filters:[{
					name: 'itemid',
					operator: 'is',
					values: meternumber
				}]
			});
			var result = mtrsearch.run().getRange({
				start: 0,
				end: 2
			});
			if(result.length > 1){
				var subject = 'Fatal Error: more than one serialnumber on NetSuite';
				var authorId = -5;
				var recipientEmail = 'itsupport@enerwhere.com';
				email.send({
					author: authorId,
					recipients: recipientEmail,
					subject: subject,
					body: 'Fatal Error: More than one serialnumber on NetSuite: ' + runtime.getCurrentScript().id + '\n\n' + result[0].itemid
				});
				return false;
			}
            var objRecord = record.load({
				type: record.Type.SERIALIZED_INVENTORY_ITEM,
				id: result[0].id
			});
			return objRecord;

		} // EOF getMeterDetails

		function validateLine(objInvoice,myrecord,m){
			var objInvoice = objInvoice;
			var myrecord = myrecord;
			var m = m;
			// only for Elecricity
			var lineitem = objInvoice.getSublistValue('item', 'item', m);
			if(lineitem != '417'){
				return;
			}
			// Invoice automation per Line Item
			 var lineNum = objInvoice.selectLine({
			 	sublistId: 'item',
			 	line: m
			 });
			var custform = objInvoice.getValue({
				fieldId: 'customform'
			});
			var fixedRate = myrecord.getValue({fieldId: 'custrecord_ew_site_fxdrate'});
			fuelByCustomer = myrecord.getValue({fieldId:'custrecord_ew_site_fuelcustomer'});
			fuelPreNeg = myrecord.getValue({fieldId:'custrecord_ew_site_fuel_negotated'});
			if(fixedRate == true || fuelByCustomer == true || fuelPreNeg == true){
				fixedRate = true;
			}
			var fixeddieselprice = getDieselprice(myrecord,objInvoice,m);
			var equirate = myrecord.getValue({fieldId: 'custrecord_ew_site_equirate'});

			var slab1To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab1_to'});
			slab1To = parseFloat(slab1To);
			var slab1Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab1_rate'});
			var slab2To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab2_to'});
			slab2To = parseFloat(slab2To);
			var slab2Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab2_rate'});
			var slab3To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab3_to'});
			var slab3Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab3_rate'});
			//	var itemlist = objInvoice.getSublist({id: 'item'});
			var cur_read = objInvoice.getSublistValue('item', 'custcol_ew_curr_rdg_item', m);
			var prev_read = objInvoice.getSublistValue('item', 'custcol_ew_prv_rdg_item', m);
			var ttl_consumption = parseFloat(cur_read) - parseFloat(prev_read);
			var l_rate = 0.1;

			if (custform == 109 || custform == 118 || custform == 120){
				var l_enddate = objInvoice.getValue({
					fieldId: 'enddate'});
				var l_site = objInvoice.getValue({fieldId: 'name'});
				fixeddieselprice = getDieselprice(myrecord,objInvoice,m);

				equirate = parseFloat(equirate);
				//fixeddieselprice = fixeddieselprice.toFixed(2);
				fixeddieselprice = parseFloat(fixeddieselprice);
				slab1Rate = parseFloat(slab1Rate);
				slab2Rate = parseFloat(slab2Rate);
				slab3Rate = parseFloat(slab3Rate);
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
				} else {
					var errObj = error.create({name: error.Type.WRONG_PARAMETER_TYPE, message: 'No valid Rate on Site',
						notifyOff: false});
					throw errObj;
				} // end else
				var l_class = myrecord.getValue({
					fieldId: 'custrecord_ew_accounting_class_site'
				});
				objInvoice.setCurrentSublistValue('item', 'item', lineitem);
				objInvoice.setCurrentSublistValue('item', 'rate', l_rate.toString());
				objInvoice.setCurrentSublistValue('item', 'quantity', ttl_consumption.toString());
				objInvoice.setCurrentSublistValue('item', 'class', l_class);
				var taxcode = 8; // AE-S 5% VAT
				objInvoice.setCurrentSublistValue('item', 'taxcode', taxcode.toString());


				var l_rate1 = equirate +(fixeddieselprice * slab1Rate);
				l_rate1 = l_rate1.toFixed(3);
			}
			objInvoice.commitLine({sublistId: 'item'});
		} // EOF validateLine

		function getCraneDetail(mtrnumber,fromDate,todate){
			var workingdays = 0;
			var f_fromdate = format.format({
				value: fromDate,
				type: format.Type.DATE
			});
			var f_todate = format.format({
				value: todate,
				type: format.Type.DATE
			});
			var wdSearch =  search.create({
				type: "customrecord_ew_meterreading_form",
				filters:
					[
						["custrecord1","within",f_fromdate,f_todate],
						"AND",
						["custrecordmeternumber","is",mtrnumber],
						"AND",
						["custrecord_ew_meterreading_inv_flag","is","T"]
					],
				columns:
					[
						"name",
						"custrecordmetername",
						search.createColumn({
							name: "custrecordmeternumber",
							sort: search.Sort.ASC
						}),
						"custrecord_ew_mr_site",
						"custrecord_ew_mr_cust_new",
						search.createColumn({
							name: "custrecord1",
							sort: search.Sort.ASC
						}),
						"custrecord_ew_meterreading_value",
						"custrecord_ew_meterreading_inv_flag"
					]
			});
			var searchResultCount = wdSearch.runPaged().count;

			wdSearch.run().each(function(result){
				workingdays++;
				return true;
			});

			return workingdays;
		}

		function getCraneRate(myrecord,objInvoice,m){
			var fixeddieselprice = 0;
			var equirate = myrecord.getValue({fieldId: 'custrecord_ew_site_craneequichrg'});
			var fuelrate = myrecord.getValue({fieldId: 'custrecord_ew_site_cranefuelrate'});

			fixeddieselprice = getDieselprice(myrecord,objInvoice,m);
			fixeddieselprice = parseFloat(fixeddieselprice);

			var rate = equirate + (fixeddieselprice * fuelrate);
			rate = rate.toFixed(2);

			return rate;

		} // eof getCraneRate

		function efficencyInvoice(myrecord,objInvoice){
			var myrecord = myrecord;
			var objInvoice = objInvoice;
		    //  Area charge = fixed charge + (Dieselprice * Usage charge)
			var fixedchrg = myrecord.getValue({
				fieldId: 'custrecord_ew_site_eff_fixchrg'
			});
			var fromdate = objInvoice.getValue('startdate');
            fixedchrg = parseFloat(fixedchrg);
			var month = fromdate.getMonth();
			month++;
			month = parseInt(month);
			month = month.toString();
			var site = myrecord.getValue('name');
			var usagechrg = 0;
			var montUsageChrg = search.create({
				type: 'customrecord_ew_rec_effusgchrg',
				columns: ['custrecord_ew_effrec_site','custrecord_ew_effusechrg_month','custrecord_ew_effusechrg_val'],
				filters: [{
					name: 'custrecord_ew_effrec_site',
					operator: search.Operator.IS,
					values: site
				},{
				 	name: 'custrecord_ew_effusechrg_month',
				 	operator: search.Operator.IS,
				 	values: month
				 }] // end of filter*/
			});
			montUsageChrg.run().each(function(result){
				usagechrg = result.getValue('custrecord_ew_effusechrg_val')
				return false;
			});
            usagechrg = parseFloat(usagechrg);
            var fixeddieselprice = getDieselprice(myrecord,objInvoice,month);
			fixeddieselprice = parseFloat(fixeddieselprice);
            var areachrg = fixedchrg + (usagechrg * fixeddieselprice);
            return areachrg;
		} //eof efficencyInvoice

		function compareReading(startReading,endReading,site_name){
			// first check if all serialnr have a reading value for that date
			if (startReading.length != endReading.length) {
				var subject = 'Fatal Error:Serial Numbers dont match';
				var authorId = -5;
				var recipientEmail = 'itsupport@enerwhere.com';
				email.send({
					author: authorId,
					recipients: recipientEmail,
					subject: subject,
					body: 'Fatal Error:Serial Numbers dont match: ' + runtime.getCurrentScript().id + '\n\n' + site_name

				});
				return false;
			}
			return true;
		}
		function getDieselprice(myrecord, objInvoice,m){
			var myrecord = myrecord;
			var objInvoice = objInvoice;
			var m = m;
			var site_name = myrecord.getValue({fieldId:'name'});
			var custform = objInvoice.getValue({
				fieldId: 'customform'
			});
			fuelByCustomer = myrecord.getValue({fieldId:'custrecord_ew_site_fuelcustomer'});
			fuelPreNeg = myrecord.getValue({fieldId:'custrecord_ew_site_fuel_negotated'});
			var l_startdate = objInvoice.getValue({
				fieldId: 'startdate' });


			var fixedRate = myrecord.getValue({fieldId: 'custrecord_ew_site_fxdrate'});
			if(fixedRate == true || fuelPreNeg == true || fuelByCustomer == true) {
				fixedRate = true;
				var fixeddieselprice = getFixedDieselPrice(site_name,l_startdate);
			} else {
				var searchdiesel = search.create({
					//	id: 'customsearch_officialdieselprice',
					type: 'customrecord_ew_official_diesel_price',
					//	title: 'official Dieselprice',
					columns: [{
						name: 'custrecord_ew_diesel_price'
					},{
						name: 'custrecord_ew_diesel_from'
					}, {
						name: 'custrecord_ew_diesel_to'
					}]

				});
			}
			var equirate = myrecord.getValue({fieldId: 'custrecord_ew_site_equirate'});
			var discount = myrecord.getValue({fieldId: 'custrecord_ew_site_discountamnt'});
			var discounttype = myrecord.getValue({fieldId: 'custrecord_ew_site_discounttype'});
			var slab1From = myrecord.getValue({fieldId: 'custrecord_ew_site_slab1_from'});
			var slab1To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab1_to'});
			slab1To = parseFloat(slab1To);
			var slab1Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab1_rate'});
			var slab2From = myrecord.getValue({fieldId: 'custrecord_ew_site_slab2_from'});
			var slab2To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab2_to'});
			slab2To = parseFloat(slab2To);
			var slab2Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab2_rate'});
			var slab3From = myrecord.getValue({fieldId: 'custrecord_ew_site_slab3_from'});
			var slab3To = myrecord.getValue({fieldId: 'custrecord_ew_site_slab3_to'});
			var slab3Rate = myrecord.getValue({fieldId: 'custrecord_ew_site_slab3_rate'});
			var MinOT = myrecord.getValue({fieldId: 'custrecord_ew_site_minimum'});
			//	var itemlist = objInvoice.getSublist({id: 'item'});
			if(custform != '122' && custform != '125' && custform != '120') {
				var cur_read = objInvoice.getSublistValue('item', 'custcol_ew_curr_rdg_item', m);
				var prev_read = objInvoice.getSublistValue('item', 'custcol_ew_prv_rdg_item', m);
			}
			var ttl_consumption = parseFloat(cur_read) - parseFloat(prev_read);
			var l_rate = 0.1;
			// get the valid diesel price
			if(fixedRate == false){
				var h_startdate = format.parse({
					value: l_startdate,
					type: format.Type.DATE});

			searchdiesel.run().each(function(searchresult){

				var h_from = format.parse({
					value: searchresult.getValue({name: 'custrecord_ew_diesel_from'}),
					type: format.Type.DATE});
				var h_to = format.parse({
					value: searchresult.getValue({name: 'custrecord_ew_diesel_to'}),
					type: format.Type.DATE});
				if(h_startdate >=  h_from && h_startdate < h_to){
					fixeddieselprice = searchresult.getValue('custrecord_ew_diesel_price');
					return false;
				}
				return true;
			});
			}
			if(fixedRate == false) {
				fixeddieselprice = (fixeddieselprice * 100) / 105; // Net Official Diesel price
			}
			fixeddieselprice = fixeddieselprice.toFixed(2);
			fixeddieselprice = parseFloat(fixeddieselprice);
		//	fixeddieselprice = Math.round(fixeddieselprice,2);
			if (discount != null && discount != 0 && discount != ''){
				if(discounttype == 2){
					fixeddieselprice = fixeddieselprice - discount;
					fixeddieselprice = fixeddieselprice.toFixed(2);
					fixeddieselprice = parseFloat(fixeddieselprice);
				}else if (discounttype == 3) {
					fixeddieselprice = fixeddieselprice * (100 - discount) / 100;
				} else {
					var errObj = error.create({name: error.Type.WRONG_PARAMETER_TYPE, message: 'No Discounttype on Site',
						notifyOff: false});
					throw errObj;
				}
			} // endif discount error*
			return fixeddieselprice;
		}
		function getFixedDieselPrice(fileName, startDate) {
			//##### Search for file #####
			var fileID;
			var fileName = fileName;
			var startDate = startDate;

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

		function sendErrorMessage(params){
			const err = error.create({
				"name": params.name,
				"message": params.message,
				"notifyOff": true});

			throw err;
		}

		function getServiceFlag(myrecord){
			var flag = myrecord.getValue('custrecord_ew_site_serviceflag');
			return flag;
		} // eof getCabelFlag

		function isLastDay(dt) {
			var flag = false;
			var test = new Date(dt.getTime()),
				month = test.getMonth();

			test.setDate(test.getDate() + 1);
			if(test.getMonth() !== month){
				flag = true;
			}
			if (runtime.envType == 'SANDBOX'){
				flag = true;
			}
			return flag;
		}// eof isLastDay

		function createServiceInvoice(myrecord){
				var custform = '112'; // EPC Invoice template
				var customer = myrecord.getValue({
					fieldId: 'custrecord_customername'
				});
			var fromdate = myrecord.getValue({
				fieldId: 'custrecord_ew_site_lastinvdate'
			});
			fromdate = format.parse({
				value: fromdate,
				type: format.Type.DATE
			});
				var project = myrecord.getValue({
					fieldId: 'custrecord_ew_site_project'
				});
				var l_class = myrecord.getValue({
					fieldId: 'custrecord_ew_accounting_class_site'
				});
				var terms = myrecord.getValue({
					fieldId: 'custrecord_ew_site_term'
				});

			var CustRecord = record.load({
				type: record.Type.CUSTOMER,
				id: customer
			})
			var subsidiary = myrecord.getValue({
				fieldId: 'custrecord_ew_site_subsidiary'
			});

			if (subsidiary == '8') {
				subsidiary = '12';
			}
			var objInvoice2 = record.create({
				type: record.Type.INVOICE,
				isDynamic: true
			});
			objInvoice2.setValue({
				fieldId: 'customform',
				value: custform
			});
			objInvoice2.setValue({
				fieldId: 'entity',
				value: customer
			});
			objInvoice2.setValue({
				fieldId: 'subsidiary',
				value: subsidiary
			});

			objInvoice2.setValue({
				fieldId: 'job',
				value: project
			});

			objInvoice2.setValue({
				fieldId: 'terms',
				value: terms
			});
			objInvoice2.setValue({
				fieldId: 'class',
				value: l_class
			});
			objInvoice2.setValue({
				fieldId: 'nextapprover',
				value: '580'
			}); // Alice
			objInvoice2.setValue({
				fieldId: 'enddate',
				value: todate
			});
			objInvoice2.setValue({
				fieldId: 'startdate',
				value: fromdate
			});
			objInvoice2.setValue({
				fieldId: 'trandate',
				value: todate
			})
			var lv_duedate = new Date();
			lv_duedate.setDate(todate.getDate() + 30);
			var custduedate = new Date();
			custduedate.setDate(todate.getDate() + 32);
			objInvoice2.setValue({
				fieldId: 'custbody_ew_bill_estpayment',
				value: lv_duedate
			});
			objInvoice2.setValue({
				fieldId: 'custbody_ew_inv_custduedate',
				value: custduedate
			});
			var mySearchFilter = search.createFilter({
				name: 'custrecord_ew_servicesite_site',
				operator: search.Operator.ANYOF,
				values: myrecord.getText('name')
			});
			var mySearch= search.load({
				id: 'customsearch_ew_search_servicesite',
				filter: mySearchFilter
			});
			var mySearchResult= mySearch.run().getRange({
				start: 0,
				end: 100 // limit is 4000
			});
			for (var k = 0; k < mySearchResult.length; k++) {
				var lineNumJG = objInvoice2.selectNewLine({
					sublistId: 'item'
				});
				objInvoice2.setCurrentSublistValue('item', 'item', mySearchResult[k].getValue('custrecord_ew_serviceatsite'));
				objInvoice2.setCurrentSublistValue('item', 'custcol_ew_item_filter', mySearchResult[k].getValue('custrecord_ew_serviceatsite'));
				objInvoice2.setCurrentSublistValue('item', 'units', '3'); // Meter
				objInvoice2.setCurrentSublistValue('item', 'quantity', mySearchResult[k].getValue('custrecord_ew_servicesite_qty'));
				objInvoice2.setCurrentSublistValue('item', 'rate', mySearchResult[k].getValue('custrecord_ew_servicesite_price'));
				objInvoice2.setCurrentSublistValue('item', 'class', l_class);
				objInvoice2.setCurrentSublistValue('item', 'custcol_ew_jrn_proj', project);
				objInvoice2.setCurrentSublistValue('item', 'taxcode', '8');

				objInvoice2.commitLine('item');
			} // end of for loop
		var RecId = objInvoice2.save({
			ignoreMandatoryFields: true
		});

		}// eof createCabelInvoice

		/**
		 * Function definition to be triggered before record is loaded.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.newRecord - New record
		 * @param {Record} scriptContext.oldRecord - Old record
		 * @param {string} scriptContext.type - Trigger type
		 * @Since 2015.2
		 */
		/*function afterSubmit(scriptContext) {

        } // EOF afterSubmit*/

		return {
			//  beforeLoad: beforeLoad,
			beforeSubmit: beforeSubmit
			// afterSubmit: afterSubmit
		};

	});
