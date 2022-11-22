import { main, deleteAndSetTriggers } from "./absent-announce";

declare const global: any;
global.main = main;
global.deleteAndSetTriggers = deleteAndSetTriggers;
