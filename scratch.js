const XLSX = require('xlsx');

const workbook = XLSX.readFile('excel/time_logs_template.xlsx', { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:", jsonData[0]);
console.log("Row 1 (April 6):", jsonData[1]);

if (jsonData[1] && jsonData[1][1]) {
  const dateVal = jsonData[1][1];
  console.log("Date type:", typeof dateVal);
  if (dateVal instanceof Date) {
    console.log("Date toString:", dateVal.toString());
    console.log("Date toISOString:", dateVal.toISOString());
    console.log("Local parts:", dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
    console.log("UTC parts:", dateVal.getUTCFullYear(), dateVal.getUTCMonth(), dateVal.getUTCDate());
  } else {
    console.log("Value:", dateVal);
  }
}
