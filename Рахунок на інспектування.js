function onCardInitialize() {
MarkCalendarTask();
}

//Скрипт 1. Вирахування ПДВ рахунку
function calculationInvoiceAmount() {
debugger
  let VATpercentage = 0;
  const attrVATAmount = EdocsApi.getAttributeValue("InvoiceVATAmount");
  const attrVATpercentage = EdocsApi.getAttributeValue("InvoiceVATPercent");
  const attrContractAmount = EdocsApi.getAttributeValue("AccountInvoice");
  const attrAmountOutVAT = EdocsApi.getAttributeValue("InvoiceAmountOutVAT");

  switch (attrVATpercentage.value) {
    case "20%": // if (x === 'если сумма НДС=20%')
      VATpercentage = 1.2;
      break;

    case "7%": // if (x === 'если сумма НДС=7%')
      VATpercentage = 1.07;
      break;
  }

  if (attrVATpercentage.value === null || attrContractAmount.value === null) {
    // если нет ставки НДС и суммы, то укажем ноль в сумме НДС и без НДС
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = 0;
  } else if (VATpercentage == 0) {
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = attrContractAmount.value;
  } else {
    attrAmountOutVAT.value = Math.floor((100 * attrContractAmount.value) / VATpercentage) / 100;
    attrVATAmount.value = attrContractAmount.value - attrAmountOutVAT.value;
  }

  EdocsApi.setAttributeValue(attrVATAmount);
  EdocsApi.setAttributeValue(attrAmountOutVAT);
}

function onChangeAccountInvoice() {
debugger
  calculationInvoiceAmount();
}

function onChangeInvoiceVATPercent() {
debugger
  calculationInvoiceAmount();
}

//Скрипт 2. Передача рахунку для ознайомлення з погодженням  в зовнішню систему
function setDataForESIGN() {
  debugger;
  const registrationDate = EdocsApi.getAttributeValue("RegDate").value;
  const registrationNumber = EdocsApi.getAttributeValue("RegNumber").value;
  const caseType = EdocsApi.getAttributeValue("DocType").value;
  const caseKind = EdocsApi.getAttributeValue("DocKind").text;
  let name = "";
  if (caseKind) {
    name += caseKind;
  } else {
    name += caseType;
  }
  name += " №" + (registrationNumber ? registrationNumber : CurrentDocument.id) + (!registrationDate ? "" : " від " + moment(registrationDate).format("DD.MM.YYYY"));
  doc = {
    DocName: name,
    extSysDocId: CurrentDocument.id,
    ExtSysDocVersion: CurrentDocument.version,
    docType: "invoice",
    docDate: registrationDate,
    docNum: registrationNumber,
    File: "",
    parties: [
      {
        taskType: "ToSign",
        taskState: "Done",
        legalEntityCode: EdocsApi.getAttributeValue("OrgCode").value,
        contactPersonEmail: EdocsApi.getAttributeValue("OrgRPEmail").value,
        signatures: [],
      },
      {
        taskType: "ToSign",
        taskState: "NotAssigned",
        legalEntityCode: EdocsApi.getAttributeValue("ContractorEDRPOU").value,
        contactPersonEmail: EdocsApi.getAttributeValue("ContractorRPEmail").value,
        expectedSignatures: [],
      },
    ],
    additionalAttributes: [
      {
        code: "docDate",
        type: "dateTime",
        value: registrationDate,
      },
      {
        code: "docNum",
        type: "string",
        value: registrationNumber,
      },
    ],
    sendingSettings: {
      attachFiles: "fixed", //, можна також встановлювати 'firstOnly' - Лише файл із першої зафіксованої вкладки(Головний файл), або 'all' - всі файли, 'fixed' - усі зафіксовані
      attachSignatures: "signatureAndStamp", // -'signatureAndStamp'Типи “Підпис” або “Печатка”, можна також встановити 'all' - усі типи цифрових підписів
    },
  };
  EdocsApi.setAttributeValue({ code: "JSON", value: JSON.stringify(doc) });
}

function onTaskExecuteSendOutDoc(routeStage) {
  debugger;
  if (routeStage.executionResult == "rejected") {
    return;
  }
  setDataForESIGN();
  const idnumber = EdocsApi.getAttributeValue("DocId");
  const methodData = {
    extSysDocId: idnumber.value,
  };

  routeStage.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1", // код зовнішньої системи
    externalSystemMethod: "integration/importDoc", // метод зовнішньої системи
    data: methodData, // дані, що очікує зовнішня система для заданого методу
    executeAsync: true, // виконувати завдання асинхронно
  };
}

function onTaskCommentedSendOutDoc(caseTaskComment) {
  debugger;
  const orgCode = EdocsApi.getAttributeValue("OrgCode").value;
  const orgShortName = EdocsApi.getAttributeValue("OrgShortName").value;
  if (!orgCode || !orgShortName) {
    return;
  }
  const idnumber = EdocsApi.getAttributeValue("DocId");
  const methodData = {
    extSysDocId: idnumber.value,
    eventType: "CommentAdded",
    comment: caseTaskComment.comment,
    partyCode: orgCode,
    userTitle: CurrentUser.name,
    partyName: orgShortName,
    occuredAt: new Date(),
  };

  caseTaskComment.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1", // код зовнішньої системи
    externalSystemMethod: "integration/processEvent", // метод зовнішньої системи
    data: methodData, // дані, що очікує зовнішня система для заданого методу
    executeAsync: true, // виконувати завдання асинхронно
  };
}

