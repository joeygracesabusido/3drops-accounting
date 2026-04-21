const XLSX = require('xlsx');

const workbook = XLSX.readFile('excel/time_logs_template.xlsx', { cellDates: true });
const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
const dateVal = jsonData[1][1];

console.log("Original Date object:", dateVal.toISOString(), "Local:", dateVal.toString());
console.log("Local getDate():", dateVal.getDate());

// The trick: Excel sets it to approx midnight (local time) but due to historical offsets it might be previous day 23:59
// Add 12 hours (in ms) to the Date to push it safely into noon of the target day.
const shifted = new Date(dateVal.getTime() + 12 * 60 * 60 * 1000);
console.log("Shifted by 12 hours:", shifted.toISOString(), "Local:", shifted.toString());

// Now extract the local date components!
console.log("Target safe date parts:");
console.log("YYYY:", shifted.getFullYear());
console.log("MM:", shifted.getMonth() + 1);
console.log("DD:", shifted.getDate());

const finalDate = new Date(Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), 0, 0, 0, 0));
console.log("Final date:", finalDate.toISOString());
