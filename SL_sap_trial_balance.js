var accountPeriodList = new Object;
function main( request, response )
{
/*
    var search = nlapiLoadSearch('account', 'customsearch3339');
    var cols = search.getColumns();
    for (var i = 0; i < cols.length; i ++) {
        response.writeLine(cols[i]);
    }
    return;
*/
    var userId = nlapiGetUser();

    var subsidiary = request.getParameter('subsidiary');
  //  var fromYear = request.getParameter('from_year');
  //  var fromMonth = request.getParameter('from_month');
    var toYear = request.getParameter('to_year');
    var toMonth = request.getParameter('to_month');
    var subsidiary = request.getParameter('subsidiary');
    
    var fromYear = 2015; 
    var fromMonth = 1; 
    accountPeriodList = getAccountingPeriodIdList();    
    if (toYear && toMonth && subsidiary) {
        var acctTxnList = processAcctTxn(fromYear, fromMonth, toYear, toMonth, subsidiary);
        var html = makeHtml(acctTxnList, subsidiary, userId);
        var form = makePage(html, fromYear, fromMonth, toYear, toMonth, subsidiary);
        response.writePage(form);    
    } else {
        subsidiary = '' + 2;
        toYear = 2018; toMonth = 8;
        var acctTxnList = processAcctTxn(fromYear, fromMonth, toYear, toMonth, subsidiary);
        var html = makeHtml(acctTxnList, subsidiary, userId);
        var form = makePage(html, fromYear, fromMonth, toYear, toMonth, subsidiary);
        response.writePage(form);
    }
}

var monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function makePage(reportHtml, fromYear, fromMonth, toYear, toMonth, subsidiary)
{
    var form = nlapiCreateForm('ELC Account Trial Balance');
    form.setScript('customscript151');
    
    var filterGroup = form.addFieldGroup( 'filter_group', 'Report Filters');

    var fromDateFldLbl = form.addField('from_date_label','inlinehtml', 'From', null, 'filter_group');
    fromDateFldLbl.setLayoutType('outsidebelow','startcol')
    fromDateFldLbl.setDefaultValue( '<div style="display: inline-flex;padding-left: 5px; font-size: 10pt;padding-right: 5px;align-items:  center;color: rgb(100,100,100);">From</div>' );
    var fromDateFld = form.addField('from_date','select', '', null, 'filter_group');
    fromDateFld.setLayoutType('outsidebelow','startcol')
    fromDateFld.addSelectOption(0, "");
    fromDateFldLbl.setDisplayType('hidden');
    fromDateFld.setDisplayType('hidden');

    var toDateFldLbl = form.addField('to_date_label','inlinehtml', 'To', null, 'filter_group');
    toDateFldLbl.setLayoutType('outsidebelow','startcol')
    toDateFldLbl.setDefaultValue( '<div style="display: inline-flex;padding-left: 30px; font-size: 10pt;padding-right: 5px;align-items:  center; color: rgb(100,100,100);">AS OF</div>' );
    var toDateFld = form.addField('to_date','select', '', null, 'filter_group');
    toDateFld.setLayoutType('outsidebelow','startcol')
    toDateFld.addSelectOption(0, "");
    
    var subsidiaryFldLbl = form.addField('subsidiary_label','inlinehtml', 'Subsidiary', null, 'filter_group');
    subsidiaryFldLbl.setLayoutType('outsidebelow','startcol')
    subsidiaryFldLbl.setDefaultValue( '<div style="display: inline-flex;padding-left: 6px; font-size: 10pt;padding-right: 5px;align-items:  center; color: rgb(100,100,100);">Subsidiary</div>' );
    var subsidiaryFld = form.addField('subsidiary','select', '', null, 'filter_group');
    var subsidiaryList = populateSubsidiary();
    subsidiaryFld.addSelectOption('-10', 'Becca (Consolidated)');
    for (var i = 0; i < subsidiaryList.length; i ++)
    {
         var subsidiaryObj = subsidiaryList[i];
         subsidiaryFld.addSelectOption(subsidiaryObj.internalId, subsidiaryObj.name); //subsidiaryObj.name
    }
    subsidiaryFld.setLayoutType('outsidebelow','startcol')
    subsidiaryFld.setDefaultValue(subsidiary);
    
    var refreshBtn = form.addField('refresh_html','inlinehtml', 'Refresh', null, 'filter_group');
    refreshBtn.setLayoutType('outsidebelow','startcol')
    refreshBtn.setDefaultValue( '<div style="display: inline-flex;margin-left: 60px;padding-right: 5px;align-items:  center;color: rgb(100,100,100);"><button id="refresh_btn" style="cursor:pointer; font-size: 11pt;font-weight: bold;width: 110px;color: rgb(110, 110, 110);">Refresh</button></div>' );
    var excelExportBtn = form.addField('excel_export_html','inlinehtml', 'Excel Export', null, 'filter_group');
    excelExportBtn.setLayoutType('outsidebelow','startcol')
    excelExportBtn.setDefaultValue( '<div style="display: inline-flex;margin-left: 20px;padding-right: 5px;align-items:  center;color: rgb(100,100,100);"><button id="excel_export_btn" style="cursor:pointer; font-size: 11pt;font-weight: bold;width: 110px;color: rgb(110, 110, 110);">Excel Export</button></div>' );
    
    var mainGroup = form.addFieldGroup( 'main_group', 'ELC Trial Balance Report Data');
    var reportData = form.addField('report_data', 'inlinehtml', 'REPORT DATA', null, 'main_group');
    reportData.setDefaultValue( reportHtml );

    var nowDate = new Date();
    var estDate = new Date( nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate(), nowDate.getUTCHours()-4, nowDate.getUTCMinutes(), nowDate.getUTCSeconds() );
    var lastYear = estDate.getFullYear();
    var lastMonth = estDate.getMonth();
    
    var year = 2015;
    var month = 0;
    do{
        var strOpt = getOption(year, month);
        var index = '' + year + '_' + (month * 1 + 1); 
     
        fromDateFld.addSelectOption(index, strOpt);
        toDateFld.addSelectOption(index, strOpt);
        month ++;
        if (month > 11) {
            month = 0;
            year ++;
        }
    }while(year <= lastYear)
    
    var fromDateVal = fromYear + "_"  + fromMonth;
    var toDateVal = toYear + "_"  + toMonth; 
    fromDateFld.setDefaultValue(fromDateVal);
    toDateFld.setDefaultValue(toDateVal);

    return form;
}

function  getOption(year, month)
{
    var quarter = 1;
 /*   if (month > 5) {
        year += 1;
    } */
    if (month >= 0 && month <= 2) {
        quarter = 3;
    } else if (month >= 3 && month <= 5) {
        quarter = 4;
    } else if (month >= 6 && month <= 6) {
        quarter = 1;
    } else if (month >= 9 && month <= 11) {
        quarter = 2;
    }

    var strPeriod = '';
    strPeriod = /*'Q' + quarter + ' ' +*/ monthArr[month] + ' ' + year;
    return strPeriod;   
}

function getAccountingPeriodIdList()
{
    var tmpObj = new Object;

    var columns = [];
    columns[0] = new nlobjSearchColumn('periodname', null, null);
    var searchResults = nlapiSearchRecord('accountingperiod', null, null, columns);
    if (searchResults) {
        for (var i = 0; i < searchResults.length; i ++) {
            var id = searchResults[i].getId();
            var name = searchResults[i].getValue(columns[0]);
            tmpObj[name] = id;
        }
    }

    return tmpObj;
}

