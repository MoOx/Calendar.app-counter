/**
 * Module dependencies
 */
var moment = require("moment")

/**
 * Constantes
 */
var INFINITY_DATE = "31 Dec 9999" // I think I wont use this program by then...
var MOMENT_DATE_FORMAT = "D MMM YYYY"

var CALENDARAPP_DATE_FORMAT = "DD MMM YYYY"

/**
 * read/parse/count hours for Calendar.app search list result
 */
function parseCalendarAppClipboard(options) {
  var verbose = options.verbose || false

  require("fs").readFile("./data.txt", {encoding: "utf-8"}, function(err, data) {
    if (err) {
      throw err
    }

    data = data.split("Scheduled: ")
    var label = data.shift().split("\n")[0]

    var totalHours = 0
    var firstDate = INFINITY_DATE
    var lastDate = 0

    var lines = []
    var log = []
    var days = []
    var timestamp
    var i
    data.forEach(function(dates, i) {
      dates = dates.split("\n")[0].split(" to ")
      if (verbose) {
        console.log("dates: ", dates)
      }

      // normalize 2nd date
      if (dates[1].length === "XX:xx".length) {
        dates[1] = dates[0].slice(0, CALENDARAPP_DATE_FORMAT.length + 1) + dates[1]
      }

      if (verbose) {
        console.log("normalized dates: ", dates)
      }

      // update first & last dates
      for (i = 0; i < 2; i++) {
        var date = dates[i].slice(0, CALENDARAPP_DATE_FORMAT.length)
        days.push(date)
        var dateMoment = moment(dates[i], MOMENT_DATE_FORMAT)
        timestamp = dateMoment.unix()
        if (moment(firstDate, MOMENT_DATE_FORMAT).unix() > timestamp) {
          firstDate = date
        }
        if (moment(lastDate, MOMENT_DATE_FORMAT).unix() < timestamp) {
          lastDate = date
        }
      }

      var hours = ((new Date(dates[1]).getTime()) - (new Date(dates[0]).getTime())) / 1000 / 60 / 60
      lines.push({
        timestamp: timestamp,
        message: dates[0] + ": " + hours + " hours done"
      })
      totalHours += hours
    })

    lines.sort(function(a, b) {return a.timestamp - b.timestamp})

    console.log("\n")
    console.log(lines.map(function(line) { return line.message }).join("\n"))

    console.log("\n")
    console.log(label + " time report between " + firstDate + " to " + lastDate + " (" + (unique(days).length) + " days)")
    console.log("Total hours: " + totalHours)
    console.log("Total days : " + (totalHours / 7).toFixed(2) + " (7 hours per day)")
  })
}

/**
 * returns unique values of an array
 * @param  {Array} array
 * @return {Array}       array containing unique values
 */
function unique(array) {
  var arr = []
  var i
  for (i = 0; i < array.length; i++) {
    if (arr.indexOf(array[i]) === -1) {
      arr.push(array[i])
    }
  }
  return arr
}

/**
 * RUN
 */
parseCalendarAppClipboard({
  verbose: process.argv[2] === "-v" || process.argv[2] === "--verbose"
})
