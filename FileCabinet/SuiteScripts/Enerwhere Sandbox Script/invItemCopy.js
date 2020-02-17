/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       20 Dec 2017     frankwacker
 *
 */

/**
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment. 
 * @appliedtorecord recordType
 *   
 * @param {String} type Sublist internal id
 * @returns {Void}
 */

function clientPageInit(type) {
//	alert('Hello');

}

/**
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment. 
 * @appliedtorecord recordType
 *   
 * @param {String} type Sublist internal id
 * @returns {Boolean} True to save line item, false to abort save
 */
function clientValidateLine(type){
	if (type == 'item'){
	// only for Electricity

		var itemValue = nlapiGetCurrentLineItemValue('item', 'item');
		if (itemValue != '417') {
			return true;
		}

	// Invoice automation per Line Item

		var custform = nlapiGetFieldValue('customform');
		if (custform == 109 || custform == 118|| custform == 120){
		debugger;
		var l_startdate = nlapiGetFieldValue('startdate');
		var l_enddate = nlapiGetFieldValue('enddate');
		var l_site = nlapiGetFieldValue('custbody_ew_inv_site');
		var rs_site = nlapiLoadRecord('customrecord_ew_site_form', l_site);
		var dieselColumns = new Array();
		dieselColumns[0] = new nlobjSearchColumn( 'custrecord_ew_diesel_price' );
		dieselColumns[1] = new nlobjSearchColumn( 'custrecord_ew_diesel_from' );
		dieselColumns[2] = new nlobjSearchColumn( 'custrecord_ew_diesel_to' );
		var searchdiesel = nlapiSearchRecord( 'customrecord_ew_official_diesel_price', null, null, dieselColumns );
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
		var MinOT = rs_site.getFieldValue('custrecord_ew_site_minimum');
		var ttl_consumption = nlapiGetCurrentLineItemValue('item', 'custcol_ew_curr_rdg_item') - nlapiGetCurrentLineItemValue('item', 'custcol_ew_prv_rdg_item');
		var l_rate = 0.1;
		// get the valid diesel price
		//debugger;
		if(fixedRate == 'F'){
		//	debugger;
			var h_startdate = nlapiStringToDate(l_startdate);
			for (var d = 0; searchdiesel != null && d < searchdiesel.length; d++) {
				var searchresult = searchdiesel[d];
				var h_from = nlapiStringToDate(searchresult.getValue('custrecord_ew_diesel_from'));
				var h_to = nlapiStringToDate(searchresult.getValue('custrecord_ew_diesel_to'));
				if(h_startdate >=  h_from && h_startdate < h_to){
					fixeddieselprice = searchresult.getValue('custrecord_ew_diesel_price');
					break;
				}
			}
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
		}
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
		} else {
			throw nlapiCreateError('No valid rate', 'Please fill data in site', true);
		}
	//	debugger;
		nlapiSetCurrentLineItemValue('item', 'rate', l_rate);
		nlapiSetCurrentLineItemValue('item', 'quantity', ttl_consumption);
		var taxcode = nlapiGetCurrentLineItemValue('item', 'taxcode');// AE-S 5% VAT
		nlapiSetCurrentLineItemValue('item', 'taxcode', taxcode,true, true);


		var l_rate1 = equirate +(fixeddieselprice * slab1Rate);
		l_rate1 = l_rate1.toFixed(3);
		}
	}
	
	return true;
}

function fieldChanged(type, name, linum) {
	var itemValue = '';
	if(type == 'item' && name == 'custcol_ew_item_filter'){
//		alert('you changed field from custcol_ew_item_filter\n'+nlapiGetCurrentLineItemValue('item', 'custcol_ew_item_filter'));

		itemValue = nlapiGetCurrentLineItemValue('item', 'custcol_ew_item_filter');
		nlapiSetCurrentLineItemValue('item', 'item', itemValue);
	}

}

