function scheduled( type )
{ 
    processData();
}

function processData() {

  try {
      // resultIndex points to record starting current resultSet in the entire results array
      var search = nlapiLoadSearch( 'transaction', 'customsearch3744' );
      var searchResults = search.runSearch();
      // resultIndex points to record starting current resultSet in the entire results array
      var resultIndex = 0;
      var resultStep = 100; // Number of records returned in one step (maximum is 1000)
      var resultSet; // temporary variable used to store the result set

      var allCount = 0;
      do
      {
        
        resultSet = searchResults.getResults(resultIndex, resultIndex + resultStep);
      
        for ( var i = 0; i < resultSet.length; i++ ) {

            processAutoInvoice(resultSet[i].getId());
            if( (i % 5) == 0 ) {
              setRecoveryPoint();
            }
            allCount ++;
            nlapiLogExecution('Debug', allCount, resultSet[i].getId());
            checkGovernance();
   
        }

       resultIndex = resultIndex + resultStep;
     
      } while (resultSet.length > 0);

  } catch ( error ) {

    if ( error.getDetails != undefined ) {
      nlapiLogExecution( "error", "ProcessData Error", error.getCode() + ":" + error.getDetails() );
    } else {
      nlapiLogExecution( "error", "ProcessData Unexpected Error", error.toString() );
    }

  }

}

function processAutoInvoice(soRecId)
{
    try {
        var flRec = nlapiTransformRecord('salesorder', soRecID, 'itemfulfillment');
        flRec.setFieldValue('trandate', '9/1/2018');
        nlapiSubmitRecord(flRec);
        var invoiceRec = nlapiTransformRecord('salesorder', soRecID, 'invoice', {recordmode: 'dynamic'});
        invoiceRec.setFieldValue('trandate', '9/1/2018');
        var invoiceRecId = nlapiSubmitRecord(invoiceRec);
        var cpRecId = applyPayment(invoiceRecId);
        dLog('Customer Payment', cpRecId);
    } catch ( error ) {
        if ( error.getDetails != undefined ) {
             nlapiLogExecution( "error", "ProcessAutoInvoice Error", error.getCode() + ":" + error.getDetails() );
        } else {
             nlapiLogExecution( "error", "ProcessAutoInvoice Unexpected Error", error.toString() );
        }
    }
}

function applyPayment(invoiceRecId)
{   
    var invoiceRec = nlapiLoadRecord('invoice', invoiceRecId);
    var tranid = invoiceRec.getFieldValue('tranid');
    var tranDate = invoiceRec.getFieldValue('trandate');
    var customerpayment = nlapiTransformRecord('invoice', invoiceRecId, 'customerpayment', {recordmode: 'dynamic'});
  //14000 Undeposited Funds
    customerpayment.setFieldValue('trandate', tranDate);
    customerpayment.setFieldValue('account', 116);
    var linecount = customerpayment.getLineItemCount('apply');
    for (var i = 1; i<=linecount; i++)
    {
         var refnum = customerpayment.getLineItemValue('apply','refnum', i);
         if(refnum == tranid) {
            customerpayment.setLineItemValue('apply','apply',i,'T');
         }
    }

    var cpId = nlapiSubmitRecord(customerpayment, false, true);
    return cpId;
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
     if( failure.reason == 'SS_MAJOR_RELEASE' ) throw "Major Update of NetSuite in progress, shutting down all processDataes";
     if( failure.reason == 'SS_CANCELLED' ) throw "Script Cancelled due to UI interaction";
     if( failure.reason == 'SS_EXCESSIVE_MEMORY_FOOTPRINT' ) { cleanUpMemory(); setRecoveryPoint(); }//avoid infinite loop
     if( failure.reason == 'SS_DISALLOWED_OBJECT_REFERENCE' ) throw "Could not set recovery point because of a reference to a non-recoverable object: "+ failure.information; 
}

function cleanUpMemory(){
     nlapiLogExecution("Debug", "Cleanup_Memory", "Cleanup_Memory");
}

function dLog(title, detail)
{
    nlapiLogExecution('Debug', title, detail);
}