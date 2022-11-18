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

type SearchPeriod = "day" | "week" | "month";

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

  const client = getSlackClient(slackAppToken);

  const emails = getSlackMemberEmail(client);

  const searchWord = /休暇/;
  const postSlackChannel = "#attendance";
  const searchPeriod: SearchPeriod = "day";
  const startEndDate = getStartEndDate(searchPeriod);
  const startDate = startEndDate.start;
  const endDate = startEndDate.end;
  console.log("startdate", startDate);
  console.log("enddate", endDate);

  const displayMessage = getMessagesFromCalender(
    emails,
    searchWord,
    startDate,
    endDate
  );
  console.log(displayMessage);

  if (displayMessage !== undefined) {
    client.chat.postMessage({
      channel: postSlackChannel,
      text: displayMessage,
    });
  }
};

const getSlackMemberEmail = (client: SlackClient): (string | undefined)[] => {
  const response = client.users.list();
  const slackMembers = response.members;
  if (!slackMembers) throw new Error("SLACK_MEMBERS is not defined");

  const siiiboSlackMembers = slackMembers.filter(
    (slackMember) =>
      !slackMember.deleted &&
      !slackMember.is_bot &&
      slackMember.id !== "USLACKBOT" &&
      slackMember.profile?.email?.match("siiibo.com")
  );

  const emails = siiiboSlackMembers.map(
    (slackMember) => slackMember.profile?.email
  );

  return emails;
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
  searchPeriod: SearchPeriod
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
const convertEmailToName = (email: string): string => {
  const firstName = email.split(".")[0];
  const familyName = email.split(".")[1].split("@")[0];
  return familyName + " " + firstName;
};

const createMessage = (
  event: GoogleAppsScript.Calendar.CalendarEvent
): string => {
  const eventStartDate = format(
    new Date(event.getStartTime().getTime()),
    "M/d"
  );
  const eventStartTime = format(
    new Date(event.getStartTime().getTime()),
    "k:mm"
  );

  const eventEndDate = format(new Date(event.getEndTime().getTime()), "M/d");
  const eventEndTime = format(new Date(event.getEndTime().getTime()), "k:mm");

  const creatorEmail = event.getCreators()[0];
  const name = convertEmailToName(creatorEmail);

  return event.isAllDayEvent()
    ? `【全休】 ${name}さん ${eventStartDate}〜${eventEndDate} 終日\n`
    : `【半休】 ${name}さん ${eventStartDate} ${eventStartTime}〜${eventEndTime}\n`;
};

const getMessagesFromCalender = (
  emails: (string | undefined)[],
  searchWord: RegExp,
  startDate: Date,
  endDate: Date
): string | undefined => {
  const messageList = [];
  const today = new Date();
  const isAnnounceDate = isSameDate(today, startDate);

  for (const email of emails) {
    // emailをCalendarIdとして利用可能
    if (!email) {
      continue;
    }
    const calendar = CalendarApp.getCalendarById(email);
    if (calendar === null) {
      continue;
    }
    console.log(email);
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
        !isAnnounceDate && isSameDate(yesterday, eventCreateDay);

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