function populateSubsidiary()
{
    var subsidiaryList = [];
    var filters = [];
    filters[0] = new nlobjSearchFilter( 'isinactive', null, 'is', 'F' );

    var columns = [];
    columns[0] = new nlobjSearchColumn( 'name' );
     
    var searchresults = nlapiSearchRecord( 'subsidiary', null, filters, columns );
    if ( searchresults != null && searchresults.length > 0 ) 
    {
        for (var i = 0; i < searchresults.length; i ++)
        {
            var element = searchresults[i];
            var subsidiaryObj = new Object;
            subsidiaryObj.internalId = element.getId();
            subsidiaryObj.name = element.getValue(columns[0]);
            subsidiaryList.push(subsidiaryObj);
        }
    }

    return subsidiaryList;
}

function makeHtml(acctTxnList, subsidiary, userId)
{
    var html = "";
    html += "<style>";
    html += ".report_bold_cell{font-weight: bold}";
    html += ".report_head_cell{font-weight: normal; background-color: #e0e6ef; min-width:70px}";
    html += ".report_align_cell{padding-left: 8px; padding-right: 8px;}";
    html += ".title_row{display:none}";
    html += "</style>";
    html += "<table id='tbl_obj' style='border-collapse: collapse;'>";
    html += "<tr class='title_row' style='font-weight:bold; font-size: 14pt;'><td style='text-align:center;' colspan=5>ELC Trial Balance Report</td></tr>";
    html += "<tr style='height: 26px'>";
        html += "<td class='report_head_cell report_align_cell' style='border-right: solid 1px rgb(199, 199, 199);'>GL ACCOUNT NAME</td>";
        html += "<td class='report_head_cell report_align_cell' style='border-right: solid 1px rgb(199, 199, 199);'>SAP ACCOUNT</td>";
        html += "<td class='report_head_cell report_align_cell' style='border-right: solid 1px rgb(199, 199, 199);'>CC RULE</td>";
        html += "<td class='report_head_cell report_align_cell' style='border-right: solid 1px rgb(199, 199, 199);'>TRADING PARTNER</td>";
        html += "<td class='report_head_cell report_align_cell' style='border-right: solid 1px rgb(199, 199, 199);'>BALANCE</td>";
    html += "</tr>";
    for ( var i = 0; i < acctTxnList.length; i ++ ) {
          var element = acctTxnList[i];
          var nsAcctName = element.ns_account_name;
          var sapAcctName = element.sap_account_name;
          var ccRule = element.cc_rule;
          var tradingPartner = element.trading_partner;
          var balance = element.balance;
          var ccRuleArr = element.ccRuleArr;
 
          html += "<tr>";
              html += "<td class='report_align_cell'>" + nsAcctName + "</td>";
              html += "<td class='report_align_cell'>" + sapAcctName + "</td>";
              html += "<td class='report_align_cell'>" + ccRule + "</td>";
              html += "<td class='report_align_cell'>" + tradingPartner + "</td>";
              html += "<td class='report_align_cell'>$" + addCommas(parseFloat(balance).toFixed(2)) + "</td>";
          html += "</tr>";
          
          for (var j = 0; j < ccRuleArr.length; j ++) {
              var ccm = ccRuleArr[j].ccm;
              var amount = ccRuleArr[j].amount;
              html += "<tr>";
                  html += "<td class='report_align_cell'>" + nsAcctName + "</td>";
                  html += "<td class='report_align_cell'>" + sapAcctName + "</td>";
                  html += "<td class='report_align_cell'>" + ccm + "</td>";
                  html += "<td class='report_align_cell'>" + tradingPartner + "</td>";
                  html += "<td class='report_align_cell'>$" + addCommas(parseFloat(amount).toFixed(2)) + "</td>";
              html += "</tr>";
          }
    }
    html += "</table>";
            
    return html;
}

