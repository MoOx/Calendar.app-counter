/**
 * Calendar.app clipboard parser
 * Supports both English and French formats
 */

import moment = require('moment');
import { readFile } from 'fs/promises';

/**
 * Configuration and constants
 */
const INFINITY_DATE = '31 Dec 9999';
const MOMENT_DATE_FORMAT = 'D MMM YYYY';

interface ParsedEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  rawText: string;
}

interface ParseOptions {
  verbose?: boolean;
  filePath?: string;
}

interface ParseResult {
  label: string;
  events: ParsedEvent[];
  totalHours: number;
  firstDate: string;
  lastDate: string;
  uniqueDays: number;
}

/**
 * Utility function to remove time from date string
 */
function withoutTime(dateString: string): string {
  return dateString.replace(/ [0-9]{2}:[0-9]{2}/, '');
}

/**
 * Utility function to get unique values from array
 */
function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Parse French month abbreviations to English
 */
function normalizeFrenchMonth(dateStr: string): string {
  return dateStr
    .replace(/avr\./gi, 'Apr')
    .replace(/mai/gi, 'May')
    .replace(/juin/gi, 'Jun')
    .replace(/janv\./gi, 'Jan')
    .replace(/févr\./gi, 'Feb')
    .replace(/mars/gi, 'Mar')
    .replace(/juil\./gi, 'Jul')
    .replace(/août/gi, 'Aug')
    .replace(/sept\./gi, 'Sep')
    .replace(/oct\./gi, 'Oct')
    .replace(/nov\./gi, 'Nov')
    .replace(/déc\./gi, 'Dec');
}

/**
 * Parse date range from English format
 * Example: "03 Jul 2014 10:00 to 14:00"
 */
function parseEnglishFormat(dateRange: string): { start: string; end: string } | null {
  const parts = dateRange.split(' to ');
  if (parts.length !== 2) return null;

  let [start, end] = parts;

  // Handle case where end time is just time (same day)
  if (end.length <= 5 && end.includes(':')) { // Format: "XX:XX" or "XX:" or "X:XX"
    // Ensure proper time format
    if (end.endsWith(':')) {
      end = end + '00'; // Convert "14:" to "14:00"
    }
    if (end.length === 4 && end.includes(':')) {
      end = '0' + end; // Convert "8:00" to "08:00"
    }
    end = withoutTime(start) + ' ' + end;
  }

  return { start: start.trim(), end: end.trim() };
}

/**
 * Parse date range from French format
 * Example: "28 avr. 2025 à 11:00-12:30, UTC+2"
 */
function parseFrenchFormat(dateRange: string): { start: string; end: string } | null {
  // Remove timezone info
  const cleanRange = dateRange.replace(/, UTC[+-]\d+/, '').trim();
  
  // Extract date and time range - handle unicode "à"
  const match = cleanRange.match(/^(.+?)\s+[àa]\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) {
    return null;
  }

  const [, datePart, startTime, endTime] = match;
  const normalizedDate = normalizeFrenchMonth(datePart.trim());

  return {
    start: `${normalizedDate} ${startTime}`,
    end: `${normalizedDate} ${endTime}`
  };
}

/**
 * Parse a single event entry
 */
function parseEvent(eventText: string, verbose: boolean = false): ParsedEvent | null {
  const lines = eventText.trim().split('\n');
  if (lines.length < 2) return null;

  const title = lines[0].trim();
  let dateRange: { start: string; end: string } | null = null;

  // Try to find date information in any line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // English format: "Scheduled: ..."
    if (line.startsWith('Scheduled:')) {
      const rangeText = line.replace(/^Scheduled:\s*/, '');
      dateRange = parseEnglishFormat(rangeText);
      if (dateRange) break;
    }
    
    // French format: "Dates : ..." (note the space after colon)
    // Handle both regular space and non-breaking space (\u00A0)
    if (line.startsWith('Dates') && (line.includes(' : ') || line.includes('\u00A0: ') || line.includes(': '))) {
      const rangeText = line.replace(/^Dates[\s\u00A0]*:[\s\u00A0]*/, '');
      dateRange = parseFrenchFormat(rangeText);
      if (dateRange) break;
    }
  }

  if (!dateRange) {
    if (verbose) {
      console.log('Could not parse date range from:', eventText);
    }
    return null;
  }

  if (verbose) {
    console.log('Parsed date range:', dateRange);
  }

  try {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      if (verbose) {
        console.log('Invalid dates:', dateRange);
      }
      return null;
    }

    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    return {
      title,
      startDate,
      endDate,
      hours,
      rawText: eventText
    };
  } catch (error) {
    if (verbose) {
      console.log('Error parsing dates:', error);
    }
    return null;
  }
}

