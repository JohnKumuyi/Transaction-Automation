function scheduled( type )
{ 
    massUpdateInvoice();
}

function massUpdateInvoice()
{
  var oldRecId = 0;
  try {
      // resultIndex points to record starting current resultSet in the entire results array
      var search = nlapiLoadSearch( 'transaction', 'customsearch2953' );
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
            var recId = resultSet[i].getId();
            if (recId != oldRecId) {
                updateInvoice( resultSet[i].getRecordType(), recId );  
            }
            oldRecId = recId;

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
      nlapiLogExecution( "error", "Process Error1", error.getCode() + ":" + error.getDetails() );
    } else {
      nlapiLogExecution( "error", "Unexpected Error", error.toString() );
    }

  }

}

function updateInvoice( recType, recId )
{
  try {
    var invoiceRec = nlapiLoadRecord(recType, recId);
    nlapiSubmitRecord(invoiceRec);
  } catch ( error) {

    if ( error.getDetails != undefined ) {
      nlapiLogExecution( "error", "Process Error - Delete Lead", error.getCode() + ":" + error.getDetails() );
    } else {
      nlapiLogExecution( "error", "Unexpected Error", error.toString() );
    }

  }
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