function processAcctTxn(fromYear, fromMonth, toYear, toMonth, subsidiary)
{
    var sapAcctMapList = loadSAPAcctMap(subsidiary);
    var transListObj = loadTransaction(fromYear, fromMonth, toYear, toMonth, subsidiary, sapAcctMapList);

    for (var i = 0; i < sapAcctMapList.length; i ++) {
        var element = sapAcctMapList[i];
        var ns_account_id = element.ns_account_id;
        var cc_rule = element.cc_rule;
        var transCCRuleArr = transListObj[ns_account_id];
        element.ccRuleArr = [];
        if (transCCRuleArr != undefined && transCCRuleArr != 'undefined') {
            element.balance = sumCCRule(transCCRuleArr);
            if (cc_rule == 'Various') {
                element.ccRuleArr = transCCRuleArr;
            }
        }
    }

    return sapAcctMapList;
}

function sumCCRule(transCCRuleArr)
{
    var total = 0;
    for (var i = 0; i < transCCRuleArr.length; i ++) {
        var element = transCCRuleArr[i];
        total += element.amount;
    }

    return total;
}

function loadSAPAcctMap(subsidiary)
{
    var tmpArr = [];
 
    var filters = [];
    if (subsidiary != -10) {
        filters.push( new nlobjSearchFilter('subsidiary', null, 'anyof', [subsidiary]) ); 
    }
    
//    filters.push( new nlobjSearchFilter('custrecord_ns_acct_vs_sap_acct', null, 'noneof', ['@NONE@']) ); 
//    filters.push( new nlobjSearchFilter('balance', null, 'greaterthan', [0.00, null]) ); 
    var cols = [];
    cols.push( new nlobjSearchColumn('name', null, null) );
    cols.push( new nlobjSearchColumn('custrecord_ns_acct_vs_sap_acct', null, null) );
    cols.push( new nlobjSearchColumn('custrecord_sap_cc_rule', null, null) );
    cols.push( new nlobjSearchColumn('custrecord_account_number', 'CUSTRECORD_NS_ACCT_VS_SAP_ACCT', null) );
    cols.push( new nlobjSearchColumn('custrecord_account_name', 'CUSTRECORD_NS_ACCT_VS_SAP_ACCT', null ) );
    cols.push( new nlobjSearchColumn('custrecord_trading_partner', null, null ) );
    cols.push( new nlobjSearchColumn('balance', null, null ) );
    cols.push( new nlobjSearchColumn('number', null, null) );
    
    cols[0].setSort();
    cols[1].setSort();
    cols[2].setSort();

    var results = nlapiSearchRecord( 'account', null, filters, cols );

    if (results && results.length > 0)
    {   
    //    var cols = results[0].getAllColumns();
        for (var i = 0; i < results.length; i ++) 
        {
            var element = results[i];
            var ns_account_id = element.getId();
            var ns_account_name = element.getValue(cols[0]);
            var sap_account_id = element.getValue(cols[1]);
            var sap_account_name = element.getText(cols[1]);
            var cc_rule = element.getValue(cols[2]);
            var sap_account_number = element.getValue(cols[3]);
            var sap_account_title = element.getValue(cols[4]);
            var trading_partner = element.getValue(cols[5]);
            var balance = element.getValue(cols[6]);
            var ns_account_number = element.getValue(cols[7]);

            var mapKeyObj = new Object;
            mapKeyObj.ns_account_id = ns_account_id;
            mapKeyObj.ns_account_name = ns_account_name;
            mapKeyObj.ns_account_number = ns_account_number;
            mapKeyObj.sap_account_id = sap_account_id;
            mapKeyObj.sap_account_name = sap_account_name;
            mapKeyObj.sap_account_number = sap_account_number;
            mapKeyObj.sap_account_title = sap_account_title;
            mapKeyObj.cc_rule = cc_rule;
            mapKeyObj.trading_partner = trading_partner;
            mapKeyObj.balance = 0;

            tmpArr.push(mapKeyObj);
        }
    }

    return tmpArr;
}

