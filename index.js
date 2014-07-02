//
// read/parse/count hours for Calendar.app search list result
//
//
var moment = require("moment")

var infinityDate = "31 Dec 9999" // I think I wont use this program by then...
var dateFormat = "D MMM YYYY"

function convertFormattedTimeToInteger(time) {
  time = time.split(":")
  return parseInt(time[0], 10) + (parseInt(time[1], 10)/60)
}

require("fs").readFile("./data.txt", {encoding: "utf-8"}, function(err, data) {
  if (err) throw err;

  data = data.split("Scheduled: ")
  var label = data.shift().split("\n")[0]

  var totalHours = 0
  var firstDate = infinityDate
  var lastDate = 0

  var lines = [], log = []
  data.forEach(function(datetime, i) {
    datetime = datetime.split("\nLocation")[0].split(" to ")

    var date = datetime[0].slice(0, -9)
    var dateMoment = moment(date, dateFormat)
    var timestamp = dateMoment.unix()

    if (moment(firstDate, dateFormat).unix() > timestamp) firstDate = date
    if (moment(lastDate, dateFormat).unix() < timestamp) lastDate = date

    datetime[0] = datetime[0].slice(-8)

    var hours = convertFormattedTimeToInteger(datetime[1]) - convertFormattedTimeToInteger(datetime[0])
    lines.push({
      timestamp: timestamp,
      message: date + ": " + hours + " hours done"
    })
    totalHours += hours
  })

  lines.sort(function(a, b) {return a.timestamp - b.timestamp})

  console.log("\n")
  console.log(lines.map(function(line) { return line.message }).join("\n"))

  console.log("\n")
  console.log(label + " time report between " + firstDate + " to " + lastDate)
  console.log("Total hours: " + totalHours)
  console.log("Total days : " + (totalHours / 7).toFixed(2) + " (7 hours per day)" )
})
