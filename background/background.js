import { initializeMessaging } from "./messaging-service.js";
import { initializeCommands } from "./command-service.js";

console.log("Screen Reader Extension: Background script loaded!");

initializeMessaging();
initializeCommands();
