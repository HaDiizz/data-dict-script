function doPost(e) {
  try {
    const spreadsheetId = "XXXXX";
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const requestBody = JSON.parse(e.postData.contents);

    if (!requestBody || !Array.isArray(requestBody)) {
      throw new Error("Invalid request body: Expected an array of tables");
    }

    const firstSheet = spreadsheet.getSheets()[0];
    firstSheet.getRange("A2:Z").clear();

    let currentSheet = firstSheet;
    let sheetIndex = 1;
    let currentRow = 2;
    const maxRowsPerSheet = 2000;

    const allColumns = currentSheet.getRange(1, 1, currentSheet.getMaxRows(), currentSheet.getMaxColumns());
    allColumns.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

    requestBody.forEach((table, tableIndex) => {
      const columnCount = 13;
      const headers = [
        "Column Name", "Datatype", "ขนาด", "Attibute Name", "etc.",
        "Default Value", "PK", "FK", "INDEX", "NULL", "UNIQUE",
        "Encrypt", "Logic Encrypt"
      ];

      const tableHeaderRows = 3;
      const dataRows = table.fields ? table.fields.length : 0;
      const spacingRow = 1;
      const totalRowsNeeded = tableHeaderRows + dataRows + spacingRow;

      if (currentRow + totalRowsNeeded > maxRowsPerSheet && tableIndex > 0) {
        sheetIndex++;
        const newSheetName = `Sheet${sheetIndex}`;

        const existingSheet = spreadsheet.getSheetByName(newSheetName);
        if (existingSheet) {
          spreadsheet.deleteSheet(existingSheet);
        }

        currentSheet = spreadsheet.insertSheet(newSheetName);
        currentRow = 2;

        const newAllColumns = currentSheet.getRange(1, 1, currentSheet.getMaxRows(), currentSheet.getMaxColumns());
        newAllColumns.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      }

      currentSheet.getRange(currentRow, 1, 1, columnCount).merge();
      currentSheet.getRange(currentRow, 1).setValue("Table: " + table.table);
      currentSheet.getRange(currentRow, 1, 1, columnCount)
        .setBackground("#1a73e8")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
      currentRow++;

      const headerRange = currentSheet.getRange(currentRow, 1, 1, columnCount);
      headerRange.setValues([headers]);
      headerRange
        .setBackground("#e8f0fe")
        .setFontColor("#1a73e8")
        .setFontWeight("bold")
        .setBorder(true, true, true, true, true, true, "#1a73e8", SpreadsheetApp.BorderStyle.SOLID);
      currentRow++;

      currentSheet.getRange(currentRow, 1).setValue("ความหมาย / คำอธิบาย");
      currentSheet.getRange(currentRow, 1, 1, columnCount)
        .setBackground("#f8f9fa")
        .setFontStyle("italic")
        .setFontColor("#5f6368");
      currentRow++;

      if (table.fields && table.fields.length) {
        const rowsData = table.fields.map((field) => [
          field["Column Name"] || "",
          field["Datatype"] || "",
          field["ขนาด"] || "",
          field["Attibute Name"] || "",
          field["etc."] || "",
          field["Default Value"] || "",
          field["PK"] === "PK" ? "TRUE" : "FALSE",
          field["FK"] === "FK" ? "TRUE" : "FALSE",
          field["INDEX"] ? "TRUE" : "FALSE",
          field["NULL"] === "NULL" ? "TRUE" : "FALSE",
          field["UNIQUE"] === "UNIQUE" ? "TRUE" : "FALSE",
          field["Encrypt"] ? "TRUE" : "FALSE",
          field["Logic Encrypt"] || "",
        ]);

        const range = currentSheet.getRange(currentRow, 1, rowsData.length, rowsData[0].length);
        range.setValues(rowsData);
        range.setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);

        const checkboxColumns = [7, 8, 9, 10, 11, 12];
        checkboxColumns.forEach((col) => {
          const checkboxRange = currentSheet.getRange(currentRow, col, rowsData.length, 1);
          const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
          checkboxRange.setDataValidation(rule);
        });

        const datatypeColumn = 2;
        const dropdownRange = currentSheet.getRange(currentRow, datatypeColumn, rowsData.length, 1);
        const datatypeOptions = [
          "varchar", "int", "boolean", "text", "date", "timestamp",
          "float", "double", "enum", "uuid", "char", "longtext",
          "tinyint", "datetime", "character", "integer", "numeric"
        ];
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(datatypeOptions)
          .build();
        dropdownRange.setDataValidation(rule);

        currentRow += rowsData.length;
      }

      currentRow++;
    });

    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      sheetsCreated: sheetIndex,
      tablesReceived: requestBody.length,
      message: `ข้อมูลถูกบันทึกใน ${sheetIndex} sheet(s) ทั้งหมด ${requestBody.length} ตาราง`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
