function scheduled() {

    try {
         var filters = [];
         filters.push(new Array('type', 'anyof', ['ItemShip']));
         filters.push('AND');
         filters.push(new Array('name', 'anyof', [2965680, 2965678, 3009133]));
         filters.push('AND');
         filters.push(new Array('datecreated', 'within', ['today']));
         filters.push('AND');
         filters.push(new Array('mainline', 'is', ['T']));
         filters.push('AND');
         filters.push(new Array('custbody_interco_automated_fl', 'anyof', ["@none@"]));
         filters.push('AND');
         filters.push(new Array('internalid', 'is', 7640998));
 
         var search = nlapiCreateSearch('transaction', filters, null);
         var searchResults = search.runSearch();
         
         // resultIndex points to record starting current resultSet in the entire results array
         var resultIndex = 0;
         var resultStep = 1000; // Number of records returned in one step (maximum is 1000)
         var resultSet; // temporary variable used to store the result set
        
         do
         {
             resultSet = searchResults.getResults(resultIndex, resultIndex + resultStep);
 
             for ( var i = 0; i < resultSet.length; i++ ) {
                 if( (i % 5) == 0 ) 
                 {
                     setRecoveryPoint();
                 }
                 checkGovernance();
                 var element = resultSet[i];
                 createPO(element.getId());
             }
 
             resultIndex = resultIndex + resultStep;
 
         } while (resultSet.length > 0);
     } catch ( error ) {
         if ( error.getDetails != undefined ) {
             nlapiLogExecution( "error", "Process Error", error.getCode() + ":" + error.getDetails() );
         } else {
             nlapiLogExecution( "error", "Unexpected Error", error.toString() );
         }
     }
 }
 
 function createPO(flRecId)
 {
     var flRec = nlapiLoadRecord('itemfulfillment', flRecId);
     var tranDate = flRec.getFieldValue('trandate');
     var lineList = [];
     var lineNum = flRec.getLineItemCount('item');
     for (var i = 1; i <= lineNum; i ++ )
     {   
         var fulfill = flRec.getLineItemValue('item', 'itemreceive', i);
         var itemId = flRec.getLineItemValue('item', 'item', i);
         var qty = flRec.getLineItemValue('item', 'quantity', i);
         var line = flRec.getLineItemValue('item', 'line', i);
         dLog('line', line);
         if (fulfill == 'T')
         {
             var lineObj = {};
             lineObj.lineNum = i;
             lineObj.itemId = itemId;
             lineObj.qty = qty;
             lineList.push(lineObj);
         }
     }
 
     var poRec = nlapiCreateRecord('purchaseorder');
     poRec.setFieldText('entity', 'VEN NO.990 Becca, Inc.');
     poRec.setFieldValue('trandate', tranDate);
     poRec.setFieldText('approvalstatus', 'Approved');
     poRec.setFieldText('department', 'Intercompany : Becca US');
     poRec.setFieldText('location', 'ILG Warehouse');
     for (var i = 0; i < lineList.length; i ++) {
         var element = lineList[i];
         poRec.selectNewLineItem('item');
         poRec.setCurrentLineItemValue('item', 'item', element.itemId);
         poRec.setCurrentLineItemValue('item', 'quantity', element.qty);
         poRec.setCurrentLineItemValue('item', 'amount', calcPOAmt(element.itemId, element.qty));
         poRec.setCurrentLineItemText('item', 'taxcode', 'VAT:S-GB'); // 20% Tax Rate
         poRec.commitLineItem('item');
     }
     var poRecId = nlapiSubmitRecord(poRec);
     nlapiSubmitField('itemfulfillment', flRecId, 'custbody_interco_automated_fl', poRecId);
     dLog('poRecId', poRecId);
 }
 
 function calcPOAmt(itemId, qty)
 {
     var avgCost = getItemAverageCost(itemId);
     var exchRate = nlapiExchangeRate('USD', 'GBP') * 1;
     var cost = avgCost * 1.189 * exchRate * qty;
     var taxAmt = cost * 0.2;
     cost = (cost + taxAmt).toFixed(2);
     return cost;
 }
 
 function getItemAverageCost(itemId)
 {   
     var avgCost = 0;
     var filters = [];
     filters.push(new nlobjSearchFilter('internalid', null, 'is', itemId));
     var columns = [];
     columns.push(new nlobjSearchColumn('averagecost'));
     var searchResult = nlapiSearchRecord('item', null, filters, columns);
     if (searchResult) {
         var element = searchResult[0];
         avgCost = element.getValue(columns[0]) * 1;
     }
 
     return avgCost;
 }
 
 function isEmpty(fldValue)
 {
     if (fldValue == '') return true;
     if (fldValue == 'null') return true;
     if (fldValue == null) return true;
     if (fldValue == 'undefined') return true;
     if (fldValue == undefined) return true;
     if (fldValue.length < 1) return true;
     
     return false;
 }
 
 function dLog(title, details)
 {
     nlapiLogExecution('Debug', title, details);
 }
 
 function checkGovernance()
 {
  var context = nlapiGetContext();
  if( context.getRemainingUsage() < 200 )
  {
     var state = nlapiYieldScript();
     if( state.status == 'FAILURE')
     {
         nlapiLogExecution("ERROR","Failed to yield script, exiting: Reason = "+state.reason + " / Size = "+ state.size);
         throw "Failed to yield script";
     } 
     else if ( state.status == 'RESUME' )
     {
          nlapiLogExecution("AUDIT", "Resuming script because of " + state.reason+".  Size = "+ state.size);
     }
   // state.status will never be SUCCESS because a success would imply a yield has occurred.  The equivalent response would be yield
  }
 }
 
 function setRecoveryPoint()
 {
  var state = nlapiSetRecoveryPoint(); //100 point governance
  if( state.status == 'SUCCESS' ) {
     nlapiLogExecution("Audit", "Recovery Point Success");
     return;  //we successfully create a new recovery point
  }
  if( state.status == 'RESUME' ) //a recovery point was previously set, we are resuming due to some unforeseen error
  {
     nlapiLogExecution("ERROR", "Resuming script because of " + state.reason+".  Size = "+ state.size);
  //   handleScriptRecovery();
  }
  else if ( state.status == 'FAILURE' )  //we failed to create a new recovery point
  {
      nlapiLogExecution("ERROR","Failed to create recovery point. Reason = "+state.reason + " / Size = "+ state.size);
      handleRecoveryFailure(state);
  }
 }
 
 function handleRecoverFailure(failure)
 {
      if( failure.reason == 'SS_MAJOR_RELEASE' ) throw "Major Update of NetSuite in progress, shutting down all processes";
      if( failure.reason == 'SS_CANCELLED' ) throw "Script Cancelled due to UI interaction";
      if( failure.reason == 'SS_EXCESSIVE_MEMORY_FOOTPRINT' ) { cleanUpMemory(); setRecoveryPoint(); }//avoid infinite loop
      if( failure.reason == 'SS_DISALLOWED_OBJECT_REFERENCE' ) throw "Could not set recovery point because of a reference to a non-recoverable object: "+ failure.information; 
 }
 
 function cleanUpMemory(){
      nlapiLogExecution("Debug", "Cleanup_Memory", "Cleanup_Memory");
 }