function getPeriodFilterArr(fromYear, fromMonth, toYear, toMonth)
{
    var periodFilters = [];
    var year = fromYear * 1;
    var month = fromMonth * 1;
    do{
        var strPeriod = monthArr[month - 1] + ' ' + year;
        var periodId = accountPeriodList[strPeriod];
        if (periodId != undefined && periodId != 'undefined') {
            periodFilters.push(new Array('postingperiod', 'abs', [periodId]));    
            periodFilters.push('OR');    
        }
        month ++;
        if (year < toYear) {
            if (month > 12) {
                month = 1;
                year ++;
            }
        } else {
            if (month > toMonth) {
                break;
            }
        }
    }while(year <= toYear)


    if (periodFilters.length > 1) {
        periodFilters.pop();
    }

    return periodFilters;
}

function loadTransaction(fromYear, fromMonth, toYear, toMonth, subsidiary, sapAcctMapList)
{
    var fiscalFromYear = toYear;
    var fiscalFromMonth = 7;
    if (toMonth <= 6) {
        fiscalFromYear = toYear - 1;
    }

    var nsAcctArr_PL = [];
    var nsAcctArr_Other = [];
    for (var i = 0; i < sapAcctMapList.length; i ++) {
        var element = sapAcctMapList[i];
        var ns_account_id = element.ns_account_id;
        var ns_account_number = element.ns_account_number * 1;
        if ( ns_account_number >= 40000 && ns_account_number <= 99999 ) {
            nsAcctArr_PL.push(ns_account_id);
        } else {
            nsAcctArr_Other.push(ns_account_id);
        }
    }

    var period_PL = getPeriodFilterArr(fiscalFromYear, fiscalFromMonth, toYear, toMonth);
    var period_Other = getPeriodFilterArr(fromYear, fromMonth, toYear, toMonth);
    
    
  
    var filters_PL = [];
    filters_PL.push(new Array('account', 'anyof', nsAcctArr_PL));
    filters_PL.push('AND');
    filters_PL.push(period_PL);

    var filters_Other = [];
    filters_Other.push(new Array('account', 'anyof', nsAcctArr_Other));
    filters_Other.push('AND');
    filters_Other.push(period_Other);

    var subFilters = [];
    subFilters.push(filters_PL);
    subFilters.push('OR');
    subFilters.push(filters_Other);

    var filters = [];
    filters.push(new Array('accounttype', 'noneof', ['@NONE@']));
    filters.push('AND');
    filters.push(new Array('posting', 'is', ['T']));
    filters.push('AND');
    if (subsidiary != -10) {
        filters.push(new Array('subsidiary', 'anyof', [subsidiary]));
        filters.push('AND');        
    }

    filters.push(subFilters);    
    
    dLog('filters', JSON.stringify(filters));
  
    var cols = [];
    cols.push( new nlobjSearchColumn('account', null, 'GROUP') );
    cols.push( new nlobjSearchColumn('custrecord_sap_ccm', 'department', 'GROUP') );
    cols.push( new nlobjSearchColumn('amount', null, 'SUM') );
    
    cols[0].setSort();
    cols[1].setSort();
    cols[2].setSort();

    var transListObj = new Object;
    var oldNSAcctId = 0;
    var ccmArr = [];
    var results = nlapiSearchRecord( 'transaction', null, filters, cols );

    if (results && results.length > 0)
    {       
        for ( var i = 0; i < results.length; i++ ) {
            var element = results[i];
            var nsAccountId = element.getValue(cols[0]) * 1;
            var ccm = element.getValue(cols[1]);
            var amount = element.getValue(cols[2]) * 1;

            var transObj = new Object;
            transObj.ccm = ccm;
            transObj.amount = amount;
                
            if (nsAccountId != oldNSAcctId) {
                ccmArr = [];
            }
            ccmArr.push(transObj);
            transListObj[nsAccountId] = ccmArr;

            oldNSAcctId = nsAccountId;
        }
    }
    
    return transListObj;
}

function addCommas(nStr)
{
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    
    if (isNaN(parseInt(x1 + x2)) == false) {
                    return x1 + x2;
                } else {
                    return 0.00;
                }
}

function dLog(title, detail)
{
    nlapiLogExecution('Debug', title, detail);
}