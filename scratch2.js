const XLSX = require('xlsx');

const workbook = XLSX.readFile('excel/time_logs_template.xlsx', { cellDates: false });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:", jsonData[0]);
console.log("Row 1 (April 6):", jsonData[1]);
console.log("Date value without cellDates:", jsonData[1][1]);