/**
 * Main parsing function
 */
async function parseCalendarAppClipboard(options: ParseOptions = {}): Promise<ParseResult> {
  const { verbose = false, filePath = './data.txt' } = options;

  try {
    const data = await readFile(filePath, { encoding: 'utf-8' });
    
    // Split by common patterns to separate events
    let events: string[] = [];
    
    // Try splitting by English pattern first
    if (data.includes('Scheduled: ')) {
      events = data.split(/\n\n+/).filter((e: string) => e.trim() && e.includes('Scheduled:'));
    }
    // Try splitting by French pattern
    else if (data.includes('Dates : ')) {
      events = data.split(/\n\n+/).filter((e: string) => e.trim() && e.includes('Dates :'));
    }
    else {
      // Fallback: split by double newlines
      events = data.split(/\n\s*\n/).filter((e: string) => e.trim());
    }

    if (verbose) {
      console.log(`Found ${events.length} event blocks`);
    }

    const parsedEvents: ParsedEvent[] = [];
    const days: string[] = [];
    let totalHours = 0;
    let firstDate = INFINITY_DATE;
    let lastDate = '0';

    for (const eventText of events) {
      const event = parseEvent(eventText, verbose);
      if (event) {
        parsedEvents.push(event);
        totalHours += event.hours;

        // Track dates for summary
        const startDateStr = withoutTime(moment(event.startDate).format(MOMENT_DATE_FORMAT));
        const endDateStr = withoutTime(moment(event.endDate).format(MOMENT_DATE_FORMAT));
        
        days.push(startDateStr, endDateStr);

        const startTimestamp = moment(event.startDate).unix();
        const endTimestamp = moment(event.endDate).unix();

        if (moment(firstDate, MOMENT_DATE_FORMAT).unix() > startTimestamp) {
          firstDate = startDateStr;
        }
        if (moment(lastDate, MOMENT_DATE_FORMAT).unix() < endTimestamp) {
          lastDate = endDateStr;
        }
      }
    }

    // Sort events by start date
    parsedEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const label = parsedEvents.length > 0 ? parsedEvents[0].title : 'Unknown';

    return {
      label,
      events: parsedEvents,
      totalHours,
      firstDate,
      lastDate,
      uniqueDays: unique(days).length
    };

  } catch (error) {
    throw new Error(`Failed to parse calendar data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Display results in console
 */
function displayResults(result: ParseResult, verbose: boolean = false): void {
  console.log('\n');
  
  // Display individual events
  result.events.forEach(event => {
    const startStr = moment(event.startDate).format('DD MMM YYYY HH:mm');
    console.log(`${startStr}: ${event.hours.toFixed(2)} hours done`);
  });

  console.log('\n');
  console.log(
    `${result.label} time report between ${result.firstDate} to ${result.lastDate} ` +
    `(${result.uniqueDays} days)`
  );
  console.log(`Total hours: ${result.totalHours.toFixed(2)}`);
  console.log(`Total days : ${(result.totalHours / 7).toFixed(2)} (7 hours per day)`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');
  
  // Check if user provided a file path
  const fileArg = process.argv.find(arg => arg.startsWith('--file='));
  const filePath = fileArg ? fileArg.split('=')[1] : './data.txt';
  
  try {
    const result = await parseCalendarAppClipboard({ verbose, filePath });
    displayResults(result, verbose);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

export { parseCalendarAppClipboard, ParseOptions, ParseResult, ParsedEvent };
