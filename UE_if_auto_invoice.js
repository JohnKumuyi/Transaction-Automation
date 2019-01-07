function AfterSubmit(type)
{
    var currentContext = nlapiGetContext();   
    if( (currentContext.getExecutionContext() == 'scheduled') )
    { 
        return;
    }

    if (type == 'create' || type == 'edit')
    {
        var flRec = nlapiLoadRecord(nlapiGetRecordType(), nlapiGetRecordId());
        var tranDate = flRec.getFieldValue('trandate');
        var entity = flRec.getFieldValue('entity');
        var soId = flRec.getFieldValue('createdfrom');
    /*  var taxAmount = nlapiLookupField('salesorder', soId, 'custbody_tax_amount');
       if (taxAmount == null || taxAmount == undefined || taxAmount == 'undefined') {
           return;
        } */
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
                var lineObj = new Object;
                lineObj.lineNum = i;
                lineObj.itemId = itemId;
                lineObj.qty = qty;
                lineList.push(lineObj);
            }
        }

        createInvoice(tranDate, soId, lineList);
    }
    else
    {
        dLog('type', type);
    }
}

function createInvoice(flTranDate, soId, lineList)
{
    var invoiceRec = nlapiTransformRecord('salesorder', soId, 'invoice', {recordmode: 'dynamic'});
    invoiceRec.setFieldValue('trandate', flTranDate);
    var lineNum = invoiceRec.getLineItemCount('item');
    for (var i = lineNum; i >= 1; i -- )
    {   
        var itemId = invoiceRec.getLineItemValue('item', 'item', i);
        var qty = invoiceRec.getLineItemValue('item', 'quantity', i);
        var unitPrice = invoiceRec.getLineItemValue('item', 'rate', i) * 1;
        var amount = invoiceRec.getLineItemValue('item', 'amount', i) * 1;
        
        var IsExist = false;
        for (var k = 0; k < lineList.length; k ++)
        {
            var lineObj = lineList[k];
            var fl_lineNum = lineObj.lineNum;
            var fl_itemId = lineObj.itemId;
            var fl_qty = lineObj.qty;
            if (itemId == fl_itemId) {
                invoiceRec.setLineItemValue('item', 'quantity', i, fl_qty);
                IsExist = true;
            } else {
                if (amount <= 0) {
                    IsExist = true;
                }
            }
        }

        if (!IsExist)
        {
            invoiceRec.removeLineItem('item', i);
        }
    }
    var invoiceRecId = nlapiSubmitRecord(invoiceRec, true); 
    dLog('invoiceRecId', invoiceRecId);
    applyPayment(invoiceRecId);
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
 //   aracct    
//    customerpayment.setFieldValue('aracct', 116);
    var linecount = customerpayment.getLineItemCount('apply');
    for (var i = 1; i<=linecount; i++)
    {
         var refnum = customerpayment.getLineItemValue('apply','refnum', i);
         if(refnum == tranid) {
            customerpayment.setLineItemValue('apply','apply',i,'T');
         }
    }

    var cpId = nlapiSubmitRecord(customerpayment, false, true);
}


function dLog(title, detail)
{
    nlapiLogExecution('Debug', title, detail);
}