//Скрипт 3. Обов’язковість заповнення поля
function onTaskExecuteMarkCalendar(routeStage) {
  debugger;
  if (routeStage.executionResult == "executed") {
    sendComment(routeStage);
  }
}


function sendComment(routeStage) {
  debugger;
  var orgCode = EdocsApi.getAttributeValue("OrgCode").value;
  var orgShortName = EdocsApi.getAttributeValue("OrgShortName").value;
  if (!orgCode || !orgShortName) {
    return;
  }
  const NumberContract = EdocsApi.getAttributeValue("NumberContract");
  const DateContract = EdocsApi.getAttributeValue("DateContract").value;
  const InspectionDate = EdocsApi.getAttributeValue("InspectionDate").value;
  var comment = `Доброго дня! Повідомляємо, що на виконання Договору про надання послуг інспектування № ${NumberContract.value ? NumberContract.value : " "} від ${DateContract ? ( new Date(DateContract).getDate()<10 ? '0'+new Date(DateContract).getDate() : new Date(DateContract).getDate())+'-'+ (new Date(DateContract).getMonth()<10? '0'+new Date(DateContract).getMonth() : new Date(DateContract).getMonth())+'-'+new Date(DateContract).getFullYear() : " "}, призначена наступна дата інспектування – ${new Date(InspectionDate ).getDate()}-${new Date(InspectionDate ).getMonth()<10? '0'+new Date(InspectionDate ).getMonth():new Date(InspectionDate ).getMonth()}-${new Date(InspectionDate ).getFullYear()}. З повагою, Філія «НДКТІ» АТ «Укрзалізниця».`;

  var methodData = {
    extSysDocId: CurrentDocument.id,
    eventType: "CommentAdded",
    comment: comment,
    partyCode: orgCode,
    userTitle: CurrentUser.name,
    partyName: orgShortName,
    occuredAt: new Date(),
  };
  routeStage.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1",
    externalSystemMethod: "integration/processEvent",
    data: methodData,
    executeAsync: false,
  };
}

function MarkCalendarTask() {
  debugger;
  const stateTask = EdocsApi.getCaseTaskDataByCode("MarkCalendar").state;
  switch (stateTask) {
    case "draft":
      controlRequired("InspectionDate", false);
     controlDisabled("InspectionDate");
      controlHidden("InspectionDate");
      break;

    case "assigned":
      controlDisabled("InspectionDate", false);
     controlRequired("InspectionDate");
      controlHidden("InspectionDate", false);
      break;

    case "inProgress":
      controlDisabled("InspectionDate", false);
      controlRequired("InspectionDate");
      controlHidden("InspectionDate", false);
      break;
 
    case "completed":
      controlDisabled("InspectionDate");
      controlHidden("InspectionDate", false);
      setDataForLetter();
      break;

    default:
      break;
  }
}

 

function controlHidden(CODE, hidden = true) {
  const control = EdocsApi.getControlProperties(CODE);
  control.hidden = hidden;
  EdocsApi.setControlProperties(control);
}

function controlDisabled(CODE, disabled= true) {
  const control = EdocsApi.getControlProperties(CODE);
  control.disabled= disabled;
  EdocsApi.setControlProperties(control);
}
function controlRequired(CODE, required= true) {
  const control = EdocsApi.getControlProperties(CODE);
  control.required= required;
  EdocsApi.setControlProperties(control);
}

// Скрипт 4. Інформування Контрагента про дату інспектування
function setDataForLetter() {
  debugger;

  const NumberContract = EdocsApi.getAttributeValue("NumberContract");
  const DateContract = EdocsApi.getAttributeValue("DateContract");
  const InspectionDate = EdocsApi.getAttributeValue("InspectionDate");
  const to = EdocsApi.getAttributeValue("ContractorRPEmail").value;

EdocsApi.edocsSendDocByEmail({
subject: 'Призначення дати інспектування',
text: `<html><body> Доброго дня!<br>Повідомляємо, що на виконання Договору про надання послуг інспектування № ${NumberContract.value ? NumberContract.value : " "}<br> від ${DateContract.value ? DateContract.value : " "}, призначена наступна дата інспектування – ${InspectionDate.value ? InspectionDate.value : " "}+<br><br><br>З повагою,<br>Філія «НДКТІ»<br>АТ «Укрзалізниця»<br></body></html>`,
separateMessages: "false",
ecipients: to ? to.split(";") : [],
});




  //const bodyText = `<html><body> Доброго дня!<br>Повідомляємо, що на виконання Договору про надання послуг інспектування № ${NumberContract.value ? NumberContract.value : " "}<br> від ${DateContract.value ? DateContract.value : " "}, //призначена наступна дата інспектування – ${InspectionDate.value ? InspectionDate.value : " "}+<br><br><br>З повагою,<br>Філія «НДКТІ»<br>АТ «Укрзалізниця»<br></body></html>`;
//  const doc = {
 //   recipients: to ? to.split(";") : [],
   // subject: subject,
  //  body: bodyText,
//  };
//  EdocsApi.setAttributeValue({ code: "JSON", value: JSON.stringify(doc) });
}