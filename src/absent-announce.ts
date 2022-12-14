import { GasWebClient as SlackClient } from "@hi-se/web-api";
import {
  addDays,
  startOfWeek,
  startOfMonth,
  format,
  startOfDay,
  endOfDay,
  nextSunday,
  endOfMonth,
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

  const today = new Date();
  const isAnnounceDate = isSameDate(today, startDate);

  if (isAnnounceDate) {
    const calendars = getCalendarsFromEmails(emails);

    const events = getEventsFromCalendars(
      calendars,
      startDate,
      endDate,
      searchWord
    );

    const messagesToNotify = createMesssagesFromEvents(events);

    client.chat.postMessage({
      channel: postSlackChannel,
      text: messagesToNotify,
    });
  }
};

const getSlackMemberEmail = (client: SlackClient): string[] => {
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

  const emails = siiiboSlackMembers
    .map((slackMember) => slackMember.profile?.email ?? "")
    .filter((s) => s !== "");

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

const getStartEndDate = (
  searchPeriod: SearchPeriod
): { start: Date; end: Date } => {
  switch (searchPeriod) {
    case "day": {
      const startDate = startOfDay(new Date());
      const endDate = endOfDay(new Date());

      return { start: startDate, end: endDate };
    }

    case "week": {
      const thisMonday = addDays(startOfWeek(new Date()), 1);
      const startDate = startOfDay(thisMonday);
      const endDate = endOfDay(nextSunday(new Date()));
      return { start: startDate, end: endDate };
    }

    case "month": {
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(startDate);
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

const getCalendarsFromEmails = (
  emails: string[]
): GoogleAppsScript.Calendar.Calendar[] => {
  const calendars = emails
    .map((email) => CalendarApp.getCalendarById(email))
    .filter((calendar) => calendar);

  return calendars;
};

const getEventsFromCalendars = (
  calendars: GoogleAppsScript.Calendar.Calendar[],
  startDate: Date,
  endDate: Date,
  searchWord: RegExp
): GoogleAppsScript.Calendar.CalendarEvent[] => {
  const events = calendars
    .flatMap((calendar) => calendar.getEvents(startDate, endDate))
    .filter((event) => event.getTitle().match(searchWord));

  return events;
};

const createMesssagesFromEvents = (
  events: GoogleAppsScript.Calendar.CalendarEvent[]
): string => {
  if (events.length < 1) {
    const messagesToNotify = "-休暇取得者-\n休暇取得者はいません";
    return messagesToNotify;
  } else {
    const messageList = events.map((event) => createMessage(event));
    const messageTitle = "-休暇取得者-\n";
    const messagesToNotify = messageTitle + messageList.join("");
    return messagesToNotify;
  }
};

const getSlackClient = (slackAppToken: string) => {
  return new SlackClient(slackAppToken);
};
