function scheduled() {

    try {
        /*
        var search = nlapiLoadSearch('transaction', 'customsearch6054');
        var filters = search.getFilters();
        var columns = serach.getColumns();
        for (var i = 0; i < filters.length; i ++) {
                dLog(i, filters[i]);
        }
        for (var i = 0; i < columns.length; i ++) {
                dLog(i, columns[i]);
        }
        return;
        */
        var filters = [];
        filters.push(new Array('type', 'anyof', ['SalesOrd']));
        filters.push('AND');
        filters.push(new Array('intercostatus', 'anyof', [2]));
        filters.push('AND');
        filters.push(new Array('datecreated', 'within', ['today']));
        filters.push('AND');
        filters.push(new Array('mainline', 'is', ['T']));
        filters.push('AND');
        filters.push(new Array('custbody_interco_automated', 'is', ['F']));

        var search = nlapiCreateSearch('transaction', filters, null);
        var searchResults = search.runSearch();

        // resultIndex points to record starting current resultSet in the entire results array
        var resultIndex = 0;
        var resultStep = 1000; // Number of records returned in one step (maximum is 1000)
        var resultSet; // temporary variable used to store the result set

        do {
            resultSet = searchResults.getResults(resultIndex, resultIndex + resultStep);

            for (var i = 0; i < resultSet.length; i++) {
                if ((i % 5) == 0) {
                    setRecoveryPoint();
                }
                checkGovernance();
                var element = resultSet[i];
                automateSO(element.getId());
            }

            resultIndex = resultIndex + resultStep;

        } while (resultSet.length > 0);
    } catch (error) {
        if (error.getDetails != undefined) {
            nlapiLogExecution("error", "Process Error", error.getCode() + ":" + error.getDetails());
        } else {
            nlapiLogExecution("error", "Unexpected Error", error.toString());
        }
    }
}

function automateSO(soRecId) {
    try {
        var soRec = nlapiLoadRecord('salesorder', soRecId);
        var poRecId = soRec.getFieldValue('intercotransaction');
        var poRawTranId = soRec.getFieldText('intercotransaction');
        var poTranId = poRawTranId.split("#")[1];
        var soTranDate = soRec.getFieldValue('trandate');
        soRec.setFieldText('orderstatus', 'Pending Fulfillment');
        soRec.setFieldText('department', 'Intercompany : Becca UK');
        soRec.setFieldValue('otherrefnum', poTranId);
        soRec.setFieldValue('custbody_donotsendtowarehouse', 'T');
        nlapiSubmitRecord(soRec, false, true);

        var flRec = nlapiTransformRecord('salesorder', soRecId, 'itemfulfillment');
        flRec.setFieldValue('trandate', soTranDate);
        flRec.setFieldValue('custbody_interco_automated', 'T');
        var flRecId = nlapiSubmitRecord(flRec);
        dLog('Fulfillment', flRec.getFieldValue('tranid'));
        var invoiceRec = nlapiTransformRecord('salesorder', soRecId, 'invoice', { recordmode: 'dynamic' });
        invoiceRec.setFieldValue('trandate', soTranDate);
        var invoiceRecId = nlapiSubmitRecord(invoiceRec);
        var invoiceTranId = nlapiLookupField('invoice', invoiceRecId, 'tranid');
        dLog('invoice', invoiceTranId);

        automatePO(poRecId, invoiceTranId, soRecId, invoiceRecId);
    } catch (error) {
        if (error.getDetails != undefined) {
            nlapiLogExecution("error", "AutomateSO Error", error.getCode() + ":" + error.getDetails());
        } else {
            nlapiLogExecution("error", "AutomateSO Unexpected Error", error.toString());
        }
    }
}

