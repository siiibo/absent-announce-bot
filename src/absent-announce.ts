import { GasWebClient as SlackClient } from "@hi-se/web-api";
import {
  addDays,
  set,
  nextMonday,
  startOfWeek,
  startOfMonth,
  addMonths,
  format,
} from "date-fns";

export const deleteAndSetTriggers = () => {
  const triggeredFunction = "main";
  deleteTriggers(triggeredFunction);
  const today = new Date();
  const triggerTime = "9:00";
  const triggerHour = Number(triggerTime.split(":")[0]);
  const triggerMinute = Number(triggerTime.split(":")[1]);
  today.setHours(triggerHour, triggerMinute);
  setTrigger(triggeredFunction, today);
};

const deleteTriggers = (triggeredFunction: string) => {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() !== triggeredFunction) return;
    ScriptApp.deleteTrigger(trigger);
  });
};

const setTrigger = (triggeredFunction: string, date: Date) => {
  ScriptApp.newTrigger(triggeredFunction).timeBased().at(date).create();
};

export const main = () => {
  const slackAppToken =
    PropertiesService.getScriptProperties().getProperty("SLACK_APP_TOKEN");
  if (!slackAppToken) throw new Error("SLACK_APP_TOKEN is not defined");

  const calendarIds = getSlackMember(slackAppToken);
  // const calendarIds = ["masaya.hirose@siiibo.com", "yukiko.orui@siiibo.com"];

  const searchWord = /休暇/;
  const postSlackChannel = "#attendance";
  // const postSlackChannel = "#sysadm_test";
  type SearchPeriod = "day" | "week" | "month";
  const searchPeriod: SearchPeriod = "day";
  const startEndDate = getStartEndDate(searchPeriod);
  const startDate = startEndDate.start;
  const endDate = startEndDate.end;
  console.log("startdate", startDate);
  console.log("enddate", endDate);

  const displayMessage = getMessagesfromCalender(
    calendarIds,
    searchWord,
    startDate,
    endDate
  );
  console.log(displayMessage);

  const client = getSlackClient(slackAppToken);

  if (displayMessage !== undefined) {
    client.chat.postMessage({
      channel: postSlackChannel,
      text: displayMessage,
    });
  }
};

const getSlackMember = (slackAppToken: string): string[] => {
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    contentType: "application/x-www-form-urlencoded",
    payload: {
      token: slackAppToken,
    },
  };

  const emailList = [];
  const url = "https://slack.com/api/users.list";
  const response = UrlFetchApp.fetch(url, options);

  const slackMembers = JSON.parse(response.getContentText()).members;

  for (const slackMember of slackMembers) {
    if (
      !slackMember.deleted &&
      !slackMember.is_bot &&
      slackMember.id !== "USLACKBOT" &&
      slackMember.profile.email.match("siiibo.com")
    ) {
      emailList.push(slackMember.profile.email);
    }
  }
  return emailList;
};

function isSameDate(
  date1: Date | GoogleAppsScript.Base.Date,
  date2: Date | GoogleAppsScript.Base.Date
): boolean {
  return (
    date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
  );
}

const setMidnight = (nowDate: Date): Date => {
  const midnightDate = set(nowDate, {
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  return midnightDate;
};

const getStartEndDate = (
  searchPeriod: "day" | "week" | "month"
): { start: Date; end: Date } => {
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
};

// 入力: yukiko.orui@siiibo.com 出力: orui yukiko
const convertEmailtoName = (email: string): string => {
  const firstName = email.split(".")[0];
  const familyName = email.split(".")[1].split("@")[0];
  return familyName + " " + firstName;
};

const createMessage = (
  event: GoogleAppsScript.Calendar.CalendarEvent
): string => {
  const eventStartDate = format(Number(event.getStartTime()), "M/d");
  const eventStartTime = format(Number(event.getStartTime()), "k:mm");

  const eventEndDate = format(Number(event.getEndTime()), "M/d");
  const eventEndTime = format(Number(event.getEndTime()), "k:mm");

  const creatorEmail = event.getCreators()[0];
  const name = convertEmailtoName(creatorEmail);

  if (event.isAllDayEvent()) {
    const eventTitle = "全休";
    // 【全休】 orui yukikoさん 10/4〜10/8 終日
    const message = `【${eventTitle}】 ${name}さん ${eventStartDate}〜${eventEndDate} 終日\n`;

    return message;
  } else {
    const eventTitle = "半休";
    // 【半休】 orui yukikoさん 10/21 10:00〜10:30
    const message = `【${eventTitle}】 ${name}さん ${eventStartDate} ${eventStartTime}〜${eventEndTime}\n`;

    return message;
  }
};

const getMessagesfromCalender = (
  calendarIds: string[],
  searchWord: RegExp,
  startDate: Date,
  endDate: Date
): string | undefined => {
  const messageList = [];
  const today = new Date();
  const isAnnounceDate = isSameDate(today, startDate) ? true : false;

  for (const calendarId of calendarIds) {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (calendar === null) {
      continue;
    }
    console.log(calendarId);
    const events = calendar.getEvents(startDate, endDate);
    if (events.length < 1) {
      continue;
    }

    for (const eventIndex in events) {
      const event = events[eventIndex];
      const title = event.getTitle();
      if (!title.match(searchWord)) {
        continue;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const eventCreateDay = event.getDateCreated();
      const needsAddMessage =
        !isAnnounceDate && isSameDate(yesterday, eventCreateDay) ? true : false;

      if (!isAnnounceDate && !needsAddMessage) {
        continue;
      }

      const message = createMessage(event);
      messageList.push(message);
    }
  }

  if (isAnnounceDate) {
    if (messageList.length < 1) {
      messageList.push("休暇取得者はいません");
    }

    const messageTitle = "-休暇取得者-\n";
    messageList.unshift(messageTitle);
  } else if (messageList.length >= 1) {
    const messageTitle = "-休暇取得者 (昨日追加)-\n";
    messageList.unshift(messageTitle);
  } else {
    return undefined;
  }

  const displayMessage = messageList.join("");

  return displayMessage;
};

const getSlackClient = (slackAppToken: string) => {
  return new SlackClient(slackAppToken);
};
