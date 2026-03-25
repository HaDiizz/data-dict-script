function doPost(e) {
  try {
    const spreadsheetId = "XXXXX";
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const requestBody = JSON.parse(e.postData.contents);

    // ลบข้อมูลใน sheet แรก
    const firstSheet = spreadsheet.getActiveSheet();
    firstSheet.getRange("A2:Z").clear();

    let currentSheet = firstSheet;
    let sheetIndex = 1;
    let currentRow = 2;
    const maxRowsPerSheet = 800;

    // ตั้งค่า wrap strategy สำหรับ sheet แรก
    const allColumns = currentSheet.getRange(1, 1, currentSheet.getMaxRows(), currentSheet.getMaxColumns());
    allColumns.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

    requestBody.forEach((table, tableIndex) => {
      const columnCount = 13;
      
      // คำนวณจำนวนแถวที่ table นี้จะใช้
      const tableHeaderRows = 2; // แถวหัวตารางและแถว "ความหมาย"
      const dataRows = table.fields.length;
      const spacingRow = 1; // แถวว่างหลัง table
      const totalRowsNeeded = tableHeaderRows + dataRows + spacingRow;

      // ตรวจสอบว่าต้องขึ้น sheet ใหม่หรือไม่
      if (currentRow + totalRowsNeeded > maxRowsPerSheet && tableIndex > 0) {
        // สร้าง sheet ใหม่
        sheetIndex++;
        const newSheetName = `Sheet${sheetIndex}`;
        
        // ลบ sheet ที่มีชื่อเดียวกันถ้ามี
        const existingSheet = spreadsheet.getSheetByName(newSheetName);
        if (existingSheet) {
          spreadsheet.deleteSheet(existingSheet);
        }
        
        currentSheet = spreadsheet.insertSheet(newSheetName);
        currentRow = 2;

        // คัดลอกหัวตารางจาก sheet แรก
        const headerRange = firstSheet.getRange(1, 1, 1, columnCount);
        const headerValues = headerRange.getValues();
        const headerFormats = headerRange.getBackgrounds();
        const headerFontColors = headerRange.getFontColors();
        const headerFontWeights = headerRange.getFontWeights();
        
        const newHeaderRange = currentSheet.getRange(1, 1, 1, columnCount);
        newHeaderRange.setValues(headerValues);
        newHeaderRange.setBackgrounds(headerFormats);
        newHeaderRange.setFontColors(headerFontColors);
        newHeaderRange.setFontWeights(headerFontWeights);

        // ตั้งค่า wrap strategy สำหรับ sheet ใหม่
        const newAllColumns = currentSheet.getRange(1, 1, currentSheet.getMaxRows(), currentSheet.getMaxColumns());
        newAllColumns.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      }

      // เพิ่มหัว table
      currentSheet.getRange(currentRow, 2).setValue(table.table);
      currentSheet.getRange(currentRow, 1, 1, columnCount)
        .setBackground("#2464ae")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");
      currentRow++;

      // เพิ่มแถว "ความหมาย"
      currentSheet.getRange(currentRow, 1).setValue("ความหมาย");
      currentRow++;

      // เพิ่มข้อมูล fields
      const rowsData = table.fields.map((field) => [
        field["Column Name"],
        field["Datatype"],
        field["ขนาด"],
        field["Attibute Name"],
        field["etc."],
        field["Default Value"],
        field["PK"] === "PK" ? "TRUE" : "FALSE",
        field["FK"] === "FK" ? "TRUE" : "FALSE",
        field["INDEX"] ? "TRUE" : "FALSE",
        field["NULL"] === "NULL" ? "TRUE" : "FALSE",
        field["UNIQUE"] === "UNIQUE" ? "TRUE" : "FALSE",
        field["Encrypt"] ? "TRUE" : "FALSE",
        field["Logic Encrypt"],
      ]);

      if (rowsData.length) {
        const range = currentSheet.getRange(currentRow, 1, rowsData.length, rowsData[0].length);
        range.setValues(rowsData);

        // ตั้งค่า checkbox สำหรับคอลัมน์ที่กำหนด
        const checkboxColumns = [7, 8, 9, 10, 11, 12];
        checkboxColumns.forEach((col) => {
          const checkboxRange = currentSheet.getRange(currentRow, col, rowsData.length, 1);
          const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
          checkboxRange.setDataValidation(rule);
        });

        // ตั้งค่า dropdown สำหรับคอลัมน์ datatype
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

      // เพิ่มแถวว่างหลัง table
      currentRow++;
    });

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success",
      sheetsCreated: sheetIndex,
      message: `ข้อมูลถูกบันทึกใน ${sheetIndex} sheet(s)`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}