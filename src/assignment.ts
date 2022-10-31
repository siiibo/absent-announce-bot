import {
  addDays,
  setMilliseconds,
  setSeconds,
  setMinutes,
  setHours,
  nextMonday,
  startOfWeek,
  previousMonday,
  startOfMonth,
  addMonths,
} from "date-fns";

function setMidnight(nowDate: Date) {
  const midnightDate = setMilliseconds(
    setSeconds(setMinutes(setHours(nowDate, 0), 0), 0),
    0
  );
  return midnightDate;
}

function getStartEndDate(searchPeriod: "day" | "week" | "month") {
  switch (searchPeriod) {
    case "day": {
      const startDate = setMidnight(new Date());
      const endDate = addDays(startDate, 1);
      return { start: startDate, end: endDate };
    }

    case "week": {
      const thisMonday = addDays(startOfWeek(new Date()), 1);
      const startDate = setMidnight(thisMonday);
      const endDate = setMidnight(nextMonday(new Date()));
      return { start: startDate, end: endDate };
    }

    case "month": {
      const startDate = setMidnight(startOfMonth(new Date()));
      const endDate = addMonths(startDate, 1);
      return { start: startDate, end: endDate };
    }
  }
}

function main() {
  const date1: Date = new Date();
  const date2: Date = new Date();
  date2.setDate(date2.getDate() + 1);
  const result: boolean = isSameDate(date1, date2);
  console.log(result);
  const startEndDate = getStartEndDate("month");
  console.log(startEndDate.start);
  console.log(startEndDate.end);
}
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
  );
}

main();