function automatePO(poRecId, invoiceTranId, soRecId, invoiceRecId) {
    try {
        var poRec = nlapiLoadRecord('purchaseorder', poRecId);
        var poTranId = poRec.getFieldValue('tranid');
        var poTranDate = poRec.getFieldValue('trandate');

        var irRec = nlapiTransformRecord('purchaseorder', poRecId, 'itemreceipt');
        irRec.setFieldValue('trandate', poTranDate);
        var irId = nlapiSubmitRecord(irRec);
        var irTranId = nlapiLookupField('itemreceipt', irId, 'tranid');
        dLog('Item Receipt', 'Internal ID=' + irId + ' TranID=' + irTranId);

        var billRec = nlapiTransformRecord('purchaseorder', poRecId, 'vendorbill', { recordmode: 'dynamic' });
        billRec.setFieldValue('trandate', poTranDate);
        billRec.setFieldValue('tranid', invoiceTranId);
        billRec.setFieldText('department', 'Intercompany : Becca US');
        var billRecId = nlapiSubmitRecord(billRec);
        billRec = nlapiLoadRecord('vendorbill', billRecId);
        var amount = billRec.getFieldValue('usertotal');
        var department = billRec.getFieldValue('department');
        var location = billRec.getFieldValue('location');
        dLog('Vendor Bill', 'InternalId=' + billRecId + ' Amount=' + amount + ' Department=' + department + ' Location=' + location);

        nlapiSubmitField('salesorder', soRecId, 'custbody_interco_automated', 'T');
        nlapiSubmitField('invoice', invoiceRecId, 'custbody_interco_automated', 'T');
        nlapiSubmitField('vendorbill', billRecId, 'custbody_interco_automated', 'T');

        var billCreditRec = nlapiTransformRecord('vendorbill', billRecId, 'vendorcredit', {recordmode: 'dynamic'});
        var memo = irTranId + ' - ' + poTranId;
        billCreditRec.setFieldValue('memo', memo);
        dLog('Bill Credit', memo);
        // delete all Item lines
        var lineCount = billCreditRec.getLineItemCount('item');
        for (var line = 1; line <= lineCount; line++) {
            billCreditRec.removeLineItem('item', line);
        }
        // add new expense line
        billCreditRec.selectNewLineItem('expense');
        billCreditRec.setCurrentLineItemValue('expense', 'account', '1334'); // 24100 Other Payables Intercompany - Becca US
        billCreditRec.setCurrentLineItemValue('expense', 'amount', amount);
        billCreditRec.setCurrentLineItemValue('expense', 'department', department);
        billCreditRec.setCurrentLineItemValue('expense', 'location', location);
        billCreditRec.commitLineItem('expense');

        var billCreditRecId = nlapiSubmitRecord(billCreditRec);
        dLog('Bill Credit', 'InternalID=' + billCreditRecId);

    } catch (error) {
        if (error.getDetails != undefined) {
            nlapiLogExecution("error", "AutomatePO Error", error.getCode() + ":" + error.getDetails());
        } else {
            nlapiLogExecution("error", "AutomatePO Unexpected Error", error.toString());
        }
    }
}

function isEmpty(fldValue) {
    if (fldValue == '') return true;
    if (fldValue == 'null') return true;
    if (fldValue == null) return true;
    if (fldValue == 'undefined') return true;
    if (fldValue == undefined) return true;
    if (fldValue.length < 1) return true;

    return false;
}

function dLog(title, details) {
    nlapiLogExecution('Debug', title, details);
}

function checkGovernance() {
    var context = nlapiGetContext();
    if (context.getRemainingUsage() < 200) {
        var state = nlapiYieldScript();
        if (state.status == 'FAILURE') {
            nlapiLogExecution("ERROR", "Failed to yield script, exiting: Reason = " + state.reason + " / Size = " + state.size);
            throw "Failed to yield script";
        }
        else if (state.status == 'RESUME') {
            nlapiLogExecution("AUDIT", "Resuming script because of " + state.reason + ".  Size = " + state.size);
        }
        // state.status will never be SUCCESS because a success would imply a yield has occurred.  The equivalent response would be yield
    }
}

function setRecoveryPoint() {
    var state = nlapiSetRecoveryPoint(); //100 point governance
    if (state.status == 'SUCCESS') {
        nlapiLogExecution("Audit", "Recovery Point Success");
        return;  //we successfully create a new recovery point
    }
    if (state.status == 'RESUME') //a recovery point was previously set, we are resuming due to some unforeseen error
    {
        nlapiLogExecution("ERROR", "Resuming script because of " + state.reason + ".  Size = " + state.size);
        //   handleScriptRecovery();
    }
    else if (state.status == 'FAILURE')  //we failed to create a new recovery point
    {
        nlapiLogExecution("ERROR", "Failed to create recovery point. Reason = " + state.reason + " / Size = " + state.size);
        handleRecoveryFailure(state);
    }
}

function handleRecoverFailure(failure) {
    if (failure.reason == 'SS_MAJOR_RELEASE') throw "Major Update of NetSuite in progress, shutting down all processes";
    if (failure.reason == 'SS_CANCELLED') throw "Script Cancelled due to UI interaction";
    if (failure.reason == 'SS_EXCESSIVE_MEMORY_FOOTPRINT') { cleanUpMemory(); setRecoveryPoint(); }//avoid infinite loop
    if (failure.reason == 'SS_DISALLOWED_OBJECT_REFERENCE') throw "Could not set recovery point because of a reference to a non-recoverable object: " + failure.information;
}

function cleanUpMemory() {
    nlapiLogExecution("Debug", "Cleanup_Memory", "Cleanup_Memory");
}